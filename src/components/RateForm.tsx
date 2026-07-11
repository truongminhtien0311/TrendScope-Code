"use client";

// Form chỉnh 1 tỷ giá quy đổi trong trang Cài đặt — dùng chung cho cả
// CNY→VNĐ và USD→CNY (khác nhau qua settingKey/nhãn truyền vào).
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RateForm({
  settingKey,
  currentRate,
  fromLabel,
  toLabel,
  isAdmin,
}: {
  settingKey: string;
  currentRate: number;
  fromLabel: string;
  toLabel: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [rate, setRate] = useState(String(currentRate));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: settingKey, value: rate }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span>
          1 {fromLabel} = {currentRate} {toLabel}
        </span>
        <span className="text-xs text-slate-400">(chỉ admin sửa được)</span>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <span className="text-sm">1 {fromLabel} =</span>
      <input
        type="number"
        step="any"
        min="0.0001"
        value={rate}
        onChange={(e) => setRate(e.target.value)}
        className="w-28 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm"
      />
      <span className="text-sm">{toLabel}</span>
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
