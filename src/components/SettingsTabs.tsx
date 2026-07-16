"use client";

// Chia trang Cài đặt thành các nhóm tab thay vì 1 cột dài cuộn liên tục
// (9 mục dồn 1 chỗ trước đây khá rối mắt). Nội dung từng tab vẫn là
// Server Component render sẵn từ settings/page.tsx, component này chỉ
// ẩn/hiện bằng CSS theo tab đang chọn — không mất dữ liệu đã fetch.
import { useState, type ReactNode } from "react";

interface TabDef {
  key: string;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { key: "general",      label: "Chung",          icon: "⚙" },
  { key: "integrations", label: "API & Kết nối",   icon: "⬡" },
  { key: "business",     label: "Kinh doanh & AI", icon: "◈" },
  { key: "security",     label: "Bảo mật",         icon: "⊙" },
  { key: "backup",       label: "Sao lưu",         icon: "↑" },
];

export default function SettingsTabs({
  general,
  integrations,
  business,
  security,
  backup,
}: Record<(typeof TABS)[number]["key"], ReactNode>) {
  const [active, setActive] = useState(TABS[0].key);
  const content: Record<string, ReactNode> = { general, integrations, business, security, backup };

  return (
    <div>
      {/* Tab strip */}
      <div
        className="flex flex-wrap gap-1 mb-6"
        style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0" }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-all"
            style={{
              borderBottom: active === tab.key
                ? "2px solid var(--accent-primary)"
                : "2px solid transparent",
              marginBottom: "-1px",
              color: active === tab.key
                ? "var(--accent-primary)"
                : "var(--text-muted)",
              background: "transparent",
            }}
            onMouseEnter={(e) => {
              if (active !== tab.key)
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              if (active !== tab.key)
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            }}
          >
            <span style={{ fontSize: "0.8rem", opacity: 0.9 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="space-y-6">{content[active]}</div>
    </div>
  );
}
