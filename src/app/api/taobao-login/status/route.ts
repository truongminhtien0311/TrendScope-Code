// API: GET /api/taobao-login/status — trạng thái đăng nhập hiện tại,
// hiển thị thanh trạng thái trong Cài đặt.
import { NextResponse } from "next/server";
import { getLoginStatus } from "@/lib/taobao-login";

export async function GET() {
  const status = await getLoginStatus();
  return NextResponse.json(status);
}
