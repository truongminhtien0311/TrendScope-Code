"use client";

// Kho theo dõi TOÀN CỤC các tác vụ AI chạy nền (phân tích sản phẩm, so
// sánh, tổng hợp hội đồng, chấm điểm đa trục) — mount 1 lần ở layout gốc
// (xem src/app/layout.tsx), theo đúng khuôn mẫu ConfirmDialogProvider.tsx
// (Context + Provider tự vẽ UI của chính nó).
//
// CHỦ ĐÍCH: đây là 1 bộ theo dõi RIÊNG, chạy SONG SONG với đồng hồ/poll cục
// bộ đã có sẵn trong AiAnalysisPanel.tsx/CompareTable.tsx/ScorePanel.tsx —
// KHÔNG thay thế logic đó (đang chạy ổn định, có comment giải thích kỹ).
// Mỗi nơi tạo việc chỉ cần gọi thêm registerTask() để việc đó cũng hiện ở
// đây, sống sót qua việc rời trang (khác với state cục bộ của từng panel).
// Đánh đổi: có thêm vài request GET nhẹ trùng lặp mỗi 2.5s — chấp nhận
// được vì app chạy local từng máy, không phải server nhiều người dùng.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { notifyDone } from "@/lib/notify";
import { friendlyGeminiError } from "@/lib/llm";
import ElapsedBadge from "@/components/ElapsedBadge";

type TaskKind = "analyze" | "compare" | "synthesize" | "score";
type TaskStatus = "PENDING" | "DONE" | "FAILED";

interface PollResult {
  status: TaskStatus;
  errorMessage?: string | null;
}

export interface RegisterTaskInput {
  kind: TaskKind;
  label: string;
  // Trang gốc để điều hướng tới khi bấm "Xem kết quả" — trang đó đã tự
  // hiển thị đúng bản DONE mới nhất, widget không cần vẽ lại kết quả.
  targetHref: string;
  // Gọi lại đúng GET endpoint đã có sẵn (không tạo endpoint mới).
  poll: () => Promise<PollResult | null>;
  // Tạo lại y hệt lượt cũ (đúng tham số ban đầu, đã capture sẵn trong
  // closure của nơi gọi) — trả về hàm poll mới cho lượt thử lại.
  retry: () => Promise<{ poll: () => Promise<PollResult | null> } | null>;
}

interface BackgroundTask extends RegisterTaskInput {
  id: string;
  status: TaskStatus;
  startedAt: number;
  errorMessage: string | null;
  seen: boolean;
  retrying: boolean;
}

interface BackgroundTaskContextValue {
  registerTask: (input: RegisterTaskInput) => void;
}

const BackgroundTaskContext = createContext<BackgroundTaskContextValue | null>(null);

export function useBackgroundTasks(): BackgroundTaskContextValue {
  const ctx = useContext(BackgroundTaskContext);
  if (!ctx) throw new Error("useBackgroundTasks() phải dùng bên trong <BackgroundTaskProvider>");
  return ctx;
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `bg-task-${Date.now()}-${idCounter}`;
}

const POLL_MS = 2500;
// Đồng bộ với STALE_MS trong AiAnalysisPanel.tsx — quá 5 phút vẫn PENDING
// là dấu hiệu có thể đã treo (vd server khởi động lại giữa chừng), tránh
// huy hiệu này báo "đang chạy" mãi trong khi panel gốc đã báo treo.
const STALE_MS = 5 * 60 * 1000;

const KIND_ICON: Record<TaskKind, string> = {
  analyze: "🧠",
  compare: "🧠",
  synthesize: "🧑‍⚖️",
  score: "📊",
};

export default function BackgroundTaskProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [returnPoint, setReturnPoint] = useState<{ pathname: string; scrollY: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const registerTask = useCallback((input: RegisterTaskInput) => {
    setTasks((prev) => [
      ...prev,
      {
        ...input,
        id: nextId(),
        status: "PENDING",
        startedAt: Date.now(),
        errorMessage: null,
        seen: false,
        retrying: false,
      },
    ]);
  }, []);

  const hasPending = tasks.some((t) => t.status === "PENDING");

  // Đồng hồ dùng chung cho mọi task PENDING — chỉ chạy khi cần, tick mỗi
  // giây, giống convention ElapsedBadge.tsx/CompareTable.tsx đang dùng.
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasPending]);

  // 1 vòng poll DUY NHẤT cho mọi task PENDING — tự dừng khi task đạt trạng
  // thái cuối (DONE/FAILED), tránh gọi tiếp vào dòng DB có thể đã bị panel
  // gốc tự xoá (xem cleanedFailedIds trong AiAnalysisPanel.tsx/CompareTable.tsx).
  useEffect(() => {
    if (!hasPending) return;
    const poll = setInterval(async () => {
      const pending = tasksRef.current.filter((t) => t.status === "PENDING");
      if (!pending.length) return;
      const results = await Promise.all(
        pending.map(async (t) => ({ id: t.id, res: await t.poll().catch(() => null) }))
      );

      // Báo cho người dùng dù đã rời trang gốc từ lâu — toast+âm thanh
      // (SoundBridge.tsx tự gắn "ding"/"lỗi" cho mọi toast.success/error).
      // Nếu cửa sổ app đang không được focus (thu nhỏ / đang xem trang nguồn
      // hàng khác) và đây là bản Electron đã đóng gói (window.electronAPI
      // chỉ tồn tại lúc đó, xem electron/preload.js), thêm cả thông báo hệ
      // thống Windows thật — toast trong app vô nghĩa lúc không nhìn vào app.
      const isElectron = typeof window !== "undefined" && Boolean(window.electronAPI);
      const isUnfocused = typeof document !== "undefined" && (document.hidden || !document.hasFocus());
      for (const t of pending) {
        const found = results.find((r) => r.id === t.id);
        if (!found?.res || found.res.status === "PENDING") continue;
        const label = `${KIND_ICON[t.kind]} ${t.label}`;
        if (found.res.status === "DONE") {
          notifyDone(`✨ ${label} xong`);
          if (isElectron && isUnfocused) new Notification("TrendScope", { body: `${label} đã xong` });
        } else {
          const friendly = friendlyGeminiError(found.res.errorMessage);
          toast.error(`❌ ${label}: ${friendly}`);
          if (isElectron && isUnfocused) new Notification("TrendScope", { body: `${label} thất bại: ${friendly}` });
        }
      }

      setTasks((prev) =>
        prev.map((t) => {
          const found = results.find((r) => r.id === t.id);
          if (!found || !found.res || found.res.status === "PENDING") return t;
          return {
            ...t,
            status: found.res.status,
            errorMessage: found.res.status === "FAILED" ? found.res.errorMessage ?? "Thất bại." : null,
          };
        })
      );
    }, POLL_MS);
    return () => clearInterval(poll);
  }, [hasPending]);

  // Đóng bảng mở rộng khi click ra ngoài / bấm Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function dismiss(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function viewResult(task: BackgroundTask) {
    setReturnPoint({ pathname: window.location.pathname, scrollY: window.scrollY });
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, seen: true } : t)));
    setOpen(false);
    router.push(task.targetHref);
  }

  function goBack() {
    if (!returnPoint) return;
    const target = returnPoint;
    router.push(target.pathname);
    // Đợi trang đích render xong 2 khung hình rồi mới cuộn — tương đối,
    // không tuyệt đối chính xác nếu trang đích tải dữ liệu chậm.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.scrollTo(0, target.scrollY));
    });
    setReturnPoint(null);
  }

  async function retryTask(task: BackgroundTask) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, retrying: true } : t)));
    const result = await task.retry().catch(() => null);
    if (!result) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, retrying: false } : t)));
      return;
    }
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, poll: result.poll, status: "PENDING", startedAt: Date.now(), errorMessage: null, retrying: false, seen: false }
          : t
      )
    );
    // Nếu người dùng đang đứng ngay trang gốc, panel tại chỗ cũng cần thấy
    // dòng PENDING mới — tránh lệch dữ liệu giữa widget và panel.
    router.refresh();
  }

  const runningCount = tasks.filter((t) => t.status === "PENDING" && now - t.startedAt <= STALE_MS).length;
  const staleCount = tasks.filter((t) => t.status === "PENDING" && now - t.startedAt > STALE_MS).length;
  const failedCount = tasks.filter((t) => t.status === "FAILED").length;
  const doneUnseenCount = tasks.filter((t) => t.status === "DONE" && !t.seen).length;

  // Nối đủ các loại trạng thái đang có thay vì chỉ hiện 1 loại ưu tiên cao
  // nhất — chạy nhiều tác vụ cùng lúc (phân tích + so sánh...) dễ có vài
  // trạng thái khác nhau song song, ẩn bớt dễ bỏ sót việc đã xong/lỗi.
  const badgeParts: string[] = [];
  if (runningCount > 0) badgeParts.push(`⏳${runningCount}`);
  if (staleCount > 0) badgeParts.push(`⚠️${staleCount}`);
  if (failedCount > 0) badgeParts.push(`❌${failedCount}`);
  if (doneUnseenCount > 0) badgeParts.push(`✅${doneUnseenCount}`);
  const badgeLabel = badgeParts.length > 0 ? badgeParts.join(" · ") : `🗂 ${tasks.length} tác vụ`;
  const dotColor =
    failedCount > 0 || staleCount > 0
      ? "var(--accent-danger)"
      : runningCount > 0
        ? "var(--accent-primary)"
        : doneUnseenCount > 0
          ? "#10b981"
          : "var(--text-secondary)";

  return (
    <BackgroundTaskContext.Provider value={{ registerTask }}>
      {children}

      {/* Huy hiệu + bảng mở rộng — góc dưới-phải nhưng nâng lên khỏi đáy
          màn hình (bottom-24) để không đè lên UpdateNotifier.tsx (cũng
          bottom-right, hiếm khi hiện cùng lúc, nhưng để chỗ cho chắc). */}
      {tasks.length > 0 && (
        <div ref={rootRef} className="fixed bottom-24 right-4 z-50">
          {open && (
            <div className="absolute bottom-full right-0 mb-2 w-80 max-h-[70vh] overflow-y-auto card-glass p-3 space-y-2 text-sm">
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="title-gradient text-xs font-bold uppercase tracking-wide">Tác vụ AI</span>
                <button onClick={() => setOpen(false)} style={{ color: "var(--text-secondary)" }}>
                  ✕
                </button>
              </div>
              {tasks.map((t) => {
                const elapsedSec = t.status === "PENDING" ? Math.max(0, Math.floor((now - t.startedAt) / 1000)) : 0;
                const isStale = t.status === "PENDING" && now - t.startedAt > STALE_MS;
                return (
                  <div key={t.id} className="rounded-lg p-2.5 space-y-1.5" style={{ border: "1px solid var(--border-subtle)" }}>
                    <div className="flex items-start gap-2">
                      <span className="text-base shrink-0">{KIND_ICON[t.kind]}</span>
                      <span className="flex-1 text-xs font-medium leading-snug" style={{ color: "var(--text-primary)" }}>
                        {t.label}
                      </span>
                      <button onClick={() => dismiss(t.id)} className="shrink-0 text-xs" style={{ color: "var(--text-secondary)" }}>
                        ✕
                      </button>
                    </div>
                    {t.status === "PENDING" && !isStale && (
                      <div className="flex items-center gap-1.5 pl-6">
                        <span style={{ color: "var(--text-secondary)" }}>⏳ Đang chạy...</span>
                        <ElapsedBadge seconds={elapsedSec} />
                      </div>
                    )}
                    {t.status === "PENDING" && isStale && (
                      <div className="pl-6 space-y-1.5">
                        <p className="text-xs" style={{ color: "var(--accent-danger)" }}>
                          ⚠️ Có thể đã treo (quá 5 phút) — server có thể đã khởi động lại giữa chừng.
                        </p>
                        <button onClick={() => retryTask(t)} disabled={t.retrying} className="btn-ghost disabled:opacity-50">
                          {t.retrying ? "Đang thử lại..." : "🔄 Thử tạo lại"}
                        </button>
                      </div>
                    )}
                    {t.status === "DONE" && (
                      <div className="pl-6">
                        <button onClick={() => viewResult(t)} className="btn-primary">
                          ✅ Xem kết quả
                        </button>
                      </div>
                    )}
                    {t.status === "FAILED" && (
                      <div className="pl-6 space-y-1.5">
                        <p className="text-xs" style={{ color: "var(--accent-danger)" }}>
                          ❌ {friendlyGeminiError(t.errorMessage)}
                        </p>
                        <button onClick={() => retryTask(t)} disabled={t.retrying} className="btn-ghost disabled:opacity-50">
                          {t.retrying ? "Đang thử lại..." : "🔄 Phân tích lại"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={() => setOpen((v) => !v)}
            className="card-glass px-3 py-2 flex items-center gap-2 text-xs font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                background: dotColor,
                boxShadow: "0 0 6px var(--glow-primary)",
                animation: runningCount > 0 ? "pulse-dot 1.4s ease-in-out infinite" : undefined,
              }}
            />
            {badgeLabel}
          </button>
        </div>
      )}

      {/* Nút "Quay lại" trượt lên giữa phía dưới — chỉ hiện sau khi bấm
          "Xem kết quả" điều hướng rời khỏi vị trí đang thao tác. */}
      {returnPoint && (
        <div
          className="fixed bottom-6 left-1/2 z-[70]"
          style={{ transform: "translateX(-50%)", animation: "slide-up-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
        >
          <button onClick={goBack} className="btn-primary shadow-lg">
            ⬅ Quay lại
          </button>
        </div>
      )}
    </BackgroundTaskContext.Provider>
  );
}
