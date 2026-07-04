"use client";

// Quản lý Ngành hàng: danh sách + thêm + xóa.
// Mindmap: "Ngành hàng (Cho phép tùy chỉnh, thêm/xóa)".
// Xóa ngành hàng -> sản phẩm thuộc ngành đó về "chưa phân loại",
// KHÔNG bị xóa (database tự SetNull).
import { useState } from "react";
import { useRouter } from "next/navigation";

interface CategoryItem {
  id: number;
  name: string;
  productCount: number;
}

export default function CategoryManager({ categories }: { categories: CategoryItem[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setBusy(false);
    if (res.ok) {
      setName("");
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Thêm thất bại (ngành hàng có thể đã tồn tại).");
    }
  }

  async function remove(category: CategoryItem) {
    const warn =
      category.productCount > 0
        ? `Có ${category.productCount} sản phẩm thuộc ngành này — chúng sẽ về "chưa phân loại" (không bị xóa).`
        : "Ngành hàng chưa có sản phẩm nào.";
    if (!confirm(`Xóa ngành hàng "${category.name}"?\n${warn}`)) return;
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
        <p className="text-sm text-slate-400">Chưa có ngành hàng nào.</p>
      ) : (
        <ul className="space-y-2">
          {categories.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2"
            >
              <span className="text-sm">
                {c.name}
                <span className="text-xs text-slate-400 ml-2">{c.productCount} sản phẩm</span>
              </span>
              <button
                onClick={() => remove(c)}
                className="text-xs text-red-500 hover:underline"
              >
                Xóa
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
