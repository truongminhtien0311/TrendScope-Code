// Hook chuẩn của Next.js — hàm register() chạy ĐÚNG 1 LẦN lúc server khởi
// động (cả `npm run dev` lẫn server standalone trong bản đóng gói
// Electron, xem electron/main.js: startPackagedServer/startDevServer đều
// spawn tiến trình Next thật, không phải serverless). Dùng để đăng ký lịch
// quét ảnh chờ đồng bộ Drive ở nền — xem runDriveSyncSweep() trong
// src/lib/storage/index.ts.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // mỗi 5 phút

export async function register() {
  // Chỉ chạy ở Node.js runtime thật (có fs/prisma) — bỏ qua nếu Next chạy
  // bằng Edge runtime cho phần nào đó của app.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { runDriveSyncSweep } = await import("@/lib/storage");
  runDriveSyncSweep().catch(() => {});
  setInterval(() => runDriveSyncSweep().catch(() => {}), SWEEP_INTERVAL_MS);
}
