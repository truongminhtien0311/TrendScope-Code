"use client";

// Nút gạt Dark/Light mode (mindmap: Cài đặt > Giao diện).
// Lưu lựa chọn vào localStorage; script trong layout.tsx đọc lại
// khi mở trang để không bị chớp màu.
// TODO giai đoạn sau: theme màu tùy chỉnh độ tương phản cao.
import { useEffect, useState } from "react";

// compact = true khi sidebar đang thu gọn (Sidebar.tsx) — chỉ hiện icon,
// bỏ chữ + bỏ w-full để không ép rộng cột hẹp.
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // Đọc trạng thái dark mode từ DOM (được script trong layout.tsx set trước khi hydrate)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đồng bộ từ DOM/browser, không có trên server nên không thể tính lúc render
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
      title={dark ? "Dark mode" : "Light mode"}
      className={`flex items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${
        compact ? "px-2" : "w-full px-3"
      }`}
    >
      {compact ? (dark ? "🌙" : "☀️") : dark ? "🌙 Dark mode" : "☀️ Light mode"}
    </button>
  );
}
