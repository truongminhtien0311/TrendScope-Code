// ============================================================
// CATALOGUE SẢN PHẨM — bản "xuất dữ liệu sinh động", xem trực tiếp
// dạng lưới ảnh lớn (dùng lại ProductCard y hệt Dashboard) thay vì file
// CSV/Excel phẳng. Chữ vẫn chọn/copy được bình thường (HTML thường,
// không phải ảnh chụp màn hình). Nhận filter category/tag từ trang
// Xuất dữ liệu (src/components/ExportPanel.tsx) qua query string.
// ============================================================
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCnyVndRate } from "@/lib/currency";
import ProductCard, { type ProductCardData } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ categoryIds?: string; tagIds?: string }>;
}) {
  const { categoryIds, tagIds } = await searchParams;
  const categoryIdList = categoryIds ? categoryIds.split(",").map(Number).filter(Number.isFinite) : [];
  const tagIdList = tagIds ? tagIds.split(",").map(Number).filter(Number.isFinite) : [];

  const [products, rate] = await Promise.all([
    prisma.product.findMany({
      where: {
        ...(categoryIdList.length ? { categories: { some: { id: { in: categoryIdList } } } } : {}),
        ...(tagIdList.length ? { tags: { some: { id: { in: tagIdList } } } } : {}),
      },
      include: {
        categories: true,
        tags: true,
        listings: {
          select: {
            id: true,
            sourceType: true,
            createdAt: true,
            soldTotal: true,
            variants: { select: { priceCny: true } },
            images: { select: { url: true, kind: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }) as Promise<ProductCardData[]>,
    getCnyVndRate(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">🖼 Catalogue sản phẩm</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Xem dạng lưới ảnh lớn để giới thiệu/gửi cho người khác xem cho đẹp mắt — vẫn bôi đen
          chọn được tên/giá để copy như trang thường.
        </p>
        <Link href="/export" className="text-sm text-blue-500 hover:underline mt-1 inline-block">
          ← Quay lại Xuất dữ liệu
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400">Không có sản phẩm nào khớp bộ lọc đã chọn.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} rate={rate} />
          ))}
        </div>
      )}
    </div>
  );
}
