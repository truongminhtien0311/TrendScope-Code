// API: GET /api/taobao-login/poll?token=... — gọi lặp lại (vd mỗi 2s)
// để kiểm tra người dùng đã quét + xác nhận đăng nhập trên điện thoại
// xong chưa. Trả về "pending" | "success" | "expired".
import { NextRequest, NextResponse } from "next/server";
import { pollLogin } from "@/lib/taobao-login";
import { logActivity } from "@/lib/log";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Thiếu token" }, { status: 400 });
  }
  const status = await pollLogin(token);
  if (status === "success") {
    await logActivity("taobao_login.success", "Đăng nhập Taobao qua QR thành công");
  }
  return NextResponse.json({ status });
}
