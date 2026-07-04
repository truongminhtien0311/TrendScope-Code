"use client";

// Sửa Prompt gửi cho AI khi tạo mô tả sản phẩm — mỗi người dùng cần
// khai thác dữ liệu khác nhau, không nhất thiết chạy theo mẫu cố định.
// Phần dữ liệu thật ({{PRODUCT_NAME}}, {{LISTINGS_DATA}}...) do app tự
// điền, người dùng chỉ sửa phần hướng dẫn/yêu cầu xung quanh.
// Sửa nhầm bấm "Khôi phục mặc định" để lấy lại nguyên văn prompt gốc.
import { useState } from "react";
import { useRouter } from "next/navigation";

const PLACEHOLDERS = [
  "{{PRODUCT_NAME}}",
  "{{USER_DESCRIPTION}}",
  "{{LISTINGS_DATA}}",
  "{{IMAGE_URLS}}",
];

export default function PromptEditor({
  currentValue,
  defaultValue,
}: {
  currentValue: string;
  defaultValue: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(newValue: string) {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "ai_prompt_template", value: newValue }),
    });
    setValue(newValue);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  function restoreDefault() {
    if (!confirm("Khôi phục prompt về mặc định? Nội dung mày sửa hiện tại sẽ mất.")) return;
    save(defaultValue);
  }

  return (
    <div className="space-y-2">
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
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={16}
        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono"
      />
      <div className="flex gap-2">
        <button
          onClick={() => save(value)}
          disabled={saving}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 text-sm"
        >
          {saved ? "✓ Đã lưu" : saving ? "Đang lưu..." : "Lưu"}
        </button>
        <button
          onClick={restoreDefault}
          disabled={saving}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          ↩️ Khôi phục mặc định
        </button>
      </div>
    </div>
  );
}
