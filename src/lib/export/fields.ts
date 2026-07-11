// Metadata thuần (key/label/group) cho danh sách trường xuất dữ liệu —
// tách riêng khỏi src/lib/export/index.ts vì file đó import
// src/lib/currency.ts (kéo theo Prisma), không dùng được trong client
// component. File này KHÔNG được import gì từ @/lib/db hay @/lib/currency.
export interface FieldMeta {
  key: string;
  label: string;
  group: string;
}

export const FIELD_METADATA: FieldMeta[] = [
  { key: "product.name", label: "Tên sản phẩm", group: "Sản phẩm" },
  { key: "product.description", label: "Mô tả", group: "Sản phẩm" },
  { key: "product.createdAt", label: "Ngày tạo", group: "Sản phẩm" },
  { key: "product.categories", label: "Ngành hàng", group: "Sản phẩm" },
  { key: "product.tags", label: "Tag", group: "Sản phẩm" },

  { key: "listing.platform", label: "Sàn", group: "Link nguồn" },
  { key: "listing.sourceType", label: "Nhóm nguồn", group: "Link nguồn" },
  { key: "listing.url", label: "Link", group: "Link nguồn" },
  { key: "listing.sellerName", label: "Người bán/Nhà cung cấp", group: "Link nguồn" },
  { key: "listing.titleOriginal", label: "Tên gốc (tiếng Trung)", group: "Link nguồn" },
  { key: "listing.titleVi", label: "Tên đã dịch", group: "Link nguồn" },
  { key: "listing.soldTotal", label: "Tổng lượt bán", group: "Link nguồn" },
  { key: "listing.soldMonthly", label: "Lượt bán tháng", group: "Link nguồn" },
  { key: "listing.lastScrapedAt", label: "Cào lần cuối", group: "Link nguồn" },

  { key: "variant.nameOriginal", label: "Tên phân loại (gốc)", group: "Phân loại & giá" },
  { key: "variant.nameVi", label: "Tên phân loại (Việt)", group: "Phân loại & giá" },
  { key: "variant.priceCny", label: "Giá (CNY)", group: "Phân loại & giá" },
  { key: "variant.priceVnd", label: "Giá (VNĐ)", group: "Phân loại & giá" },
  { key: "variant.priceEdited", label: "Giá đã sửa tay?", group: "Phân loại & giá" },

  { key: "analysis.presetName", label: "Preset prompt AI", group: "Phân tích AI" },
  { key: "analysis.aiSummary", label: "Mô tả tổng hợp", group: "Phân tích AI" },
  { key: "analysis.aiAudience", label: "Tệp khách hàng", group: "Phân tích AI" },
  { key: "analysis.aiChannels", label: "Kênh bán hàng", group: "Phân tích AI" },
  { key: "analysis.aiCustomization", label: "Gợi ý tùy chỉnh", group: "Phân tích AI" },
  { key: "analysis.aiImportInfo", label: "Nhập khẩu", group: "Phân tích AI" },
  { key: "analysis.aiShipping", label: "Đóng gói & vận chuyển", group: "Phân tích AI" },
  { key: "analysis.aiFeasibility", label: "Đánh giá khả thi", group: "Phân tích AI" },
];

export const FIELD_KEYS = FIELD_METADATA.map((f) => f.key);

export const DEFAULT_EXPORT_FIELDS = [
  "product.name",
  "listing.platform",
  "listing.sellerName",
  "variant.nameVi",
  "variant.priceCny",
  "variant.priceVnd",
];
