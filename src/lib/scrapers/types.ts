// ============================================================
// ĐỊNH NGHĨA CHUNG cho mọi bên cào dữ liệu (scraper).
// Muốn thêm 1 dịch vụ cào mới (TMAPI, OneBound, tự cào...):
//   1. Tạo file mới trong src/lib/scrapers/providers/
//   2. Viết 1 object đúng interface ScraperProvider bên dưới
//   3. Đăng ký vào danh sách trong src/lib/scrapers/index.ts
// Không phải sửa chỗ nào khác trong app.
// ============================================================

export type Platform = "TAOBAO" | "TMALL" | "JD" | "ALIBABA" | "C1688";

// RETAIL = shop bán lẻ (Taobao, Tmall, JD) | MANUFACTURER = nhà sản xuất (Alibaba, 1688)
export type SourceType = "RETAIL" | "MANUFACTURER";

export interface ScrapedVariant {
  nameOriginal: string; // tên phân loại gốc (tiếng Trung)
  nameVi?: string; // bản dịch (nếu scraper/translate làm luôn)
  priceCny: number;
}

export interface ScrapedImage {
  url: string;
  kind: "MAIN" | "GALLERY" | "DESCRIPTION";
  sortOrder?: number;
}

export interface ScrapedReview {
  contentOriginal: string;
  contentVi?: string;
  rating?: number;
  reviewedAt?: Date;
}

// Toàn bộ dữ liệu cào được từ 1 link sản phẩm
export interface ScrapedListing {
  platform: Platform;
  externalId?: string; // uid sản phẩm (có thể lấy từ mã QR)
  titleOriginal: string;
  titleVi?: string;
  sellerName?: string;
  descriptionOriginal?: string;
  descriptionVi?: string;
  soldTotal?: number;
  soldMonthly?: number;
  variants: ScrapedVariant[];
  images: ScrapedImage[];
  reviews: ScrapedReview[];
}

// Key + URL gốc lấy từ bảng ApiProvider (Cài đặt > API), truyền vào scrape()
export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  // Tỷ giá USD->CNY (Cài đặt > Tỷ giá) — provider KHÔNG được tự gọi
  // database, nên bên gọi (getScraperFor) tự lấy sẵn rồi truyền vào đây.
  // Chỉ cần cho sàn nào trả giá bằng USD thay vì CNY (vd Alibaba.com).
  usdCnyRate?: number;
}

export interface ScraperProvider {
  id: string; // định danh nội bộ, vd "mock", "otapi-taobao-tmall"
  name: string; // tên hiển thị trong Cài đặt
  dbName: string; // phải khớp CHÍNH XÁC với ApiProvider.name trong database
  // (dùng để tìm đúng dòng cấu hình apiKey/baseUrl/enabled)
  supports: (platform: Platform) => boolean;
  scrape: (url: string, externalId: string | undefined, config: ProviderConfig) => Promise<ScrapedListing>;
}
