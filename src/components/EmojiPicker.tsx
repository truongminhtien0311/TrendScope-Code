"use client";

// Bảng chọn emoji dạng LƯỚI BẤM CHỌN (không gõ tay) — dùng chung cho
// CategoryManager và TagManager. Bấm vào ô hiện emoji đang chọn (hoặc
// dấu +) để mở lưới, bấm 1 emoji để chọn rồi tự đóng lại.
import { useState } from "react";

const COMMON_EMOJIS = [
  "😀", "😍", "🔥", "⭐", "❤️", "👍", "🎉", "✨",
  "🛍️", "🛒", "💰", "💎", "🎁", "📦", "🏷️", "📌",
  "👗", "👕", "👔", "👠", "👞", "👜", "⌚", "💄",
  "📱", "💻", "📷", "🔌", "🧺", "🏠", "🧼", "🛋️",
  "👶", "🧒", "🧸", "🐾", "🚗", "🏍️", "🚲", "✈️",
  "🏃", "⚽", "🏀", "🎮", "📚", "✏️", "🎨", "🎵",
  "🍔", "🍎", "☕", "🍺", "🌱", "🌿", "🌸", "🌈",
  "☀️", "🌙", "❄️", "💧", "🔋", "🔧", "🧰", "🧴",
];

export default function EmojiPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-14 h-9 shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg flex items-center justify-center"
        title="Chọn emoji"
      >
        {value || "➕"}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full left-0 mt-1 grid grid-cols-8 gap-1 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg w-64">
            {COMMON_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  onChange(e);
                  setOpen(false);
                }}
                className="text-lg rounded hover:bg-slate-100 dark:hover:bg-slate-800 w-7 h-7 flex items-center justify-center"
              >
                {e}
              </button>
            ))}
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="col-span-8 text-xs text-red-500 hover:underline mt-1"
              >
                Bỏ emoji
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
