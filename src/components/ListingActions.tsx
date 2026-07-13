"use client";

// 2 nút trên mỗi listing: "🔄 Cào lại" (cập nhật giá/dữ liệu mới)
// và "🗑️ Xóa link". Giá đã sửa tay (✍️) được giữ nguyên khi cào lại.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { notifyDone } from "@/lib/notify";
import { useConfirm } from "@/components/ConfirmDialogProvider";

export default function ListingActions({ listingId }: { listingId: number }) {
  const router = useRouter();
  const confirmDialog = useConfirm();
  const [rescraping, setRescraping] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function rescrape() {
    setRescraping(true);
    const res = await fetch(`/api/listings/${listingId}/rescrape`, { method: "POST" });
    setRescraping(false);
    if (res.ok) {
      notifyDone("Đã cào lại xong 🔄");
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Cào lại thất bại, thử lại nhé.");
    }
  }

  async function remove() {
    if (
      !(await confirmDialog("Xóa link này?\nPhân loại, ảnh, đánh giá của link sẽ bị xóa theo.", {
        danger: true,
      }))
    )
      return;
    setDeleting(true);
    const res = await fetch(`/api/listings/${listingId}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      router.refresh();
    } else {
      toast.error("Xóa thất bại, thử lại nhé.");
    }
  }

  const btnClass =
    "text-xs px-2 py-1 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap";

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={rescrape} disabled={rescraping || deleting} className={btnClass}>
        {rescraping ? "Đang cào lại..." : "🔄 Cào lại"}
      </button>
      <button
        onClick={remove}
        disabled={rescraping || deleting}
        className={`${btnClass} text-red-500 border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950`}
      >
        {deleting ? "Đang xóa..." : "🗑️ Xóa link"}
      </button>
    </div>
  );
}
