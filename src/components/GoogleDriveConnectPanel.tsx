"use client";

// Kết nối Google Drive để lưu trữ ảnh.
// Client ID/Secret bây giờ được đọc thẳng từ file .env.
// Ở màn hình này người dùng chỉ cần bấm "Kết nối" (OAuth).
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useConfirm } from "@/components/ConfirmDialogProvider";

interface Props {
  providerId: number;
  connectedEmail?: string;
  hasRefreshToken: boolean;
  isAdmin: boolean;
}

export default function GoogleDriveConnectPanel({
  providerId,
  connectedEmail,
  hasRefreshToken,
  isAdmin,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirmDialog = useConfirm();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const redirectedConnected = searchParams.get("google_drive_connected");
  const redirectedError = searchParams.get("google_drive_error");
  const notice = redirectedConnected ? "✅ Đã kết nối Google Drive thành công!" : "";

  useEffect(() => {
    if (redirectedConnected || redirectedError) {
      router.replace("/settings");
    }
  }, [redirectedConnected, redirectedError, router]);

  useEffect(() => {
    function onFocus() {
      setConnecting(false);
      router.refresh();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router]);

  async function connect() {
    setConnecting(true);
    setError("");
    const res = await fetch("/api/storage/google/auth-url");
    if (res.ok) {
      const { url } = await res.json();
      window.open(url, "_blank");
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Không lấy được link kết nối.");
      setConnecting(false);
    }
  }

  async function disconnect() {
    if (
      !(await confirmDialog("Ngắt kết nối Google Drive? (chỉ xóa quyền truy cập)", {
        danger: true,
      }))
    )
      return;
    await fetch(`/api/providers/${providerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configJson: JSON.stringify({}) }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
      <div className="flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full ${hasRefreshToken ? "bg-emerald-500" : "bg-slate-400"}`} />
        <span className="text-sm">
          {hasRefreshToken
            ? `🟢 Đã kết nối Google Drive${connectedEmail ? ` (${connectedEmail})` : ""}`
            : "⚪ Chưa kết nối Google Drive"}
        </span>
      </div>

      {notice && <p className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>}
      {(error || redirectedError) && <p className="text-sm text-red-500">{error || redirectedError}</p>}
      {connecting && (
        <p className="text-sm text-blue-600 dark:text-blue-400">
          🌐 Đã mở trình duyệt để đăng nhập Google — đăng nhập xong quay lại đây, app tự cập
          nhật trạng thái.
        </p>
      )}

      {!isAdmin ? (
        <p className="text-xs text-slate-400">(chỉ admin kết nối/ngắt kết nối được)</p>
      ) : (
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={connect}
            disabled={connecting}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 text-sm"
          >
            {connecting ? "Đang kết nối..." : "Kết nối Google"}
          </button>
          {hasRefreshToken && (
            <button
              type="button"
              onClick={disconnect}
              className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 px-3 py-1.5 text-sm"
            >
              Ngắt kết nối
            </button>
          )}
        </div>
      )}
    </div>
  );
}
