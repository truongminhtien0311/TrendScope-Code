"use client";

// Nút "Dùng ảnh link này làm ảnh đại diện sản phẩm".
// Mặc định hệ thống tự chọn (ưu tiên shop bán lẻ thêm sớm nhất —
// xem src/lib/product-image.ts); nút này cho người dùng chọn tay link khác.
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetMainImageButton({
  productId,
  listingId,
  isCurrentSource, // link này đang cấp ảnh đại diện
}: {
  productId: number;
  listingId: number;
  isCurrentSource: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function choose() {
    setBusy(true);
    await fetch(`/api/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mainImageListingId: listingId }),
    });
    setBusy(false);
    router.refresh();
  }

  if (isCurrentSource) {
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 whitespace-nowrap">
        ✓ Ảnh đại diện
      </span>
    );
  }

  return (
    <button
      onClick={choose}
      disabled={busy}
      className="text-xs px-2 py-1 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
      title="Lấy ảnh MAIN của link này làm ảnh đại diện sản phẩm"
    >
      {busy ? "..." : "Dùng làm ảnh đại diện"}
    </button>
  );
}
