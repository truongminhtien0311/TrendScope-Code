// ============================================================
// API: POST /api/compare
// So sánh 2-5 sản phẩm bằng AI — CHỈ dùng dữ liệu cào GỐC (title/mô tả/
// đánh giá bản Original, KHÔNG dùng bản đã AI dịch/tổng hợp trước đó) để
// tránh thiên kiến AI cộng dồn qua nhiều lần tạo (xem lib/llm/index.ts).
// Cùng cơ chế PENDING -> chạy nền -> poll như /api/products/[id]/analyze:
// trả response NGAY, xử lý Gemini chạy nền (an toàn CHỈ VÌ app này chạy
// Node process thường trực, KHÔNG PHẢI serverless).
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";
import {
  generateProductComparison,
  DEFAULT_COMPARE_PRESETS,
  DEFAULT_CATEGORY_MARKUP_RATIOS,
  type PromptPreset,
  type CompareProductInput,
  type CategoryMarkupRatio,
} from "@/lib/llm";

const MIN_PRODUCTS = 2;
const MAX_PRODUCTS = 5;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const productIds: number[] = Array.isArray(body?.productIds) ? body.productIds.map(Number) : [];
  const presetId: string | undefined = body?.presetId;
  const comparePurpose: string = typeof body?.comparePurpose === "string" ? body.comparePurpose : "";
  // Phiên đánh giá chứa lượt so sánh này (nếu có) — xem EvaluationSession,
  // prisma/schema.prisma. Không bắt buộc để không phá các lượt so sánh cũ
  // (trước khi có khái niệm "phiên") vẫn gọi được route này bình thường.
  const sessionId: number | undefined = body?.sessionId ? Number(body.sessionId) : undefined;

  if (productIds.length < MIN_PRODUCTS || productIds.length > MAX_PRODUCTS) {
    return NextResponse.json(
      { error: `Chọn từ ${MIN_PRODUCTS} đến ${MAX_PRODUCTS} sản phẩm để so sánh.` },
      { status: 400 }
    );
  }

  const provider = await prisma.apiProvider.findFirst({
    where: { kind: "LLM", name: "Google Gemini", enabled: true },
  });
  if (!provider?.apiKey) {
    return NextResponse.json(
      { error: "Chưa bật/chưa có API key cho Google Gemini — vào Cài đặt > API để cấu hình." },
      { status: 400 }
    );
  }

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: {
      listings: { include: { variants: true, images: true, reviews: true } },
      categories: { select: { name: true } },
    },
  });
  if (products.length !== productIds.length) {
    return NextResponse.json({ error: "Một số sản phẩm không tồn tại." }, { status: 404 });
  }

  const [presetsSetting, markupSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "compare_prompt_presets" } }),
    prisma.setting.findUnique({ where: { key: "category_markup_ratios" } }),
  ]);
  let presets: PromptPreset[] = DEFAULT_COMPARE_PRESETS;
  if (presetsSetting?.value) {
    try {
      const parsed = JSON.parse(presetsSetting.value);
      if (Array.isArray(parsed) && parsed.length > 0) presets = parsed;
    } catch {
      // JSON hỏng thì dùng bộ preset mặc định
    }
  }
  const preset = presets.find((p) => p.id === presetId) ?? presets[0];

  let markupRatios: CategoryMarkupRatio[] = DEFAULT_CATEGORY_MARKUP_RATIOS;
  if (markupSetting?.value) {
    try {
      const parsed = JSON.parse(markupSetting.value);
      if (Array.isArray(parsed)) markupRatios = parsed;
    } catch {
      // JSON hỏng thì dùng mặc định, không chặn cả request
    }
  }

  const inputs: CompareProductInput[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    categoryNames: p.categories.map((c) => c.name),
    listings: p.listings.map((l) => {
      const prices = l.variants.map((v) => v.priceCny);
      return {
        sourceType: l.sourceType,
        platform: l.platform,
        titleOriginal: l.titleOriginal ?? undefined,
        descriptionOriginal: l.descriptionOriginal ?? undefined,
        priceRangeCny: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : undefined,
        imageUrls: l.images.map((img) => img.url),
        reviewsOriginal: l.reviews.map((r) => r.contentOriginal),
      };
    }),
  }));

  const comparison = await prisma.productComparison.create({
    data: {
      productIds: JSON.stringify(productIds),
      status: "PENDING",
      presetName: preset.name,
      ...(sessionId ? { session: { connect: { id: sessionId } } } : {}),
    },
  });

  void runComparisonInBackground(comparison.id, inputs, provider.apiKey, preset, comparePurpose, markupRatios);

  return NextResponse.json({ comparisonId: comparison.id }, { status: 202 });
}

async function runComparisonInBackground(
  comparisonId: number,
  inputs: CompareProductInput[],
  apiKey: string,
  preset: PromptPreset,
  comparePurpose: string,
  markupRatios: CategoryMarkupRatio[]
) {
  // BẮT BUỘC bọc try/catch TOÀN BỘ thân hàm — promise "bắn rồi quên",
  // xem giải thích trong src/app/api/products/[id]/analyze/route.ts.
  try {
    let resultMarkdown: string;
    try {
      resultMarkdown = await generateProductComparison(inputs, apiKey, preset.content, comparePurpose, markupRatios);
    } catch (err) {
      await prisma.productComparison.update({
        where: { id: comparisonId },
        data: { status: "FAILED", finishedAt: new Date(), errorMessage: String(err) },
      });
      await logActivity("product.compare_failed", `Gemini lỗi khi so sánh (#${comparisonId}): ${String(err)}`);
      return;
    }

    await prisma.productComparison.update({
      where: { id: comparisonId },
      data: { status: "DONE", finishedAt: new Date(), resultMarkdown },
    });

    await logActivity(
      "product.compare",
      `So sánh AI (#${comparisonId}) cho ${inputs.length} sản phẩm bằng Gemini (preset "${preset.name}")`
    );
  } catch (err) {
    console.error(`Lỗi không lường trước khi xử lý so sánh #${comparisonId}:`, err);
    await prisma.productComparison
      .update({
        where: { id: comparisonId },
        data: { status: "FAILED", finishedAt: new Date(), errorMessage: String(err) },
      })
      .catch(() => {});
  }
}
