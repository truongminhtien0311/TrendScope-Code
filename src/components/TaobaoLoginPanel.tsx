"use client";

// Đăng nhập tài khoản Taobao bằng quét mã QR (giống quét đăng nhập trên
// web taobao.com bằng app điện thoại) — giữ lại phiên đăng nhập để giải
// mã link rút gọn từ mobile (vd https://e.tb.cn/h.xxxx) ra id sản phẩm
// thật trước khi cào dữ liệu.
import { useEffect, useRef, useState } from "react";

export default function TaobaoLoginPanel() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [savedAt, setSavedAt] = useState<string | undefined>();
  const [qrImage, setQrImage] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadStatus() {
    const res = await fetch("/api/taobao-login/status");
    if (res.ok) {
      const data = await res.json();
      setLoggedIn(data.loggedIn);
      setSavedAt(data.savedAt);
    }
  }

  useEffect(() => {
    loadStatus();
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  async function startLogin() {
    setError("");
    setScanning(true);
    const res = await fetch("/api/taobao-login/start", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Không mở được trang đăng nhập, thử lại nhé.");
      setScanning(false);
      return;
    }
    const { token, qrImage } = await res.json();
    setQrImage(qrImage);

    pollTimer.current = setInterval(async () => {
      const pollRes = await fetch(`/api/taobao-login/poll?token=${token}`);
      const { status } = await pollRes.json();
      if (status === "success") {
        clearInterval(pollTimer.current!);
        setScanning(false);
        setQrImage("");
        loadStatus();
      } else if (status === "expired") {
        clearInterval(pollTimer.current!);
        setScanning(false);
        setQrImage("");
        setError("Hết thời gian chờ quét mã — bấm đăng nhập lại.");
      }
    }, 2000);
  }

  function cancelScan() {
    if (pollTimer.current) clearInterval(pollTimer.current);
    setScanning(false);
    setQrImage("");
  }

  async function logout() {
    if (!confirm("Xóa phiên đăng nhập Taobao đã lưu?")) return;
    await fetch("/api/taobao-login/logout", { method: "POST" });
    loadStatus();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            loggedIn ? "bg-emerald-500" : "bg-slate-400"
          }`}
        />
        <span className="text-sm">
          {loggedIn === null
            ? "Đang kiểm tra..."
            : loggedIn
              ? `🟢 Đã đăng nhập Taobao${savedAt ? ` (từ ${new Date(savedAt).toLocaleString("vi-VN")})` : ""}`
              : "⚪ Chưa đăng nhập Taobao"}
        </span>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {scanning ? (
        <div className="space-y-2">
          {qrImage && (
            // eslint-disable-next-line @next/next/no-img-element -- ảnh base64 tạo động, không phải asset tĩnh
            <img src={qrImage} alt="Mã QR đăng nhập Taobao" className="w-48 h-48 border rounded-lg" />
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Mở app Taobao trên điện thoại → góc trên bên trái có biểu tượng quét → quét mã
            này để đăng nhập.
          </p>
          <button
            onClick={cancelScan}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm"
          >
            Hủy
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={startLogin}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-sm"
          >
            {loggedIn ? "🔄 Đăng nhập lại" : "📱 Đăng nhập bằng QR"}
          </button>
          {loggedIn && (
            <button
              onClick={logout}
              className="rounded-lg border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 px-3 py-1.5 text-sm"
            >
              🗑️ Xóa phiên đăng nhập
            </button>
          )}
        </div>
      )}
    </div>
  );
}
