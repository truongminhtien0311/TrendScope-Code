// ============================================================
// DỌN RÁC ẢNH LOCAL — gọi SAU KHI đã xóa các dòng ListingImage/ReviewImage
// liên quan trong database (cascade hoặc xóa tay). Vì tên file = hash NỘI
// DUNG ảnh (xem saveLocalImage/saveLocalBuffer trong src/lib/storage/index.ts),
// 2 dòng khác nhau — thậm chí khác bảng (1 ảnh sản phẩm trùng hệt 1 ảnh
// đánh giá) — có thể cùng trỏ tới 1 file vật lý duy nhất. Phải kiểm tra CẢ
// 2 bảng còn dòng nào tham chiếu tới file đó không TRƯỚC khi xóa thật,
// tránh xóa nhầm file nơi khác vẫn đang dùng.
// ============================================================
import { unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { resolveUploadsDir } from "@/lib/paths";

export async function deleteOrphanedLocalFiles(
  localPaths: (string | null | undefined)[]
): Promise<void> {
  const uniquePaths = [...new Set(localPaths.filter((p): p is string => !!p))];
  if (uniquePaths.length === 0) return;

  const uploadsDir = resolveUploadsDir();
  await Promise.all(
    uniquePaths.map(async (localPath) => {
      const [stillInListings, stillInReviews] = await Promise.all([
        prisma.listingImage.count({ where: { localPath } }),
        prisma.reviewImage.count({ where: { localPath } }),
      ]);
      if (stillInListings > 0 || stillInReviews > 0) return; // nơi khác vẫn đang dùng file này
      await unlink(path.join(uploadsDir, localPath)).catch(() => {}); // file có thể đã mất, không sao
    })
  );
}
