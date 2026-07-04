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

// Bảng màu dựng sẵn — đủ đa dạng, phối hợp đẹp mắt, thay cho việc bắt
// người dùng tự mò mã hex. "Màu khác" bên dưới vẫn mở ra ô chọn tự do.
const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#d946ef", "#ec4899", "#64748b",
];

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [customOpen, setCustomOpen] = useState(!PRESET_COLORS.includes(value));

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5 max-w-[220px]">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              onChange(c);
              setCustomOpen(false);
            }}
            className={`w-6 h-6 rounded-full border-2 ${
              value === c && !customOpen ? "border-slate-900 dark:border-white" : "border-transparent"
            }`}
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
        <button
          type="button"
          onClick={() => setCustomOpen(true)}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] bg-[conic-gradient(from_0deg,red,yellow,lime,cyan,blue,magenta,red)] ${
            customOpen ? "border-slate-900 dark:border-white" : "border-transparent"
          }`}
          title="Màu khác"
        />
      </div>
      {customOpen && (
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-12 rounded cursor-pointer border border-slate-300 dark:border-slate-700 bg-transparent"
          title="Chọn màu tùy ý"
        />
      )}
    </div>
  );
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
      <form onSubmit={add} className="space-y-2">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên tag mới..."
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 text-sm whitespace-nowrap"
          >
            + Thêm
          </button>
        </div>
        <ColorPicker value={color} onChange={setColor} />
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
