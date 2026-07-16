// ============================================================
// DASHBOARD ĐIỀU KHIỂN (trang chủ)
// Lưới sản phẩm + filter theo mindmap: ngày thêm, tag, giá, ngành hàng.
// Đây là server component: đọc thẳng database, không cần gọi API.
// ============================================================
import { prisma } from "@/lib/db";
import { getCnyVndRate } from "@/lib/currency";
import { type ProductCardData } from "@/components/ProductCard";
import ProductGrid from "@/components/ProductGrid";
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
        ...(category ? { categories: { some: { id: Number(category) } } } : {}),
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
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: "'Space Grotesk', sans-serif", background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
        >
          Dashboard
        </h1>
        <AddProductForm />
      </div>

      <Suspense>
        <FilterBar tags={tags} categories={categories} />
      </Suspense>

      {sorted.length === 0 ? (
        <div
          className="text-center py-24 space-y-3"
          style={{ color: "var(--text-muted)" }}
        >
          <div style={{ fontSize: "3rem", opacity: 0.4 }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto" }}>
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </div>
          <p className="font-medium" style={{ color: "var(--text-secondary)" }}>Chưa có sản phẩm nào khớp bộ lọc.</p>
          <p className="text-sm">Bấm &quot;Thêm sản phẩm&quot; để bắt đầu.</p>
        </div>
      ) : (
        <ProductGrid products={sorted} rate={rate} mode="dashboard" />
      )}
    </div>
  );
}
