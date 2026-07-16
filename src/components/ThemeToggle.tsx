"use client";

// Nút gạt Dark/Light mode — pill toggle với animation trượt.
// Lưu lựa chọn vào localStorage; script trong layout.tsx đọc lại
// khi mở trang để không bị chớp màu.
import { useEffect, useState } from "react";

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

  if (compact) {
    // Collapsed mode: just a small icon button
    return (
      <button
        onClick={toggle}
        title={dark ? "Chuyển sang Light mode" : "Chuyển sang Dark mode"}
        className="nav-item w-full justify-center"
        style={{ color: "var(--text-sidebar-muted)" }}
      >
        {dark ? (
          // Moon icon
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        ) : (
          // Sun icon
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        )}
      </button>
    );
  }

  // Expanded mode: pill toggle with label
  return (
    <button
      onClick={toggle}
      title={dark ? "Chuyển sang Light mode" : "Chuyển sang Dark mode"}
      className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg transition-all"
      style={{ color: "var(--text-sidebar-muted)" }}
    >
      {/* Pill track */}
      <div className="theme-toggle-track" aria-hidden="true">
        <div className={`theme-toggle-thumb ${dark ? "dark-mode" : ""}`}>
          {dark ? "☽" : "☀"}
        </div>
      </div>
      <span className="text-xs font-medium truncate">
        {dark ? "Dark mode" : "Light mode"}
      </span>
    </button>
  );
}
