// ============================================================
// ĐƯỜNG DẪN FILE THẬT trên đĩa cho dữ liệu cần SỐNG SÓT qua các lần app
// tự cập nhật/cài lại — KHÔNG được đặt trong thư mục cài đặt app (bản
// đóng gói mới có thể ghi đè/xóa khi cập nhật), phải nằm trong thư mục
// dữ liệu riêng của user.
//
// electron/main.js (startPackagedServer) đã tự làm đúng việc này cho
// database: dùng app.getPath("userData") (Electron API, chỉ gọi được ở
// tiến trình chính, KHÔNG gọi được từ đây vì đây là code chạy trong tiến
// trình Next.js con) rồi truyền qua biến môi trường DATABASE_URL. File
// này SUY RA lại đường dẫn thư mục dữ liệu đó từ DATABASE_URL (nguồn duy
// nhất, tránh lệch nhau giữa 2 nơi cấu hình) để dùng cho ảnh local +
// backup database — cả 2 thứ đều cần nằm CẠNH database, không phải trong
// thư mục cài đặt.
//
// Dev (`npm run dev` / `npm run electron:dev`) không đụng gì cơ chế này —
// .env có DATABASE_URL="file:./dev.db" (tương đối, theo đúng quy ước
// Prisma: tính từ thư mục prisma/), vẫn dùng public/uploads/ như cũ cho
// tiện xem trực tiếp trong thư mục dự án.
// ============================================================
import path from "node:path";

export function resolveDatabaseFilePath(): string {
  const raw = (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, "");
  return path.isAbsolute(raw) ? raw : path.join(process.cwd(), "prisma", raw);
}

// Bản đóng gói: electron/main.js set UPLOADS_DIR = <thư mục userData>/uploads
// (cạnh dev.db). Không set (dev thường) -> rơi về public/uploads/ như cũ.
export function resolveUploadsDir(): string {
  if (process.env.UPLOADS_DIR) return process.env.UPLOADS_DIR;
  return path.join(process.cwd(), "public", "uploads");
}
