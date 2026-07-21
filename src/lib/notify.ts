"use client";

// Thông báo hoàn thành: toast đẹp (sonner) — âm thanh "ding" được gắn tự
// động cho MỌI toast.success() qua src/components/SoundBridge.tsx, không
// cần gọi tay ở đây nữa.
// Dùng khi cào dữ liệu xong (link mới/cào lại) hoặc AI tạo phân tích xong.
import { toast } from "sonner";

export function notifyDone(message: string) {
  toast.success(message);
}
