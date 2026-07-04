"use client";

// Khung phân tích AI — MỘT khung duy nhất cho cả sản phẩm (không tách
// theo từng link), gồm ĐỦ 7 mục sinh ra trong 1 request Gemini:
//   A. Mô tả tổng hợp       B. Tệp khách hàng mục tiêu
//   C. Kênh bán hàng & tiếp thị    D. Gợi ý tùy chỉnh sản phẩm
//   E. Nhập khẩu (HS Code/thuế/kiểm định)
//   F. Đóng gói & vận chuyển nội địa   G. Đánh giá khả thi kinh doanh
// Có nút tạo bằng AI và cho phép sửa tay từng mục (mindmap: "Cho phép
// chỉnh sửa đoạn AI"). Mỗi mục thu gọn được (details/summary) vì nội
// dung khá dài.
import { useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { notifyDone } from "@/lib/notify";

export interface AiFields {
  aiSummary: string | null;
  aiAudience: string | null;
  aiChannels: string | null;
  aiCustomization: string | null;
  aiImportInfo: string | null;
  aiShipping: string | null;
  aiFeasibility: string | null;
}

const SECTIONS: { key: keyof AiFields; icon: string; label: string; placeholder: string }[] = [
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

export default function AiAnalysisPanel({
  productId,
  fields,
}: {
  productId: number;
  fields: AiFields;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<AiFields>(fields);
  const [saving, setSaving] = useState(false);

  const hasAnyContent = SECTIONS.some((s) => fields[s.key]);

  async function generate() {
    setGenerating(true);
    setError("");
    const res = await fetch(`/api/products/${productId}/analyze`, { method: "POST" });
    setGenerating(false);
    if (res.ok) {
      notifyDone("Đã tạo xong phân tích AI ✨");
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Tạo phân tích AI thất bại, thử lại nhé.");
    }
  }

  function startEdit() {
    setDrafts(fields);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/products/${productId}`, {
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

  return (
    <section className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">🧠 Phân tích AI toàn diện</h2>
        <div className="flex gap-2 shrink-0">
          {!editing && hasAnyContent && (
            <button
              onClick={startEdit}
              className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              ✏️ Sửa
            </button>
          )}
          <button
            onClick={generate}
            disabled={generating}
            className="text-xs rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5"
          >
            {generating ? "Đang tạo (mất chút thời gian, tra cứu cả luật)..." : "✨ Tạo bằng AI"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {!hasAnyContent && !editing && (
        <p className="text-sm text-slate-400">
          Chưa tạo. Bấm &quot;✨ Tạo bằng AI&quot; — gộp toàn bộ dữ liệu của tất cả link bên
          dưới (tên, ảnh, mô tả, đánh giá) vào 1 request duy nhất, sinh đủ 6 mục: mô tả,
          tệp khách hàng, kênh bán hàng, thông tin nhập khẩu, vận chuyển, đánh giá khả thi.
        </p>
      )}

      {editing ? (
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
        hasAnyContent && (
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
                  {fields[s.key] ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{fields[s.key] as string}</ReactMarkdown>
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
      </p>
    </section>
  );
}
