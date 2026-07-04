// ============================================================
// LUẬT CHỌN ẢNH ĐẠI DIỆN CHO SẢN PHẨM (theo mindmap):
//   1. Người dùng đã chọn tay link nào (mainImageListingId) -> dùng link đó
//   2. Chưa chọn -> ưu tiên SHOP BÁN LẺ, shop nào thêm SỚM NHẤT lấy trước
//   3. Không có shop bán lẻ nào có ảnh -> lấy từ NHÀ SẢN XUẤT (sớm nhất)
//   4. Không đâu có ảnh -> null (giao diện hiện icon 📦)
// ============================================================

export interface ListingForImage {
  id: number;
  sourceType: string; // "RETAIL" | "MANUFACTURER"
  createdAt: Date;
  images: { url: string; kind: string }[];
}

function mainImageOf(listing: ListingForImage): string | null {
  return listing.images.find((i) => i.kind === "MAIN")?.url ?? null;
}

export function resolveProductImage(
  listings: ListingForImage[],
  mainImageListingId: number | null
): string | null {
  // 1. Người dùng đã chọn tay
  if (mainImageListingId != null) {
    const chosen = listings.find((l) => l.id === mainImageListingId);
    const url = chosen ? mainImageOf(chosen) : null;
    if (url) return url;
    // link đã chọn bị xóa hoặc không còn ảnh -> rơi xuống luật mặc định
  }

  // 2 + 3. Bán lẻ trước, nhà sản xuất sau; trong nhóm thì sớm nhất trước
  const byPriority = [...listings].sort((a, b) => {
    if (a.sourceType !== b.sourceType) return a.sourceType === "RETAIL" ? -1 : 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  for (const listing of byPriority) {
    const url = mainImageOf(listing);
    if (url) return url;
  }
  return null;
}

// Link đang thực sự cấp ảnh đại diện (để giao diện đánh dấu "✓ đang dùng")
export function resolveImageSourceListingId(
  listings: ListingForImage[],
  mainImageListingId: number | null
): number | null {
  if (mainImageListingId != null) {
    const chosen = listings.find((l) => l.id === mainImageListingId);
    if (chosen && mainImageOf(chosen)) return chosen.id;
  }
  const byPriority = [...listings].sort((a, b) => {
    if (a.sourceType !== b.sourceType) return a.sourceType === "RETAIL" ? -1 : 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  for (const listing of byPriority) {
    if (mainImageOf(listing)) return listing.id;
  }
  return null;
}
