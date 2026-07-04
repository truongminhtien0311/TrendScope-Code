// ============================================================
// API: POST /api/uploads — nhận file ảnh (tải lên hoặc dán clipboard).
// Dùng cho ImageManager: cả 2 cách "tải file lên" và "Ctrl+V dán ảnh"
// đều đi qua endpoint này (client gửi File/Blob dạng multipart FormData).
//
// CHẶNG 5b: nếu có storage cloud đang bật (Google Drive...), lưu qua đó
// (provider.saveBuffer). Provider nào không hỗ trợ/chưa bật -> fallback
// ghi vào public/uploads/ như hành vi cũ (Next.js tự phục vụ tĩnh tại
// /uploads/<file>).
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { getStorageProvider } from "@/lib/storage";

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

  const provider = await getStorageProvider();
  if (provider.saveBuffer) {
    try {
      const url = await provider.saveBuffer(buffer, fileName, file.type);
      return NextResponse.json({ url }, { status: 201 });
    } catch (err) {
      console.error(`Lưu ảnh qua ${provider.name} thất bại, chuyển sang lưu local:`, err);
    }
  }

  await writeFile(path.join(process.cwd(), "public", "uploads", fileName), buffer);
  return NextResponse.json({ url: `/uploads/${fileName}` }, { status: 201 });
}
