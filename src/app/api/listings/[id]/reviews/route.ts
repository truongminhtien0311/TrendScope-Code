// API: POST /api/listings/[id]/reviews — thêm 1 đánh giá nhập tay
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";

const schema = z.object({
  contentVi: z.string().min(1),
  rating: z.number().min(1).max(5).nullable().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const review = await prisma.review.create({
    data: {
      listingId: Number(id),
      contentOriginal: parsed.data.contentVi, // nhập tay -> chỉ có bản tiếng Việt, dùng luôn làm "gốc"
      contentVi: parsed.data.contentVi,
      rating: parsed.data.rating,
    },
  });

  await logActivity("review.create", `Thêm tay đánh giá cho link #${id}`);
  return NextResponse.json(review, { status: 201 });
}
