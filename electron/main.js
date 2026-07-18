// ============================================================
// VỎ ELECTRON — cho TrendScope chạy như 1 app desktop thật (bấm đúp
// mở, không cần biết Node.js/terminal). Next.js vẫn là server thật,
// chạy NGẦM làm tiến trình con — cửa sổ Electron chỉ mở 1 trang trỏ vào
// server đó (giống mở trình duyệt, nhưng không có thanh địa chỉ/tab).
//
// 2 chế độ:
//   - Dev (`npm run electron:dev`): spawn `next dev`, dùng .env của repo
//     y hệt `npm run dev` bình thường — không đụng gì tới dữ liệu thật.
//   - Đóng gói (bản .exe cài thật): spawn bản "standalone" đã build,
//     dữ liệu (dev.db) lưu ở thư mục riêng của người dùng
//     (app.getPath("userData")) — MỖI MÁY CÀI RIÊNG, không dùng chung
//     .env của repo. Không chạy seed — máy trống sẽ tự hiện màn hình
//     "Thiết lập lần đầu" (xem src/app/setup/page.tsx).
// ============================================================
const { app, BrowserWindow, Menu, ipcMain, dialog, shell, Notification } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn, spawnSync } = require("child_process");
const { autoUpdater } = require("electron-updater");

const CHECK_UPDATE_INTERVAL_MS = 4 * 60 * 60 * 1000; // mỗi 4 giờ

const isPackaged = app.isPackaged;
const PORT = isPackaged ? 3100 : 3000; // cổng khác nhau để không đụng npm run dev đang mở song song

// Chỉ cho phép 1 cửa sổ app chạy cùng lúc — bấm đúp mở lại icon lúc app
// đã chạy sẽ chỉ đưa cửa sổ cũ lên trước, không mở thêm bản mới (tránh
// 2 tiến trình cùng tranh nhau 1 database SQLite).
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

let serverProcess = null;
let mainWindow = null;

function waitForServerReady(url, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on("error", () => {
          if (Date.now() - start > timeoutMs) reject(new Error("Server không khởi động kịp"));
          else setTimeout(tryOnce, 300);
        });
    };
    tryOnce();
  });
}

// QUAN TRỌNG: trong bản đã đóng gói, process.execPath trỏ vào chính
// file .exe của Electron (không phải Node.js thường) — spawn thẳng nó
// với 1 file .js sẽ VÔ TÌNH MỞ THÊM 1 CỬA SỔ APP MỚI (app đó lại tự
// spawn tiếp app khác => lặp vô hạn, đã xảy ra thật lúc test). Bắt buộc
// set biến môi trường ELECTRON_RUN_AS_NODE=1 để Electron chạy như Node
// thuần (không mở app/cửa sổ gì cả) — đây là cách chính thức Electron
// hỗ trợ để dùng Node bundled sẵn thay vì bắt máy cài Node.js riêng.
const NODE_ENV_OVERRIDE = { ELECTRON_RUN_AS_NODE: "1" };

// Chỉ dùng khi ĐÃ ĐÓNG GÓI — chạy migrate deploy trước khi mở server,
// an toàn gọi mỗi lần khởi động (migration đã áp dụng rồi thì tự bỏ qua).
function runMigrations(resourcesPath, databaseUrl) {
  const schemaPath = path.join(resourcesPath, "prisma", "schema.prisma");
  const prismaCli = path.join(resourcesPath, "node_modules", "prisma", "build", "index.js");
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy", "--schema", schemaPath], {
    env: { ...process.env, ...NODE_ENV_OVERRIDE, DATABASE_URL: databaseUrl },
    cwd: resourcesPath,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error("Chạy migration thất bại — xem log ở trên.");
  }
}

// Bản đóng gói không chạy prisma/seed.ts (cố tình bỏ dữ liệu sản phẩm mẫu),
// nhưng danh sách provider (Mock/Otapi/Alibaba/Gemini...) vẫn cần có sẵn để
// trang Cài đặt > API không trống trơn trên máy mới cài — xem
// electron/seed-providers.js. An toàn gọi mỗi lần khởi động.
function seedProviders(resourcesPath, databaseUrl) {
  const seedScript = path.join(__dirname, "seed-providers.js");
  const result = spawnSync(process.execPath, [seedScript, resourcesPath], {
    env: { ...process.env, ...NODE_ENV_OVERRIDE, DATABASE_URL: databaseUrl },
    cwd: resourcesPath,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error("Seed danh sách provider thất bại — xem log ở trên.");
  }
}

function startPackagedServer() {
  const resourcesPath = process.resourcesPath;
  const dataDir = app.getPath("userData");
  fs.mkdirSync(dataDir, { recursive: true });
  const databaseUrl = `file:${path.join(dataDir, "dev.db")}`;
  // Ảnh local (xem src/lib/storage/index.ts, src/lib/paths.ts) đặt CẠNH
  // database trong thư mục dữ liệu riêng của user — KHÔNG đặt trong
  // "standalone/public/uploads" (bên trong resourcesPath, thư mục cài đặt
  // app), vì bản cập nhật/cài lại sau này sẽ ghi đè thư mục đó, xóa mất
  // ảnh đã cào. userData thì không bị đụng tới khi cập nhật/cài lại.
  const uploadsDir = path.join(dataDir, "uploads");

  runMigrations(resourcesPath, databaseUrl);
  seedProviders(resourcesPath, databaseUrl);

  const serverEntry = path.join(resourcesPath, "standalone", "server.js");
  serverProcess = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      ...NODE_ENV_OVERRIDE,
      DATABASE_URL: databaseUrl,
      UPLOADS_DIR: uploadsDir,
      // Chuỗi cố định — đủ an toàn cho app desktop cá nhân (không phải
      // server công khai nhiều người dùng chung như trước lúc còn VPS).
      SESSION_SECRET: "a1f9c3e7b5d2846f0e9c1a7b3d5f8021e4c6a9b2d7f0138c5e9a2b4d6f8013a7",
      PORT: String(PORT),
      NODE_ENV: "production",
    },
    cwd: resourcesPath,
    stdio: "inherit",
  });
}

function startDevServer() {
  // Chạy đúng như `npm run dev` bình thường — đọc .env của repo, dùng
  // dev.db hiện có, không tự tạo secret/DB riêng gì cả.
  const repoRoot = path.join(__dirname, "..");
  const nextBin = path.join(repoRoot, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
  // shell: true trên Windows KHÔNG tự bọc dấu ngoặc kép quanh đường dẫn có
  // dấu cách (vd "C:\AI Work\...") — phải tự bọc, không thì cmd.exe đọc
  // nhầm phần trước dấu cách đầu tiên thành tên lệnh, báo "not recognized".
  const nextBinArg = process.platform === "win32" ? `"${nextBin}"` : nextBin;
  serverProcess = spawn(nextBinArg, ["dev", "-p", String(PORT)], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: true,
  });
}

async function createWindow() {
  const windowTitle = `TrendScope ${app.getVersion()}`;
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: windowTitle,
    autoHideMenuBar: true,
    // Thanh tiêu đề mặc định của Windows (trắng, nút vuông cùi) không hợp
    // vibe dark/tech của app — dùng "hidden" + tự tô màu overlay (nút
    // đóng/thu nhỏ vẫn là nút thật của Windows, chỉ đổi màu nền/icon cho
    // khớp màu navy của sidebar, xem src/app/globals.css --bg-sidebar).
    titleBarStyle: "hidden",
    titleBarOverlay: {
      // Đồng bộ với --bg-sidebar của dark mode (gần đen trung tính, xem
      // src/app/globals.css) thay vì navy đặc — nhìn phẳng/hiện đại hơn,
      // đỡ giống thanh tiêu đề Win32 cũ. Icon dùng màu xám dịu thay vì
      // trắng chói, đỡ "gắt" khi cửa sổ không active.
      color: "#08090c",
      symbolColor: "#9199a8",
      height: 32,
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  // Mọi lượt tải xuống từ trang web (PDF báo cáo, xuất CSV/JSON...) — mặc
  // định Electron tự lưu thẳng vào thư mục Downloads không hỏi gì, người
  // dùng không biết file nằm đâu. Chặn lại để: (1) luôn hỏi nơi lưu bằng
  // hộp thoại "Lưu file" thật của Windows, (2) báo thành công bằng
  // notification hệ thống, bấm vào mở luôn thư mục chứa file đó.
  mainWindow.webContents.session.on("will-download", (event, item) => {
    const savePath = dialog.showSaveDialogSync(mainWindow, {
      title: "Lưu file",
      defaultPath: path.join(app.getPath("downloads"), item.getFilename()),
    });
    if (!savePath) {
      item.cancel();
      return;
    }
    item.setSavePath(savePath);
    item.once("done", (_event, state) => {
      if (state !== "completed") return;
      const notification = new Notification({
        title: "Đã tải xong",
        body: path.basename(savePath),
      });
      notification.on("click", () => shell.showItemInFolder(savePath));
      notification.show();
    });
  });

  // Next.js tự đặt <title> riêng (xem src/app/layout.tsx) — nếu không chặn,
  // Electron sẽ tự đổi tiêu đề cửa sổ theo đó lúc trang tải xong, mất luôn
  // số version đã đặt ở trên. Giữ nguyên tiêu đề có version thay vì để
  // trang web ghi đè.
  mainWindow.on("page-title-updated", (event) => {
    event.preventDefault();
  });

  // Cửa sổ chính KHÔNG có thanh địa chỉ/nút back (autoHideMenuBar) — nếu để
  // nó tự điều hướng sang domain ngoài (vd lúc "Kết nối với Google") thì
  // người dùng bị kẹt luôn ở đó, không có cách nào quay lại app (từng gặp:
  // "trắng màn hình, không có nút quay lại, phải thoát app vào lại"). Google
  // cũng chủ động chặn đăng nhập trong trình duyệt nhúng như Electron. Nên
  // mọi link ra domain khác localhost đều mở bằng trình duyệt mặc định của
  // máy thay vì điều hướng ngay trong cửa sổ app — cửa sổ app luôn giữ
  // nguyên ở trang đang xem.
  const isOwnServer = (url) => new URL(url).origin === `http://localhost:${PORT}`;
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isOwnServer(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isOwnServer(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  await mainWindow.loadURL(`http://localhost:${PORT}`);
}

// Gửi trạng thái cập nhật cho trang web đang hiển thị (qua preload.js)
// thay vì dùng dialog.showMessageBox mặc định của Windows — trang web
// tự hiện toast đẹp bằng sonner (xem src/components/UpdateNotifier.tsx).
function sendUpdateStatus(data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-status", data);
  }
}

function setupAutoUpdate() {
  // CHỈ hoạt động ở bản đã đóng gói thật — electron-updater không chạy
  // được (và không cần) với bản electron:dev.
  if (!isPackaged) return;

  autoUpdater.autoDownload = true;
  // Báo đủ TỪNG bước cho trang web hiện tiến trình rõ ràng (xem
  // src/components/UpdateNotifier.tsx) thay vì chỉ im lặng tới lúc tải
  // xong — người dùng biết app đang làm gì, không tưởng app bị treo.
  autoUpdater.on("checking-for-update", () => sendUpdateStatus({ status: "checking" }));
  autoUpdater.on("update-available", (info) => sendUpdateStatus({ status: "available", version: info.version }));
  autoUpdater.on("update-not-available", () => sendUpdateStatus({ status: "not-available" }));
  autoUpdater.on("download-progress", (progress) =>
    sendUpdateStatus({ status: "downloading", percent: Math.round(progress.percent) })
  );
  autoUpdater.on("update-downloaded", (info) => sendUpdateStatus({ status: "downloaded", version: info.version }));
  autoUpdater.on("error", (err) => sendUpdateStatus({ status: "error", message: String(err) }));

  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), CHECK_UPDATE_INTERVAL_MS);
}

// isSilent=true: cài đặt không hiện thêm cửa sổ trình cài đặt NSIS (chạy
// ngầm) — isForceRunAfter=true: tự mở lại app ngay sau khi cài xong, đúng
// yêu cầu "tự khởi động lại khi cài đặt thành công", không bắt người dùng
// tự mở lại app.
ipcMain.on("restart-and-install", () => autoUpdater.quitAndInstall(true, true));
ipcMain.handle("get-app-version", () => app.getVersion());

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);

  try {
    if (isPackaged) startPackagedServer();
    else startDevServer();

    await waitForServerReady(`http://localhost:${PORT}/api/health`, 60000);
    await createWindow();
    setupAutoUpdate();
  } catch (err) {
    // Lỗi lúc khởi động (migration hỏng, server không lên được...) — báo
    // rõ ràng bằng hộp thoại rồi thoát hẳn, KHÔNG được để app treo âm
    // thầm hoặc lặp lại logic khởi động (từng gây ra hàng trăm tiến
    // trình con lúc test — xem NODE_ENV_OVERRIDE ở trên).
    dialog.showErrorBox("TrendScope không khởi động được", String(err && err.stack ? err.stack : err));
    killServer();
    app.quit();
  }
});

function killServer() {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
    serverProcess = null;
  }
}

app.on("window-all-closed", () => {
  killServer();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", killServer);
