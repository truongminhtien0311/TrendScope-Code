"use client";

// Hiệu ứng âm thanh tinh tế kiểu iPhone — sine wave tự tạo bằng Web Audio
// API (không cần file mp3, không lo bản quyền). Âm lượng thấp, thời lượng
// ngắn, có thể tắt hoàn toàn qua nút gạt trong Cài đặt.
//
// Mặc định BẬT: nếu chưa từng lưu lựa chọn trong localStorage thì coi như
// người dùng muốn nghe âm thanh (chỉ tắt hẳn khi họ tự tay gạt tắt).
const STORAGE_KEY = "soundEnabled";

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === null ? true : saved === "true";
}

export function setSoundEnabled(enabled: boolean) {
  window.localStorage.setItem(STORAGE_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent("soundEnabledChange", { detail: enabled }));
}

type Note = { freq: number; start: number; duration?: number; gain?: number };

// 1 AudioContext DÙNG CHUNG, sống suốt phiên làm việc — trước đây mỗi lần
// phát âm tự tạo 1 AudioContext MỚI rồi tự đóng bằng setTimeout, nên khi 2
// hành động kích hoạt gần như đồng thời (vd bấm Xóa: tap của click + warning
// của hộp thoại xác nhận cùng lúc) sẽ có 2 context tách biệt tranh giành
// thiết bị âm thanh hệ điều hành cùng lúc — gây rè/tịt/cắt tiếng. Dùng lại
// 1 context duy nhất, không bao giờ đóng, để mọi âm lên lịch chung — đúng
// cách Web Audio API được thiết kế để phát nhiều âm gối nhau êm ái.
let sharedCtx: AudioContext | null = null;

function getSharedAudioContext(): AudioContext | null {
  try {
    if (!sharedCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      sharedCtx = new Ctx();
    }
    // Electron/trình duyệt có thể tự treo context khi mất focus/im lặng lâu
    // — không resume trước thì lần phát tiếp theo im re, tưởng "tịt tiếng".
    if (sharedCtx.state === "suspended") sharedCtx.resume().catch(() => {});
    return sharedCtx;
  } catch {
    return null;
  }
}

function playNotes(notes: Note[]) {
  if (!isSoundEnabled()) return;
  const ctx = getSharedAudioContext();
  if (!ctx) return; // trình duyệt chặn audio tự động (chưa có tương tác) — bỏ qua, im lặng
  const now = ctx.currentTime;

  notes.forEach(({ freq, start, duration = 0.3, gain = 0.15 }) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, now + start);
    g.gain.linearRampToValueAtTime(gain, now + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
    osc.connect(g).connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + duration + 0.02);
  });
}

// Thành công: 2 nốt sine ngắn đi lên, êm (C6 → E6)
export function playSuccess() {
  playNotes([
    { freq: 1046.5, start: 0 },
    { freq: 1318.5, start: 0.12 },
  ]);
}

// Lỗi: 1 nốt trầm ngắn, hơi "tock" — không chói, không giống báo động
export function playError() {
  playNotes([{ freq: 220, start: 0, duration: 0.22, gain: 0.13 }]);
}

// Tap nhẹ cho hành động quan trọng (Lưu, Xóa, Xác nhận) — dùng dè
export function playTap() {
  playNotes([{ freq: 700, start: 0, duration: 0.08, gain: 0.08 }]);
}

// Gạt bật/tắt switch
export function playToggle() {
  playNotes([{ freq: 880, start: 0, duration: 0.09, gain: 0.09 }]);
}

// Cảnh báo (hộp thoại xác nhận xóa hiện ra) — 2 nốt trầm đi xuống, rõ hơn
// tap thường nhưng vẫn êm, không giật mình
export function playWarning() {
  playNotes([
    { freq: 587.3, start: 0, duration: 0.16, gain: 0.12 },
    { freq: 440, start: 0.1, duration: 0.2, gain: 0.12 },
  ]);
}
