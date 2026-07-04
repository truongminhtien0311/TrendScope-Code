"use client";

// Hiện tối đa `max` badge (ngành hàng/tag) đầu tiên, phần dư gộp thành
// 1 nút "+N" — bấm/hover vào xổ ra danh sách còn lại (giống cách GitHub
// hiện label PR khi có nhiều label). Dùng chung cho ProductCard và
// trang chi tiết sản phẩm.
import { useState } from "react";

export interface BadgeItem {
  key: string | number;
  label: string;
  style?: React.CSSProperties;
  className?: string;
}

export default function BadgeOverflowList({ items, max = 3 }: { items: BadgeItem[]; max?: number }) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, max);
  const hiddenCount = items.length - max;

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {visible.map((item) => (
        <span
          key={item.key}
          className={item.className ?? "text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800"}
          style={item.style}
        >
          {item.label}
        </span>
      ))}
      {!expanded && hiddenCount > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExpanded(true);
          }}
          className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
          title={items.slice(max).map((i) => i.label).join(", ")}
        >
          +{hiddenCount}
        </button>
      )}
    </div>
  );
}
