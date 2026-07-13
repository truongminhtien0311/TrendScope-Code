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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => respond(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-5 space-y-3"
          >
            <h2 className="text-base font-semibold">
              {request.title ?? (request.danger ? "⚠️ Xác nhận xóa" : "Xác nhận")}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">
              {request.message}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                autoFocus
                onClick={() => respond(false)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {request.cancelLabel ?? "Hủy"}
              </button>
              <button
                type="button"
                onClick={() => respond(true)}
                className={
                  request.danger
                    ? "rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-sm"
                    : "rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-sm"
                }
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
