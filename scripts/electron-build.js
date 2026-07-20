// Chạy electron-builder nhưng ghi ra dist/<version>/ thay vì luôn đè lên
// dist/ gốc — để giữ lại được các bản cài đặt cũ, so sánh dễ dàng.
// Dùng script Node thay vì đặt thẳng trong package.json vì
// "directories.output" của electron-builder không tự thay ${version}.
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const pkg = require("../package.json");

const outDir = path.join("dist", pkg.version);
console.log(`Đóng gói phiên bản ${pkg.version} -> ${outDir}`);

// electron-builder không giữ lại thư mục node_modules bên trong
// .next/standalone khi đóng gói (bị strip mất toàn bộ — kể cả "next",
// "react"... không riêng Prisma — đã kiểm chứng nhiều lần build, không rõ vì
// sao). Gộp thẳng toàn bộ node_modules mà `next build` đã dựng sẵn (chỉ gồm
// đúng những gói standalone server cần, do Next tự trace) vào
// build/resources-node-modules — đây là thư mục electron-builder ĐÃ đóng
// gói ổn định vào resources/node_modules (dùng chung với Prisma CLI chạy
// migration, xem electron/main.js). Node tự tìm ngược lên node_modules nên
// cả electron/seed-providers.js lẫn resources/standalone/server.js đều
// thấy được (kể cả @prisma/client).
//
// QUAN TRỌNG: thư mục gộp này CHỈ được đụng tới bằng copy file (rm/cpSync),
// KHÔNG BAO GIỜ chạy `npm install` thẳng vào đây — npm sẽ tự coi các gói
// copy tay vào (next/react/sharp/playwright...) là "rác thừa" (không thuộc
// package.json nào nó quản lý) rồi tự XOÁ SẠCH lúc install (đã gặp thật:
// đổi bước "npm install prisma" xuống sau bước copy này thì y hệt vòng lặp
// cũ nhưng ngược lại — mất next/react/playwright/@prisma-client). Gói
// "prisma" CLI phải cài ở một thư mục RIÊNG (build/prisma-runtime, xem bên
// dưới) rồi COPY node_modules của nó sang đây, không install trực tiếp.
const standaloneModules = path.join(__dirname, "..", ".next", "standalone", "node_modules");
const runtimeModules = path.join(__dirname, "..", "build", "resources-node-modules");
// Xoá sạch trước khi copy — không thì rác từ các lần build trước (đặc biệt
// file .tmp* lúc Prisma tải engine bị khoá không rename/xoá được trên
// Windows) cứ cộng dồn mãi, từng khiến thư mục này nặng gần 1GB (hơn chục
// bản trùng của cùng 1 file query engine ~20MB) và bộ cài .exe bị phình to
// không cần thiết. An toàn xoá sạch vì thư mục này KHÔNG do npm quản lý,
// chỉ toàn file copy tay ở dưới, không mất gì không tái tạo lại được.
fs.rmSync(runtimeModules, { recursive: true, force: true });
fs.cpSync(standaloneModules, runtimeModules, { recursive: true });

// Next tự "trace" (dò xem file nào thật sự cần) để quyết định copy gì vào
// .next/standalone/node_modules — nhưng dò thiếu với playwright: bỏ sót
// playwright-core/browsers.json (file JSON được require() từ bên trong 1
// bundle đã minify nên Next không dò tĩnh ra được) khiến chromium.launch()
// lúc chạy thật báo "Cannot find module '...playwright-core/browsers.json'"
// (tính năng Đăng nhập Taobao qua QR). Chép đè nguyên vẹn 2 gói này từ
// node_modules gốc (đủ toàn bộ file, không qua bước trace) để chắc chắn không
// thiếu sót gì tương tự.
for (const dep of ["playwright", "playwright-core"]) {
  const from = path.join(__dirname, "..", "node_modules", dep);
  const to = path.join(runtimeModules, dep);
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
}

// Cài gói "prisma" (CLI chạy migration lúc khởi động, xem electron/main.js
// runMigrations) vào thư mục RIÊNG build/prisma-runtime — KHÔNG cài thẳng
// vào runtimeModules ở trên (xem lý do ở comment đầu file). Xoá node_modules
// cũ trước để không cộng dồn rác qua nhiều lần build, giống lý do xoá
// runtimeModules ở trên.
const prismaRuntimeDir = path.join(__dirname, "..", "build", "prisma-runtime");
fs.rmSync(path.join(prismaRuntimeDir, "node_modules"), { recursive: true, force: true });
// shell: true trên Windows KHÔNG tự bọc dấu ngoặc kép quanh đường dẫn có
// dấu cách (vd "C:\AI Work\...") — phải tự bọc, không thì cmd.exe cắt đôi
// thành 2 tham số, npm hiểu nhầm nửa sau là tên gói cần cài (đã gặp thật:
// báo lỗi ENOENT tìm package.json ở đường dẫn ghép lộn xộn).
const prismaRuntimeDirArg = process.platform === "win32" ? `"${prismaRuntimeDir}"` : prismaRuntimeDir;
const npmInstall = spawnSync("npm", ["install", "--prefix", prismaRuntimeDirArg, "--no-audit", "--no-fund"], {
  stdio: "inherit",
  shell: true,
});
if (npmInstall.error || npmInstall.status !== 0) {
  console.error("Cài đặt gói prisma vào build/prisma-runtime thất bại.");
  process.exit(npmInstall.status ?? 1);
}
// Gộp (copy, không xoá gì ở runtimeModules) node_modules vừa cài của prisma
// vào chung thư mục đóng gói — chỉ copy file nên không đụng gì tới
// next/react/sharp/playwright đã copy ở trên.
fs.cpSync(path.join(prismaRuntimeDir, "node_modules"), runtimeModules, { recursive: true });

// shell: true bắt buộc trên Windows — spawnSync gọi thẳng file .cmd (npx.cmd)
// mà không qua shell sẽ báo lỗi EINVAL, không chạy được.
const result = spawnSync("npx", ["electron-builder", `--config.directories.output=${outDir}`], {
  stdio: "inherit",
  shell: true,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
