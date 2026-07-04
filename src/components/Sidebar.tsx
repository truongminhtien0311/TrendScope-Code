"use client";

// Thanh điều hướng bên trái: 3 khu vực chính theo mindmap
// (Dashboard, Cài đặt, Log) + nút đổi Dark/Light mode.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const navItems = [
  { href: "/", label: "Dashboard", icon: "📦" },
  { href: "/manage", label: "Tag & Ngành hàng", icon: "🏷️" },
  { href: "/settings", label: "Cài đặt", icon: "⚙️" },
  { href: "/logs", label: "Log hoạt động", icon: "📜" },
];

export default function Sidebar({ userEmail }: { userEmail?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-56 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <Link href="/" className="font-bold text-lg">
          🛒 Product Scrap
        </Link>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Nghiên cứu sản phẩm TQ
        </p>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                active
                  ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
        {userEmail && (
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
        <ThemeToggle />
      </div>
    </aside>
  );
}
