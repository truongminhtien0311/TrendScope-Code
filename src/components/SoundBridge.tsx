"use client";

// Gắn âm thanh tinh tế cho TOÀN APP, tại 1 chỗ duy nhất:
// 1. Mọi toast báo thành công/lỗi (patch instance `toast` của sonner —
//    singleton, dùng chung cho hơn chục file component gọi toast.success()/
//    toast.error() nên không cần sửa từng nơi).
// 2. Mọi cú click vào nút bấm thường (sidebar, form, hành động...) qua 1
//    listener "delegation" gắn ở document — không cần sửa 46+ file <button>
//    rải khắp app. Nút nào tự phát âm riêng (vd SoundToggle) thì đánh dấu
//    data-sound-skip để tránh kêu 2 lần.
import { useEffect } from "react";
import { toast } from "sonner";
import { playSuccess, playError, playTap } from "@/lib/sound";

let patched = false;

export default function SoundBridge() {
  useEffect(() => {
    if (patched) return;
    patched = true;

    const originalSuccess = toast.success;
    const originalError = toast.error;

    toast.success = ((...args: Parameters<typeof toast.success>) => {
      playSuccess();
      return originalSuccess(...args);
    }) as typeof toast.success;

    toast.error = ((...args: Parameters<typeof toast.error>) => {
      playError();
      return originalError(...args);
    }) as typeof toast.error;
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const el = target?.closest<HTMLElement>('button, a.nav-item, [data-sound-tap]');
      if (!el || el.hasAttribute("data-sound-skip")) return;
      if (el instanceof HTMLButtonElement && el.disabled) return;
      playTap();
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}
