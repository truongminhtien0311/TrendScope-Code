// API: quản lý Tag — GET (danh sách) · POST (thêm) · DELETE (xóa, id trong body)
// Mindmap: "Tag (Có thể tùy chỉnh, thêm/xóa)"
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";

export async function GET() {
  return NextResponse.json(await prisma.tag.findMany({ orderBy: { name: "asc" } }));
}

const createSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const tag = await prisma.tag.create({ data: parsed.data });
  await logActivity("tag.create", `Thêm tag "${tag.name}"`);
  return NextResponse.json(tag, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = z.object({ id: z.number() }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  }
  const tag = await prisma.tag.delete({ where: { id: parsed.data.id } });
  await logActivity("tag.delete", `Xóa tag "${tag.name}"`);
  return NextResponse.json({ ok: true });
}
