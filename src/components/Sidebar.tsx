"use client";

// Thanh điều hướng bên trái: phân nhóm NavGroups để dễ mở rộng module sau.
// Mỗi nhóm là một object riêng — thêm route mới chỉ cần thêm vào đúng nhóm.
// Thu gọn được (chỉ còn icon) — trạng thái nhớ qua localStorage.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { SyncStatus } from "@/lib/storage/sync-status";
import SyncCenterButton from "./SyncCenterButton";

// "-webkit-app-region" không nằm trong type CSSProperties chuẩn (chỉ
// Electron/Chromium hiểu) — ép kiểu để TypeScript chấp nhận.
const dragRegionStyle = { WebkitAppRegion: "drag" } as React.CSSProperties;
const noDragStyle = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

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
  // Trạng thái đồng bộ Drive đầy đủ — dùng cho cả badge nhỏ cạnh mục "Đồng
  // bộ dữ liệu" VÀ nút "Trung tâm đồng bộ" ở header (SyncCenterButton), để
  // trạng thái luôn hiện sẵn (không "chôn" trong 1 trang riêng phải tự vào
  // xem mới biết). Poll giãn (30s) vì đây chỉ là chỉ báo phụ, trang
  // /sync đã có SyncStatusPanel poll sát hơn khi thực sự đang theo dõi.
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  const pollSyncStatus = useCallback(async (): Promise<SyncStatus | null> => {
    const res = await fetch("/api/sync/status").catch(() => null);
    if (!res?.ok) return null;
    const data: SyncStatus = await res.json();
    setSyncStatus(data);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    // Hẹn giờ TỰ ĐẶT LẠI theo dữ liệu vừa nhận (không phải state cũ) — poll
    // sát hơn (5s) lúc đang quét/còn ảnh chờ để icon xoay tròn thấy "sống
    // động", giãn ra (30s, như cũ) lúc đã yên, đỡ tốn tài nguyên nền vì
    // Sidebar hiện trên MỌI trang trong app (không riêng trang /sync, nơi
    // SyncStatusPanel.tsx dùng cadence sát hơn 2.5s vì là màn hình đang theo
    // dõi chủ động).
    async function tick() {
      const data = await pollSyncStatus();
      if (cancelled) return;
      const busy = !!data && (data.syncing || data.pendingListingImages + data.pendingReviewImages > 0);
      timer = setTimeout(tick, busy ? 5000 : 30000);
    }
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pollSyncStatus]);

  const pendingSyncCount = syncStatus ? syncStatus.pendingListingImages + syncStatus.pendingReviewImages : null;

  // Tiến trình đồng bộ tương đối (ảnh đã lên Drive / tổng số ảnh) — hiện
  // dưới dạng thanh mảnh dưới mục "Đồng bộ dữ liệu" trong sidebar. Tính lại
  // mỗi lần poll (xem pollSyncStatus ở trên) nên nếu có ảnh mới phát sinh
  // giữa lúc đang đồng bộ (cào thêm dữ liệu), tổng số + số đã xong đều tự
  // cập nhật theo, thanh bar tự lùi lại đúng tỉ lệ thật chứ không "tưởng đã
  // xong" — không cần xử lý gì thêm ở đây.
  const totalSyncImages = syncStatus ? syncStatus.totalListingImages + syncStatus.totalReviewImages : 0;
  const syncedImages = pendingSyncCount != null ? totalSyncImages - pendingSyncCount : 0;
  const syncPercent = totalSyncImages > 0 ? Math.round((syncedImages / totalSyncImages) * 100) : 100;

  // Vị trí THẬT (px, đã kẹp trong khung) của nhãn nổi trên thanh tiến trình —
  // kẹp theo % không đủ vì nhãn dài ngắn khác nhau ("Đã đồng bộ xong" dài
  // hơn hẳn "5/20 ảnh (25%)"), kẹp cứng 1 mốc % cố định vẫn tràn viền sidebar
  // với nhãn dài. Đo kích thước THẬT bằng ref sau khi render rồi tự tính lại
  // — luôn vừa khung dù nhãn dài ngắn thế nào.
  const gaugeTrackRef = useRef<HTMLDivElement>(null);
  const gaugeMarkerRef = useRef<HTMLDivElement>(null);
  const [markerLeftPx, setMarkerLeftPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    const track = gaugeTrackRef.current;
    const marker = gaugeMarkerRef.current;
    if (!track || !marker) {
      setMarkerLeftPx(null);
      return;
    }
    const trackWidth = track.getBoundingClientRect().width;
    const markerWidth = marker.getBoundingClientRect().width;
    const half = markerWidth / 2;
    const raw = (syncPercent / 100) * trackWidth;
    setMarkerLeftPx(Math.min(trackWidth - half, Math.max(half, raw)));
  }, [syncPercent, collapsed, totalSyncImages]);

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

  // Màu tiến trình đồng bộ — pha MƯỢT liên tục theo % thật (đỏ→cam→xanh lá)
  // bằng CSS color-mix(), không dùng dải màu cố định tô sẵn: thanh chạy tới
  // đâu thì đúng màu ở đó, giống cảm giác "sức khỏe" tăng dần chứ không phải
  // thước kẻ vạch sẵn. Dùng thẳng 3 biến màu --accent-danger/--accent-warning/
  // --accent-success đã có sẵn của app (không bịa màu mới) nên tự đúng tông ở
  // cả 2 theme sáng/tối — dùng chung cho cả thanh đầy đủ lẫn chấm tròn collapsed.
  function syncProgressColor(percent: number): string {
    const p = Math.min(100, Math.max(0, percent));
    if (p <= 50) {
      const t = Math.round((p / 50) * 100);
      return `color-mix(in srgb, var(--accent-warning) ${t}%, var(--accent-danger) ${100 - t}%)`;
    }
    const t = Math.round(((p - 50) / 50) * 100);
    return `color-mix(in srgb, var(--accent-success) ${t}%, var(--accent-warning) ${100 - t}%)`;
  }

  return (
    <aside
      className={`sidebar-glass shrink-0 flex flex-col transition-all duration-300 ${
        collapsed ? "w-[64px]" : "w-[220px]"
      }`}
      // Cố định theo viewport (không bị kéo trôi xuống theo chiều cao
      // thật của trang) — trước đây dùng minHeight:100vh bên trong 1 flex
      // row cùng <main>, nên khi trang dài hơn màn hình, sidebar bị kéo
      // dãn ra theo, đẩy phần footer (email/đăng xuất) trôi tít xuống
      // dưới, phải cuộn hết trang mới thấy. sticky+height:100vh giữ nó
      // luôn đúng 1 màn hình, độc lập với độ dài nội dung main.
      //
      // zIndex: "sticky" tự tạo 1 stacking context riêng cho aside — nếu
      // không có z-index, <main> (đứng sau trong HTML, cũng position:
      // relative) sẽ vẽ ĐÈ LÊN toàn bộ aside kể cả popup z-50 bên trong
      // (vd SyncCenterButton) vì z-50 đó chỉ so được với phần tử khác
      // TRONG aside, không so được với main ở ngoài. 20 vẫn thấp hơn các
      // modal khác trong app (z-50 AiAnalysisPanel, z-[60] UpdateNotifier)
      // nên các modal đó vẫn hiện đè lên sidebar bình thường.
      style={{ position: "sticky", top: 0, height: "100vh", zIndex: 20 }}
    >
      {/* ── Header / Logo ─────────────────────────────────────── */}
      {/* Nguyên dải này khai báo "-webkit-app-region: drag" — trong app
          Electron đóng gói (electron/main.js dùng titleBarStyle:"hidden")
          cho phép kéo di chuyển cả cửa sổ bằng cách bấm-kéo vùng logo. Ở
          trình duyệt thường (npm run dev) thuộc tính này bị bỏ qua, không
          ảnh hưởng gì. 3 phần tử bấm được bên trong (2 nút thu/mở +
          logo) phải khai báo "no-drag" ngược lại, không thì Electron sẽ
          coi thao tác bấm chúng là kéo cửa sổ thay vì click. */}
      <div
        className="flex flex-col px-3 py-4"
        style={{ borderBottom: "1px solid var(--border-sidebar)", ...dragRegionStyle }}
      >
        <div className="flex items-center justify-between">
          {collapsed ? (
            <button
              onClick={toggleCollapsed}
              className="mx-auto flex items-center justify-center rounded-lg p-1.5 transition-all hover:scale-110"
              title="Mở rộng sidebar"
              style={{ color: "var(--accent-primary)", ...noDragStyle }}
            >
              <LogoIcon size={26} />
            </button>
          ) : (
            <>
              <Link href="/" className="flex items-center gap-2.5 min-w-0" title="TrendScope" style={noDragStyle}>
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
              <div className="flex items-center gap-0.5 shrink-0">
                <SyncCenterButton status={syncStatus} onRefresh={pollSyncStatus} />
                <button
                  onClick={toggleCollapsed}
                  title="Thu gọn sidebar"
                  className="shrink-0 rounded-lg p-1.5 transition-all"
                  style={{ color: "var(--text-sidebar-muted)", ...noDragStyle }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--accent-primary)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-sidebar-muted)"; }}
                >
                  <IconChevronLeft />
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Thước đo tiến trình đồng bộ ảnh — luôn hiện ngay dưới logo,
            không chôn trong danh sách menu. Khung (track) chỉ là nền trung
            tính, thanh tô màu bên trong chạy dài theo % thật và TỰ ĐỔI MÀU
            liên tục theo đúng mức đang đạt (xem syncProgressColor ở trên) —
            không phải thước kẻ vạch màu cố định. */}
        {totalSyncImages > 0 && (() => {
          const fillColor = syncProgressColor(syncPercent);
          const glow = `0 0 6px color-mix(in srgb, ${fillColor} 55%, transparent)`;
          const tooltip = syncPercent >= 100
            ? `Đã đồng bộ xong ${totalSyncImages}/${totalSyncImages} ảnh`
            : `Đã đồng bộ ${syncedImages}/${totalSyncImages} ảnh (${syncPercent}%)`;
          const isSyncingNow = !!syncStatus?.syncing && syncPercent < 100;

          return collapsed ? (
            <div
              className="sync-gauge-dot"
              title={tooltip}
              style={{
                backgroundColor: fillColor,
                boxShadow: glow,
                animationPlayState: isSyncingNow ? "running" : "paused",
              }}
            />
          ) : (
            <div className="sync-gauge" title={tooltip}>
              <div
                ref={gaugeMarkerRef}
                className="sync-gauge-marker"
                style={{
                  // Trước khi đo xong (frame đầu) dùng tạm % kẹp thô — sau đó
                  // useLayoutEffect tính lại bằng px thật, luôn vừa khung.
                  left: markerLeftPx != null ? `${markerLeftPx}px` : `${Math.min(92, Math.max(8, syncPercent))}%`,
                  animationPlayState: isSyncingNow ? "running" : "paused",
                }}
              >
                <span className="sync-gauge-label" style={{ borderColor: fillColor }}>
                  {syncPercent >= 100 ? "Đã đồng bộ xong" : `${syncedImages}/${totalSyncImages} ảnh (${syncPercent}%)`}
                </span>
                <span className="sync-gauge-caret" style={{ borderTopColor: fillColor }} />
              </div>
              <div ref={gaugeTrackRef} className="sync-gauge-track">
                <div
                  className="sync-gauge-fill"
                  style={{ width: `${syncPercent}%`, backgroundColor: fillColor, boxShadow: glow }}
                />
              </div>
            </div>
          );
        })()}
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
                  {!collapsed && href === "/sync" && !!pendingSyncCount && (
                    <span
                      title="Số ảnh chưa đồng bộ lên Google Drive"
                      className="shrink-0 rounded-full bg-amber-500 text-white text-[10px] leading-none px-1.5 py-1"
                    >
                      {pendingSyncCount}
                    </span>
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

        {/* Dark/Light mode: đã chuyển vào Cài đặt > Giao diện — sidebar dễ bị
            trôi dài theo trang, nút gạt ở đó ổn định hơn cho người dùng. */}

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
