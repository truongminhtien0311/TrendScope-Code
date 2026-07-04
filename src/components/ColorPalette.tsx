"use client";

// Bảng màu dạng lưới nhiều hàng (giống kiểu Messenger/Zalo): 1 hàng màu
// tươi, 1 hàng pastel nhạt, 1 hàng xám, 2 hàng màu đậm/trầm — cộng
// thêm hàng "Gần đây" (màu tùy chọn gần nhất, lưu localStorage) và
// "Màu khác" (mở ô chọn màu tự do). Dùng chung cho Tag (và sau này chỗ
// nào cần chọn màu).
import { useEffect, useState } from "react";

const ROWS: string[][] = [
  // Hàng 1 — tươi sáng
  ["#ffffff", "#22d3ee", "#2dd4bf", "#4ade80", "#a3e635", "#3b82f6", "#fb923c", "#f472b6", "#a78bfa"],
  // Hàng 2 — pastel nhạt
  ["#f1f5f9", "#cffafe", "#ccfbf1", "#dcfce7", "#ecfccb", "#dbeafe", "#ffedd5", "#fce7f3", "#ede9fe"],
  // Hàng 3 — xám (trắng -> đen)
  ["#ffffff", "#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b", "#475569", "#334155", "#1e293b", "#0f172a"],
  // Hàng 4 — màu đậm vừa
  ["#0891b2", "#0d9488", "#16a34a", "#65a30d", "#2563eb", "#ea580c", "#db2777", "#7c3aed"],
  // Hàng 5 — màu trầm/tối
  ["#164e63", "#134e4a", "#14532d", "#3f6212", "#1e3a8a", "#7c2d12", "#831843", "#4c1d95"],
];

const RECENT_KEY = "product-scrap:recent-tag-colors";

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
  const [customOpen, setCustomOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đọc localStorage (chỉ có ở client) 1 lần lúc mount
    setRecent(loadRecent());
  }, []);

  function pick(color: string) {
    onChange(color);
    pushRecent(color);
    setRecent(loadRecent());
    setCustomOpen(false);
  }

  const Swatch = ({ c }: { c: string }) => (
    <button
      key={c}
      type="button"
      onClick={() => pick(c)}
      className={`w-6 h-6 rounded-full border-2 ${
        value === c ? "border-slate-900 dark:border-white" : "border-slate-200 dark:border-slate-700"
      }`}
      style={{ backgroundColor: c }}
      title={c}
    />
  );

  return (
    <div className="space-y-1.5">
      {ROWS.map((row, i) => (
        <div key={i} className="flex gap-1.5">
          {row.map((c) => (
            <Swatch key={c} c={c} />
          ))}
        </div>
      ))}

      {recent.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 mb-1">Gần đây</p>
          <div className="flex gap-1.5 flex-wrap">
            {recent.map((c) => (
              <Swatch key={c} c={c} />
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setCustomOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
      >
        🎨 Màu khác
      </button>
      {customOpen && (
        <input
          type="color"
          value={value}
          onChange={(e) => pick(e.target.value)}
          className="h-8 w-12 rounded cursor-pointer border border-slate-300 dark:border-slate-700 bg-transparent"
        />
      )}
    </div>
  );
}
