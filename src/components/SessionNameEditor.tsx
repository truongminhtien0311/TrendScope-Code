"use client";

// Cho phép sửa tên phiên đánh giá ngay tại chỗ (bấm ✏️ để hiện ô nhập, Enter/Blur
// để lưu qua PATCH /api/sessions/[id]) — dùng cả ở trang phiên và trang lịch sử.
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SessionNameEditor({
  sessionId,
  name,
  fallback,
  className,
}: {
  sessionId: number;
  name: string | null;
  fallback: string;
  className?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: value }),
    });
    setSaving(false);
    setEditing(false);
    if (res.ok) router.refresh();
  }

  if (editing) {
    return (
      <input
        autoFocus
        disabled={saving}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        onClick={(e) => e.preventDefault()}
        placeholder={fallback}
        className={`bg-transparent border-b border-blue-400 outline-none ${className ?? ""}`}
      />
    );
  }

  return (
    <span className="group/name inline-flex items-center gap-1.5">
      <span className={className}>{name || fallback}</span>
      <button
        type="button"
        title="Đổi tên phiên"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setEditing(true);
        }}
        className="opacity-0 group-hover/name:opacity-60 hover:!opacity-100 transition-opacity text-xs shrink-0"
      >
        ✏️
      </button>
    </span>
  );
}
