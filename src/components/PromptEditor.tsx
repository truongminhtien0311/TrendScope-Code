"use client";

// Sửa Prompt gửi cho AI khi tạo mô tả sản phẩm — mỗi người dùng cần
// khai thác dữ liệu khác nhau, nên thay vì chỉ có 1 prompt để sửa từng
// lần, cho phép lưu NHIỀU preset đặt tên riêng (tự thêm/xóa/đổi tên
// thoải mái, không giới hạn số lượng) và chọn 1 preset "đang dùng" cho
// lần "Tạo bằng AI" tiếp theo ở trang sản phẩm.
// Phần dữ liệu thật ({{PRODUCT_NAME}}, {{LISTINGS_DATA}}...) do app tự
// điền, người dùng chỉ sửa phần hướng dẫn/yêu cầu xung quanh — placeholder
// phải giữ nguyên trong MỌI preset, xóa đi thì AI sẽ thiếu dữ liệu.
//
// 3 nhóm hành động tách biệt:
//   - Gõ tên/nội dung: chỉ ở state cục bộ, bấm "Lưu nội dung" mới lưu
//   - Thêm/xóa preset, khôi phục nội dung gốc: lưu ngay lập tức
//   - "⭐ Đặt làm mặc định đang dùng": lưu ngay lập tức (chỉ đổi preset
//     nào được dùng khi bấm "Tạo bằng AI", không đụng nội dung preset)
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import type { PromptPreset } from "@/lib/llm";

const PLACEHOLDERS = [
  "{{PRODUCT_NAME}}",
  "{{USER_DESCRIPTION}}",
  "{{LISTINGS_DATA}}",
  "{{IMAGE_URLS}}",
  "{{COST_ASSUMPTIONS}}",
];

export default function PromptEditor({
  presets: initialPresets,
  activePresetId: initialActiveId,
  defaultPresets,
  isAdmin,
}: {
  presets: PromptPreset[];
  activePresetId: string;
  defaultPresets: PromptPreset[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const confirmDialog = useConfirm();
  const [presets, setPresets] = useState<PromptPreset[]>(initialPresets);
  const [activeId, setActiveId] = useState(initialActiveId);
  const [selectedId, setSelectedId] = useState(
    initialPresets.some((p) => p.id === initialActiveId) ? initialActiveId : initialPresets[0].id
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const selected = presets.find((p) => p.id === selectedId) ?? presets[0];
  const matchingDefault = defaultPresets.find((p) => p.id === selected.id);

  async function persist(nextPresets: PromptPreset[], nextActiveId: string) {
    setBusy(true);
    await Promise.all([
      fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "ai_prompt_presets", value: JSON.stringify(nextPresets) }),
      }),
      fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "ai_prompt_active_preset_id", value: nextActiveId }),
      }),
    ]);
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  function updateSelected(patch: Partial<PromptPreset>) {
    setPresets(presets.map((p) => (p.id === selectedId ? { ...p, ...patch } : p)));
  }

  function saveContent() {
    persist(presets, activeId);
  }

  function setActive(id: string) {
    setActiveId(id);
    persist(presets, id);
  }

  function addPreset() {
    const fresh: PromptPreset = {
      id: crypto.randomUUID(),
      name: "Prompt mới",
      content: selected.content,
    };
    const next = [...presets, fresh];
    setPresets(next);
    setSelectedId(fresh.id);
    persist(next, activeId);
  }

  async function removePreset() {
    if (presets.length <= 1) {
      toast.error("Phải giữ lại ít nhất 1 prompt.");
      return;
    }
    if (!(await confirmDialog(`Xóa prompt "${selected.name}"? Không khôi phục lại được.`, { danger: true })))
      return;
    const next = presets.filter((p) => p.id !== selected.id);
    const nextActiveId = activeId === selected.id ? next[0].id : activeId;
    setPresets(next);
    setSelectedId(next[0].id);
    setActiveId(nextActiveId);
    persist(next, nextActiveId);
  }

  async function restoreDefaultContent() {
    if (!matchingDefault) return;
    if (!(await confirmDialog(`Khôi phục "${selected.name}" về nội dung gốc? Nội dung đang sửa sẽ mất.`)))
      return;
    const next = presets.map((p) => (p.id === selected.id ? matchingDefault : p));
    setPresets(next);
    persist(next, activeId);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm"
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.id === activeId ? " ⭐ (đang dùng)" : ""}
            </option>
          ))}
        </select>

        {selected.id === activeId ? (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            ⭐ Đang dùng cho lần &quot;Tạo bằng AI&quot; tiếp theo
          </span>
        ) : isAdmin ? (
          <button
            type="button"
            onClick={() => setActive(selected.id)}
            disabled={busy}
            className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            ⭐ Đặt làm mặc định đang dùng
          </button>
        ) : null}

        {!isAdmin && <span className="text-xs text-slate-400">(chỉ admin sửa được)</span>}

        {isAdmin && (
          <>
            <button
              type="button"
              onClick={addPreset}
              disabled={busy}
              className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              + Thêm prompt mới
            </button>
            <button
              type="button"
              onClick={removePreset}
              disabled={busy}
              className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 text-red-500"
            >
              🗑️ Xóa prompt này
            </button>
          </>
        )}
      </div>

      <input
        value={selected.name}
        onChange={(e) => updateSelected({ name: e.target.value })}
        readOnly={!isAdmin}
        placeholder="Tên prompt (vd: Tập trung Marketing)"
        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
      />

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Giữ nguyên các placeholder{" "}
        {PLACEHOLDERS.map((p) => (
          <code key={p} className="bg-slate-100 dark:bg-slate-800 rounded px-1 mx-0.5">
            {p}
          </code>
        ))}{" "}
        — app tự điền dữ liệu thật vào đúng chỗ đó, xóa đi thì AI sẽ thiếu dữ liệu.
      </p>
      <textarea
        value={selected.content}
        onChange={(e) => updateSelected({ content: e.target.value })}
        readOnly={!isAdmin}
        rows={16}
        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono"
      />
      {isAdmin && (
        <div className="flex gap-2">
          <button
            onClick={saveContent}
            disabled={busy}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 text-sm"
          >
            {saved ? "✓ Đã lưu" : busy ? "Đang lưu..." : "Lưu nội dung"}
          </button>
          {matchingDefault && (
            <button
              onClick={restoreDefaultContent}
              disabled={busy}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              ↩️ Khôi phục nội dung gốc
            </button>
          )}
        </div>
      )}
      {isAdmin && !matchingDefault && (
        <p className="text-xs text-slate-400">
          💡 Prompt này do bạn tự tạo nên không có bản gốc để khôi phục.
        </p>
      )}
    </div>
  );
}
