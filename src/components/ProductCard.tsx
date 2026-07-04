// Thẻ sản phẩm trên Dashboard: ảnh đại diện, giá bán lẻ/giá nhập tách
// riêng, tag, ngành hàng, lượt bán.
// Ảnh đại diện chọn theo luật trong src/lib/product-image.ts
// (ưu tiên shop bán lẻ thêm sớm nhất, hoặc link người dùng chọn tay).
import Link from "next/link";
import { cnyToVnd, formatVnd } from "@/lib/currency";
import { resolveProductImage } from "@/lib/product-image";
import BadgeOverflowList from "@/components/BadgeOverflowList";

// Kiểu dữ liệu khớp với query trong src/app/page.tsx
export interface ProductCardData {
  id: number;
  name: string;
  createdAt: Date;
  mainImageListingId: number | null;
  categories: { id: number; name: string; icon: string | null }[];
  tags: { id: number; name: string; color: string | null }[];
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
}: {
  product: ProductCardData;
  rate: number;
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

  return (
    <Link
      href={`/products/${product.id}`}
      className="block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition"
    >
      <div className="aspect-square bg-slate-100 dark:bg-slate-800">
        {mainImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- ảnh từ sàn TQ, domain không cố định nên chưa dùng next/image
          <img src={mainImage} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">📦</div>
        )}
      </div>

      <div className="p-3 space-y-2">
        <h3 className="font-medium text-sm line-clamp-2">
          {product.name || <span className="text-slate-400 italic">(Chưa đặt tên)</span>}
        </h3>

        {(retailText || factoryText) && (
          <div className="text-xs space-y-0.5">
            {retailText && (
              <p className="text-blue-600 dark:text-blue-400 font-semibold">
                Giá bán lẻ (tham khảo): {retailText}
              </p>
            )}
            {factoryText && (
              <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
                Giá nhập (tham khảo): {factoryText}
              </p>
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
              label: tag.name,
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
    </Link>
  );
}
