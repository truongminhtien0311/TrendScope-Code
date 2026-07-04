// API: PATCH (sửa) / DELETE cho 1 đánh giá
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";

const schema = z.object({
  contentVi: z.string().min(1).optional(),
  rating: z.number().min(1).max(5).nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const review = await prisma.review.update({ where: { id: Number(id) }, data: parsed.data });
  await logActivity("review.update", `Sửa tay đánh giá #${id}`);
  return NextResponse.json(review);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.review.delete({ where: { id: Number(id) } });
  await logActivity("review.delete", `Xóa đánh giá #${id}`);
  return NextResponse.json({ ok: true });
}
