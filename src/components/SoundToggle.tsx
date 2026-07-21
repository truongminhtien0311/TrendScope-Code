"use client";

// Nút gạt Bật/Tắt âm thanh — cùng phong cách pill toggle với ThemeToggle.
// Mặc định BẬT (xem isSoundEnabled() trong src/lib/sound.ts): nếu người
// dùng chưa từng đụng vào, coi như họ muốn nghe âm thanh.
import { useEffect, useState } from "react";
import { isSoundEnabled, setSoundEnabled, playToggle } from "@/lib/sound";

export default function SoundToggle() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đọc từ localStorage, không có trên server nên không thể tính lúc render
    setEnabled(isSoundEnabled());
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setSoundEnabled(next);
    if (next) playToggle(); // phát thử để người dùng nghe ngay khi bật lại
  }

  return (
    <button
      onClick={toggle}
      title={enabled ? "Tắt âm thanh" : "Bật âm thanh"}
      data-sound-skip
      className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg transition-all"
      style={{ color: "var(--text-secondary)" }}
    >
      <div className="theme-toggle-track" aria-hidden="true">
        <div className={`theme-toggle-thumb ${enabled ? "dark-mode" : ""}`}>
          {enabled ? "🔊" : "🔇"}
        </div>
      </div>
      <span className="text-xs font-medium truncate">
        {enabled ? "Âm thanh: Bật" : "Âm thanh: Tắt"}
      </span>
    </button>
  );
}
