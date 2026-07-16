"use client";

// Hộp thoại xác nhận dùng chung cho CẢ APP — thay cho window.confirm() mặc
// định của trình duyệt/Electron (xấu, không theo dark mode/theme của app).
// Bọc 1 lần ở layout gốc (xem src/app/layout.tsx), rồi ở bất kỳ component
// nào chỉ cần gọi hook useConfirm() lấy về hàm confirm(message) trả về
// Promise<boolean> — dùng y hệt cú pháp window.confirm() cũ, chỉ thêm await.
import { createContext, useCallback, useContext, useRef, useState } from "react";

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean; // true = nút xác nhận màu đỏ (xóa, không hoàn tác...)
}

interface ConfirmRequest extends ConfirmOptions {
  message: string;
}

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm() phải dùng bên trong <ConfirmDialogProvider>");
  return ctx;
}

function WarningIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}

export default function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((message, options) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setRequest({ message, ...options });
    });
  }, []);

  function respond(value: boolean) {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setRequest(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <div
          className="dialog-overlay"
          onClick={() => respond(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="dialog-glass w-full max-w-sm p-5 space-y-4"
            style={
              request.danger
                ? { borderColor: "var(--accent-danger)", boxShadow: `0 0 0 1px var(--accent-danger), 0 0 40px var(--glow-danger), 0 16px 64px rgba(0,0,0,0.6)` }
                : undefined
            }
          >
            {/* Header */}
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: request.danger
                    ? "rgba(220,38,38,0.12)"
                    : "rgba(79,70,229,0.12)",
                  color: request.danger ? "var(--accent-danger)" : "var(--accent-primary)",
                  border: `1px solid ${request.danger ? "var(--accent-danger)" : "var(--border-accent)"}`,
                }}
              >
                {request.danger ? <WarningIcon /> : <InfoIcon />}
              </div>
              <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)", fontFamily: "'Space Grotesk', sans-serif" }}>
                {request.title ?? (request.danger ? "Xác nhận xóa" : "Xác nhận")}
              </h2>
            </div>

            {/* Message */}
            <p
              className="text-sm whitespace-pre-line leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              {request.message}
            </p>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                autoFocus
                onClick={() => respond(false)}
                className="btn-ghost"
              >
                {request.cancelLabel ?? "Hủy"}
              </button>
              <button
                type="button"
                onClick={() => respond(true)}
                className={request.danger ? "btn-danger" : "btn-primary"}
              >
                {request.confirmLabel ?? (request.danger ? "Xóa" : "Đồng ý")}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
