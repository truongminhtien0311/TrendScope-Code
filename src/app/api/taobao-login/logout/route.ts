// API: POST /api/taobao-login/logout — xóa phiên đăng nhập Taobao đã lưu.
import { NextResponse } from "next/server";
import { clearLogin } from "@/lib/taobao-login";
import { logActivity } from "@/lib/log";

export async function POST() {
  await clearLogin();
  await logActivity("taobao_login.logout", "Đã xóa phiên đăng nhập Taobao");
  return NextResponse.json({ ok: true });
}
