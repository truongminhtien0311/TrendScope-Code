// ============================================================
// ALIBABA DATAHUB — cào dữ liệu THẬT cho Alibaba.com (nhóm nhà sản xuất).
// Đăng ký qua RapidAPI, gói "Alibaba DataHub" (KHÁC nhà cung cấp Otapi
// dùng cho Taobao/Tmall — tên file giữ nguyên "otapi-alibaba.ts" cho
// tiện lịch sử, nhưng đây là API/cấu trúc dữ liệu khác hẳn):
//   https://rapidapi.com/.../api/alibaba-datahub
//
// Endpoint đã test thật (tab Code Snippets + Test Endpoint, 2026-07-04):
//   GET https://alibaba-datahub.p.rapidapi.com/item_detail
//       ?itemId={id}&locale=vi_VN
// Header bắt buộc: x-rapidapi-host, x-rapidapi-key (lấy từ Cài đặt > API).
//
// Đã XÁC NHẬN THẬT (không đoán):
//   - itemId tách từ URL dạng .../product-detail/xxx_1601445375967.html
//   - Tham số locale=vi_VN dịch được title + properties sang tiếng Việt
//     luôn trong 1 lần gọi (giống cơ chế language=vi bên Taobao/Tmall).
//   - Tham số currency=CNY bị API TỪ CHỐI (trả violations, tự set về USD
//     mặc định) — nên KHÔNG dùng tham số này, cứ để mặc định USD rồi tự
//     quy đổi sang CNY bằng tỷ giá "usd_cny_rate" trong Cài đặt (app đã
//     có sẵn, xem src/lib/currency.ts) qua config.usdCnyRate truyền vào.
//   - Giá (sku.def.priceModule.priceList) là giá CHUNG, KHÔNG phải giá
//     riêng theo từng phân loại màu/size — mọi phân loại dùng chung 1
//     bảng giá này. CÓ 2 DẠNG khác nhau tùy priceType (đã test cả 2):
//       + "volumePrice": mỗi dòng có price + minQuantity/maxQuantity
//         (giá theo bậc số lượng mua) -> lấy dòng đầu (bậc thấp nhất)
//       + "fobPrice": mỗi dòng có minPrice/maxPrice (giá thương lượng,
//         không có price/quantity) -> lấy minPrice làm giá đại diện
//     Code phải đọc được CẢ 2 dạng, không giả định chỉ 1 kiểu.
//   - Phân loại (SKU) nằm ở sku.base[] (mỗi dòng 1 tổ hợp, propMap dạng
//     "propId:valueId;propId:valueId...") + sku.props[] (tên nhóm thuộc
//     tính + danh sách giá trị, mỗi value có "id" khớp CHÍNH XÁC với 1
//     đoạn trong propMap) — tra ngược để ghép tên đầy đủ, giống cách
//     Taobao ghép Configurators/Attributes.
//
// CHƯA KIỂM CHỨNG (đoán hợp lý, có thể cần sửa khi gặp lỗi thật):
//   - Cấu trúc endpoint "Item Review" — chưa có JSON mẫu thật, viết
//     phòng hờ với try/catch trả mảng rỗng nếu sai cấu trúc (không làm
//     hỏng cả lần cào chỉ vì review lỗi, giống cách Taobao/Tmall làm).
//
// KHÔNG gọi thêm bước dịch riêng (src/lib/translate — đã xóa) cho
// title/properties vì locale=vi_VN đã tự dịch. Mô tả dài (description.html)
// và tên SKU giữ nguyên tiếng Anh gốc — để trống *Vi, sẽ tự điền khi
// chạy "✨ Tạo bằng AI" (đã gộp việc dịch vào chung request phân tích).
// ============================================================
import type { Platform, ProviderConfig, ScrapedImage, ScrapedListing, ScraperProvider } from "../types";

const HOST = "alibaba-datahub.p.rapidapi.com";

export const otapiAlibabaScraper: ScraperProvider = {
  id: "alibaba-datahub",
  name: "Alibaba DataHub (RapidAPI)",
  dbName: "Alibaba DataHub (RapidAPI)",

  supports: (platform: Platform) => platform === "ALIBABA",

  async scrape(url: string, _externalId, config: ProviderConfig): Promise<ScrapedListing> {
    if (!config.apiKey) {
      throw new Error("Chưa có API key cho Alibaba DataHub — vào Cài đặt > API để nhập.");
    }

    const itemId = extractItemId(url);
    if (!itemId) {
      throw new Error("Không tách được id sản phẩm từ URL Alibaba.com.");
    }

    const item = await fetchItemDetail(itemId, config.apiKey);
    const usdCnyRate = config.usdCnyRate ?? 7.2; // fallback nếu vì lý do gì đó chưa truyền vào

    return {
      platform: "ALIBABA",
      externalId: String(item.itemId),
      titleOriginal: item.title, // đã dịch sẵn tiếng Việt qua locale=vi_VN (xem ghi chú đầu file)
      sellerName: item.company?.companyName,
      descriptionOriginal: stripHtml(item.description?.html),
      variants: buildVariants(item, usdCnyRate),
      images: buildImages(item),
      reviews: await fetchReviews(itemId, config.apiKey).catch(() => []),
    };
  },
};

// Trích id từ URL dạng: .../product-detail/ten-san-pham_1601833000047.html
// Đã test thật với link mẫu, đúng kết quả.
function extractItemId(url: string): string | null {
  const match = url.match(/_(\d+)\.html/);
  return match ? match[1] : null;
}

async function fetchItemDetail(itemId: string, apiKey: string): Promise<AlibabaItem> {
  const res = await fetch(
    `https://${HOST}/item_detail?itemId=${itemId}&locale=vi_VN`,
    { headers: { "x-rapidapi-host": HOST, "x-rapidapi-key": apiKey } }
  );
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new Error(`Alibaba DataHub trả lỗi HTTP ${res.status}${bodyText ? ": " + bodyText : ""}`);
  }
  const data = (await res.json()) as { result?: { item?: AlibabaItem; company?: AlibabaCompany } };
  if (!data.result?.item) {
    throw new Error("Alibaba DataHub không trả về dữ liệu sản phẩm.");
  }
  // company nằm ở result.company (ngang hàng với result.item), không phải trong item
  return { ...data.result.item, company: data.result.company };
}

// CHƯA CÓ JSON mẫu thật cho endpoint Item Review — viết phòng hờ, dò vài
// tên field hợp lý, có gì sai cứ để rơi vào catch(() => []) ở chỗ gọi,
// không làm hỏng cả lần cào chỉ vì review lỗi cấu trúc.
async function fetchReviews(
  itemId: string,
  apiKey: string
): Promise<{ contentOriginal: string; contentVi?: string; rating?: number }[]> {
  const res = await fetch(
    `https://${HOST}/item_review?itemId=${itemId}&locale=vi_VN`,
    { headers: { "x-rapidapi-host": HOST, "x-rapidapi-key": apiKey } }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    result?: { reviews?: { content?: string; comment?: string; rating?: number; score?: number }[] };
  };
  const list = data.result?.reviews ?? [];
  return list
    .map((r) => ({ contentOriginal: r.content ?? r.comment ?? "", rating: r.rating ?? r.score }))
    .filter((r) => r.contentOriginal);
}

// Bỏ thẻ HTML trong mô tả sản phẩm (item.description.html chứa rất nhiều
// DIV/style lồng nhau của trình soạn thảo Alibaba), chỉ giữ lại chữ.
function stripHtml(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || undefined;
}

// Ghép tên phân loại từ sku.base[].propMap tra ngược trong sku.props[].values
function buildVariants(
  item: AlibabaItem,
  usdCnyRate: number
): { nameOriginal: string; nameVi?: string; priceCny: number }[] {
  const sku = item.sku;
  const firstPrice = sku?.def?.priceModule?.priceList?.[0];
  // "volumePrice" -> field "price"; "fobPrice" -> chỉ có "minPrice"/"maxPrice"
  const priceUsd = firstPrice?.price ?? firstPrice?.minPrice ?? 0;
  const priceCny = priceUsd * usdCnyRate;

  const base = sku?.base ?? [];
  const props = sku?.props ?? [];

  if (base.length === 0 || props.length === 0) {
    return [{ nameOriginal: "Mặc định", nameVi: "Mặc định", priceCny }];
  }

  // Gom toàn bộ value theo "id" (vd "191286172:28315" -> "M") để tra ngược
  const valueById = new Map<string, string>();
  for (const prop of props) {
    for (const v of prop.values) valueById.set(v.id, v.name);
  }

  return base.map((b) => {
    const parts = b.propMap
      .split(";")
      .map((id) => valueById.get(id))
      .filter((name): name is string => !!name);
    const name = parts.join(" / ") || "Mặc định";
    // Properties (Vật liệu/Kích/Màu...) đã dịch tiếng Việt sẵn qua locale=vi_VN
    return { nameOriginal: name, nameVi: name, priceCny };
  });
}

function buildImages(item: AlibabaItem): ScrapedImage[] {
  const toHttps = (u: string) => (u.startsWith("//") ? `https:${u}` : u);
  const images: ScrapedImage[] = (item.images ?? []).map((url, i) => ({
    url: toHttps(url),
    kind: i === 0 ? "MAIN" : "GALLERY",
    sortOrder: i,
  }));
  (item.description?.images ?? []).forEach((url, i) => {
    images.push({ url: toHttps(url), kind: "DESCRIPTION", sortOrder: i });
  });
  return images;
}

// ---- Kiểu dữ liệu tối thiểu cần dùng từ response Alibaba DataHub ----
interface AlibabaPriceListItem {
  price?: number; // dạng "volumePrice"
  minQuantity?: number;
  maxQuantity?: number;
  minPrice?: number; // dạng "fobPrice"
  maxPrice?: number;
}
interface AlibabaSkuValue {
  id: string; // vd "191286172:28315" — khớp trực tiếp 1 đoạn trong propMap
  name: string;
}
interface AlibabaSkuProp {
  name: string;
  values: AlibabaSkuValue[];
}
interface AlibabaSkuBase {
  skuId: number;
  propMap: string; // "propId:valueId;propId:valueId..."
}
interface AlibabaSku {
  def?: { priceModule?: { priceList?: AlibabaPriceListItem[] } };
  base?: AlibabaSkuBase[];
  props?: AlibabaSkuProp[];
}
interface AlibabaCompany {
  companyName?: string;
}
interface AlibabaItem {
  itemId: string | number;
  title: string;
  images?: string[];
  description?: { html?: string; images?: string[] };
  sku?: AlibabaSku;
  company?: AlibabaCompany;
}
