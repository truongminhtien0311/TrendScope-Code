// ============================================================
// VỎ ELECTRON — cho Product Scrap chạy như 1 app desktop thật (bấm đúp
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
const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
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

function startPackagedServer() {
  const resourcesPath = process.resourcesPath;
  const dataDir = app.getPath("userData");
  fs.mkdirSync(dataDir, { recursive: true });
  const databaseUrl = `file:${path.join(dataDir, "dev.db")}`;

  runMigrations(resourcesPath, databaseUrl);

  const serverEntry = path.join(resourcesPath, "standalone", "server.js");
  serverProcess = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      ...NODE_ENV_OVERRIDE,
      DATABASE_URL: databaseUrl,
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
  serverProcess = spawn(nextBin, ["dev", "-p", String(PORT)], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: true,
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: `Product Scrap ${app.getVersion()}`,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
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
  autoUpdater.on("update-available", () => sendUpdateStatus({ status: "available" }));
  autoUpdater.on("update-downloaded", (info) => sendUpdateStatus({ status: "downloaded", version: info.version }));
  autoUpdater.on("error", (err) => sendUpdateStatus({ status: "error", message: String(err) }));

  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), CHECK_UPDATE_INTERVAL_MS);
}

ipcMain.on("restart-and-install", () => autoUpdater.quitAndInstall());
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
    dialog.showErrorBox("Product Scrap không khởi động được", String(err && err.stack ? err.stack : err));
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
