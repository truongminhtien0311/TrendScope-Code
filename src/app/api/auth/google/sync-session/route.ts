import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST() {
  const session = await getSession();
  if (session.userId) return NextResponse.json({ ok: true });

  // Tìm user đã có googleId trong DB
  const user = await prisma.user.findFirst({
    where: { googleId: { not: null } },
    orderBy: { id: "asc" }
  });

  if (!user) {
    return NextResponse.json({ ok: false, error: "Chưa đăng nhập Google." }, { status: 401 });
  }

  session.userId = user.id;
  await session.save();

  return NextResponse.json({ ok: true });
}
