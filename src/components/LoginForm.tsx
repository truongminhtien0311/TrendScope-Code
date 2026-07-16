"use client";

// Form đăng nhập (Chặng 6) — nhiều tài khoản riêng biệt. Tài khoản chưa
// từng đăng nhập lần nào (passwordHash trống) sẽ TỰ ĐẶT mật khẩu gõ ở
// đây làm mật khẩu chính thức (xem /api/auth/login). Tách riêng khỏi
// src/app/login/page.tsx để trang đó có thể là Server Component (cần
// kiểm tra prisma.user.count() để biết có chuyển sang /setup không).
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [missingConfig, setMissingConfig] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  // Tự động kiểm tra đăng nhập khi quay lại app từ trình duyệt ngoài
  useEffect(() => {
    async function checkLogin() {
      try {
        const res = await fetch("/api/auth/google/sync-session", { method: "POST" });
        if (res.ok) {
          router.push(searchParams.get("next") || "/");
          router.refresh();
        }
      } catch (err) {}
    }

    window.addEventListener("focus", checkLogin);
    // Kiểm tra luôn lúc render lần đầu nếu vừa redirect về
    checkLogin();
    
    return () => window.removeEventListener("focus", checkLogin);
  }, [router, searchParams]);

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        body: JSON.stringify({ clientId, clientSecret }),
      });
      if (res.ok) {
        setMissingConfig(false);
      } else {
        setError("Lưu cấu hình thất bại.");
      }
    } catch (err) {
      setError("Lỗi kết nối máy chủ.");
    }
    setLoading(false);
  }

  async function startGoogleLogin() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/storage/google/auth-url");
      if (res.ok) {
        try {
          const { url } = await res.json();
          window.open(url, "_blank");
        } catch (e) {
          setError("Lỗi xử lý dữ liệu từ máy chủ.");
          setLoading(false);
          return;
        }
      } else {
        const data = await res.json().catch(() => null);
        if (data?.error === "MISSING_CONFIG") {
          setMissingConfig(true);
        } else {
          setError(data?.error ?? "Tạo link kết nối thất bại.");
        }
        setLoading(false);
      }
    } catch (err) {
      setError("Lỗi kết nối máy chủ.");
      setLoading(false);
    }
    // Giữ loading 3 giây để tránh bấm nhiều lần
    setTimeout(() => setLoading(false), 3000);
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        background: "radial-gradient(ellipse at 30% 40%, rgba(0,212,255,0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, rgba(124,58,237,0.1) 0%, transparent 50%), var(--bg-base)",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Star field (CSS only) */}
      <div className="star-field" aria-hidden="true" />

      {/* Orbiting glow circles */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          border: "1px solid rgba(0,212,255,0.06)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          animation: "spin-slow 40s linear infinite",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          border: "1px solid rgba(124,58,237,0.08)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          animation: "spin-slow 25s linear infinite reverse",
        }}
      />

      {/* Login card */}
      <div
        className="dialog-glass w-full relative z-10"
        style={{ maxWidth: "380px", padding: "2rem" }}
      >
        {/* Logo */}
        <div className="text-center space-y-2 pb-2">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-500 to-cyan-400 p-[2px] shadow-lg shadow-blue-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6 text-cyan-400" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <circle cx="12" cy="12" r="4"></circle>
                </svg>
              </div>
            </div>
          </div>
          <h1 className="font-bold text-2xl text-slate-900 dark:text-white">TrendScope</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {missingConfig ? "Cấu hình một lần duy nhất" : "Đăng nhập để tiếp tục"}
          </p>
        </div>

        {missingConfig ? (
          <form onSubmit={saveConfig} className="space-y-4 mt-6">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Google Client ID</label>
              <input
                required
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Google Client Secret</label>
              <input
                required
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            {error && <p className="text-center text-sm text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 transition-colors"
            >
              {loading ? "Đang lưu..." : "Lưu & Tiếp tục"}
            </button>
            <p className="text-center text-xs text-slate-500 mt-2">
              Chỉ nhập 1 lần duy nhất để kết nối ứng dụng với Google Cloud.
            </p>
          </form>
        ) : (
          <div className="space-y-5 mt-6">
            <button
              type="button"
              onClick={startGoogleLogin}
              disabled={loading}
              className="w-full group relative flex items-center justify-center gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all hover:border-slate-300 dark:hover:border-slate-700 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {loading ? "Đang chờ đăng nhập..." : "Đăng nhập bằng Google"}
            </button>

            {error && <p className="text-center text-sm text-red-500">{error}</p>}

            <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6">
              Ứng dụng sẽ mở trình duyệt để xác thực. Sau khi xong, hãy đóng trình duyệt và quay lại đây.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginForm() {
  return (
    <Suspense>
      <LoginFormInner />
    </Suspense>
  );
}
