// API: DELETE /api/auth/users/[id] — CHỈ admin, không tự xóa chính mình
// (tránh tự khóa mình ra khỏi app).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/log";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const current = await getCurrentUser();
  if (!current || current.role !== "admin") {
    return NextResponse.json({ error: "Chỉ admin được xóa tài khoản" }, { status: 403 });
  }

  const { id } = await params;
  if (Number(id) === current.id) {
    return NextResponse.json({ error: "Không thể tự xóa chính tài khoản đang đăng nhập." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: Number(id) } });
  if (target?.role === "admin" && !current.isOwner) {
    return NextResponse.json(
      { error: "Chỉ Chủ tài khoản mới xóa được tài khoản admin khác." },
      { status: 403 }
    );
  }

  try {
    const user = await prisma.user.delete({ where: { id: Number(id) } });
    await logActivity("auth.user_delete", `Xóa tài khoản "${user.email}"`, current.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Không xóa được (tài khoản này có thể đang gắn với log hoạt động cũ): " + String(err) },
      { status: 400 }
    );
  }
}
