// ============================================================
// AI TỔNG HỢP (mindmap: "Mô tả sản phẩm bằng AI" + mở rộng thêm
// bộ phân tích "làm ăn" đầy đủ theo yêu cầu thực tế của người dùng)
//
// QUAN TRỌNG: MỘT sản phẩm = MỘT request LLM duy nhất.
// Request GỘP dữ liệu của TẤT CẢ các link (bán lẻ + nhà sản xuất):
// tên, mô tả, ảnh, đánh giá... rồi trả về ĐỦ 7 MỤC:
//   A. Mô tả sản phẩm tổng hợp          -> Product.aiSummary
//   B. Tệp khách hàng mục tiêu          -> Product.aiAudience
//   C. Kênh bán hàng + hướng tiếp thị   -> Product.aiChannels
//   D. Gợi ý tùy chỉnh sản phẩm         -> Product.aiCustomization
//   E. Nhập khẩu (HS Code/thuế/kiểm định) -> Product.aiImportInfo
//   F. Đóng gói + vận chuyển nội địa    -> Product.aiShipping
//   G. Đánh giá tổng thể tính khả thi kinh doanh -> Product.aiFeasibility
// KHÔNG tách request theo mục hay theo link — tiết kiệm phí API,
// giữ nhất quán giữa các mục (theo mindmap).
//
// Dùng Google Gemini (gemini-3.5-flash) — có gói miễn phí, hỗ trợ đọc
// ảnh trực tiếp, xuất JSON có cấu trúc, VÀ bật kèm Google Search
// Grounding (5.000 lượt/tháng miễn phí) để mục E (nhập khẩu/thuế/luật)
// tra cứu quy định PHÁP LUẬT HIỆN HÀNH — tự động fallback bỏ Search
// Grounding nếu tài khoản Google chưa liên kết thanh toán (lỗi 429).
//
// PROMPT CÓ THỂ TÙY CHỈNH: người dùng sửa được toàn bộ phần hướng dẫn
// (Cài đặt > Prompt AI) vì mỗi người cần khai thác dữ liệu khác nhau.
// Phần DỮ LIỆU luôn do app tự điền qua placeholder {{PRODUCT_NAME}},
// {{USER_DESCRIPTION}}, {{LISTINGS_DATA}}, {{IMAGE_URLS}}, và
// {{COST_ASSUMPTIONS}} (giả định chi phí kinh doanh — xem CostAssumptions
// bên dưới, sửa được trong Cài đặt vì phí sàn/ads hay thay đổi theo thời gian).
// ============================================================
import { GoogleGenAI, Type } from "@google/genai";

// Gemini hay trả lỗi 503 "high demand" (quá tải TẠM THỜI phía Google, đặc
// biệt model flash miễn phí) — thử lại vài lần với độ trễ tăng dần trước
// khi thật sự báo lỗi, thay vì để y 1 lần gọi là hỏng cả phân tích.
// CHỈ retry lỗi 503 — lỗi 429/RESOURCE_EXHAUSTED thường là đã HẾT HẠN MỨC
// MIỄN PHÍ TRONG NGÀY (quotaId "...PerDay...", xem message lỗi), retry
// ngay trong vài giây không ích gì (quota không tự hồi trong giây lát) mà
// còn có nguy cơ tốn thêm lượt gọi — để lỗi đó báo NGAY cho người dùng biết.
const RETRY_DELAYS_MS = [2000, 5000, 10000];

function isRetryableGeminiError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /"code":503|UNAVAILABLE/.test(message) && !/RESOURCE_EXHAUSTED|PerDay/.test(message);
}

// Dịch lỗi kỹ thuật của Gemini (thường là 1 khối JSON dài, khó đọc với người
// không phải dev) sang câu tiếng Việt dễ hiểu — dùng ở mọi nơi hiển thị
// errorMessage của 1 lượt AI thất bại (AiAnalysisPanel, CompareTable,
// ScorePanel...). Trả về nguyên văn gốc nếu không nhận diện được dạng lỗi.
export function friendlyGeminiError(raw: string | null | undefined): string {
  if (!raw) return "Lỗi không rõ nguyên nhân.";
  if (/RESOURCE_EXHAUSTED|PerDay/.test(raw)) {
    return "Đã dùng hết hạn mức Gemini MIỄN PHÍ trong ngày (thường 20 lượt/ngày) — đợi Google reset hạn mức (thường vào trưa hôm sau giờ Việt Nam) hoặc bật trả phí trong Google AI Studio để tăng hạn mức.";
  }
  if (/"code":429/.test(raw)) {
    return "Gemini báo gọi quá nhanh/quá nhiều trong thời gian ngắn — đợi 1-2 phút rồi thử lại.";
  }
  if (/"code":503|UNAVAILABLE/.test(raw)) {
    return "Gemini đang quá tải tạm thời (lỗi từ phía Google) — đã tự thử lại vài lần nhưng vẫn lỗi, đợi ít phút rồi bấm tạo lại.";
  }
  if (/API key not valid|API_KEY_INVALID/.test(raw)) {
    return "API key Gemini không hợp lệ — kiểm tra lại API key trong Cài đặt.";
  }
  return raw;
}

async function withGeminiRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryableGeminiError(err) || attempt === RETRY_DELAYS_MS.length) throw err;
      console.error(`Gemini lỗi tạm thời (lần ${attempt + 1}), thử lại sau ${RETRY_DELAYS_MS[attempt]}ms:`, err);
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }
  throw lastErr;
}

// Dữ liệu gộp từ TOÀN BỘ các link của 1 sản phẩm
export interface AnalysisInput {
  productName: string;
  userDescription?: string; // mô tả người dùng tự viết (nếu có)
  categoryNames?: string[]; // ngành hàng sản phẩm đang gắn — dùng để tra tỷ lệ markup (xem CategoryMarkupRatio), lấy ngành ĐẦU TIÊN nếu có nhiều
  listings: {
    id: number;
    sourceType: string; // RETAIL | MANUFACTURER
    platform: string;
    titleOriginal?: string; // tên gốc tiếng Trung — dùng để DỊCH (việc 2)
    titleVi?: string;
    descriptionOriginal?: string; // mô tả gốc tiếng Trung — dùng để DỊCH (việc 2)
    descriptionText?: string;
    imageUrls: string[]; // ảnh đại diện + ảnh mô tả CHÍNH THỨC của shop để AI "nhìn"
    reviewImageUrls: string[]; // ảnh THẬT khách mua đính kèm đánh giá — dùng để AI đối chiếu, LUÔN xếp sau ảnh chính thức trong ngân sách gửi (xem generateProductAnalysis)
    reviews: string[]; // đánh giá đã dịch
    priceRangeCny?: { min: number; max: number };
    variants: { id: number; nameOriginal: string; nameVi?: string }[]; // SKU — dùng để DỊCH (việc 2)
  }[];
}

export interface AiAnalysisResult {
  summary: string; // (A) mô tả sản phẩm — markdown
  audience: string; // (B) tệp khách hàng mục tiêu — markdown
  channels: string; // (C) kênh bán hàng + hướng tiếp thị — markdown
  customization: string; // (D) gợi ý tùy chỉnh sản phẩm — markdown
  importInfo: string; // (E) HS Code/thuế/VAT/kiểm định — markdown
  shipping: string; // (F) đóng gói + vận chuyển nội địa — markdown
  feasibility: string; // (G) đánh giá tổng thể tính khả thi kinh doanh — markdown
  // (H) Đối thủ cạnh tranh THẬT tìm được qua Google Search khi phân tích
  // mục feasibility (7b) — AI tự điền link thật vào ĐÂY (field JSON riêng,
  // KHÔNG viết lẫn vào văn xuôi feasibility) vì groundingChunks không tách
  // được nguồn nào ứng với mục nào khi 1 request làm nhiều việc cùng lúc.
  // Rỗng nếu không tra được, KHÔNG được bịa — generateProductAnalysis() tự
  // format mảng này thành markdown rồi gắn vào cuối "feasibility".
  competitors?: { name: string; url: string; platform?: string; priceVnd?: number }[];
  // (I) Bản dịch thuần túy — VIỆC RIÊNG, KHÔNG liên quan tới 7 mục phân
  // tích ở trên (xem TRANSLATION_TASK bên dưới). Đi kèm trong CÙNG 1
  // request để không tốn thêm lượt gọi API cho các nút "dịch" riêng lẻ.
  translations: {
    productName: string; // tên sản phẩm tiếng Việt, ngắn gọn, mô tả đúng sản phẩm
    listings: { id: number; titleVi?: string; descriptionVi?: string }[];
    variants: { id: number; nameVi?: string }[];
  };
  // (I) Gợi ý ngành hàng — VIỆC RIÊNG (việc 3), độc lập với 7 mục phân
  // tích và với việc dịch. Chỉ được chọn ĐÚNG 1 tên trong danh sách
  // ngành hàng app cung cấp (ép bằng "enum" của Gemini) — không tự bịa
  // tên ngành khác. Rỗng nếu danh sách ngành hàng app cung cấp rỗng.
  categorySuggestion?: string;
}

// ------------------------------------------------------------
// GIẢ ĐỊNH CHI PHÍ KINH DOANH — sửa được trong Cài đặt vì phí sàn/ads/
// affiliate hay thay đổi theo thời gian, người dùng chỉ cần điền lại
// số mới, không cần đụng vào prompt. Lưu trong Setting key
// "business_cost_assumptions" dạng JSON (mảng — người dùng tự thêm/bớt
// dòng chi phí tùy ý trong Cài đặt, không giới hạn số lượng/tên cố định,
// vì phí sàn thực tế của mỗi người/mỗi ngành hàng khác nhau).
// ------------------------------------------------------------
export interface CostLineItem {
  id: string; // định danh nội bộ cho UI (thêm/xóa dòng), không gửi cho AI
  name: string; // tên chi phí, vd "Phí hoa hồng"
  value: number; // giá trị số
  unit1: string; // đơn vị đo, vd "VNĐ" hoặc "%" — gõ tự do được
  unit2: string; // đơn vị chia theo, vd "/ đơn hàng" hoặc "/ doanh thu" — gõ tự do được
}

export type CostAssumptions = CostLineItem[];

export const DEFAULT_COST_ASSUMPTIONS: CostAssumptions = [
  { id: "1", name: "Chi phí vận hành", value: 5000, unit1: "VNĐ", unit2: "/ đơn hàng" },
  { id: "2", name: "Phí cố định", value: 16.5, unit1: "%", unit2: "/ doanh thu" },
  { id: "3", name: "Gói Voucher sàn", value: 5.5, unit1: "%", unit2: "/ doanh thu" },
  { id: "4", name: "Ads nội sàn", value: 10, unit1: "%", unit2: "/ doanh thu" },
  { id: "5", name: "Phí tiếp thị liên kết", value: 10, unit1: "%", unit2: "/ doanh thu" },
  { id: "6", name: "Thuế GTGT", value: 8, unit1: "%", unit2: "/ doanh thu" },
  { id: "7", name: "Thuế TNCN", value: 1.5, unit1: "%", unit2: "/ doanh thu" },
  { id: "8", name: "Thuế TNDN", value: 0, unit1: "%", unit2: "/ doanh thu" },
  { id: "9", name: "Tỷ lệ hoàn hàng", value: 5, unit1: "%", unit2: "/ tổng đơn hàng" },
  { id: "10", name: "Phí xử lý giao dịch", value: 6, unit1: "%", unit2: "/ doanh thu" },
  { id: "11", name: "Phí cơ sở hạ tầng", value: 0, unit1: "%", unit2: "/ doanh thu" },
];

function formatCostAssumptions(items: CostAssumptions): string {
  if (items.length === 0) return "(người dùng chưa nhập giả định chi phí nào)";
  return items.map((i) => `- ${i.name}: ${i.value} ${i.unit1} ${i.unit2}`).join("\n");
}

// ------------------------------------------------------------
// TỶ LỆ MARKUP THEO NGÀNH HÀNG (giá bán lẻ / giá xưởng) — sửa được
// trong Cài đặt vì tỷ lệ này khác nhau nhiều giữa các ngành hàng. Lưu
// trong Setting key "category_markup_ratios" dạng JSON (mảng). Dùng khi
// sản phẩm CHỈ có giá bán lẻ (Taobao/Tmall/JD), CHƯA có giá xưởng thực
// tế (Alibaba/1688) — ước tính giá xưởng ≈ giá bán lẻ / (1 + ratio%) để
// AI không nhầm giá bán lẻ là giá vốn khi tính lợi nhuận.
// Sản phẩm thuộc NHIỀU ngành hàng: lấy ratio của ngành hàng ĐẦU TIÊN
// trong danh sách categoryNames (đã chốt, xem AGENTS.md/kế hoạch).
// ------------------------------------------------------------
export interface CategoryMarkupRatio {
  id: string; // định danh nội bộ cho UI (thêm/xóa dòng), không gửi cho AI
  categoryName: string; // tên ngành hàng, khớp với Category.name
  ratio: number; // % markup ước tính: giá bán lẻ ≈ giá xưởng * (1 + ratio/100)
}

// ------------------------------------------------------------
// GỢI Ý MARKUP MẶC ĐỊNH THEO NGÀNH HÀNG — ước tính THAM KHẢO, tính từ 2 yếu tố:
//
// 1) SÀN "ĂN" BAO NHIÊU % DOANH THU trước khi tới lượt lãi — cộng dồn từ
//    DEFAULT_COST_ASSUMPTIONS (Cài đặt > Kinh doanh & AI > Giả định chi
//    phí): phí cố định 16.5% + voucher sàn 5.5% + ads nội sàn 10% + phí
//    tiếp thị liên kết 10% + thuế GTGT 8% + thuế TNCN 1.5% + phí xử lý
//    giao dịch 6% = ~57.5% doanh thu, CỘNG THÊM tỷ lệ hoàn hàng 5% (đơn
//    hoàn coi như mất trắng doanh thu cho phần đó) và phí vận hành cố
//    định 5.000đ/đơn. Gộp lại, mỗi 100đ doanh thu chỉ còn lại ~35-38đ để
//    trả giá vốn + có lãi — nghĩa là MARKUP DƯỚI ~170% (giá bán < 2.7 lần
//    giá xưởng) gần như CHẮC CHẮN LỖ trên các sàn thu phí kiểu này, bất kể
//    ngành hàng gì. Vì vậy KHÔNG có ngành nào gợi ý dưới mức sàn này.
// 2) ĐẶC ĐIỂM NGÀNH HÀNG — ngành có giá vốn rẻ, ít bị khách so sánh giá
//    trực tiếp (phụ kiện, mỹ phẩm, đồng hồ, thời trang) markup được CAO
//    hơn nhiều so với mức sàn; ngành giá trị cao, khách nhạy cảm giá, dễ
//    so sánh trực tiếp với hàng chính hãng (laptop, máy ảnh, thiết bị
//    điện tử) chỉ nhỉnh hơn mức sàn một chút — thực tế các ngành này khi
//    nhập từ TQ thường KHÔNG phải hàng chính hãng mà là phụ kiện/hàng
//    tương thích giá rẻ, nếu không thì rất khó có lãi với cơ cấu phí này.
//
// LƯU Ý: nếu sửa DEFAULT_COST_ASSUMPTIONS hoặc phí sàn thực tế đổi nhiều,
// bảng gợi ý này KHÔNG tự tính lại — chỉ là điểm khởi đầu tham khảo, người
// dùng PHẢI tự chỉnh theo thực tế ngành hàng/nhà cung cấp của mình (xem
// CategoryMarkupRatiosForm). Khớp theo TÊN ngành hàng — ngành hàng người
// dùng tự đặt tên khác/thêm mới không khớp tên nào ở đây thì dùng
// FALLBACK_MARKUP_RATIO.
// ------------------------------------------------------------
export const SUGGESTED_MARKUP_BY_CATEGORY: Record<string, number> = {
  "Phụ kiện & Túi ví nữ": 300, // giá vốn cực rẻ, khó so sánh giá trực tiếp
  "Đồng hồ": 300,
  "Sắc đẹp & Sức khỏe": 270, // mỹ phẩm/TPCN giá vốn rẻ, biên rất dày
  "Thời trang nam": 240,
  "Thời trang nữ": 240,
  "Thời trang trẻ em": 220,
  "Giày dép nam": 220,
  "Giày dép nữ": 220,
  "Đồ chơi": 220,
  "Điện thoại & Phụ kiện": 220, // chủ yếu phụ kiện (ốp/sạc/cáp) giá vốn rất rẻ; nếu bán điện thoại thật phải chỉnh thấp hơn nhiều
  "Mẹ và bé": 210,
  "Chăm sóc thú cưng": 200,
  "Nhà cửa & Đời sống": 200,
  "Giặt giũ & Chăm sóc nhà cửa": 190,
  "Thể thao & Du lịch": 190,
  "Bách hóa Online": 190,
  "Ô tô, xe máy & Phụ kiện": 190,
  "Thiết bị điện tử": 190, // gadget/phụ kiện điện tử nhỏ, không phải hàng chính hãng giá trị cao
  "Nhà sách Online": 190,
  "Điện gia dụng": 180,
  "Máy ảnh": 175, // giá trị cao, khách dễ so sánh giá — chỉ nhỉnh hơn mức sàn tối thiểu
  "Máy tính & Laptop": 175,
};

// Mức markup mặc định (%) cho ngành hàng KHÔNG khớp tên nào trong bảng
// gợi ý trên — lấy đúng MỨC SÀN TỐI THIỂU để hòa vốn qua phí sàn (xem
// giải thích ở SUGGESTED_MARKUP_BY_CATEGORY), an toàn hơn là để 1 số
// trung tính tùy tiện có thể khiến người dùng tưởng nhầm là có lãi.
export const FALLBACK_MARKUP_RATIO = 180;

// Giá trị dùng khi Setting "category_markup_ratios" CHƯA từng được lưu
// (máy mới cài/chưa ai vào Cài đặt bấm Lưu) — lấy thẳng từ bảng gợi ý
// SUGGESTED_MARKUP_BY_CATEGORY ở trên thay vì để rỗng, để AI có tỷ lệ
// markup dùng ngay từ đầu (xem buildPriceBasisNote) thay vì phải chờ
// admin tự cấu hình tay trước. Dùng CHUNG 1 nguồn cho cả form Cài đặt
// (settings/page.tsx) lẫn route phân tích AI (analyze/route.ts).
export const DEFAULT_CATEGORY_MARKUP_RATIOS: CategoryMarkupRatio[] = Object.entries(
  SUGGESTED_MARKUP_BY_CATEGORY
).map(([categoryName, ratio]) => ({
  id: categoryName,
  categoryName,
  ratio,
}));

// Sinh nội dung ghi chú cơ sở giá chèn vào prompt qua {{PRICE_BASIS_NOTE}}
// (phân tích 1 sản phẩm) hoặc trực tiếp vào buildProductsDataText (so
// sánh nhiều sản phẩm) — dùng CHUNG 1 hàm để 2 nơi luôn nhất quán.
function buildPriceBasisNote(
  hasFactoryPrice: boolean,
  categoryNames: string[] | undefined,
  markupRatios: CategoryMarkupRatio[]
): string {
  if (hasFactoryPrice) {
    return "Đã có giá xưởng (nhà sản xuất) thực tế bên trên — dùng trực tiếp giá này làm giá vốn, không cần ước tính.";
  }
  const firstCategory = categoryNames?.[0];
  const matched = firstCategory
    ? markupRatios.find((m) => m.categoryName === firstCategory)
    : undefined;
  if (matched && matched.ratio > 0) {
    return `CHỈ có giá bán lẻ ở trên, CHƯA có giá xưởng thực tế. Theo tỷ lệ markup ngành hàng "${matched.categoryName}" người dùng đã cấu hình (~${matched.ratio}%), ƯỚC TÍNH giá xưởng ≈ giá bán lẻ / (1 + ${matched.ratio}%) — PHẢI nêu rõ đây là số ƯỚC TÍNH, không phải giá vốn thật, và khuyến nghị người dùng xác minh lại giá xưởng thật trước khi quyết định.`;
  }
  return "CHỈ có giá bán lẻ ở trên, CHƯA có giá xưởng thực tế và cũng CHƯA có tỷ lệ markup ngành hàng nào được cấu hình để ước tính. TUYỆT ĐỐI KHÔNG được coi giá bán lẻ này là giá vốn/giá xưởng khi tính lợi nhuận — PHẢI nêu rõ giả định/khoảng ước tính hợp lý và khuyến nghị người dùng tìm giá xưởng thật.";
}

// Prompt mặc định — người dùng sửa được trong Cài đặt, bấm "Khôi phục
// mặc định" sẽ lấy đúng nguyên văn chuỗi này. Đây cũng là nội dung của
// preset "default" trong DEFAULT_PROMPT_PRESETS bên dưới.
export const DEFAULT_PROMPT_TEMPLATE = `
Bạn là chuyên gia phân tích thị trường nhập khẩu — KHÔNG PHẢI nhân viên
bán hàng hay người cổ vũ nhập khẩu. Vai trò của bạn là đánh giá TRUNG LẬP,
không thiên vị theo hướng tích cực. BẮT BUỘC: bạn KHÔNG được thưởng vì
làm hài lòng người đọc — nếu dữ liệu cho thấy sản phẩm này không nên
nhập/kinh doanh, PHẢI nói thẳng, không né tránh, không giảm nhẹ để nghe dễ
chịu hơn. Ưu tiên nói sự thật hơn nói điều dễ nghe.

LƯU Ý VỀ ĐỘ TIN CẬY DỮ LIỆU: số liệu "tổng đã bán"/"bán tháng" và đánh giá
người mua cào từ Taobao/Tmall CÓ THỂ bị làm giả (đơn hàng ảo để đẩy thứ
hạng gian lận, review mua sẵn hàng loạt — hiện tượng rất phổ biến trên
sàn TQ). KHÔNG mặc định coi số bán cao là bằng chứng chắc chắn về nhu cầu
thị trường thật. Nếu thấy dấu hiệu đáng ngờ (review đồng loạt 5 sao, văn
phong giống nhau, không kèm ảnh thật, số bán tăng bất thường...), PHẢI
nêu rõ sự nghi ngờ đó thay vì trích dẫn số liệu như sự thật hiển nhiên.
Nếu ảnh gửi kèm có phần đánh dấu "ẢNH THẬT từ khách đã mua" (khác với
"ẢNH CHÍNH THỨC từ shop") — ảnh này khó bị làm giả hàng loạt hơn review
text, nên PHẢI chủ động đối chiếu với ảnh chính thức + mô tả sản phẩm,
nêu rõ nếu phát hiện sai lệch (màu sắc, tình trạng, đóng gói, kích thước
thực tế khác với quảng cáo).

Toàn bộ nội dung trả lời PHẢI bằng tiếng Việt. Các mục mang tính MÔ TẢ/
GIỚI THIỆU (mô tả sản phẩm, khách hàng, kênh bán, tùy chỉnh) nên chèn
nhiều emoji và định dạng nổi bật (tiêu đề, in đậm, gạch đầu dòng) để dễ
đọc. RIÊNG các đoạn CẢNH BÁO RỦI RO, PHẦN PHẢN BIỆN, hoặc KẾT LUẬN mang
tính cảnh báo: giữ văn phong nghiêm túc, HẠN CHẾ emoji, không tô hồng —
để người đọc cảm nhận đúng mức độ nghiêm trọng.

SẢN PHẨM: {{PRODUCT_NAME}}
{{USER_DESCRIPTION}}

DỮ LIỆU TỪ CÁC LINK NGUỒN (đã gộp từ tất cả link bán lẻ + nhà sản xuất):
{{LISTINGS_DATA}}

GHI CHÚ CƠ SỞ GIÁ (BẮT BUỘC đọc trước khi tính giá vốn/giá xưởng ở mục 7):
{{PRICE_BASIS_NOTE}}

GIẢ ĐỊNH CHI PHÍ KINH DOANH (do người dùng tự nhập/cập nhật, dùng số này
để TÍNH TOÁN — không tự đoán số khác, vì phí sàn thực tế hay thay đổi):
{{COST_ASSUMPTIONS}}

Hãy trả về JSON đúng các trường sau (7 trường đầu mỗi trường là 1 đoạn
MARKDOWN, trường "competitors" là 1 MẢNG JSON — không phải văn xuôi):

1. "summary" — Mô tả sản phẩm tổng hợp. TÁCH RÕ 2 NGUỒN DỮ LIỆU, không
   trộn lẫn (nguồn (a) là lời PR một chiều của người bán, nguồn (b) là
   tiếng nói người mua — dù có thể lẫn seeding vẫn là nguồn gần khách
   thật nhất hiện có):

   a) 📦 Từ người bán (mô tả + ảnh chính thức do shop đăng): tóm tắt ngắn
      gọn tính năng/đặc điểm sản phẩm. Không cần đào sâu hay tin tuyệt
      đối — đây chỉ là thông tin nền.

   b) 🔍 Bóc tách tiếng nói người mua (CHỈ lấy từ đánh giá/review, KHÔNG
      lấy từ mô tả người bán): đọc kỹ TOÀN BỘ đánh giá cào được, liệt kê
      KHÔNG GIỚI HẠN số lượng, tách đúng 3 nhóm sau (nhóm nào không có dữ
      liệu thì ghi "không có"):
      - ✨ Điểm nổi bật được khách XÁC NHẬN thực tế: chỉ tính điều khách
        THỰC SỰ nhắc tới trong review, không lặp lại nguyên lời quảng cáo
        của người bán nếu không có review nào xác nhận lại điều đó.
      - 💭 Nỗi đau / insight: vì sao khách mua sản phẩm này, họ đang giải
        quyết vấn đề gì, kỳ vọng gì, dùng vào việc gì (kể cả cách dùng
        ngoài dự tính ban đầu của người bán, nếu có review nhắc tới) —
        liệt kê hết, càng nhiều càng tốt, không giới hạn số lượng.
      - ⚠️ Phàn nàn / góc độ CHƯA TỐT (TRỌNG TÂM CỦA MỤC NÀY — chủ động
        "vạch lá tìm sâu"): liệt kê CỤ THỂ từng vấn đề (chất lượng kém,
        không giống ảnh/mô tả, sai kích thước/màu sắc, dễ hỏng/mau hư,
        thiếu phụ kiện, đóng gói tệ, mùi khó chịu, giao thiếu hàng...) —
        KHÔNG gộp chung chung kiểu "một số khách chưa hài lòng". Nếu
        NHIỀU đánh giá cùng phàn nàn 1 vấn đề, PHẢI nhấn mạnh đây là RỦI
        RO LẶP LẠI (pattern thật), không phải trường hợp cá biệt.
      Nếu dữ liệu không có đánh giá nào, ghi rõ cả mục (b) là "chưa có
      đánh giá nào để tham khảo" thay vì bỏ trống hay suy diễn.

   c) So sánh giá bán lẻ và giá nhà sản xuất nếu có cả 2.

   d) Chèn ảnh gốc vào đúng chỗ hợp lý bằng cú pháp markdown ![mô tả](url),
      CHỈ dùng đúng các url ảnh sau, không tự bịa url khác:
      {{IMAGE_URLS}}

   QUAN TRỌNG: 3 nhóm ✨/💭/⚠️ ở mục (b) không phải để liệt kê cho có — PHẢI
   dùng làm CĂN CỨ khi viết các mục 2, 3, 4, 6 bên dưới (xem chỉ dẫn tham
   chiếu ngược ở từng mục).

2. "audience" — Tệp khách hàng mục tiêu, gồm đủ 6 mục:
   1. Độ tuổi: chia nhóm, xếp hạng từ phù hợp nhất đến ít phù hợp nhất
   2. Giới tính / xu hướng: xếp theo thứ tự phù hợp
   3. Insight chính và phụ của từng tệp khách hàng — ƯU TIÊN dùng đúng nội
      dung đã bóc tách ở mục 1(b) (💭 Nỗi đau/insight, ✨ Điểm nổi bật xác
      nhận) làm bằng chứng, chỉ tự suy diễn thêm khi review không đủ dữ liệu
   4. Vấn đề mà sản phẩm giải quyết được — bám theo 💭 Nỗi đau/insight đã
      bóc tách ở mục 1(b) nếu có, không bịa vấn đề không có căn cứ
   5. Một vài use case mở rộng dựa trên tính năng/điểm nổi bật của sản phẩm
   6. Lý giải ngắn gọn dựa trên số liệu/nghiên cứu/vấn đề xã hội thực tế (nếu biết)

3. "channels" — Kênh bán hàng khả thi + phương hướng tiếp thị/tiếp cận
   khách hàng THEO TỪNG KÊNH cụ thể, ví dụ cấu trúc tham khảo:
   - 🏪 Cửa hàng offline (nếu phù hợp, ví dụ tệp mẹ & bé, cửa hàng tiện lợi...):
     nên bán ở loại cửa hàng nào, cách trưng bày/tư vấn tại điểm bán
   - 🎵 TikTok Shop: tuyến nội dung video tham khảo (loại hook, kịch bản,
     góc quay, xu hướng phù hợp với sản phẩm này)
   - 🛒 Shopee/Lazada: cách tối ưu tiêu đề, ảnh bìa, chương trình khuyến
     mãi phù hợp
   - Kênh khác nếu hợp lý (Facebook, sàn TMĐT khác...)
   Với mỗi kênh: nêu RÕ LÝ DO vì sao phù hợp với sản phẩm này — có thể
   dùng ✨ điểm nổi bật xác nhận hoặc 💭 nỗi đau đã bóc tách ở mục 1(b) làm
   góc content đánh đúng tâm lý khách thật (nếu có dữ liệu).

4. "customization" — Gợi ý tùy chỉnh SẢN PHẨM NÀY để tăng trải nghiệm
   khách hàng. BẮT BUỘC gợi ý CỤ THỂ dựa trên đặc điểm/chức năng/hình
   dáng thật của sản phẩm này (nhìn từ ảnh + mô tả), TUYỆT ĐỐI KHÔNG
   viết lời khuyên chung chung kiểu "đóng gói đẹp, chăm sóc khách hàng
   tốt" cho mọi sản phẩm. BẮT BUỘC có ít nhất 1 ý tưởng ỨNG VỚI MỖI phàn
   nàn (⚠️) đã liệt kê ở mục 1(b) — cải tiến/tùy chỉnh cụ thể để giải
   quyết ĐÚNG phàn nàn đó, ghi rõ "Khắc phục phàn nàn: ..." ngay đầu ý
   tưởng đó để dễ đối chiếu. Ngoài ra liệt kê CÀNG NHIỀU Ý TƯỞNG CÀNG TỐT
   (kể cả không xuất phát từ phàn nàn), và với MỖI ý tưởng gắn nhãn độ
   rủi ro ngay đầu dòng để không bị nhầm ý thử nghiệm với khuyến nghị
   chắc chắn:
   - 🟢 An toàn (dễ làm ngay, rủi ro thấp)
   - 🟡 Cân nhắc (cần đầu tư thêm chút, rủi ro vừa)
   - 🔴 Mạo hiểm/thử nghiệm (kể cả ý tưởng táo bạo, nghe hơi phi lý hoặc
     tốn công, nhưng biết đâu khả thi — cứ mạnh dạn đề xuất để THAM KHẢO,
     miễn là gắn nhãn 🔴 rõ ràng)

5. "importInfo" — Thông tin nhập khẩu vào Việt Nam. ĐÂY LÀ PHẦN QUAN
   TRỌNG NHẤT VỀ ĐỘ CHÍNH XÁC. NẾU có công cụ tìm kiếm (Google Search)
   trong tay, BẮT BUỘC dùng nó để tra cứu quy định PHÁP LUẬT HIỆN HÀNH
   tại thời điểm trả lời, KHÔNG dựa vào trí nhớ/dữ liệu huấn luyện vì
   luật thuế/kiểm định có thể đã thay đổi. NẾU KHÔNG có công cụ tìm
   kiếm, phải nói rõ ngay đầu mục này là "chưa tra cứu được nguồn chính
   thức tại thời điểm tạo, cần người dùng tự kiểm tra lại", tuyệt đối
   không bịa số liệu/điều luật như thể đã tra cứu chắc chắn. Gồm:
   - Mã HS Code phù hợp nhất dựa trên chức năng sản phẩm (giải thích lý
     do chọn mã này)
   - Thuế nhập khẩu ưu đãi (%) và thuế GTGT/VAT (%) áp dụng
   - Có cần đăng ký kiểm tra chất lượng / công bố hợp quy / hợp chuẩn
     để lưu hành hợp pháp tại Việt Nam hay không, và nếu có thì làm ở
     đâu/theo quy trình nào
   - Checklist các giấy tờ/thủ tục người dùng CẦN TỰ CHUẨN BỊ, và
     checklist những gì CẦN HỎI/XÁC NHẬN với phía nhà sản xuất trước khi
     đặt hàng (2 danh sách riêng biệt, rõ ràng)
   - QUAN TRỌNG: MỌI thông tin liên quan pháp luật phải TRÍCH DẪN RÕ tên
     văn bản/điều khoản/thông tư/nghị định cụ thể. Nếu không tra cứu
     được chắc chắn, phải NÓI RÕ là chưa xác định được, không được bịa.
   - Nêu rõ RỦI RO/HẬU QUẢ nếu vi phạm (mức phạt, bị giữ hàng, thu hồi...)
     để người dùng lường trước rủi ro của mặt hàng này

6. "shipping" — Đóng gói và vận chuyển nội địa Việt Nam (thời điểm bán
   cho khách, không phải vận chuyển quốc tế):
   - Phương thức đóng gói phù hợp với đặc tính sản phẩm này
   - Những điểm cần chú ý khi đóng gói/vận chuyển và LÝ DO (dễ vỡ, sợ
     ẩm, sợ va đập, cồng kềnh...) — NẾU ở mục 1(b) có phàn nàn (⚠️) liên
     quan đóng gói/vận chuyển/hư hỏng khi nhận hàng, PHẢI đề cập cách
     khắc phục cụ thể cho đúng phàn nàn đó ở đây
   - Gợi ý tùy chỉnh thêm (hộp quà, tem bảo hành, hướng dẫn sử dụng kèm
     theo...) để tăng trải nghiệm khách hàng hoặc giảm rủi ro hư hỏng

7. "feasibility" — Đánh giá tổng thể tính khả thi KINH DOANH của sản
   phẩm này tại Việt Nam, trình bày THẬT CHI TIẾT, PHẢI có đủ các phần:

   a) So sánh 2 mô hình kinh doanh:
      - 📦 Mô hình TỔNG KHO (bán sỉ lại cho shop khác): ít chi phí ẩn
        hơn, biên lợi nhuận/đơn thấp hơn nhưng vòng quay vốn nhanh
      - 🛍️ Mô hình TỰ BÁN ONLINE: BẮT BUỘC bóc tách chi tiết TỪNG khoản
        chi phí ẩn dựa trên đúng số liệu trong "GIẢ ĐỊNH CHI PHÍ KINH
        DOANH" ở trên (phí sàn, phí thanh toán, ads, affiliate/KOC,
        booking, ship nội địa, đóng gói, tỷ lệ hoàn đơn) — cộng tổng lại
        thành % chi phí trên doanh thu, rồi TÍNH RA mức giá bán tối
        thiểu để hòa vốn dựa trên giá vốn (giá nhập quy đổi VNĐ + thuế
        nhập khẩu ước tính từ mục 5) và gợi ý mức giá bán khả thi thực tế.

   b) So sánh KHÁCH QUAN với sản phẩm CÙNG CHỨC NĂNG đang thực sự bán
      trên thị trường Việt Nam. NẾU có công cụ tìm kiếm, BẮT BUỘC dùng
      nó để tìm ít nhất vài sản phẩm đối thủ THẬT (không bịa), rồi điền
      TRỰC TIẾP vào trường JSON riêng tên "competitors" (KHÔNG viết vào
      văn xuôi mục này) — mỗi đối thủ gồm: "name" (tên sản phẩm), "url"
      (link thật tới trang bán), "platform" (Shopee/Lazada/TikTok Shop...),
      "priceVnd" (giá ước tính, đơn vị VNĐ). NẾU không tra cứu được đối
      thủ thật nào, để "competitors" là mảng RỖNG — TUYỆT ĐỐI không bịa
      tên/giá/link giả cho có. Trong PHẦN VĂN XUÔI của mục 7b này, chỉ
      cần NHẬN XÉT dựa trên những gì tìm được (hoặc nói rõ "chưa tìm được
      đối thủ cụ thể" nếu mảng rỗng) — đánh giá KHÁCH QUAN, KHÔNG mặc
      định kết luận theo hướng lạc quan: giá cao hơn đối thủ có thể là
      dấu hiệu khó cạnh tranh THẬT SỰ (rất nhiều sản phẩm thất bại chính
      vì lý do này) — CHỈ kết luận "vẫn khả thi nhờ khác biệt" khi thực
      sự có bằng chứng khác biệt rõ ràng (thiết kế, tính năng, thương
      hiệu), KHÔNG suy diễn khác biệt từ hư không.

   c) Cơ hội & thách thức — PHẢI bao gồm cả yếu tố vận chuyển quốc tế,
      thông quan, kho bãi, kiểm hóa, đăng kiểm (tham khảo lại mục 5 đã
      phân tích), không chỉ nói về sản phẩm/thị trường chung chung.

   d) "Phản biện" (BẮT BUỘC CÓ, KHÔNG ĐƯỢC BỎ QUA): dành riêng 1 đoạn để
      đóng vai người PHẢN ĐỐI mạnh nhất có thể — nêu lý do THUYẾT PHỤC
      NHẤT vì sao KHÔNG nên nhập/kinh doanh sản phẩm này, dựa trên chính
      dữ liệu đã có (không phải thách thức chung chung kiểu "cạnh tranh
      cao, giá biến động" — phải cụ thể với sản phẩm này). Đoạn này viết
      NGHIÊM TÚC, không tô hồng, không emoji.

   e) Bảng chiến lược giá tăng dần — liệt kê nhiều mức giá bán, từ mức
      HÒA VỐN tăng dần tới mức LÃI ~500% trên giá vốn, với MỖI mức giá
      mô tả: tệp khách hàng nào sẽ phản ứng ra sao, tỷ lệ chuyển đổi
      (conversion rate) dự kiến tăng/giảm thế nào so với mức trước đó.
      Nếu dữ liệu "competitors" cho thấy mức giá nào đó chắc chắn không
      cạnh tranh nổi, PHẢI ghi chú rõ ngay tại mức giá đó.

   f) Kết luận: chọn ĐÚNG 1 trong 3 nhãn "khả thi" / "khả thi có điều
      kiện" / "không khả thi" — KHÔNG được mặc định chọn nhãn giữa cho
      an toàn nếu dữ liệu thực sự nghiêng rõ về 1 phía. Kèm theo:
      - 1 con số % ước lượng khả năng thành công thực tế (0-100%), và
        giải thích ngắn gọn vì sao chọn con số đó (bám vào phân tích
        a-e ở trên, không phải số áp đặt tùy tiện)
      - Gợi ý hướng đi tiếp theo nếu người dùng quyết định kinh doanh
`.trim();

// ------------------------------------------------------------
// PROMPT PRESET — thay vì chỉ có 1 prompt để sửa từng lần, người dùng
// lưu được NHIỀU bản prompt đặt tên riêng để test theo từng hướng khác
// nhau (vd 1 bản tổng quát, 1 bản chỉ tập trung marketing...), chọn 1
// bản "đang dùng" cho lần "Tạo bằng AI" tiếp theo. Lưu trong Setting:
//   - key "ai_prompt_presets": JSON.stringify(PromptPreset[])
//   - key "ai_prompt_active_preset_id": id của preset đang dùng
// "id" cố định (không đổi dù người dùng đổi "name") để nút "Khôi phục nội
// dung gốc" trong PromptEditor tìm đúng bản gốc theo id, kể cả sau khi đã
// đổi tên. Preset người dùng tự tạo thêm (id ngẫu nhiên) sẽ không có bản
// gốc để khôi phục — đây là điều bình thường, không phải lỗi.
// ------------------------------------------------------------
export interface PromptPreset {
  id: string;
  name: string;
  content: string;
}

const SHORT_PROMPT_TEMPLATE = `
Bạn là chuyên gia phân tích thị trường nhập khẩu — KHÔNG PHẢI nhân viên
bán hàng hay người cổ vũ nhập khẩu. Đánh giá TRUNG LẬP, không thiên vị
tích cực. BẮT BUỘC: KHÔNG được thưởng vì làm hài lòng người đọc — nếu dữ
liệu cho thấy không nên nhập/kinh doanh, PHẢI nói thẳng, không giảm nhẹ.

LƯU Ý: số liệu "đã bán" và đánh giá cào từ Taobao/Tmall CÓ THỂ bị làm giả
(đơn hàng ảo, review mua sẵn — phổ biến trên sàn TQ). Không mặc định coi
số bán cao là bằng chứng nhu cầu thật, nêu rõ nếu thấy dấu hiệu đáng ngờ.
Có ảnh đánh dấu "ẢNH THẬT từ khách đã mua" thì đối chiếu với ảnh chính
thức, nêu sai lệch nếu có.

TOÀN BỘ CÂU TRẢ LỜI PHẢI THẬT NGẮN GỌN — mỗi mục tối đa 4-6 gạch đầu dòng
súc tích, KHÔNG viết đoạn văn dài, bỏ ví dụ minh họa dài dòng. Vẫn phải
đủ TẤT CẢ các trường JSON liệt kê bên dưới, chỉ ngắn hơn về độ dài.
Toàn bộ nội dung bằng tiếng Việt. Phần cảnh báo rủi ro/phản biện/kết luận
tiêu cực: nghiêm túc, không emoji.

SẢN PHẨM: {{PRODUCT_NAME}}
{{USER_DESCRIPTION}}

DỮ LIỆU TỪ CÁC LINK NGUỒN:
{{LISTINGS_DATA}}

GHI CHÚ CƠ SỞ GIÁ (bắt buộc đọc trước khi tính giá vốn/giá xưởng):
{{PRICE_BASIS_NOTE}}

GIẢ ĐỊNH CHI PHÍ KINH DOANH:
{{COST_ASSUMPTIONS}}

Trả về JSON đúng các trường (7 trường đầu là markdown NGẮN GỌN, trường
"competitors" là MẢNG JSON):

1. "summary" — 3-5 gạch đầu dòng: điểm nổi bật từ MÔ TẢ NGƯỜI BÁN, so giá
   bán lẻ/xưởng nếu có. Riêng từ ĐÁNH GIÁ NGƯỜI MUA (nguồn tách biệt,
   không trộn với mô tả người bán) — nếu dữ liệu có đánh giá — PHẢI liệt
   kê CỤ THỂ theo 3 nhóm: ✨ điểm nổi bật khách xác nhận (1 dòng), 💭 nỗi
   đau/insight khách mua vì muốn giải quyết gì (1-2 dòng), ⚠️ phàn nàn cụ
   thể (2-3 dòng, TRỌNG TÂM — ưu tiên vấn đề lặp lại ở nhiều đánh giá).
   Chèn ảnh bằng ![mô tả](url) CHỈ dùng đúng url sau:
   {{IMAGE_URLS}}
2. "audience" — tối đa 5 gạch đầu dòng: độ tuổi, giới tính, insight chính
   (ưu tiên dùng 💭 nỗi đau/insight đã bóc tách ở mục 1 nếu có), vấn đề
   giải quyết, 1 use case mở rộng.
3. "channels" — 3-4 kênh khả thi nhất, mỗi kênh 1 dòng lý do.
4. "customization" — 3-5 ý tưởng, MỖI ý gắn nhãn 🟢An toàn/🟡Cân nhắc/
   🔴Mạo hiểm ngay đầu dòng. ƯU TIÊN ít nhất 1 ý khắc phục đúng phàn nàn
   (⚠️) đã liệt kê ở mục 1, ghi "Khắc phục: ..." đầu dòng ý đó.
5. "importInfo" — nếu có Search PHẢI dùng tra luật hiện hành, không thì
   nói rõ "chưa tra cứu được". Súc tích: mã HS + lý do ngắn, % thuế nhập
   khẩu + VAT, có cần công bố hợp quy không, rủi ro nếu vi phạm. Không
   bịa số liệu/điều luật.
6. "shipping" — 3-4 gạch đầu dòng: cách đóng gói phù hợp + lý do — nếu
   mục 1 có phàn nàn (⚠️) về đóng gói/vận chuyển thì nêu cách khắc phục.
7. "feasibility" — PHẢI đủ:
   a) 1-2 câu: mô hình tổng kho hay tự bán hợp hơn + % chi phí ước tính
      dựa trên GIẢ ĐỊNH CHI PHÍ ở trên.
   b) Nếu có Search, tìm đối thủ thật điền vào field "competitors" (name,
      url, platform, priceVnd) — rỗng nếu không tìm được, không bịa. Phần
      văn xuôi chỉ 1-2 câu nhận xét khách quan, không mặc định lạc quan.
   c) 2-3 gạch đầu dòng cơ hội/thách thức (gồm cả thông quan/kiểm hóa).
   d) "Phản biện" (BẮT BUỘC): 2-3 câu nêu lý do THUYẾT PHỤC NHẤT vì sao
      KHÔNG nên làm, cụ thể cho sản phẩm này — nghiêm túc, không emoji.
   e) 3 mức giá (hòa vốn / trung bình / cao) thay vì bảng dài, mỗi mức
      1 dòng mô tả tệp khách hàng phản ứng ra sao.
   f) Kết luận đúng 1 trong 3 nhãn (khả thi/khả thi có điều kiện/không
      khả thi) — không mặc định chọn nhãn giữa — kèm % ước lượng thành
      công thực tế + 1 câu lý do.
`.trim();

const MARKETING_PROMPT_TEMPLATE = `
Bạn là chuyên gia content & marketing thương mại điện tử (TikTok Shop,
Shopee, Facebook) — KHÔNG PHẢI người cổ vũ nhập khẩu mù quáng. Đánh giá
TRUNG LẬP, không thiên vị tích cực. BẮT BUỘC: KHÔNG được thưởng vì làm
hài lòng người đọc — nếu dữ liệu cho thấy không nên làm, PHẢI nói thẳng.

LƯU Ý: số liệu "đã bán" và đánh giá cào từ Taobao/Tmall CÓ THỂ bị làm giả
(đơn hàng ảo, review mua sẵn — phổ biến trên sàn TQ). Không mặc định coi
số bán cao là bằng chứng nhu cầu thật. Có ảnh đánh dấu "ẢNH THẬT từ khách
đã mua" thì đối chiếu với ảnh chính thức, nêu sai lệch nếu có.

TRỌNG TÂM bản phân tích này là MARKETING/NỘI DUNG — mục 2 "audience" và 3
"channels" PHẢI viết CỰC KỲ chi tiết, đào sâu; các mục 5 "importInfo" và 6
"shipping" chỉ cần tóm tắt ý chính (không phải trọng tâm, ghi rõ điều này
ở đầu 2 mục đó). Toàn bộ tiếng Việt, mục mô tả/kênh bán nhiều emoji sinh
động; phần cảnh báo rủi ro/phản biện/kết luận tiêu cực: nghiêm túc, không
tô hồng, hạn chế emoji.

SẢN PHẨM: {{PRODUCT_NAME}}
{{USER_DESCRIPTION}}

DỮ LIỆU TỪ CÁC LINK NGUỒN:
{{LISTINGS_DATA}}

GHI CHÚ CƠ SỞ GIÁ (bắt buộc đọc trước khi tính giá vốn/giá xưởng):
{{PRICE_BASIS_NOTE}}

GIẢ ĐỊNH CHI PHÍ KINH DOANH:
{{COST_ASSUMPTIONS}}

Trả về JSON đúng các trường (7 trường đầu là markdown, "competitors" là
MẢNG JSON):

1. "summary" — mô tả tổng hợp từ MÔ TẢ NGƯỜI BÁN. Có đoạn riêng "🔍 Bóc
   tách tiếng nói người mua" (CHỈ từ đánh giá, nguồn tách biệt với mô tả
   người bán) — liệt kê KHÔNG GIỚI HẠN theo 3 nhóm: ✨ điểm nổi bật khách
   XÁC NHẬN thực tế, 💭 nỗi đau/insight (vì sao khách mua, giải quyết vấn
   đề gì), ⚠️ phàn nàn CỤ THỂ (TRỌNG TÂM — càng chi tiết càng tốt, ưu tiên
   vấn đề lặp lại ở nhiều đánh giá). 3 nhóm này là nguyên liệu để né điểm
   yếu khi viết content, hoặc chủ động xử lý trong caption/video (vd cam
   kết đổi trả nếu khách hay phàn nàn 1 lỗi cụ thể) — PHẢI dùng lại ở mục
   2, 3, 4 bên dưới. Chèn ảnh ![mô tả](url) CHỈ dùng đúng url:
   {{IMAGE_URLS}}
2. "audience" — ĐẦY ĐỦ VÀ SÂU cả 6 mục: độ tuổi, giới tính/xu hướng, insight
   chính+phụ TỪNG tệp (ưu tiên dùng 💭 nỗi đau/insight đã bóc tách ở mục 1
   làm bằng chứng), vấn đề sản phẩm giải quyết, use case mở rộng, lý
   giải dựa số liệu/vấn đề xã hội thực tế nếu biết — đây là nền tảng để
   viết content nhắm đúng tâm lý khách hàng.
3. "channels" — TRỌNG TÂM: với TikTok Shop, viết hẳn 3-5 Ý TƯỞNG VIDEO
   KHÁC NHAU, mỗi ý tưởng có: hook 3 giây đầu, kịch bản tóm tắt theo mốc
   thời gian, góc quay, gợi ý nhạc/xu hướng, caption + hashtag mẫu — ƯU
   TIÊN khai thác ✨ điểm nổi bật xác nhận và 💭 nỗi đau đã bóc tách ở mục
   1 làm hook/góc quay đánh đúng tâm lý khách thật. Với Shopee/Lazada:
   cách tối ưu tiêu đề/ảnh bìa/mô tả để tăng CTR. Với cửa hàng offline
   (nếu phù hợp): cách trưng bày/tư vấn. Mỗi kênh nêu rõ lý do phù hợp
   với sản phẩm này.
4. "customization" — nhiều ý tưởng, MỖI ý gắn nhãn 🟢An toàn/🟡Cân nhắc/
   🔴Mạo hiểm, ưu tiên ý tưởng tạo NỘI DUNG lan truyền được (unbox, before-
   after, demo bất ngờ...). BẮT BUỘC có ít nhất 1 ý ứng với MỖI phàn nàn
   (⚠️) đã liệt kê ở mục 1 — ghi "Khắc phục phàn nàn: ..." đầu dòng, vì
   đây cũng là góc content tốt (vd video "chúng tôi đã sửa lỗi X mà khách
   hay phàn nàn").
5. "importInfo" — TÓM TẮT (không phải trọng tâm): mã HS + % thuế/VAT ước
   tính, có cần công bố hợp quy không, rủi ro chính nếu vi phạm. Nếu
   không tra cứu chắc chắn, nói rõ, không bịa.
6. "shipping" — TÓM TẮT: cách đóng gói phù hợp + 1-2 lưu ý chính — nếu
   mục 1 có phàn nàn (⚠️) về đóng gói/vận chuyển thì nêu cách khắc phục.
7. "feasibility" — vẫn PHẢI đủ:
   a) So mô hình tổng kho với tự bán, bóc tách % chi phí theo GIẢ ĐỊNH CHI
      PHÍ ở trên, tính giá hòa vốn.
   b) Nếu có Search, tìm đối thủ thật điền "competitors" (name, url,
      platform, priceVnd) — rỗng nếu không tìm được, không bịa. Nhận xét
      khách quan trong văn xuôi, không mặc định lạc quan nếu giá cao hơn.
   c) Cơ hội & thách thức, gồm cả thông quan/kiểm hóa.
   d) "Phản biện" (BẮT BUỘC): lý do THUYẾT PHỤC NHẤT vì sao KHÔNG nên
      làm, cụ thể cho sản phẩm này — nghiêm túc, không emoji.
   e) Bảng giá tăng dần (hòa vốn → lãi ~500%), mỗi mức mô tả tệp khách
      hàng phản ứng ra sao — có thể liên hệ ngược lại ý tưởng content ở
      mục 3 (mức giá nào hợp với chiến dịch TikTok nào).
   f) Kết luận đúng 1 trong 3 nhãn, không mặc định chọn giữa, kèm % ước
      lượng thành công thực tế + lý do.
`.trim();

const LEGAL_PROMPT_TEMPLATE = `
Bạn là chuyên gia xuất nhập khẩu & logistics (thủ tục hải quan, thuế,
kiểm định chất lượng hàng nhập khẩu vào Việt Nam) — KHÔNG PHẢI người cổ
vũ nhập khẩu. Đánh giá TRUNG LẬP. BẮT BUỘC: KHÔNG được thưởng vì làm hài
lòng người đọc — nếu sản phẩm này có rủi ro pháp lý lớn, PHẢI nói thẳng.

LƯU Ý: số liệu "đã bán"/đánh giá cào từ Taobao/Tmall CÓ THỂ bị làm giả
(đơn hàng ảo, review mua sẵn — phổ biến trên sàn TQ), không coi là bằng
chứng nhu cầu thật tuyệt đối. Có ảnh đánh dấu "ẢNH THẬT từ khách đã mua"
thì đối chiếu với ảnh chính thức, nêu sai lệch nếu có.

TRỌNG TÂM bản phân tích này là PHÁP LÝ/NHẬP KHẨU — mục 5 "importInfo"
PHẢI viết CỰC KỲ chi tiết, đầy đủ quy trình từng bước; các mục 3 "channels"
và 4 "customization" chỉ cần tóm tắt (ghi rõ điều này ở đầu 2 mục đó).
Toàn bộ tiếng Việt. Phần pháp lý/cảnh báo rủi ro/phản biện: văn phong
nghiêm túc xuyên suốt, hạn chế emoji kể cả ở mục khác không bắt buộc vui.

SẢN PHẨM: {{PRODUCT_NAME}}
{{USER_DESCRIPTION}}

DỮ LIỆU TỪ CÁC LINK NGUỒN:
{{LISTINGS_DATA}}

GHI CHÚ CƠ SỞ GIÁ (bắt buộc đọc trước khi tính giá vốn/giá xưởng):
{{PRICE_BASIS_NOTE}}

GIẢ ĐỊNH CHI PHÍ KINH DOANH:
{{COST_ASSUMPTIONS}}

Trả về JSON đúng các trường (7 trường đầu là markdown, "competitors" là
MẢNG JSON):

1. "summary" — mô tả tổng hợp từ mô tả người bán. Riêng từ đánh giá khách
   mua (nguồn tách biệt) — nếu có — tóm tắt ngắn theo 3 nhóm: ✨ nổi bật
   khách xác nhận, 💭 nỗi đau/insight, ⚠️ phàn nàn cụ thể (không cần đào
   sâu như bản tổng hợp, không phải trọng tâm bản này, nhưng phàn nàn về
   chất lượng/an toàn có thể liên quan tới rủi ro kiểm định ở mục 5, nếu
   có thì vẫn phải nêu). Chèn ảnh ![mô tả](url) CHỈ dùng đúng url:
   {{IMAGE_URLS}}
2. "audience" — đủ 6 mục như bình thường, không cần quá sâu.
3. "channels" — TÓM TẮT: 2-3 kênh khả thi nhất, mỗi kênh 1 dòng lý do.
4. "customization" — TÓM TẮT: 3-4 ý, gắn nhãn 🟢An toàn/🟡Cân nhắc/
   🔴Mạo hiểm — ưu tiên 1 ý khắc phục phàn nàn (⚠️) đã liệt kê ở mục 1
   nếu có.
5. "importInfo" — TRỌNG TÂM, PHẢI CỰC KỲ CHI TIẾT. BẮT BUỘC dùng Google
   Search (nếu có) tra cứu quy định HIỆN HÀNH, không dựa trí nhớ; nếu
   không có Search, nói rõ ngay đầu "chưa tra cứu được nguồn chính thức,
   cần tự kiểm tra lại". Gồm:
   - Mã HS Code phù hợp nhất + giải thích lý do chọn
   - % thuế nhập khẩu ưu đãi + % thuế GTGT/VAT
   - Có cần kiểm tra chất lượng/công bố hợp quy/hợp chuẩn không, làm ở
     đâu, quy trình từng bước cụ thể
   - Quy trình khai báo hải quan từng bước (bộ hồ sơ, nơi nộp, thời gian
     xử lý ước tính)
   - Checklist giấy tờ người dùng CẦN TỰ CHUẨN BỊ và checklist CẦN HỎI
     nhà sản xuất trước khi đặt hàng (2 danh sách riêng)
   - Phân tích rủi ro theo TỪNG kịch bản cụ thể: bị kiểm hóa ngẫu nhiên,
     khai sai mã HS, thiếu công bố hợp quy — mỗi kịch bản nêu rõ hậu quả/
     mức phạt/khả năng bị giữ hàng
   - MỌI thông tin luật PHẢI trích dẫn rõ tên văn bản/điều khoản/thông
     tư/nghị định cụ thể; không chắc chắn thì nói rõ, không bịa.
6. "shipping" — đủ như bình thường: cách đóng gói, lưu ý, gợi ý thêm —
   nếu mục 1 có phàn nàn (⚠️) về đóng gói/vận chuyển thì nêu cách khắc phục.
7. "feasibility" — vẫn PHẢI đủ:
   a) So mô hình tổng kho với tự bán, bóc tách % chi phí theo GIẢ ĐỊNH CHI
      PHÍ, cộng thêm chi phí pháp lý/kiểm định từ mục 5 vào giá vốn khi
      tính giá hòa vốn.
   b) Nếu có Search, tìm đối thủ thật điền "competitors" (name, url,
      platform, priceVnd) — rỗng nếu không tìm được, không bịa.
   c) Cơ hội & thách thức — TRỌNG TÂM vào thông quan/kho bãi/kiểm hóa/
      đăng kiểm, liên hệ chặt với mục 5.
   d) "Phản biện" (BẮT BUỘC): lý do THUYẾT PHỤC NHẤT vì sao KHÔNG nên
      làm — ưu tiên rủi ro pháp lý/kiểm định nếu có — nghiêm túc, không
      emoji.
   e) Bảng giá tăng dần (hòa vốn → lãi ~500%), có tính cả chi phí pháp lý.
   f) Kết luận đúng 1 trong 3 nhãn, không mặc định chọn giữa, kèm % ước
      lượng thành công thực tế + lý do (ưu tiên cân nhắc rủi ro pháp lý).
`.trim();

const SKEPTIC_PROMPT_TEMPLATE = `
Bạn là nhà đầu tư khó tính, đa nghi — từng mất tiền vì nhập hàng ẩu theo
phong trào không kiểm chứng kỹ. Nhiệm vụ của bạn là chủ động TÌM MỌI LÝ
DO ĐỂ BÁC BỎ trước, CHỈ chấp nhận kết luận tích cực khi bằng chứng thực
sự thuyết phục, không suy diễn dễ dãi. BẮT BUỘC: bạn KHÔNG được thưởng vì
làm hài lòng người đọc — nói thẳng nếu sản phẩm này nên tránh.

LƯU Ý: số liệu "đã bán"/đánh giá cào từ Taobao/Tmall CÓ THỂ bị làm giả
(đơn hàng ảo, review mua sẵn — phổ biến trên sàn TQ). MẶC ĐỊNH hoài nghi
số liệu này cho tới khi có lý do tin nó là thật (vd nhiều đánh giá có nội
dung/ảnh khác nhau, không rập khuôn). Có ảnh đánh dấu "ẢNH THẬT từ khách
đã mua" thì đối chiếu kỹ với ảnh chính thức, đây là bằng chứng đáng tin
hơn text — nêu rõ mọi sai lệch phát hiện được.

Toàn bộ nội dung tiếng Việt. KHÔNG dùng emoji ở BẤT KỲ mục nào (kể cả mục
mô tả/khách hàng/kênh bán) — giữ văn phong nghiêm túc, thẳng thắn xuyên
suốt, không tô hồng bất cứ chỗ nào.

SẢN PHẨM: {{PRODUCT_NAME}}
{{USER_DESCRIPTION}}

DỮ LIỆU TỪ CÁC LINK NGUỒN:
{{LISTINGS_DATA}}

GHI CHÚ CƠ SỞ GIÁ (bắt buộc đọc trước khi tính giá vốn/giá xưởng):
{{PRICE_BASIS_NOTE}}

GIẢ ĐỊNH CHI PHÍ KINH DOANH:
{{COST_ASSUMPTIONS}}

Trả về JSON đúng các trường (7 trường đầu là markdown, "competitors" là
MẢNG JSON):

1. "summary" — mô tả tổng hợp KHÁCH QUAN (không PR) từ mô tả người bán —
   không tin tuyệt đối, đây chỉ là lời quảng cáo 1 chiều. BẮT BUỘC có đoạn
   riêng "🔍 Bóc tách tiếng nói người mua" (CHỈ từ đánh giá — nguồn tách
   biệt, gần khách thật hơn mô tả người bán dù có thể lẫn seeding) — chủ
   động "vạch lá tìm sâu", liệt kê KHÔNG GIỚI HẠN theo 3 nhóm: ✨ điểm nổi
   bật khách XÁC NHẬN thực tế, 💭 nỗi đau/insight (vì sao khách mua, kỳ
   vọng gì), ⚠️ phàn nàn CỤ THỂ (TRỌNG TÂM — không gộp chung chung, đặc
   biệt chú ý vấn đề lặp lại ở NHIỀU đánh giá — coi đây là tín hiệu đáng
   tin hơn review khen, vì khen dễ mua/làm giả hàng loạt còn phàn nàn thật
   thường hiếm và cụ thể hơn). Phần ✨ khen chỉ nhắc ngắn, KHÔNG đào sâu —
   trọng tâm dồn hết vào ⚠️. Chèn ảnh ![mô tả](url) CHỈ dùng đúng url:
   {{IMAGE_URLS}}
2. "audience" — đủ 6 mục, dùng 💭 nỗi đau/insight đã bóc tách ở mục 1 làm
   bằng chứng, nhưng nêu rõ tệp nào thực ra KHÓ chinh phục/dễ quay lưng,
   không chỉ liệt kê tệp thuận lợi.
3. "channels" — với mỗi kênh đề xuất, PHẢI kèm lý do KÊNH ĐÓ CÓ THỂ THẤT
   BẠI (chi phí ẩn, cạnh tranh, thuật toán thay đổi...), không chỉ nêu ưu
   điểm.
4. "customization" — mỗi ý tưởng gắn nhãn 🟢An toàn/🟡Cân nhắc/🔴Mạo hiểm,
   nhưng ưu tiên chỉ ra ý nào THỰC SỰ đáng đầu tư, thẳng thắn loại bỏ ý
   nghe hay nhưng không đáng công sức. BẮT BUỘC xét xem MỖI phàn nàn (⚠️)
   đã liệt kê ở mục 1 có khắc phục được thật không — nếu không khắc phục
   được bằng tùy chỉnh sản phẩm (vd lỗi từ chính chất lượng nguyên liệu
   gốc), PHẢI nói thẳng thay vì cố gợi ý giải pháp không thực tế.
5. "importInfo" — nếu có Search, PHẢI dùng tra luật hiện hành; nếu không,
   nói rõ "chưa tra cứu được". Đủ mã HS/thuế/VAT/hợp quy/checklist/rủi ro
   như bình thường, nhưng nhấn mạnh RÕ NHẤT các trường hợp dễ bị phạt/giữ
   hàng nếu làm ẩu.
6. "shipping" — đủ như bình thường, nhấn thêm rủi ro hư hỏng/khiếu nại —
   nếu mục 1 có phàn nàn (⚠️) về đóng gói/vận chuyển, đánh giá THẲNG THẮN
   xem có khắc phục triệt để được không hay chỉ giảm nhẹ phần nào.
7. "feasibility" — PHẢI đủ, và giữ tinh thần HOÀI NGHI xuyên suốt:
   a) So mô hình tổng kho với tự bán, bóc tách % chi phí theo GIẢ ĐỊNH CHI
      PHÍ — chỉ rõ mô hình nào RỦI RO THẤP HƠN, không chỉ mô hình lãi cao
      hơn trên giấy.
   b) Nếu có Search, tìm đối thủ thật điền "competitors" (name, url,
      platform, priceVnd) — rỗng nếu không tìm được, không bịa. Nếu giá
      sản phẩm này cao hơn đối thủ, MẶC ĐỊNH coi là bất lợi thật sự, chỉ
      bác bỏ nhận định này khi có bằng chứng khác biệt RÕ RÀNG.
   c) Cơ hội & thách thức — liệt kê thách thức TRƯỚC, chi tiết hơn cơ
      hội, gồm cả thông quan/kiểm hóa.
   d) "Phản biện" (BẮT BUỘC, MỞ RỘNG): nêu ÍT NHẤT 2 lý do THUYẾT PHỤC
      độc lập vì sao KHÔNG nên làm, cụ thể cho sản phẩm này.
   e) Bảng giá tăng dần (hòa vốn → lãi ~500%) — ở MỖI mức, nói rõ khả
      năng KHÔNG đạt được doanh số kỳ vọng, không chỉ mô tả viễn cảnh đẹp.
   f) Kết luận đúng 1 trong 3 nhãn — THIÊN VỀ THẬN TRỌNG khi dữ liệu chưa
      đủ rõ ràng (không lạc quan tùy tiện), kèm % ước lượng thành công
      thực tế + ít nhất 1 lý do CỤ THỂ vì sao KHÔNG cho điểm cao hơn.
`.trim();

// 5 preset khởi tạo sẵn — người dùng tự thêm/sửa/xóa/đổi tên tùy ý, đây
// chỉ là điểm bắt đầu với vài hướng khai thác khác nhau để tham khảo.
export const DEFAULT_PROMPT_PRESETS: PromptPreset[] = [
  { id: "default", name: "Mặc định — Tư vấn toàn diện", content: DEFAULT_PROMPT_TEMPLATE },
  { id: "short", name: "Ngắn gọn — Tóm tắt nhanh", content: SHORT_PROMPT_TEMPLATE },
  { id: "marketing", name: "Tập trung Marketing & TikTok", content: MARKETING_PROMPT_TEMPLATE },
  { id: "legal", name: "Tập trung Pháp lý & Nhập khẩu", content: LEGAL_PROMPT_TEMPLATE },
  { id: "skeptic", name: "Phản biện gắt — Nhà đầu tư khó tính", content: SKEPTIC_PROMPT_TEMPLATE },
];

// ------------------------------------------------------------
// VIỆC 2 — DỊCH THUẦN TÚY (title/mô tả/tên SKU): GHÉP vào CHUNG 1 request
// với việc phân tích 7 mục ở trên để KHÔNG tốn thêm lượt gọi API (không
// còn nút "dịch" gọi riêng cho từng ô). Khối hướng dẫn này CỐ ĐỊNH,
// KHÔNG nằm trong phần prompt phân tích mà người dùng tự sửa được ở
// Cài đặt > Prompt AI — để việc dịch luôn chạy đúng, không bị ảnh hưởng
// nếu người dùng chỉnh sửa văn phong prompt phân tích.
// BẮT BUỘC: 2 việc phải ĐỘC LẬP, không được để việc này lấn/ảnh hưởng
// tới việc kia (không suy diễn/thêm ý kiến khi dịch; không lấy văn phong
// phân tích khi dịch).
// ------------------------------------------------------------
function buildTranslationTask(input: AnalysisInput): string {
  const listingsText = input.listings
    .map((l) => {
      const variantsText = l.variants
        .map((v) => `    - variantId ${v.id}: "${v.nameOriginal}"`)
        .join("\n");
      return [
        `- listingId ${l.id}:`,
        l.titleOriginal ? `  - Tên gốc: "${l.titleOriginal}"` : "",
        l.descriptionOriginal ? `  - Mô tả gốc: "${l.descriptionOriginal}"` : "",
        variantsText ? `  - Các SKU (nameOriginal) cần dịch:\n${variantsText}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return `
---
VIỆC 2 (ĐỘC LẬP HOÀN TOÀN VỚI VIỆC 1 Ở TRÊN — KHÔNG được để 2 việc ảnh
hưởng lẫn nhau): CHỈ DỊCH sang tiếng Việt các đoạn text gốc dưới đây,
KHÔNG phân tích, KHÔNG nhận xét, KHÔNG thêm/bớt ý, dịch sát nghĩa và tự
nhiên. Trả kết quả vào field "translations":

1. "translations.productName": dựa vào TOÀN BỘ tên gốc + mô tả gốc bên
   dưới, đặt 1 tên sản phẩm tiếng Việt NGẮN GỌN, ĐÚNG BẢN CHẤT sản phẩm
   (nhìn kỹ ảnh + text gốc, TUYỆT ĐỐI KHÔNG bịa/đoán sai loại sản phẩm).

2. "translations.listings": với MỖI listingId bên dưới, dịch "Tên gốc"
   -> titleVi và "Mô tả gốc" -> descriptionVi (bỏ qua field nếu không có
   gốc tương ứng):
${listingsText}

3. "translations.variants": với MỖI variantId bên dưới, dịch nameOriginal
   -> nameVi (tên phân loại/SKU, thường ngắn như màu sắc/kích cỡ).
`.trim();
}

// ------------------------------------------------------------
// VIỆC 3 — GỢI Ý NGÀNH HÀNG: cũng GHÉP vào CHUNG 1 request (không tốn
// thêm lượt gọi API). Độc lập với việc 1 (phân tích) và việc 2 (dịch).
// AI CHỈ được chọn đúng 1 tên trong danh sách app cung cấp (ép cứng
// bằng "enum" trong RESULT_SCHEMA — Gemini không thể trả tên khác dù
// có muốn), không tự đặt tên ngành hàng mới.
// ------------------------------------------------------------
function buildCategoryTask(availableCategories: string[]): string {
  if (availableCategories.length === 0) return "";
  return `
---
VIỆC 3 (ĐỘC LẬP HOÀN TOÀN VỚI VIỆC 1 VÀ VIỆC 2 Ở TRÊN): dựa vào ảnh +
toàn bộ dữ liệu sản phẩm, chọn ĐÚNG 1 ngành hàng PHÙ HỢP NHẤT trong
danh sách sau, trả vào field "categorySuggestion" (chỉ được chọn nguyên
văn 1 tên trong danh sách, không tự đặt tên khác):
${availableCategories.map((c) => `- ${c}`).join("\n")}
`.trim();
}

// Gộp ảnh CHÍNH THỨC (ScrapedImage/ListingImage) và ảnh ĐÁNH GIÁ (khách
// mua đính kèm review) thành 1 danh sách để gửi Gemini — giữ lại nguồn
// gốc (listingIdx/group) để gắn nhãn đúng chỗ lúc build request bên dưới.
// Ảnh chính thức LUÔN đứng trước ảnh đánh giá trong mảng này -> nếu cắt
// bớt vì chạm trần MAX_IMAGE_COUNT/MAX_TOTAL_IMAGE_BYTES (xem
// fetchImagesAsParts), ảnh chính thức luôn được ưu tiên giữ lại trước.
interface ImageRef {
  url: string;
  listingIdx: number;
  group: "official" | "review";
}

function buildImageRefs(listings: AnalysisInput["listings"]): ImageRef[] {
  const official = listings.flatMap((l, i) =>
    l.imageUrls.map((url) => ({ url, listingIdx: i, group: "official" as const }))
  );
  const review = listings.flatMap((l, i) =>
    l.reviewImageUrls.map((url) => ({ url, listingIdx: i, group: "review" as const }))
  );
  return [...official, ...review];
}

type ContentPart = { text: string } | { inlineData: { mimeType: string; data: string } };

// Sắp ảnh đã fetch được thành parts CÓ NHÃN rõ ràng theo từng nguồn: khối
// "ẢNH CHÍNH THỨC từ shop" trước, "ẢNH THẬT từ khách đã mua" sau — để AI
// không lẫn lộn 2 nguồn ảnh khi đối chiếu (xem đoạn "LƯU Ý VỀ ĐỘ TIN CẬY
// DỮ LIỆU" trong prompt).
function buildLabeledImageParts(
  listings: AnalysisInput["listings"],
  refs: ImageRef[],
  parts: { inlineData: { mimeType: string; data: string } }[],
  includedUrls: string[]
): ContentPart[] {
  const refByUrl = new Map(refs.map((r) => [r.url, r]));
  const buckets = new Map<string, { inlineData: { mimeType: string; data: string } }[]>();
  includedUrls.forEach((url, i) => {
    const ref = refByUrl.get(url);
    if (!ref) return;
    const key = `${ref.listingIdx}-${ref.group}`;
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(parts[i]);
  });

  const result: ContentPart[] = [];
  listings.forEach((l, i) => {
    const officialParts = buckets.get(`${i}-official`);
    if (officialParts?.length) {
      result.push({ text: `--- Nguồn ${i + 1} (${l.platform}) — ẢNH CHÍNH THỨC từ shop: ---` }, ...officialParts);
    }
  });
  listings.forEach((l, i) => {
    const reviewParts = buckets.get(`${i}-review`);
    if (reviewParts?.length) {
      result.push(
        {
          text: `--- Nguồn ${i + 1} — ẢNH THẬT từ khách đã mua (đối chiếu, KHÔNG PHẢI ảnh quảng cáo, shop không kiểm soát): ---`,
        },
        ...reviewParts
      );
    }
  });
  return result;
}

// Giới hạn KỸ THUẬT thật của Gemini: tối đa 3.600 ảnh và ~100MB payload
// mỗi request. Không giới hạn theo tốc độ — ưu tiên gửi ĐỦ dữ liệu để
// AI phân tích chính xác nhất, chậm hơn không sao (người dùng không
// ngồi chờ xem trực tiếp). Chỉ cắt bớt khi thật sự sắp chạm trần kỹ
// thuật, để tránh Gemini từ chối thẳng cả request.
// KHÔNG được tách thành nhiều request — sẽ ra nhiều bản phân tích không
// nhất quán với nhau, mất đúng ý "1 request duy nhất".
const MAX_TOTAL_IMAGE_BYTES = 80 * 1024 * 1024; // chừa margin dưới trần 100MB thật
const MAX_IMAGE_COUNT = 500; // chặn kỹ thuật cho trường hợp cực đoan, còn xa trần 3.600

// Schema tạo động vì "categorySuggestion" cần ép enum theo ĐÚNG danh
// sách ngành hàng thật đang có trong database tại thời điểm phân tích
// (không cố định cứng trong code — người dùng vẫn thêm/sửa ngành hàng
// tùy ý ở trang "Tag & Ngành hàng").
function buildResultSchema(availableCategories: string[]) {
  return {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING },
      audience: { type: Type.STRING },
      channels: { type: Type.STRING },
      customization: { type: Type.STRING },
      importInfo: { type: Type.STRING },
      shipping: { type: Type.STRING },
      feasibility: { type: Type.STRING },
      // Đối thủ cạnh tranh thật (mục 7b) — field JSON riêng, không phải
      // markdown, để không phải dựa vào groundingChunks (không tách được
      // theo mục khi 1 request làm nhiều việc). Rỗng nếu không tra được.
      competitors: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            url: { type: Type.STRING },
            platform: { type: Type.STRING },
            priceVnd: { type: Type.NUMBER },
          },
          required: ["name", "url"],
        },
      },
      // Việc 2 (dịch thuần túy) — độc lập với 7 mục phân tích ở trên
      translations: {
        type: Type.OBJECT,
        properties: {
          productName: { type: Type.STRING },
          listings: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.NUMBER },
                titleVi: { type: Type.STRING },
                descriptionVi: { type: Type.STRING },
              },
              required: ["id"],
            },
          },
          variants: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.NUMBER },
                nameVi: { type: Type.STRING },
              },
              required: ["id"],
            },
          },
        },
        required: ["productName", "listings", "variants"],
      },
      // Việc 3 (gợi ý ngành hàng) — độc lập, ép enum theo danh sách thật
      ...(availableCategories.length > 0
        ? { categorySuggestion: { type: Type.STRING, enum: availableCategories } }
        : {}),
    },
    required: [
      "summary",
      "audience",
      "channels",
      "customization",
      "importInfo",
      "shipping",
      "feasibility",
      "competitors",
      "translations",
    ],
  };
}

export async function generateProductAnalysis(
  input: AnalysisInput,
  apiKey: string,
  promptTemplate: string = DEFAULT_PROMPT_TEMPLATE,
  costAssumptions: CostAssumptions = DEFAULT_COST_ASSUMPTIONS,
  availableCategories: string[] = [],
  markupRatios: CategoryMarkupRatio[] = DEFAULT_CATEGORY_MARKUP_RATIOS
): Promise<AiAnalysisResult> {
  const ai = new GoogleGenAI({ apiKey });

  const imageRefs = buildImageRefs(input.listings).slice(0, MAX_IMAGE_COUNT);
  const { parts: imageParts, includedUrls } = await fetchImagesAsParts(imageRefs.map((r) => r.url));
  const labeledImageParts = buildLabeledImageParts(input.listings, imageRefs, imageParts, includedUrls);

  // {{IMAGE_URLS}} trong prompt CHỈ liệt kê ảnh CHÍNH THỨC (AI được phép
  // chèn ![](url) các ảnh này vào markdown trả về) — ảnh đánh giá chỉ để
  // đối chiếu, không dùng để minh họa báo cáo.
  const refByUrl = new Map(imageRefs.map((r) => [r.url, r]));
  const officialIncludedUrls = includedUrls.filter((url) => refByUrl.get(url)?.group === "official");

  const analysisPrompt = fillTemplate(promptTemplate, input, officialIncludedUrls, costAssumptions, markupRatios);
  const prompt = `${analysisPrompt}\n\n${buildTranslationTask(input)}\n\n${buildCategoryTask(availableCategories)}`;
  const contents = [{ role: "user", parts: [{ text: prompt }, ...labeledImageParts] }];
  const baseConfig = {
    responseMimeType: "application/json",
    responseSchema: buildResultSchema(availableCategories),
  } as const;

  // Ưu tiên bật Google Search Grounding để mục "importInfo" tra cứu được
  // luật/thuế hiện hành thật. Một số tài khoản Google Cloud CHƯA liên
  // kết phương thức thanh toán sẽ bị chặn tính năng này (lỗi 429) dù
  // vẫn trong hạn mức miễn phí — không được để lỗi đó làm hỏng cả 7 mục,
  // nên tự động thử lại KHÔNG có Search Grounding nếu lần đầu thất bại.
  let response;
  try {
    response = await withGeminiRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: { ...baseConfig, tools: [{ googleSearch: {} }] },
      })
    );
  } catch (err) {
    console.error("Gemini + Search Grounding lỗi, thử lại không có Search Grounding:", err);
    response = await withGeminiRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: baseConfig,
      })
    );
  }

  const text = response.text;
  if (!text) throw new Error("Gemini không trả về nội dung.");

  const parsed = JSON.parse(text) as AiAnalysisResult;
  const required: (keyof AiAnalysisResult)[] = [
    "summary",
    "audience",
    "channels",
    "customization",
    "importInfo",
    "shipping",
    "feasibility",
  ];
  if (required.some((key) => !parsed[key])) {
    throw new Error("Gemini trả về thiếu dữ liệu (thiếu 1 trong 7 mục).");
  }
  if (!parsed.translations) {
    throw new Error("Gemini trả về thiếu dữ liệu (thiếu bản dịch).");
  }

  // Đối thủ cạnh tranh thật (mục 7b) — AI tự điền vào field riêng
  // "competitors" (không phải groundingChunks, xem giải thích trong
  // interface AiAnalysisResult) — gắn thành markdown vào cuối feasibility.
  if (parsed.competitors && parsed.competitors.length > 0) {
    parsed.feasibility += `\n\n---\n🔎 **Sản phẩm/giá đối thủ AI tự tra cứu được:**\n${parsed.competitors
      .map((c) => {
        const priceText = c.priceVnd ? ` — khoảng ${c.priceVnd.toLocaleString("vi-VN")}đ` : "";
        const platformText = c.platform ? ` (${c.platform})` : "";
        return `- [${c.name}](${c.url})${platformText}${priceText}`;
      })
      .join("\n")}`;
  }

  // Đính kèm nguồn Google Search đã tra cứu (nếu có dùng) vào cuối mục
  // nhập khẩu — LƯU Ý: 1 request có thể search cho NHIỀU mục khác nhau
  // (luật nhập khẩu, giá đối thủ...) nhưng Gemini chỉ trả về 1 danh sách
  // nguồn CHUNG cho cả câu trả lời, không tách được nguồn nào ứng với
  // mục nào — nên ghi rõ "có thể liên quan" thay vì khẳng định chắc chắn
  // là nguồn cho riêng mục nhập khẩu.
  const sources = extractGroundingSources(response);
  if (sources.length > 0) {
    parsed.importInfo += `\n\n---\n🔗 **Nguồn Google Search đã tra cứu được (có thể liên quan đến nhập khẩu hoặc so sánh giá ở mục khả thi):**\n${sources
      .map((s) => `- [${s.title}](${s.uri})`)
      .join("\n")}`;
  }

  return parsed;
}

// Lấy danh sách nguồn web thật mà Gemini đã tra cứu qua Search Grounding
// (nếu model quyết định tìm kiếm — không phải lúc nào cũng có).
function extractGroundingSources(
  response: Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>
): { title: string; uri: string }[] {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  return chunks
    .map((c) => (c.web ? { title: c.web.title ?? c.web.uri ?? "Nguồn", uri: c.web.uri ?? "" } : null))
    .filter((s): s is { title: string; uri: string } => !!s && !!s.uri);
}

// Thay các placeholder {{...}} trong prompt (mặc định hoặc do người dùng
// tự sửa) bằng dữ liệu THẬT của sản phẩm — người dùng không tự gõ tay
// phần dữ liệu để tránh nhập sai/thiếu so với database.
function fillTemplate(
  template: string,
  input: AnalysisInput,
  imageUrls: string[],
  costAssumptions: CostAssumptions,
  markupRatios: CategoryMarkupRatio[] = DEFAULT_CATEGORY_MARKUP_RATIOS
): string {
  const listingsText = input.listings
    .map((l, i) => {
      const priceLine = l.priceRangeCny
        ? `Giá: ¥${l.priceRangeCny.min} ~ ¥${l.priceRangeCny.max}`
        : "";
      // Không cắt bớt — text không tốn ngân sách ảnh (MAX_TOTAL_IMAGE_BYTES),
      // không cần giới hạn chặt như trước.
      const reviewsText = l.reviews.length
        ? `Đánh giá người mua:\n${l.reviews.map((r) => `- ${r}`).join("\n")}`
        : "";
      return [
        `--- Nguồn ${i + 1} (${l.sourceType === "RETAIL" ? "shop bán lẻ" : "nhà sản xuất"}, sàn ${l.platform}) ---`,
        l.titleVi ? `Tên: ${l.titleVi}` : "",
        priceLine,
        l.descriptionText ? `Mô tả người bán: ${l.descriptionText}` : "",
        reviewsText,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  const hasFactoryPrice = input.listings.some((l) => l.sourceType === "MANUFACTURER");
  const priceBasisNote = buildPriceBasisNote(hasFactoryPrice, input.categoryNames, markupRatios);

  return template
    .replaceAll("{{PRODUCT_NAME}}", input.productName)
    .replaceAll(
      "{{USER_DESCRIPTION}}",
      input.userDescription ? `Mô tả người dùng tự viết: ${input.userDescription}` : ""
    )
    .replaceAll("{{LISTINGS_DATA}}", listingsText)
    .replaceAll("{{IMAGE_URLS}}", imageUrls.join(", ") || "(không có ảnh)")
    .replaceAll("{{COST_ASSUMPTIONS}}", formatCostAssumptions(costAssumptions))
    .replaceAll("{{PRICE_BASIS_NOTE}}", priceBasisNote);
}

// Tải ảnh về base64 để gửi kèm cho Gemini (API yêu cầu inlineData,
// không nhận thẳng URL công khai). Tải hết TẤT CẢ ảnh song song (không
// giới hạn vì tốc độ), chỉ dừng thêm vào request khi tổng dung lượng
// sắp chạm trần kỹ thuật thật của Gemini (MAX_TOTAL_IMAGE_BYTES).
async function fetchImagesAsParts(
  urls: string[]
): Promise<{ parts: { inlineData: { mimeType: string; data: string } }[]; includedUrls: string[] }> {
  const fetched = await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const mimeType = res.headers.get("content-type") ?? "image/jpeg";
        const buffer = Buffer.from(await res.arrayBuffer());
        return { url, mimeType, buffer };
      } catch {
        return null; // 1 ảnh lỗi không được làm hỏng cả request
      }
    })
  );

  const parts: { inlineData: { mimeType: string; data: string } }[] = [];
  const includedUrls: string[] = [];
  let totalBytes = 0;

  for (const item of fetched) {
    if (!item) continue;
    if (totalBytes + item.buffer.byteLength > MAX_TOTAL_IMAGE_BYTES) continue; // đủ ảnh khác vẫn được xét tiếp, chỉ bỏ ảnh làm vượt trần
    totalBytes += item.buffer.byteLength;
    parts.push({ inlineData: { mimeType: item.mimeType, data: item.buffer.toString("base64") } });
    includedUrls.push(item.url);
  }

  return { parts, includedUrls };
}

export interface CompareProductInput {
  id: number;
  name: string;
  categoryNames?: string[]; // ngành hàng sản phẩm — dùng để tra tỷ lệ markup khi thiếu giá xưởng
  listings: {
    sourceType: string;
    platform: string;
    titleOriginal?: string;
    descriptionOriginal?: string;
    priceRangeCny?: { min: number; max: number };
    imageUrls: string[];
    reviewsOriginal: string[];
  }[];
}

export const COMPARE_GENERAL_TEMPLATE = `
Bạn là Hội đồng Cố vấn Chiến lược cấp cao (Gồm CEO, CFO, COO). Đánh giá TOÀN DIỆN, ĐA CHIỀU và TRUNG LẬP các sản phẩm dưới đây. 
Tuyệt đối KHÔNG PHẢI nhân viên bán hàng hay người cổ vũ nhập khẩu. BẮT BUỘC KHÔNG được khen ngợi sáo rỗng hoặc cố gắng cân bằng để làm vui lòng người đọc. Nếu dữ liệu cho thấy TẤT CẢ sản phẩm đều kém, PHẢI nói thẳng, không cố ép chọn 1 cái tốt nhất nếu nó vẫn là rác. 

LƯU Ý CỐT LÕI VỀ CHỐNG ẢO GIÁC (ANTI-HALLUCINATION):
- Bạn chỉ được phép suy luận dựa trên "DỮ LIỆU CÁC SẢN PHẨM" được cung cấp. KHÔNG bịa đặt chất liệu, công năng, hay vẽ ra những kịch bản không có thật.
- Số liệu "tổng đã bán", "đánh giá người mua" cào từ các sàn (Taobao/1688) CÓ THỂ BỊ LÀM GIẢ rất nhiều. Nếu thấy đánh giá giống nhau y hệt, bão 5 sao không có ảnh thật, bạn PHẢI cảnh báo sự nghi ngờ đó thay vì trích dẫn số liệu như sự thật hiển nhiên.
- Mọi kết luận, nhận định phải đi kèm LÝ DO ĐƯỢC GIẢI THÍCH BẰNG DỮ LIỆU. Không nói "Sản phẩm A tốt hơn" mà phải nói "Sản phẩm A tốt hơn B bởi vì giá nhập của nó rẻ hơn 20% trong khi các tính năng là tương đương dựa trên mô tả...".

DỮ LIỆU CÁC SẢN PHẨM (Bản gốc):
{{PRODUCTS_DATA}}

Yêu cầu định dạng trả lời (Markdown, tiếng Việt, NGHIÊM TÚC, HẠN CHẾ EMOJI Ở PHẦN CẢNH BÁO):

1. 📊 Bảng So Sánh Trực Diện (Tổng Quan Cốt Lõi)
Lập bảng so sánh gồm các cột: Tên sản phẩm, Khoảng giá nhập, Tính năng nổi bật nhất, và Điểm yếu/Rủi ro lớn nhất. KHÔNG thêm các cột vô nghĩa.

2. 🔍 Bóc Tách Ưu/Nhược Điểm Bằng Số Liệu & Sự Thật
Đi sâu vào từng sản phẩm, chỉ ra đâu là công nghệ/tính năng thật sự mang lại giá trị, đâu chỉ là "văn mẫu marketing lùa gà" của xưởng.

3. 📉 Phản Biện Chéo & Bới Móc Rủi Ro Tận Cùng
Đóng vai một người mua cực kỳ khó tính và soi mói. Vạch lá tìm sâu, chỉ ra điểm yếu TRÍ MẠNG của TỪNG sản phẩm so với các sản phẩm còn lại. Liệu chất liệu này có dễ vỡ khi vận chuyển? Tính năng này có thừa thãi không?

4. 🎯 Kết Luận Đa Chiều Từ Hội Đồng (CEO, CFO, COO)
- Đâu là sản phẩm cân bằng tốt nhất giữa Biên lợi nhuận (Góc nhìn CFO) và Mức độ dễ vận hành (Góc nhìn COO)? Giải thích chi tiết tại sao.
- Sản phẩm nào TUYỆT ĐỐI KHÔNG NÊN ĐỤNG VÀO dù giá có vẻ rẻ?
- Tỷ lệ % tự tin của bạn vào kết luận này dựa trên lượng dữ liệu đầu vào.

MỤC ĐÍCH SO SÁNH ĐẶC THÙ (Nếu có): {{COMPARE_PURPOSE}}
`.trim();

export const COMPARE_SAME_CAT_TEMPLATE = `
Bạn là Chuyên gia Nghiên cứu Đối thủ Cạnh tranh, đánh giá khách quan và không khoan nhượng. Các sản phẩm dưới đây cùng thuộc MỘT ngành hàng và đang cạnh tranh trực tiếp. Nhiệm vụ của bạn là so sánh trực diện để xác định sản phẩm có tỷ lệ thành công cao nhất.

LUẬT CHỐNG ẢO GIÁC & QUY ĐỊNH BẮT BUỘC:
- Mọi phân tích phải bám chặt vào "DỮ LIỆU CÁC SẢN PHẨM". Cấm tuyệt đối việc suy diễn vô căn cứ, tự bịa ra thông số, hoặc tự định giá nếu không có dữ liệu gốc.
- Nếu review có dấu hiệu "mua đơn ảo", mô tả né tránh hoặc giấu thông số kỹ thuật, bạn phải chỉ rõ sự mập mờ đó.
- Mọi lý lẽ đánh giá Tỷ lệ Win phải lập luận logic, xoáy sâu vào INSIGHT THỰC TẾ của thị trường Việt Nam (thói quen, thời tiết, sự nhạy cảm về giá).

DỮ LIỆU CÁC SẢN PHẨM (Bản gốc):
{{PRODUCTS_DATA}}

Yêu cầu định dạng trả lời (Markdown, tiếng Việt, SO SÁNH TRỰC DIỆN, DỨT KHOÁT):

1. ⚔️ Đối Chiếu Lợi Thế Cạnh Tranh (USP)
Phân tích điểm bán hàng độc nhất (USP) của từng sản phẩm. Sản phẩm nào đang dùng giá để cạnh tranh? Sản phẩm nào dùng thiết kế hoặc công nghệ để tạo khác biệt? USP nào là giá trị thực, USP nào chỉ là chiêu marketing?

2. 🛡️ Khai Thác Điểm Yếu Của Đối Thủ
Phân tích theo hướng cạnh tranh: Sản phẩm A có điểm yếu nghiêm trọng nào mà Sản phẩm B có thể tận dụng để truyền thông giành khách? Đánh giá mức độ phòng thủ của mỗi sản phẩm trước nguy cơ bị sao chép.

3. 👥 Thấu Hiểu Hành Vi & Khẩu Vị Khách Hàng VN
Dựa vào tính năng và tầm giá của sản phẩm, đánh giá xem tệp khách hàng Việt Nam sẽ thực sự sẵn sàng chi trả cho tính năng nào trong bối cảnh thực tế. (Ví dụ: khách thích rẻ nhưng bền, hay thích đắt nhưng nhiều công năng?).

4. 🏆 Kết Luận Sản Phẩm Tiềm Năng Nhất (Tỷ Lệ Win)
- Chốt lại sản phẩm nào có tỷ lệ WIN (thành công) cao nhất khi tung ra thị trường Việt Nam lúc này. Bắt buộc giải thích logic chốt hạ dựa trên số liệu.
- Các sản phẩm còn lại có tiềm năng thấp hơn vì lý do cốt lõi nào?

MỤC ĐÍCH SO SÁNH ĐẶC THÙ (Nếu có): {{COMPARE_PURPOSE}}
`.trim();

export const COMPARE_CROSS_CAT_TEMPLATE = `
Bạn là Chuyên gia Nghiên cứu Thị trường & Định hướng Đầu tư. Các sản phẩm dưới đây thuộc CÁC NGÀNH KHÁC NHAU. Nhà bán hàng đang có tiền nhưng chưa biết nên đâm đầu vào ngành nào. Bạn phải giúp họ đo lường "Sức đói" của thị trường và độ khó của trò chơi.

QUY TẮC PHÂN TÍCH (CHỐNG BỊA ĐẶT):
- Bạn KHÔNG được tâng bốc thị trường một cách vô lý. Mọi nhận định về độ cạnh tranh (Đại dương đỏ/Đại dương xanh) phải liên kết chặt chẽ với dữ liệu gốc của sản phẩm (khoảng giá, mức độ tinh xảo, lượng mua).
- Yêu cầu đánh giá cực kỳ cẩn trọng, đưa ra rào cản gia nhập đúng với thực tế (VD: Hàng điện tử thì bảo hành phức tạp, Hàng mỹ phẩm thì rủi ro dị ứng/giấy phép, Hàng thời trang thì tồn kho nhanh lỗi mốt).

DỮ LIỆU CÁC SẢN PHẨM (Bản gốc):
{{PRODUCTS_DATA}}

Yêu cầu định dạng trả lời (Markdown, tiếng Việt, KHÁCH QUAN, THỰC TẾ):

1. 🌊 Định Vị Biển Lớn (Đại Dương Xanh và Đỏ)
Phân tích ngành hàng của từng sản phẩm. Ngành nào đang cạnh tranh đẫm máu (Đại dương đỏ - dễ mua dễ bán nhưng biên lãi mỏng, phá giá nhiều)? Ngành nào là ngách hái ra tiền, ít đối thủ (Đại dương xanh)?

2. 🧱 Rào Cản Gia Nhập & Độ Khó Game
Để bắt đầu kinh doanh từng sản phẩm này, nhà bán hàng sẽ phải đối mặt với những rào cản gì? Phân tích sâu: Vốn liếng cần nhiều hay ít? Yêu cầu kỹ năng tư vấn cao không? Cần xin phép hợp quy, hải quan khó khăn không?

3. 💸 Thước Đo Sẵn Sàng Chi Tiêu (Willingness to pay)
Sản phẩm nào đánh vào tệp khách hàng có khả năng và sự hào phóng rút ví cao nhất? (Bán cho người giàu, hay bán cho người thu nhập thấp, hay bán theo cảm xúc?).

4. 🏆 Tuyên Bố Đầu Tư Khôn Ngoan (Tỷ Lệ Win)
- Nếu vốn mỏng (dưới 100 triệu), nên đâm đầu vào ngành/sản phẩm nào để sống sót? Tại sao?
- Nếu có vốn mạnh, muốn chơi lớn và ăn bền, ngành/sản phẩm nào là mỏ vàng thực sự? Tại sao?

MỤC ĐÍCH SO SÁNH ĐẶC THÙ (Nếu có): {{COMPARE_PURPOSE}}
`.trim();

export const COMPARE_CFO_TEMPLATE = `
Bạn là Giám đốc Tài chính (CFO) cực kỳ thực dụng, lạnh lùng và chỉ nói chuyện bằng những con số. Mối quan tâm DUY NHẤT của bạn là: TỐI ƯU VÒNG QUAY VỐN, ROCE (Tỷ suất sinh lời trên vốn) và TUYỆT ĐỐI KHÔNG ĐỂ CHÔN VỐN.

LUẬT CỦA CFO (KHÔNG THỎA HIỆP, KHÔNG ẢO GIÁC):
- Nếu dữ liệu giá nhập/giá bán bị khuyết, hãy tuyên bố thẳng là "Thiếu dữ liệu tài chính", cấm tự lấy giá thị trường bên ngoài bù vào.
- "Rẻ nhất" chưa chắc "Lãi nhất" nếu tỷ lệ hoàn hàng cao. "Đắt nhất" chưa chắc "Khó bán" nếu Markup có thể đẩy lên cao.
- Bạn coi nhẹ mọi yếu tố marketing hay cảm xúc, chỉ nhìn chằm chằm vào rủi ro dòng tiền (Cashflow) và hàng tồn (Inventory).

DỮ LIỆU CÁC SẢN PHẨM (Bản gốc):
{{PRODUCTS_DATA}}

Yêu cầu định dạng trả lời (Markdown, tiếng Việt, BÁO CÁO TÀI CHÍNH CỨNG RẮN):

1. 💰 Bài Toán Biên Lợi Nhuận (Margin Analysis)
Lập bảng so sánh Tỷ suất lợi nhuận gộp ước tính giữa các sản phẩm (Dựa trên chênh lệch giữa giá xưởng và giá bán lẻ). Sản phẩm nào cho phép bán giá cao (Markup) tốt nhất?

2. 🔄 Vận Tốc Dòng Tiền & Vòng Quay Tồn Kho
Đánh giá tính mùa vụ và vòng đời (Lifecycle) của từng sản phẩm. Cái nào là dạng "Trend lướt sóng" (Kiếm tiền nhanh nhưng nếu qua trend thì hàng thành đống rác)? Cái nào là dạng "Bán quanh năm" (Dòng tiền về chậm nhưng bền vững)?

3. 📉 Tử Huyệt Tồn Kho & Rủi Ro Chôn Vốn
Nếu kịch bản xấu nhất xảy ra (ế hàng), sản phẩm nào có thể xả kho thu hồi vốn (Liquidate) dễ nhất? Sản phẩm nào biến thành đống sắt vụn vô giá trị? Có rủi ro hỏng hóc/hết hạn nếu để lâu không?

4. ⚖️ Quyết Định Đầu Tư Của CFO
- Xếp hạng ưu tiên rót vốn từ Cao xuống Thấp dựa TẬN GỐC rễ vào độ an toàn của Dòng tiền và Tỷ suất lợi nhuận.
- Đưa ra 1 Cảnh báo Tối hậu thư (Ultimatum) cho sản phẩm rủi ro nhất.

MỤC ĐÍCH SO SÁNH ĐẶC THÙ (Nếu có): {{COMPARE_PURPOSE}}
`.trim();

export const COMPARE_COO_TEMPLATE = `
Bạn là Giám đốc Vận hành & Chuỗi cung ứng (COO) - người ăn ngủ với kho bãi, kiện hàng và các hãng vận chuyển. Ám ảnh lớn nhất của bạn là: Cước Vận Chuyển Quốc Tế, Trọng Lượng/Thể Tích Hàng Hóa, và Tỷ lệ Phế phẩm (Defect Rate).

QUY ĐỊNH BẮT BUỘC DÀNH CHO COO (CHỐNG BỊA ĐẶT):
- Bạn đánh giá vóc dáng vật lý của sản phẩm qua hình ảnh và mô tả. Không được tự nghĩ ra vật liệu nếu không có cơ sở. Nếu có kim loại/thuỷ tinh -> rủi ro móp méo/bể vỡ. Nếu có pin -> rủi ro lưu kho/cháy nổ/khó thông quan.
- Chú ý đến sự "Cồng kềnh": Hàng nhẹ nhưng cồng kềnh sẽ bị tính cước quy đổi thể tích, làm sập toàn bộ lợi nhuận.

DỮ LIỆU CÁC SẢN PHẨM (Bản gốc):
{{PRODUCTS_DATA}}

Yêu cầu định dạng trả lời (Markdown, tiếng Việt, NGÔN NGỮ LOGISTICS VÀ VẬN HÀNH):

1. 📦 Bài Toán Logistics & Phí Vận Chuyển
So sánh tính cồng kềnh/nặng nề của các sản phẩm. Thể tích và cân nặng sẽ "ăn lẹm" bao nhiêu lợi nhuận vào phí ship quốc tế (Trung - Việt) và phí ship nội địa (Giao cho khách)?

2. 🛠️ Rủi Ro Phế Phẩm & Đứt Gãy Chuỗi Cung Ứng
Dựa vào bản chất và chất liệu cấu tạo, ước tính rủi ro lỗi hỏng (Defect rate) tại xưởng và rủi ro bể vỡ khi vận chuyển qua đường bộ gập ghềnh. Sản phẩm nào đòi hỏi bọc chống sốc đắt tiền?

3. 🔄 Áp Lực Nhân Sự & Xử Lý Hoàn/Bảo Hành
Nhân sự kho sẽ khóc thét vì sản phẩm nào? (Sản phẩm phức tạp phải test cắm điện từng cái, hoặc phải tư vấn hướng dẫn sử dụng dài dòng, rủi ro khách dùng sai hỏng rồi đòi hoàn tiền). 

4. 🚧 Khả Năng Vít Quy Mô (Scale-up)
Nếu đùng một cái nổ 1.000 đơn/ngày, sản phẩm nào sẽ khiến hệ thống đóng gói bị sập? Sản phẩm nào dễ bị xưởng TQ đứt hàng không kịp sản xuất? Chốt lại quyết định nhập khẩu của COO.

MỤC ĐÍCH SO SÁNH ĐẶC THÙ (Nếu có): {{COMPARE_PURPOSE}}
`.trim();

export const COMPARE_CEO_TEMPLATE = `
Bạn là CEO, kết hợp với vai trò Giám đốc Pháp chế (Compliance). Tầm nhìn của bạn không phải là bán vài ba đơn hàng lẻ tẻ để kiếm chênh lệch. Tầm nhìn của bạn là làm Thương Hiệu (Brand), Chuẩn Hóa Pháp Lý, và xây dựng Rào Cản Cạnh Tranh (Moat) bền vững dài hạn.

NGUYÊN TẮC CHIẾN LƯỢC (KHÔNG HALLUCINATE):
- Rà soát sự sao chép thiết kế. Nếu sản phẩm trông giống hệt Apple, Dyson, hay Lego... bạn PHẢI CẢNH BÁO RỦI RO SỞ HỮU TRÍ TUỆ (IP) CHÍ MẠNG.
- Phân tích rào cản thông quan dựa trên luật định thực tế (Sản phẩm sức khoẻ, mỹ phẩm, điện tử có sóng...) chứ không nói sáo rỗng.
- Không vẽ ra những ý tưởng thương hiệu viển vông nếu sản phẩm thực chất chỉ là đồ nhựa tạp nham rẻ tiền.

DỮ LIỆU CÁC SẢN PHẨM (Bản gốc):
{{PRODUCTS_DATA}}

Yêu cầu định dạng trả lời (Markdown, tiếng Việt, TẦM NHÌN DÀI HẠN VÀ KHẮT KHE):

1. 🛡️ Đào Rào Cản Cạnh Tranh (Moat)
Sản phẩm nào khó bị đối thủ copy nhất? (Nhờ công nghệ lõi ẩn bên trong, độ tinh xảo trong gia công, hoặc đòi hỏi kiến thức ngành sâu mới bán được). Sản phẩm nào ai cũng có thể nhập về bán phá giá?

2. 🏷️ Tiềm Năng Chuyển Đổi Thương Hiệu (White-label/OEM)
Sản phẩm nào dễ tùy biến bao bì, in Logo riêng, có tiềm năng làm thương hiệu (Branding) để bán giá gấp 2-3 lần (Premium) thay vì làm "con buôn" đếm hào lẻ?

3. ⚖️ "Tử Huyệt" Pháp Lý & Hải Quan
Rà soát nghiêm ngặt rủi ro: Vi phạm kiểu dáng công nghiệp, bản quyền của hãng lớn. Sản phẩm nào dễ bị quản lý thị trường kiểm tra, hoặc hải quan giữ lại yêu cầu giấy tờ hợp quy, công bố chất lượng nhất?

4. 👑 Phán Quyết Của Tướng Soái (CEO)
Sản phẩm nào xứng đáng để đặt tên thương hiệu của công ty lên đó và xây dựng "Sự nghiệp lâu dài"? Xếp hạng và loại bỏ thẳng tay các sản phẩm mang rủi ro pháp lý lớn.

MỤC ĐÍCH SO SÁNH ĐẶC THÙ (Nếu có): {{COMPARE_PURPOSE}}
`.trim();

export const COMPARE_CONTENT_TEMPLATE = `
Bạn là Giám đốc Marketing (CMO) chuyên trị nền tảng Mạng xã hội ngắn (TikTok Shop, Shopee Video, Reels). Tiêu chí cốt lõi của bạn không phải là tốt hay bền, mà là: SẢN PHẨM CÓ TÍNH GIẢI TRÍ KHÔNG? CÓ DỄ LAN TRUYỀN KHÔNG? KOC/KOL CÓ SẴN SÀNG NHẬN BOOKING ĐỂ QUAY VIDEO KHÔNG?

QUY TẮC PHÂN TÍCH NỘI DUNG:
- Chỉ nhìn vào hình ảnh và tính năng xem có yếu tố gây ấn tượng (độc lạ, bất ngờ, biến hình) hay không.
- Phân tích sát thực tế việc xây dựng kịch bản video. Không bịa đặt tính năng không có.
- Mọi nhận định phải hướng về "khả năng giữ chân người xem" và "tỷ lệ chuyển đổi qua video".

DỮ LIỆU CÁC SẢN PHẨM (Bản gốc):
{{PRODUCTS_DATA}}

Yêu cầu định dạng trả lời (Markdown, tiếng Việt, NGÔN NGỮ MARKETING/TRUYỀN THÔNG THỰC CHIẾN):

1. 🎥 Hiệu Ứng Thị Giác (Visual Appeal) & Độ Bắt Mắt Trên Video
Sản phẩm nào dễ làm video "Trước và Sau" (Before/After), video bóc seal đập hộp gây thoả mãn (ASMR), hoặc có tính năng đặc biệt khiến người xem phải dừng lại xem?

2. 🗣️ Sức Hấp Dẫn Với KOC/KOL
Các Creator (Reviewer) sẽ thích làm việc với sản phẩm nào hơn? Sản phẩm nào dễ xây dựng kịch bản hài kịch/đời sống/chữa lành, dễ lồng ghép tự nhiên để gắn link tiếp thị liên kết (Affiliate)?

3. 💸 Chi Phí Chuyển Đổi (CPA - Cost Per Action)
So sánh giữa sản phẩm "tự bán bằng content" (viral tự nhiên, CPA thấp) với sản phẩm "phải chi nhiều cho Ads tìm kiếm" mới ra đơn (CPA cao vì nội dung kém hấp dẫn).

4. 💥 Kết Luận Ưu Tiên Truyền Thông
Xếp hạng sản phẩm theo khả năng tạo Trend trên mạng xã hội. Sản phẩm nào có tiềm năng bán hàng tốt nhất qua video ngắn?

MỤC ĐÍCH SO SÁNH ĐẶC THÙ (Nếu có): {{COMPARE_PURPOSE}}
`.trim();

export const COMPARE_FUNNEL_TEMPLATE = `
Bạn là Chuyên gia Xây dựng Hệ sinh thái Sản phẩm (Product Mix & Sale Funnel). Nhiệm vụ của bạn là xem xét NHẬP TẤT CẢ các sản phẩm này, nhưng bạn phải phân bổ chúng vào các vai trò khác nhau một cách mưu mô và thông minh trong một Phễu Bán Hàng.

QUY TẮC XÂY PHỄU (KHÔNG ẢO GIÁC):
- Bạn phải căn cứ vào Khoảng giá, Công dụng và Sự liên kết giữa các sản phẩm để sắp xếp.
- Không gượng ép gán ghép nếu các sản phẩm hoàn toàn không liên quan đến nhau. Nếu chúng không thể bán chéo, hãy chỉ ra sự vô lý của danh mục này.

DỮ LIỆU CÁC SẢN PHẨM (Bản gốc):
{{PRODUCTS_DATA}}

Yêu cầu định dạng trả lời (Markdown, tiếng Việt, ĐẬM CHẤT CHIẾN LƯỢC BÁN LẺ):

1. 🧲 Sản Phẩm Mồi (Traffic Builder / Tripwire)
Trong số các sản phẩm, cái nào có mức giá rẻ nhất, nhu cầu phổ rộng nhất (ai cũng xài được) để dùng làm MỒI NHỬ? Sản phẩm này có thể bán hòa vốn, thậm chí lỗ nhẹ để kéo Traffic, cày lượt bán và lấy thông tin khách hàng.

2. 💰 Sản Phẩm Chủ Lực (Core Product)
Cái nào cân bằng tốt nhất giữa Biên lợi nhuận (Margin) và Doanh số (Volume) để làm "Con bò vắt sữa" (cỗ máy in tiền chính) của gian hàng? Tại sao nó xứng đáng gánh doanh thu?

3. 💎 Sản Phẩm Cao Cấp / Lợi Nhuận Cao (High-Ticket / Upsell)
Cái nào giá cao nhất, biên lãi dày nhất, phục vụ tệp khách có khả năng chi trả cao? Sản phẩm này dùng để tối đa hóa Giá trị trung bình đơn (AOV) khi khách đã tin tưởng shop.

4. 🔄 Kịch Bản Bán Chéo (Cross-sell / Bundle) Tối Ưu
Vẽ ra kịch bản khách đi vào từ sản phẩm Mồi, bạn sẽ tư vấn thế nào để họ mua kẹp thêm sản phẩm Chủ Lực hoặc Cao Cấp để tiết kiệm cước vận chuyển và tăng giá trị đơn hàng một cách hợp lý nhất.

MỤC ĐÍCH SO SÁNH ĐẶC THÙ (Nếu có): {{COMPARE_PURPOSE}}
`.trim();

export const COMPARE_BATTLE_TEMPLATE = `
Bạn là một Nhà đầu tư khó tính, thẳng thắn và không khoan nhượng khi thẩm định rủi ro. Đây là một vòng SÀNG LỌC LOẠI TRỪ NGHIÊM NGẶT: CHỈ MỘT sản phẩm được giữ lại để tiếp tục đầu tư, hoặc KHÔNG sản phẩm nào được chọn nếu tất cả đều không đạt yêu cầu.

QUY TẮC SÀNG LỌC (CHỐNG ẢO GIÁC TUYỆT ĐỐI):
- CẤM liệt kê ưu điểm. Bạn chỉ được phép chỉ ra ĐIỂM YẾU NGHIÊM TRỌNG NHẤT của từng sản phẩm dựa trên số liệu, mô tả và đánh giá.
- Nếu phát hiện dấu hiệu gian lận từ xưởng (giá ảo, ảnh ảo, review mua sẵn), PHẢI cảnh báo rõ ràng, dứt khoát cho người định nhập hàng.
- Mọi nhận định phải dựa trên phân tích dữ liệu thật, không được suy diễn ra điểm yếu không có căn cứ.

DỮ LIỆU CÁC SẢN PHẨM (Bản gốc):
{{PRODUCTS_DATA}}

Yêu cầu định dạng trả lời (Markdown, tiếng Việt, THẲNG THẮN, KHÔNG NHƯỢNG BỘ, NHIỀU CẢNH BÁO RÕ RÀNG):

1. 🔪 Phân Tích Điểm Yếu Nghiêm Trọng Nhất (Lần lượt từng sản phẩm)
Với mỗi sản phẩm, chỉ ra ĐÚNG 1 LÝ DO QUAN TRỌNG NHẤT khiến nó CÓ THỂ THẤT BẠI (Ví dụ: giá nhập không thực tế, công nghệ lỗi thời, thiết kế dễ vướng vi phạm bản quyền, chất liệu kém). Giải thích rõ rủi ro nếu vẫn quyết định nhập hàng.

2. 🗑️ Danh Sách Loại Bỏ
Nêu rõ các sản phẩm nên loại bỏ, kèm lý do cụ thể dựa trên dữ liệu cào được.

3. 🏆 Sản Phẩm Duy Nhất Đáng Cân Nhắc (Hoặc Không Nên Nhập)
Chỉ định ĐÚNG 1 sản phẩm ít rủi ro nhất và có tiềm năng thành công tốt nhất trong nhóm này.
*LƯU Ý ĐẶC BIỆT*: Nếu toàn bộ sản phẩm đều có rủi ro cao và khả năng thua lỗ rõ ràng, hãy khuyến nghị dứt khoát KHÔNG NHẬP sản phẩm nào trong đợt này và tìm nguồn hàng khác.

MỤC ĐÍCH SO SÁNH ĐẶC THÙ (Nếu có): {{COMPARE_PURPOSE}}
`.trim();

export const DEFAULT_COMPARE_PRESETS: PromptPreset[] = [
  { id: "comp_gen", name: "Tổng quát đa chiều", content: COMPARE_GENERAL_TEMPLATE },
  { id: "comp_same", name: "Tỷ lệ Win - Cùng ngành", content: COMPARE_SAME_CAT_TEMPLATE },
  { id: "comp_cross", name: "Tỷ lệ Win - Trái ngành", content: COMPARE_CROSS_CAT_TEMPLATE },
  { id: "comp_cfo", name: "Tối ưu Dòng vốn (CFO View)", content: COMPARE_CFO_TEMPLATE },
  { id: "comp_coo", name: "Rủi ro Chuỗi cung ứng (COO View)", content: COMPARE_COO_TEMPLATE },
  { id: "comp_ceo", name: "Rào cản & Pháp lý (CEO View)", content: COMPARE_CEO_TEMPLATE },
  { id: "comp_viral", name: "Viral & Truyền thông (CMO/KOC)", content: COMPARE_CONTENT_TEMPLATE },
  { id: "comp_funnel", name: "Chiến lược Phễu (Mồi và Chủ lực)", content: COMPARE_FUNNEL_TEMPLATE },
  { id: "comp_battle", name: "Sàng lọc loại trừ nghiêm ngặt", content: COMPARE_BATTLE_TEMPLATE },
];

export const COMPARE_SYNTHESIS_TEMPLATE = `
Bạn là Chủ Tịch Hội Đồng Cố Vấn Tối Cao, triệu tập lại TOÀN BỘ các chuyên gia (CFO, COO, CEO, CMO...) đã từng chấm điểm các sản phẩm dưới đây theo từng góc nhìn riêng lẻ. Nhiệm vụ của bạn KHÔNG PHẢI là phân tích lại từ đầu, mà là ĐỐI CHIẾU, PHẢN BIỆN và TỔNG HỢP các báo cáo đó thành 1 kết luận cuối cùng, cân bằng và đáng tin cậy nhất.

LUẬT CHỐNG ẢO GIÁC KHI ĐỌC BÁO CÁO CỦA CHUYÊN GIA KHÁC (QUAN TRỌNG NHẤT):
- Các "BÁO CÁO TRƯỚC" bên dưới do chính AI tạo ra ở các lượt chạy trước — CÓ THỂ chứa suy diễn sai hoặc phóng đại. TUYỆT ĐỐI không mặc nhiên tin theo, mà phải đối chiếu lại với "DỮ LIỆU CÁC SẢN PHẨM (Bản gốc)" bên dưới trước khi dùng bất kỳ nhận định nào.
- Nếu 2 báo cáo mâu thuẫn nhau (VD: CFO khen biên lợi nhuận tốt nhưng COO cảnh báo chi phí vận chuyển ăn hết lãi), PHẢI chỉ rõ mâu thuẫn đó và dùng dữ liệu gốc để phân xử bên nào đúng hơn, không lờ đi hoặc ba phải cho qua.
- Nếu một nhận định trong báo cáo trước không có cơ sở gì trong dữ liệu gốc, hãy loại bỏ nó khỏi kết luận cuối cùng và nói rõ lý do.

DỮ LIỆU CÁC SẢN PHẨM (Bản gốc — dùng để kiểm chứng lại mọi báo cáo bên dưới):
{{PRODUCTS_DATA}}

CÁC BÁO CÁO TRƯỚC TỪ HỘI ĐỒNG (mỗi báo cáo là 1 góc nhìn chuyên gia đã chạy riêng lẻ):
{{PRIOR_REPORTS}}

Yêu cầu định dạng trả lời (Markdown, tiếng Việt, GIỌNG VĂN CỦA NGƯỜI CHỦ TRÌ HỘI ĐỒNG — CÔNG TÂM NHƯNG DỨT KHOÁT):

1. 🤝 Điểm Đồng Thuận Giữa Các Góc Nhìn
Những kết luận nào được NHIỀU góc nhìn chuyên gia cùng đồng ý? Đây là tín hiệu đáng tin cậy nhất vì đã được kiểm chứng chéo.

2. ⚔️ Điểm Mâu Thuẫn & Phân Xử Bằng Dữ Liệu Gốc
Liệt kê từng mâu thuẫn giữa các báo cáo (nếu có), rồi dùng "DỮ LIỆU CÁC SẢN PHẨM (Bản gốc)" để phân xử bên nào có lý hơn. Nếu dữ liệu gốc không đủ để phân xử, hãy nói thẳng "chưa đủ căn cứ" thay vì đoán mò.

3. 🚩 Rủi Ro Bị Bỏ Sót
Có rủi ro nào (tài chính, vận hành, pháp lý, truyền thông...) mà TẤT CẢ góc nhìn trước đều bỏ qua nhưng lộ rõ trong dữ liệu gốc không?

4. 👑 Kết Luận Cuối Cùng Của Hội Đồng
- Xếp hạng lại các sản phẩm dựa trên TOÀN BỘ thông tin đã đối chiếu (không chỉ 1 góc nhìn).
- Đưa ra 1 khuyến nghị hành động rõ ràng, kèm mức độ tự tin (%) dựa trên độ đồng thuận giữa các báo cáo và độ đầy đủ của dữ liệu gốc.
`.trim();

export const DEFAULT_COMPARE_SYNTHESIS_PRESETS: PromptPreset[] = [
  { id: "synth_default", name: "Tổng hợp hội đồng mặc định", content: COMPARE_SYNTHESIS_TEMPLATE },
];

// Dựng lại text dữ liệu gốc (giá/mô tả/đánh giá Original) của N sản phẩm —
// dùng chung cho cả so sánh persona lẫn tổng hợp hội đồng, vì cả 2 đều
// PHẢI dựa trên dữ liệu cào gốc, không dựa văn bản AI đã tạo trước đó.
function buildProductsDataText(
  inputs: CompareProductInput[],
  markupRatios: CategoryMarkupRatio[] = DEFAULT_CATEGORY_MARKUP_RATIOS
): string {
  return inputs
    .map((input, idx) => {
      const pTitle = `### Sản phẩm ${idx + 1}: ${input.name} (#${input.id})`;
      const listingsText = input.listings
        .map((l, lIdx) => {
          const priceLine = l.priceRangeCny
            ? `Giá: ¥${l.priceRangeCny.min} ~ ¥${l.priceRangeCny.max}`
            : "";
          const reviewsText = l.reviewsOriginal.length
            ? `Đánh giá gốc:
${l.reviewsOriginal.slice(0, 5).map((r) => `- ${r}`).join("\n")}`
            : "";
          return [
            `--- Nguồn ${lIdx + 1} (${l.sourceType}, ${l.platform}) ---`,
            l.titleOriginal ? `Tên gốc: ${l.titleOriginal}` : "",
            priceLine,
            l.descriptionOriginal ? `Mô tả: ${l.descriptionOriginal}` : "",
            reviewsText,
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n\n");
      const hasFactoryPrice = input.listings.some((l) => l.sourceType === "MANUFACTURER");
      const priceBasisNote = buildPriceBasisNote(hasFactoryPrice, input.categoryNames, markupRatios);
      return [pTitle, listingsText, `Ghi chú cơ sở giá: ${priceBasisNote}`].join("\n");
    })
    .join("\n\n=========================================\n\n");
}

export async function generateProductComparison(
  inputs: CompareProductInput[],
  apiKey: string,
  promptTemplate: string,
  comparePurpose: string,
  markupRatios: CategoryMarkupRatio[] = DEFAULT_CATEGORY_MARKUP_RATIOS
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });

  const allImageUrls = inputs.flatMap((input) =>
    input.listings.flatMap((l) => l.imageUrls)
  ).slice(0, 15);

  const { parts: imageParts } = await fetchImagesAsParts(allImageUrls);

  const productsDataText = buildProductsDataText(inputs, markupRatios);

  let prompt = promptTemplate.replace("{{PRODUCTS_DATA}}", productsDataText);
  prompt = prompt.replace("{{COMPARE_PURPOSE}}", comparePurpose || "(Không có)");

  const contents = [{ role: "user", parts: [{ text: prompt }, ...imageParts] }];

  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        temperature: 0.2, // Low temp for more brutal and consistent logic
      },
    })
  );

  if (!response.text) throw new Error("Gemini không trả về nội dung.");

  return response.text;
}

// ------------------------------------------------------------
// HỘI ĐỒNG TỔNG HỢP — feed lại NHIỀU báo cáo persona đã chạy (CFO, COO,
// Sàng lọc loại trừ...) cho cùng bộ sản phẩm này, cùng với dữ liệu cào GỐC,
// để AI đối chiếu đồng thuận/mâu thuẫn giữa các báo cáo và chốt 1 khuyến
// nghị cuối. Luôn kèm dữ liệu gốc (không chỉ tin báo cáo AI cũ) để tránh
// thiên kiến cộng dồn — xem luật trong COMPARE_SYNTHESIS_TEMPLATE.
// ------------------------------------------------------------
export interface PriorComparisonReport {
  presetName: string;
  resultMarkdown: string;
}

export async function generateComparisonSynthesis(
  inputs: CompareProductInput[],
  apiKey: string,
  promptTemplate: string,
  priorReports: PriorComparisonReport[],
  markupRatios: CategoryMarkupRatio[] = DEFAULT_CATEGORY_MARKUP_RATIOS
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });

  const allImageUrls = inputs.flatMap((input) =>
    input.listings.flatMap((l) => l.imageUrls)
  ).slice(0, 15);

  const { parts: imageParts } = await fetchImagesAsParts(allImageUrls);

  const productsDataText = buildProductsDataText(inputs, markupRatios);

  const priorReportsText = priorReports
    .map((r, idx) => `### Báo cáo ${idx + 1} — Góc nhìn "${r.presetName}"\n${r.resultMarkdown}`)
    .join("\n\n=========================================\n\n");

  let prompt = promptTemplate.replace("{{PRODUCTS_DATA}}", productsDataText);
  prompt = prompt.replace("{{PRIOR_REPORTS}}", priorReportsText);

  const contents = [{ role: "user", parts: [{ text: prompt }, ...imageParts] }];

  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        temperature: 0.2,
      },
    })
  );

  if (!response.text) throw new Error("Gemini không trả về nội dung.");

  return response.text;
}

// ------------------------------------------------------------
// CHẤM ĐIỂM ĐA TRỤC (Việc 2) — chấm 15 trục/5 nhóm (xem SCORE_GROUPS
// trong src/lib/scoring.ts) cho TỪNG sản phẩm trong 1 phiên đánh giá,
// CHẤM CHUNG 1 REQUEST cho cả bộ sản phẩm (không tách riêng từng cái) để
// AI chấm TƯƠNG ĐỐI nhất quán giữa các sản phẩm đang so sánh — giống
// tinh thần generateProductComparison ở trên. Điểm nhóm/điểm tổng KHÔNG
// tính ở đây — tính ở tầng ứng dụng từ kết quả thô (xem computeGroupScores
// trong lib/scoring.ts) để đổi công thức sau này không cần gọi lại AI.
// ------------------------------------------------------------
export interface ProductAxisScoreResult {
  productId: number;
  axes: { axisId: string; score: number; reason: string }[];
}

function buildScoringResultSchema(axisIds: string[]) {
  return {
    type: Type.OBJECT,
    properties: {
      products: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            productId: { type: Type.NUMBER },
            axes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  axisId: { type: Type.STRING, enum: axisIds },
                  score: { type: Type.NUMBER },
                  reason: { type: Type.STRING },
                },
                required: ["axisId", "score", "reason"],
              },
            },
          },
          required: ["productId", "axes"],
        },
      },
    },
    required: ["products"],
  };
}

function buildScoringPrompt(scoreGroupsText: string): string {
  return `
Bạn là Hội đồng thẩm định đa chiều — nhiệm vụ DUY NHẤT của bạn là CHẤM ĐIỂM
từng sản phẩm dưới đây trên 15 trục độc lập, KHÔNG viết văn xuôi phân tích
dài dòng, KHÔNG lặp lại nội dung đã có ở các báo cáo persona khác.

QUY TẮC CHẤM ĐIỂM (BẮT BUỘC):
- Thang điểm 0-100 cho MỖI trục, MỌI trục đều đóng khung "điểm cao = tốt"
  (kể cả trục mang tên "an toàn/rủi ro" — điểm cao nghĩa là RỦI RO THẤP,
  điểm thấp nghĩa là RỦI RO CAO). Không đảo ngược logic này.
- Chấm TƯƠNG ĐỐI giữa các sản phẩm trong danh sách (nếu sản phẩm A rõ
  ràng tốt hơn B ở 1 trục, điểm A phải cao hơn B ở trục đó) — không chấm
  na ná nhau cho an toàn.
- MỖI trục PHẢI kèm 1 câu "reason" ngắn gọn (1 câu, tối đa ~25 từ) giải
  thích CĂN CỨ chấm điểm đó dựa trên dữ liệu thật bên dưới — KHÔNG bịa
  căn cứ không có trong dữ liệu, nếu thiếu dữ liệu để đánh giá 1 trục thì
  chấm điểm trung tính (~50) và nói rõ "thiếu dữ liệu để đánh giá chính
  xác" trong reason.
- Chấm ĐỦ cả 15 trục cho MỖI sản phẩm, không được bỏ sót trục nào.

DANH SÁCH TRỤC ĐIỂM (id — tên hiển thị, gộp theo nhóm):
${scoreGroupsText}

DỮ LIỆU CÁC SẢN PHẨM (Bản gốc):
{{PRODUCTS_DATA}}

Trả về JSON đúng field "products": mảng, mỗi phần tử gồm "productId" (đúng
số id sản phẩm ở trên) và "axes" (mảng 15 phần tử, mỗi phần tử gồm
"axisId" đúng id trong danh sách trục, "score" số 0-100, "reason" string).
`.trim();
}

export async function generateProductScores(
  inputs: CompareProductInput[],
  apiKey: string,
  scoreGroups: { id: string; label: string; icon: string; axes: { id: string; label: string }[] }[],
  markupRatios: CategoryMarkupRatio[] = DEFAULT_CATEGORY_MARKUP_RATIOS
): Promise<ProductAxisScoreResult[]> {
  const ai = new GoogleGenAI({ apiKey });

  const allImageUrls = inputs.flatMap((input) => input.listings.flatMap((l) => l.imageUrls)).slice(0, 15);
  const { parts: imageParts } = await fetchImagesAsParts(allImageUrls);

  const productsDataText = buildProductsDataText(inputs, markupRatios);
  const axisIds = scoreGroups.flatMap((g) => g.axes.map((a) => a.id));
  const scoreGroupsText = scoreGroups
    .map(
      (g) =>
        `${g.icon} Nhóm "${g.label}":\n${g.axes.map((a) => `  - ${a.id} — ${a.label}`).join("\n")}`
    )
    .join("\n");

  const prompt = buildScoringPrompt(scoreGroupsText).replace("{{PRODUCTS_DATA}}", productsDataText);
  const contents = [{ role: "user", parts: [{ text: prompt }, ...imageParts] }];

  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        temperature: 0.3,
        responseMimeType: "application/json",
        responseSchema: buildScoringResultSchema(axisIds),
      },
    })
  );

  const text = response.text;
  if (!text) throw new Error("Gemini không trả về nội dung.");

  const parsed = JSON.parse(text) as { products: ProductAxisScoreResult[] };
  if (!Array.isArray(parsed.products) || parsed.products.length === 0) {
    throw new Error("Gemini trả về thiếu dữ liệu điểm.");
  }
  return parsed.products;
}
