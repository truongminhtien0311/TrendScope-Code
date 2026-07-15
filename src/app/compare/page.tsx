// ============================================================
// TRANG SO SÁNH SẢN PHẨM — nhận ?ids=1,2,3 (2-5 sản phẩm, xem
// src/components/ProductGrid.tsx cho điểm vào "☑️ Chọn nhiều" -> "⚖️ So sánh").
// Bảng dữ liệu gốc hiển thị luôn (không cần AI), phần phân tích AI chỉ
// chạy khi người dùng chọn mục đích so sánh + bấm nút (xem CompareTable.tsx).
// ============================================================
import { prisma } from "@/lib/db";
import { getCnyVndRate } from "@/lib/currency";
import { DEFAULT_COMPARE_PRESETS, type PromptPreset } from "@/lib/llm";
import CompareTable, { type CompareProductData } from "@/components/CompareTable";

export const dynamic = "force-dynamic";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  const idList = (ids ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isFinite(n));

  const [products, rate, presetsSetting] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: idList } },
      include: {
        listings: { include: { variants: true, images: true, reviews: true }, orderBy: { createdAt: "desc" } },
      },
    }),
    getCnyVndRate(),
    prisma.setting.findUnique({ where: { key: "compare_prompt_presets" } }),
  ]);

  let presets: PromptPreset[] = DEFAULT_COMPARE_PRESETS;
  if (presetsSetting?.value) {
    try {
      const parsed = JSON.parse(presetsSetting.value);
      if (Array.isArray(parsed) && parsed.length > 0) presets = parsed;
    } catch {
      // JSON hỏng thì dùng bộ preset mặc định
    }
  }

  const byId = new Map(products.map((p) => [p.id, p]));
  const ordered = idList.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);

  if (ordered.length < 2) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Cần chọn ít nhất 2 sản phẩm để so sánh — quay lại Dashboard, bấm &quot;☑️ Chọn nhiều&quot; rồi
          &quot;⚖️ So sánh&quot;.
        </p>
      </div>
    );
  }

  const data: CompareProductData[] = ordered.map((p) => ({
    id: p.id,
    name: p.name,
    listings: p.listings.map((l) => ({
      sourceType: l.sourceType,
      platform: l.platform,
      titleOriginal: l.titleOriginal,
      soldTotal: l.soldTotal,
      variants: l.variants.map((v) => ({ priceCny: v.priceCny })),
      images: l.images.map((img) => ({ url: img.url, kind: img.kind })),
    })),
  }));

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">⚖️ So sánh {ordered.length} sản phẩm</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Bảng bên dưới dùng dữ liệu cào gốc — chọn mục đích so sánh rồi bấm &quot;Phân tích AI&quot; để xem góc
          nhìn sâu hơn.
        </p>
      </div>
      <CompareTable products={data} rate={rate} presets={presets} />
    </div>
  );
}
