// ============================================================
// API: POST /api/compare/synthesize
// "Hội đồng tổng hợp" — nhận 2+ id của các ProductComparison ĐÃ DONE
// (thuộc cùng bộ sản phẩm đang xem), tổng hợp nội dung các báo cáo đó
// CÙNG VỚI dữ liệu cào GỐC (không chỉ tin báo cáo AI trước — xem luật
// chống ảo giác cộng dồn trong generateComparisonSynthesis, lib/llm/index.ts).
// Cùng cơ chế PENDING -> chạy nền -> poll như /api/compare, tái dùng
// GET /api/compare/[comparisonId] để lấy kết quả.
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";
import {
  generateComparisonSynthesis,
  DEFAULT_COMPARE_SYNTHESIS_PRESETS,
  DEFAULT_CATEGORY_MARKUP_RATIOS,
  type PromptPreset,
  type CompareProductInput,
  type PriorComparisonReport,
  type CategoryMarkupRatio,
} from "@/lib/llm";

const MIN_SOURCES = 2;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const productIds: number[] = Array.isArray(body?.productIds) ? body.productIds.map(Number) : [];
  const sourceComparisonIds: number[] = Array.isArray(body?.sourceComparisonIds)
    ? body.sourceComparisonIds.map(Number)
    : [];
  const sessionId: number | undefined = body?.sessionId ? Number(body.sessionId) : undefined;

  if (sourceComparisonIds.length < MIN_SOURCES) {
    return NextResponse.json(
      { error: `Chọn ít nhất ${MIN_SOURCES} báo cáo đã hoàn tất để tổng hợp.` },
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

  // Xác thực nhẹ: các báo cáo nguồn phải tồn tại, DONE, và đúng bộ sản
  // phẩm đang so sánh (app 1 người dùng chạy local, không cần kiểm tra
  // chặt hơn — xem prisma/schema.prisma cho lý do productIds lưu JSON).
  const sources = await prisma.productComparison.findMany({ where: { id: { in: sourceComparisonIds } } });
  if (sources.length !== sourceComparisonIds.length) {
    return NextResponse.json({ error: "Một số báo cáo nguồn không tồn tại." }, { status: 404 });
  }
  const notDone = sources.find((s) => s.status !== "DONE");
  if (notDone) {
    return NextResponse.json(
      { error: `Báo cáo "#${notDone.id}" chưa hoàn tất, không thể dùng để tổng hợp.` },
      { status: 400 }
    );
  }
  const sortedTarget = JSON.stringify([...productIds].sort((a, b) => a - b));
  const mismatched = sources.find((s) => {
    const parsed: number[] = JSON.parse(s.productIds);
    return JSON.stringify([...parsed].sort((a, b) => a - b)) !== sortedTarget;
  });
  if (mismatched) {
    return NextResponse.json(
      { error: "Các báo cáo nguồn không cùng bộ sản phẩm đang so sánh." },
      { status: 400 }
    );
  }

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: {
      listings: { include: { variants: true, images: { orderBy: { sortOrder: "asc" } }, reviews: true } },
      categories: { select: { name: true } },
    },
  });
  if (products.length !== productIds.length) {
    return NextResponse.json({ error: "Một số sản phẩm không tồn tại." }, { status: 404 });
  }

  const [presetsSetting, activeIdSetting, markupSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "compare_synthesis_prompt_presets" } }),
    prisma.setting.findUnique({ where: { key: "compare_synthesis_prompt_active_preset_id" } }),
    prisma.setting.findUnique({ where: { key: "category_markup_ratios" } }),
  ]);
  let presets: PromptPreset[] = DEFAULT_COMPARE_SYNTHESIS_PRESETS;
  if (presetsSetting?.value) {
    try {
      const parsed = JSON.parse(presetsSetting.value);
      if (Array.isArray(parsed) && parsed.length > 0) presets = parsed;
    } catch {
      // JSON hỏng thì dùng bộ preset mặc định
    }
  }
  const preset = presets.find((p) => p.id === activeIdSetting?.value) ?? presets[0];

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

  const priorReports: PriorComparisonReport[] = sources.map((s) => ({
    presetName: s.presetName ?? `Báo cáo #${s.id}`,
    resultMarkdown: s.resultMarkdown ?? "",
  }));

  const comparison = await prisma.productComparison.create({
    data: {
      productIds: JSON.stringify(productIds),
      status: "PENDING",
      presetName: `🧑‍⚖️ ${preset.name}`,
      sourceComparisonIds: JSON.stringify(sourceComparisonIds),
      ...(sessionId ? { session: { connect: { id: sessionId } } } : {}),
    },
  });

  void runSynthesisInBackground(comparison.id, inputs, provider.apiKey, preset, priorReports, markupRatios);

  return NextResponse.json({ comparisonId: comparison.id }, { status: 202 });
}

async function runSynthesisInBackground(
  comparisonId: number,
  inputs: CompareProductInput[],
  apiKey: string,
  preset: PromptPreset,
  priorReports: PriorComparisonReport[],
  markupRatios: CategoryMarkupRatio[]
) {
  // BẮT BUỘC bọc try/catch TOÀN BỘ thân hàm — promise "bắn rồi quên",
  // xem giải thích trong src/app/api/products/[id]/analyze/route.ts.
  try {
    let resultMarkdown: string;
    try {
      resultMarkdown = await generateComparisonSynthesis(inputs, apiKey, preset.content, priorReports, markupRatios);
    } catch (err) {
      await prisma.productComparison.update({
        where: { id: comparisonId },
        data: { status: "FAILED", finishedAt: new Date(), errorMessage: String(err) },
      });
      await logActivity(
        "product.compare_synthesis_failed",
        `Gemini lỗi khi tổng hợp hội đồng (#${comparisonId}): ${String(err)}`
      );
      return;
    }

    await prisma.productComparison.update({
      where: { id: comparisonId },
      data: { status: "DONE", finishedAt: new Date(), resultMarkdown },
    });

    await logActivity(
      "product.compare_synthesis",
      `Tổng hợp hội đồng AI (#${comparisonId}) từ ${priorReports.length} báo cáo cho ${inputs.length} sản phẩm`
    );
  } catch (err) {
    console.error(`Lỗi không lường trước khi xử lý tổng hợp #${comparisonId}:`, err);
    await prisma.productComparison
      .update({
        where: { id: comparisonId },
        data: { status: "FAILED", finishedAt: new Date(), errorMessage: String(err) },
      })
      .catch(() => {});
  }
}
