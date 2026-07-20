// Thẻ sản phẩm trên Dashboard: ảnh đại diện, giá bán lẻ/giá nhập tách
// riêng, tag, ngành hàng, lượt bán.
// Ảnh đại diện chọn theo luật trong src/lib/product-image.ts
// (ưu tiên shop bán lẻ thêm sớm nhất, hoặc link người dùng chọn tay).
import Link from "next/link";
import { cnyToVnd, formatVnd } from "@/lib/currency";
import { resolveProductImage } from "@/lib/product-image";
import BadgeOverflowList from "@/components/BadgeOverflowList";
import SmartImage from "@/components/SmartImage";

// Kiểu dữ liệu khớp với query trong src/app/page.tsx
export interface ProductCardData {
  id: number;
  name: string;
  createdAt: Date;
  mainImageListingId: number | null;
  categories: { id: number; name: string; icon: string | null }[];
  tags: { id: number; name: string; color: string | null; icon: string | null }[];
  listings: {
    id: number;
    sourceType: string;
    createdAt: Date;
    soldTotal: number | null;
    variants: { priceCny: number }[];
    images: { url: string; kind: string }[];
  }[];
}

function priceRangeText(prices: number[], rate: number): string | null {
  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const minText = formatVnd(cnyToVnd(min, rate));
  return max > min ? `${minText} ~ ${formatVnd(cnyToVnd(max, rate))}` : minText;
}

export default function ProductCard({
  product,
  rate,
  backHref,
  selected,
  onToggleSelect,
}: {
  product: ProductCardData;
  rate: number;
  // Đường dẫn nơi đang đứng (Dashboard "/" hoặc chọn so sánh "/compare") —
  // gắn vào link để trang chi tiết hiện đúng nút Quay lại (xem BackButton.tsx).
  backHref?: string;
  // onToggleSelect nếu được truyền vào thì thẻ sẽ có ô checkbox góc phải
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
}) {
  const retailPrices = product.listings
    .filter((l) => l.sourceType === "RETAIL")
    .flatMap((l) => l.variants.map((v) => v.priceCny));
  const factoryPrices = product.listings
    .filter((l) => l.sourceType === "MANUFACTURER")
    .flatMap((l) => l.variants.map((v) => v.priceCny));
  const retailText = priceRangeText(retailPrices, rate);
  const factoryText = priceRangeText(factoryPrices, rate);

  const mainImage = resolveProductImage(product.listings, product.mainImageListingId);

  const soldTotal = product.listings.reduce((sum, l) => sum + (l.soldTotal ?? 0), 0);

  const href = backHref
    ? `/products/${product.id}?from=${encodeURIComponent(backHref)}`
    : `/products/${product.id}`;

  return (
    <div
      className="card-glass shimmer-hover flex flex-col relative group"
      style={{ transition: "box-shadow 0.25s ease, border-color 0.25s ease, transform 0.2s ease" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      {/* Checkbox góc phải (khi có onToggleSelect) */}
      {onToggleSelect && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleSelect(product.id);
          }}
          className="absolute top-3 right-3 z-20 w-6 h-6 rounded-md border-2 flex items-center justify-center text-xs transition-all hover:scale-110 shadow-sm"
          style={{
            background: selected ? "var(--accent-primary)" : "rgba(255,255,255,0.9)",
            borderColor: selected ? "var(--accent-primary)" : "var(--border-subtle)",
            color: selected ? "var(--text-on-accent)" : "transparent",
            boxShadow: selected ? `0 0 10px var(--glow-primary)` : undefined,
          }}
        >
          ✓
        </button>
      )}

      <Link href={href} className="flex-1 flex flex-col relative z-10">
        {/* Image */}
        <div
          className="aspect-square overflow-hidden"
          style={{ background: "var(--bg-card)", borderRadius: "var(--radius-card) var(--radius-card) 0 0" }}
        >
          {mainImage ? (
            <SmartImage
              src={mainImage}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-4xl"
              style={{ color: "var(--text-muted)" }}
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 space-y-2 flex-1 flex flex-col">
          <h3
            className="font-medium text-sm line-clamp-2"
            style={{ color: "var(--text-primary)", fontFamily: "'Inter', sans-serif" }}
          >
            {product.name || (
              <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                (Chưa đặt tên)
              </span>
            )}
          </h3>

          {/* Price badges */}
          {(retailText || factoryText) && (
            <div
              className="flex flex-wrap gap-1.5"
              title="Giá tham khảo, có thể thay đổi theo thời điểm cào"
            >
              {retailText && (
                <span className="badge-cyber badge-price-retail">
                  Bán lẻ: {retailText}
                </span>
              )}
              {factoryText && (
                <span className="badge-cyber badge-price-factory">
                  Nhập: {factoryText}
                </span>
              )}
            </div>
          )}

          {/* Tags & Categories */}
          <div className="flex flex-wrap gap-1">
            <BadgeOverflowList
              items={product.categories.map((c) => ({
                key: `cat-${c.id}`,
                label: c.icon ? `${c.icon} ${c.name}` : c.name,
                className: "text-xs px-2 py-0.5 rounded-full",
                style: {
                  background: "var(--border-subtle)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-subtle)",
                },
              }))}
              max={2}
            />
            <BadgeOverflowList
              items={product.tags.map((tag) => ({
                key: `tag-${tag.id}`,
                label: tag.icon ? `${tag.icon} ${tag.name}` : tag.name,
                className: "text-xs px-2 py-0.5 rounded-full text-white",
                style: { backgroundColor: tag.color ?? "#64748b" },
              }))}
              max={2}
            />
          </div>

          {/* Stats */}
          <p className="text-xs mt-auto" style={{ color: "var(--text-muted)" }}>
            {soldTotal > 0 && (
              <span
                style={{
                  color: soldTotal > 1000 ? "var(--accent-success)" : "var(--text-muted)",
                  fontWeight: soldTotal > 1000 ? 600 : 400,
                }}
              >
                ↑ {soldTotal.toLocaleString("vi-VN")} bán ·{" "}
              </span>
            )}
            {new Date(product.createdAt).toLocaleDateString("vi-VN")}
          </p>
        </div>
      </Link>
    </div>
  );
}
