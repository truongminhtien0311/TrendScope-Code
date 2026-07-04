"use client";

// Quản lý Tag: danh sách + thêm mới (tên & màu) + xóa.
// Mindmap: "Tag (Có thể tùy chỉnh, thêm/xóa)".
// Xóa tag chỉ gỡ tag khỏi các sản phẩm, KHÔNG xóa sản phẩm.
import { useState } from "react";
import { useRouter } from "next/navigation";

interface TagItem {
  id: number;
  name: string;
  color: string | null;
  productCount: number;
}

export default function TagManager({ tags }: { tags: TagItem[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), color }),
    });
    setBusy(false);
    if (res.ok) {
      setName("");
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Thêm thất bại (tag có thể đã tồn tại).");
    }
  }

  async function remove(tag: TagItem) {
    const warn =
      tag.productCount > 0
        ? `Tag đang gắn vào ${tag.productCount} sản phẩm — xóa sẽ gỡ tag khỏi các sản phẩm đó (sản phẩm không bị xóa).`
        : "Tag chưa gắn vào sản phẩm nào.";
    if (!confirm(`Xóa tag "${tag.name}"?\n${warn}`)) return;
    await fetch("/api/tags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tag.id }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <form onSubmit={add} className="flex gap-2 items-center">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên tag mới..."
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
        />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-9 w-10 rounded cursor-pointer border border-slate-300 dark:border-slate-700 bg-transparent"
          title="Chọn màu tag"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 text-sm whitespace-nowrap"
        >
          + Thêm
        </button>
      </form>

      {tags.length === 0 ? (
        <p className="text-sm text-slate-400">Chưa có tag nào.</p>
      ) : (
        <ul className="space-y-2">
          {tags.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2"
            >
              <span className="flex items-center gap-2 text-sm">
                <span
                  className="text-xs px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: t.color ?? "#64748b" }}
                >
                  {t.name}
                </span>
                <span className="text-xs text-slate-400">
                  {t.productCount} sản phẩm
                </span>
              </span>
              <button
                onClick={() => remove(t)}
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
