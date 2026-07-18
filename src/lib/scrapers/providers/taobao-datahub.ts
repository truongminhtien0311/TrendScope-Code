// ============================================================
// Taobao DataHub (RapidAPI, publisher: ecommdatahub) — nguồn CÀO DỰ
// PHÒNG cho Taobao/Tmall, thêm SONG SONG với Otapi (không thay thế) vì
// gói Basic miễn phí của Otapi đã bị chính nhà cung cấp khoá (lỗi HTTP
// 405 "The API provider has disabled request access to the API" —
// xác nhận qua nhiều tài khoản RapidAPI khác nhau đều dính, không phải
// lỗi hết quota của riêng 1 tài khoản).
// Đăng ký free tại: rapidapi.com/ecommdatahub/api/taobao-datahub
//   Gói Basic: 50 advanced request/tháng, 100 request thường/tháng.
//
// Dùng endpoint "Item Detail X【Simple】" (item_detail_x) — đã xem
// Example Response THẬT trên RapidAPI docs (không đoán field), trả về
// gọn: title, ảnh, giá, tên shop — nhưng CHỈ 1 mức giá chung, KHÔNG có
// breakdown theo từng phân loại/SKU (endpoint "Item Detail" đầy đủ có
// sku.base[] theo từng SKU nhưng tên phân loại mã hoá dạng propPath cần
// tra ngược qua bảng thuộc tính riêng — CHƯA giải mã được, để sau nếu
// cần). Vì vậy variants ở đây LUÔN CHỈ CÓ 1 dòng "Mặc định" — người dùng
// tự thêm phân loại tay nếu sản phẩm có nhiều loại giá khác nhau.
// Đánh giá người mua (item_review) CHƯA làm — Example Response trên
// RapidAPI đang trả lỗi "endpoint tạm thời không khả dụng" tại thời điểm
// viết code này, không có schema thật để dựa vào — trả mảng rỗng.
// ============================================================
import type { Platform, ProviderConfig, ScrapedImage, ScrapedListing, ScraperProvider } from "../types";

const HOST = "taobao-datahub.p.rapidapi.com";

export const taobaoDataHubScraper: ScraperProvider = {
  id: "taobao-datahub",
  name: "Taobao DataHub (RapidAPI)",
  dbName: "Taobao DataHub (RapidAPI)",

  supports: (platform: Platform) => platform === "TAOBAO" || platform === "TMALL",

  async scrape(url: string, externalId, config: ProviderConfig): Promise<ScrapedListing> {
    if (!config.apiKey) {
      throw new Error("Chưa có API key cho Taobao DataHub — vào Cài đặt > API để nhập.");
    }

    const itemId = externalId || extractItemId(url);
    if (!itemId) {
      throw new Error("Không tách được id sản phẩm từ URL Taobao/Tmall.");
    }

    const item = await fetchItemDetail(itemId, config.apiKey);

    return {
      platform: url.toLowerCase().includes("tmall") ? "TMALL" : "TAOBAO",
      externalId: item.itemId,
      titleOriginal: item.title,
      sellerName: item.seller?.storeTitle ?? item.seller?.sellerTitle,
      soldTotal: parseNumber(item.sales),
      variants: buildVariants(item),
      images: buildImages(item),
      reviews: [],
    };
  },
};

function extractItemId(url: string): string | null {
  const match = url.match(/[?&]id=(\d+)/);
  return match ? match[1] : null;
}

async function fetchItemDetail(itemId: string, apiKey: string): Promise<DataHubItem> {
  const res = await fetch(`https://${HOST}/item_detail_x?itemId=${itemId}`, {
    headers: { "x-rapidapi-host": HOST, "x-rapidapi-key": apiKey, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new Error(`Taobao DataHub trả lỗi HTTP ${res.status}${bodyText ? ": " + bodyText : ""}`);
  }
  const data = (await res.json()) as DataHubResponse;
  if (data.result?.status?.code !== 200 || !data.result?.item) {
    throw new Error(`Taobao DataHub báo lỗi: ${JSON.stringify(data.result?.status ?? data)}`);
  }
  return data.result.item;
}

function parseNumber(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

// CHƯA có breakdown theo SKU (xem giải thích đầu file) — luôn 1 dòng giá
// chung, ưu tiên promotionPrice (giá đang bán) rồi mới tới price (giá gốc).
function buildVariants(item: DataHubItem): { nameOriginal: string; priceCny: number }[] {
  const priceStr = item.sku?.def?.promotionPrice ?? item.sku?.def?.price ?? "0";
  const priceCny = Number(priceStr) || 0;
  return [{ nameOriginal: "Mặc định", priceCny }];
}

// Ảnh trả về dạng protocol-relative ("//img.alicdn.com/...") — cần thêm
// "https:" phía trước để dùng trực tiếp được, khác Otapi (trả sẵn URL đủ).
function buildImages(item: DataHubItem): ScrapedImage[] {
  const images = item.images ?? [];
  return images.map((rawUrl, i) => ({
    url: rawUrl.startsWith("//") ? `https:${rawUrl}` : rawUrl,
    kind: i === 0 ? "MAIN" : "GALLERY",
    sortOrder: i,
  }));
}

// ---- Kiểu dữ liệu tối thiểu cần dùng, lấy từ Example Response THẬT của
// endpoint "Item Detail X【Simple】" trên RapidAPI (không đoán field) ----
interface DataHubResponse {
  result?: {
    status?: { code: number; data?: string };
    item?: DataHubItem;
  };
}
interface DataHubItem {
  itemId: string;
  title: string;
  catName?: string;
  rootCatName?: string;
  brandName?: string;
  sales?: string | number;
  itemUrl?: string;
  images?: string[];
  sku?: { def?: { price?: string; promotionPrice?: string } };
  seller?: { sellerTitle?: string; storeTitle?: string; storeType?: string };
}
