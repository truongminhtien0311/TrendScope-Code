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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/");
      router.refresh();
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
        <h1 className="font-bold text-lg">🛒 Product Scrap</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Chào mừng! Đây là lần đầu mở app trên máy này — tạo tài khoản Chủ tài khoản của bạn.
        </p>
      </div>

      <div>
        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Tên của bạn</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Mật khẩu (từ 6 ký tự)</label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium"
      >
        {loading ? "Đang tạo..." : "Tạo tài khoản & bắt đầu dùng"}
      </button>
    </form>
  );
}
