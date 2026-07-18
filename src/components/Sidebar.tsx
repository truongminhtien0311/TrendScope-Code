"use client";

// Thanh điều hướng bên trái: phân nhóm NavGroups để dễ mở rộng module sau.
// Mỗi nhóm là một object riêng — thêm route mới chỉ cần thêm vào đúng nhóm.
// Thu gọn được (chỉ còn icon) — trạng thái nhớ qua localStorage.
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

// ─── SVG Icons (inline, no dependency needed) ──────────────────────────────
function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}
function IconReport() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}
function IconCompare() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>
    </svg>
  );
}
function IconTag() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  );
}
function IconExport() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}
function IconSync() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M21 12h-2M5 12H3M12 21v-2M12 5V3"/>
    </svg>
  );
}
function IconLog() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  );
}
function IconGuide() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}
function IconChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  );
}
function IconChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

// ─── Logo Icon SVG ──────────────────────────────────────────────────────────
function LogoIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--accent-primary)"/>
          <stop offset="100%" stopColor="var(--accent-secondary)"/>
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="28" height="28" rx="8" stroke="url(#logoGrad)" strokeWidth="1.5" fill="none"/>
      <path d="M9 10 L16 6 L23 10 L23 18 L16 22 L9 18 Z" stroke="url(#logoGrad)" strokeWidth="1.5" fill="none"/>
      <circle cx="16" cy="14" r="3" fill="url(#logoGrad)"/>
      <line x1="16" y1="22" x2="16" y2="26" stroke="url(#logoGrad)" strokeWidth="1.5"/>
    </svg>
  );
}

// ─── Navigation Groups ──────────────────────────────────────────────────────
// Cấu trúc nhóm: thêm module mới chỉ cần thêm object vào đúng group
const navGroups = [
  {
    id: "research",
    label: "Nghiên cứu",
    items: [
      { href: "/",        label: "Dashboard",              Icon: IconGrid },
      { href: "/reports", label: "Báo cáo sản phẩm mới",  Icon: IconReport },
      { href: "/compare", label: "So sánh sản phẩm",      Icon: IconCompare },
      { href: "/compare/history", label: "Lịch sử đánh giá", Icon: IconCompare },
    ],
  },
  {
    id: "data",
    label: "Quản lý dữ liệu",
    items: [
      { href: "/manage", label: "Tag & Ngành hàng", Icon: IconTag },
      { href: "/export", label: "Xuất dữ liệu",    Icon: IconExport },
      { href: "/sync",   label: "Đồng bộ dữ liệu", Icon: IconSync },
    ],
  },
  {
    id: "system",
    label: "Hệ thống",
    items: [
      { href: "/settings", label: "Cài đặt",            Icon: IconSettings },
      { href: "/logs",     label: "Log hoạt động",      Icon: IconLog },
      { href: "/guide",    label: "Hướng dẫn sử dụng",  Icon: IconGuide },
    ],
  },
];

// ─── Component ───────────────────────────────────────────────────────────────
export default function Sidebar({ userEmail }: { userEmail?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  // Mặc định lấy từ package.json (luôn có sẵn, kể cả chạy bằng trình
  // duyệt thường qua `npm run dev`) — bản đóng gói Electron sẽ ghi đè lại
  // ngay bên dưới nếu window.electronAPI tồn tại (xem electron/preload.js).
  const [appVersion, setAppVersion] = useState<string | null>(process.env.NEXT_PUBLIC_APP_VERSION ?? null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đồng bộ từ localStorage, không có trên server nên không thể tính lúc render
    setCollapsed(localStorage.getItem("sidebarCollapsed") === "1");
  }, []);

  useEffect(() => {
    // window.electronAPI chỉ tồn tại trong bản đã đóng gói (xem
    // electron/preload.js) — mở bằng trình duyệt thường (npm run dev) sẽ
    // không hiện số phiên bản, không lỗi gì cả.
    window.electronAPI?.getAppVersion().then(setAppVersion);
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

  // Chọn mục có href khớp DÀI NHẤT với đường dẫn hiện tại, để tránh 2 mục
  // cùng sáng khi 1 href là tiền tố của href kia (vd "/compare" và
  // "/compare/history" — đứng ở "/compare/history" chỉ mục đó được sáng).
  const allHrefs = navGroups.flatMap((g) => g.items.map((i) => i.href));
  const bestMatch = allHrefs
    .filter((href) => (href === "/" ? pathname === "/" : pathname.startsWith(href)))
    .sort((a, b) => b.length - a.length)[0];

  function isActive(href: string) {
    return href === bestMatch;
  }

  return (
    <aside
      className={`sidebar-glass shrink-0 flex flex-col transition-all duration-300 ${
        collapsed ? "w-[64px]" : "w-[220px]"
      }`}
      style={{ minHeight: "100vh" }}
    >
      {/* ── Header / Logo ─────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-3 py-4"
        style={{ borderBottom: "1px solid var(--border-sidebar)" }}
      >
        {collapsed ? (
          <button
            onClick={toggleCollapsed}
            className="mx-auto flex items-center justify-center rounded-lg p-1.5 transition-all hover:scale-110"
            title="Mở rộng sidebar"
            style={{ color: "var(--accent-primary)" }}
          >
            <LogoIcon size={26} />
          </button>
        ) : (
          <>
            <Link href="/" className="flex items-center gap-2.5 min-w-0" title="TrendScope">
              <LogoIcon size={26} />
              <div className="min-w-0">
                <div className="logo-text truncate">TrendScope</div>
                {appVersion && (
                  <div className="text-xs" style={{ color: "var(--text-sidebar-muted)", marginTop: "-1px" }}>
                    v{appVersion}
                  </div>
                )}
              </div>
            </Link>
            <button
              onClick={toggleCollapsed}
              title="Thu gọn sidebar"
              className="shrink-0 rounded-lg p-1.5 transition-all"
              style={{ color: "var(--text-sidebar-muted)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--accent-primary)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-sidebar-muted)"; }}
            >
              <IconChevronLeft />
            </button>
          </>
        )}
      </div>

      {/* ── Navigation Groups ──────────────────────────────────── */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {navGroups.map((group, gi) => (
          <div key={group.id}>
            {/* Group divider (not first group) */}
            {gi > 0 && <div className="divider mx-1 my-1" />}

            {/* Group label — hidden when collapsed */}
            {!collapsed && (
              <div className="nav-group-label">{group.label}</div>
            )}

            {/* Nav items */}
            {group.items.map(({ href, label, Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  title={collapsed ? label : undefined}
                  className={`nav-item shimmer-hover ${active ? "active" : ""} ${
                    collapsed ? "justify-center" : ""
                  }`}
                >
                  <span className="shrink-0" style={{ opacity: active ? 1 : 0.75 }}>
                    <Icon />
                  </span>
                  {!collapsed && (
                    <span className="truncate flex-1">{label}</span>
                  )}
                  {!collapsed && active && <span className="pulse-dot" />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <div
        className="px-2 py-3 space-y-2"
        style={{ borderTop: "1px solid var(--border-sidebar)" }}
      >
        {/* User email + logout */}
        {userEmail && !collapsed && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: "var(--bg-sidebar-hover)" }}>
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))", color: "var(--text-on-accent)" }}
            >
              {userEmail[0].toUpperCase()}
            </div>
            <span
              className="text-xs truncate flex-1"
              style={{ color: "var(--text-sidebar-muted)" }}
              title={userEmail}
            >
              {userEmail}
            </span>
            <button
              onClick={logout}
              title="Đăng xuất"
              className="shrink-0 rounded p-1 transition-colors"
              style={{ color: "var(--accent-danger)" }}
            >
              <IconLogout />
            </button>
          </div>
        )}

        {/* Collapsed logout button */}
        {userEmail && collapsed && (
          <button
            onClick={logout}
            className="nav-item w-full justify-center"
            title="Đăng xuất"
            style={{ color: "var(--accent-danger)" }}
          >
            <IconLogout />
          </button>
        )}

        {/* Theme toggle */}
        <ThemeToggle compact={collapsed} />

        {/* Expand button khi collapsed (ở bottom) */}
        {collapsed && (
          <button
            onClick={toggleCollapsed}
            className="nav-item w-full justify-center"
            title="Mở rộng sidebar"
            style={{ color: "var(--text-sidebar-muted)" }}
          >
            <IconChevronRight />
          </button>
        )}
      </div>
    </aside>
  );
}
