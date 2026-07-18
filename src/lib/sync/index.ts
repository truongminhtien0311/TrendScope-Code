// ============================================================
// ĐỒNG BỘ DỮ LIỆU GIỮA CÁC MÁY — vì mỗi người dùng chạy
// app độc lập trên máy riêng (không còn server chung), cần cách gộp dữ
// liệu lại: xuất TOÀN BỘ dữ liệu có cấu trúc (không phải CSV báo cáo,
// xem src/lib/export/) ra JSON, đẩy lên Google Drive; máy khác dán link
// Drive vào để tải về và GỘP THÊM (không bao giờ sửa/đè dữ liệu đã có).
//
// Chống trùng khi nhập đi nhập lại nhiều lần: dùng Product.uuid (ổn định
// xuyên suốt các máy, khác id tự tăng chỉ có nghĩa trong 1 database) và
// Listing.url (link nguồn — 2 listing cùng url coi là cùng 1 link đã cào).
// ============================================================
import { prisma } from "@/lib/db";

export interface SyncListing {
  url: string;
  platform: string;
  sourceType: string;
  sellerName: string | null;
  titleOriginal: string | null;
  titleVi: string | null;
  descriptionOriginal: string | null;
  descriptionVi: string | null;
  soldTotal: number | null;
  soldMonthly: number | null;
  lastScrapedAt: string | null;
  variants: { nameOriginal: string; nameVi: string | null; priceCny: number; priceEdited: boolean }[];
  images: { url: string; kind: string; sortOrder: number }[];
  reviews: {
    contentOriginal: string;
    contentVi: string | null;
    rating: number | null;
    reviewedAt: string | null;
    images: { url: string; sortOrder: number }[];
  }[];
}

export interface SyncAiAnalysis {
  presetName: string | null;
  aiSummary: string | null;
  aiAudience: string | null;
  aiChannels: string | null;
  aiCustomization: string | null;
  aiImportInfo: string | null;
  aiShipping: string | null;
  aiFeasibility: string | null;
}

export interface SyncProduct {
  uuid: string;
  name: string;
  description: string | null;
  categories: string[];
  tags: string[];
  listings: SyncListing[];
  aiAnalysis: SyncAiAnalysis | null;
}

export interface SyncPayload {
  syncVersion: 1;
  exportedAt: string;
  products: SyncProduct[];
}

// Đường dẫn ảnh local (chưa bật Google Drive) — không dùng được từ máy
// khác, chỉ cảnh báo chứ không chặn xuất.
function isLocalImageUrl(url: string): boolean {
  return url.startsWith("/uploads/");
}

export async function buildSyncPayload(): Promise<{ payload: SyncPayload; localImageWarningCount: number }> {
  const products = await prisma.product.findMany({
    include: {
      categories: true,
      tags: true,
      listings: { include: { variants: true, images: true, reviews: { include: { images: true } } } },
      aiAnalyses: { where: { status: "DONE" }, orderBy: { startedAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
  });

  let localImageWarningCount = 0;
  const syncProducts: SyncProduct[] = products.map((p) => ({
    uuid: p.uuid,
    name: p.name,
    description: p.description,
    categories: p.categories.map((c) => c.name),
    tags: p.tags.map((t) => t.name),
    listings: p.listings.map((l) => ({
      url: l.url,
      platform: l.platform,
      sourceType: l.sourceType,
      sellerName: l.sellerName,
      titleOriginal: l.titleOriginal,
      titleVi: l.titleVi,
      descriptionOriginal: l.descriptionOriginal,
      descriptionVi: l.descriptionVi,
      soldTotal: l.soldTotal,
      soldMonthly: l.soldMonthly,
      lastScrapedAt: l.lastScrapedAt ? l.lastScrapedAt.toISOString() : null,
      variants: l.variants.map((v) => ({
        nameOriginal: v.nameOriginal,
        nameVi: v.nameVi,
        priceCny: v.priceCny,
        priceEdited: v.priceEdited,
      })),
      images: l.images.map((img) => {
        if (isLocalImageUrl(img.url)) localImageWarningCount += 1;
        return { url: img.url, kind: img.kind, sortOrder: img.sortOrder };
      }),
      reviews: l.reviews.map((r) => ({
        contentOriginal: r.contentOriginal,
        contentVi: r.contentVi,
        rating: r.rating,
        reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
        images: r.images.map((img) => {
          if (isLocalImageUrl(img.url)) localImageWarningCount += 1;
          return { url: img.url, sortOrder: img.sortOrder };
        }),
      })),
    })),
    aiAnalysis: p.aiAnalyses[0]
      ? {
          presetName: p.aiAnalyses[0].presetName,
          aiSummary: p.aiAnalyses[0].aiSummary,
          aiAudience: p.aiAnalyses[0].aiAudience,
          aiChannels: p.aiAnalyses[0].aiChannels,
          aiCustomization: p.aiAnalyses[0].aiCustomization,
          aiImportInfo: p.aiAnalyses[0].aiImportInfo,
          aiShipping: p.aiAnalyses[0].aiShipping,
          aiFeasibility: p.aiAnalyses[0].aiFeasibility,
        }
      : null,
  }));

  return {
    payload: { syncVersion: 1, exportedAt: new Date().toISOString(), products: syncProducts },
    localImageWarningCount,
  };
}

// Lấy fileId từ link chia sẻ Drive — hỗ trợ 2 dạng phổ biến:
//   https://drive.google.com/file/d/<id>/view?usp=sharing
//   https://drive.google.com/open?id=<id>  hoặc  ...?id=<id>
export function extractDriveFileId(shareLink: string): string | null {
  const pathMatch = shareLink.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (pathMatch) return pathMatch[1];
  try {
    const url = new URL(shareLink);
    const idParam = url.searchParams.get("id");
    if (idParam) return idParam;
  } catch {
    // không phải URL hợp lệ
  }
  return null;
}

export interface ImportResult {
  newProducts: number;
  newListings: number;
}

// Gộp dữ liệu từ file đồng bộ vào database hiện tại — CHỈ CỘNG THÊM,
// KHÔNG BAO GIỜ sửa/đè dữ liệu đã có (kể cả product đã tồn tại, chỉ xét
// thêm listing/category/tag MỚI, không đụng vào aiAnalysis cũ/mới để
// tránh mập mờ về phiên bản phân tích nào là "đúng").
export async function importSyncPayload(payload: SyncPayload): Promise<ImportResult> {
  let newProducts = 0;
  let newListings = 0;

  for (const sp of payload.products) {
    const existing = await prisma.product.findUnique({
      where: { uuid: sp.uuid },
      include: { categories: true, tags: true, listings: { select: { url: true } } },
    });

    if (!existing) {
      await prisma.product.create({
        data: {
          uuid: sp.uuid,
          name: sp.name,
          description: sp.description,
          categories: {
            connectOrCreate: sp.categories.map((name) => ({ where: { name }, create: { name } })),
          },
          tags: {
            connectOrCreate: sp.tags.map((name) => ({ where: { name }, create: { name } })),
          },
          listings: {
            create: sp.listings.map((l) => ({
              url: l.url,
              platform: l.platform,
              sourceType: l.sourceType,
              sellerName: l.sellerName,
              titleOriginal: l.titleOriginal,
              titleVi: l.titleVi,
              descriptionOriginal: l.descriptionOriginal,
              descriptionVi: l.descriptionVi,
              soldTotal: l.soldTotal,
              soldMonthly: l.soldMonthly,
              lastScrapedAt: l.lastScrapedAt ? new Date(l.lastScrapedAt) : null,
              variants: { create: l.variants },
              images: { create: l.images },
              reviews: {
                create: l.reviews.map((r) => ({
                  contentOriginal: r.contentOriginal,
                  contentVi: r.contentVi,
                  rating: r.rating,
                  reviewedAt: r.reviewedAt ? new Date(r.reviewedAt) : null,
                  images: { create: r.images },
                })),
              },
            })),
          },
          aiAnalyses: sp.aiAnalysis
            ? { create: [{ status: "DONE", finishedAt: new Date(), ...sp.aiAnalysis }] }
            : undefined,
        },
      });
      newProducts += 1;
      newListings += sp.listings.length;
      continue;
    }

    // Product đã có — chỉ gắn thêm category/tag mới (additive, không xóa gì).
    const existingCategoryNames = new Set(existing.categories.map((c) => c.name));
    const existingTagNames = new Set(existing.tags.map((t) => t.name));
    const newCategoryNames = sp.categories.filter((n) => !existingCategoryNames.has(n));
    const newTagNames = sp.tags.filter((n) => !existingTagNames.has(n));
    if (newCategoryNames.length || newTagNames.length) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          categories: { connectOrCreate: newCategoryNames.map((name) => ({ where: { name }, create: { name } })) },
          tags: { connectOrCreate: newTagNames.map((name) => ({ where: { name }, create: { name } })) },
        },
      });
    }

    // Chỉ thêm listing có url CHƯA có trong product này.
    const existingUrls = new Set(existing.listings.map((l) => l.url));
    for (const l of sp.listings) {
      if (existingUrls.has(l.url)) continue;
      await prisma.listing.create({
        data: {
          productId: existing.id,
          url: l.url,
          platform: l.platform,
          sourceType: l.sourceType,
          sellerName: l.sellerName,
          titleOriginal: l.titleOriginal,
          titleVi: l.titleVi,
          descriptionOriginal: l.descriptionOriginal,
          descriptionVi: l.descriptionVi,
          soldTotal: l.soldTotal,
          soldMonthly: l.soldMonthly,
          lastScrapedAt: l.lastScrapedAt ? new Date(l.lastScrapedAt) : null,
          variants: { create: l.variants },
          images: { create: l.images },
          reviews: {
            create: l.reviews.map((r) => ({
              contentOriginal: r.contentOriginal,
              contentVi: r.contentVi,
              rating: r.rating,
              reviewedAt: r.reviewedAt ? new Date(r.reviewedAt) : null,
              images: { create: r.images },
            })),
          },
        },
      });
      newListings += 1;
    }
  }

  return { newProducts, newListings };
}
