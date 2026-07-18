// API: POST /api/sessions/[sessionId]/score (chấm điểm đa trục AI cho cả
// phiên) · PATCH (người dùng override 1 trục của 1 sản phẩm).
// Cùng cơ chế PENDING -> chạy nền -> poll như /api/products/[id]/analyze.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";
import {
  generateProductScores,
  DEFAULT_CATEGORY_MARKUP_RATIOS,
  type CompareProductInput,
  type CategoryMarkupRatio,
} from "@/lib/llm";
import { SCORE_GROUPS, type AxesScoreMap } from "@/lib/scoring";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await prisma.evaluationSession.findUnique({ where: { id: Number(sessionId) } });
  if (!session) {
    return NextResponse.json({ error: "Không tìm thấy phiên đánh giá" }, { status: 404 });
  }
  const productIds: number[] = JSON.parse(session.productIds);

  const provider = await prisma.apiProvider.findFirst({
    where: { kind: "LLM", name: "Google Gemini", enabled: true },
  });
  if (!provider?.apiKey) {
    return NextResponse.json(
      { error: "Chưa bật/chưa có API key cho Google Gemini — vào Cài đặt > API để cấu hình." },
      { status: 400 }
    );
  }

  const [products, markupSetting] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        listings: { include: { variants: true, images: { orderBy: { sortOrder: "asc" } }, reviews: true } },
        categories: { select: { name: true } },
      },
    }),
    prisma.setting.findUnique({ where: { key: "category_markup_ratios" } }),
  ]);
  if (products.length !== productIds.length) {
    return NextResponse.json({ error: "Một số sản phẩm không tồn tại." }, { status: 404 });
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

  // Upsert PENDING cho từng sản phẩm — "chấm lại" reset điểm cũ (kể cả
  // override) vì đây là 1 lượt chấm MỚI cho cả phiên, không phải sửa lẻ.
  await Promise.all(
    productIds.map((productId) =>
      prisma.productScore.upsert({
        where: { sessionId_productId: { sessionId: session.id, productId } },
        update: { status: "PENDING", axesJson: null, errorMessage: null, startedAt: new Date(), finishedAt: null },
        create: { sessionId: session.id, productId, status: "PENDING" },
      })
    )
  );

  void runScoringInBackground(session.id, inputs, provider.apiKey, markupRatios);

  return NextResponse.json({ ok: true }, { status: 202 });
}

async function runScoringInBackground(
  sessionId: number,
  inputs: CompareProductInput[],
  apiKey: string,
  markupRatios: CategoryMarkupRatio[]
) {
  // BẮT BUỘC bọc try/catch TOÀN BỘ thân hàm — promise "bắn rồi quên",
  // xem giải thích trong src/app/api/products/[id]/analyze/route.ts.
  try {
    let results;
    try {
      results = await generateProductScores(inputs, apiKey, SCORE_GROUPS, markupRatios);
    } catch (err) {
      await prisma.productScore.updateMany({
        where: { sessionId, productId: { in: inputs.map((i) => i.id) } },
        data: { status: "FAILED", finishedAt: new Date(), errorMessage: String(err) },
      });
      await logActivity("session.score_failed", `Gemini lỗi khi chấm điểm phiên #${sessionId}: ${String(err)}`);
      return;
    }

    await Promise.all(
      inputs.map(async (input) => {
        const result = results.find((r) => r.productId === input.id);
        if (!result) {
          return prisma.productScore.update({
            where: { sessionId_productId: { sessionId, productId: input.id } },
            data: { status: "FAILED", finishedAt: new Date(), errorMessage: "Gemini không trả điểm cho sản phẩm này." },
          });
        }
        const axes: AxesScoreMap = {};
        for (const a of result.axes) {
          axes[a.axisId] = { ai: a.score, user: null, reason: a.reason };
        }
        return prisma.productScore.update({
          where: { sessionId_productId: { sessionId, productId: input.id } },
          data: { status: "DONE", finishedAt: new Date(), axesJson: JSON.stringify(axes) },
        });
      })
    );

    await logActivity("session.score", `Chấm điểm đa trục AI cho phiên #${sessionId} (${inputs.length} sản phẩm)`);
  } catch (err) {
    console.error(`Lỗi không lường trước khi chấm điểm phiên #${sessionId}:`, err);
    await prisma.productScore
      .updateMany({
        where: { sessionId, productId: { in: inputs.map((i) => i.id) } },
        data: { status: "FAILED", finishedAt: new Date(), errorMessage: String(err) },
      })
      .catch(() => {});
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = await request.json().catch(() => ({}));
  const productId = Number(body?.productId);
  const axisId: string | undefined = body?.axisId;
  const value = body?.value === null ? null : Number(body?.value);

  if (!productId || !axisId || (value !== null && (Number.isNaN(value) || value < 0 || value > 100))) {
    return NextResponse.json({ error: "Dữ liệu override không hợp lệ." }, { status: 400 });
  }

  const score = await prisma.productScore.findUnique({
    where: { sessionId_productId: { sessionId: Number(sessionId), productId } },
  });
  if (!score || !score.axesJson) {
    return NextResponse.json({ error: "Chưa có điểm AI cho sản phẩm này." }, { status: 404 });
  }

  const axes: AxesScoreMap = JSON.parse(score.axesJson);
  if (!axes[axisId]) {
    return NextResponse.json({ error: "Trục điểm không tồn tại." }, { status: 400 });
  }
  axes[axisId] = { ...axes[axisId], user: value };

  await prisma.productScore.update({
    where: { sessionId_productId: { sessionId: Number(sessionId), productId } },
    data: { axesJson: JSON.stringify(axes) },
  });
  await logActivity(
    "session.score_override",
    `Sửa tay điểm trục "${axisId}" (sản phẩm #${productId}, phiên #${sessionId}) = ${value ?? "(về theo AI)"}`
  );

  return NextResponse.json({ ok: true });
}
