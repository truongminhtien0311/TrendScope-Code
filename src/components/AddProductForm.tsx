"use client";

// Nút thêm sản phẩm mới (Mục mẹ) trên Dashboard.
// Không bắt gõ tên trước — tạo thẳng 1 sản phẩm rỗng rồi vào trang chi
// tiết để dán link/ảnh. Tên tiếng Việt sẽ tự điền khi chạy "Phân tích AI"
// (rút ra từ dữ liệu gốc), người dùng vẫn sửa tay thoải mái sau đó.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
      className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium"
    >
      {creating ? "Đang tạo..." : "+ Thêm sản phẩm"}
    </button>
  );
}
