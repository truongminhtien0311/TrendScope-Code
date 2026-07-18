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
};

export default nextConfig;
