// ============================================================
// API: POST /api/products/[id]/analyze
// Gộp dữ liệu TẤT CẢ link của 1 sản phẩm -> gọi Gemini 1 lần duy nhất
// -> lưu đủ 7 mục AI (mô tả, tệp khách hàng, kênh bán, tùy chỉnh sản
// phẩm, nhập khẩu, vận chuyển, đánh giá khả thi kinh doanh).
//
// MỖI LẦN BẤM TẠO MỘT DÒNG ProductAiAnalysis MỚI (không ghi đè dòng cũ)
// để giữ lịch sử so sánh được, tối đa 10 dòng/sản phẩm (xem evictOldAnalyses).
//
// TRẢ RESPONSE NGAY (không đợi Gemini) — chỉ tạo dòng "PENDING" rồi trả
// về {analysisId}, việc gọi Gemini (có thể mất vài chục giây) chạy NỀN
// trong runAnalysisInBackground() (KHÔNG await). An toàn CHỈ VÌ app này
// chạy như 1 Node process thường trực (next start / node scripts/dev.js),
// KHÔNG PHẢI serverless — sau khi trả response, Node vẫn tiếp tục xử lý
// promise đang chờ trong cùng process cho tới khi resolve. Trên serverless
// (Vercel functions) code này sẽ bị kill ngay khi response trả về.
// Client poll GET /api/products/[id]/ai-analyses/[analysisId] để biết khi
// nào xong (xem route đó), đồng hồ đếm giờ tính từ startedAt thật trong
// DB nên sống sót qua việc bấm rời trang/F5 lại trang.
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";
import {
  generateProductAnalysis,
  DEFAULT_COST_ASSUMPTIONS,
  DEFAULT_PROMPT_PRESETS,
  DEFAULT_CATEGORY_MARKUP_RATIOS,
  type AnalysisInput,
  type CostAssumptions,
  type PromptPreset,
  type AiAnalysisResult,
  type CategoryMarkupRatio,
} from "@/lib/llm";

// Giới hạn số bản lưu tối đa cho mỗi sản phẩm — bản cũ nhất tự bị dọn khi
// vượt quá, KHÔNG BAO GIỜ xóa bản đang "PENDING" (đang chạy dở).
const MAX_ANALYSES_PER_PRODUCT = 10;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // presetId: người dùng chọn ngay tại dropdown cạnh nút "Tạo bằng AI"
  // (không bắt buộc đổi preset "đang dùng" trong Cài đặt trước) — không
  // truyền gì thì rơi về preset active như hành vi cũ.
  const body = await request.json().catch(() => ({}));
  const requestedPresetId: string | undefined = body?.presetId;
  const product = await prisma.product.findUnique({
    where: { id: Number(id) },
    include: {
      listings: {
        include: { variants: true, images: true, reviews: true },
      },
      categories: { select: { name: true } },
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
    categoryNames: product.categories.map((c) => c.name),
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

  // Prompt: dùng đúng preset "đang dùng" người dùng chọn trong Cài đặt
  // (Cài đặt > Prompt AI cho phép lưu nhiều preset đặt tên riêng, xem
  // src/lib/llm/index.ts). Không có preset nào thì rơi về DEFAULT_PROMPT_PRESETS.
  const [presetsSetting, activePresetIdSetting, costSetting, markupSetting, allCategories] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "ai_prompt_presets" } }),
    prisma.setting.findUnique({ where: { key: "ai_prompt_active_preset_id" } }),
    prisma.setting.findUnique({ where: { key: "business_cost_assumptions" } }),
    prisma.setting.findUnique({ where: { key: "category_markup_ratios" } }),
    prisma.category.findMany({ select: { id: true, name: true } }),
  ]);

  let presets: PromptPreset[] = DEFAULT_PROMPT_PRESETS;
  if (presetsSetting?.value) {
    try {
      const parsed = JSON.parse(presetsSetting.value);
      if (Array.isArray(parsed) && parsed.length > 0) presets = parsed;
    } catch {
      // JSON hỏng thì dùng bộ preset mặc định, không chặn cả request
    }
  }
  const activePreset =
    (requestedPresetId ? presets.find((p) => p.id === requestedPresetId) : undefined) ??
    presets.find((p) => p.id === activePresetIdSetting?.value) ??
    presets[0];

  let costAssumptions: CostAssumptions = DEFAULT_COST_ASSUMPTIONS;
  if (costSetting?.value) {
    try {
      const parsed = JSON.parse(costSetting.value);
      if (Array.isArray(parsed)) costAssumptions = parsed;
    } catch {
      // JSON hỏng thì dùng mặc định, không chặn cả request
    }
  }

  let markupRatios: CategoryMarkupRatio[] = DEFAULT_CATEGORY_MARKUP_RATIOS;
  if (markupSetting?.value) {
    try {
      const parsed = JSON.parse(markupSetting.value);
      if (Array.isArray(parsed)) markupRatios = parsed;
    } catch {
      // JSON hỏng thì dùng mặc định, không chặn cả request
    }
  }

  const analysis = await prisma.productAiAnalysis.create({
    data: { productId: product.id, status: "PENDING", presetName: activePreset.name },
  });

  void runAnalysisInBackground(
    analysis.id,
    product,
    input,
    provider.apiKey,
    activePreset,
    costAssumptions,
    allCategories,
    markupRatios
  );

  return NextResponse.json({ analysisId: analysis.id }, { status: 202 });
}

async function runAnalysisInBackground(
  analysisId: number,
  product: {
    id: number;
    name: string;
    listings: { id: number; titleVi: string | null; descriptionVi: string | null }[];
  },
  input: AnalysisInput,
  apiKey: string,
  activePreset: PromptPreset,
  costAssumptions: CostAssumptions,
  allCategories: { id: number; name: string }[],
  markupRatios: CategoryMarkupRatio[]
) {
  // BẮT BUỘC bọc try/catch TOÀN BỘ thân hàm — đây là promise "bắn rồi
  // quên" (không await ở route handler), nếu throw lỗi không bắt sẽ
  // thành "unhandled rejection" và Node có thể SẬP CẢ SERVER chỉ vì 1
  // lần Gemini lỗi. Tuyệt đối không được để lọt lỗi ra ngoài try/catch này.
  try {
    let result: AiAnalysisResult;
    try {
      result = await generateProductAnalysis(
        input,
        apiKey,
        activePreset.content,
        costAssumptions,
        allCategories.map((c) => c.name),
        markupRatios
      );
    } catch (err) {
      await prisma.productAiAnalysis.update({
        where: { id: analysisId },
        data: { status: "FAILED", finishedAt: new Date(), errorMessage: String(err) },
      });
      await logActivity(
        "product.ai_analyze_failed",
        `Gemini lỗi cho sản phẩm #${product.id} (phiên bản #${analysisId}): ${String(err)}`
      );
      return;
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

    const variantUpdates = input.listings
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

    const freshProduct = await prisma.product.findUnique({ where: { id: product.id }, select: { name: true } });

    await prisma.product.update({
      where: { id: product.id },
      data: {
        // Tên sản phẩm còn trống -> lấy tên AI dịch làm mặc định hiển thị
        // ở dashboard; nếu người dùng đã tự đặt tên thì giữ nguyên.
        ...(freshProduct?.name.trim() ? {} : { name: result.translations.productName }),
        ...(suggestedCategory ? { categories: { connect: [{ id: suggestedCategory.id }] } } : {}),
      },
    });
    await Promise.all([...listingUpdates, ...variantUpdates]);

    await prisma.productAiAnalysis.update({
      where: { id: analysisId },
      data: {
        status: "DONE",
        finishedAt: new Date(),
        aiSummary: result.summary,
        aiAudience: result.audience,
        aiChannels: result.channels,
        aiCustomization: result.customization,
        aiImportInfo: result.importInfo,
        aiShipping: result.shipping,
        aiFeasibility: result.feasibility,
      },
    });

    await evictOldAnalyses(product.id);

    await logActivity(
      "product.ai_analyze",
      `Tạo phân tích AI mới (#${analysisId}) + bản dịch tên/mô tả/SKU cho sản phẩm #${product.id} bằng Gemini (preset "${activePreset.name}")`
    );
  } catch (err) {
    console.error(`Lỗi không lường trước khi xử lý phân tích AI #${analysisId}:`, err);
    await prisma.productAiAnalysis
      .update({
        where: { id: analysisId },
        data: { status: "FAILED", finishedAt: new Date(), errorMessage: String(err) },
      })
      .catch(() => {});
  }
}

// Giữ tối đa MAX_ANALYSES_PER_PRODUCT bản/sản phẩm — chạy SAU KHI 1 bản
// vừa chuyển DONE, xóa (các) bản CŨ NHẤT vượt quá, KHÔNG BAO GIỜ đụng
// tới bản đang "PENDING" (dù có bị treo do server khởi động lại giữa
// chừng — nó chỉ không được TÍNH vào giới hạn 10, không bị xóa).
async function evictOldAnalyses(productId: number) {
  const all = await prisma.productAiAnalysis.findMany({
    where: { productId },
    orderBy: { startedAt: "asc" },
    select: { id: true, status: true },
  });
  if (all.length <= MAX_ANALYSES_PER_PRODUCT) return;

  const evictable = all.filter((a) => a.status !== "PENDING");
  const toDeleteCount = all.length - MAX_ANALYSES_PER_PRODUCT;
  const toDelete = evictable.slice(0, toDeleteCount);
  if (toDelete.length === 0) return;

  await prisma.productAiAnalysis.deleteMany({
    where: { id: { in: toDelete.map((a) => a.id) } },
  });
}
