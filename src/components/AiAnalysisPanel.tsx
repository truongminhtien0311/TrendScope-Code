"use client";

// Khung phân tích AI — MỖI LẦN BẤM "Tạo bằng AI" TẠO 1 BẢN MỚI (không ghi
// đè bản cũ, không giới hạn số lượng) để so sánh nhiều góc nhìn — người
// dùng tự xóa tay bản không cần giữ nữa (nút 🗑️ ở mỗi bản DONE).
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
import { friendlyGeminiError, type PromptPreset } from "@/lib/llm";
import SmartImage from "@/components/SmartImage";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import ElapsedBadge from "@/components/ElapsedBadge";

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
    placeholder: "Mô hình tổng kho so với tự bán online, bóc tách chi phí ẩn, chiến lược giá.",
  },
];

// Màu nền + viền cho từng mục phân tích, xoay vòng theo thứ tự — giống hệt
// cách tô màu các lượt so sánh AI ở trang Lịch sử đánh giá (CompareTable.tsx)
// để 2 nơi hiển thị nhất quán, dễ nhận ra "mục nào với mục nào" khi lướt.
const RUN_HEADER_TINTS = [
  "border-blue-300 dark:border-blue-700 bg-blue-50/60 dark:bg-blue-950/30",
  "border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/30",
  "border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/30",
  "border-rose-300 dark:border-rose-700 bg-rose-50/60 dark:bg-rose-950/30",
  "border-cyan-300 dark:border-cyan-700 bg-cyan-50/60 dark:bg-cyan-950/30",
];

const CARD_TINTS = [
  "border-blue-300 dark:border-blue-700 bg-blue-50/60 dark:bg-blue-950/30",
  "border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/30",
  "border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/30",
  "border-rose-300 dark:border-rose-700 bg-rose-50/60 dark:bg-rose-950/30",
  "border-cyan-300 dark:border-cyan-700 bg-cyan-50/60 dark:bg-cyan-950/30",
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

export default function AiAnalysisPanel({
  productId,
  analyses,
  presets,
  activePresetId,
  hasFactoryPrice,
}: {
  productId: number;
  analyses: ProductAiAnalysisData[];
  // Danh sách preset để chọn NGAY tại nút "Tạo bằng AI" — không bắt buộc
  // vào Cài đặt đổi preset "đang dùng" trước mỗi lần muốn xem góc nhìn
  // khác (xem PromptEditor.tsx, cùng nguồn dữ liệu Setting).
  presets: PromptPreset[];
  activePresetId: string;
  // false = sản phẩm CHƯA có link nhà sản xuất (Alibaba/1688) nào — chỉ có
  // giá bán lẻ, AI đang phải ƯỚC TÍNH giá xưởng (xem {{PRICE_BASIS_NOTE}}
  // trong src/lib/llm/index.ts). Hiện badge cảnh báo ngay đầu panel.
  hasFactoryPrice: boolean;
}) {
  const router = useRouter();
  const confirmDialog = useConfirm();
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<ContentFields | null>(null);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [chosenPresetId, setChosenPresetId] = useState(
    presets.some((p) => p.id === activePresetId) ? activePresetId : presets[0]?.id
  );
  const [showPreview, setShowPreview] = useState(false);

  const pending = analyses.find((a) => a.status === "PENDING");
  const latestDone = analyses.find((a) => a.status === "DONE");

  // Liệt kê SẴN toàn bộ các lần phân tích AI (không chỉ 1 bản chọn qua dropdown
  // như trước) — mỗi bản là 1 dòng bấm mở ra xem, giống cách hiển thị các
  // lượt so sánh AI ở trang Lịch sử đánh giá (CompareTable.tsx). Mặc định mở
  // sẵn bản DONE mới nhất.
  const [expandedIds, setExpandedIds] = useState<Set<number>>(
    () => new Set(latestDone ? [latestDone.id] : [])
  );
  const previousLatestRef = useRef(latestDone?.id);
  useEffect(() => {
    if (latestDone?.id && latestDone.id !== previousLatestRef.current) {
      setExpandedIds((prev) => new Set(prev).add(latestDone.id));
      previousLatestRef.current = latestDone.id;
    }
  }, [latestDone?.id]);

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

  // Bản FAILED không cần giữ lại làm rác danh sách — chỉ cần báo lỗi chi
  // tiết ngay trên màn hình (toast) rồi tự xóa khỏi DB, còn lại đã có
  // logActivity ghi trong route DELETE để tra cứu sau nếu cần. Dùng ref
  // đánh dấu id đã xử lý để không xóa lặp khi effect chạy lại (StrictMode,
  // re-render khác nguyên nhân).
  const cleanedFailedIds = useRef<Set<number>>(new Set());
  useEffect(() => {
    const failed = analyses.filter((a) => a.status === "FAILED" && !cleanedFailedIds.current.has(a.id));
    if (!failed.length) return;
    (async () => {
      for (const a of failed) {
        cleanedFailedIds.current.add(a.id);
        toast.error(`❌ Phân tích AI lỗi: ${friendlyGeminiError(a.errorMessage)}`);
        await fetch(`/api/products/${productId}/ai-analyses/${a.id}`, { method: "DELETE" }).catch(() => {});
      }
      router.refresh();
    })();
  }, [analyses, productId, router]);

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
      setError(data?.error ?? "Tạo phân tích AI thất bại, vui lòng thử lại.");
    }
  }

  function startEdit(a: ProductAiAnalysisData) {
    setDrafts({
      aiSummary: a.aiSummary,
      aiAudience: a.aiAudience,
      aiChannels: a.aiChannels,
      aiCustomization: a.aiCustomization,
      aiImportInfo: a.aiImportInfo,
      aiShipping: a.aiShipping,
      aiFeasibility: a.aiFeasibility,
    });
    setEditingId(a.id);
  }

  async function save() {
    if (!editingId || !drafts) return;
    setSaving(true);
    const res = await fetch(`/api/products/${productId}/ai-analyses/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(drafts),
    });
    setSaving(false);
    if (res.ok) {
      setEditingId(null);
      router.refresh();
    } else {
      toast.error("Lưu thất bại, vui lòng thử lại.");
    }
  }

  async function deleteAnalysis(a: ProductAiAnalysisData) {
    const ok = await confirmDialog(
      `Xóa bản phân tích AI này (${formatVersionLabel(a)})? Không thể hoàn tác.`,
      { danger: true }
    );
    if (!ok) return;
    setDeletingId(a.id);
    const res = await fetch(`/api/products/${productId}/ai-analyses/${a.id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Xóa thất bại, vui lòng thử lại.");
    }
  }

  const textareaClass =
    "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono";

  const generateDisabled = generating || (!!pending && !isStale);

  return (
    <section className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-semibold">
          🧠 Phân tích AI toàn diện{analyses.length > 0 && ` (${analyses.length} bản)`}
        </h2>
        <div className="flex gap-2 shrink-0 items-center flex-wrap">
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
            {generating ? (
              "Đang gửi yêu cầu..."
            ) : pending && !isStale ? (
              <span className="inline-flex items-center gap-1.5">
                ⏳ Đang tạo...
                <ElapsedBadge seconds={Math.floor(pendingAgeMs / 1000)} />
              </span>
            ) : (
              "✨AI Phân tích🔍"
            )}
          </button>
        </div>
      </div>

      {!hasFactoryPrice && (
        <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          ⚠️ Sản phẩm chưa có link nhà sản xuất (Alibaba/1688) — AI đang phải <strong>ước tính</strong> giá
          xưởng dựa trên giá bán lẻ, có thể sai lệch so với thực tế. Thêm link nhà sản xuất hoặc kiểm tra
          tỷ lệ markup ngành hàng trong Cài đặt để phân tích lợi nhuận chính xác hơn.
        </p>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {pending && !isStale && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          ⏳ Đang chờ Gemini phản hồi (có thể mất tới vài chục giây, tra cứu cả luật nhập khẩu) — cứ chuyển sang
          trang khác, quay lại vẫn thấy nút &quot;⏳ Đang tạo...&quot; tiếp tục đếm.
        </p>
      )}
      {pending && isStale && (
        <p className="text-sm text-red-500">
          ⚠️ Bản đang chờ này đã quá 5 phút, có thể đã bị treo (vd server khởi động lại giữa chừng) — bấm &quot;✨AI Phân tích🔍&quot; để thử tạo bản mới.
        </p>
      )}

      {analyses.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Chưa tạo. Bấm &quot;✨AI Phân tích🔍&quot; — gộp toàn bộ dữ liệu của tất cả link bên
          dưới (tên, ảnh, mô tả, đánh giá) vào 1 request duy nhất, sinh đủ 7 mục: mô tả,
          tệp khách hàng, kênh bán hàng, tùy chỉnh, nhập khẩu, vận chuyển, đánh giá khả thi.
          Có thể tạo nhiều bản để so sánh nhiều góc nhìn khác nhau.
        </p>
      )}

      {/* Liệt kê TOÀN BỘ các lần phân tích AI — mỗi bản 1 dòng bấm mở ra xem,
          màu xoay vòng theo thứ tự, giống hệt cách hiển thị các lượt so sánh
          AI ở trang Lịch sử đánh giá (xem CompareTable.tsx). */}
      {analyses.length > 0 && (
        <div className="space-y-3">
          {analyses.map((a, runIndex) => {
            const isExpanded = expandedIds.has(a.id);
            const isEditing = editingId === a.id;
            return (
              <div
                key={a.id}
                className={`rounded-lg border-2 p-3 ${
                  a.status === "FAILED"
                    ? "border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-950/20"
                    : RUN_HEADER_TINTS[runIndex % RUN_HEADER_TINTS.length]
                }`}
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleExpanded(a.id)}
                    className="flex-1 flex items-center gap-2 text-left font-bold text-base"
                  >
                    <span>{formatVersionLabel(a)}</span>
                  </button>
                  {!isEditing && a.status === "DONE" && (
                    <button
                      onClick={() => startEdit(a)}
                      className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1 hover:bg-white dark:hover:bg-slate-800 shrink-0"
                    >
                      ✏️ Sửa
                    </button>
                  )}
                  {!isEditing && a.status === "DONE" && (
                    <button
                      onClick={() => deleteAnalysis(a)}
                      disabled={deletingId === a.id}
                      title="Xóa bản phân tích này"
                      className="text-xs rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 px-2.5 py-1 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 shrink-0"
                    >
                      {deletingId === a.id ? "Đang xóa..." : "🗑️"}
                    </button>
                  )}
                  <button
                    onClick={() => toggleExpanded(a.id)}
                    className="text-sm text-slate-500 dark:text-slate-400 shrink-0"
                  >
                    {isExpanded ? "▲" : "▼"}
                  </button>
                </div>

                {a.status === "FAILED" && isExpanded && (
                  <p className="text-sm text-red-500 mt-2">❌ Bản này bị lỗi: {friendlyGeminiError(a.errorMessage)}</p>
                )}

                {isEditing && drafts ? (
                  <div className="space-y-4 mt-3">
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
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm bg-white dark:bg-slate-900"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  a.status === "DONE" &&
                  isExpanded && (
                    <div className="space-y-3 mt-3">
                      {SECTIONS.map((s, i) => (
                        <details
                          key={s.key}
                          open={s.key === "aiSummary"}
                          className={`group rounded-lg border-2 p-3 ${CARD_TINTS[i % CARD_TINTS.length]}`}
                        >
                          <summary className="cursor-pointer text-base font-bold py-0.5 flex items-center gap-2 select-none">
                            <span className="text-slate-500 dark:text-slate-400 group-open:rotate-90 transition-transform inline-block">
                              ▶
                            </span>
                            <span className="text-xl">{s.icon}</span> {s.label}
                          </summary>
                          <div className="pl-6 pt-2">
                            {a[s.key] ? (
                              <div className="prose prose-sm dark:prose-invert max-w-none">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
                                  rehypePlugins={[rehypeRaw, rehypeKatex]}
                                  components={MARKDOWN_COMPONENTS}
                                >
                                  {(a[s.key] as string).replace(/\\n/g, "\n")}
                                </ReactMarkdown>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có — {s.placeholder}</p>
                            )}
                          </div>
                        </details>
                      ))}
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        💡 <strong>Cảnh báo:</strong> AI có thể bị lừa bởi review ảo. Các số liệu thuế/cước phí mang tính tham khảo, vui lòng đối chiếu luật hiện hành.
        Dùng Google Gemini (cần nhập API key trong Cài đặt). Không giới hạn số bản — tự xóa tay bản không cần giữ.
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
                className="text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
