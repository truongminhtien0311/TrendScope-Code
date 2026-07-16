// ============================================================
// ĐĂNG NHẬP + SESSION (Chặng 6) — nhiều tài khoản riêng biệt (không
// phải 1 mật khẩu dùng chung), dùng iron-session (cookie mã hóa, không
// cần bảng session riêng trong DB) + bcryptjs (băm mật khẩu).
//
// LẦN ĐĂNG NHẬP ĐẦU TIÊN CỦA 1 TÀI KHOẢN (passwordHash còn trống — vd
// tài khoản admin seed sẵn, hoặc tài khoản admin vừa thêm cho đồng
// nghiệp): mật khẩu gõ vào lần đầu sẽ được LƯU LUÔN làm mật khẩu chính
// thức (xem route /api/auth/login) — tránh phải hardcode/commit sẵn 1
// mật khẩu mặc định nào vào seed.ts (rủi ro rò rỉ vì seed.ts nằm trong
// git).
//
// File này dùng next/headers + Prisma nên CHỈ chạy được trong Node
// runtime (API routes, Server Components) — middleware.ts (chạy Edge)
// dùng riêng src/lib/session-config.ts, không import file này.
// ============================================================
import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
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


