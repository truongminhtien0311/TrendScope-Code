// ============================================================
// API: POST /api/listings — tạo Listing THỦ CÔNG (không qua scraper).
// Dùng khi API cào dữ liệu bị lỗi/hết quota, hoặc người dùng muốn
// nhập tay cho nhanh hơn tự cào bằng mắt. Không gọi scraper — nhận
// thẳng dữ liệu người dùng gõ, lưu y hệt cấu trúc /api/scrape tạo ra
// để phần còn lại của app (hiển thị, phân tích AI...) dùng chung được.
//
// sourceType/platform do người dùng CHỌN TƯỜNG MINH (không suy ra từ
// 1 danh sách sàn cố định) — nhập tay có thể từ bất kỳ nguồn nào,
// không chỉ 5 sàn app hỗ trợ cào tự động.
// Giá mỗi phân loại có thể nhập bằng CNY/USD/VNĐ (priceUnit), tự quy
// đổi về CNY để lưu (schema chỉ có priceCny, không đổi cấu trúc DB).
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";
import { getCnyVndRate, getUsdCnyRate, toPriceCny } from "@/lib/currency";

const schema = z.object({
  productId: z.number(),
  sourceType: z.enum(["RETAIL", "MANUFACTURER"]),
  platform: z.string().min(1, "Cần nhập tên sàn/nguồn"),
  url: z.string().min(1, "Cần nhập URL hoặc ghi chú nguồn (không bắt buộc đúng định dạng link)"),
  titleOriginal: z.string().optional(),
  titleVi: z.string().optional(),
  sellerName: z.string().optional(),
  descriptionOriginal: z.string().optional(),
  descriptionVi: z.string().optional(),
  soldTotal: z.number().optional(),
  soldMonthly: z.number().optional(),
  variants: z
    .array(
      z.object({
        nameOriginal: z.string().min(1),
        nameVi: z.string().optional(),
        price: z.number().positive("Giá phải lớn hơn 0"),
        priceUnit: z.enum(["CNY", "USD", "VND"]).default("CNY"),
      })
    )
    .min(1, "Cần ít nhất 1 phân loại + giá"),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { productId, variants, ...rest } = parsed.data;

  const [cnyVndRate, usdCnyRate] = await Promise.all([getCnyVndRate(), getUsdCnyRate()]);

  const listing = await prisma.listing.create({
    data: {
      productId,
      ...rest,
      // lastScrapedAt để trống — đánh dấu đây là link nhập tay, chưa từng cào
      variants: {
        create: variants.map((v) => ({
          nameOriginal: v.nameOriginal,
          nameVi: v.nameVi,
          priceCny: toPriceCny(v.price, v.priceUnit, { cnyVndRate, usdCnyRate }),
          // Nhập tay -> priceEdited = true ngay để "Cào lại" sau này (nếu có)
          // không vô tình ghi đè mất giá người dùng đã gõ.
          priceEdited: true,
        })),
      },
    },
  });

  await logActivity(
    "listing.manual_create",
    `Nhập tay link ${rest.platform} cho sản phẩm #${productId}${rest.titleVi ? `: ${rest.titleVi}` : ""}`
  );
  return NextResponse.json(listing, { status: 201 });
}
