"use client";

// Khung phân tích AI — MỖI LẦN BẤM "Tạo bằng AI" TẠO 1 BẢN MỚI (không ghi
// đè bản cũ), giữ tối đa 10 bản/sản phẩm để so sánh nhiều góc nhìn (xem
// evictOldAnalyses trong src/app/api/products/[id]/analyze/route.ts).
// Route trả response NGAY (không đợi Gemini xong) rồi xử lý nền — panel
// này disable nút + hiện đồng hồ đếm giờ THẬT (tính từ startedAt trong
// DB, không phải localStorage) khi có bản đang "PENDING", và poll 1
// endpoint nhẹ để biết khi nào xong, sống sót qua việc bấm rời trang/F5.
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { toast } from "sonner";
import { notifyDone } from "@/lib/notify";
import type { PromptPreset } from "@/lib/llm";
import SmartImage from "@/components/SmartImage";

export interface ProductAiAnalysisData {
  id: number;
  status: string; // "PENDING" | "DONE" | "FAILED"
  presetName: string | null;
  startedAt: string; // ISO
  finishedAt: string | null;
  errorMessage: string | null;
  aiSummary: string | null;
  aiAudience: string | null;
  aiChannels: string | null;
  aiCustomization: string | null;
  aiImportInfo: string | null;
  aiShipping: string | null;
  aiFeasibility: string | null;
}

type ContentFields = Pick<
  ProductAiAnalysisData,
  "aiSummary" | "aiAudience" | "aiChannels" | "aiCustomization" | "aiImportInfo" | "aiShipping" | "aiFeasibility"
>;

const SECTIONS: { key: keyof ContentFields; icon: string; label: string; placeholder: string }[] = [
  {
    key: "aiSummary",
    icon: "🤖",
    label: "Mô tả tổng hợp",
    placeholder: "Gộp mô tả + đánh giá từ tất cả link nguồn.",
  },
  {
    key: "aiAudience",
    icon: "🎯",
    label: "Tệp khách hàng mục tiêu",
    placeholder: "Độ tuổi, giới tính, insight, vấn đề giải quyết, use case mở rộng.",
  },
  {
    key: "aiChannels",
    icon: "📣",
    label: "Kênh bán hàng & hướng tiếp thị",
    placeholder: "Cửa hàng offline, TikTok, Shopee... — hướng tiếp cận khách hàng theo từng kênh.",
  },
  {
    key: "aiCustomization",
    icon: "💡",
    label: "Gợi ý tùy chỉnh sản phẩm",
    placeholder: "Ý tưởng cụ thể cho sản phẩm này, từ đơn giản tới tạo hiệu ứng \"wow\".",
  },
  {
    key: "aiImportInfo",
    icon: "📦",
    label: "Nhập khẩu (HS Code, thuế, kiểm định)",
    placeholder: "Mã HS, thuế nhập khẩu, VAT, checklist giấy tờ — có tra cứu luật hiện hành.",
  },
  {
    key: "aiShipping",
    icon: "🚚",
    label: "Đóng gói & vận chuyển nội địa",
    placeholder: "Cách đóng gói phù hợp, lưu ý khi giao hàng cho khách tại Việt Nam.",
  },
  {
    key: "aiFeasibility",
    icon: "📊",
    label: "Đánh giá tính khả thi kinh doanh",
    placeholder: "Mô hình tổng kho vs tự bán online, bóc tách chi phí ẩn, chiến lược giá.",
  },
];

const STALE_MS = 5 * 60 * 1000; // quá 5 phút vẫn PENDING = có thể đã treo
const POLL_MS = 2500;

const STATUS_ICON: Record<string, string> = { PENDING: "⏳", DONE: "✅", FAILED: "❌" };

function formatVersionLabel(a: ProductAiAnalysisData): string {
  const time = new Date(a.startedAt).toLocaleString("vi-VN");
  const preset = a.presetName ?? "—";
  return `${STATUS_ICON[a.status] ?? ""} ${time} · ${preset}`;
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

export default function AiAnalysisPanel({
  productId,
  analyses,
  presets,
  activePresetId,
}: {
  productId: number;
  analyses: ProductAiAnalysisData[];
  // Danh sách preset để chọn NGAY tại nút "Tạo bằng AI" — không bắt buộc
  // vào Cài đặt đổi preset "đang dùng" trước mỗi lần muốn xem góc nhìn
  // khác (xem PromptEditor.tsx, cùng nguồn dữ liệu Setting).
  presets: PromptPreset[];
  activePresetId: string;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<ContentFields | null>(null);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [chosenPresetId, setChosenPresetId] = useState(
    presets.some((p) => p.id === activePresetId) ? activePresetId : presets[0]?.id
  );
  const [showPreview, setShowPreview] = useState(false);

  const pending = analyses.find((a) => a.status === "PENDING");
  const latestDone = analyses.find((a) => a.status === "DONE");
  const [selectedId, setSelectedId] = useState<number | undefined>(
    () => (latestDone ?? analyses[0])?.id
  );
  
  const previousLatestRef = useRef(latestDone?.id);
  useEffect(() => {
    if (latestDone?.id && latestDone.id !== previousLatestRef.current) {
      setSelectedId(latestDone.id);
      previousLatestRef.current = latestDone.id;
    }
  }, [latestDone?.id]);

  const selected = analyses.find((a) => a.id === selectedId) ?? latestDone ?? analyses[0];

  const pendingAgeMs = pending ? now - new Date(pending.startedAt).getTime() : 0;
  const isStale = pending ? pendingAgeMs > STALE_MS : false;

  // Đếm giờ real-time khi có bản đang PENDING — tick mỗi giây.
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pending]);

  // Poll trạng thái bản PENDING — dừng khi hết PENDING hoặc đã stale (đỡ
  // gọi API vô ích khi rõ ràng đã treo, người dùng tự bấm tạo lại).
  useEffect(() => {
    if (!pending || isStale) return;
    const poll = setInterval(async () => {
      const res = await fetch(`/api/products/${productId}/ai-analyses/${pending.id}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.status !== "PENDING") {
        notifyDone(data.status === "DONE" ? "Đã tạo xong phân tích AI ✨" : "Tạo phân tích AI thất bại");
        router.refresh();
      }
    }, POLL_MS);
    return () => clearInterval(poll);
  }, [pending, isStale, productId, router]);

  async function confirmGenerate() {
    setShowPreview(false);
    setGenerating(true);
    setError("");
    const res = await fetch(`/api/products/${productId}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presetId: chosenPresetId }),
    });
    setGenerating(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Tạo phân tích AI thất bại, thử lại nhé.");
    }
  }

  function startEdit() {
    if (!selected) return;
    setDrafts({
      aiSummary: selected.aiSummary,
      aiAudience: selected.aiAudience,
      aiChannels: selected.aiChannels,
      aiCustomization: selected.aiCustomization,
      aiImportInfo: selected.aiImportInfo,
      aiShipping: selected.aiShipping,
      aiFeasibility: selected.aiFeasibility,
    });
    setEditing(true);
  }

  async function save() {
    if (!selected || !drafts) return;
    setSaving(true);
    const res = await fetch(`/api/products/${productId}/ai-analyses/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(drafts),
    });
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      toast.error("Lưu thất bại, thử lại nhé.");
    }
  }

  const textareaClass =
    "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono";

  const generateDisabled = generating || (!!pending && !isStale);

  return (
    <section className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-semibold">🧠 Phân tích AI toàn diện</h2>
        <div className="flex gap-2 shrink-0 items-center flex-wrap">
          {analyses.length > 0 && (
            <select
              value={selected?.id}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5"
            >
              {analyses.map((a) => (
                <option key={a.id} value={a.id}>
                  {formatVersionLabel(a)}
                </option>
              ))}
            </select>
          )}
          {!editing && selected?.status === "DONE" && (
            <button
              onClick={startEdit}
              className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              ✏️ Sửa
            </button>
          )}
          <select
            value={chosenPresetId}
            onChange={(e) => setChosenPresetId(e.target.value)}
            disabled={generateDisabled}
            title="Chọn góc nhìn cho lần tạo tiếp theo — đổi thoải mái, không ảnh hưởng preset đang đặt mặc định trong Cài đặt"
            className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 disabled:opacity-50"
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowPreview(true)}
            disabled={generateDisabled}
            className="text-xs rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5"
          >
            {generating
              ? "Đang gửi yêu cầu..."
              : pending && !isStale
                ? "⏳ Đang tạo..."
                : "✨AI Phân tích🔍"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {pending && !isStale && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          ⏳ Đang chờ Gemini phản hồi... đã {Math.floor(pendingAgeMs / 1000)}s (có thể mất tới vài chục giây, tra
          cứu cả luật nhập khẩu) — cứ chuyển sang trang khác, quay lại vẫn thấy tiếp tục đếm.
        </p>
      )}
      {pending && isStale && (
        <p className="text-sm text-red-500">
          ⚠️ Bản đang chờ này đã quá 5 phút, có thể đã bị treo (vd server khởi động lại giữa chừng) — bấm &quot;✨AI Phân tích🔍&quot; để thử tạo bản mới.
        </p>
      )}
      {selected?.status === "FAILED" && (
        <p className="text-sm text-red-500">❌ Bản này bị lỗi: {selected.errorMessage}</p>
      )}

      {analyses.length === 0 && !editing && (
        <p className="text-sm text-slate-400">
          Chưa tạo. Bấm &quot;✨AI Phân tích🔍&quot; — gộp toàn bộ dữ liệu của tất cả link bên
          dưới (tên, ảnh, mô tả, đánh giá) vào 1 request duy nhất, sinh đủ 7 mục: mô tả,
          tệp khách hàng, kênh bán hàng, tùy chỉnh, nhập khẩu, vận chuyển, đánh giá khả thi.
          Giữ tối đa 10 bản gần nhất để so sánh nhiều góc nhìn.
        </p>
      )}

      {editing && drafts ? (
        <div className="space-y-4">
          {SECTIONS.map((s) => (
            <div key={s.key}>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                {s.icon} {s.label} (markdown)
              </label>
              <textarea
                value={drafts[s.key] ?? ""}
                onChange={(e) => setDrafts({ ...drafts, [s.key]: e.target.value })}
                rows={6}
                className={textareaClass}
              />
            </div>
          ))}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 text-sm"
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm"
            >
              Hủy
            </button>
          </div>
        </div>
      ) : (
        selected?.status === "DONE" && (
          <div className="space-y-2">
            {SECTIONS.map((s) => (
              <details key={s.key} open={s.key === "aiSummary"} className="group">
                <summary className="cursor-pointer text-sm font-medium py-1.5 flex items-center gap-2 select-none">
                  <span className="text-slate-400 group-open:rotate-90 transition-transform inline-block">
                    ▶
                  </span>
                  {s.icon} {s.label}
                </summary>
                <div className="pl-6 pb-2">
                  {selected[s.key] ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
                        rehypePlugins={[rehypeRaw, rehypeKatex]}
                        components={MARKDOWN_COMPONENTS}
                      >
                        {(selected[s.key] as string).replace(/\\n/g, "\n")}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Chưa có — {s.placeholder}</p>
                  )}
                </div>
              </details>
            ))}
          </div>
        )
      )}

      <p className="text-xs text-slate-400">
        💡 <strong>Cảnh báo:</strong> AI có thể bị lừa bởi review ảo. Các số liệu thuế/cước phí mang tính tham khảo, vui lòng đối chiếu luật hiện hành. 
        Dùng Google Gemini (cần nhập API key trong Cài đặt). Giữ tối đa 10 bản/sản phẩm.
      </p>

      {/* MODAL PREVIEW PROMPT */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-lg">Duyệt lại Prompt trước khi gửi AI</h3>
                <p className="text-sm text-slate-500">Lát cắt được chọn: <strong className="text-slate-700 dark:text-slate-300">{presets.find(p => p.id === chosenPresetId)?.name}</strong></p>
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
                  <strong className="block mb-1">Cố vấn AI — Lựa chọn lát cắt quyết định tất cả!</strong>
                  <p>Mọi thông tin AI tạo ra chỉ mang tính chất <strong>THAM KHẢO</strong> và có thể bịa đặt (hallucinate) nếu dữ liệu gốc lộn xộn. Việc bạn chọn đúng lát cắt (Prompt) phù hợp với mục đích sẽ giúp AI cho ra góc nhìn đa chiều, sắc bén và "thực chiến" nhất, tránh việc khen chê chung chung.</p>
                </div>
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-950/50 mt-4 border-t border-slate-200 dark:border-slate-800">
              <pre className="text-xs font-mono whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                {presets.find(p => p.id === chosenPresetId)?.content}
              </pre>
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
                ✨ Xác nhận tạo AI
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
