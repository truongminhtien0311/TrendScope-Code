"use client";

// Lưới sản phẩm trên Dashboard + chế độ "Chọn nhiều" để xem/xuất Báo cáo
// trình bày (src/app/report/page.tsx, src/app/api/report/pdf) cho nhiều
// sản phẩm cùng lúc. KHÔNG bật chế độ chọn thì hành vi y hệt trước giờ
// (bấm thẻ -> chuyển sang trang chi tiết).
import { useState } from "react";
import ProductCard, { type ProductCardData } from "@/components/ProductCard";

export default function ProductGrid({ products, rate }: { products: ProductCardData[]; rate: number }) {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  function toggleSelect(id: number) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds([]);
  }

  const idsParam = selectedIds.join(",");

  return (
    <div className="space-y-3 pb-16">
      <div className="flex justify-end">
        {selectMode ? (
          <button
            onClick={exitSelectMode}
            className="text-sm rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Hủy chọn
          </button>
        ) : (
          <button
            onClick={() => setSelectMode(true)}
            className="text-sm rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ☑️ Chọn nhiều
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            rate={rate}
            selectable={selectMode}
            selected={selectedIds.includes(p.id)}
            onToggleSelect={toggleSelect}
          />
        ))}
      </div>

      {selectMode && selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg px-4 py-3">
          <span className="text-sm font-medium">Đã chọn {selectedIds.length} sản phẩm</span>
          <button
            onClick={() => {
              // window.location (không phải router.push) — CỐ Ý bắt buộc
              // tải lại trang thật, vì Next.js giữ nguyên Sidebar đã render
              // khi chuyển trang kiểu client-side (xem src/app/layout.tsx).
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
        </div>
      )}
    </div>
  );
}
