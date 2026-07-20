"use client";

// Nút "Trung tâm đồng bộ" đặt cạnh logo ở header sidebar — bấm vào hiện
// popup nhỏ tóm tắt trạng thái ảnh đang lên Google Drive (dữ liệu lấy từ
// /api/sync/status, do Sidebar.tsx poll sẵn và truyền xuống qua props) +
// lối tắt sang trang /sync. Không tự fetch riêng, tránh gọi API trùng lặp
// với badge số ảnh chờ ở mục nav "Đồng bộ dữ liệu".
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SyncStatus } from "@/lib/storage/sync-status";

const noDragStyle = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

function IconCloudSync({ muted }: { muted?: boolean }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: muted ? 0.55 : 1 }}
    >
      <path d="M17.5 19a4.5 4.5 0 0 0 0-9c-.09 0-.19 0-.28.01A6 6 0 0 0 6 12.5v.09A4 4 0 0 0 4 20h13.5" />
    </svg>
  );
}

// Đang có lượt quét chạy (định kỳ hoặc debounce sau khi thêm ảnh mới) —
// xem status.syncing (src/lib/storage/sync-status.ts).
function IconSpinner() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="animate-spin"
    >
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

// Đã lên Drive hết, không còn ảnh nào chờ.
function IconCheck() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "#10b981" }}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function SyncCenterButton({
  status,
  onRefresh,
}: {
  status: SyncStatus | null;
  onRefresh: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  async function forceSweepNow() {
    setSweeping(true);
    await fetch("/api/sync/force-sweep", { method: "POST" }).catch(() => {});
    await onRefresh();
    setSweeping(false);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const pending = status ? status.pendingListingImages + status.pendingReviewImages : 0;
  const totalImages = status ? status.totalListingImages + status.totalReviewImages : 0;
  const synced = !!status?.driveEnabled && pending === 0 && !status.syncing;
  const hasWarning = !!status && (!status.driveEnabled || pending > 0);
  // Đầy đủ ngày + giờ (không chỉ giờ) — lần quét gần nhất có thể là hôm
  // trước nếu app không mở, chỉ hiện giờ dễ hiểu lầm là "vừa mới".
  const lastSweepText = status?.lastSweepAt
    ? new Date(status.lastSweepAt).toLocaleString("vi-VN")
    : "chưa từng chạy";
  const dbSizeText = status?.dbSizeBytes != null ? `${(status.dbSizeBytes / (1024 * 1024)).toFixed(1)} MB` : "—";

  return (
    <div ref={rootRef} className="relative shrink-0" style={noDragStyle}>
      <button
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) onRefresh();
        }}
        title="Trung tâm đồng bộ"
        className="relative rounded-lg p-1.5 transition-all"
        style={{ color: "var(--text-sidebar-muted)" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--accent-primary)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-sidebar-muted)"; }}
      >
        {status?.syncing ? (
          <IconSpinner />
        ) : synced ? (
          <IconCheck />
        ) : (
          <IconCloudSync muted={!status?.driveEnabled} />
        )}
        {hasWarning && (
          <span
            className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500"
            style={{ boxShadow: "0 0 0 1.5px var(--bg-sidebar, #08090c)" }}
          />
        )}
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-2 w-80 rounded-xl border shadow-lg p-4 space-y-3 text-sm z-50"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
        >
          <h3 className="font-semibold">☁️ Trung tâm đồng bộ</h3>

          {!status ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">Đang tải trạng thái...</p>
          ) : (
            <>
              {!status.driveEnabled ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ Google Drive chưa bật — ảnh sản phẩm đang chỉ lưu trên máy này, chưa có bản sao lưu.{" "}
                  <Link href="/settings" onClick={() => setOpen(false)} className="underline">
                    Bật trong Cài đặt →
                  </Link>
                </p>
              ) : status.syncing ? (
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  🔄 Đang tải ảnh lên Drive... ({totalImages - pending}/{totalImages} đã xong)
                </p>
              ) : pending > 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⏳ Còn <strong>{pending}</strong> ảnh chưa lên Drive — tự quét lại sau ~30s ngừng thao tác (hoặc
                  chậm nhất mỗi 5 phút).
                </p>
              ) : (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  ✅ Toàn bộ ảnh đã lên Drive, không còn gì chờ.
                </p>
              )}

              {/* Chi tiết đầy đủ ngay tại đây — không bắt người dùng phải rời
                  trang họ đang thao tác chỉ để xem trạng thái. */}
              <dl className="text-xs space-y-1.5 rounded-lg p-2.5" style={{ background: "var(--bg-base)" }}>
                <div className="flex justify-between gap-3">
                  <dt style={{ color: "var(--text-secondary)" }}>Ảnh sản phẩm</dt>
                  <dd>
                    {status.totalListingImages - status.pendingListingImages}/{status.totalListingImages} đã lên Drive
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt style={{ color: "var(--text-secondary)" }}>Ảnh đánh giá</dt>
                  <dd>
                    {status.totalReviewImages - status.pendingReviewImages}/{status.totalReviewImages} đã lên Drive
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt style={{ color: "var(--text-secondary)" }}>Lần quét gần nhất</dt>
                  <dd className="text-right">{lastSweepText}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt style={{ color: "var(--text-secondary)" }}>Trạng thái Drive</dt>
                  <dd>{status.driveEnabled ? "Đã bật" : "Chưa bật"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt style={{ color: "var(--text-secondary)" }}>Dung lượng database</dt>
                  <dd>{dbSizeText}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt style={{ color: "var(--text-secondary)" }}>Phân tích AI đã lưu</dt>
                  <dd>{status.analysisCount}</dd>
                </div>
              </dl>

              {status.driveEnabled && pending > 0 && (
                <button
                  onClick={forceSweepNow}
                  disabled={sweeping || status.syncing}
                  className="w-full text-center text-xs font-medium rounded-lg py-2 transition-colors border disabled:opacity-50"
                  style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                >
                  {sweeping || status.syncing ? "Đang đồng bộ..." : `⚡ Đồng bộ ngay (còn ${pending})`}
                </button>
              )}
            </>
          )}

          <div style={{ borderTop: "1px solid var(--border-subtle)" }} className="pt-3">
            <Link
              href="/sync"
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-medium rounded-lg py-2 transition-colors"
              style={{ background: "var(--accent-primary)", color: "var(--text-on-accent)" }}
            >
              Mở trang Đồng bộ dữ liệu (xuất/nhập giữa máy) →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
