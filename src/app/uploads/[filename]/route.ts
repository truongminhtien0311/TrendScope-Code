// API: GET /uploads/[filename] — phục vụ ảnh tải tay lưu ở public/uploads/.
// Next.js "output: standalone" (dùng khi đóng gói Docker) CHỈ tự phục vụ
// được file đã có sẵn trong public/ lúc build (favicon, next.svg...),
// không tự phát hiện file mới ghi vào sau khi container chạy (ảnh upload
// runtime) — phải đọc thủ công từ ổ đĩa qua route này. Nằm ngoài /api để
// giữ nguyên URL cũ (/uploads/<file>) đã lưu trong ListingImage.url,
// không cần sửa dữ liệu cũ. middleware.ts đã loại "uploads" khỏi matcher
// nên route này không cần đăng nhập, giống hành vi cũ.
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { resolveUploadsDir } from "@/lib/paths";

const UPLOADS_DIR = resolveUploadsDir();

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Chặn path traversal — chỉ nhận tên file thuần (uuid.ext), không có "/" hay "..".
  if (filename.includes("/") || filename.includes("..")) {
    return new NextResponse(null, { status: 400 });
  }
  const contentType = CONTENT_TYPES[path.extname(filename).toLowerCase()];
  if (!contentType) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const buffer = await readFile(path.join(UPLOADS_DIR, filename));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
