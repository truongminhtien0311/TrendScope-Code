"use client";

// Tạo 1 "Phiên đánh giá" mới (xem EvaluationSession, prisma/schema.prisma)
// từ danh sách sản phẩm đã chọn, rồi chuyển sang trang phiên đó — thay
// cho hành vi cũ (render bảng so sánh ngay tại chỗ theo URL query param,
// mất khi F5). Sản phẩm cùng bộ này bấm lại nút vẫn tạo phiên MỚI (không
// gộp vào phiên cũ) — mỗi lần bấm là 1 lượt cân nhắc độc lập, xem lại
// phiên cũ qua trang /compare/history.
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateSessionButton({ productIds }: { productIds: number[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setCreating(true);
    setError("");
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds, name: name.trim() || undefined }),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/compare/${data.sessionId}?from=${encodeURIComponent("/compare")}`);
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Tạo phiên đánh giá thất bại, thử lại nhé.");
      setCreating(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Đặt tên phiên (tuỳ chọn)..."
          className="text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 disabled:opacity-50"
        />
        <button
          onClick={create}
          disabled={creating}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium"
        >
          {creating ? "Đang tạo..." : "🚀 Tạo phiên đánh giá"}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
