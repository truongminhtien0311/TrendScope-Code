// ============================================================
// BÁO CÁO TRÌNH BÀY — bản CHỈ ĐỌC, đầy đủ chi tiết (mô tả, ảnh, phân
// loại+giá, đánh giá, đủ 7 mục phân tích AI) cho 1 hoặc nhiều sản phẩm,
// dùng để trình bày (xem web hoặc xuất PDF qua /api/report/pdf — xem
// src/lib/taobao-login cho cách dùng Playwright chung). KHÔNG có nút
// Sửa/Xóa/Tạo AI/Thêm link/tải ảnh nào — chỉ hiển thị.
//
// Luôn dùng class KHÔNG có "dark:" — Playwright mở context mới (không
// có theme dark đã lưu ở localStorage) nên PDF luôn ra nền trắng chữ
// đen; bản xem web cũng đồng nhất giao diện với PDF. Style "sáng, sang
// trọng, tối giản": nhiều khoảng trắng, 1 màu nhấn (xanh) dùng tiết chế,
// đường kẻ mảnh thay viền box nặng.
// Sidebar bị ẩn cho route này — xem src/middleware.ts + src/app/layout.tsx.
// ============================================================
import { prisma } from "@/lib/db";
import { getCnyVndRate, cnyToVnd, formatVnd, formatCny } from "@/lib/currency";
import ReactMarkdown from "react-markdown";
import SmartImage from "@/components/SmartImage";
import ReportBackBar from "@/components/ReportBackBar";

export const dynamic = "force-dynamic";

const ACCENT = "#2563eb";
const ACCENT_SOFT = "#eff6ff";

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

  const exportDate = new Date().toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div className="bg-white text-slate-900 min-h-screen">
      <ReportBackBar />

      {/* Dải thương hiệu mảnh — in ra cả trong PDF, không phải điều hướng nên không cần ẩn */}
      <div className="border-b border-slate-100 px-10 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <span
          className="text-sm font-bold tracking-tight"
          style={{ fontFamily: "'Space Grotesk', sans-serif", color: ACCENT }}
        >
          TrendScope
        </span>
        <span className="text-xs text-slate-400">
          Báo cáo sản phẩm · {ordered.length} sản phẩm · {exportDate}
        </span>
      </div>

      <div className="max-w-4xl mx-auto px-10 py-12 space-y-20">
        {ordered.map((product, i) => (
          <ReportProductSection key={product.id} product={product} rate={rate} index={i} total={ordered.length} />
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

function ReportProductSection({
  product,
  rate,
  index,
  total,
}: {
  product: ReportProduct;
  rate: number;
  index: number;
  total: number;
}) {
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
    <section className="space-y-10">
      {index > 0 && <div className="border-t border-slate-100 -mt-4 mb-4" />}
      <div>
        {total > 1 && (
          <p className="text-xs font-semibold tracking-wide text-slate-400 mb-2">
            SẢN PHẨM {index + 1} / {total}
          </p>
        )}
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {product.name || "(Chưa đặt tên)"}
        </h1>
        <div className="w-10 h-[3px] rounded-full mt-3" style={{ background: ACCENT }} />
        {product.description && <p className="text-slate-500 mt-4 leading-relaxed">{product.description}</p>}
        {(product.categories.length > 0 || product.tags.length > 0) && (
          <div className="flex flex-wrap gap-2 mt-4">
            {product.categories.map((c) => (
              <span key={c.id} className="text-xs px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 border border-slate-100">
                {c.icon ? `${c.icon} ` : ""}
                {c.name}
              </span>
            ))}
            {product.tags.map((t) => (
              <span
                key={t.id}
                className="text-xs px-2.5 py-1 rounded-full text-white font-medium"
                style={{ backgroundColor: t.color ?? "#64748b" }}
              >
                {t.icon ? `${t.icon} ` : ""}
                {t.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-px bg-slate-100 rounded-2xl overflow-hidden">
        <ReportStat label="Giá bán lẻ" value={retailRange ? `${formatVnd(retailRange.min)} ~ ${formatVnd(retailRange.max)}` : "—"} />
        <ReportStat label="Giá nhập" value={factoryRange ? `${formatVnd(factoryRange.min)} ~ ${formatVnd(factoryRange.max)}` : "—"} />
        <ReportStat label="Tổng lượt bán" value={soldTotal ? soldTotal.toLocaleString("vi-VN") : "—"} />
        <ReportStat label="Lượt bán / tháng" value={soldMonthly ? soldMonthly.toLocaleString("vi-VN") : "—"} />
      </div>

      {analysis && (
        <div className="space-y-6">
          <SectionHeading icon="🧠" title="Phân tích AI toàn diện" />
          <div className="space-y-6">
            {AI_SECTIONS.map((s) =>
              analysis[s.key] ? (
                <div key={s.key} className="pl-4" style={{ borderLeft: `2px solid ${ACCENT_SOFT}` }}>
                  <h3 className="text-sm font-semibold mb-1.5 flex items-center gap-1.5">
                    <span>{s.icon}</span>
                    {s.label}
                  </h3>
                  <div className="prose prose-sm max-w-none prose-slate prose-p:leading-relaxed prose-p:text-slate-600">
                    <ReactMarkdown>{analysis[s.key] as string}</ReactMarkdown>
                  </div>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}

      <ReportListingGroup title="Shop bán lẻ" icon="🛍️" subtitle="Taobao, Tmall, JD" listings={retailListings} rate={rate} />
      <ReportListingGroup title="Nhà sản xuất" icon="🏭" subtitle="Alibaba, 1688" listings={factoryListings} rate={rate} />
    </section>
  );
}

function SectionHeading({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
        style={{ background: ACCENT_SOFT }}
      >
        {icon}
      </span>
      <h2 className="font-semibold text-base tracking-tight">{title}</h2>
    </div>
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

function ReportListingGroup({
  title,
  icon,
  subtitle,
  listings,
  rate,
}: {
  title: string;
  icon: string;
  subtitle: string;
  listings: ReportListing[];
  rate: number;
}) {
  if (listings.length === 0) return null;
  return (
    <div className="space-y-5">
      <div className="flex items-baseline gap-2">
        <SectionHeading icon={icon} title={title} />
        <span className="text-xs text-slate-400">{subtitle}</span>
      </div>
      {listings.map((l) => (
        <div key={l.id} className="rounded-2xl border border-slate-100 p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{l.titleVi ?? l.titleOriginal ?? "(chưa có tên)"}</p>
              {l.titleVi && l.titleOriginal && <p className="text-xs text-slate-400 mt-0.5">{l.titleOriginal}</p>}
              {l.sellerName && <p className="text-xs text-slate-400 mt-0.5">🏪 {l.sellerName}</p>}
            </div>
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium shrink-0"
              style={{ background: ACCENT_SOFT, color: ACCENT }}
            >
              {l.platform}
            </span>
          </div>

          {l.images.length > 0 && (
            <div className="grid grid-cols-4 gap-2.5">
              {l.images.map((img) => (
                <SmartImage key={img.id} src={img.url} alt="" className="w-full aspect-square object-cover rounded-xl" />
              ))}
            </div>
          )}

          {l.variants.length > 0 && (
            <table className="w-full text-sm">
              <tbody>
                {l.variants.map((v) => (
                  <tr key={v.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 text-slate-600">{v.nameVi ?? v.nameOriginal}</td>
                    <td className="py-2 text-right whitespace-nowrap text-slate-400">{formatCny(v.priceCny)}</td>
                    <td className="py-2 text-right whitespace-nowrap font-semibold" style={{ color: ACCENT }}>
                      {formatVnd(cnyToVnd(v.priceCny, rate))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {(l.descriptionVi || l.descriptionOriginal) && (
            <p className="text-sm text-slate-600 leading-relaxed">{l.descriptionVi ?? l.descriptionOriginal}</p>
          )}

          {l.reviews.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-400">Đánh giá người mua</p>
              {l.reviews.map((r) => (
                <p key={r.id} className="text-sm text-slate-500">
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
    <div className="bg-white p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-semibold mt-1.5 text-sm">{value}</p>
    </div>
  );
}
