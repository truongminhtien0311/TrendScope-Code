// ============================================================
// TRANG SO SÁNH SẢN PHẨM — nhận ?ids=1,2,3 (2-5 sản phẩm, xem
// src/components/ProductGrid.tsx cho điểm vào "☑️ Chọn nhiều" -> "⚖️ So sánh").
// Bảng dữ liệu gốc hiển thị luôn (không cần AI), phần phân tích AI chỉ
// chạy khi người dùng chọn mục đích so sánh + bấm nút (xem CompareTable.tsx).
// ============================================================
import { prisma } from "@/lib/db";
import { getCnyVndRate, cnyToVnd, formatVnd } from "@/lib/currency";
import ProductGrid from "@/components/ProductGrid";
import FilterBar from "@/components/FilterBar";
import CreateSessionButton from "@/components/CreateSessionButton";
import SmartImage from "@/components/SmartImage";

export const dynamic = "force-dynamic";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; sort?: string; tag?: string; category?: string; q?: string }>;
}) {
  const { ids } = await searchParams;
  const idList = (ids ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isFinite(n));

  const [products, rate] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: idList } },
      include: {
        listings: { include: { variants: true, images: true, reviews: true }, orderBy: { createdAt: "desc" } },
      },
    }),
    getCnyVndRate(),
  ]);

  const byId = new Map(products.map((p) => [p.id, p]));
  const ordered = idList.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);

  if (ordered.length < 2) {
    const { sort = "newest", tag, category, q } = await searchParams;
    const [allProducts, tags, categories] = await Promise.all([
      prisma.product.findMany({
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
    ]);

    const filtered = q
      ? allProducts.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
      : allProducts;

    const sorted = [...filtered];
    if (sort === "price_asc" || sort === "price_desc") {
      const minPrice = (p: any) => {
        const prices = p.listings.flatMap((l: any) => l.variants.map((v: any) => v.priceCny));
        return prices.length ? Math.min(...prices) : Infinity;
      };
      sorted.sort((a, b) =>
        sort === "price_asc" ? minPrice(a) - minPrice(b) : minPrice(b) - minPrice(a)
      );
    }

    // Dynamic import to avoid module issues if any, though we can just import at top
    // We will assume ProductGrid and FilterBar are imported at the top of the file
    return (
      <div className="space-y-6">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: "'Space Grotesk', sans-serif", background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
          >
            🛒 Chọn sản phẩm để so sánh
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Bạn cần chọn ít nhất 2 sản phẩm bằng cách tick vào ô vuông ở góc trên thẻ sản phẩm.
          </p>
        </div>

        <FilterBar tags={tags} categories={categories} />
        {sorted.length === 0 ? (
          <div className="text-center py-20 text-slate-500 dark:text-slate-400">
            <p className="text-4xl mb-3">📭</p>
            <p>Chưa có sản phẩm nào khớp bộ lọc.</p>
          </div>
        ) : (
          <ProductGrid products={sorted as any} rate={rate} mode="compare" />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: "'Space Grotesk', sans-serif", background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
        >
          ⚖️ Xác nhận {ordered.length} sản phẩm để so sánh
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Bấm &quot;Tạo phiên đánh giá&quot; để lưu lại bộ sản phẩm này — toàn bộ lượt so sánh AI và điểm đa trục sẽ
          gắn vào phiên, mở lại xem tiếp được sau (xem &quot;Lịch sử đánh giá&quot; ở sidebar).
        </p>
      </div>

      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {ordered.map((p) => {
          const img = p.listings.flatMap((l) => l.images).find((i) => i.kind === "MAIN") ??
            p.listings.flatMap((l) => l.images)[0];
          const prices = p.listings.flatMap((l) => l.variants.map((v) => v.priceCny));
          return (
            <li key={p.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
              {img ? (
                <SmartImage src={img.url} alt={p.name} className="w-full aspect-square rounded-lg object-cover" />
              ) : (
                <div className="w-full aspect-square rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl">
                  📦
                </div>
              )}
              <p className="text-sm font-medium line-clamp-2">{p.name || "(Chưa đặt tên)"}</p>
              {prices.length > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{formatVnd(cnyToVnd(Math.min(...prices), rate))}</p>
              )}
            </li>
          );
        })}
      </ul>

      <CreateSessionButton productIds={ordered.map((p) => p.id)} />
    </div>
  );
}
