"use client";

// Lưới sản phẩm trên Dashboard + chế độ "Chọn nhiều" để xem/xuất Báo cáo
// trình bày (src/app/report/page.tsx, src/app/api/report/pdf) cho nhiều
// sản phẩm cùng lúc. KHÔNG bật chế độ chọn thì hành vi y hệt trước giờ
// (bấm thẻ -> chuyển sang trang chi tiết).
import { useState } from "react";
import ProductCard, { type ProductCardData } from "@/components/ProductCard";

export default function ProductGrid({
  products,
  rate,
  mode = "dashboard",
}: {
  products: ProductCardData[];
  rate: number;
  mode?: "dashboard" | "compare";
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  function toggleSelect(id: number) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }



  const idsParam = selectedIds.join(",");

  return (
    <div className="space-y-3 pb-16">
      <div className="flex justify-end">
        {selectedIds.length > 0 && (
          <button
            onClick={() => setSelectedIds([])}
            className="text-sm rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Hủy chọn ({selectedIds.length})
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            rate={rate}
            selected={selectedIds.includes(p.id)}
            onToggleSelect={toggleSelect}
          />
        ))}
      </div>

      {selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg px-4 py-3">
          <span className="text-sm font-medium">Đã chọn {selectedIds.length} sản phẩm</span>
          
          {mode === "dashboard" && (
            <>
              <button
                onClick={() => {
                  window.location.href = `/report?ids=${idsParam}`;
                }}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                📄 Xem báo cáo
              </button>
              <button
                onClick={() => {
                  window.location.href = `/api/report/pdf?ids=${idsParam}`;
                }}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-sm"
              >
                📥 Tải PDF
              </button>
            </>
          )}

          {mode === "compare" && (
            selectedIds.length >= 2 && selectedIds.length <= 5 ? (
              <button
                onClick={() => {
                  window.location.href = `/compare?ids=${idsParam}`;
                }}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-sm font-medium"
              >
                ⚖️ So sánh
              </button>
            ) : (
              <span className="text-xs text-slate-400" title="So sánh cần chọn từ 2 đến 5 sản phẩm">
                ⚖️ So sánh (chọn 2-5 sản phẩm)
              </span>
            )
          )}
        </div>
      )}
    </div>
  );
}
