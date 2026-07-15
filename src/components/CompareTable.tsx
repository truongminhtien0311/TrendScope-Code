"use client";

// Bảng so sánh dữ liệu GỐC (cào được, chưa AI dịch/tổng hợp) của N sản
// phẩm cạnh nhau + khu vực chạy AI phân tích theo mục đích người dùng
// chọn (xem src/lib/llm/index.ts: generateProductComparison chỉ nhận dữ
// liệu Original, không dùng bản đã AI hóa để tránh thiên kiến cộng dồn).
// Cùng cơ chế PENDING -> chạy nền -> poll như AiAnalysisPanel.tsx.
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { cnyToVnd, formatVnd } from "@/lib/currency";
import SmartImage from "@/components/SmartImage";
import type { PromptPreset } from "@/lib/llm";

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

const MARKDOWN_COMPONENTS = {
  a: ({ node, ...props }: any) => (
    <a target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" {...props} />
  ),
  img: ({ node, src, alt, ...props }: any) => (
    <div className="my-4 overflow-hidden rounded-lg max-w-sm">
      <SmartImage src={src || ""} alt={alt || ""} {...props} />
    </div>
  ),
};

export default function CompareTable({
  products,
  rate,
  presets,
}: {
  products: CompareProductData[];
  rate: number;
  presets: PromptPreset[];
}) {
  const [presetId, setPresetId] = useState(presets[0]?.id);
  const [comparePurpose, setComparePurpose] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [comparisonId, setComparisonId] = useState<number | null>(null);
  const [status, setStatus] = useState<"PENDING" | "DONE" | "FAILED" | null>(null);
  const [resultMarkdown, setResultMarkdown] = useState("");

  useEffect(() => {
    if (!comparisonId || status !== "PENDING") return;
    const poll = setInterval(async () => {
      const res = await fetch(`/api/compare/${comparisonId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.status !== "PENDING") {
        setStatus(data.status);
        if (data.status === "DONE") setResultMarkdown(data.resultMarkdown ?? "");
        if (data.status === "FAILED") setError(data.errorMessage ?? "So sánh AI thất bại.");
      }
    }, POLL_MS);
    return () => clearInterval(poll);
  }, [comparisonId, status]);

  async function confirmGenerate() {
    setShowPreview(false);
    setGenerating(true);
    setError("");
    setResultMarkdown("");
    const res = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: products.map((p) => p.id), presetId, comparePurpose }),
    });
    setGenerating(false);
    if (res.ok) {
      const data = await res.json();
      setComparisonId(data.comparisonId);
      setStatus("PENDING");
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "So sánh AI thất bại, thử lại nhé.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
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
            disabled={generating || status === "PENDING"}
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
            disabled={generating || status === "PENDING"}
            placeholder="Mục đích cụ thể thêm (tuỳ chọn), vd: ưu tiên sản phẩm dễ vận chuyển"
            className="flex-1 min-w-[240px] text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 disabled:opacity-50"
          />
          <button
            onClick={() => setShowPreview(true)}
            disabled={generating || status === "PENDING"}
            className="text-xs rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5"
          >
            {generating ? "Đang gửi yêu cầu..." : status === "PENDING" ? "⏳ Đang phân tích..." : "✨AI Phân tích🔍"}
          </button>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {status === "PENDING" && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            ⏳ Đang chờ Gemini phân tích {products.length} sản phẩm... có thể mất tới vài chục giây.
          </p>
        )}
        {status === "DONE" && resultMarkdown && (
          <div className="prose prose-sm dark:prose-invert max-w-none pt-2 border-t border-slate-200 dark:border-slate-800">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
              rehypePlugins={[rehypeRaw, rehypeKatex]}
              components={MARKDOWN_COMPONENTS}
            >
              {resultMarkdown.replace(/\\n/g, "\n")}
            </ReactMarkdown>
          </div>
        )}

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
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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

        <p className="text-xs text-slate-400">
          💡 Dùng dữ liệu cào GỐC (chưa qua AI dịch/tổng hợp trước đó) để tránh thiên kiến cộng dồn. Kết quả AI chỉ
          mang tính tham khảo — luôn kiểm tra lại nguồn trước khi quyết định.
        </p>
      </section>
    </div>
  );
}
