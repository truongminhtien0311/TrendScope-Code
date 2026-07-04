// API: quản lý Ngành hàng — GET · POST · DELETE (id trong body)
// Mindmap: "Ngành hàng (Cho phép tùy chỉnh, thêm/xóa)"
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";

export async function GET() {
  return NextResponse.json(await prisma.category.findMany({ orderBy: { name: "asc" } }));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = z.object({ name: z.string().min(1) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const category = await prisma.category.create({ data: parsed.data });
  await logActivity("category.create", `Thêm ngành hàng "${category.name}"`);
  return NextResponse.json(category, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = z.object({ id: z.number() }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  }
  const category = await prisma.category.delete({ where: { id: parsed.data.id } });
  await logActivity("category.delete", `Xóa ngành hàng "${category.name}"`);
  return NextResponse.json({ ok: true });
}
