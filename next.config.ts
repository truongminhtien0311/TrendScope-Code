import type { NextConfig } from "next";
import { version } from "./package.json";

const nextConfig: NextConfig = {
  // Bắt buộc cho đóng gói Electron — cần bản server gọn nhẹ
  // (.next/standalone/server.js) để nhúng vào app, không copy cả
  // node_modules dev đầy đủ. Xem electron/main.js.
  output: "standalone",
  // Cho Sidebar hiện số phiên bản NGAY CẢ khi chạy bằng trình duyệt
  // thường (npm run dev) — window.electronAPI chỉ có trong bản đóng gói
  // (xem electron/preload.js), nên cần 1 nguồn dự phòng luôn có sẵn.
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  // playwright-core có 1 nhánh hỗ trợ TEST app Electron (không dùng ở đây,
  // ta chỉ dùng playwright để mở Chromium headless — xem
  // src/lib/taobao-login/index.ts) nhưng vẫn require("electron") trong code
  // của nó (lib/server/electron/loader.js) — Next dò tĩnh (@vercel/nft)
  // thấy require() này, tìm ra gói "electron" có thật trong node_modules
  // (cần cho electron:build) rồi gộp NGUYÊN CẢ gói vào .next/standalone,
  // kéo theo bản Electron/Chromium tải sẵn ~350MB (chỉ dùng lúc `electron .`
  // ở máy dev, không server nào cần) làm bộ cài phình to vô lý mỗi bản.
  // Loại thẳng khỏi bản trace vì server không bao giờ thật sự dùng tới.
  outputFileTracingExcludes: {
    "/*": ["node_modules/electron/**/*"],
  },
};

export default nextConfig;
