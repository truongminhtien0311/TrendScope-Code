// API: GET /api/products (danh sách) · POST /api/products (tạo mới)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";

export async function GET() {
  const products = await prisma.product.findMany({
    include: { categories: true, tags: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(products);
}

// Tên KHÔNG bắt buộc lúc tạo — người dùng bấm "+ Thêm sản phẩm" là có
// ngay 1 sản phẩm rỗng để dán link vào, tên tự điền sau khi chạy AI
// (hoặc tự gõ tay bất cứ lúc nào qua "✏️ Sửa").
const createSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  categoryIds: z.array(z.number()).optional(), // 1 sản phẩm gắn được nhiều ngành hàng
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { categoryIds, ...rest } = parsed.data;
  const product = await prisma.product.create({
    data: {
      ...rest,
      name: parsed.data.name?.trim() || "",
      ...(categoryIds ? { categories: { connect: categoryIds.map((id) => ({ id })) } } : {}),
    },
  });
  await logActivity(
    "product.create",
    product.name ? `Tạo sản phẩm "${product.name}" (#${product.id})` : `Tạo sản phẩm chưa đặt tên (#${product.id})`
  );
  return NextResponse.json(product, { status: 201 });
}
