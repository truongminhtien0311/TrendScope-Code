"use client";

// Nút thêm sản phẩm mới (Mục mẹ) trên Dashboard.
// Không bắt gõ tên trước — tạo thẳng 1 sản phẩm rỗng rồi vào trang chi
// tiết để dán link/ảnh. Tên tiếng Việt sẽ tự điền khi chạy "Phân tích AI"
// (rút ra từ dữ liệu gốc), người dùng vẫn sửa tay thoải mái sau đó.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="14" height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      style={{ animation: "spin-slow 0.8s linear infinite" }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  );
}

export default function AddProductForm() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function create() {
    setCreating(true);
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setCreating(false);
    if (res.ok) {
      const created = await res.json();
      router.push(`/products/${created.id}`);
      router.refresh();
    } else {
      toast.error("Không tạo được sản phẩm, thử lại nhé.");
    }
  }

  return (
    <button
      onClick={create}
      disabled={creating}
      className="btn-primary"
    >
      {creating ? <SpinnerIcon /> : <PlusIcon />}
      {creating ? "Đang tạo..." : "Thêm sản phẩm"}
    </button>
  );
}
