"use client";

// Nút gạt Dark/Light mode (mindmap: Cài đặt > Giao diện).
// Lưu lựa chọn vào localStorage; script trong layout.tsx đọc lại
// khi mở trang để không bị chớp màu.
// TODO giai đoạn sau: theme màu tùy chỉnh độ tương phản cao.
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.theme = next ? "dark" : "light";
  }

  return (
    <button
      onClick={toggle}
      className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      {dark ? "🌙 Dark mode" : "☀️ Light mode"}
    </button>
  );
}
