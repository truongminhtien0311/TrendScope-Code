"use client";

// Quản lý Tag: danh sách + thêm mới (tên & màu & emoji) + SỬA + xóa.
// Mindmap: "Tag (Có thể tùy chỉnh, thêm/xóa)".
// Xóa tag chỉ gỡ tag khỏi các sản phẩm, KHÔNG xóa sản phẩm.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import EmojiPicker from "@/components/EmojiPicker";
import ColorPalette from "@/components/ColorPalette";

interface TagItem {
  id: number;
  name: string;
  color: string | null;
  icon: string | null;
  productCount: number;
}

export default function TagManager({ tags }: { tags: TagItem[] }) {
  const router = useRouter();
  const confirmDialog = useConfirm();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [icon, setIcon] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), color, icon: icon || undefined }),
    });
    setBusy(false);
    if (res.ok) {
      setName("");
      setIcon("");
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Thêm thất bại (tag có thể đã tồn tại).");
    }
  }

  async function remove(tag: TagItem) {
    const warn =
      tag.productCount > 0
        ? `Tag đang gắn vào ${tag.productCount} sản phẩm — xóa sẽ gỡ tag khỏi các sản phẩm đó (sản phẩm không bị xóa).`
        : "Tag chưa gắn vào sản phẩm nào.";
    if (!(await confirmDialog(`Xóa tag "${tag.name}"?\n${warn}`, { danger: true }))) return;
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
          <EmojiPicker value={icon} onChange={setIcon} />
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
        <ColorPalette value={color} onChange={setColor} />
      </form>

      {tags.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có tag nào.</p>
      ) : (
        <ul className="space-y-2">
          {tags.map((t) =>
            editingId === t.id ? (
              <EditRow key={t.id} tag={t} onDone={() => setEditingId(null)} />
            ) : (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2"
              >
                <span className="flex items-center gap-2 text-sm">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: t.color ?? "#64748b" }}
                  >
                    {t.icon ? `${t.icon} ` : ""}
                    {t.name}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{t.productCount} sản phẩm</span>
                </span>
                <span className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setEditingId(t.id)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Sửa
                  </button>
                  <button onClick={() => remove(t)} className="text-xs text-red-500 hover:underline">
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

function EditRow({ tag, onDone }: { tag: TagItem; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color ?? "#3b82f6");
  const [icon, setIcon] = useState(tag.icon ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tag.id, name: name.trim(), color, icon: icon || null }),
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
      <ColorPalette value={color} onChange={setColor} />
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
