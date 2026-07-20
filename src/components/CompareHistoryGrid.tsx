"use client";

// Lưới các phiên đánh giá ở trang Lịch sử đánh giá (src/app/compare/history/page.tsx)
// + chế độ tích chọn nhiều phiên để Xem báo cáo / Tải PDF gộp toàn bộ sản
// phẩm của các phiên đã chọn — dùng lại đúng route /report và
// /api/report/pdf như ProductGrid ở Dashboard (src/components/ProductGrid.tsx).
import { useState } from "react";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import SessionNameEditor from "@/components/SessionNameEditor";

interface SessionEntry {
  id: number;
  createdAt: string;
  name: string | null;
  productIds: number[];
  products: { name: string; image: string | null }[];
}

export default function CompareHistoryGrid({ sessions }: { sessions: SessionEntry[] }) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  function toggleSelect(sessionId: number) {
    setSelectedIds((prev) =>
      prev.includes(sessionId) ? prev.filter((x) => x !== sessionId) : [...prev, sessionId]
    );
  }

  const sessionIdsParam = selectedIds.join(",");

  return (
    <div className="space-y-3 pb-16">
      {selectedIds.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={() => setSelectedIds([])}
            className="text-sm rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Hủy chọn ({selectedIds.length})
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {sessions.map((s) => {
          const checked = selectedIds.includes(s.id);
          return (
            <div key={s.id} className="relative">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  toggleSelect(s.id);
                }}
                title="Tích chọn để xuất báo cáo"
                className="absolute top-3 left-3 z-10 w-5 h-5 rounded flex items-center justify-center border-2 transition-colors"
                style={{
                  borderColor: checked ? "var(--accent-primary)" : "var(--border-subtle)",
                  background: checked ? "var(--accent-primary)" : "var(--bg-card)",
                  color: "#fff",
                }}
              >
                {checked && "✓"}
              </button>

              <Link
                href={`/compare/${s.id}?from=${encodeURIComponent("/compare/history")}`}
                className="block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 pl-6">
                  <SessionNameEditor
                    sessionId={s.id}
                    name={s.name}
                    fallback={`Phiên #${s.id}`}
                    className="font-medium"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                    {new Date(s.createdAt).toLocaleString("vi-VN")}
                  </span>
                </div>

                <div className="flex items-center mt-3 mb-2" style={{ paddingLeft: "4px" }}>
                  {s.products.map((entry, i) => (
                    <div
                      key={i}
                      title={entry.name}
                      className="w-12 h-12 rounded-lg overflow-hidden border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 shadow-sm shrink-0 flex items-center justify-center text-lg"
                      style={{
                        marginLeft: i === 0 ? 0 : "-18px",
                        transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (4 + i * 2)}deg)`,
                        zIndex: s.products.length - i,
                      }}
                    >
                      {entry.image ? (
                        <SmartImage src={entry.image} alt={entry.name} className="w-full h-full object-cover" />
                      ) : (
                        "📦"
                      )}
                    </div>
                  ))}
                </div>

                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
                  {s.products.map((e) => e.name).join(" · ")}
                </p>
              </Link>
            </div>
          );
        })}
      </div>

      {selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg px-4 py-3">
          <span className="text-sm font-medium">Đã chọn {selectedIds.length} phiên</span>
          <button
            onClick={() => {
              window.location.href = `/report/session?ids=${sessionIdsParam}`;
            }}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            📄 Xem báo cáo
          </button>
          <button
            onClick={() => {
              window.location.href = `/api/report/pdf?sessionIds=${sessionIdsParam}`;
            }}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-sm"
          >
            📥 Tải PDF
          </button>
        </div>
      )}
    </div>
  );
}
