// ============================================================
// LỊCH SỬ PHIÊN ĐÁNH GIÁ — liệt kê các EvaluationSession đã tạo (xem
// prisma/schema.prisma), bấm vào mở lại /compare/[sessionId] xem tiếp
// toàn bộ lượt so sánh + điểm đa trục đã lưu.
// ============================================================
import { prisma } from "@/lib/db";
import { resolveProductImage } from "@/lib/product-image";
import CompareHistoryGrid from "@/components/CompareHistoryGrid";

export const dynamic = "force-dynamic";

export default async function CompareHistoryPage() {
  const sessions = await prisma.evaluationSession.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const allProductIds = [...new Set(sessions.flatMap((s) => JSON.parse(s.productIds) as number[]))];
  const products = await prisma.product.findMany({
    where: { id: { in: allProductIds } },
    select: {
      id: true,
      name: true,
      mainImageListingId: true,
      listings: { select: { id: true, sourceType: true, createdAt: true, images: { select: { url: true, kind: true } } } },
    },
  });
  const productById = new Map(
    products.map((p) => [
      p.id,
      { name: p.name, image: resolveProductImage(p.listings, p.mainImageListingId) },
    ])
  );

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: "'Space Grotesk', sans-serif", background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
        >
          🗂️ Lịch sử phiên đánh giá
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Mỗi phiên gom 1 bộ sản phẩm cùng toàn bộ lượt so sánh AI + điểm đa trục — bấm vào để mở lại xem tiếp.
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-20 text-slate-500 dark:text-slate-400">
          <p className="text-4xl mb-3">📭</p>
          <p>Chưa có phiên đánh giá nào — vào trang &quot;So sánh sản phẩm&quot; chọn ≥2 sản phẩm để tạo phiên mới.</p>
        </div>
      ) : (
        <CompareHistoryGrid
          sessions={sessions.map((s) => {
            const ids: number[] = JSON.parse(s.productIds);
            return {
              id: s.id,
              createdAt: s.createdAt.toISOString(),
              name: s.name,
              productIds: ids,
              products: ids.map((id) => productById.get(id) ?? { name: `#${id}`, image: null }),
            };
          })}
        />
      )}
    </div>
  );
}
