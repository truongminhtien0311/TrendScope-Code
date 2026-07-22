"use client";

// Bảng so sánh dữ liệu GỐC (cào được, chưa AI dịch/tổng hợp) của N sản
// phẩm cạnh nhau + khu vực chạy AI phân tích theo mục đích người dùng
// chọn (xem src/lib/llm/index.ts: generateProductComparison chỉ nhận dữ
// liệu Original, không dùng bản đã AI hóa để tránh thiên kiến cộng dồn).
// Cùng cơ chế PENDING -> chạy nền -> poll như AiAnalysisPanel.tsx.
//
// Nhiều lượt chạy (mỗi lượt 1 góc nhìn persona khác nhau: CFO, COO, Sàng
// lọc loại trừ...) được giữ lại trong `runs` SUỐT PHIÊN mở trang này (không lưu
// lại sau khi F5, giống hành vi cũ) để người dùng có thể tick chọn ≥2 lượt
// ĐÃ XONG rồi bấm "🧑‍⚖️ Tổng hợp hội đồng" — gộp các báo cáo đó lại thành 1
// kết luận cuối (xem generateComparisonSynthesis, lib/llm/index.ts).
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { toast } from "sonner";
import { cnyToVnd, formatVnd } from "@/lib/currency";
import SmartImage from "@/components/SmartImage";
import ElapsedBadge from "@/components/ElapsedBadge";
import { useBackgroundTasks } from "@/components/BackgroundTaskProvider";
import { friendlyGeminiError, type PromptPreset } from "@/lib/llm";

export interface CompareProductData {
  id: number;
  name: string;
  listings: {
    sourceType: string;
    platform: string;
    titleOriginal: string | null;
    soldTotal: number | null;
    variants: { priceCny: number }[];
    images: { url: string; kind: string }[];
  }[];
}

interface CompareRun {
  comparisonId: number;
  presetName: string;
  status: "PENDING" | "DONE" | "FAILED";
  resultMarkdown: string;
  errorMessage?: string;
  isSynthesis: boolean;
  expanded: boolean;
  // Mốc thời gian bắt đầu chạy (epoch ms) — dùng để tính số giây đã chờ,
  // hiển thị ngay trên dòng lượt chạy khi còn PENDING (xem `now` bên dưới).
  startedAt: number;
}

const POLL_MS = 2500;

function mainImage(product: CompareProductData): string | null {
  for (const l of product.listings) {
    const main = l.images.find((i) => i.kind === "MAIN") ?? l.images[0];
    if (main) return main.url;
  }
  return null;
}

function priceRangeText(product: CompareProductData, rate: number, sourceType: string): string | null {
  const prices = product.listings
    .filter((l) => l.sourceType === sourceType)
    .flatMap((l) => l.variants.map((v) => v.priceCny));
  if (!prices.length) return null;
  const min = formatVnd(cnyToVnd(Math.min(...prices), rate));
  const max = formatVnd(cnyToVnd(Math.max(...prices), rate));
  return min === max ? min : `${min} ~ ${max}`;
}

// Bảng màu nền siêu mờ, xoay vòng theo từng đoạn (heading ## hoặc ###) để mắt
// dễ tách bạch ranh giới các phần khi đọc báo cáo AI dài — không có ý nghĩa
// gì khác ngoài phân đoạn thị giác.
// Màu nền + viền cho từng dòng tiêu đề lượt phân tích (khi thu gọn), xoay
// vòng theo thứ tự để phân biệt nhanh dòng nào với dòng nào trong danh sách.
const RUN_HEADER_TINTS = [
  "border-blue-300 dark:border-blue-700 bg-blue-50/60 dark:bg-blue-950/30",
  "border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/30",
  "border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/30",
  "border-rose-300 dark:border-rose-700 bg-rose-50/60 dark:bg-rose-950/30",
  "border-cyan-300 dark:border-cyan-700 bg-cyan-50/60 dark:bg-cyan-950/30",
];

const SECTION_TINTS = [
  "bg-blue-100/40 dark:bg-blue-500/10",
  "bg-emerald-100/40 dark:bg-emerald-500/10",
  "bg-amber-100/40 dark:bg-amber-500/10",
  "bg-rose-100/40 dark:bg-rose-500/10",
  "bg-violet-100/40 dark:bg-violet-500/10",
  "bg-cyan-100/40 dark:bg-cyan-500/10",
];

// Cắt markdown thành từng đoạn theo heading cấp 2-3 (## / ###), giữ nguyên
// heading trong đoạn của nó, để mỗi đoạn có thể tô nền riêng.
function splitMarkdownIntoSections(markdown: string): string[] {
  const lines = markdown.split("\n");
  const sections: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (/^#{2,3}\s/.test(line) && current.length > 0) {
      sections.push(current.join("\n"));
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) sections.push(current.join("\n"));
  return sections.length > 0 ? sections : [markdown];
}

const MARKDOWN_COMPONENTS = {
  a: ({ node, ...props }: any) => (
    <a target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" {...props} />
  ),
  img: ({ node, src, alt, ...props }: any) => (
    <div className="my-4 overflow-hidden rounded-lg max-w-sm">
      <SmartImage src={src || ""} alt={alt || ""} {...props} />
    </div>
  ),
  // Tiêu đề đoạn (## / ###) làm to, đậm, có thanh màu bên trái để mắt nhận
  // ra ngay "sang mục mới" khi lướt qua báo cáo AI dài.
  h2: ({ node, ...props }: any) => (
    <h2
      className="!mt-0 !mb-3 text-lg font-extrabold border-l-4 border-current pl-3 py-1 bg-black/5 dark:bg-white/10 rounded-r-md"
      {...props}
    />
  ),
  h3: ({ node, ...props }: any) => (
    <h3
      className="!mt-4 !mb-2 text-base font-bold border-l-4 border-current/60 pl-3 py-0.5 bg-black/5 dark:bg-white/10 rounded-r-md"
      {...props}
    />
  ),
};

export default function CompareTable({
  products,
  rate,
  presets,
  sessionId,
  initialRuns,
}: {
  products: CompareProductData[];
  rate: number;
  presets: PromptPreset[];
  // Phiên đánh giá chứa bảng này (xem EvaluationSession, prisma/schema.prisma)
  // — lượt so sánh mới tạo được gắn vào đây để KHÔNG mất khi F5. Optional
  // để tương thích ngược nếu có nơi khác còn dùng CompareTable không qua phiên.
  sessionId?: number;
  // Hydrate `runs` từ DB (các ProductComparison đã gắn sessionId) khi mở
  // lại trang — thay vì luôn bắt đầu rỗng như hành vi cũ.
  initialRuns?: CompareRun[];
}) {
  const { registerTask } = useBackgroundTasks();
  const [presetId, setPresetId] = useState(presets[0]?.id);
  const [comparePurpose, setComparePurpose] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const [runs, setRuns] = useState<CompareRun[]>(initialRuns ?? []);
  const runsRef = useRef(runs);
  runsRef.current = runs;

  const [selectedForSynthesis, setSelectedForSynthesis] = useState<Set<number>>(new Set());
  const [showSynthesisPreview, setShowSynthesisPreview] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesisError, setSynthesisError] = useState("");

  const hasPending = runs.some((r) => r.status === "PENDING");

  // Đồng hồ đếm giờ CHUNG cho mọi lượt PENDING (không phải 1 interval riêng
  // cho mỗi lượt) — dù nhiều lượt chạy song song vẫn chỉ 1 interval duy
  // nhất, tick mỗi giây, TỰ DỪNG khi hết PENDING để không ảnh hưởng hiệu
  // năng trang lúc không có gì đang chạy. Mỗi dòng lượt tự tính số giây
  // đã chờ từ `now - run.startedAt`.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasPending]);

  // 1 interval duy nhất poll TẤT CẢ lượt đang PENDING — thực tế hiếm khi
  // có nhiều lượt PENDING song song, nhưng vẫn xử lý đúng nếu xảy ra.
  useEffect(() => {
    const poll = setInterval(async () => {
      const pending = runsRef.current.filter((r) => r.status === "PENDING");
      if (!pending.length) return;
      const results = await Promise.all(
        pending.map(async (r) => {
          const res = await fetch(`/api/compare/${r.comparisonId}`);
          if (!res.ok) return null;
          return { comparisonId: r.comparisonId, data: await res.json() };
        })
      );
      setRuns((prev) =>
        prev.map((r) => {
          const found = results.find((x) => x?.comparisonId === r.comparisonId);
          if (!found || found.data.status === "PENDING") return r;
          return {
            ...r,
            status: found.data.status,
            resultMarkdown: found.data.status === "DONE" ? found.data.resultMarkdown ?? "" : r.resultMarkdown,
            errorMessage: found.data.status === "FAILED" ? found.data.errorMessage ?? "Thất bại." : undefined,
          };
        })
      );
    }, POLL_MS);
    return () => clearInterval(poll);
  }, []);

  function toggleExpanded(comparisonId: number) {
    setRuns((prev) => prev.map((r) => (r.comparisonId === comparisonId ? { ...r, expanded: !r.expanded } : r)));
  }

  // Lượt FAILED không cần giữ lại làm rác danh sách (kể cả trong "Lịch sử
  // đánh giá" nạp lại từ initialRuns) — báo lỗi chi tiết qua toast rồi tự
  // xóa khỏi DB + khỏi state, còn lại đã có logActivity trong route DELETE
  // ghi lại để tra cứu sau nếu cần.
  const cleanedFailedIds = useRef<Set<number>>(new Set());
  useEffect(() => {
    const failed = runs.filter((r) => r.status === "FAILED" && !cleanedFailedIds.current.has(r.comparisonId));
    if (!failed.length) return;
    (async () => {
      for (const r of failed) {
        cleanedFailedIds.current.add(r.comparisonId);
        toast.error(`❌ So sánh AI lỗi (${r.presetName}): ${friendlyGeminiError(r.errorMessage)}`);
        await fetch(`/api/compare/${r.comparisonId}`, { method: "DELETE" }).catch(() => {});
      }
      setRuns((prev) => prev.filter((r) => !failed.some((f) => f.comparisonId === r.comparisonId)));
    })();
  }, [runs]);

  function toggleSelected(comparisonId: number) {
    setSelectedForSynthesis((prev) => {
      const next = new Set(prev);
      if (next.has(comparisonId)) next.delete(comparisonId);
      else next.add(comparisonId);
      return next;
    });
  }

  // Poll dùng chung cho cả lượt so sánh và lượt tổng hợp hội đồng — cùng 1
  // GET endpoint (xem /api/compare/[id]/route.ts). Tái dùng cho widget
  // "Tác vụ AI" toàn app (BackgroundTaskProvider.tsx).
  function makeComparePoll(comparisonId: number) {
    return async () => {
      const res = await fetch(`/api/compare/${comparisonId}`);
      if (!res.ok) return null;
      const data = await res.json();
      return { status: data.status, errorMessage: data.errorMessage };
    };
  }

  async function postCompare(): Promise<{ comparisonId: number } | { error: string }> {
    const res = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: products.map((p) => p.id), presetId, comparePurpose, sessionId }),
    });
    if (res.ok) {
      const data = await res.json();
      return { comparisonId: data.comparisonId };
    }
    const data = await res.json().catch(() => null);
    return { error: data?.error ?? "So sánh AI thất bại, vui lòng thử lại." };
  }

  async function confirmGenerate() {
    setShowPreview(false);
    setGenerating(true);
    setError("");
    const presetName = presets.find((p) => p.id === presetId)?.name ?? "";
    const result = await postCompare();
    setGenerating(false);
    if ("comparisonId" in result) {
      setRuns((prev) => [
        ...prev,
        {
          comparisonId: result.comparisonId,
          presetName,
          status: "PENDING",
          resultMarkdown: "",
          isSynthesis: false,
          expanded: true,
          startedAt: Date.now(),
        },
      ]);
      if (sessionId) {
        registerTask({
          kind: "compare",
          label: `🧠 So sánh AI — ${presetName}`,
          targetHref: `/compare/${sessionId}`,
          poll: makeComparePoll(result.comparisonId),
          retry: async () => {
            const r = await postCompare();
            if (!("comparisonId" in r)) return null;
            return { poll: makeComparePoll(r.comparisonId) };
          },
        });
      }
    } else {
      setError(result.error);
    }
  }

  async function postSynthesize(sourceIds: number[]): Promise<{ comparisonId: number } | { error: string }> {
    const res = await fetch("/api/compare/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: products.map((p) => p.id), sourceComparisonIds: sourceIds, sessionId }),
    });
    if (res.ok) {
      const data = await res.json();
      return { comparisonId: data.comparisonId };
    }
    const data = await res.json().catch(() => null);
    return { error: data?.error ?? "Tổng hợp thất bại, vui lòng thử lại." };
  }

  async function confirmSynthesize() {
    setShowSynthesisPreview(false);
    setSynthesizing(true);
    setSynthesisError("");
    const sourceIds = [...selectedForSynthesis];
    const result = await postSynthesize(sourceIds);
    setSynthesizing(false);
    if ("comparisonId" in result) {
      setRuns((prev) => [
        ...prev,
        {
          comparisonId: result.comparisonId,
          presetName: "🧑‍⚖️ Tổng hợp hội đồng",
          status: "PENDING",
          resultMarkdown: "",
          isSynthesis: true,
          expanded: true,
          startedAt: Date.now(),
        },
      ]);
      setSelectedForSynthesis(new Set());
      if (sessionId) {
        registerTask({
          kind: "synthesize",
          label: "🧑‍⚖️ Tổng hợp hội đồng",
          targetHref: `/compare/${sessionId}`,
          poll: makeComparePoll(result.comparisonId),
          retry: async () => {
            const r = await postSynthesize(sourceIds);
            if (!("comparisonId" in r)) return null;
            return { poll: makeComparePoll(r.comparisonId) };
          },
        });
      }
    } else {
      setSynthesisError(result.error);
    }
  }

  const selectedRuns = runs.filter((r) => selectedForSynthesis.has(r.comparisonId));

  return (
    <div className="space-y-6">
      <div
        className="no-scrollbar overflow-x-auto rounded-xl"
        style={{ border: "1px solid var(--border-subtle)" }}
      >
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <td className="p-3 font-medium text-slate-500 dark:text-slate-400 w-32 shrink-0">Ảnh</td>
              {products.map((p) => {
                const img = mainImage(p);
                return (
                  <td key={p.id} className="p-3">
                    {img ? (
                      <SmartImage src={img} alt={p.name} className="w-24 h-24 rounded-lg object-cover" />
                    ) : (
                      <div className="w-24 h-24 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl">
                        📦
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <td className="p-3 font-medium text-slate-500 dark:text-slate-400">Tên sản phẩm</td>
              {products.map((p) => (
                <td key={p.id} className="p-3 font-medium">
                  <a href={`/products/${p.id}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                    {p.name || "(Chưa đặt tên)"}
                  </a>
                </td>
              ))}
            </tr>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <td className="p-3 font-medium text-slate-500 dark:text-slate-400">Giá bán lẻ</td>
              {products.map((p) => (
                <td key={p.id} className="p-3">
                  {priceRangeText(p, rate, "RETAIL") ?? "—"}
                </td>
              ))}
            </tr>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <td className="p-3 font-medium text-slate-500 dark:text-slate-400">Giá nhập</td>
              {products.map((p) => (
                <td key={p.id} className="p-3">
                  {priceRangeText(p, rate, "MANUFACTURER") ?? "—"}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-3 font-medium text-slate-500 dark:text-slate-400">Tổng lượt bán</td>
              {products.map((p) => {
                const total = p.listings.reduce((s, l) => s + (l.soldTotal ?? 0), 0);
                return (
                  <td key={p.id} className="p-3">
                    {total ? total.toLocaleString("vi-VN") : "—"}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <section className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
        <h2 className="font-semibold">🧠 Phân tích AI so sánh</h2>

        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            disabled={generating}
            className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 disabled:opacity-50"
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            value={comparePurpose}
            onChange={(e) => setComparePurpose(e.target.value)}
            disabled={generating}
            placeholder="Mục đích cụ thể thêm (tuỳ chọn), vd: ưu tiên sản phẩm dễ vận chuyển"
            className="flex-1 min-w-[240px] text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 disabled:opacity-50"
          />
          <button
            onClick={() => setShowPreview(true)}
            disabled={generating}
            className="text-xs rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5"
          >
            {generating ? "Đang gửi yêu cầu..." : "✨AI Phân tích🔍"}
          </button>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {runs.length > 0 && (
          <div className="space-y-3 pt-2">
            {runs.map((run, runIndex) => {
              const elapsedSec = run.status === "PENDING" ? Math.max(0, Math.floor((now - run.startedAt) / 1000)) : 0;
              return (
              <div
                key={run.comparisonId}
                className={`rounded-lg border-2 p-3 ${
                  run.isSynthesis
                    ? "border-l-4 border-purple-400 dark:border-purple-500 bg-purple-50/40 dark:bg-purple-950/20"
                    : `${RUN_HEADER_TINTS[runIndex % RUN_HEADER_TINTS.length]}`
                }`}
              >
                <div className="flex items-center gap-2">
                  {run.status === "DONE" && (
                    <input
                      type="checkbox"
                      checked={selectedForSynthesis.has(run.comparisonId)}
                      onChange={() => toggleSelected(run.comparisonId)}
                      title="Chọn để đưa vào Tổng hợp hội đồng"
                      className="w-5 h-5 shrink-0"
                    />
                  )}
                  <button
                    onClick={() => toggleExpanded(run.comparisonId)}
                    className="flex-1 flex items-center gap-2 text-left font-bold text-base"
                  >
                    <span className="text-xl">{run.isSynthesis ? "🧑‍⚖️" : "🧠"}</span>
                    <span>{run.presetName}</span>
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5">
                      {run.status === "PENDING" ? (
                        <>
                          ⏳ đang chạy... <ElapsedBadge seconds={elapsedSec} />
                        </>
                      ) : run.status === "FAILED" ? (
                        "❌ thất bại"
                      ) : (
                        "✅"
                      )}
                    </span>
                    <span className="ml-auto text-sm text-slate-500 dark:text-slate-400">{run.expanded ? "▲" : "▼"}</span>
                  </button>
                </div>

                {run.status === "PENDING" && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    ⏳ Đang chờ Gemini xử lý (có thể mất tới vài chục giây) — theo dõi số giây ngay ở trên.
                  </p>
                )}
                {run.status === "FAILED" && (
                  <p className="text-xs text-red-500 mt-2">{friendlyGeminiError(run.errorMessage)}</p>
                )}
                {run.status === "DONE" && run.expanded && (
                  <div className="prose prose-sm dark:prose-invert max-w-none pt-2 mt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    {splitMarkdownIntoSections(run.resultMarkdown.replace(/\\n/g, "\n")).map((section, i) => (
                      <div key={i} className={`rounded-lg px-3 py-2 ${SECTION_TINTS[i % SECTION_TINTS.length]}`}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
                          rehypePlugins={[rehypeRaw, rehypeKatex]}
                          components={MARKDOWN_COMPONENTS}
                        >
                          {section}
                        </ReactMarkdown>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}

        {selectedForSynthesis.size >= 2 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={() => setShowSynthesisPreview(true)}
              disabled={synthesizing || hasPending}
              className="text-xs rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-3 py-1.5"
            >
              {synthesizing ? "Đang gửi yêu cầu..." : `🧑‍⚖️ Tổng hợp hội đồng (${selectedForSynthesis.size})`}
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400">Đã chọn {selectedForSynthesis.size} báo cáo để đối chiếu.</span>
          </div>
        )}
        {synthesisError && <p className="text-sm text-red-500">{synthesisError}</p>}

        {/* MODAL PREVIEW PROMPT CHO SO SÁNH */}
        {showPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-lg">Duyệt lại Prompt so sánh trước khi gửi AI</h3>
                  <p className="text-sm text-slate-500">Lát cắt được chọn: <strong className="text-slate-700 dark:text-slate-300">{presets.find(p => p.id === presetId)?.name}</strong></p>
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>

              <div className="px-4 pt-4 shrink-0">
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-4 py-3 rounded-lg text-sm flex gap-3 items-start">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <strong className="block mb-1">Quyết định Nhập khẩu — Sống còn dựa trên lát cắt!</strong>
                    <p>So sánh đa sản phẩm đòi hỏi AI phải "tàn nhẫn". Hãy chắc chắn bạn chọn đúng góc nhìn (CFO, COO, Phễu, Sàng lọc) phù hợp với ngân sách và chiến lược của công ty. AI sẽ phân tích dựa vào giá bán, thể tích, tính năng gốc. <strong>Chỉ tham khảo, không nhắm mắt tin bừa!</strong></p>
                  </div>
                </div>
              </div>

              <div className="p-4 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-950/50 space-y-3 mt-4 border-t border-slate-200 dark:border-slate-800">
                <pre className="text-xs font-mono whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                  {presets.find(p => p.id === presetId)?.content}
                </pre>
                {comparePurpose && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-100 dark:border-blue-800">
                    <p className="text-xs text-blue-800 dark:text-blue-300 font-semibold mb-1">Mục đích bổ sung của bạn:</p>
                    <p className="text-xs text-blue-700 dark:text-blue-400">{comparePurpose}</p>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-900/50">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Quay lại
                </button>
                <button
                  onClick={confirmGenerate}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                >
                  ✨ Xác nhận phân tích
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL PREVIEW TỔNG HỢP HỘI ĐỒNG */}
        {showSynthesisPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-semibold text-lg">🧑‍⚖️ Xác nhận Tổng hợp Hội đồng</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Các báo cáo sau sẽ được đối chiếu lại với dữ liệu gốc và tổng hợp thành 1 kết luận cuối:
                </p>
              </div>
              <div className="p-4 overflow-y-auto flex-1 space-y-2">
                <ul className="list-disc list-inside text-sm">
                  {selectedRuns.map((r) => (
                    <li key={r.comparisonId}>{r.presetName}</li>
                  ))}
                </ul>
                <p className="text-xs text-slate-500 dark:text-slate-400 pt-2">
                  💡 AI sẽ đọc lại dữ liệu cào gốc của {products.length} sản phẩm để kiểm chứng các báo cáo trên
                  trước khi kết luận — không tin tuyệt đối vào báo cáo AI trước đó.
                </p>
              </div>
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-900/50">
                <button
                  onClick={() => setShowSynthesisPreview(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Quay lại
                </button>
                <button
                  onClick={confirmSynthesize}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-600 hover:bg-purple-700 text-white"
                >
                  ✨ Xác nhận tổng hợp
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-slate-500 dark:text-slate-400">
          💡 Dùng dữ liệu cào GỐC (chưa qua AI dịch/tổng hợp trước đó) để tránh thiên kiến cộng dồn. Kết quả AI chỉ
          mang tính tham khảo — luôn kiểm tra lại nguồn trước khi quyết định.
        </p>
      </section>
    </div>
  );
}
