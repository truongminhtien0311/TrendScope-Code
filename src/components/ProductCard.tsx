// Thẻ sản phẩm trên Dashboard: ảnh đại diện, khoảng giá VNĐ,
// tag, ngành hàng, lượt bán.
// Ảnh đại diện chọn theo luật trong src/lib/product-image.ts
// (ưu tiên shop bán lẻ thêm sớm nhất, hoặc link người dùng chọn tay).
import Link from "next/link";
import { cnyToVnd, formatVnd } from "@/lib/currency";
import { resolveProductImage } from "@/lib/product-image";

// Kiểu dữ liệu khớp với query trong src/app/page.tsx
export interface ProductCardData {
  id: number;
  name: string;
  createdAt: Date;
  mainImageListingId: number | null;
  category: { name: string } | null;
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

export default function ProductCard({
  product,
  rate,
}: {
  product: ProductCardData;
  rate: number;
}) {
  const allPrices = product.listings.flatMap((l) => l.variants.map((v) => v.priceCny));
  const minPrice = allPrices.length ? Math.min(...allPrices) : null;
  const maxPrice = allPrices.length ? Math.max(...allPrices) : null;

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

        {minPrice !== null && maxPrice !== null && (
          <p className="text-blue-600 dark:text-blue-400 font-semibold text-sm">
            {formatVnd(cnyToVnd(minPrice, rate))}
            {maxPrice > minPrice && ` ~ ${formatVnd(cnyToVnd(maxPrice, rate))}`}
          </p>
        )}

        <div className="flex flex-wrap gap-1">
          {product.category && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {product.category.name}
            </span>
          )}
          {product.tags.map((tag) => (
            <span
              key={tag.id}
              className="text-xs px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: tag.color ?? "#64748b" }}
            >
              {tag.name}
            </span>
          ))}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          {soldTotal > 0 && <>Đã bán {soldTotal.toLocaleString("vi-VN")} · </>}
          Thêm {new Date(product.createdAt).toLocaleDateString("vi-VN")}
        </p>
      </div>
    </Link>
  );
}
