// API: POST /api/listings/[id]/variants — thêm 1 phân loại mới nhập tay
// vào listing đã có. priceEdited = true ngay (giá do người dùng gõ).
// Giá nhập được bằng CNY/USD/VNĐ (priceUnit), tự quy đổi về CNY để lưu.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";
import { getCnyVndRate, getUsdCnyRate, toPriceCny } from "@/lib/currency";

const schema = z.object({
  nameOriginal: z.string().min(1),
  nameVi: z.string().optional(),
  price: z.number().positive("Giá phải lớn hơn 0"),
  priceUnit: z.enum(["CNY", "USD", "VND"]).default("CNY"),
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

  const [cnyVndRate, usdCnyRate] = await Promise.all([getCnyVndRate(), getUsdCnyRate()]);
  const priceCny = toPriceCny(parsed.data.price, parsed.data.priceUnit, { cnyVndRate, usdCnyRate });

  const variant = await prisma.variant.create({
    data: {
      listingId: Number(id),
      nameOriginal: parsed.data.nameOriginal,
      nameVi: parsed.data.nameVi,
      priceCny,
      priceEdited: true,
    },
  });

  await logActivity(
    "variant.create",
    `Thêm tay phân loại "${variant.nameVi ?? variant.nameOriginal}" cho link #${id}`
  );
  return NextResponse.json(variant, { status: 201 });
}
