// Nút "Quay lại" dùng chung cho các trang chi tiết (sản phẩm, phiên đánh
// giá...) — icon mũi tên trong khung tròn gradient (đúng màu accent của
// app, xem --accent-primary/--accent-secondary trong globals.css) + nhãn
// chữ, nhích nhẹ lúc hover. Chỉ hiện khi trang nhận được ?from=<đường dẫn
// nội bộ> hợp lệ từ nơi điều hướng tới (xem src/app/products/[id]/page.tsx,
// src/app/compare/[sessionId]/page.tsx) — không đoán mò lịch sử trình duyệt.
import Link from "next/link";

export default function BackButton({ href, label = "Quay lại" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 text-sm font-semibold transition-all hover:shadow-md"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
    >
      <span
        className="flex items-center justify-center w-7 h-7 rounded-full shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5"
        style={{
          background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
          color: "var(--text-on-accent)",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </span>
      {label}
    </Link>
  );
}
