"use client";

// Chấm điểm đa trục AI cho 1 phiên đánh giá — 15 trục/5 nhóm (xem
// SCORE_GROUPS trong src/lib/scoring.ts), thang 100/trục. AI chấm 1 lần
// cho CẢ phiên (chấm tương đối giữa các sản phẩm), người dùng override
// từng trục nếu không đồng ý (lý do AI gốc GIỮ NGUYÊN để đối chiếu).
// Cùng cơ chế PENDING -> chạy nền -> poll như AiAnalysisPanel.tsx.
import { useEffect, useRef, useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  SCORE_GROUPS,
  computeGroupScores,
  computeOverallScore,
  effectiveAxisScore,
  type AxesScoreMap,
} from "@/lib/scoring";
import { friendlyGeminiError } from "@/lib/llm";

interface ProductScoreData {
  productId: number;
  status: "PENDING" | "DONE" | "FAILED";
  axesJson: string | null;
  errorMessage: string | null;
}

const POLL_MS = 2500;
const COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

function parseAxes(json: string | null): AxesScoreMap | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as AxesScoreMap;
  } catch {
    return null;
  }
}

export default function ScorePanel({
  sessionId,
  products,
  initialScores,
}: {
  sessionId: number;
  products: { id: number; name: string }[];
  initialScores: ProductScoreData[];
}) {
  const [scores, setScores] = useState<ProductScoreData[]>(initialScores);
  const scoresRef = useRef(scores);
  scoresRef.current = scores;
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [expandedProductId, setExpandedProductId] = useState<number | null>(products[0]?.id ?? null);

  const hasPending = scores.some((s) => s.status === "PENDING");
  const hasAny = scores.length > 0;

  useEffect(() => {
    if (!hasPending) return;
    const poll = setInterval(async () => {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) return;
      const data = await res.json();
      setScores(data.scores ?? []);
    }, POLL_MS);
    return () => clearInterval(poll);
  }, [hasPending, sessionId]);

  async function runScoring() {
    setGenerating(true);
    setError("");
    const res = await fetch(`/api/sessions/${sessionId}/score`, { method: "POST" });
    if (res.ok) {
      setScores(products.map((p) => ({ productId: p.id, status: "PENDING", axesJson: null, errorMessage: null })));
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Chấm điểm thất bại, thử lại nhé.");
    }
    setGenerating(false);
  }

  async function overrideAxis(productId: number, axisId: string, value: number | null) {
    await fetch(`/api/sessions/${sessionId}/score`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, axisId, value }),
    });
    setScores((prev) =>
      prev.map((s) => {
        if (s.productId !== productId) return s;
        const axes = parseAxes(s.axesJson) ?? {};
        axes[axisId] = { ...axes[axisId], user: value };
        return { ...s, axesJson: JSON.stringify(axes) };
      })
    );
  }

  const scoreByProduct = new Map(scores.map((s) => [s.productId, s]));

  const radarData = SCORE_GROUPS.map((g) => {
    const row: Record<string, string | number> = { group: `${g.icon} ${g.label}` };
    for (const p of products) {
      const s = scoreByProduct.get(p.id);
      const axes = s?.status === "DONE" ? parseAxes(s.axesJson) : null;
      const groupScore = axes ? computeGroupScores(axes).find((gs) => gs.groupId === g.id)?.score : null;
      row[p.name || `#${p.id}`] = groupScore !== null && groupScore !== undefined ? Math.round(groupScore) : 0;
    }
    return row;
  });

  const allDone = products.length > 0 && products.every((p) => scoreByProduct.get(p.id)?.status === "DONE");

  return (
    <section className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-semibold">📊 Chấm điểm đa trục</h2>
        <button
          onClick={runScoring}
          disabled={generating || hasPending}
          className="text-xs rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5"
        >
          {generating || hasPending ? "⏳ Đang chấm..." : hasAny ? "🔄 Chấm lại" : "📊 Chấm điểm đa trục"}
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {hasPending && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          ⏳ AI đang chấm 15 trục cho {products.length} sản phẩm... có thể mất tới vài chục giây.
        </p>
      )}
      {scores.some((s) => s.status === "FAILED") && (
        <p className="text-sm text-red-500">
          ❌ Chấm điểm thất bại: {friendlyGeminiError(scores.find((s) => s.status === "FAILED")?.errorMessage)}
        </p>
      )}

      {!hasAny && !hasPending && (
        <p className="text-sm text-slate-400">
          Chưa chấm. AI sẽ chấm 15 trục (gộp 5 nhóm: Tài chính, Vận hành, Thị trường, Pháp lý, Thương hiệu) cho
          từng sản phẩm — chấm tương đối giữa các sản phẩm trong phiên này.
        </p>
      )}

      {allDone && (
        <>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="group" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                {products.map((p, idx) => (
                  <Radar
                    key={p.id}
                    name={p.name || `#${p.id}`}
                    dataKey={p.name || `#${p.id}`}
                    stroke={COLORS[idx % COLORS.length]}
                    fill={COLORS[idx % COLORS.length]}
                    fillOpacity={0.15}
                  />
                ))}
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            {products.map((p) => {
              const s = scoreByProduct.get(p.id);
              const axes = s ? parseAxes(s.axesJson) : null;
              if (!axes) return null;
              const overall = computeOverallScore(axes);
              const groupScores = computeGroupScores(axes);
              const expanded = expandedProductId === p.id;
              return (
                <div key={p.id} className="rounded-lg border border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => setExpandedProductId(expanded ? null : p.id)}
                    className="w-full flex items-center justify-between p-3 text-left"
                  >
                    <span className="font-medium text-sm">{p.name || `#${p.id}`}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {overall !== null ? Math.round(overall) : "—"}/100
                      </span>
                      <span className="text-xs text-slate-400">{expanded ? "▲" : "▼"}</span>
                    </span>
                  </button>
                  {expanded && (
                    <div className="px-3 pb-3 space-y-4 border-t border-slate-200 dark:border-slate-800 pt-3">
                      {SCORE_GROUPS.map((g) => {
                        const gs = groupScores.find((x) => x.groupId === g.id);
                        return (
                          <div key={g.id}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                {g.icon} {g.label}
                              </span>
                              <span className="text-xs font-semibold">
                                {gs?.score !== null && gs?.score !== undefined ? Math.round(gs.score) : "—"}/100
                              </span>
                            </div>
                            <div className="space-y-2">
                              {g.axes.map((a) => {
                                const entry = axes[a.id];
                                const value = effectiveAxisScore(entry) ?? 0;
                                const isOverridden = entry?.user !== null && entry?.user !== undefined;
                                return (
                                  <div key={a.id}>
                                    <div className="flex items-center gap-2 text-xs mb-0.5">
                                      <span className="flex-1 text-slate-600 dark:text-slate-300">{a.label}</span>
                                      <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={Math.round(value)}
                                        onChange={(e) => {
                                          const v = Number(e.target.value);
                                          if (Number.isNaN(v)) return;
                                          overrideAxis(p.id, a.id, Math.min(100, Math.max(0, v)));
                                        }}
                                        className="w-14 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-xs text-right"
                                      />
                                      {isOverridden && (
                                        <button
                                          onClick={() => overrideAxis(p.id, a.id, null)}
                                          title={`Điểm AI gốc: ${Math.round(entry.ai)} — bấm để dùng lại`}
                                          className="text-[10px] text-blue-500 hover:underline shrink-0"
                                        >
                                          ↩ AI: {Math.round(entry.ai)}
                                        </button>
                                      )}
                                    </div>
                                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-blue-500"
                                        style={{ width: `${value}%` }}
                                      />
                                    </div>
                                    {entry?.reason && (
                                      <p className="text-[11px] text-slate-400 mt-0.5">{entry.reason}</p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="text-xs text-slate-400">
        💡 AI chấm hết 15 trục trước, bạn sửa tay được từng trục nếu không đồng ý (bấm "↩ AI: X" để quay lại điểm
        AI gốc). Điểm nhóm/điểm tổng tự tính lại ngay khi sửa.
      </p>
    </section>
  );
}
