// ============================================================
// CHẶN TOÀN BỘ ROUTE khi chưa đăng nhập (Chặng 6) — trừ /login, /setup
// (thiết lập lần đầu khi database trống, xem src/app/setup/page.tsx),
// /api/auth/* (route xử lý đăng nhập/tạo session, phải luôn mở được) và
// /api/health (Electron dùng để biết server con đã sẵn sàng chưa).
// Chạy Edge runtime nên CHỈ import src/lib/session-config.ts (không
// import src/lib/auth.ts vì file đó có Prisma, không chạy được Edge).
//
// Gắn thêm header "x-pathname" — src/app/layout.tsx đọc lại để biết có
// nên ẩn Sidebar hay không (trang /report dùng làm tài liệu trình bày/
// PDF, không nên có khung điều hướng). Layout (Server Component) không
// có cách nào khác để biết pathname hiện tại ngoài đọc lại từ header.
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session-config";

export async function middleware(request: NextRequest) {
  // Phải set qua "request.headers" (không phải "headers" ở gốc) — đây mới
  // là cách Next.js chuyển tiếp header vào request thật cho phía server
  // đọc lại bằng headers() trong Server Component, không phải header trả
  // về trình duyệt.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  if (!session.userId) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return response;
}

export const config = {
  // Bỏ qua: /login, /setup, /api/auth/*, /api/storage/google/*, /api/health, tài nguyên tĩnh Next.js, ảnh upload local
  matcher: ["/((?!login|setup|api/auth|api/storage/google|api/health|_next/static|_next/image|favicon.ico|uploads).*)"],
};
