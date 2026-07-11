// Trang Đồng bộ dữ liệu giữa các máy — xuất toàn bộ dữ liệu lên Google
// Drive để gửi cho người khác, hoặc dán link Drive để nhập dữ liệu
// người khác gửi về (chỉ cộng thêm, không đè dữ liệu đã có).
import SyncPanel from "@/components/SyncPanel";

export default function SyncPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">🔄 Đồng bộ dữ liệu</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Mỗi máy chạy dữ liệu riêng — dùng tính năng này để gộp dữ liệu giữa các máy qua
          Google Drive. Nhập lại dữ liệu đã gửi trước đó không bị trùng, chỉ sản phẩm/link
          mới mới được thêm vào.
        </p>
      </div>
      <SyncPanel />
    </div>
  );
}
