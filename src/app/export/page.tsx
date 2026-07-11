// Trang xuất dữ liệu — chọn trường + định dạng (CSV/Excel), lọc theo
// tag/ngành hàng, tải file về máy.
import { prisma } from "@/lib/db";
import ExportPanel from "@/components/ExportPanel";

export const dynamic = "force-dynamic";

export default async function ExportPage() {
  const [categories, tags] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">📤 Xuất dữ liệu</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Chọn trường muốn xuất, lọc theo tag/ngành hàng (tùy chọn), rồi tải file CSV
          hoặc Excel về máy. Mỗi dòng là 1 phân loại sản phẩm (SKU).
        </p>
      </div>
      <ExportPanel categories={categories} tags={tags} />
    </div>
  );
}
