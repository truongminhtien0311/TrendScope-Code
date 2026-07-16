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

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
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

  return (
    <div className="filter-panel">
      {/* Search input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setParam("q", q.trim());
        }}
        className="relative"
      >
        <span
          className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--text-muted)" }}
        >
          <SearchIcon />
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tên... (Enter)"
          className="input-cyber"
          style={{ paddingLeft: "2rem", width: "220px" }}
        />
      </form>

      {/* Sort */}
      <select
        className="select-cyber"
        value={searchParams.get("sort") ?? "newest"}
        onChange={(e) => setParam("sort", e.target.value)}
        style={{ width: "auto" }}
      >
        <option value="newest">Mới thêm trước</option>
        <option value="oldest">Cũ nhất trước</option>
        <option value="price_asc">Giá thấp → cao</option>
        <option value="price_desc">Giá cao → thấp</option>
      </select>

      {/* Tag filter */}
      <select
        className="select-cyber"
        value={searchParams.get("tag") ?? ""}
        onChange={(e) => setParam("tag", e.target.value)}
        style={{ width: "auto" }}
      >
        <option value="">Tất cả tag</option>
        {tags.map((t) => (
          <option key={t.id} value={String(t.id)}>
            {t.icon ? `${t.icon} ` : ""}
            {t.name}
          </option>
        ))}
      </select>

      {/* Category filter */}
      <select
        className="select-cyber"
        value={searchParams.get("category") ?? ""}
        onChange={(e) => setParam("category", e.target.value)}
        style={{ width: "auto" }}
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
