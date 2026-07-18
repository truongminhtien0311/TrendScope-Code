"use client";

// Nút "✏️ Sửa" + "🗑️ Xóa" trên trang chi tiết sản phẩm.
// Bấm Sửa mở form: đổi tên, mô tả, chọn ngành hàng, tick tag.
// Mindmap: "Người dùng có thể tùy chỉnh, thay đổi tên và mô tả sản phẩm".
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialogProvider";

interface Props {
  product: {
    id: number;
    name: string;
    description: string | null;
    categoryIds: number[];
    tagIds: number[];
  };
  allTags: { id: number; name: string; color: string | null; icon: string | null }[];
  allCategories: { id: number; name: string; icon: string | null }[];
  isAdmin: boolean;
}

export default function EditProductForm({ product, allTags, allCategories, isAdmin }: Props) {
  const router = useRouter();
  const confirmDialog = useConfirm();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [categoryIds, setCategoryIds] = useState<number[]>(product.categoryIds);
  const [tagIds, setTagIds] = useState<number[]>(product.tagIds);

  function toggleTag(id: number) {
    setTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  function toggleCategory(id: number) {
    setCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        categoryIds,
        tagIds,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      toast.error("Lưu thất bại, thử lại nhé.");
    }
  }

  async function remove() {
    if (
      !(await confirmDialog(
        `Xóa sản phẩm "${product.name}"?\nToàn bộ link, ảnh, đánh giá đi kèm sẽ bị xóa theo — kể cả file ảnh thật đã lưu trên máy/Drive (nếu không nơi khác còn dùng chung). Không hoàn tác được.`,
        { danger: true }
      ))
    )
      return;
    const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      toast.error("Xóa thất bại, thử lại nhé.");
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm";

  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <button
          onClick={() => setOpen(!open)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {open ? "Đóng" : "✏️ Sửa"}
        </button>
        {isAdmin && (
          <button
            onClick={remove}
            title="Xóa hẳn sản phẩm này + toàn bộ link/ảnh/đánh giá/phân tích AI đi kèm. Không hoàn tác được."
            className="rounded-lg border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 px-3 py-1.5 text-sm hover:bg-red-50 dark:hover:bg-red-950"
          >
            🗑️ Xóa
          </button>
        )}
      </div>

      {open && (
        <form
          onSubmit={save}
          className="mt-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 max-w-xl"
        >
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Tên sản phẩm
            </label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Mô tả (tự viết)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Ngành hàng (gắn được nhiều)
            </label>
            <div className="flex flex-wrap gap-2">
              {allCategories.length === 0 && (
                <p className="text-xs text-slate-400">
                  Chưa có ngành hàng nào — thêm ở trang &quot;Tag &amp; Ngành hàng&quot;.
                </p>
              )}
              {allCategories.map((c) => (
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
                    onChange={() => toggleCategory(c.id)}
                    className="hidden"
                  />
                  {c.icon ? `${c.icon} ` : ""}
                  {c.name}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Tag
            </label>
            <div className="flex flex-wrap gap-2">
              {allTags.length === 0 && (
                <p className="text-xs text-slate-400">
                  Chưa có tag nào — thêm ở trang &quot;Tag &amp; Ngành hàng&quot;.
                </p>
              )}
              {allTags.map((t) => (
                <label
                  key={t.id}
                  className={`cursor-pointer text-xs px-2.5 py-1 rounded-full border transition ${
                    tagIds.includes(t.id)
                      ? "text-white border-transparent"
                      : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                  }`}
                  style={tagIds.includes(t.id) ? { backgroundColor: t.color ?? "#64748b" } : {}}
                >
                  <input
                    type="checkbox"
                    checked={tagIds.includes(t.id)}
                    onChange={() => toggleTag(t.id)}
                    className="hidden"
                  />
                  {t.icon ? `${t.icon} ` : ""}
                  {t.name}
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 text-sm"
          >
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </form>
      )}
    </div>
  );
}
