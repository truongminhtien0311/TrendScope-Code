// ============================================================
// BÁO CÁO PHIÊN ĐÁNH GIÁ — bản CHỈ ĐỌC cho 1 hoặc nhiều PHIÊN ĐÁNH GIÁ
// (EvaluationSession, xem src/app/compare/[sessionId]/page.tsx) — khác
// với src/app/report/page.tsx (báo cáo dữ liệu cào gốc CỦA 1 sản phẩm).
// Ở đây in ra đúng NỘI DUNG PHIÊN: toàn bộ lượt so sánh AI (persona +
// tổng hợp hội đồng) và điểm đa trục từng sản phẩm — thứ người dùng thực
// sự tạo ra ở trang So sánh, không phải dữ liệu cào lại từ đầu.
//
// Luôn dùng class KHÔNG có "dark:" — xem quy tắc tương tự ở report/page.tsx.
// ============================================================
import { prisma } from "@/lib/db";
import ReactMarkdown from "react-markdown";
import ReportBackBar from "@/components/ReportBackBar";
import { SCORE_GROUPS, computeGroupScores, computeOverallScore, type AxesScoreMap } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const ACCENT = "#2563eb";
const ACCENT_SOFT = "#eff6ff";

function parseAxes(json: string | null): AxesScoreMap | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as AxesScoreMap;
  } catch {
    return null;
  }
}

export default async function SessionReportPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  const idList = (ids ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isFinite(n));

  const sessions = await prisma.evaluationSession.findMany({
    where: { id: { in: idList } },
    include: {
      comparisons: { orderBy: { startedAt: "asc" } },
      scores: true,
    },
  });
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const ordered = idList.map((id) => byId.get(id)).filter((s): s is NonNullable<typeof s> => !!s);

  if (ordered.length === 0) {
    return (
      <div className="bg-white text-slate-900 min-h-screen p-10">
        <p>Không tìm thấy phiên đánh giá nào — kiểm tra lại danh sách đã chọn.</p>
      </div>
    );
  }

  const allProductIds = [...new Set(ordered.flatMap((s) => JSON.parse(s.productIds) as number[]))];
  const products = await prisma.product.findMany({
    where: { id: { in: allProductIds } },
    select: { id: true, name: true },
  });
  const productNameById = new Map(products.map((p) => [p.id, p.name || `#${p.id}`]));

  const exportDate = new Date().toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div className="bg-white text-slate-900 min-h-screen">
      <ReportBackBar />

      <div className="border-b border-slate-100 px-10 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <span className="text-sm font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif", color: ACCENT }}>
          TrendScope
        </span>
        <span className="text-xs text-slate-400">
          Báo cáo phiên đánh giá · {ordered.length} phiên · {exportDate}
        </span>
      </div>

      <div className="max-w-4xl mx-auto px-10 py-12 space-y-20">
        {ordered.map((session, i) => (
          <SessionSection
            key={session.id}
            session={session}
            productNameById={productNameById}
            index={i}
            total={ordered.length}
          />
        ))}
      </div>
    </div>
  );
}

interface SessionWithData {
  id: number;
  name: string | null;
  productIds: string;
  createdAt: Date;
  comparisons: {
    id: number;
    presetName: string | null;
    status: string;
    resultMarkdown: string | null;
    sourceComparisonIds: string | null;
  }[];
  scores: { productId: number; status: string; axesJson: string | null }[];
}

function SessionSection({
  session,
  productNameById,
  index,
  total,
}: {
  session: SessionWithData;
  productNameById: Map<number, string>;
  index: number;
  total: number;
}) {
  const productIds: number[] = JSON.parse(session.productIds);
  const productNames = productIds.map((id) => productNameById.get(id) ?? `#${id}`);
  const doneComparisons = session.comparisons.filter((c) => c.status === "DONE" && c.resultMarkdown);
  const scoreByProduct = new Map(session.scores.map((s) => [s.productId, s]));
  const hasScores = productIds.some((id) => scoreByProduct.get(id)?.status === "DONE");

  return (
    <section className="space-y-10">
      {index > 0 && <div className="border-t border-slate-100 -mt-4 mb-4" />}
      <div>
        {total > 1 && (
          <p className="text-xs font-semibold tracking-wide text-slate-400 mb-2">
            PHIÊN {index + 1} / {total}
          </p>
        )}
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {session.name || `Phiên đánh giá #${session.id}`}
        </h1>
        <div className="w-10 h-[3px] rounded-full mt-3" style={{ background: ACCENT }} />
        <p className="text-slate-500 mt-4">
          {productNames.join(" · ")}
        </p>
        <p className="text-xs text-slate-400 mt-1">Tạo lúc {session.createdAt.toLocaleString("vi-VN")}</p>
      </div>

      {hasScores && (
        <div className="space-y-6">
          <SectionHeading icon="📊" title="Điểm đa trục" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {productIds.map((pid) => {
              const s = scoreByProduct.get(pid);
              const axes = s?.status === "DONE" ? parseAxes(s.axesJson) : null;
              if (!axes) return null;
              const overall = computeOverallScore(axes);
              const groupScores = computeGroupScores(axes);
              return (
                <div key={pid} className="rounded-2xl border border-slate-100 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{productNameById.get(pid) ?? `#${pid}`}</p>
                    <span className="text-sm font-semibold" style={{ color: ACCENT }}>
                      {overall !== null ? Math.round(overall) : "—"}/100
                    </span>
                  </div>
                  <div className="space-y-2">
                    {SCORE_GROUPS.map((g) => {
                      const gs = groupScores.find((x) => x.groupId === g.id);
                      const value = gs?.score !== null && gs?.score !== undefined ? Math.round(gs.score) : 0;
                      return (
                        <div key={g.id}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-500">{g.icon} {g.label}</span>
                            <span className="text-slate-500">{value}/100</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${value}%`, background: ACCENT }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {doneComparisons.length > 0 && (
        <div className="space-y-6">
          <SectionHeading icon="🧠" title="Lượt so sánh AI" />
          <div className="space-y-6">
            {doneComparisons.map((c) => (
              <div key={c.id} className="pl-4" style={{ borderLeft: `2px solid ${ACCENT_SOFT}` }}>
                <h3 className="text-sm font-semibold mb-1.5 flex items-center gap-1.5">
                  {c.sourceComparisonIds ? "🏛️" : "🎭"} {c.presetName ?? "—"}
                  {c.sourceComparisonIds && (
                    <span className="text-xs font-normal px-2 py-0.5 rounded-full" style={{ background: ACCENT_SOFT, color: ACCENT }}>
                      Tổng hợp hội đồng
                    </span>
                  )}
                </h3>
                <div className="prose prose-sm max-w-none prose-slate prose-p:leading-relaxed prose-p:text-slate-600">
                  <ReactMarkdown>{c.resultMarkdown as string}</ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {doneComparisons.length === 0 && !hasScores && (
        <p className="text-sm text-slate-400">Phiên này chưa có lượt so sánh hay điểm đánh giá nào hoàn tất.</p>
      )}
    </section>
  );
}

function SectionHeading({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ background: ACCENT_SOFT }}>
        {icon}
      </span>
      <h2 className="font-semibold text-base tracking-tight">{title}</h2>
    </div>
  );
}
