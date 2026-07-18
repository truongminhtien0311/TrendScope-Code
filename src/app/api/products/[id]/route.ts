// API: GET / PATCH / DELETE cho 1 sản phẩm cụ thể
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id: Number(id) },
    include: {
      categories: true,
      tags: true,
      listings: { include: { variants: true, images: { orderBy: { sortOrder: "asc" } }, reviews: true } },
    },
  });
  if (!product) {
    return NextResponse.json({ error: "Không tìm thấy sản phẩm" }, { status: 404 });
  }
  return NextResponse.json(product);
}

const updateSchema = z.object({
  name: z.string().optional(), // rỗng = chưa đặt tên, chờ AI hoặc tự gõ sau
  description: z.string().nullable().optional(),
  categoryIds: z.array(z.number()).optional(), // thay toàn bộ ngành hàng của sản phẩm
  tagIds: z.array(z.number()).optional(), // thay toàn bộ tag của sản phẩm
  // Sửa nội dung AI: xem PATCH /api/products/[id]/ai-analyses/[analysisId]
  // (mỗi lần "Tạo bằng AI" giờ tạo 1 bản riêng, không còn 7 cột chung
  // trên Product để sửa thẳng ở đây nữa).
  // Chọn tay link cấp ảnh đại diện; null = quay về luật mặc định
  // (ưu tiên shop bán lẻ thêm sớm nhất — xem src/lib/product-image.ts)
  mainImageListingId: z.number().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { tagIds, categoryIds, ...data } = parsed.data;
  const product = await prisma.product.update({
    where: { id: Number(id) },
    data: {
      ...data,
      ...(tagIds ? { tags: { set: tagIds.map((tid) => ({ id: tid })) } } : {}),
      ...(categoryIds ? { categories: { set: categoryIds.map((cid) => ({ id: cid })) } } : {}),
    },
  });
  await logActivity("product.update", `Sửa sản phẩm "${product.name}" (#${product.id})`);
  return NextResponse.json(product);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { forbidden } = await requireAdmin();
  if (forbidden) return forbidden;

  const { id } = await params;
  const product = await prisma.product.delete({ where: { id: Number(id) } });
  await logActivity("product.delete", `Xóa sản phẩm "${product.name}" (#${product.id})`);
  return NextResponse.json({ ok: true });
}
