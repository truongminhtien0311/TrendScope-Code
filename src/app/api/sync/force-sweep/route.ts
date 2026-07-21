// API: POST /api/sync/force-sweep — ép chạy ngay việc đồng bộ ảnh lên
// Drive, không đợi chu kỳ quét định kỳ (xem src/instrumentation.ts). Dùng
// trước khi xuất dữ liệu để dọn sạch hàng chờ, tránh mang ảnh vỡ sang máy
// khác. runDriveSyncSweep() giờ xử lý HẾT hàng chờ mỗi lượt (không còn
// giới hạn số ảnh/lượt) nên vòng lặp dưới đây thường chỉ chạy 1 lần —
// giữ lại lặp tối đa MAX_ITERATIONS để chống trường hợp ảnh mới liên tục
// được thêm vào giữa lúc đang quét (cào dữ liệu đang chạy song song).
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
