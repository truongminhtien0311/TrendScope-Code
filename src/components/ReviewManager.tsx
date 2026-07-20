"use client";

// Đánh giá người mua — sửa tay/thêm/xóa từng cái (mindmap: mọi trường
// phải nhập/sửa tay được, dùng khi API lỗi hoặc bổ sung dữ liệu).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import SmartImage from "@/components/SmartImage";

export interface ReviewData {
  id: number;
  contentOriginal: string;
  contentVi: string | null;
  rating: number | null;
  // Ảnh THẬT khách mua đính kèm — tự động cào về (xem
  // src/lib/scrapers/providers/otapi-taobao-tmall.ts), chỉ hiển thị
  // read-only ở đây, không thêm/xóa tay.
  images: { id: number; url: string }[];
}

export default function ReviewManager({
  listingId,
  reviews,
}: {
  listingId: number;
  reviews: ReviewData[];
}) {
  const [adding, setAdding] = useState(false);

  if (reviews.length === 0 && !adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
      >
        + Thêm đánh giá
      </button>
    );
  }

  return (
    <div>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
        Đánh giá của người mua
      </p>
      <ul className="space-y-1.5">
        {reviews.map((r) => (
          <ReviewRow key={r.id} review={r} listingId={listingId} />
        ))}
      </ul>
      {adding ? (
        <NewReviewRow listingId={listingId} onDone={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1.5"
        >
          + Thêm đánh giá
        </button>
      )}
    </div>
  );
}

function NewReviewRow({ listingId, onDone }: { listingId: number; onDone: () => void }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [rating, setRating] = useState("5");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!content.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/listings/${listingId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentVi: content.trim(), rating: Number(rating) }),
    });
    setSaving(false);
    if (res.ok) {
      onDone();
      router.refresh();
    }
  }

  const inputClass =
    "rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-sm";

  return (
    <div className="flex items-start gap-2 mt-1.5">
      <select value={rating} onChange={(e) => setRating(e.target.value)} className={inputClass}>
        {[5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>
            {n} ⭐
          </option>
        ))}
      </select>
      <input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Nội dung đánh giá..."
        className={`${inputClass} flex-1`}
      />
      <button onClick={save} disabled={saving} className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 py-1">
        {saving ? "..." : "Lưu"}
      </button>
      <button onClick={onDone} className="text-xs text-slate-500 dark:text-slate-400 hover:underline py-1">
        Hủy
      </button>
    </div>
  );
}

function ReviewRow({ review: r, listingId: _listingId }: { review: ReviewData; listingId: number }) {
  const router = useRouter();
  const confirmDialog = useConfirm();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(r.contentVi ?? r.contentOriginal);
  const [rating, setRating] = useState(String(r.rating ?? 5));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/reviews/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentVi: content.trim(), rating: Number(rating) }),
    });
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    }
  }

  async function remove() {
    if (!(await confirmDialog("Xóa đánh giá này?", { danger: true }))) return;
    const res = await fetch(`/api/reviews/${r.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  const inputClass =
    "rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-sm";

  if (editing) {
    return (
      <li className="flex items-start gap-2">
        <select value={rating} onChange={(e) => setRating(e.target.value)} className={inputClass}>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} ⭐
            </option>
          ))}
        </select>
        <input value={content} onChange={(e) => setContent(e.target.value)} className={`${inputClass} flex-1`} />
        <button onClick={save} disabled={saving} className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50">
          {saving ? "..." : "Lưu"}
        </button>
        <button onClick={() => setEditing(false)} className="text-xs text-slate-500 dark:text-slate-400 hover:underline">
          Hủy
        </button>
      </li>
    );
  }

  return (
    <li className="text-sm group">
      <div className="flex items-start gap-2">
        {r.rating && <span className="shrink-0">{"⭐".repeat(r.rating)}</span>}
        <span className="flex-1">
          {r.contentVi ?? r.contentOriginal}
          {r.contentVi && r.contentVi !== r.contentOriginal && (
            <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">{r.contentOriginal}</span>
          )}
        </span>
        <span className="opacity-0 group-hover:opacity-100 transition shrink-0 whitespace-nowrap">
          <button onClick={() => setEditing(true)} className="text-xs text-slate-500 dark:text-slate-400 hover:text-blue-500 mr-1.5">
            ✏️
          </button>
          <button onClick={remove} className="text-xs text-slate-500 dark:text-slate-400 hover:text-red-500">
            🗑️
          </button>
        </span>
      </div>
      {r.images.length > 0 && (
        <div className="flex gap-1 mt-1 overflow-x-auto no-scrollbar">
          {r.images.map((img) => (
            <SmartImage
              key={img.id}
              src={img.url}
              alt=""
              className="w-12 h-12 shrink-0 rounded object-cover border border-slate-200 dark:border-slate-800"
            />
          ))}
        </div>
      )}
    </li>
  );
}
