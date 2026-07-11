// API: GET /api/health — kiểm tra app đã sẵn sàng, dùng để Electron
// (electron/main.js) biết khi nào Next.js server con đã khởi động xong
// trước khi mở cửa sổ. Không cần đăng nhập (xem src/middleware.ts).
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true });
}
