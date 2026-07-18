// ============================================================
// LỊCH SỬ PHIÊN ĐÁNH GIÁ — liệt kê các EvaluationSession đã tạo (xem
// prisma/schema.prisma), bấm vào mở lại /compare/[sessionId] xem tiếp
// toàn bộ lượt so sánh + điểm đa trục đã lưu.
// ============================================================
import Link from "next/link";
import { prisma } from "@/lib/db";
import { resolveProductImage } from "@/lib/product-image";
import SmartImage from "@/components/SmartImage";
import SessionNameEditor from "@/components/SessionNameEditor";

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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {sessions.map((s) => {
            const ids: number[] = JSON.parse(s.productIds);
            const entries = ids.map((id) => productById.get(id) ?? { name: `#${id}`, image: null });
            return (
              <Link
                key={s.id}
                href={`/compare/${s.id}`}
                className="block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <SessionNameEditor
                    sessionId={s.id}
                    name={s.name}
                    fallback={`Phiên #${s.id}`}
                    className="font-medium"
                  />
                  <span className="text-xs text-slate-400 shrink-0">{s.createdAt.toLocaleString("vi-VN")}</span>
                </div>

                {/* Ảnh sản phẩm xếp chồng xiên như bộ bài — tránh chiếm quá nhiều
                    diện tích khi 1 phiên gom nhiều sản phẩm (tối đa 5). */}
                <div className="flex items-center mt-3 mb-2" style={{ paddingLeft: "4px" }}>
                  {entries.map((entry, i) => (
                    <div
                      key={i}
                      title={entry.name}
                      className="w-12 h-12 rounded-lg overflow-hidden border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 shadow-sm shrink-0 flex items-center justify-center text-lg"
                      style={{
                        marginLeft: i === 0 ? 0 : "-18px",
                        transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (4 + i * 2)}deg)`,
                        zIndex: entries.length - i,
                      }}
                    >
                      {entry.image ? (
                        <SmartImage src={entry.image} alt={entry.name} className="w-full h-full object-cover" />
                      ) : (
                        "📦"
                      )}
                    </div>
                  ))}
                </div>

                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
                  {entries.map((e) => e.name).join(" · ")}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
