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
// build/prisma-runtime/node_modules — đây là thư mục electron-builder ĐÃ
// đóng gói ổn định vào resources/node_modules (dùng chung với Prisma CLI
// chạy migration, xem electron/main.js). Node tự tìm ngược lên node_modules
// nên cả electron/seed-providers.js lẫn resources/standalone/server.js đều
// thấy được (kể cả @prisma/client).
const standaloneModules = path.join(__dirname, "..", ".next", "standalone", "node_modules");
const runtimeModules = path.join(__dirname, "..", "build", "prisma-runtime", "node_modules");
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
