// ============================================================
// API: POST /api/uploads — nhận file ảnh (tải lên hoặc dán clipboard),
// lưu vào public/uploads/ (Next.js tự phục vụ tĩnh tại /uploads/<file>).
// Dùng cho ImageManager: cả 2 cách "tải file lên" và "Ctrl+V dán ảnh"
// đều đi qua endpoint này (client gửi File/Blob dạng multipart FormData).
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";

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
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Chỉ nhận ảnh JPEG/PNG/WEBP/GIF" }, { status: 400 });
  }

  // Tên file ngẫu nhiên — không dùng tên gốc để tránh path traversal/trùng tên
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(process.cwd(), "public", "uploads", fileName), buffer);

  return NextResponse.json({ url: `/uploads/${fileName}` }, { status: 201 });
}
