// ============================================================
// API: POST /api/listings/[id]/rescrape — cào lại 1 link đã có
// để cập nhật giá/tên/ảnh/đánh giá mới.
//
// QUY TẮC GIÁ (mindmap: người dùng sửa được giá vì giá quét có thể sai):
//   - Phân loại đã sửa tay (priceEdited = true): GIỮ NGUYÊN giá,
//     chỉ cập nhật tên dịch.
//   - Phân loại chưa sửa tay: nhận giá mới từ lần cào này.
//   - Phân loại mới xuất hiện: thêm vào.
//   - Phân loại biến mất khỏi kết quả cào: xóa, TRỪ KHI đã sửa tay.
// Ảnh + đánh giá: thay toàn bộ bằng dữ liệu mới.
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";
import { detectPlatform, getScraperFor } from "@/lib/scrapers";
import { REVIEW_IMAGE_MAX_DIMENSION, saveScrapedImages } from "@/lib/storage";
import { friendlyError } from "@/lib/errors";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id: Number(id) },
    include: { variants: true },
  });
  if (!listing) {
    return NextResponse.json({ error: "Không tìm thấy link" }, { status: 404 });
  }

  const platform = detectPlatform(listing.url);
  if (!platform) {
    return NextResponse.json({ error: "URL không nhận diện được sàn" }, { status: 400 });
  }
  const found = await getScraperFor(platform);
  if (!found) {
    return NextResponse.json(
      { error: `Chưa có scraper nào bật cho sàn ${platform}.` },
      { status: 400 }
    );
  }
  const { provider: scraper, config } = found;

  let scraped;
  try {
    scraped = await scraper.scrape(listing.url, listing.externalId ?? undefined, config);
  } catch (err) {
    await logActivity("listing.rescrape_failed", `Cào lại thất bại: ${listing.url} (${String(err)})`);
    return NextResponse.json({ error: "Cào dữ liệu thất bại: " + friendlyError(err) }, { status: 502 });
  }

  // Lưu ảnh — LUÔN lưu local trước, Google Drive (nếu bật) đồng bộ ngầm
  // sau đó. Ảnh nào lỗi thì tự giữ nguyên link gốc, không chặn cả lần cào lại.
  const savedImages = await saveScrapedImages(scraped.images);
  const reviewImageInputs = scraped.reviews.flatMap((r, reviewIdx) =>
    (r.imageUrls ?? []).map((url, sortOrder) => ({ url, reviewIdx, sortOrder }))
  );
  const savedReviewImages = await saveScrapedImages(reviewImageInputs, {
    maxDimension: REVIEW_IMAGE_MAX_DIMENSION,
  });

  // Đối chiếu phân loại cũ/mới theo tên gốc tiếng Trung
  const oldByName = new Map(listing.variants.map((v) => [v.nameOriginal, v]));
  const newNames = new Set(scraped.variants.map((v) => v.nameOriginal));

  await prisma.$transaction(async (tx) => {
    // 1. Cập nhật thông tin chung của listing
    await tx.listing.update({
      where: { id: listing.id },
      data: {
        titleOriginal: scraped.titleOriginal,
        titleVi: scraped.titleVi,
        sellerName: scraped.sellerName,
        descriptionOriginal: scraped.descriptionOriginal,
        descriptionVi: scraped.descriptionVi,
        soldTotal: scraped.soldTotal,
        soldMonthly: scraped.soldMonthly,
        lastScrapedAt: new Date(),
      },
    });

    // 2. Phân loại: cập nhật/thêm, tôn trọng giá đã sửa tay
    for (const nv of scraped.variants) {
      const old = oldByName.get(nv.nameOriginal);
      if (old) {
        await tx.variant.update({
          where: { id: old.id },
          data: {
            nameVi: nv.nameVi ?? old.nameVi,
            // Giá sửa tay thì giữ nguyên, chưa sửa thì lấy giá mới
            ...(old.priceEdited ? {} : { priceCny: nv.priceCny }),
          },
        });
      } else {
        await tx.variant.create({
          data: {
            listingId: listing.id,
            nameOriginal: nv.nameOriginal,
            nameVi: nv.nameVi,
            priceCny: nv.priceCny,
          },
        });
      }
    }
    // Phân loại biến mất: xóa nếu chưa sửa tay
    for (const old of listing.variants) {
      if (!newNames.has(old.nameOriginal) && !old.priceEdited) {
        await tx.variant.delete({ where: { id: old.id } });
      }
    }

    // 3. Ảnh + đánh giá: thay toàn bộ
    await tx.listingImage.deleteMany({ where: { listingId: listing.id } });
    await tx.listingImage.createMany({
      data: savedImages.map((img, i) => ({
        listingId: listing.id,
        url: img.url,
        localPath: img.localPath,
        kind: img.kind,
        sortOrder: img.sortOrder ?? i,
      })),
    });
    // Dùng create() từng dòng thay vì createMany() — cần lồng luôn ảnh
    // đánh giá (images: { create: [...] }) vào mỗi review, createMany()
    // không hỗ trợ tạo quan hệ lồng nhau.
    await tx.review.deleteMany({ where: { listingId: listing.id } });
    for (const [reviewIdx, r] of scraped.reviews.entries()) {
      await tx.review.create({
        data: {
          listingId: listing.id,
          contentOriginal: r.contentOriginal,
          contentVi: r.contentVi,
          rating: r.rating,
          reviewedAt: r.reviewedAt,
          images: {
            create: savedReviewImages
              .filter((img) => img.reviewIdx === reviewIdx)
              .map((img) => ({ url: img.url, localPath: img.localPath, sortOrder: img.sortOrder })),
          },
        },
      });
    }
  });

  await logActivity(
    "listing.rescrape",
    `Cào lại ${listing.platform} (link #${listing.id}) bằng "${scraper.name}" — giá sửa tay được giữ nguyên`
  );
  return NextResponse.json({ ok: true });
}
