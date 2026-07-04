// ============================================================
// TRANG TAG & NGÀNH HÀNG — thêm/xóa tùy ý (theo mindmap).
// Tag có màu riêng; đếm sẵn số sản phẩm đang dùng để xóa cho yên tâm.
// ============================================================
import { prisma } from "@/lib/db";
import TagManager from "@/components/TagManager";
import CategoryManager from "@/components/CategoryManager";

export const dynamic = "force-dynamic";

export default async function ManagePage() {
  const [tags, categories] = await Promise.all([
    prisma.tag.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">Tag &amp; Ngành hàng</h1>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <h2 className="font-semibold mb-3">🏷️ Tag</h2>
          <TagManager
            tags={tags.map((t) => ({
              id: t.id,
              name: t.name,
              color: t.color,
              productCount: t._count.products,
            }))}
          />
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <h2 className="font-semibold mb-3">📂 Ngành hàng</h2>
          <CategoryManager
            categories={categories.map((c) => ({
              id: c.id,
              name: c.name,
              productCount: c._count.products,
            }))}
          />
        </section>
      </div>

      <p className="text-xs text-slate-400">
        💡 Xóa tag/ngành hàng không xóa sản phẩm — sản phẩm chỉ được gỡ tag hoặc về
        &quot;chưa phân loại&quot;.
      </p>
    </div>
  );
}
