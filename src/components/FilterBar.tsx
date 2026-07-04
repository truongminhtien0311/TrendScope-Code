"use client";

// Thanh filter trên Dashboard (theo mindmap):
// 0. Tìm theo tên  1. Ngày thêm mới/cũ  2. Tag  3. Giá  4. Ngành hàng
// Filter được đưa lên URL (?q=...&sort=...) nên copy link là giữ nguyên bộ lọc.
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Props {
  tags: { id: number; name: string; icon: string | null }[];
  categories: { id: number; name: string; icon: string | null }[];
}

export default function FilterBar({ tags, categories }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/?${params.toString()}`);
  }

  const selectClass =
    "rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm";

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Tìm theo tên — gõ xong nhấn Enter */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setParam("q", q.trim());
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 Tìm theo tên... (Enter)"
          className={`${selectClass} w-56`}
        />
      </form>

      <select
        className={selectClass}
        value={searchParams.get("sort") ?? "newest"}
        onChange={(e) => setParam("sort", e.target.value)}
      >
        <option value="newest">Mới thêm trước</option>
        <option value="oldest">Cũ nhất trước</option>
        <option value="price_asc">Giá thấp → cao</option>
        <option value="price_desc">Giá cao → thấp</option>
      </select>

      <select
        className={selectClass}
        value={searchParams.get("tag") ?? ""}
        onChange={(e) => setParam("tag", e.target.value)}
      >
        <option value="">Tất cả tag</option>
        {tags.map((t) => (
          <option key={t.id} value={String(t.id)}>
            {t.icon ? `${t.icon} ` : ""}
            {t.name}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={searchParams.get("category") ?? ""}
        onChange={(e) => setParam("category", e.target.value)}
      >
        <option value="">Tất cả ngành hàng</option>
        {categories.map((c) => (
          <option key={c.id} value={String(c.id)}>
            {c.icon ? `${c.icon} ` : ""}
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
