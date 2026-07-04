// ============================================================
// DASHBOARD ĐIỀU KHIỂN (trang chủ)
// Lưới sản phẩm + filter theo mindmap: ngày thêm, tag, giá, ngành hàng.
// Đây là server component: đọc thẳng database, không cần gọi API.
// ============================================================
import { prisma } from "@/lib/db";
import { getCnyVndRate } from "@/lib/currency";
import ProductCard, { type ProductCardData } from "@/components/ProductCard";
import FilterBar from "@/components/FilterBar";
import AddProductForm from "@/components/AddProductForm";
import { Suspense } from "react";

export const dynamic = "force-dynamic"; // luôn đọc dữ liệu mới nhất

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; tag?: string; category?: string; q?: string }>;
}) {
  const { sort = "newest", tag, category, q } = await searchParams;

  const [products, tags, categories, rate] = await Promise.all([
    prisma.product.findMany({
      // Không lọc tên bằng SQL (SQLite LIKE không phân biệt hoa/thường
      // với ký tự tiếng Việt có dấu) — lọc bằng JS bên dưới thay vào đó.
      where: {
        ...(tag ? { tags: { some: { id: Number(tag) } } } : {}),
        ...(category ? { categoryId: Number(category) } : {}),
      },
      include: {
        category: true,
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
      orderBy: { createdAt: sort === "oldest" ? "asc" : "desc" },
    }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    getCnyVndRate(),
  ]);

  // Tìm theo tên bằng JS: toLowerCase() của JS xử lý đúng chữ có dấu
  // tiếng Việt, còn LIKE của SQLite thì không (chỉ ASCII a-z).
  const filtered: ProductCardData[] = q
    ? products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
    : products;

  // Sắp xếp theo giá (giá thấp nhất của sản phẩm) — làm ở đây vì
  // giá nằm trong variants, database không sort trực tiếp được
  const sorted: ProductCardData[] = [...filtered];
  if (sort === "price_asc" || sort === "price_desc") {
    const minPrice = (p: ProductCardData) => {
      const prices = p.listings.flatMap((l) => l.variants.map((v) => v.priceCny));
      return prices.length ? Math.min(...prices) : Infinity;
    };
    sorted.sort((a, b) =>
      sort === "price_asc" ? minPrice(a) - minPrice(b) : minPrice(b) - minPrice(a)
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <AddProductForm />
      </div>

      <Suspense>
        <FilterBar tags={tags} categories={categories} />
      </Suspense>

      {sorted.length === 0 ? (
        <div className="text-center py-20 text-slate-500 dark:text-slate-400">
          <p className="text-4xl mb-3">📭</p>
          <p>Chưa có sản phẩm nào khớp bộ lọc.</p>
          <p className="text-sm mt-1">Bấm &quot;+ Thêm sản phẩm&quot; để bắt đầu.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {sorted.map((p) => (
            <ProductCard key={p.id} product={p} rate={rate} />
          ))}
        </div>
      )}
    </div>
  );
}
