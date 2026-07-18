"use client";

// Form "Thiết lập lần đầu" — máy mới cài app (database trống) tự tạo
// tài khoản Chủ tài khoản của riêng mình (tên/email/mật khẩu), thay vì
// dùng chung 1 email gắn cứng trong prisma/seed.ts (chỉ dùng cho
// `npm run db:reset` lúc phát triển, không chạy khi đóng gói cho người
// dùng cuối — xem electron/main.js).
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupForm() {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: clientId.trim(), clientSecret: clientSecret.trim() }),
    });
    setLoading(false);
    if (res.ok) {
      setSaved(true);
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Thiết lập thất bại, thử lại nhé.");
    }
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
    >
      <div>
        <h1 className="font-bold text-lg">🛒 TrendScope</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Chào mừng! Đây là lần đầu mở app trên máy này — tạo tài khoản Chủ tài khoản của bạn.
        </p>
      </div>

      <div>
        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Google Client ID</label>
        <input
          required
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Google Client Secret</label>
        <input
          required
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {!saved ? (
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium"
        >
          {loading ? "Đang lưu..." : "Lưu cấu hình"}
        </button>
      ) : (
        <button
          type="button"
          onClick={async () => {
            const res = await fetch("/api/storage/google/auth-url");
            if (res.ok) {
              const { url } = await res.json();
              window.open(url, "_blank");
            }
          }}
          className="w-full rounded-lg bg-white border border-slate-200 dark:border-slate-700 dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white px-4 py-2 text-sm font-medium flex items-center justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Đăng nhập bằng Google
        </button>
      )}
    </form>
  );
}
