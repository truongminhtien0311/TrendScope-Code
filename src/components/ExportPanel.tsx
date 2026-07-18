"use client";

// Chọn trường + định dạng (CSV/Excel), lọc theo tag/ngành hàng, tải file
// về máy. Chỉ dùng metadata từ "@/lib/export/fields" (không kéo theo
// Prisma) — logic lấy giá trị thật nằm ở server (src/app/api/export).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FIELD_METADATA, DEFAULT_EXPORT_FIELDS } from "@/lib/export/fields";

interface Props {
  categories: { id: number; name: string; icon: string | null }[];
  tags: { id: number; name: string; color: string | null; icon: string | null }[];
}

const GROUPS = [...new Set(FIELD_METADATA.map((f) => f.group))];

export default function ExportPanel({ categories, tags }: Props) {
  const router = useRouter();
  const [selectedFields, setSelectedFields] = useState<string[]>(DEFAULT_EXPORT_FIELDS);
  const [format, setFormat] = useState<"csv" | "xlsx">("xlsx");
  const [richFormat, setRichFormat] = useState(true);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  function toggleField(key: string) {
    setSelectedFields((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));
  }

  function toggleId(list: number[], setList: (v: number[]) => void, id: number) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function doExport() {
    if (selectedFields.length === 0) {
      setError("Chọn ít nhất 1 trường muốn xuất.");
      return;
    }
    setError("");
    setExporting(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          fields: selectedFields,
          categoryIds: categoryIds.length ? categoryIds : undefined,
          tagIds: tagIds.length ? tagIds : undefined,
          richFormat: format === "xlsx" ? richFormat : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Xuất file thất bại.");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+)"/);
      const fileName = match?.[1] ?? `san-pham.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
        <h2 className="font-semibold">Chọn trường muốn xuất</h2>
        {GROUPS.map((group) => (
          <div key={group}>
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">{group}</h3>
            <div className="flex flex-wrap gap-2">
              {FIELD_METADATA.filter((f) => f.group === group).map((f) => (
                <label
                  key={f.key}
                  className={`cursor-pointer text-xs px-2.5 py-1 rounded-full border transition ${
                    selectedFields.includes(f.key)
                      ? "bg-blue-600 text-white border-transparent"
                      : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(f.key)}
                    onChange={() => toggleField(f.key)}
                    className="hidden"
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
        <h2 className="font-semibold">Lọc theo (tùy chọn)</h2>
        <div>
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Ngành hàng</h3>
          <div className="flex flex-wrap gap-2">
            {categories.length === 0 && <p className="text-xs text-slate-500 dark:text-slate-400">Chưa có ngành hàng nào.</p>}
            {categories.map((c) => (
              <label
                key={c.id}
                className={`cursor-pointer text-xs px-2.5 py-1 rounded-full border transition ${
                  categoryIds.includes(c.id)
                    ? "bg-blue-600 text-white border-transparent"
                    : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={categoryIds.includes(c.id)}
                  onChange={() => toggleId(categoryIds, setCategoryIds, c.id)}
                  className="hidden"
                />
                {c.icon ? `${c.icon} ` : ""}
                {c.name}
              </label>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Tag</h3>
          <div className="flex flex-wrap gap-2">
            {tags.length === 0 && <p className="text-xs text-slate-500 dark:text-slate-400">Chưa có tag nào.</p>}
            {tags.map((t) => (
              <label
                key={t.id}
                className={`cursor-pointer text-xs px-2.5 py-1 rounded-full border transition ${
                  tagIds.includes(t.id) ? "text-white border-transparent" : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                }`}
                style={tagIds.includes(t.id) ? { backgroundColor: t.color ?? "#64748b" } : {}}
              >
                <input
                  type="checkbox"
                  checked={tagIds.includes(t.id)}
                  onChange={() => toggleId(tagIds, setTagIds, t.id)}
                  className="hidden"
                />
                {t.icon ? `${t.icon} ` : ""}
                {t.name}
              </label>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Không chọn gì = xuất toàn bộ sản phẩm.</p>
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <h2 className="font-semibold">Định dạng</h2>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" checked={format === "xlsx"} onChange={() => setFormat("xlsx")} />
            Excel (.xlsx)
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" checked={format === "csv"} onChange={() => setFormat("csv")} />
            CSV
          </label>
        </div>
        {format === "xlsx" && (
          <label className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={richFormat} onChange={(e) => setRichFormat(e.target.checked)} />
            Chèn ảnh + tô màu theo ngành hàng (chậm hơn 1 chút vì phải tải từng ảnh)
          </label>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={doExport}
            disabled={exporting}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium"
          >
            {exporting ? "Đang xuất..." : "📤 Xuất file"}
          </button>
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams();
              if (categoryIds.length) params.set("categoryIds", categoryIds.join(","));
              if (tagIds.length) params.set("tagIds", tagIds.join(","));
              router.push(`/catalogue?${params.toString()}`);
            }}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            🖼 Xem dạng Catalogue
          </button>
        </div>
      </section>
    </div>
  );
}
