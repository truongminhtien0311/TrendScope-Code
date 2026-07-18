"use client";

// Thanh "Quay lại" nổi trên trang Báo cáo trình bày (src/app/report/page.tsx).
// Trang đó ẩn Sidebar (dùng làm tài liệu xem/PDF) nên không có cách nào
// thoát ra ngoài trừ nút back của trình duyệt — thêm thanh này cho rõ ràng.
// Class "no-print" bị ẩn khi in/xuất PDF (xem globals.css), không lộ ra
// trong file PDF xuất qua Playwright (src/app/api/report/pdf/route.ts).
export default function ReportBackBar() {
  return (
    <div className="no-print sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200 px-6 py-3">
      <button
        onClick={() => history.back()}
        className="text-sm font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5"
      >
        ← Quay lại
      </button>
    </div>
  );
}
