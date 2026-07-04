// ============================================================
// CHẶN TOÀN BỘ ROUTE khi chưa đăng nhập (Chặng 6) — trừ /login và
// /api/auth/* (route xử lý đăng nhập/tạo session, phải luôn mở được).
// Chạy Edge runtime nên CHỈ import src/lib/session-config.ts (không
// import src/lib/auth.ts vì file đó có Prisma, không chạy được Edge).
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session-config";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  if (!session.userId) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return response;
}

export const config = {
  // Bỏ qua: /login, /api/auth/*, tài nguyên tĩnh Next.js, ảnh upload local
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico|uploads).*)"],
};
