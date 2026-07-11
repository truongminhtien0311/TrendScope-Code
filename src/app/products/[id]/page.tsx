// ============================================================
// TRANG CHI TIẾT SẢN PHẨM (Mục mẹ trong mindmap)
// - Thông tin phụ tham khảo: khoảng giá bán lẻ / giá xưởng, lượt bán
// - MỘT khung mô tả AI + tệp khách hàng cho CẢ sản phẩm (gộp dữ liệu
//   mọi link vào 1 request LLM — không tách theo từng link)
// - Danh sách link nguồn (Listing) chia 2 nhóm: Shop bán lẻ & Nhà sản xuất
// - Mỗi listing: phân loại + giá CNY/VNĐ, ảnh, mô tả, đánh giá (đã dịch),
//   nút chọn ảnh của link đó làm ảnh đại diện sản phẩm
// - Form dán link mới để cào dữ liệu
// ============================================================
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getCnyVndRate, cnyToVnd, formatVnd } from "@/lib/currency";
import { resolveImageSourceListingId } from "@/lib/product-image";
import AddListingForm from "@/components/AddListingForm";
import SetMainImageButton from "@/components/SetMainImageButton";
import EditProductForm from "@/components/EditProductForm";
import EditListingForm from "@/components/EditListingForm";
import AiAnalysisPanel from "@/components/AiAnalysisPanel";
import VariantTable, { type VariantData } from "@/components/VariantTable";
import ImageManager from "@/components/ImageManager";
import ReviewManager from "@/components/ReviewManager";
import ListingActions from "@/components/ListingActions";
import BadgeOverflowList from "@/components/BadgeOverflowList";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  // Chỉ nhận đường dẫn nội bộ (bắt đầu bằng "/") — tránh lỡ bị dùng để
  // redirect ra ngoài nếu link này bị chia sẻ/sửa tay.
  const backTo = from && from.startsWith("/") ? from : undefined;
  const [product, rate, allTags, allCategories, currentUser] = await Promise.all([
    prisma.product.findUnique({
      where: { id: Number(id) },
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
        // Lịch sử phân tích AI — tối đa 10 bản/sản phẩm (xem evictOldAnalyses
        // trong src/app/api/products/[id]/analyze/route.ts), mới nhất trước.
        aiAnalyses: { orderBy: { startedAt: "desc" }, take: 10 },
      },
    }),
    getCnyVndRate(),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    getCurrentUser(),
  ]);

  if (!product) notFound();

  // Thông tin phụ tham khảo: khoảng giá theo nhóm nguồn
  const priceRange = (sourceType: string) => {
    const prices = product.listings
      .filter((l) => l.sourceType === sourceType)
      .flatMap((l) => l.variants.map((v) => v.priceCny));
    if (!prices.length) return null;
    return {
      min: cnyToVnd(Math.min(...prices), rate),
      max: cnyToVnd(Math.max(...prices), rate),
    };
  };
  const retailRange = priceRange("RETAIL");
  const factoryRange = priceRange("MANUFACTURER");
  const soldTotal = product.listings.reduce((s, l) => s + (l.soldTotal ?? 0), 0);
  const soldMonthly = product.listings.reduce((s, l) => s + (l.soldMonthly ?? 0), 0);

  const retailListings = product.listings.filter((l) => l.sourceType === "RETAIL");
  const factoryListings = product.listings.filter((l) => l.sourceType === "MANUFACTURER");

  // Link nào đang cấp ảnh đại diện cho sản phẩm (chọn tay hoặc theo luật mặc định)
  const imageSourceId = resolveImageSourceListingId(
    product.listings,
    product.mainImageListingId
  );

  return (
    <div className="space-y-8 max-w-5xl">
      {backTo && (
        <Link
          href={backTo}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 text-sm font-semibold hover:opacity-90"
        >
          ⬅ Quay lại báo cáo
        </Link>
      )}
      {/* ---- Đầu trang: tên, tag, ngành hàng ---- */}
      <div>
        <h1 className="text-2xl font-bold">
          {product.name || <span className="text-slate-400 italic">(Chưa đặt tên — chạy Phân tích AI hoặc tự đặt)</span>}
        </h1>
        {product.description && (
          <p className="text-slate-600 dark:text-slate-300 mt-1">{product.description}</p>
        )}
        <div className="flex flex-wrap gap-2 mt-2">
          <BadgeOverflowList
            items={product.categories.map((c) => ({
              key: `cat-${c.id}`,
              label: c.icon ? `${c.icon} ${c.name}` : c.name,
            }))}
          />
          <BadgeOverflowList
            items={product.tags.map((t) => ({
              key: `tag-${t.id}`,
              label: t.icon ? `${t.icon} ${t.name}` : t.name,
              className: "text-xs px-2 py-0.5 rounded-full text-white",
              style: { backgroundColor: t.color ?? "#64748b" },
            }))}
          />
        </div>
        <EditProductForm
          product={{
            id: product.id,
            name: product.name,
            description: product.description,
            categoryIds: product.categories.map((c) => c.id),
            tagIds: product.tags.map((t) => t.id),
          }}
          allTags={allTags}
          allCategories={allCategories}
          isAdmin={currentUser?.role === "admin"}
        />
        {/* Dùng <a> thường (không phải next/link) — CỐ Ý bắt buộc tải lại
            trang thật, vì Next.js giữ nguyên Sidebar đã render từ layout
            gốc khi chuyển trang kiểu client-side, không nhận ra /report
            cần ẩn Sidebar (xem src/app/layout.tsx) nếu chỉ soft-navigate. */}
        <a
          href={`/report?ids=${product.id}`}
          className="inline-block mt-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          📄 Xem báo cáo trình bày
        </a>
      </div>

      {/* ---- Thông tin phụ tham khảo ---- */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Giá bán lẻ (tham khảo)"
          value={retailRange ? `${formatVnd(retailRange.min)} ~ ${formatVnd(retailRange.max)}` : "—"}
        />
        <StatCard
          label="Giá nhập (tham khảo)"
          value={factoryRange ? `${formatVnd(factoryRange.min)} ~ ${formatVnd(factoryRange.max)}` : "—"}
        />
        <StatCard label="Tổng lượt bán" value={soldTotal ? soldTotal.toLocaleString("vi-VN") : "—"} />
        <StatCard label="Lượt bán tháng" value={soldMonthly ? soldMonthly.toLocaleString("vi-VN") : "—"} />
      </section>

      {/* ---- Phân tích AI toàn diện: MỘT khung duy nhất cho cả sản phẩm,
           AI gộp dữ liệu của TẤT CẢ các link vào 1 request, sinh đủ 6 mục ---- */}
      <AiAnalysisPanel
        productId={product.id}
        analyses={product.aiAnalyses.map((a) => ({
          ...a,
          startedAt: a.startedAt.toISOString(),
          finishedAt: a.finishedAt ? a.finishedAt.toISOString() : null,
        }))}
      />

      {/* ---- Thêm link mới ---- */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 className="font-semibold mb-3">🔗 Thêm link sản phẩm để cào dữ liệu</h2>
        <AddListingForm productId={product.id} />
      </section>

      {/* ---- Nhóm shop bán lẻ ---- */}
      <ListingGroup
        title="🛍️ Shop bán lẻ (Taobao, Tmall, JD)"
        listings={retailListings}
        rate={rate}
        productId={product.id}
        imageSourceId={imageSourceId}
      />

      {/* ---- Nhóm nhà sản xuất ---- */}
      <ListingGroup
        title="🏭 Nhà sản xuất (Alibaba, 1688)"
        listings={factoryListings}
        rate={rate}
        productId={product.id}
        imageSourceId={imageSourceId}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-semibold mt-1 text-sm">{value}</p>
    </div>
  );
}

type ListingFull = {
  id: number;
  sourceType: string;
  platform: string;
  url: string;
  sellerName: string | null;
  titleOriginal: string | null;
  titleVi: string | null;
  descriptionOriginal: string | null;
  descriptionVi: string | null;
  soldTotal: number | null;
  soldMonthly: number | null;
  lastScrapedAt: Date | null;
  variants: VariantData[];
  images: { id: number; url: string; kind: string }[];
  reviews: { id: number; contentOriginal: string; contentVi: string | null; rating: number | null }[];
};

function ListingGroup({
  title,
  listings,
  rate,
  productId,
  imageSourceId,
}: {
  title: string;
  listings: ListingFull[];
  rate: number;
  productId: number;
  imageSourceId: number | null;
}) {
  return (
    <section className="space-y-4">
      <h2 className="font-semibold text-lg">{title}</h2>
      {listings.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Chưa có link nào — dán link vào ô phía trên để thêm.
        </p>
      ) : (
        listings.map((l) => (
          <ListingCard
            key={l.id}
            listing={l}
            rate={rate}
            productId={productId}
            imageSourceId={imageSourceId}
          />
        ))
      )}
    </section>
  );
}

function ListingCard({
  listing: l,
  rate,
  productId,
  imageSourceId,
}: {
  listing: ListingFull;
  rate: number;
  productId: number;
  imageSourceId: number | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
      {/* Tiêu đề đã dịch + gốc */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{l.titleVi ?? l.titleOriginal ?? "(chưa có tên)"}</p>
          {l.titleVi && l.titleOriginal && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{l.titleOriginal}</p>
          )}
          {l.sellerName && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">🏪 {l.sellerName}</p>
          )}
        </div>
        <div className="text-right shrink-0 space-y-1">
          <span className="text-xs px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium">
            {l.platform}
          </span>
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-blue-500 hover:underline"
          >
            Mở link gốc ↗
          </a>
          {/* Chọn ảnh MAIN của link này làm ảnh đại diện sản phẩm */}
          {l.images.some((i) => i.kind === "MAIN") && (
            <SetMainImageButton
              productId={productId}
              listingId={l.id}
              isCurrentSource={l.id === imageSourceId}
            />
          )}
          <ListingActions listingId={l.id} />
        </div>
      </div>

      {/* Sửa tay các trường của link (tên, người bán, mô tả, lượt bán, URL) */}
      <EditListingForm listing={l} />

      {/* Ảnh — tải lên từ máy hoặc Ctrl+V dán từ clipboard */}
      <ImageManager listingId={l.id} images={l.images} />

      {/* Phân loại + giá CNY / VNĐ quy đổi — sửa tay/thêm/xóa được */}
      <VariantTable listingId={l.id} variants={l.variants} rate={rate} />

      {/* Lượt bán */}
      {(l.soldTotal || l.soldMonthly) && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {l.soldTotal && <>Tổng đã bán: {l.soldTotal.toLocaleString("vi-VN")}</>}
          {l.soldTotal && l.soldMonthly && " · "}
          {l.soldMonthly && <>Bán tháng: {l.soldMonthly.toLocaleString("vi-VN")}</>}
        </p>
      )}

      {/* Mô tả của người bán */}
      {(l.descriptionVi || l.descriptionOriginal) && (
        <div className="text-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
            Mô tả của người bán
          </p>
          <p>{l.descriptionVi ?? l.descriptionOriginal}</p>
        </div>
      )}

      {/* Đánh giá người mua — sửa tay/thêm/xóa được */}
      <ReviewManager listingId={l.id} reviews={l.reviews} />

      {l.lastScrapedAt && (
        <p className="text-xs text-slate-400">
          Cào dữ liệu lần cuối: {new Date(l.lastScrapedAt).toLocaleString("vi-VN")}
        </p>
      )}
    </div>
  );
}
