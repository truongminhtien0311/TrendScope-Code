"use client";

// Đặt tên cho máy này (vd "PC nhà", "PC công ty") — chỉ để hiển thị/tham
// khảo trong Log hoạt động và siêu dữ liệu file đồng bộ, giúp biết dữ
// liệu/thao tác đến từ máy nào khi dùng nhiều máy. KHÔNG dùng để chống
// trùng sản phẩm (vẫn dựa vào Product.uuid) — xem src/lib/sync/index.ts.
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeviceLabelForm({
  currentLabel,
  isAdmin,
}: {
  currentLabel: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(currentLabel);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "device_label", value: label.trim() }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span>{currentLabel || "(chưa đặt tên)"}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">(chỉ admin sửa được)</span>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="vd: PC nhà"
        className="w-48 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm"
      />
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 text-sm"
      >
        {saved ? "✓ Đã lưu" : saving ? "Đang lưu..." : "Lưu"}
      </button>
    </form>
  );
}
