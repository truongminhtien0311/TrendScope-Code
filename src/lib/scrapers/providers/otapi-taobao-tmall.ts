// ============================================================
// OTAPI (Open Trade Commerce) — cào dữ liệu THẬT cho Taobao & Tmall.
// Đăng ký qua RapidAPI: "Taobao Tmall" API của open-trade-commerce.
// Docs mẫu người dùng đã test:
//   GET https://taobao-tmall1.p.rapidapi.com/BatchGetItemFullInfo
//       ?language=vi&itemId={id}&TargetAreaCode=110103
//   GET https://taobao-tmall1.p.rapidapi.com/SearchItemReviews
//       ?language=vi&ItemId={id}&framePosition=0&frameSize=50
// Header bắt buộc: x-rapidapi-host, x-rapidapi-key (lấy từ Cài đặt > API).
//
// API tự dịch sang tiếng Việt qua tham số language=vi (đã test xác nhận
// hoạt động tốt cho tên sản phẩm + tên phân loại) nên KHÔNG cần gọi thêm
// bước dịch riêng (src/lib/translate) cho provider này.
//
// LƯU Ý: gói Basic miễn phí trên RapidAPI chỉ có 10 "advanced request"
// và 20 "request" thường mỗi ngày (BatchGetItemFullInfo tính là advanced) —
// cào nhiều trong ngày sẽ bị chặn, lúc đó cần nâng gói Pro trên RapidAPI.
// ============================================================
import type { Platform, ProviderConfig, ScrapedImage, ScrapedListing, ScraperProvider } from "../types";

const HOST = "taobao-tmall1.p.rapidapi.com";

export const otapiTaobaoTmallScraper: ScraperProvider = {
  id: "otapi-taobao-tmall",
  name: "Otapi - Taobao & Tmall (RapidAPI)",
  dbName: "Otapi - Taobao & Tmall (RapidAPI)",

  // API này chỉ phủ Taobao/Tmall, chưa có JD — JD cần provider khác
  supports: (platform: Platform) => platform === "TAOBAO" || platform === "TMALL",

  async scrape(url: string, externalId, config: ProviderConfig): Promise<ScrapedListing> {
    if (!config.apiKey) {
      throw new Error("Chưa có API key cho Otapi — vào Cài đặt > API để nhập.");
    }

    // Ưu tiên UID quét từ mã QR (nếu người dùng đã quét) — chỉ tách từ
    // URL khi không có UID nhập sẵn.
    const itemId = externalId || extractItemId(url);
    if (!itemId) {
      throw new Error("Không tách được id sản phẩm từ URL Taobao/Tmall.");
    }

    const item = await fetchItemDetail(itemId, config.apiKey);
    const reviews = await fetchReviews(itemId, config.apiKey).catch(() => []);

    return {
      platform: url.toLowerCase().includes("tmall") ? "TMALL" : "TAOBAO",
      externalId: item.Id,
      titleOriginal: item.OriginalTitle,
      titleVi: item.Title, // API đã dịch sẵn qua language=vi
      sellerName: item.VendorDisplayName ?? item.VendorName,
      soldTotal: findFeatured(item.FeaturedValues, "TotalSales"),
      soldMonthly: findFeatured(item.FeaturedValues, "SalesInLast30Days"),
      variants: buildVariants(item),
      images: buildImages(item),
      reviews,
    };
  },
};

// Link Taobao thường dùng "?id=" (item.taobao.com/item.htm?id=...), nhưng
// link chia sẻ từ app mobile (vd pages-fast.m.taobao.com/.../externalDetail)
// lại dùng "itemIds=" (số nhiều, đôi khi "itemId=" số ít tùy trang) — khớp
// cả 2 dạng, ưu tiên "id=" trước vì phổ biến hơn. Link gợi ý/quảng cáo
// trong app (vd uland.taobao.com/...&forward=https%3A%2F%2Fitem.taobao...)
// bọc URL đích ĐÃ ENCODE trong 1 tham số khác — "id=" lúc đó thành
// "id%3D", không khớp regex trần — thử decode nguyên URL rồi tìm lại
// trước khi chịu thua.
function extractItemId(url: string): string | null {
  const direct = extractItemIdRaw(url);
  if (direct) return direct;
  try {
    const decoded = decodeURIComponent(url);
    if (decoded !== url) return extractItemIdRaw(decoded);
  } catch {
    // URL chứa % không hợp lệ để decode — bỏ qua, coi như không tách được
  }
  return null;
}

function extractItemIdRaw(url: string): string | null {
  const idMatch = url.match(/[?&]id=(\d+)/);
  if (idMatch) return idMatch[1];
  const itemIdsMatch = url.match(/[?&]itemIds?=(\d+)/);
  return itemIdsMatch ? itemIdsMatch[1] : null;
}

async function fetchItemDetail(itemId: string, apiKey: string): Promise<OtapiItem> {
  const res = await fetch(
    `https://${HOST}/BatchGetItemFullInfo?language=vi&itemId=${itemId}&TargetAreaCode=110103`,
    { headers: { "x-rapidapi-host": HOST, "x-rapidapi-key": apiKey } }
  );
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    // RapidAPI báo hết quota sẽ trả 429 kèm message rõ ràng trong body,
    // vd "You have exceeded the DAILY quota..." — hiện nguyên văn cho dễ hiểu.
    throw new Error(`Otapi trả lỗi HTTP ${res.status}${bodyText ? ": " + bodyText : ""}`);
  }
  const data = (await res.json()) as OtapiResponse;
  if (data.ErrorCode !== "Ok" || !data.Result?.Item) {
    // Hiện nguyên văn JSON lỗi (không chỉ mã lỗi ngắn gọn) để dễ tra —
    // OTAPI thường kèm mô tả chi tiết hơn trong các field khác của response.
    throw new Error(`Otapi báo lỗi: ${data.ErrorCode} — chi tiết: ${JSON.stringify(data)}`);
  }
  return data.Result.Item;
}

// KHÔNG giới hạn số review/ảnh lấy về nữa (yêu cầu người dùng — chấp nhận
// đánh đổi tốn quota RapidAPI + dung lượng lưu trữ hơn để có đầy đủ dữ
// liệu đối chiếu). Ngân sách ảnh gửi AI vẫn được kiểm soát riêng ở
// src/lib/llm/index.ts (MAX_IMAGE_COUNT/MAX_TOTAL_IMAGE_BYTES, ưu tiên ảnh
// chính thức trước) nên gỡ cap ở đây không làm tăng chi phí AI mỗi lượt
// phân tích, chỉ tăng dữ liệu lưu trữ local/Drive.
const REVIEW_PAGE_SIZE = 50; // kích thước 1 trang phân trang SearchItemReviews
// Chặn kỹ thuật thuần tuý chống vòng lặp vô hạn nếu API lỗi trả lặp mãi
// cùng 1 trang — KHÔNG phải giới hạn nghiệp vụ (200 trang ~ 10.000 review,
// thực tế không sản phẩm nào chạm tới).
const MAX_REVIEW_PAGES = 200;

// Đánh giá người mua — ĐÃ KIỂM CHỨNG cấu trúc JSON thật (cào thử sản
// phẩm giày 660702060155 có 10 review thật, 2026-07-17). Field đúng là
// "Text" (bản tiếng Việt do API tự dịch qua language=vi) và
// "OriginalText" (bản gốc tiếng Trung) — KHÔNG PHẢI "Content"/
// "OriginalContent" như đoán ban đầu. Không có field rating (sao 1-5)
// nào cho từng review — "creditLevel"/"userStar" trong FeaturedValues là
// chỉ số uy tín TÀI KHOẢN NGƯỜI MUA (3-10, không phải thang 1-5), phần
// lớn review test được đều là "hệ thống tự khen mặc định" do người mua
// không tự đánh giá kịp thời hạn — KHÔNG dùng nhầm field này làm rating.
// Ảnh đính kèm (nếu có) lấy từ "ImageUrls" (ảnh gốc kích thước đầy đủ,
// không dùng "ImagePreviewUrls" — để bước resize lúc lưu tự quyết định
// kích thước cuối, không phụ thuộc thumbnail có sẵn của Otapi). Video
// ("Videos") cố tình KHÔNG lấy — quá nặng so với lợi ích.
//
// "framePosition"/"frameSize" là tham số PHÂN TRANG thật của OTAPI (không
// phải cap tuỳ ý) — để lấy HẾT review phải gọi lặp lại tăng dần
// framePosition cho tới khi trang trả về rỗng hoặc ít hơn frameSize (hết
// dữ liệu), KHÔNG thể lấy hết chỉ bằng cách tăng frameSize 1 lần gọi.
// LƯU Ý QUOTA: mỗi trang tốn 1 request RapidAPI riêng — sản phẩm nhiều
// review sẽ tốn nhiều request hơn hẳn so với trước (từng chỉ 1 request/sản
// phẩm), dễ chạm giới hạn gói Basic miễn phí (xem comment đầu file) nhanh
// hơn nếu cào nhiều sản phẩm có nhiều review trong ngày.
async function fetchReviews(
  itemId: string,
  apiKey: string
): Promise<{ contentOriginal: string; contentVi?: string; rating?: number; imageUrls?: string[] }[]> {
  const all: OtapiReview[] = [];
  for (let page = 0; page < MAX_REVIEW_PAGES; page++) {
    const framePosition = page * REVIEW_PAGE_SIZE;
    const res = await fetch(
      `https://${HOST}/SearchItemReviews?language=vi&ItemId=${itemId}&framePosition=${framePosition}&frameSize=${REVIEW_PAGE_SIZE}`,
      { headers: { "x-rapidapi-host": HOST, "x-rapidapi-key": apiKey } }
    );
    if (!res.ok) break;
    const data = (await res.json()) as { Result?: { Content?: OtapiReview[] } };
    const list = data.Result?.Content ?? [];
    all.push(...list);
    if (list.length < REVIEW_PAGE_SIZE) break; // hết dữ liệu
  }

  return all
    .map((r) => {
      const imageUrls = r.ImageUrls ?? [];
      return {
        contentOriginal: r.OriginalText ?? "",
        contentVi: r.Text,
        // Otapi không trả rating theo review — để trống thay vì gán nhầm
        // 1 chỉ số khác (xem giải thích ở trên), tránh hiện số sao sai.
        rating: undefined,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      };
    })
    .filter((r) => r.contentOriginal);
}

function findFeatured(values: OtapiFeaturedValue[] | undefined, name: string): number | undefined {
  const found = values?.find((v) => v.Name === name)?.Value;
  const num = found ? Number(found) : NaN;
  return Number.isFinite(num) ? num : undefined;
}

// Ghép tên phân loại từ Configurators (Pid/Vid) tra ngược trong Attributes
function buildVariants(item: OtapiItem): { nameOriginal: string; nameVi?: string; priceCny: number }[] {
  const attrs = item.Attributes ?? [];
  const configured = item.ConfiguredItems ?? [];

  if (configured.length === 0) {
    // Sản phẩm không có phân loại — dùng giá chung làm 1 dòng duy nhất
    return [{ nameOriginal: "Mặc định", nameVi: "Mặc định", priceCny: item.Price.OriginalPrice }];
  }

  return configured.map((ci) => {
    const parts = ci.Configurators.map((c) =>
      attrs.find((a) => a.Pid === c.Pid && a.Vid === c.Vid)
    ).filter((a): a is OtapiAttribute => !!a);
    const nameOriginal = parts.map((a) => a.OriginalValue).join(" / ") || "Mặc định";
    const nameVi = parts.map((a) => a.Value).join(" / ") || nameOriginal;
    return { nameOriginal, nameVi, priceCny: ci.Price?.OriginalPrice ?? item.Price.OriginalPrice };
  });
}

function buildImages(item: OtapiItem): ScrapedImage[] {
  const pictures = item.Pictures ?? [];
  const images: ScrapedImage[] = pictures.map((p, i) => ({
    url: p.Large?.Url ?? p.Url,
    kind: p.IsMain ? "MAIN" : "GALLERY",
    sortOrder: i,
  }));

  // Taobao thường không có mô tả dạng chữ — toàn bộ mô tả là ảnh dài
  // nối tiếp nhau trong 1 khối HTML. Tách các link ảnh ra làm ảnh mô tả.
  const descUrls = [...(item.Description ?? "").matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  descUrls.forEach((url, i) => images.push({ url, kind: "DESCRIPTION", sortOrder: i }));

  return images;
}

// ---- Kiểu dữ liệu tối thiểu cần dùng từ response Otapi (không khai báo
// toàn bộ 40+ field, chỉ những gì app thực sự đọc) ----
interface OtapiResponse {
  ErrorCode: string;
  Result?: { Item?: OtapiItem };
}
interface OtapiFeaturedValue {
  Name: string;
  Value: string;
}
interface OtapiAttribute {
  Pid: string;
  Vid: string;
  Value: string;
  OriginalValue: string;
  IsConfigurator?: boolean;
}
interface OtapiPicture {
  Url: string;
  Large?: { Url: string };
  IsMain?: boolean;
}
interface OtapiConfiguredItem {
  Configurators: { Pid: string; Vid: string }[];
  Price?: { OriginalPrice: number };
}
interface OtapiItem {
  Id: string;
  Title: string;
  OriginalTitle: string;
  VendorName?: string;
  VendorDisplayName?: string;
  Description?: string;
  Price: { OriginalPrice: number };
  FeaturedValues?: OtapiFeaturedValue[];
  Attributes?: OtapiAttribute[];
  ConfiguredItems?: OtapiConfiguredItem[];
  Pictures?: OtapiPicture[];
}
interface OtapiReview {
  Text?: string; // bản tiếng Việt (API tự dịch qua language=vi)
  OriginalText?: string; // bản gốc tiếng Trung
  ImageUrls?: string[]; // ảnh THẬT khách mua đính kèm (kích thước đầy đủ)
}
