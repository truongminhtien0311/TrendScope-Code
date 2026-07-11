"use client";

// Thanh điều hướng bên trái: 3 khu vực chính theo mindmap
// (Dashboard, Cài đặt, Log) + nút đổi Dark/Light mode.
// Thu gọn được (chỉ còn icon) để có thêm diện tích màn hình — trạng thái
// nhớ lại qua localStorage, giống pattern ThemeToggle.tsx đang dùng.
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const navItems = [
  { href: "/", label: "Dashboard", icon: "📦" },
  { href: "/reports", label: "Báo cáo sản phẩm mới", icon: "📋" },
  { href: "/manage", label: "Tag & Ngành hàng", icon: "🏷️" },
  { href: "/export", label: "Xuất dữ liệu", icon: "📤" },
  { href: "/sync", label: "Đồng bộ dữ liệu", icon: "🔄" },
  { href: "/settings", label: "Cài đặt", icon: "⚙️" },
  { href: "/logs", label: "Log hoạt động", icon: "📜" },
  { href: "/guide", label: "Hướng dẫn sử dụng", icon: "📖" },
];

export default function Sidebar({ userEmail }: { userEmail?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đồng bộ từ localStorage, không có trên server nên không thể tính lúc render
    setCollapsed(localStorage.getItem("sidebarCollapsed") === "1");
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebarCollapsed", next ? "1" : "0");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className={`shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col transition-all duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-1">
        {collapsed ? (
          <Link href="/" className="font-bold text-lg mx-auto" title="Product Scrap">
            🛒
          </Link>
        ) : (
          <div>
            <Link href="/" className="font-bold text-lg">
              🛒 Product Scrap
            </Link>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Nghiên cứu sản phẩm TQ
            </p>
          </div>
        )}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
          className="shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded p-1"
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                collapsed ? "justify-center" : ""
              } ${
                active
                  ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <span>{item.icon}</span>
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
        {userEmail && !collapsed && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 truncate" title={userEmail}>
              👤 {userEmail}
            </span>
            <button
              onClick={logout}
              className="text-xs text-red-500 hover:underline shrink-0"
              title="Đăng xuất"
            >
              Đăng xuất
            </button>
          </div>
        )}
        {userEmail && collapsed && (
          <button
            onClick={logout}
            className="w-full flex items-center justify-center text-red-500 rounded-lg py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Đăng xuất"
          >
            🚪
          </button>
        )}
        <ThemeToggle compact={collapsed} />
      </div>
    </aside>
  );
}
