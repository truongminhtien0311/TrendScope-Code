"use client";

// Thông báo hoàn thành: toast đẹp (sonner) + tiếng "ding" nhẹ tự tạo
// bằng Web Audio API (không cần file âm thanh, không lo license).
// Dùng khi cào dữ liệu xong (link mới/cào lại) hoặc AI tạo phân tích xong.
import { toast } from "sonner";

export function notifyDone(message: string) {
  toast.success(message);
  playChime();
}

function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;

    // 2 nốt sine ngắn, êm: C6 rồi E6, mỗi nốt fade out nhẹ
    [{ freq: 1046.5, start: 0 }, { freq: 1318.5, start: 0.12 }].forEach(({ freq, start }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.15, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + 0.32);
    });

    setTimeout(() => ctx.close(), 700);
  } catch {
    // Trình duyệt chặn audio tự động (chưa tương tác) — bỏ qua, toast vẫn hiện
  }
}
