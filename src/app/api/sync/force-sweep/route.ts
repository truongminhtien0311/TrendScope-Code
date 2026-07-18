// API: POST /api/sync/force-sweep — ép chạy ngay việc đồng bộ ảnh lên
// Drive, không đợi chu kỳ 5 phút (xem src/instrumentation.ts). Dùng trước
// khi xuất dữ liệu để dọn sạch hàng chờ, tránh mang ảnh vỡ sang máy khác.
// Mỗi lượt runDriveSyncSweep() chỉ xử lý SWEEP_BATCH_SIZE=10 ảnh/bảng —
// gọi lặp lại tới khi hết hàng chờ hoặc chạm giới hạn lặp (tránh 1 request
// treo vô hạn nếu hàng chờ quá lớn).
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runDriveSyncSweep } from "@/lib/storage";
import { getSyncStatus } from "@/lib/storage/sync-status";

const MAX_ITERATIONS = 20;

export async function POST() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    await runDriveSyncSweep();
    const status = await getSyncStatus();
    if (status.pendingListingImages + status.pendingReviewImages === 0) {
      return NextResponse.json(status);
    }
  }
  return NextResponse.json(await getSyncStatus());
}
