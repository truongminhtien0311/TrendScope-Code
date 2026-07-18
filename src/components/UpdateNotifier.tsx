"use client";

// Lắng nghe trạng thái tự động cập nhật từ Electron (electron/main.js,
// electron/preload.js) và hiện 1 khung nhỏ góc dưới-phải — hiện RÕ từng
// bước (kiểm tra -> tải % -> tải xong -> tự đếm ngược cài đặt lại) thay
// vì chỉ 1 toast mờ nhạt lúc tải xong như trước. `window.electronAPI` chỉ
// tồn tại khi chạy trong bản Electron đã đóng gói — mở bằng trình duyệt
// thường (npm run dev) sẽ không có, component tự bỏ qua, không lỗi.
import { useEffect, useState } from "react";
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
  status: "checking" | "available" | "downloading" | "not-available" | "downloaded" | "error";
  version?: string;
  percent?: number;
  message?: string;
}

// Tải xong -> tự đếm ngược rồi cài đặt + khởi động lại, không bắt người
// dùng phải tự bấm nút (đúng yêu cầu "tự khởi động lại khi cài đặt thành
// công") — vẫn chừa vài giây + nút "Cài đặt ngay" để không cắt ngang đột
// ngột lúc người dùng đang thao tác dở.
const AUTO_INSTALL_COUNTDOWN_S = 10;

export default function UpdateNotifier() {
  const [state, setState] = useState<UpdateStatus | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.onUpdateStatus((data) => {
      setState(data);
      if (data.status === "error") {
        toast.error("Kiểm tra cập nhật thất bại: " + (data.message ?? "lỗi không rõ"));
      }
    });
  }, []);

  useEffect(() => {
    // Không cần reset countdown về null khi rời trạng thái "downloaded" —
    // JSX chỉ đọc countdown lúc status === "downloaded" nên giá trị cũ còn
    // sót lại không hiển thị ra đâu cả.
    if (state?.status !== "downloaded") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- khởi tạo số đếm ngược khi vừa chuyển sang "downloaded", không phải vòng lặp render
    setCountdown(AUTO_INSTALL_COUNTDOWN_S);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c === null) return null;
        if (c <= 1) {
          clearInterval(timer);
          setInstalling(true);
          window.electronAPI?.restartAndInstall();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [state?.status]);

  if (!state || state.status === "not-available" || state.status === "error") return null;

  const percent = state.status === "downloading" ? Math.min(100, Math.max(0, state.percent ?? 0)) : 100;

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] w-80 rounded-xl border shadow-lg p-4 space-y-2 text-sm"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-subtle)",
        color: "var(--text-primary)",
      }}
    >
      {state.status === "checking" && <p>🔎 Đang kiểm tra bản cập nhật mới...</p>}

      {state.status === "available" && (
        <p>📦 Đã tìm thấy bản cập nhật{state.version ? ` v${state.version}` : ""} — đang chuẩn bị tải...</p>
      )}

      {state.status === "downloading" && (
        <>
          <p>⬇️ Đang tải bản cập nhật{state.version ? ` v${state.version}` : ""}... {percent}%</p>
          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${percent}%`, background: "var(--accent-primary)" }}
            />
          </div>
        </>
      )}

      {state.status === "downloaded" && (
        <>
          <p>
            {installing
              ? "🔄 Đang cài đặt và khởi động lại..."
              : `✅ Đã tải xong bản v${state.version ?? ""} — tự khởi động lại sau ${countdown}s để cài đặt.`}
          </p>
          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: "100%", background: "var(--accent-primary)" }} />
          </div>
          {!installing && (
            <button
              onClick={() => {
                setInstalling(true);
                window.electronAPI?.restartAndInstall();
              }}
              className="text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5"
            >
              Cài đặt ngay
            </button>
          )}
        </>
      )}
    </div>
  );
}
