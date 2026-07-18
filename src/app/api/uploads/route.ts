// ============================================================
// API: POST /api/uploads — nhận file ảnh (tải lên hoặc dán clipboard).
// Dùng cho ImageManager: cả 2 cách "tải file lên" và "Ctrl+V dán ảnh"
// đều đi qua endpoint này (client gửi File/Blob dạng multipart FormData).
//
// CHẶNG 6: LUÔN ghi vào public/uploads/ trước (nhanh, không chờ Drive),
// trả thêm `localPath` để client gắn vào ListingImage — Google Drive (nếu
// bật) đồng bộ ngầm sau đó qua runDriveSyncSweep() (xem src/lib/storage/index.ts).
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { saveLocalBuffer } from "@/lib/storage";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu file ảnh" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Ảnh quá 10MB" }, { status: 400 });
  }
  if (!ALLOWED_TYPES[file.type]) {
    return NextResponse.json({ error: "Chỉ nhận ảnh JPEG/PNG/WEBP/GIF" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { url, localPath } = await saveLocalBuffer(buffer, file.type);
  return NextResponse.json({ url, localPath }, { status: 201 });
}
