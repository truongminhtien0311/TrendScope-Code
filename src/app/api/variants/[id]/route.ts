// API: PATCH /api/variants/[id] — sửa tay tên/giá 1 phân loại.
// Mindmap: "Người dùng có thể chỉnh sửa được giá vì giá quét về có thể sai".
// Khi sửa giá, priceEdited = true để lần cào lại không ghi đè mất giá đã sửa.
// Giá sửa được bằng CNY/USD/VNĐ (priceUnit), tự quy đổi về CNY để lưu.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";
import { getCnyVndRate, getUsdCnyRate, toPriceCny } from "@/lib/currency";

const schema = z.object({
  nameVi: z.string().nullable().optional(),
  nameOriginal: z.string().min(1).optional(),
  price: z.number().positive("Giá phải lớn hơn 0").optional(),
  priceUnit: z.enum(["CNY", "USD", "VND"]).default("CNY"),
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
  const { price, priceUnit, ...rest } = parsed.data;

  let priceCny: number | undefined;
  if (price !== undefined) {
    const [cnyVndRate, usdCnyRate] = await Promise.all([getCnyVndRate(), getUsdCnyRate()]);
    priceCny = toPriceCny(price, priceUnit, { cnyVndRate, usdCnyRate });
  }

  const variant = await prisma.variant.update({
    where: { id: Number(id) },
    data: {
      ...rest,
      ...(priceCny !== undefined ? { priceCny, priceEdited: true } : {}),
    },
  });

  await logActivity(
    "variant.update",
    `Sửa tay phân loại #${variant.id} ("${variant.nameVi ?? variant.nameOriginal}"${
      priceCny !== undefined ? `, giá mới ¥${priceCny.toFixed(2)}` : ""
    })`
  );
  return NextResponse.json(variant);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const variant = await prisma.variant.delete({ where: { id: Number(id) } });
  await logActivity(
    "variant.delete",
    `Xóa phân loại "${variant.nameVi ?? variant.nameOriginal}" (#${variant.id})`
  );
  return NextResponse.json({ ok: true });
}
