"use client";

// Lắng nghe trạng thái tự động cập nhật từ Electron (electron/main.js,
// electron/preload.js) và hiện toast đẹp bằng sonner — KHÔNG dùng hộp
// thoại mặc định xấu của Windows. Component này không render gì cả,
// chỉ có tác dụng phụ (side effect) lắng nghe sự kiện.
// `window.electronAPI` chỉ tồn tại khi chạy trong bản Electron đã đóng
// gói — mở bằng trình duyệt thường (npm run dev) sẽ không có, component
// tự bỏ qua, không lỗi.
import { useEffect } from "react";
import { toast } from "sonner";

declare global {
  interface Window {
    electronAPI?: {
      onUpdateStatus: (callback: (data: UpdateStatus) => void) => void;
      restartAndInstall: () => void;
      getAppVersion: () => Promise<string>;
    };
  }
}

interface UpdateStatus {
  status: "available" | "downloading" | "downloaded" | "error";
  version?: string;
  message?: string;
}

export default function UpdateNotifier() {
  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.onUpdateStatus((data) => {
      if (data.status === "available") {
        toast.info("Đang tải bản cập nhật mới...");
      } else if (data.status === "downloaded") {
        toast("🎉 Đã có bản cập nhật mới!", {
          description: data.version ? `Phiên bản ${data.version}` : undefined,
          duration: Infinity,
          action: {
            label: "Khởi động lại",
            onClick: () => window.electronAPI?.restartAndInstall(),
          },
        });
      } else if (data.status === "error") {
        toast.error("Kiểm tra cập nhật thất bại: " + (data.message ?? "lỗi không rõ"));
      }
    });
  }, []);

  return null;
}
