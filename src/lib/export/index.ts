// Định nghĩa cách LẤY giá trị cho từng trường xuất dữ liệu — dùng chung
// cho CSV và Excel (src/app/api/export). 1 dòng xuất = 1 Variant
// (Listing/Product chưa có Variant vẫn xuất 1 dòng, cột thiếu để trống).
// CHỈ dùng ở server (import @/lib/currency -> @/lib/db -> Prisma) — client
// component cần danh sách trường thì import "@/lib/export/fields" (không
// kéo theo Prisma). Nhãn/nhóm hiển thị lấy từ fields.ts để tránh lệch dữ
// liệu giữa 2 file.
import { cnyToVnd } from "@/lib/currency";
import { FIELD_METADATA, type FieldMeta } from "./fields";

export interface RawRow {
  product: {
    name: string;
    description: string | null;
    createdAt: Date;
    categories: string[];
    tags: string[];
  };
  listing: {
    platform: string;
    sourceType: string;
    url: string;
    sellerName: string | null;
    titleOriginal: string | null;
    titleVi: string | null;
    soldTotal: number | null;
    soldMonthly: number | null;
    lastScrapedAt: Date | null;
  } | null;
  variant: {
    nameOriginal: string;
    nameVi: string | null;
    priceCny: number;
    priceEdited: boolean;
  } | null;
  analysis: {
    presetName: string | null;
    aiSummary: string | null;
    aiAudience: string | null;
    aiChannels: string | null;
    aiCustomization: string | null;
    aiImportInfo: string | null;
    aiShipping: string | null;
    aiFeasibility: string | null;
  } | null;
  cnyVndRate: number;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  RETAIL: "Shop bán lẻ",
  MANUFACTURER: "Nhà sản xuất",
};

function fmtDate(d: Date | null): string {
  return d ? d.toLocaleString("vi-VN") : "";
}

const GETTERS: Record<string, (row: RawRow) => string> = {
  "product.name": (r) => r.product.name ?? "",
  "product.description": (r) => r.product.description ?? "",
  "product.createdAt": (r) => fmtDate(r.product.createdAt),
  "product.categories": (r) => r.product.categories.join(", "),
  "product.tags": (r) => r.product.tags.join(", "),

  "listing.platform": (r) => r.listing?.platform ?? "",
  "listing.sourceType": (r) => (r.listing ? SOURCE_TYPE_LABELS[r.listing.sourceType] ?? r.listing.sourceType : ""),
  "listing.url": (r) => r.listing?.url ?? "",
  "listing.sellerName": (r) => r.listing?.sellerName ?? "",
  "listing.titleOriginal": (r) => r.listing?.titleOriginal ?? "",
  "listing.titleVi": (r) => r.listing?.titleVi ?? "",
  "listing.soldTotal": (r) => r.listing?.soldTotal?.toString() ?? "",
  "listing.soldMonthly": (r) => r.listing?.soldMonthly?.toString() ?? "",
  "listing.lastScrapedAt": (r) => fmtDate(r.listing?.lastScrapedAt ?? null),

  "variant.nameOriginal": (r) => r.variant?.nameOriginal ?? "",
  "variant.nameVi": (r) => r.variant?.nameVi ?? "",
  "variant.priceCny": (r) => r.variant?.priceCny?.toString() ?? "",
  "variant.priceVnd": (r) => (r.variant ? String(cnyToVnd(r.variant.priceCny, r.cnyVndRate)) : ""),
  "variant.priceEdited": (r) => (r.variant?.priceEdited ? "Có" : "Không"),

  "analysis.presetName": (r) => r.analysis?.presetName ?? "",
  "analysis.aiSummary": (r) => r.analysis?.aiSummary ?? "",
  "analysis.aiAudience": (r) => r.analysis?.aiAudience ?? "",
  "analysis.aiChannels": (r) => r.analysis?.aiChannels ?? "",
  "analysis.aiCustomization": (r) => r.analysis?.aiCustomization ?? "",
  "analysis.aiImportInfo": (r) => r.analysis?.aiImportInfo ?? "",
  "analysis.aiShipping": (r) => r.analysis?.aiShipping ?? "",
  "analysis.aiFeasibility": (r) => r.analysis?.aiFeasibility ?? "",
};

export interface FieldDefinition extends FieldMeta {
  get: (row: RawRow) => string;
}

export const FIELD_DEFINITIONS: FieldDefinition[] = FIELD_METADATA.map((meta) => ({
  ...meta,
  get: GETTERS[meta.key],
}));

export const FIELD_KEYS = FIELD_DEFINITIONS.map((f) => f.key);

function defsFor(fields: string[]): FieldDefinition[] {
  return fields
    .map((key) => FIELD_DEFINITIONS.find((f) => f.key === key))
    .filter((f): f is FieldDefinition => !!f);
}

export function buildRows(fields: string[], rows: RawRow[]): string[][] {
  const defs = defsFor(fields);
  return rows.map((row) => defs.map((def) => def.get(row)));
}

export function fieldLabels(fields: string[]): string[] {
  return defsFor(fields).map((f) => f.label);
}
