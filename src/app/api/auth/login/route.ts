// API: POST /api/auth/login — { email, password }
// Nếu tài khoản CHƯA có mật khẩu (passwordHash null — tài khoản admin
// seed sẵn, hoặc tài khoản admin vừa thêm cho đồng nghiệp): mật khẩu
// gõ lần này được LƯU LUÔN làm mật khẩu chính thức (xem lib/auth.ts).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";
import { logActivity } from "@/lib/log";

const schema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu phải từ 6 ký tự"),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "Không tìm thấy tài khoản với email này." }, { status: 401 });
  }

  if (!user.passwordHash) {
    // Lần đăng nhập đầu tiên của tài khoản này -> đặt mật khẩu luôn
    const passwordHash = await hashPassword(password);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await logActivity("auth.first_login_set_password", `Đặt mật khẩu lần đầu cho "${email}"`, user.id);
  } else {
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Sai mật khẩu." }, { status: 401 });
    }
  }

  const session = await getSession();
  session.userId = user.id;
  await session.save();

  await logActivity("auth.login", `Đăng nhập: ${email}`, user.id);
  return NextResponse.json({ ok: true });
}
