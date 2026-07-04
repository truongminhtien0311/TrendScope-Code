// ============================================================
// OTAPI ALIBABA — cào dữ liệu cho Alibaba.com (nhóm nhà sản xuất).
// Cùng nhà cung cấp Otapi/Open Trade Commerce đã dùng cho Taobao/Tmall
// (xem otapi-taobao-tmall.ts), đăng ký riêng qua RapidAPI:
//   https://rapidapi.com/open-trade-commerce-open-trade-commerce-default/api/otapi-alibaba
//
// ⚠️ CHƯA HOÀN THIỆN — thiếu thông tin endpoint thật.
// Lúc viết file này chưa vào được trang RapidAPI (server họ lỗi tạm thời)
// nên CHƯA CÓ: tên host, đường dẫn endpoint, tên tham số item id.
// Việc ĐÃ LÀM CHẮC CHẮN (test thật, không đoán):
//   - Trích id sản phẩm từ URL Alibaba.com (dạng .../product-detail/
//     ten-san-pham_1601833000047.html) — đã test với link thật, đúng.
//   - Khung mapping dữ liệu: giả định response có cùng cấu trúc
//     Item/Attributes/ConfiguredItems/FeaturedValues/Pictures như bên
//     Taobao/Tmall (cùng nhà cung cấp, nhiều khả năng dùng chung 1 kiểu
//     dữ liệu cho mọi sàn — nhưng CHƯA XÁC NHẬN, có thể sai khác).
//
// VIỆC CÒN LẠI khi vào được RapidAPI:
//   1. Vào endpoint "chi tiết sản phẩm" (tương tự BatchGetItemFullInfo
//      bên Taobao), dán link Alibaba thật vào ô test, bấm Test Endpoint
//   2. Copy kết quả JSON + tab "Code Snippets" (có host, đường dẫn, tên
//      tham số) gửi lại để điền vào HOST/PATH/tên tham số bên dưới
//   3. Nếu cấu trúc JSON khác Taobao, sửa lại các hàm buildVariants/
//      buildImages/findFeatured cho khớp
// ============================================================
import type { Platform, ProviderConfig, ScrapedListing, ScraperProvider } from "../types";

// TODO: điền đúng host thật lấy từ tab "Code Snippets" trên RapidAPI
const HOST = "otapi-alibaba1.p.rapidapi.com"; // ⚠️ ĐOÁN — cần xác nhận lại

export const otapiAlibabaScraper: ScraperProvider = {
  id: "otapi-alibaba",
  name: "Otapi - Alibaba.com (RapidAPI)",
  dbName: "Otapi - Alibaba.com (RapidAPI)",

  supports: (platform: Platform) => platform === "ALIBABA",

  async scrape(url: string, _externalId, config: ProviderConfig): Promise<ScrapedListing> {
    if (!config.apiKey) {
      throw new Error("Chưa có API key cho Otapi Alibaba — vào Cài đặt > API để nhập.");
    }

    const itemId = extractItemId(url);
    if (!itemId) {
      throw new Error("Không tách được id sản phẩm từ URL Alibaba.com.");
    }

    // ⚠️ TODO: chưa xác nhận được endpoint thật (xem ghi chú đầu file).
    // Xóa dòng throw bên dưới và điền đúng đường dẫn/tham số sau khi có
    // Code Snippets thật từ RapidAPI.
    throw new Error(
      "Provider Otapi Alibaba chưa cấu hình xong endpoint thật — " +
        "cần xem Code Snippets trên RapidAPI rồi hoàn thiện file otapi-alibaba.ts."
    );

    // ---- Phần bên dưới đã viết sẵn theo cấu trúc dự đoán, dùng lại
    // được ngay nếu response thật giống Taobao/Tmall ----
    // const item = await fetchItemDetail(itemId, config.apiKey);
    // return {
    //   platform: "ALIBABA",
    //   externalId: item.Id,
    //   titleOriginal: item.OriginalTitle,
    //   titleVi: item.Title,
    //   sellerName: item.VendorDisplayName ?? item.VendorName,
    //   soldTotal: findFeatured(item.FeaturedValues, "TotalSales"),
    //   soldMonthly: findFeatured(item.FeaturedValues, "SalesInLast30Days"),
    //   variants: buildVariants(item),
    //   images: buildImages(item),
    //   reviews: [],
    // };
  },
};

// Trích id từ URL dạng: .../product-detail/ten-san-pham_1601833000047.html
// Đã test thật với link mẫu, đúng kết quả.
function extractItemId(url: string): string | null {
  const match = url.match(/_(\d+)\.html/);
  return match ? match[1] : null;
}

// TODO: hoàn thiện khi có thông tin endpoint thật — xem otapi-taobao-tmall.ts
// để tham khảo cách viết fetchItemDetail/findFeatured/buildVariants/buildImages,
// khả năng cao chỉ cần đổi HOST + đường dẫn endpoint là dùng lại được gần hết.
