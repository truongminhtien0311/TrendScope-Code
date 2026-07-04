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

// Dữ liệu gộp từ TOÀN BỘ các link của 1 sản phẩm
export interface AnalysisInput {
  productName: string;
  userDescription?: string; // mô tả người dùng tự viết (nếu có)
  listings: {
    id: number;
    sourceType: string; // RETAIL | MANUFACTURER
    platform: string;
    titleOriginal?: string; // tên gốc tiếng Trung — dùng để DỊCH (việc 2)
    titleVi?: string;
    descriptionOriginal?: string; // mô tả gốc tiếng Trung — dùng để DỊCH (việc 2)
    descriptionText?: string;
    imageUrls: string[]; // ảnh đại diện + ảnh mô tả để AI "nhìn"
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
  // (H) Bản dịch thuần túy — VIỆC RIÊNG, KHÔNG liên quan tới 7 mục phân
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

// Prompt mặc định — người dùng sửa được trong Cài đặt, bấm "Khôi phục
// mặc định" sẽ lấy đúng nguyên văn chuỗi này.
export const DEFAULT_PROMPT_TEMPLATE = `
Bạn là chuyên gia tư vấn nhập hàng Trung Quốc về Việt Nam để kinh doanh.
Toàn bộ nội dung trả lời PHẢI bằng tiếng Việt. TẤT CẢ các mục PHẢI chèn
thật nhiều emoji và định dạng nổi bật (tiêu đề, in đậm, gạch đầu dòng)
để người đọc dễ tiếp thu, dễ quét mắt tìm thông tin.

SẢN PHẨM: {{PRODUCT_NAME}}
{{USER_DESCRIPTION}}

DỮ LIỆU TỪ CÁC LINK NGUỒN (đã gộp từ tất cả link bán lẻ + nhà sản xuất):
{{LISTINGS_DATA}}

GIẢ ĐỊNH CHI PHÍ KINH DOANH (do người dùng tự nhập/cập nhật, dùng số này
để TÍNH TOÁN — không tự đoán số khác, vì phí sàn thực tế hay thay đổi):
{{COST_ASSUMPTIONS}}

Hãy trả về JSON đúng 7 trường sau, mỗi trường là 1 đoạn MARKDOWN:

1. "summary" — Mô tả sản phẩm tổng hợp:
   - Tổng hợp điểm nổi bật từ mô tả người bán + đánh giá người mua
   - So sánh giá bán lẻ và giá nhà sản xuất nếu có cả 2
   - Chèn ảnh gốc vào đúng chỗ hợp lý bằng cú pháp markdown ![mô tả](url),
     CHỈ dùng đúng các url ảnh sau, không tự bịa url khác:
     {{IMAGE_URLS}}

2. "audience" — Tệp khách hàng mục tiêu, gồm đủ 6 mục:
   1. Độ tuổi: chia nhóm, xếp hạng từ phù hợp nhất đến ít phù hợp nhất
   2. Giới tính / xu hướng: xếp theo thứ tự phù hợp
   3. Insight chính và phụ của từng tệp khách hàng
   4. Vấn đề mà sản phẩm giải quyết được
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
   Với mỗi kênh: nêu RÕ LÝ DO vì sao phù hợp với sản phẩm này.

4. "customization" — Gợi ý tùy chỉnh SẢN PHẨM NÀY để tăng trải nghiệm
   khách hàng. BẮT BUỘC gợi ý CỤ THỂ dựa trên đặc điểm/chức năng/hình
   dáng thật của sản phẩm này (nhìn từ ảnh + mô tả), TUYỆT ĐỐI KHÔNG
   viết lời khuyên chung chung kiểu "đóng gói đẹp, chăm sóc khách hàng
   tốt" cho mọi sản phẩm. Liệt kê CÀNG NHIỀU Ý TƯỞNG CÀNG TỐT, trải dài
   từ:
   - Mức đơn giản/rẻ tiền (dễ làm ngay)
   - Mức trung bình (cần đầu tư thêm chút)
   - Mức "wow" tạo khác biệt với đối thủ (kể cả ý tưởng táo bạo, nghe
     có vẻ hơi phi lý hoặc tốn công, nhưng biết đâu người dùng thấy khả
     thi và muốn thử — cứ mạnh dạn đề xuất, đây là để THAM KHẢO)

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
     ẩm, sợ va đập, cồng kềnh...)
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

   b) So sánh với sản phẩm CÙNG CHỨC NĂNG đang thực sự bán trên thị
      trường Việt Nam (nếu có công cụ tìm kiếm, dùng để tra cứu sản
      phẩm cạnh tranh thật, không bịa). Nêu vài sản phẩm/mức giá tương
      tự đang có ở phân khúc NGANG BẰNG và phân khúc THẤP HƠN. Đánh giá
      khả thi KHÔNG chỉ dựa vào so sánh giá đơn thuần — dù giá sản phẩm
      này cao hơn đối thủ giá rẻ, VẪN có thể khả thi nếu tạo được khác
      biệt phù hợp với TỪNG TỆP KHÁCH HÀNG cụ thể (thiết kế đáng yêu/
      thẩm mỹ, tiện ích/tính năng đi kèm, độ bền, thương hiệu cảm xúc...).
      Ví dụ tư duy: bô vệ sinh nhựa cho bé giá cao hơn hàng thường vẫn
      bán chạy nếu mẹ thích kiểu dáng dễ thương + có thêm tiện ích (đèn
      nhạc, dễ vệ sinh...). Chỉ rõ: sản phẩm này có yếu tố khác biệt nào
      giúp cạnh tranh được không, nhắm đúng tệp nào thì khả thi hơn.

   c) Cơ hội & thách thức — PHẢI bao gồm cả yếu tố vận chuyển quốc tế,
      thông quan, kho bãi, kiểm hóa, đăng kiểm (tham khảo lại mục 5 đã
      phân tích), không chỉ nói về sản phẩm/thị trường chung chung.

   d) Bảng chiến lược giá tăng dần — liệt kê nhiều mức giá bán, từ mức
      HÒA VỐN tăng dần tới mức LÃI ~500% trên giá vốn, với MỖI mức giá
      mô tả: tệp khách hàng nào sẽ phản ứng ra sao, tỷ lệ chuyển đổi
      (conversion rate) dự kiến tăng/giảm thế nào so với mức trước đó.

   e) Kết luận rõ ràng: khả thi / khả thi có điều kiện / không khả thi,
      kèm gợi ý hướng đi tiếp theo nếu người dùng quyết định kinh doanh.
`.trim();

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
      "translations",
    ],
  };
}

export async function generateProductAnalysis(
  input: AnalysisInput,
  apiKey: string,
  promptTemplate: string = DEFAULT_PROMPT_TEMPLATE,
  costAssumptions: CostAssumptions = DEFAULT_COST_ASSUMPTIONS,
  availableCategories: string[] = []
): Promise<AiAnalysisResult> {
  const ai = new GoogleGenAI({ apiKey });

  const allImageUrls = input.listings.flatMap((l) => l.imageUrls).slice(0, MAX_IMAGE_COUNT);
  const { parts: imageParts, includedUrls } = await fetchImagesAsParts(allImageUrls);

  const analysisPrompt = fillTemplate(promptTemplate, input, includedUrls, costAssumptions);
  const prompt = `${analysisPrompt}\n\n${buildTranslationTask(input)}\n\n${buildCategoryTask(availableCategories)}`;
  const contents = [{ role: "user", parts: [{ text: prompt }, ...imageParts] }];
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
    response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: { ...baseConfig, tools: [{ googleSearch: {} }] },
    });
  } catch (err) {
    console.error("Gemini + Search Grounding lỗi, thử lại không có Search Grounding:", err);
    response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: baseConfig,
    });
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

  // Đính kèm nguồn tham khảo thật (nếu Search Grounding có dùng) vào
  // cuối mục nhập khẩu — để người dùng tự kiểm chứng lại thông tin luật.
  const sources = extractGroundingSources(response);
  if (sources.length > 0) {
    parsed.importInfo += `\n\n---\n🔗 **Nguồn tham khảo đã tra cứu:**\n${sources
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
  costAssumptions: CostAssumptions
): string {
  const listingsText = input.listings
    .map((l, i) => {
      const priceLine = l.priceRangeCny
        ? `Giá: ¥${l.priceRangeCny.min} ~ ¥${l.priceRangeCny.max}`
        : "";
      const reviewsText = l.reviews.length
        ? `Đánh giá người mua:\n${l.reviews.slice(0, 10).map((r) => `- ${r}`).join("\n")}`
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

  return template
    .replaceAll("{{PRODUCT_NAME}}", input.productName)
    .replaceAll(
      "{{USER_DESCRIPTION}}",
      input.userDescription ? `Mô tả người dùng tự viết: ${input.userDescription}` : ""
    )
    .replaceAll("{{LISTINGS_DATA}}", listingsText)
    .replaceAll("{{IMAGE_URLS}}", imageUrls.join(", ") || "(không có ảnh)")
    .replaceAll("{{COST_ASSUMPTIONS}}", formatCostAssumptions(costAssumptions));
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
