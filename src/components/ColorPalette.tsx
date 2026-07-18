"use client";

// Bảng màu dạng lưới nhiều hàng (giống kiểu Messenger/Zalo): 1 hàng màu
// tươi, 1 hàng pastel nhạt, 1 hàng xám, 2 hàng màu đậm/trầm — cộng
// thêm hàng "Gần đây" (màu tùy chọn gần nhất, lưu localStorage) và
// "Màu khác" (mở ô chọn màu tự do). Dùng chung cho Tag (và sau này chỗ
// nào cần chọn màu).
import { useEffect, useState } from "react";

const COLUMNS: string[][] = [
  // Gray
  ["#f8fafc", "#e2e8f0", "#94a3b8", "#475569", "#1e293b"],
  // Red
  ["#fef2f2", "#fecaca", "#f87171", "#dc2626", "#991b1b"],
  // Orange
  ["#fff7ed", "#fed7aa", "#fb923c", "#ea580c", "#9a3412"],
  // Amber / Vàng
  ["#fffbeb", "#fde68a", "#fbbf24", "#d97706", "#92400e"],
  // Green
  ["#f0fdf4", "#bbf7d0", "#4ade80", "#16a34a", "#166534"],
  // Teal / Cyan
  ["#f0fdfa", "#99f6e4", "#2dd4bf", "#0d9488", "#115e59"],
  // Blue
  ["#eff6ff", "#bfdbfe", "#60a5fa", "#2563eb", "#1e40af"],
  // Indigo
  ["#eef2ff", "#c7d2fe", "#818cf8", "#4f46e5", "#3730a3"],
  // Purple
  ["#faf5ff", "#e9d5ff", "#c084fc", "#9333ea", "#6b21a8"],
  // Pink
  ["#fdf2f8", "#fbcfe8", "#f472b6", "#db2777", "#9d174d"],
];

const RECENT_KEY = "trendscope:recent-tag-colors";

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function pushRecent(color: string) {
  const current = loadRecent().filter((c) => c !== color);
  localStorage.setItem(RECENT_KEY, JSON.stringify([color, ...current].slice(0, 9)));
}

export default function ColorPalette({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đọc localStorage (chỉ có ở client) 1 lần lúc mount
    setRecent(loadRecent());
  }, []);

  function pick(color: string) {
    onChange(color);
    pushRecent(color);
    setRecent(loadRecent());
  }

  const Swatch = ({ c }: { c: string }) => {
    const isActive = value === c;
    return (
      <button
        key={c}
        type="button"
        onClick={() => pick(c)}
        className={`w-[26px] h-[26px] rounded-[10px] transition-all duration-200 shadow-sm hover:scale-110 hover:shadow-md ${
          isActive 
            ? "ring-2 ring-offset-2 ring-blue-500 dark:ring-cyan-400 dark:ring-offset-[#080f1f] z-10" 
            : "border border-slate-200 dark:border-slate-700/50"
        }`}
        style={{ backgroundColor: c }}
        title={c}
      />
    );
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        {COLUMNS.map((col, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            {col.map((c) => (
              <Swatch key={c} c={c} />
            ))}
          </div>
        ))}
      </div>

      {recent.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Gần đây</p>
          <div className="flex gap-1.5 flex-wrap">
            {recent.map((c) => (
              <Swatch key={c} c={c} />
            ))}
          </div>
        </div>
      )}

      <div className="pt-2 flex items-center">
        <label className="relative inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all cursor-pointer group shadow-sm">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">🎨 Tuỳ chỉnh</span>
          <div 
            className="w-5 h-5 rounded-md shadow-inner border border-slate-200 dark:border-slate-600" 
            style={{ backgroundColor: value }} 
          />
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => {
              pushRecent(e.target.value);
              setRecent(loadRecent());
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            title="Chọn màu tuỳ chỉnh"
          />
        </label>
      </div>
    </div>
  );
}
