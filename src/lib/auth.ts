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

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
