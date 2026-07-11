"use client";

// Chia trang Cài đặt thành các nhóm tab thay vì 1 cột dài cuộn liên tục
// (9 mục dồn 1 chỗ trước đây khá rối mắt). Nội dung từng tab vẫn là
// Server Component render sẵn từ settings/page.tsx, component này chỉ
// ẩn/hiện bằng CSS theo tab đang chọn — không mất dữ liệu đã fetch.
import { useState, type ReactNode } from "react";

interface TabDef {
  key: string;
  label: string;
}

const TABS: TabDef[] = [
  { key: "general", label: "⚙️ Chung" },
  { key: "integrations", label: "🔌 API & Kết nối" },
  { key: "business", label: "💰 Kinh doanh & AI" },
  { key: "security", label: "🔐 Bảo mật" },
  { key: "backup", label: "☁️ Sao lưu" },
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
      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              active === tab.key
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="space-y-8">{content[active]}</div>
    </div>
  );
}
