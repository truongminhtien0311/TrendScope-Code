"use client";

// Kết nối Google Drive để lưu trữ ảnh (thay vì phụ thuộc link ảnh gốc
// trên sàn TQ). Người dùng tự tạo OAuth Client ID trên Google Cloud
// Console rồi dán Client ID/Secret vào đây, bấm "Kết nối với Google" để
// xin quyền — refresh token lưu lại tự động, không cần đăng nhập lại
// mỗi lần dùng.
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useConfirm } from "@/components/ConfirmDialogProvider";

interface Props {
  providerId: number;
  clientId: string;
  clientSecret: string;
  connectedEmail?: string;
  hasRefreshToken: boolean;
  isAdmin: boolean;
}

export default function GoogleDriveConnectPanel({
  providerId,
  clientId: initialClientId,
  clientSecret: initialClientSecret,
  connectedEmail,
  hasRefreshToken,
  isAdmin,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirmDialog = useConfirm();
  const [clientId, setClientId] = useState(initialClientId);
  const [clientSecret, setClientSecret] = useState(initialClientSecret);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  // Đọc thẳng từ query param lúc render (Google redirect về kèm
  // ?google_drive_connected=1 hoặc ?google_drive_error=...) thay vì
  // đưa qua state — chỉ dùng effect để dọn URL sau khi hiển thị xong.
  const redirectedConnected = searchParams.get("google_drive_connected");
  const redirectedError = searchParams.get("google_drive_error");
  const notice = redirectedConnected ? "✅ Đã kết nối Google Drive thành công!" : "";

  useEffect(() => {
    if (redirectedConnected || redirectedError) {
      router.replace("/settings");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi query param đổi, không phụ thuộc router
  }, [redirectedConnected, redirectedError]);

  // Bấm "Kết nối với Google" sẽ mở trình duyệt NGOÀI app (xem
  // electron/main.js — will-navigate chặn điều hướng ra domain khác ngay
  // trong cửa sổ app, tránh bị kẹt trắng màn hình không có nút quay lại).
  // Cửa sổ app vẫn nằm nguyên ở trang này suốt lúc đó — không có cách nào
  // biết chính xác lúc nào người dùng bấm xong bên trình duyệt, nên cứ mỗi
  // lần quay lại cửa sổ app (focus) thì tự tải lại trang để cập nhật trạng
  // thái mới nhất, khỏi phải thoát app vào lại.
  useEffect(() => {
    function onFocus() {
      setConnecting(false);
      router.refresh();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ đăng ký 1 lần, router.refresh() không cần nằm trong dependency
  }, []);

  async function saveCredentials() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/providers/${providerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        configJson: JSON.stringify({ clientId: clientId.trim(), clientSecret: clientSecret.trim() }),
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } else {
      setError("Lưu thất bại, thử lại nhé.");
    }
  }

  async function connect() {
    setConnecting(true);
    setError("");
    const res = await fetch("/api/storage/google/auth-url");
    if (res.ok) {
      const { url } = await res.json();
      // Không "window.location.href = url" (rời hẳn trang app đi) — trong
      // bản đóng gói, main.js chặn lại và tự mở bằng trình duyệt mặc định
      // của máy (window.open để chắc chắn không đụng gì tới trang app hiện
      // tại). Đăng nhập xong ở trình duyệt, quay lại cửa sổ app sẽ tự cập
      // nhật (xem effect "onFocus" ở trên).
      window.open(url, "_blank");
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Không lấy được link kết nối.");
      setConnecting(false);
    }
  }

  async function disconnect() {
    if (
      !(await confirmDialog("Ngắt kết nối Google Drive? (giữ lại Client ID/Secret, chỉ xóa quyền truy cập)", {
        danger: true,
      }))
    )
      return;
    await fetch(`/api/providers/${providerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configJson: JSON.stringify({ clientId, clientSecret }) }),
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
        <>
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Client ID</label>
              <input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="xxxx.apps.googleusercontent.com"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Client Secret</label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="GOCSPX-..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={saveCredentials}
              disabled={saving}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {saved ? "✓ Đã lưu" : saving ? "Đang lưu..." : "Lưu Client ID/Secret"}
            </button>
            <button
              onClick={connect}
              disabled={connecting || !clientId.trim() || !clientSecret.trim()}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 text-sm"
            >
              {connecting ? "Đang chờ đăng nhập..." : hasRefreshToken ? "🔄 Kết nối lại" : "🔗 Kết nối với Google"}
            </button>
            {hasRefreshToken && (
              <button
                onClick={disconnect}
                className="rounded-lg border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 px-3 py-1.5 text-sm"
              >
                Ngắt kết nối
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400">
            💡 Bấm &quot;Lưu Client ID/Secret&quot; trước, rồi mới bấm &quot;Kết nối với Google&quot;.
          </p>
        </>
      )}
    </div>
  );
}
