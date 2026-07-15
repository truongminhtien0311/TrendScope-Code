// ============================================================
// BÁO CÁO TRÌNH BÀY — bản CHỈ ĐỌC, đầy đủ chi tiết (mô tả, ảnh, phân
// loại+giá, đánh giá, đủ 7 mục phân tích AI) cho 1 hoặc nhiều sản phẩm,
// dùng để trình bày (xem web hoặc xuất PDF qua /api/report/pdf — xem
// src/lib/taobao-login cho cách dùng Playwright chung). KHÔNG có nút
// Sửa/Xóa/Tạo AI/Thêm link/tải ảnh nào — chỉ hiển thị.
//
// Luôn dùng class KHÔNG có "dark:" — Playwright mở context mới (không
// có theme dark đã lưu ở localStorage) nên PDF luôn ra nền trắng chữ
// đen; bản xem web cũng đồng nhất giao diện với PDF.
// Sidebar bị ẩn cho route này — xem src/middleware.ts + src/app/layout.tsx.
// ============================================================
import { prisma } from "@/lib/db";
import { getCnyVndRate, cnyToVnd, formatVnd, formatCny } from "@/lib/currency";
import ReactMarkdown from "react-markdown";
import SmartImage from "@/components/SmartImage";

export const dynamic = "force-dynamic";

const AI_SECTIONS: { key: keyof AiAnalysisData; icon: string; label: string }[] = [
  { key: "aiSummary", icon: "🤖", label: "Mô tả tổng hợp" },
  { key: "aiAudience", icon: "🎯", label: "Tệp khách hàng mục tiêu" },
  { key: "aiChannels", icon: "📣", label: "Kênh bán hàng & hướng tiếp thị" },
  { key: "aiCustomization", icon: "💡", label: "Gợi ý tùy chỉnh sản phẩm" },
  { key: "aiImportInfo", icon: "📦", label: "Nhập khẩu (HS Code, thuế, kiểm định)" },
  { key: "aiShipping", icon: "🚚", label: "Đóng gói & vận chuyển nội địa" },
  { key: "aiFeasibility", icon: "📊", label: "Đánh giá tính khả thi kinh doanh" },
];

interface AiAnalysisData {
  presetName: string | null;
  aiSummary: string | null;
  aiAudience: string | null;
  aiChannels: string | null;
  aiCustomization: string | null;
  aiImportInfo: string | null;
  aiShipping: string | null;
  aiFeasibility: string | null;
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
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
        categories: true,
        tags: true,
        listings: {
          include: {
            variants: true,
            images: { orderBy: { sortOrder: "asc" } },
            reviews: true,
          },
          orderBy: { createdAt: "desc" },
        },
        aiAnalyses: { where: { status: "DONE" }, orderBy: { startedAt: "desc" }, take: 1 },
      },
    }),
    getCnyVndRate(),
  ]);

  // Giữ đúng thứ tự người dùng đã chọn (Prisma "in" không đảm bảo giữ thứ tự).
  const byId = new Map(products.map((p) => [p.id, p]));
  const ordered = idList.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);

  if (ordered.length === 0) {
    return (
      <div className="bg-white text-slate-900 min-h-screen p-10">
        <p>Không tìm thấy sản phẩm nào — kiểm tra lại danh sách đã chọn.</p>
      </div>
    );
  }

  return (
    <div className="bg-white text-slate-900 min-h-screen">
      <div className="max-w-4xl mx-auto p-10 space-y-16">
        {ordered.map((product) => (
          <ReportProductSection key={product.id} product={product} rate={rate} />
        ))}
      </div>
    </div>
  );
}

interface ReportProduct {
  id: number;
  name: string;
  description: string | null;
  categories: { id: number; name: string; icon: string | null }[];
  tags: { id: number; name: string; color: string | null; icon: string | null }[];
  listings: ReportListing[];
  aiAnalyses: AiAnalysisData[];
}

function ReportProductSection({ product, rate }: { product: ReportProduct; rate: number }) {
  const priceRange = (sourceType: string) => {
    const prices = product.listings
      .filter((l) => l.sourceType === sourceType)
      .flatMap((l) => l.variants.map((v) => v.priceCny));
    if (!prices.length) return null;
    return { min: cnyToVnd(Math.min(...prices), rate), max: cnyToVnd(Math.max(...prices), rate) };
  };
  const retailRange = priceRange("RETAIL");
  const factoryRange = priceRange("MANUFACTURER");
  const soldTotal = product.listings.reduce((s, l) => s + (l.soldTotal ?? 0), 0);
  const soldMonthly = product.listings.reduce((s, l) => s + (l.soldMonthly ?? 0), 0);
  const retailListings = product.listings.filter((l) => l.sourceType === "RETAIL");
  const factoryListings = product.listings.filter((l) => l.sourceType === "MANUFACTURER");
  const analysis = product.aiAnalyses[0];

  return (
    <section className="space-y-6 break-inside-avoid" style={{ pageBreakAfter: "always" }}>
      <div>
        <h1 className="text-2xl font-bold">{product.name || "(Chưa đặt tên)"}</h1>
        {product.description && <p className="text-slate-600 mt-1">{product.description}</p>}
        <div className="flex flex-wrap gap-2 mt-2">
          {product.categories.map((c) => (
            <span key={c.id} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {c.icon ? `${c.icon} ` : ""}
              {c.name}
            </span>
          ))}
          {product.tags.map((t) => (
            <span
              key={t.id}
              className="text-xs px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: t.color ?? "#64748b" }}
            >
              {t.icon ? `${t.icon} ` : ""}
              {t.name}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <ReportStat label="Giá bán lẻ (tham khảo)" value={retailRange ? `${formatVnd(retailRange.min)} ~ ${formatVnd(retailRange.max)}` : "—"} />
        <ReportStat label="Giá nhập (tham khảo)" value={factoryRange ? `${formatVnd(factoryRange.min)} ~ ${formatVnd(factoryRange.max)}` : "—"} />
        <ReportStat label="Tổng lượt bán" value={soldTotal ? soldTotal.toLocaleString("vi-VN") : "—"} />
        <ReportStat label="Lượt bán tháng" value={soldMonthly ? soldMonthly.toLocaleString("vi-VN") : "—"} />
      </div>

      {analysis && (
        <div className="rounded-xl border border-slate-200 p-4 space-y-4">
          <h2 className="font-semibold">🧠 Phân tích AI toàn diện</h2>
          {AI_SECTIONS.map((s) =>
            analysis[s.key] ? (
              <div key={s.key}>
                <h3 className="text-sm font-semibold mb-1">
                  {s.icon} {s.label}
                </h3>
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{analysis[s.key] as string}</ReactMarkdown>
                </div>
              </div>
            ) : null
          )}
        </div>
      )}

      <ReportListingGroup title="🛍️ Shop bán lẻ (Taobao, Tmall, JD)" listings={retailListings} rate={rate} />
      <ReportListingGroup title="🏭 Nhà sản xuất (Alibaba, 1688)" listings={factoryListings} rate={rate} />
    </section>
  );
}

interface ReportListing {
  id: number;
  sourceType: string;
  platform: string;
  sellerName: string | null;
  titleOriginal: string | null;
  titleVi: string | null;
  descriptionOriginal: string | null;
  descriptionVi: string | null;
  soldTotal: number | null;
  soldMonthly: number | null;
  lastScrapedAt: Date | null;
  variants: { id: number; nameOriginal: string; nameVi: string | null; priceCny: number }[];
  images: { id: number; url: string }[];
  reviews: { id: number; contentOriginal: string; contentVi: string | null; rating: number | null }[];
}

function ReportListingGroup({ title, listings, rate }: { title: string; listings: ReportListing[]; rate: number }) {
  if (listings.length === 0) return null;
  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg">{title}</h2>
      {listings.map((l) => (
        <div key={l.id} className="rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{l.titleVi ?? l.titleOriginal ?? "(chưa có tên)"}</p>
              {l.titleVi && l.titleOriginal && <p className="text-xs text-slate-500 mt-0.5">{l.titleOriginal}</p>}
              {l.sellerName && <p className="text-xs text-slate-500 mt-0.5">🏪 {l.sellerName}</p>}
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-medium shrink-0">
              {l.platform}
            </span>
          </div>

          {l.images.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {l.images.map((img) => (
                <SmartImage key={img.id} src={img.url} alt="" className="w-full aspect-square object-cover rounded-lg" />
              ))}
            </div>
          )}

          {l.variants.length > 0 && (
            <table className="w-full text-sm">
              <tbody>
                {l.variants.map((v) => (
                  <tr key={v.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-1">{v.nameVi ?? v.nameOriginal}</td>
                    <td className="py-1 text-right whitespace-nowrap">{formatCny(v.priceCny)}</td>
                    <td className="py-1 text-right whitespace-nowrap font-medium text-blue-700">
                      {formatVnd(cnyToVnd(v.priceCny, rate))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {(l.descriptionVi || l.descriptionOriginal) && (
            <p className="text-sm">{l.descriptionVi ?? l.descriptionOriginal}</p>
          )}

          {l.reviews.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500">Đánh giá người mua</p>
              {l.reviews.map((r) => (
                <p key={r.id} className="text-sm text-slate-600">
                  {r.rating ? "⭐".repeat(r.rating) + " " : ""}
                  {r.contentVi ?? r.contentOriginal}
                </p>
              ))}
            </div>
          )}

          {l.lastScrapedAt && (
            <p className="text-xs text-slate-400">Cào dữ liệu lần cuối: {new Date(l.lastScrapedAt).toLocaleString("vi-VN")}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function ReportStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-semibold mt-1 text-sm">{value}</p>
    </div>
  );
}
