"use client";

// Khung phân tích AI — MỖI LẦN BẤM "Tạo bằng AI" TẠO 1 BẢN MỚI (không ghi
// đè bản cũ), giữ tối đa 10 bản/sản phẩm để so sánh nhiều góc nhìn (xem
// evictOldAnalyses trong src/app/api/products/[id]/analyze/route.ts).
// Route trả response NGAY (không đợi Gemini xong) rồi xử lý nền — panel
// này disable nút + hiện đồng hồ đếm giờ THẬT (tính từ startedAt trong
// DB, không phải localStorage) khi có bản đang "PENDING", và poll 1
// endpoint nhẹ để biết khi nào xong, sống sót qua việc bấm rời trang/F5.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { notifyDone } from "@/lib/notify";

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

export default function AiAnalysisPanel({
  productId,
  analyses,
}: {
  productId: number;
  analyses: ProductAiAnalysisData[];
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<ContentFields | null>(null);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const pending = analyses.find((a) => a.status === "PENDING");
  const latestDone = analyses.find((a) => a.status === "DONE");
  const [selectedId, setSelectedId] = useState<number | undefined>(
    () => (latestDone ?? analyses[0])?.id
  );
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

  async function generate() {
    setGenerating(true);
    setError("");
    const res = await fetch(`/api/products/${productId}/analyze`, { method: "POST" });
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
      alert("Lưu thất bại, thử lại nhé.");
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
          <button
            onClick={generate}
            disabled={generateDisabled}
            className="text-xs rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5"
          >
            {generating
              ? "Đang gửi yêu cầu..."
              : pending && !isStale
                ? "⏳ Đang tạo..."
                : "✨ Tạo bằng AI"}
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
          ⚠️ Bản đang chờ này đã quá 5 phút, có thể đã bị treo (vd server khởi động lại giữa chừng) — bấm &quot;✨ Tạo
          bằng AI&quot; để thử tạo bản mới.
        </p>
      )}
      {selected?.status === "FAILED" && (
        <p className="text-sm text-red-500">❌ Bản này bị lỗi: {selected.errorMessage}</p>
      )}

      {analyses.length === 0 && !editing && (
        <p className="text-sm text-slate-400">
          Chưa tạo. Bấm &quot;✨ Tạo bằng AI&quot; — gộp toàn bộ dữ liệu của tất cả link bên
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
                      <ReactMarkdown>{selected[s.key] as string}</ReactMarkdown>
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
        💡 Dùng Google Gemini — cần bật + nhập API key trong Cài đặt &gt; API trước.
        Mục &quot;Nhập khẩu&quot; có tra cứu Google Search để lấy luật/thuế hiện hành.
        Giữ tối đa 10 bản/sản phẩm, bản cũ nhất tự bị dọn khi tạo bản thứ 11.
      </p>
    </section>
  );
}
