// ============================================================
// TRẠNG THÁI ĐỒNG BỘ/LƯU TRỮ — cho khung hiển thị trực quan (xem
// SyncStatusPanel.tsx) và bước kiểm tra trước khi xuất dữ liệu (xem
// /api/sync/export). Chỉ đọc, không ghi gì — an toàn gọi liên tục (poll).
//
// CHỈ đếm số lượng, KHÔNG tính tổng dung lượng ảnh đang chờ (đọc byte
// từng file tốn chi phí, không đáng nếu endpoint bị poll mỗi vài giây) —
// quyết định đã chốt khi lên kế hoạch tính năng này.
// ============================================================
import { stat } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { resolveDatabaseFilePath } from "@/lib/paths";
import { PENDING_IMAGE_WHERE } from "./index";

export interface SyncStatus {
  pendingListingImages: number;
  pendingReviewImages: number;
  totalListingImages: number;
  totalReviewImages: number;
  lastSweepAt: string | null;
  driveEnabled: boolean;
  analysisCount: number;
  dbSizeBytes: number | null;
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const [
    pendingListingImages,
    pendingReviewImages,
    totalListingImages,
    totalReviewImages,
    lastSweepSetting,
    driveProvider,
    analysisCount,
  ] = await Promise.all([
    prisma.listingImage.count({ where: PENDING_IMAGE_WHERE }),
    prisma.reviewImage.count({ where: PENDING_IMAGE_WHERE }),
    prisma.listingImage.count(),
    prisma.reviewImage.count(),
    prisma.setting.findUnique({ where: { key: "drive_sync_last_run_at" } }),
    prisma.apiProvider.findFirst({ where: { kind: "STORAGE", name: "Google Drive", enabled: true } }),
    prisma.productAiAnalysis.count({ where: { status: "DONE" } }),
  ]);

  const dbSizeBytes = await stat(resolveDatabaseFilePath())
    .then((s) => s.size)
    .catch(() => null); // file có thể chưa tồn tại lúc mới khởi tạo, không sao

  return {
    pendingListingImages,
    pendingReviewImages,
    totalListingImages,
    totalReviewImages,
    lastSweepAt: lastSweepSetting?.value ?? null,
    driveEnabled: !!driveProvider,
    analysisCount,
    dbSizeBytes,
  };
}
