"use client";

// Nút "✏️ Sửa" trên mỗi listing — mở form sửa tay các trường: tên,
// người bán, mô tả, lượt bán, URL, nhóm nguồn/sàn. Dùng khi API cào
// sai/lỗi, hoặc bổ sung dữ liệu cho link nhập tay (mindmap: mọi trường
// phải sửa được). Bản dịch tiếng Việt tự điền khi chạy "Phân tích AI"
// (gộp chung 1 request, không còn nút dịch riêng lẻ tốn API).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const PLATFORM_SUGGESTIONS = ["Taobao", "Tmall", "JD.com", "Alibaba.com", "1688.com"];

export interface EditableListingFields {
  id: number;
  sourceType: string;
  platform: string;
  titleOriginal: string | null;
  titleVi: string | null;
  sellerName: string | null;
  descriptionOriginal: string | null;
  descriptionVi: string | null;
  soldTotal: number | null;
  soldMonthly: number | null;
  url: string;
}

export default function EditListingForm({ listing }: { listing: EditableListingFields }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    sourceType: listing.sourceType,
    platform: listing.platform,
    titleOriginal: listing.titleOriginal ?? "",
    titleVi: listing.titleVi ?? "",
    sellerName: listing.sellerName ?? "",
    descriptionOriginal: listing.descriptionOriginal ?? "",
    descriptionVi: listing.descriptionVi ?? "",
    soldTotal: listing.soldTotal?.toString() ?? "",
    soldMonthly: listing.soldMonthly?.toString() ?? "",
    url: listing.url,
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/listings/${listing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceType: form.sourceType,
        platform: form.platform.trim() || listing.platform,
        titleOriginal: form.titleOriginal.trim() || null,
        titleVi: form.titleVi.trim() || null,
        sellerName: form.sellerName.trim() || null,
        descriptionOriginal: form.descriptionOriginal.trim() || null,
        descriptionVi: form.descriptionVi.trim() || null,
        soldTotal: form.soldTotal.trim() ? Number(form.soldTotal) : null,
        soldMonthly: form.soldMonthly.trim() ? Number(form.soldMonthly) : null,
        url: form.url.trim() || listing.url,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      toast.error("Lưu thất bại, vui lòng thử lại.");
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm";

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs px-2 py-1 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
      >
        {open ? "Đóng" : "✏️ Sửa"}
      </button>

      {open && (
        <form
          onSubmit={save}
          className="mt-2 space-y-2 rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-left"
        >
          <datalist id={`platform-suggestions-${listing.id}`}>
            {PLATFORM_SUGGESTIONS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>

          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Nhóm nguồn</label>
              <select
                value={form.sourceType}
                onChange={(e) => setForm({ ...form, sourceType: e.target.value })}
                className={inputClass}
              >
                <option value="RETAIL">🛍️ Shop bán lẻ</option>
                <option value="MANUFACTURER">🏭 Nhà sản xuất</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Sàn/nguồn</label>
              <input
                list={`platform-suggestions-${listing.id}`}
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className={inputClass}
              />
            </div>
            <Field label="URL" value={form.url} onChange={(v) => setForm({ ...form, url: v })} cls={inputClass} />
            <Field label="Người bán/shop" value={form.sellerName} onChange={(v) => setForm({ ...form, sellerName: v })} cls={inputClass} />
            <Field label="Tổng đã bán" value={form.soldTotal} onChange={(v) => setForm({ ...form, soldTotal: v })} cls={inputClass} type="number" />
            <Field label="Bán trong tháng" value={form.soldMonthly} onChange={(v) => setForm({ ...form, soldMonthly: v })} cls={inputClass} type="number" />
          </div>

          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Tên gốc</label>
            <input
              value={form.titleOriginal}
              onChange={(e) => setForm({ ...form, titleOriginal: e.target.value })}
              className={inputClass}
            />
          </div>
          <Field label="Tên tiếng Việt" value={form.titleVi} onChange={(v) => setForm({ ...form, titleVi: v })} cls={inputClass} />

          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Mô tả gốc</label>
            <textarea
              value={form.descriptionOriginal}
              onChange={(e) => setForm({ ...form, descriptionOriginal: e.target.value })}
              rows={2}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Mô tả tiếng Việt</label>
            <textarea
              value={form.descriptionVi}
              onChange={(e) => setForm({ ...form, descriptionVi: e.target.value })}
              rows={2}
              className={inputClass}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 text-sm"
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm"
            >
              Hủy
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  cls,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  cls: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
    </div>
  );
}
