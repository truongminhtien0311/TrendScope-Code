// API: POST /api/auth/setup — tạo tài khoản Chủ tài khoản ĐẦU TIÊN khi
// database còn trống (máy mới cài app, xem src/app/setup/page.tsx).
// Kiểm tra lại count() ngay trong route (không chỉ tin trang đã chặn)
// vì đây là API — ai cũng gọi thẳng được nếu biết URL, phải tự chống.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, getSession } from "@/lib/auth";
import { logActivity } from "@/lib/log";

const schema = z.object({
  name: z.string().min(1, "Cần nhập tên"),
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu phải từ 6 ký tự"),
});

export async function POST(request: NextRequest) {
  const existingCount = await prisma.user.count();
  if (existingCount > 0) {
    return NextResponse.json(
      { error: "Đã có tài khoản trên máy này — vào /login để đăng nhập." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: "admin",
      isOwner: true,
    },
  });

  const session = await getSession();
  session.userId = user.id;
  await session.save();

  await logActivity("auth.setup", `Thiết lập lần đầu — tạo Chủ tài khoản "${user.email}"`, user.id);
  return NextResponse.json({ ok: true });
}
