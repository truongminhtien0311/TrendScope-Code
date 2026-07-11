// API: POST /api/export — xuất danh sách sản phẩm ra CSV/Excel theo
// trường người dùng tự chọn. 1 dòng xuất = 1 Variant (Listing/Product
// chưa có Variant vẫn xuất 1 dòng, cột thiếu để trống).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getCnyVndRate } from "@/lib/currency";
import { logActivity } from "@/lib/log";
import { FIELD_KEYS, buildRows, fieldLabels, type RawRow } from "@/lib/export";
import { toCsv } from "@/lib/export/csv";
import { toXlsx } from "@/lib/export/xlsx";

const schema = z.object({
  format: z.enum(["csv", "xlsx"]),
  fields: z.array(z.enum(FIELD_KEYS as [string, ...string[]])).min(1, "Chọn ít nhất 1 trường"),
  categoryIds: z.array(z.number()).optional(),
  tagIds: z.array(z.number()).optional(),
  // Chỉ áp dụng khi format=xlsx — chèn ảnh thumbnail + tô màu theo ngành
  // hàng. Chậm hơn (phải tải từng ảnh) nên để người dùng tự chọn bật.
  richFormat: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { format, fields, categoryIds, tagIds, richFormat } = parsed.data;

  const products = await prisma.product.findMany({
    where: {
      ...(categoryIds?.length ? { categories: { some: { id: { in: categoryIds } } } } : {}),
      ...(tagIds?.length ? { tags: { some: { id: { in: tagIds } } } } : {}),
    },
    include: {
      categories: true,
      tags: true,
      listings: {
        include: { variants: true, images: { take: 1, orderBy: { sortOrder: "asc" } } },
      },
      aiAnalyses: { where: { status: "DONE" }, orderBy: { startedAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  const cnyVndRate = await getCnyVndRate();

  const rawRows: RawRow[] = [];
  // Song song với rawRows (cùng chỉ số dòng) — chỉ dùng khi richFormat để
  // chèn ảnh + tô màu, xem src/lib/export/xlsx.ts.
  const richInfo: { imageUrl: string | null; categoryName: string | null }[] = [];
  for (const product of products) {
    const productPart = {
      name: product.name,
      description: product.description,
      createdAt: product.createdAt,
      categories: product.categories.map((c) => c.name),
      tags: product.tags.map((t) => t.name),
    };
    const analysis = product.aiAnalyses[0]
      ? {
          presetName: product.aiAnalyses[0].presetName,
          aiSummary: product.aiAnalyses[0].aiSummary,
          aiAudience: product.aiAnalyses[0].aiAudience,
          aiChannels: product.aiAnalyses[0].aiChannels,
          aiCustomization: product.aiAnalyses[0].aiCustomization,
          aiImportInfo: product.aiAnalyses[0].aiImportInfo,
          aiShipping: product.aiAnalyses[0].aiShipping,
          aiFeasibility: product.aiAnalyses[0].aiFeasibility,
        }
      : null;
    const categoryName = product.categories[0]?.name ?? null;

    if (product.listings.length === 0) {
      rawRows.push({ product: productPart, listing: null, variant: null, analysis, cnyVndRate });
      richInfo.push({ imageUrl: null, categoryName });
      continue;
    }

    for (const listing of product.listings) {
      const listingPart = {
        platform: listing.platform,
        sourceType: listing.sourceType,
        url: listing.url,
        sellerName: listing.sellerName,
        titleOriginal: listing.titleOriginal,
        titleVi: listing.titleVi,
        soldTotal: listing.soldTotal,
        soldMonthly: listing.soldMonthly,
        lastScrapedAt: listing.lastScrapedAt,
      };
      const imageUrl = listing.images[0]?.url ?? null;

      if (listing.variants.length === 0) {
        rawRows.push({ product: productPart, listing: listingPart, variant: null, analysis, cnyVndRate });
        richInfo.push({ imageUrl, categoryName });
        continue;
      }

      for (const variant of listing.variants) {
        rawRows.push({
          product: productPart,
          listing: listingPart,
          variant: {
            nameOriginal: variant.nameOriginal,
            nameVi: variant.nameVi,
            priceCny: variant.priceCny,
            priceEdited: variant.priceEdited,
          },
          analysis,
          cnyVndRate,
        });
        richInfo.push({ imageUrl, categoryName });
      }
    }
  }

  const headers = fieldLabels(fields);
  const rows = buildRows(fields, rawRows);
  const dateStamp = new Date().toISOString().slice(0, 10);

  await logActivity("data.export", `Xuất ${rawRows.length} dòng, định dạng ${format}`, currentUser.id);

  if (format === "csv") {
    const csv = toCsv(headers, rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="san-pham-${dateStamp}.csv"`,
      },
    });
  }

  const buffer = await toXlsx(headers, rows, richFormat ? richInfo : undefined);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="san-pham-${dateStamp}.xlsx"`,
    },
  });
}
