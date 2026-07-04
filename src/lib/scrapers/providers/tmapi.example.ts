// ============================================================
// FILE MẪU — khung sẵn để tích hợp THÊM 1 nhà cung cấp cào dữ liệu
// mới (khác Otapi đang dùng thật ở otapi-taobao-tmall.ts).
// Ví dụ cần dùng khi: muốn thêm provider cho JD.com, hoặc cho
// Alibaba/1688 (nhóm nhà sản xuất — hiện chưa có provider thật nào).
//
// Cách dùng: đổi tên file, điền logic gọi API, rồi đăng ký vào
// mảng `providers` trong src/lib/scrapers/index.ts.
// API key/baseUrl được truyền sẵn vào scrape() qua tham số `config`,
// lấy từ dòng tương ứng trong Cài đặt > API (bảng ApiProvider) —
// KHÔNG tự gọi database trong file provider.
// ============================================================
import type { Platform, ProviderConfig, ScrapedListing, ScraperProvider } from "../types";

export const exampleScraper: ScraperProvider = {
  id: "example",
  name: "Tên hiển thị trong Cài đặt",
  dbName: "Tên hiển thị trong Cài đặt", // phải khớp apiProvider.name trong seed.ts

  supports: (platform: Platform) => platform === "JD",

  async scrape(_url: string, _externalId: string | undefined, config: ProviderConfig): Promise<ScrapedListing> {
    if (!config.apiKey) throw new Error("Chưa có API key — vào Cài đặt > API để nhập.");
    // TODO các bước khi tích hợp thật:
    // 1. Tách item id từ URL (vd ?id=123456789)
    // 2. Gọi API thật bằng config.apiKey / config.baseUrl
    // 3. Map JSON trả về sang định dạng ScrapedListing (xem ../types.ts)
    // 4. Không cần tự dịch ở đây — cứ để titleVi/descriptionVi trống,
    //    bản dịch sẽ tự điền khi người dùng chạy "Phân tích AI" sau đó
    throw new Error("Chưa tích hợp API thật — đây chỉ là file mẫu.");
  },
};
