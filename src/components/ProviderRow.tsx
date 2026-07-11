"use client";

// 1 dòng API provider trong Cài đặt: bật/tắt + (mở rộng) nhập API key / URL gốc.
// Provider "Mock" không cần key nên chỉ hiện nút bật/tắt.
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  id: number;
  name: string;
  enabled: boolean;
  apiKey: string | null;
  baseUrl: string | null;
  isMock: boolean;
  isAdmin: boolean;
}

export default function ProviderRow({ id, name, enabled, apiKey, baseUrl, isMock, isAdmin }: Props) {
  const router = useRouter();
  const [busyToggle, setBusyToggle] = useState(false);
  const [open, setOpen] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [keyInput, setKeyInput] = useState(apiKey ?? "");
  const [urlInput, setUrlInput] = useState(baseUrl ?? "");
  const [saved, setSaved] = useState(false);

  async function toggle() {
    setBusyToggle(true);
    await fetch(`/api/providers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    setBusyToggle(false);
    router.refresh();
  }

  async function saveKey(e: React.FormEvent) {
    e.preventDefault();
    setSavingKey(true);
    await fetch(`/api/providers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: keyInput.trim() || null,
        baseUrl: urlInput.trim() || null,
      }),
    });
    setSavingKey(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  const hasKey = !!apiKey;

  return (
    <li className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-sm flex items-center gap-2">
          {name}
          {!isMock && (
            <span
              className={`text-xs ${hasKey ? "text-green-600 dark:text-green-400" : "text-slate-400"}`}
              title={hasKey ? "Đã có API key" : "Chưa có API key"}
            >
              {hasKey ? "🔑 đã cấu hình" : "chưa có key"}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {!isMock && isAdmin && (
            <button
              onClick={() => setOpen(!open)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {open ? "Đóng" : "Cấu hình"}
            </button>
          )}
          {!isAdmin && (
            <span className="text-xs text-slate-400">(chỉ admin sửa được)</span>
          )}
          <button
            onClick={toggle}
            disabled={busyToggle || !isAdmin}
            className={`relative w-11 h-6 rounded-full transition disabled:opacity-50 ${
              enabled ? "bg-green-500" : "bg-slate-300 dark:bg-slate-700"
            }`}
            title={
              !isAdmin
                ? "Chỉ admin bật/tắt được"
                : enabled
                  ? "Đang bật — bấm để tắt"
                  : "Đang tắt — bấm để bật"
            }
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                enabled ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {open && !isMock && isAdmin && (
        <form onSubmit={saveKey} className="mt-3 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              API key
            </label>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Dán API key vào đây..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              URL gốc của API (nếu nhà cung cấp yêu cầu)
            </label>
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://api.vi-du.com"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={savingKey}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 text-sm"
          >
            {saved ? "✓ Đã lưu" : savingKey ? "Đang lưu..." : "Lưu"}
          </button>
          <p className="text-xs text-slate-400">
            💡 Key chỉ dùng khi provider này thực sự được nối API thật (xem
            docs/04-lo-trinh.md Giai đoạn 2). Bật/tắt không tự kiểm tra key hợp lệ.
          </p>
        </form>
      )}
    </li>
  );
}
