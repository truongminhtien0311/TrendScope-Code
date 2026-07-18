"use client";

// Khung trạng thái đồng bộ Drive + vài chỉ số kho dữ liệu — TRUNG THỰC,
// không giả vờ có 1 thanh tiến trình 0-100% (sweep là hàng đợi chạy nền
// định kỳ, không phải 1 tác vụ có điểm đầu/cuối rõ ràng), chỉ hiện đúng
// "còn bao nhiêu đang chờ" + "lần kiểm tra gần nhất lúc nào".
//
// Poll kiểu tương tự AiAnalysisPanel.tsx (fetch định kỳ) nhưng tự quản
// state riêng (không qua router.refresh(), vì đây không phải dữ liệu SSR
// props) — khi hàng đợi rỗng thì giãn chu kỳ ra để đỡ poll vô ích.
import { useEffect, useRef, useState } from "react";
import type { SyncStatus } from "@/lib/storage/sync-status";

const POLL_MS_BUSY = 2500; // còn ảnh đang chờ -> kiểm tra sát
const POLL_MS_IDLE = 20000; // đã xong hết -> giãn ra, đỡ tốn

export default function SyncStatusPanel() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      const res = await fetch("/api/sync/status").catch(() => null);
      if (!cancelled && res?.ok) {
        const data: SyncStatus = await res.json();
        setStatus(data);
        const pending = data.pendingListingImages + data.pendingReviewImages;
        timerRef.current = setTimeout(tick, pending > 0 ? POLL_MS_BUSY : POLL_MS_IDLE);
      } else if (!cancelled) {
        timerRef.current = setTimeout(tick, POLL_MS_IDLE);
      }
    }
    tick();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!status) return null;

  const pending = status.pendingListingImages + status.pendingReviewImages;
  const totalImages = status.totalListingImages + status.totalReviewImages;
  const synced = totalImages - pending;
  const lastSweepText = status.lastSweepAt
    ? new Date(status.lastSweepAt).toLocaleTimeString("vi-VN")
    : "chưa từng chạy";
  const dbSizeText =
    status.dbSizeBytes != null ? `${(status.dbSizeBytes / (1024 * 1024)).toFixed(1)} MB` : "—";

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1.5 text-sm">
      <h2 className="font-semibold mb-2">📊 Trạng thái lưu trữ</h2>
      {status.driveEnabled ? (
        pending > 0 ? (
          <p className="text-amber-600 dark:text-amber-400">
            ⏳ Còn <strong>{pending}</strong> ảnh chưa lên Drive ({synced}/{totalImages} đã xong) —
            kiểm tra gần nhất: {lastSweepText}, quét lại mỗi 5 phút.
          </p>
        ) : (
          <p className="text-emerald-600 dark:text-emerald-400">
            ✅ {totalImages}/{totalImages} ảnh đã lên Drive — kiểm tra gần nhất: {lastSweepText}.
          </p>
        )
      ) : (
        <p className="text-slate-500 dark:text-slate-400">
          💻 Google Drive chưa bật — {totalImages} ảnh đang chỉ lưu trên máy này.
        </p>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        📦 Database: {dbSizeText} · 🧠 {status.analysisCount} phân tích AI đã lưu
      </p>
    </section>
  );
}
