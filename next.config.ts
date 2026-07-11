import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bắt buộc cho đóng gói Electron — cần bản server gọn nhẹ
  // (.next/standalone/server.js) để nhúng vào app, không copy cả
  // node_modules dev đầy đủ. Xem electron/main.js.
  output: "standalone",
};

export default nextConfig;
