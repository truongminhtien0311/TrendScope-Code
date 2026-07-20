"use client";

// Huy hiệu đếm giây, dùng để gắn NGAY trên nút vừa bấm khi có thao tác
// chạy lâu (giải mã link, so sánh AI...) — người dùng biết app vẫn đang
// chạy chứ không bị treo. Chỉ là component hiển thị thuần (không tự tạo
// interval riêng) — nơi gọi tự tính `seconds` từ 1 đồng hồ dùng chung
// (xem CompareTable.tsx/AddListingForm.tsx) để KHÔNG tạo nhiều setInterval
// cùng lúc làm nặng trang khi có nhiều thao tác chạy song song.
export default function ElapsedBadge({ seconds }: { seconds: number }) {
  return (
    <span
      className="inline-flex items-center rounded-full bg-amber-400 dark:bg-amber-500 text-amber-950 text-[11px] font-bold font-mono px-1.5 py-0.5 tabular-nums shadow-sm animate-pulse"
      title="Thời gian đã chờ"
    >
      {seconds}s
    </span>
  );
}
