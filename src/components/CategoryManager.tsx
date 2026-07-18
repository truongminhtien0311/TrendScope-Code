"use client";

// Quản lý Ngành hàng: danh sách + thêm + SỬA + xóa.
// Mindmap: "Ngành hàng (Cho phép tùy chỉnh, thêm/xóa)".
// Xóa ngành hàng -> sản phẩm thuộc ngành đó về "chưa phân loại",
// KHÔNG bị xóa (database tự SetNull).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import EmojiPicker from "@/components/EmojiPicker";

interface CategoryItem {
  id: number;
  name: string;
  icon: string | null;
  productCount: number;
}

export default function CategoryManager({ categories }: { categories: CategoryItem[] }) {
  const router = useRouter();
  const confirmDialog = useConfirm();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), icon: icon || undefined }),
    });
    setBusy(false);
    if (res.ok) {
      setName("");
      setIcon("");
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Thêm thất bại (ngành hàng có thể đã tồn tại).");
    }
  }

  async function remove(category: CategoryItem) {
    const warn =
      category.productCount > 0
        ? `Có ${category.productCount} sản phẩm thuộc ngành này — chúng sẽ về "chưa phân loại" (không bị xóa).`
        : "Ngành hàng chưa có sản phẩm nào.";
    if (!(await confirmDialog(`Xóa ngành hàng "${category.name}"?\n${warn}`, { danger: true }))) return;
    await fetch("/api/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: category.id }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <form onSubmit={add} className="flex gap-2">
        <EmojiPicker value={icon} onChange={setIcon} />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên ngành hàng mới..."
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 text-sm whitespace-nowrap"
        >
          + Thêm
        </button>
      </form>

      {categories.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có ngành hàng nào.</p>
      ) : (
        <ul className="space-y-2">
          {categories.map((c) =>
            editingId === c.id ? (
              <EditRow key={c.id} category={c} onDone={() => setEditingId(null)} />
            ) : (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2"
              >
                <span className="text-sm">
                  {c.icon ? `${c.icon} ` : ""}
                  {c.name}
                  <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">{c.productCount} sản phẩm</span>
                </span>
                <span className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setEditingId(c.id)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Sửa
                  </button>
                  <button onClick={() => remove(c)} className="text-xs text-red-500 hover:underline">
                    Xóa
                  </button>
                </span>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}

function EditRow({ category, onDone }: { category: CategoryItem; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(category.name);
  const [icon, setIcon] = useState(category.icon ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: category.id, name: name.trim(), icon: icon || null }),
    });
    setSaving(false);
    if (res.ok) {
      onDone();
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Lưu thất bại.");
    }
  }

  return (
    <li className="rounded-lg border border-blue-300 dark:border-blue-700 px-3 py-2 space-y-2">
      <div className="flex gap-2">
        <EmojiPicker value={icon} onChange={setIcon} />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 text-xs"
        >
          {saving ? "Đang lưu..." : "Lưu"}
        </button>
        <button
          onClick={onDone}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs"
        >
          Hủy
        </button>
      </div>
    </li>
  );
}
