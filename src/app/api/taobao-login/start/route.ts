// API: POST /api/taobao-login/start — mở trang đăng nhập Taobao, trả
// về ảnh mã QR (base64) để người dùng quét bằng app Taobao trên điện thoại.
import { NextResponse } from "next/server";
import { startLogin } from "@/lib/taobao-login";
import { logActivity } from "@/lib/log";

export async function POST() {
  try {
    const { token, qrImageBase64 } = await startLogin();
    await logActivity("taobao_login.start", "Bắt đầu đăng nhập Taobao qua QR");
    return NextResponse.json({ token, qrImage: `data:image/png;base64,${qrImageBase64}` });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
