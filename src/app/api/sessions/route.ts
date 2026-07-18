// API: POST /api/sessions (tạo phiên đánh giá mới) · GET /api/sessions (liệt kê lịch sử)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";

const MIN_PRODUCTS = 2;
const MAX_PRODUCTS = 5;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const productIds: number[] = Array.isArray(body?.productIds) ? body.productIds.map(Number) : [];
  const name: string | undefined = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : undefined;

  if (productIds.length < MIN_PRODUCTS || productIds.length > MAX_PRODUCTS) {
    return NextResponse.json(
      { error: `Chọn từ ${MIN_PRODUCTS} đến ${MAX_PRODUCTS} sản phẩm để tạo phiên đánh giá.` },
      { status: 400 }
    );
  }

  const products = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true } });
  if (products.length !== productIds.length) {
    return NextResponse.json({ error: "Một số sản phẩm không tồn tại." }, { status: 404 });
  }

  const session = await prisma.evaluationSession.create({
    data: { name, productIds: JSON.stringify(productIds) },
  });

  await logActivity("session.create", `Tạo phiên đánh giá #${session.id} cho ${productIds.length} sản phẩm`);

  return NextResponse.json({ sessionId: session.id }, { status: 201 });
}

export async function GET() {
  const sessions = await prisma.evaluationSession.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const allProductIds = [...new Set(sessions.flatMap((s) => JSON.parse(s.productIds) as number[]))];
  const products = await prisma.product.findMany({
    where: { id: { in: allProductIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(products.map((p) => [p.id, p.name]));

  const result = sessions.map((s) => {
    const ids: number[] = JSON.parse(s.productIds);
    return {
      id: s.id,
      name: s.name,
      createdAt: s.createdAt,
      productNames: ids.map((id) => nameById.get(id) ?? `#${id}`),
    };
  });

  return NextResponse.json(result);
}
