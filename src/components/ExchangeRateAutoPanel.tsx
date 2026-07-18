"use client";

// Bật/tắt tự động cập nhật tỷ giá CNY→VNĐ hàng ngày (xem
// src/lib/exchange-rate/index.ts) + nút cập nhật ngay tay. Nếu đang bật
// tự động mà người dùng tự sửa tay tỷ giá ở RateForm phía trên, lần tự
// động tiếp theo VẪN GHI ĐÈ theo lịch (đã chốt) — muốn giữ số tự sửa
// thì tắt hẳn công tắc này.
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ExchangeRateAutoPanel({
  enabled,
  updatedAt,
  hasApiKey,
  isAdmin,
}: {
  enabled: boolean;
  updatedAt: string | undefined;
  hasApiKey: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [busyToggle, setBusyToggle] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setBusyToggle(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "cny_vnd_rate_auto_enabled", value: String(!enabled) }),
    });
    setBusyToggle(false);
    router.refresh();
  }

  async function refreshNow() {
    setRefreshing(true);
    setError("");
    const res = await fetch("/api/settings/exchange-rate/refresh", { method: "POST" });
    setRefreshing(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Cập nhật thất bại, thử lại nhé.");
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm flex items-center gap-2">
          🔄 Tự động cập nhật CNY→VNĐ hàng ngày
          {!hasApiKey && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              (cần bật + nhập key ExchangeRate-API trong mục API bên thứ ba trước)
            </span>
          )}
        </span>
        <button
          onClick={toggle}
          disabled={busyToggle || !isAdmin || !hasApiKey}
          className={`relative w-11 h-6 rounded-full transition disabled:opacity-50 ${
            enabled ? "bg-green-500" : "bg-slate-300 dark:bg-slate-700"
          }`}
          title={!isAdmin ? "Chỉ admin bật/tắt được" : enabled ? "Đang bật — bấm để tắt" : "Đang tắt — bấm để bật"}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
              enabled ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>
          Cập nhật lần cuối:{" "}
          {updatedAt ? new Date(updatedAt).toLocaleString("vi-VN") : "chưa lần nào"}
        </span>
        {isAdmin && hasApiKey && (
          <button
            onClick={refreshNow}
            disabled={refreshing}
            className="text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
          >
            {refreshing ? "Đang cập nhật..." : "Cập nhật ngay"}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
