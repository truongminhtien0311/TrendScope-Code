// API: GET /api/auth/users (danh sách) · POST /api/auth/users (thêm
// đồng nghiệp mới) — CHỈ admin được dùng. Tài khoản mới KHÔNG cần đặt
// mật khẩu ngay — người đó tự đặt mật khẩu ở lần đăng nhập đầu tiên
// (xem /api/auth/login).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/log";

export async function GET() {
  const current = await getCurrentUser();
  if (!current || current.role !== "admin") {
    return NextResponse.json({ error: "Chỉ admin được xem danh sách tài khoản" }, { status: 403 });
  }
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, isOwner: true, passwordHash: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(
    users.map((u) => ({ ...u, passwordHash: undefined, hasPassword: !!u.passwordHash }))
  );
}

const createSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  name: z.string().min(1, "Cần nhập tên"),
  role: z.enum(["admin", "member"]).default("member"),
});

export async function POST(request: NextRequest) {
  const current = await getCurrentUser();
  if (!current || current.role !== "admin") {
    return NextResponse.json({ error: "Chỉ admin được thêm tài khoản" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ error: "Email này đã có tài khoản." }, { status: 400 });
  }

  const user = await prisma.user.create({ data: parsed.data });
  await logActivity("auth.user_create", `Thêm tài khoản "${user.email}" (${user.role})`, current.id);
  return NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role }, { status: 201 });
}
