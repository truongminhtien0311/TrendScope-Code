// ============================================================
// ĐĂNG NHẬP + SESSION — nhiều tài khoản riêng biệt, đăng nhập bằng
// Google OAuth (xem src/app/api/auth/google/). Session vẫn dùng
// iron-session (cookie mã hóa, không cần bảng session riêng trong DB)
// để giữ trạng thái đăng nhập sau khi Google xác thực xong.
//
// File này dùng next/headers + Prisma nên CHỈ chạy được trong Node
// runtime (API routes, Server Components) — middleware.ts (chạy Edge)
// dùng riêng src/lib/session-config.ts, không import file này.
// ============================================================
import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sessionOptions, type SessionData } from "@/lib/session-config";

export type { SessionData };

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

// Người dùng đang đăng nhập trong request hiện tại (server component/route).
export async function getCurrentUser() {
  const session = await getSession();
  if (!session.userId) return null;
  return prisma.user.findUnique({ where: { id: session.userId } });
}

// Chặn thao tác chỉ-admin (sửa Cài đặt/API key, kết nối Drive, xóa sản
// phẩm...) — dùng đầu API route: const { forbidden } = await requireAdmin();
// if (forbidden) return forbidden;
export async function requireAdmin(): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>; forbidden: null }
  | { user: null; forbidden: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return {
      user: null,
      forbidden: NextResponse.json({ error: "Chỉ admin được thao tác này" }, { status: 403 }),
    };
  }
  return { user, forbidden: null };
}


