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
  selectable,
  selected,
  onToggleSelect,
}: {
  product: ProductCardData;
  rate: number;
  // Chế độ chọn nhiều (xem src/components/ProductGrid.tsx) — không
  // truyền gì thì thẻ hoạt động y hệt trước giờ (bấm vào -> chuyển trang).
  selectable?: boolean;
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

  const cardClass =
    "block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition relative";

  const content = (
    <>
      {selectable && (
        <div
          className={`absolute top-2 left-2 z-10 w-5 h-5 rounded-md border-2 flex items-center justify-center text-xs ${
            selected ? "bg-blue-600 border-blue-600 text-white" : "bg-white/90 border-slate-300"
          }`}
        >
          {selected && "✓"}
        </div>
      )}
      <div className="aspect-square bg-slate-100 dark:bg-slate-800">
        {mainImage ? (
          <SmartImage src={mainImage} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">📦</div>
        )}
      </div>

      <div className="p-3 space-y-2">
        <h3 className="font-medium text-sm line-clamp-2">
          {product.name || <span className="text-slate-400 italic">(Chưa đặt tên)</span>}
        </h3>

        {(retailText || factoryText) && (
          <div className="flex flex-wrap gap-1.5" title="Giá tham khảo, có thể thay đổi theo thời điểm cào">
            {retailText && (
              <span className="inline-flex items-center rounded-lg bg-blue-600 dark:bg-blue-500 px-2.5 py-1.5 text-sm font-bold text-white shadow-sm">
                Giá bán lẻ: {retailText}
              </span>
            )}
            {factoryText && (
              <span className="inline-flex items-center rounded-lg bg-emerald-600 dark:bg-emerald-500 px-2.5 py-1.5 text-sm font-bold text-white shadow-sm">
                Giá nhập: {factoryText}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-1">
          <BadgeOverflowList
            items={product.categories.map((c) => ({
              key: `cat-${c.id}`,
              label: c.icon ? `${c.icon} ${c.name}` : c.name,
              className:
                "text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
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

        <p className="text-xs text-slate-500 dark:text-slate-400">
          {soldTotal > 0 && <>Đã bán {soldTotal.toLocaleString("vi-VN")} · </>}
          Thêm {new Date(product.createdAt).toLocaleDateString("vi-VN")}
        </p>
      </div>
    </>
  );

  if (selectable) {
    return (
      <button type="button" onClick={() => onToggleSelect?.(product.id)} className={`${cardClass} text-left w-full`}>
        {content}
      </button>
    );
  }

  return (
    <Link href={`/products/${product.id}`} className={cardClass}>
      {content}
    </Link>
  );
}
