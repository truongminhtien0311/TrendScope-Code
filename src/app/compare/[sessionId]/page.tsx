// ============================================================
// TRANG PHIÊN ĐÁNH GIÁ — gom 1 bộ sản phẩm (2-5) + toàn bộ lượt so sánh
// persona/hội đồng + điểm đa trục vào 1 phiên lưu trữ THẬT (xem
// EvaluationSession, prisma/schema.prisma) — không mất khi F5, khác với
// trang /compare cũ chỉ sống trong URL query param + state trình duyệt.
// ============================================================
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCnyVndRate } from "@/lib/currency";
import { DEFAULT_COMPARE_PRESETS, type PromptPreset } from "@/lib/llm";
import CompareTable, { type CompareProductData } from "@/components/CompareTable";
import ScorePanel from "@/components/ScorePanel";
import SessionNameEditor from "@/components/SessionNameEditor";
import BackButton from "@/components/BackButton";

export const dynamic = "force-dynamic";

export default async function EvaluationSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { sessionId } = await params;
  const { from } = await searchParams;
  // Chỉ nhận đường dẫn nội bộ — cùng quy ước với src/app/products/[id]/page.tsx.
  const backTo = from && from.startsWith("/") ? from : undefined;
  const backLabel =
    backTo === "/compare/history" ? "Quay lại lịch sử đánh giá" : backTo === "/compare" ? "Quay lại so sánh" : "Quay lại";
  const session = await prisma.evaluationSession.findUnique({
    where: { id: Number(sessionId) },
    include: {
      comparisons: { orderBy: { startedAt: "asc" } },
      scores: true,
    },
  });
  if (!session) notFound();

  const productIds: number[] = JSON.parse(session.productIds);

  const [products, rate, presetsSetting] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        listings: { include: { variants: true, images: true, reviews: true }, orderBy: { createdAt: "desc" } },
      },
    }),
    getCnyVndRate(),
    prisma.setting.findUnique({ where: { key: "compare_prompt_presets" } }),
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

  const byId = new Map(products.map((p) => [p.id, p]));
  const ordered = productIds.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);
  if (ordered.length < 2) notFound();

  const data: CompareProductData[] = ordered.map((p) => ({
    id: p.id,
    name: p.name,
    listings: p.listings.map((l) => ({
      sourceType: l.sourceType,
      platform: l.platform,
      titleOriginal: l.titleOriginal,
      soldTotal: l.soldTotal,
      variants: l.variants.map((v) => ({ priceCny: v.priceCny })),
      images: l.images.map((img) => ({ url: img.url, kind: img.kind })),
    })),
  }));

  const initialRuns = session.comparisons.map((c) => ({
    comparisonId: c.id,
    presetName: c.presetName ?? "—",
    status: c.status as "PENDING" | "DONE" | "FAILED",
    resultMarkdown: c.resultMarkdown ?? "",
    errorMessage: c.errorMessage ?? undefined,
    isSynthesis: !!c.sourceComparisonIds,
    expanded: false,
  }));

  const initialScores = session.scores.map((s) => ({
    productId: s.productId,
    status: s.status as "PENDING" | "DONE" | "FAILED",
    axesJson: s.axesJson,
    errorMessage: s.errorMessage,
  }));

  return (
    <div className="space-y-6 w-full">
      {backTo && <BackButton href={backTo} label={backLabel} />}
      <div>
        <h1
          className="text-2xl font-bold flex items-center gap-2"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          <span
            style={{ background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
          >
            🗂️ Phiên đánh giá #{session.id}
          </span>
          <SessionNameEditor sessionId={session.id} name={session.name} fallback="+ Đặt tên" className="text-base font-normal text-slate-500 dark:text-slate-400" />
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          {ordered.length} sản phẩm · Tạo lúc {session.createdAt.toLocaleString("vi-VN")} · Lưu lại toàn bộ lượt so
          sánh &amp; điểm đánh giá, mở lại xem tiếp được kể cả sau khi đóng trình duyệt.
        </p>
      </div>

      <CompareTable products={data} rate={rate} presets={presets} sessionId={session.id} initialRuns={initialRuns} />

      <ScorePanel
        sessionId={session.id}
        products={ordered.map((p) => ({ id: p.id, name: p.name }))}
        initialScores={initialScores}
      />
    </div>
  );
}
