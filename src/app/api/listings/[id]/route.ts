// API: PATCH (sửa tay các trường) / DELETE cho 1 link nguồn.
// PATCH — sửa tay mọi trường của Listing (tên/mô tả/người bán/lượt bán/
// URL): dùng khi API cào lỗi hoặc dữ liệu cào về sai (mindmap: mọi
// trường phải nhập/sửa tay được).
// DELETE — xóa listing, phân loại/ảnh/đánh giá tự xóa theo (Cascade).
// Nếu link này đang cấp ảnh đại diện cho sản phẩm thì trả về luật
// mặc định (mainImageListingId = null — xem src/lib/product-image.ts).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";

const patchSchema = z.object({
  titleOriginal: z.string().nullable().optional(),
  titleVi: z.string().nullable().optional(),
  sellerName: z.string().nullable().optional(),
  descriptionOriginal: z.string().nullable().optional(),
  descriptionVi: z.string().nullable().optional(),
  soldTotal: z.number().nullable().optional(),
  soldMonthly: z.number().nullable().optional(),
  url: z.string().min(1).optional(),
  sourceType: z.enum(["RETAIL", "MANUFACTURER"]).optional(),
  platform: z.string().min(1).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const listing = await prisma.listing.update({
    where: { id: Number(id) },
    data: parsed.data,
  });

  await logActivity("listing.update", `Sửa tay link #${listing.id} (${listing.platform})`);
  return NextResponse.json(listing);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id: Number(id) },
    include: { product: { select: { id: true, mainImageListingId: true } } },
  });
  if (!listing) {
    return NextResponse.json({ error: "Không tìm thấy link" }, { status: 404 });
  }

  await prisma.listing.delete({ where: { id: listing.id } });

  if (listing.product.mainImageListingId === listing.id) {
    await prisma.product.update({
      where: { id: listing.product.id },
      data: { mainImageListingId: null },
    });
  }

  await logActivity(
    "listing.delete",
    `Xóa link ${listing.platform} của sản phẩm #${listing.product.id}: ${listing.url}`
  );
  return NextResponse.json({ ok: true });
}
