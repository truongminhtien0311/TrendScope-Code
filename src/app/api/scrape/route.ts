// ============================================================
// API: POST /api/scrape — luồng "dán link -> cào dữ liệu -> lưu"
// Body: { productId: number, url: string, externalId?: string }
//   (externalId dành cho tính năng quét mã QR lấy uid sau này)
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";
import { detectPlatform, getScraperFor, platformToSourceType } from "@/lib/scrapers";

const schema = z.object({
  productId: z.number(),
  url: z.string().url("Link không hợp lệ"),
  externalId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { productId, url, externalId } = parsed.data;

  // 1. Nhận diện sàn từ URL
  const platform = detectPlatform(url);
  if (!platform) {
    return NextResponse.json(
      { error: "Chưa nhận diện được sàn. Hỗ trợ: Taobao, Tmall, JD, Alibaba, 1688." },
      { status: 400 }
    );
  }

  // 2. Chọn scraper đang bật cho sàn này (kèm apiKey đã lưu trong Cài đặt)
  const found = await getScraperFor(platform);
  if (!found) {
    return NextResponse.json(
      { error: `Chưa có scraper nào bật cho sàn ${platform}. Kiểm tra Cài đặt > API.` },
      { status: 400 }
    );
  }
  const { provider: scraper, config } = found;

  // 3. Cào dữ liệu
  let scraped;
  try {
    scraped = await scraper.scrape(url, externalId, config);
  } catch (err) {
    await logActivity("listing.scrape_failed", `Cào thất bại: ${url} (${String(err)})`);
    return NextResponse.json({ error: "Cào dữ liệu thất bại: " + String(err) }, { status: 502 });
  }

  // 4. Lưu vào database (listing + phân loại + ảnh + đánh giá cùng lúc)
  const listing = await prisma.listing.create({
    data: {
      productId,
      sourceType: platformToSourceType(platform),
      platform,
      url,
      externalId: scraped.externalId,
      sellerName: scraped.sellerName,
      titleOriginal: scraped.titleOriginal,
      titleVi: scraped.titleVi,
      descriptionOriginal: scraped.descriptionOriginal,
      descriptionVi: scraped.descriptionVi,
      soldTotal: scraped.soldTotal,
      soldMonthly: scraped.soldMonthly,
      lastScrapedAt: new Date(),
      variants: {
        create: scraped.variants.map((v) => ({
          nameOriginal: v.nameOriginal,
          nameVi: v.nameVi,
          priceCny: v.priceCny,
        })),
      },
      images: {
        create: scraped.images.map((img, i) => ({
          url: img.url,
          kind: img.kind,
          sortOrder: img.sortOrder ?? i,
        })),
      },
      reviews: {
        create: scraped.reviews.map((r) => ({
          contentOriginal: r.contentOriginal,
          contentVi: r.contentVi,
          rating: r.rating,
          reviewedAt: r.reviewedAt,
        })),
      },
    },
  });

  await logActivity(
    "listing.scrape",
    `Cào ${platform} bằng "${scraper.name}" cho sản phẩm #${productId}: ${url}`
  );
  return NextResponse.json(listing, { status: 201 });
}
