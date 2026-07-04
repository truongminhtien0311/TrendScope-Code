// ============================================================
// API: POST /api/products/[id]/analyze
// Gộp dữ liệu TẤT CẢ link của 1 sản phẩm -> gọi Gemini 1 lần duy nhất
// -> lưu đủ 7 mục AI (mô tả, tệp khách hàng, kênh bán, tùy chỉnh sản
// phẩm, nhập khẩu, vận chuyển, đánh giá khả thi kinh doanh) vào Product.
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";
import {
  generateProductAnalysis,
  DEFAULT_COST_ASSUMPTIONS,
  type AnalysisInput,
  type CostAssumptions,
} from "@/lib/llm";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id: Number(id) },
    include: {
      listings: {
        include: { variants: true, images: true, reviews: true },
      },
    },
  });
  if (!product) {
    return NextResponse.json({ error: "Không tìm thấy sản phẩm" }, { status: 404 });
  }
  if (product.listings.length === 0) {
    return NextResponse.json(
      { error: "Sản phẩm chưa có link nào — thêm ít nhất 1 link trước khi tạo mô tả AI." },
      { status: 400 }
    );
  }

  // LLM đang dùng: Google Gemini — cần bật + có key trong Cài đặt > API
  const provider = await prisma.apiProvider.findFirst({
    where: { kind: "LLM", name: "Google Gemini", enabled: true },
  });
  if (!provider?.apiKey) {
    return NextResponse.json(
      { error: "Chưa bật/chưa có API key cho Google Gemini — vào Cài đặt > API để cấu hình." },
      { status: 400 }
    );
  }

  const input: AnalysisInput = {
    productName: product.name,
    userDescription: product.description ?? undefined,
    listings: product.listings.map((l) => {
      const prices = l.variants.map((v) => v.priceCny);
      return {
        id: l.id,
        sourceType: l.sourceType,
        platform: l.platform,
        titleOriginal: l.titleOriginal ?? undefined,
        titleVi: l.titleVi ?? undefined,
        descriptionOriginal: l.descriptionOriginal ?? undefined,
        descriptionText: l.descriptionVi ?? l.descriptionOriginal ?? undefined,
        imageUrls: l.images.map((img) => img.url),
        reviews: l.reviews.map((r) => r.contentVi ?? r.contentOriginal),
        priceRangeCny: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : undefined,
        variants: l.variants.map((v) => ({ id: v.id, nameOriginal: v.nameOriginal, nameVi: v.nameVi ?? undefined })),
      };
    }),
  };

  // Prompt: dùng bản người dùng tự sửa trong Cài đặt nếu có, không thì
  // dùng mặc định (generateProductAnalysis tự fallback khi bỏ trống)
  const [promptSetting, costSetting, allCategories] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "ai_prompt_template" } }),
    prisma.setting.findUnique({ where: { key: "business_cost_assumptions" } }),
    prisma.category.findMany({ select: { id: true, name: true } }),
  ]);

  let costAssumptions: CostAssumptions = DEFAULT_COST_ASSUMPTIONS;
  if (costSetting?.value) {
    try {
      const parsed = JSON.parse(costSetting.value);
      if (Array.isArray(parsed)) costAssumptions = parsed;
    } catch {
      // JSON hỏng thì dùng mặc định, không chặn cả request
    }
  }

  let result;
  try {
    result = await generateProductAnalysis(
      input,
      provider.apiKey,
      promptSetting?.value || undefined,
      costAssumptions,
      allCategories.map((c) => c.name)
    );
  } catch (err) {
    await logActivity("product.ai_analyze_failed", `Gemini lỗi cho sản phẩm #${product.id}: ${String(err)}`);
    return NextResponse.json({ error: "Tạo mô tả AI thất bại: " + String(err) }, { status: 502 });
  }

  // Bản dịch (việc 2, độc lập với 7 mục phân tích) — CHỈ điền vào chỗ
  // còn trống, không ghi đè tên/bản dịch người dùng đã tự sửa tay.
  const listingUpdates = product.listings
    .map((l) => {
      const t = result.translations.listings.find((r) => r.id === l.id);
      if (!t) return null;
      const data: { titleVi?: string; descriptionVi?: string } = {};
      if (!l.titleVi && t.titleVi) data.titleVi = t.titleVi;
      if (!l.descriptionVi && t.descriptionVi) data.descriptionVi = t.descriptionVi;
      return Object.keys(data).length ? prisma.listing.update({ where: { id: l.id }, data }) : null;
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const variantUpdates = product.listings
    .flatMap((l) => l.variants)
    .map((v) => {
      const t = result.translations.variants.find((r) => r.id === v.id);
      if (!t?.nameVi || v.nameVi) return null;
      return prisma.variant.update({ where: { id: v.id }, data: { nameVi: t.nameVi } });
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  // Gợi ý ngành hàng (việc 3) — CHỈ THÊM vào, không thay thế/xóa các
  // ngành hàng người dùng đã tự gắn tay trước đó.
  const suggestedCategory = allCategories.find((c) => c.name === result.categorySuggestion);

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: {
      aiSummary: result.summary,
      aiAudience: result.audience,
      aiChannels: result.channels,
      aiCustomization: result.customization,
      aiImportInfo: result.importInfo,
      aiShipping: result.shipping,
      aiFeasibility: result.feasibility,
      // Tên sản phẩm còn trống -> lấy tên AI dịch làm mặc định hiển thị
      // ở dashboard; nếu người dùng đã tự đặt tên thì giữ nguyên, không
      // ghi đè (vẫn tự sửa lại bất cứ lúc nào qua "✏️ Sửa").
      ...(product.name.trim() ? {} : { name: result.translations.productName }),
      ...(suggestedCategory ? { categories: { connect: [{ id: suggestedCategory.id }] } } : {}),
    },
  });
  await Promise.all([...listingUpdates, ...variantUpdates]);

  await logActivity(
    "product.ai_analyze",
    `Tạo đủ 7 mục phân tích AI + bản dịch tên/mô tả/SKU cho sản phẩm #${product.id} bằng Gemini`
  );
  return NextResponse.json({
    aiSummary: updated.aiSummary,
    aiAudience: updated.aiAudience,
    aiChannels: updated.aiChannels,
    aiCustomization: updated.aiCustomization,
    aiImportInfo: updated.aiImportInfo,
    aiShipping: updated.aiShipping,
    aiFeasibility: updated.aiFeasibility,
  });
}
