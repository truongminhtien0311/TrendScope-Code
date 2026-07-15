"use client";

// Quản lý ảnh của 1 listing — thêm bằng 2 CÁCH:
//   1. Bấm nút, chọn file từ máy (input file ẩn)
//   2. Bấm vào vùng, Ctrl+V dán ảnh copy trong clipboard
// Chia đúng 2 vùng theo mindmap:
//   - Ảnh đại diện & ảnh phụ (MAIN + GALLERY gộp, ảnh đầu tự thành MAIN)
//   - Ảnh mô tả (DESCRIPTION)
// Mỗi ảnh có nút xóa. Ảnh lưu vào public/uploads/ qua /api/uploads.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import SmartImage from "@/components/SmartImage";

export interface ImageData {
  id: number;
  url: string;
  kind: string;
}

export default function ImageManager({
  listingId,
  images,
}: {
  listingId: number;
  images: ImageData[];
}) {
  const mainGallery = images.filter((i) => i.kind === "MAIN" || i.kind === "GALLERY");
  const description = images.filter((i) => i.kind === "DESCRIPTION");
  const hasMain = images.some((i) => i.kind === "MAIN");

  return (
    <div className="space-y-3">
      <ImageZone
        title="🖼️ Ảnh đại diện & ảnh phụ"
        listingId={listingId}
        images={mainGallery}
        defaultKind={hasMain ? "GALLERY" : "MAIN"}
        thumbClass="w-24 h-24"
      />
      <ImageZone
        title="📝 Ảnh mô tả"
        listingId={listingId}
        images={description}
        defaultKind="DESCRIPTION"
        thumbClass="w-32 h-auto"
      />
    </div>
  );
}

function ImageZone({
  title,
  listingId,
  images,
  defaultKind,
  thumbClass,
}: {
  title: string;
  listingId: number;
  images: ImageData[];
  defaultKind: "MAIN" | "GALLERY" | "DESCRIPTION";
  thumbClass: string;
}) {
  const router = useRouter();
  const confirmDialog = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function uploadAndAttach(file: File, kind: string) {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch("/api/uploads", { method: "POST", body: form });
      if (!uploadRes.ok) {
        const data = await uploadRes.json().catch(() => null);
        throw new Error(data?.error ?? "Tải ảnh lên thất bại");
      }
      const { url } = await uploadRes.json();

      const attachRes = await fetch(`/api/listings/${listingId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, kind }),
      });
      if (!attachRes.ok) throw new Error("Lưu ảnh thất bại");

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setUploading(false);
    }
  }

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadAndAttach(file, defaultKind);
    e.target.value = ""; // cho chọn lại cùng file lần sau nếu cần
  }

  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const item = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"));
    if (!item) return;
    e.preventDefault();
    const file = item.getAsFile();
    if (file) uploadAndAttach(file, defaultKind);
  }

  async function removeImage(id: number) {
    if (!(await confirmDialog("Xóa ảnh này?", { danger: true }))) return;
    await fetch(`/api/images/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFilePicked}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-xs rounded-full border border-slate-300 dark:border-slate-700 px-2.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            📤 Tải ảnh lên
          </button>
        </div>
      </div>

      <div
        tabIndex={0}
        onPaste={onPaste}
        className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        title="Bấm vào đây rồi Ctrl+V để dán ảnh từ clipboard"
      >
        {images.length === 0 && !uploading && (
          <p className="text-xs text-slate-400 py-2 text-center">
            Chưa có ảnh — bấm &quot;Tải ảnh lên&quot; hoặc bấm vào đây rồi{" "}
            <kbd className="px-1 bg-slate-100 dark:bg-slate-800 rounded">Ctrl+V</kbd> để dán ảnh
          </p>
        )}
        <div className="flex gap-2 overflow-x-auto">
          {images.map((img) => (
            <div key={img.id} className="relative shrink-0 group">
              <SmartImage
                src={img.url}
                alt=""
                className={`${thumbClass} rounded-lg object-cover border border-slate-200 dark:border-slate-800`}
              />
              <button
                type="button"
                onClick={() => removeImage(img.id)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs opacity-0 group-hover:opacity-100 transition"
                title="Xóa ảnh"
              >
                ✕
              </button>
            </div>
          ))}
          {uploading && (
            <div className={`${thumbClass} rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-xs text-slate-400 shrink-0`}>
              Đang tải...
            </div>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
