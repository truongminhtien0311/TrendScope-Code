"use client";

// Lắng nghe trạng thái tự động cập nhật từ Electron (electron/main.js,
// electron/preload.js) và hiện 1 khung nhỏ góc dưới-phải, theo đúng design
// system "cosmic tech" của app (card-glass, gradient accent, glow) thay vì
// khung slate thô trước đây. `window.electronAPI` chỉ tồn tại khi chạy
// trong bản Electron đã đóng gói — mở bằng trình duyệt thường (npm run dev)
// sẽ không có, component tự bỏ qua, không lỗi.
//
// KHÔNG tự khởi động lại khi tải xong — người dùng có thể đang thao tác dở
// (nhập liệu, cào dữ liệu...), tự ý restart giữa chừng dễ mất việc đang làm.
// Tải xong chỉ hiện nút "Khởi động lại & cài đặt", người dùng tự bấm lúc
// rảnh tay; app vẫn dùng bình thường cho tới lúc đó.
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

export default function UpdateNotifier() {
  const [state, setState] = useState<UpdateStatus | null>(null);
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

  if (!state || state.status === "not-available" || state.status === "error") return null;

  const percent = state.status === "downloading" ? Math.min(100, Math.max(0, state.percent ?? 0)) : 100;
  const isBusy = state.status === "checking" || state.status === "downloading" || installing;

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] w-80 card-glass p-4 space-y-3 text-sm"
      style={{ animation: "scale-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
    >
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{
            background: "var(--accent-primary)",
            boxShadow: "0 0 6px var(--glow-primary)",
            animation: isBusy ? "pulse-dot 1.4s ease-in-out infinite" : undefined,
          }}
        />
        <span className="title-gradient text-xs font-bold uppercase tracking-wide">Cập nhật ứng dụng</span>
      </div>

      {state.status === "checking" && (
        <p style={{ color: "var(--text-secondary)" }}>Đang kiểm tra bản cập nhật mới...</p>
      )}

      {state.status === "available" && (
        <p style={{ color: "var(--text-secondary)" }}>
          Đã tìm thấy bản{state.version ? ` v${state.version}` : ""} — đang chuẩn bị tải...
        </p>
      )}

      {state.status === "downloading" && (
        <>
          <p style={{ color: "var(--text-secondary)" }}>
            Đang tải bản{state.version ? ` v${state.version}` : ""}...{" "}
            <span className="tabular-nums font-semibold" style={{ color: "var(--text-primary)" }}>
              {percent}%
            </span>
          </p>
          <div
            className="w-full h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--border-subtle)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${percent}%`,
                background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
                boxShadow: "0 0 8px var(--glow-primary)",
              }}
            />
          </div>
        </>
      )}

      {state.status === "downloaded" && (
        <>
          <p style={{ color: "var(--text-secondary)" }}>
            {installing ? (
              "Đang cài đặt và khởi động lại..."
            ) : (
              <>
                ✅ Đã tải xong bản{" "}
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  v{state.version ?? ""}
                </span>
                . Cài đặt khi bạn rảnh tay nhé.
              </>
            )}
          </p>
          {!installing && (
            <button
              onClick={() => {
                setInstalling(true);
                window.electronAPI?.restartAndInstall();
              }}
              className="btn-primary w-full justify-center"
            >
              🔄 Khởi động lại &amp; cài đặt
            </button>
          )}
        </>
      )}
    </div>
  );
}
