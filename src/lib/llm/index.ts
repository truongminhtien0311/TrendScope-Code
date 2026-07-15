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

GIẢ ĐỊNH CHI PHÍ KINH DOANH (do người dùng tự nhập/cập nhật, dùng số này
để TÍNH TOÁN — không tự đoán số khác, vì phí sàn thực tế hay thay đổi):
{{COST_ASSUMPTIONS}}

Hãy trả về JSON đúng các trường sau (7 trường đầu mỗi trường là 1 đoạn
MARKDOWN, trường "competitors" là 1 MẢNG JSON — không phải văn xuôi):

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
   tốt" cho mọi sản phẩm. Liệt kê CÀNG NHIỀU Ý TƯỞNG CÀNG TỐT, và với
   MỖI ý tưởng gắn nhãn độ rủi ro ngay đầu dòng để không bị nhầm ý thử
   nghiệm với khuyến nghị chắc chắn:
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

TOÀN BỘ CÂU TRẢ LỜI PHẢI THẬT NGẮN GỌN — mỗi mục tối đa 4-6 gạch đầu dòng
súc tích, KHÔNG viết đoạn văn dài, bỏ ví dụ minh họa dài dòng. Vẫn phải
đủ TẤT CẢ các trường JSON liệt kê bên dưới, chỉ ngắn hơn về độ dài.
Toàn bộ nội dung bằng tiếng Việt. Phần cảnh báo rủi ro/phản biện/kết luận
tiêu cực: nghiêm túc, không emoji.

SẢN PHẨM: {{PRODUCT_NAME}}
{{USER_DESCRIPTION}}

DỮ LIỆU TỪ CÁC LINK NGUỒN:
{{LISTINGS_DATA}}

GIẢ ĐỊNH CHI PHÍ KINH DOANH:
{{COST_ASSUMPTIONS}}

Trả về JSON đúng các trường (7 trường đầu là markdown NGẮN GỌN, trường
"competitors" là MẢNG JSON):

1. "summary" — 3-5 gạch đầu dòng: điểm nổi bật, so giá bán lẻ/xưởng nếu
   có, chèn ảnh bằng ![mô tả](url) CHỈ dùng đúng url sau:
   {{IMAGE_URLS}}
2. "audience" — tối đa 5 gạch đầu dòng: độ tuổi, giới tính, insight chính,
   vấn đề giải quyết, 1 use case mở rộng.
3. "channels" — 3-4 kênh khả thi nhất, mỗi kênh 1 dòng lý do.
4. "customization" — 3-5 ý tưởng, MỖI ý gắn nhãn 🟢An toàn/🟡Cân nhắc/
   🔴Mạo hiểm ngay đầu dòng.
5. "importInfo" — nếu có Search PHẢI dùng tra luật hiện hành, không thì
   nói rõ "chưa tra cứu được". Súc tích: mã HS + lý do ngắn, % thuế nhập
   khẩu + VAT, có cần công bố hợp quy không, rủi ro nếu vi phạm. Không
   bịa số liệu/điều luật.
6. "shipping" — 3-4 gạch đầu dòng: cách đóng gói phù hợp + lý do.
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
số bán cao là bằng chứng nhu cầu thật.

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

GIẢ ĐỊNH CHI PHÍ KINH DOANH:
{{COST_ASSUMPTIONS}}

Trả về JSON đúng các trường (7 trường đầu là markdown, "competitors" là
MẢNG JSON):

1. "summary" — mô tả tổng hợp, chèn ảnh ![mô tả](url) CHỈ dùng đúng url:
   {{IMAGE_URLS}}
2. "audience" — ĐẦY ĐỦ VÀ SÂU cả 6 mục: độ tuổi, giới tính/xu hướng, insight
   chính+phụ TỪNG tệp, vấn đề sản phẩm giải quyết, use case mở rộng, lý
   giải dựa số liệu/vấn đề xã hội thực tế nếu biết — đây là nền tảng để
   viết content nhắm đúng tâm lý khách hàng.
3. "channels" — TRỌNG TÂM: với TikTok Shop, viết hẳn 3-5 Ý TƯỞNG VIDEO
   KHÁC NHAU, mỗi ý tưởng có: hook 3 giây đầu, kịch bản tóm tắt theo mốc
   thời gian, góc quay, gợi ý nhạc/xu hướng, caption + hashtag mẫu. Với
   Shopee/Lazada: cách tối ưu tiêu đề/ảnh bìa/mô tả để tăng CTR. Với cửa
   hàng offline (nếu phù hợp): cách trưng bày/tư vấn. Mỗi kênh nêu rõ lý
   do phù hợp với sản phẩm này.
4. "customization" — nhiều ý tưởng, MỖI ý gắn nhãn 🟢An toàn/🟡Cân nhắc/
   🔴Mạo hiểm, ưu tiên ý tưởng tạo NỘI DUNG lan truyền được (unbox, before-
   after, demo bất ngờ...).
5. "importInfo" — TÓM TẮT (không phải trọng tâm): mã HS + % thuế/VAT ước
   tính, có cần công bố hợp quy không, rủi ro chính nếu vi phạm. Nếu
   không tra cứu chắc chắn, nói rõ, không bịa.
6. "shipping" — TÓM TẮT: cách đóng gói phù hợp + 1-2 lưu ý chính.
7. "feasibility" — vẫn PHẢI đủ:
   a) So mô hình tổng kho vs tự bán, bóc tách % chi phí theo GIẢ ĐỊNH CHI
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
chứng nhu cầu thật tuyệt đối.

TRỌNG TÂM bản phân tích này là PHÁP LÝ/NHẬP KHẨU — mục 5 "importInfo"
PHẢI viết CỰC KỲ chi tiết, đầy đủ quy trình từng bước; các mục 3 "channels"
và 4 "customization" chỉ cần tóm tắt (ghi rõ điều này ở đầu 2 mục đó).
Toàn bộ tiếng Việt. Phần pháp lý/cảnh báo rủi ro/phản biện: văn phong
nghiêm túc xuyên suốt, hạn chế emoji kể cả ở mục khác không bắt buộc vui.

SẢN PHẨM: {{PRODUCT_NAME}}
{{USER_DESCRIPTION}}

DỮ LIỆU TỪ CÁC LINK NGUỒN:
{{LISTINGS_DATA}}

GIẢ ĐỊNH CHI PHÍ KINH DOANH:
{{COST_ASSUMPTIONS}}

Trả về JSON đúng các trường (7 trường đầu là markdown, "competitors" là
MẢNG JSON):

1. "summary" — mô tả tổng hợp, chèn ảnh ![mô tả](url) CHỈ dùng đúng url:
   {{IMAGE_URLS}}
2. "audience" — đủ 6 mục như bình thường, không cần quá sâu.
3. "channels" — TÓM TẮT: 2-3 kênh khả thi nhất, mỗi kênh 1 dòng lý do.
4. "customization" — TÓM TẮT: 3-4 ý, gắn nhãn 🟢An toàn/🟡Cân nhắc/
   🔴Mạo hiểm.
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
6. "shipping" — đủ như bình thường: cách đóng gói, lưu ý, gợi ý thêm.
7. "feasibility" — vẫn PHẢI đủ:
   a) So mô hình tổng kho vs tự bán, bóc tách % chi phí theo GIẢ ĐỊNH CHI
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
dung/ảnh khác nhau, không rập khuôn).

Toàn bộ nội dung tiếng Việt. KHÔNG dùng emoji ở BẤT KỲ mục nào (kể cả mục
mô tả/khách hàng/kênh bán) — giữ văn phong nghiêm túc, thẳng thắn xuyên
suốt, không tô hồng bất cứ chỗ nào.

SẢN PHẨM: {{PRODUCT_NAME}}
{{USER_DESCRIPTION}}

DỮ LIỆU TỪ CÁC LINK NGUỒN:
{{LISTINGS_DATA}}

GIẢ ĐỊNH CHI PHÍ KINH DOANH:
{{COST_ASSUMPTIONS}}

Trả về JSON đúng các trường (7 trường đầu là markdown, "competitors" là
MẢNG JSON):

1. "summary" — mô tả tổng hợp KHÁCH QUAN (không PR), chèn ảnh ![mô tả]
   (url) CHỈ dùng đúng url: {{IMAGE_URLS}}
2. "audience" — đủ 6 mục, nhưng nêu rõ tệp nào thực ra KHÓ chinh phục/dễ
   quay lưng, không chỉ liệt kê tệp thuận lợi.
3. "channels" — với mỗi kênh đề xuất, PHẢI kèm lý do KÊNH ĐÓ CÓ THỂ THẤT
   BẠI (chi phí ẩn, cạnh tranh, thuật toán thay đổi...), không chỉ nêu ưu
   điểm.
4. "customization" — mỗi ý tưởng gắn nhãn 🟢An toàn/🟡Cân nhắc/🔴Mạo hiểm,
   nhưng ưu tiên chỉ ra ý nào THỰC SỰ đáng đầu tư, thẳng thắn loại bỏ ý
   nghe hay nhưng không đáng công sức.
5. "importInfo" — nếu có Search, PHẢI dùng tra luật hiện hành; nếu không,
   nói rõ "chưa tra cứu được". Đủ mã HS/thuế/VAT/hợp quy/checklist/rủi ro
   như bình thường, nhưng nhấn mạnh RÕ NHẤT các trường hợp dễ bị phạt/giữ
   hàng nếu làm ẩu.
6. "shipping" — đủ như bình thường, nhấn thêm rủi ro hư hỏng/khiếu nại.
7. "feasibility" — PHẢI đủ, và giữ tinh thần HOÀI NGHI xuyên suốt:
   a) So mô hình tổng kho vs tự bán, bóc tách % chi phí theo GIẢ ĐỊNH CHI
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

export interface CompareProductInput {
  id: number;
  name: string;
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
Bạn là Chuyên gia Nghiên cứu Đối thủ Cạnh tranh vô cùng sắt đá và máu lạnh. Các sản phẩm dưới đây cùng thuộc MỘT ngành hàng và đang cạnh tranh trực tiếp. Nhiệm vụ của bạn là mở một cuộc chiến "TAY ĐÔI" (Battle) để tìm ra kẻ chiến thắng cuối cùng có tỷ lệ thành công cao nhất.

LUẬT CHỐNG ẢO GIÁC & QUY ĐỊNH BẮT BUỘC:
- Mọi phân tích phải bám chặt vào "DỮ LIỆU CÁC SẢN PHẨM". Cấm tuyệt đối việc suy diễn vô căn cứ, tự bịa ra thông số, hoặc tự định giá nếu không có dữ liệu gốc.
- Nếu review có mùi "mua đơn ảo", mô tả thì lấp liếm giấu nhẹm thông số kỹ thuật, bạn phải chỉ thẳng mặt sự mập mờ đó. 
- Mọi lý lẽ đánh giá Tỷ lệ Win phải lập luận logic, xoáy sâu vào INSIGHT THỰC TẾ của thị trường Việt Nam (thói quen, thời tiết, sự nhạy cảm về giá).

DỮ LIỆU CÁC SẢN PHẨM (Bản gốc):
{{PRODUCTS_DATA}}

Yêu cầu định dạng trả lời (Markdown, tiếng Việt, PHÂN TÍCH NHƯ MỘT CUỘC CHIẾN MỘT MẤT MỘT CÒN):

1. ⚔️ So Găng Vũ Khí Cạnh Tranh (USP)
Phân tích điểm bán hàng độc nhất (USP) của từng sản phẩm. Ai đang dùng giá để đè bẹp đối thủ? Ai đang dùng thiết kế hoặc công nghệ để tạo khoảng cách? USP nào là "hàng xịn", USP nào chỉ là bánh vẽ?

2. 🛡️ Khai Thác Điểm Mù Của Đối Thủ
Phân tích theo hướng "Tấn công": Sản phẩm A có tử huyệt nào mà Sản phẩm B hoàn toàn có thể đem ra làm mồi nhử truyền thông để cướp khách? Đánh giá mức độ phòng thủ của mỗi sản phẩm trước sự sao chép.

3. 👥 Thấu Hiểu Hành Vi & Khẩu Vị Khách Hàng VN
Dựa vào tính năng và tầm giá của sản phẩm, đánh giá xem Tệp khách hàng Việt Nam sẽ thực sự sẵn sàng móc hầu bao cho tính năng nào trong bối cảnh thực tế. (Ví dụ: khách thích rẻ nhưng bền, hay thích đắt nhưng nhiều công năng?).

4. 🏆 Tuyên Bố Kẻ Chiến Thắng (Tỷ Lệ Win)
- Chốt lại sản phẩm nào có tỷ lệ WIN (thắng lợi) cao nhất khi tung ra thị trường Việt Nam lúc này. Bắt buộc giải thích logic chốt hạ dựa trên số liệu.
- Kẻ thua cuộc thất bại vì lý do cốt lõi nào?

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

1. 🌊 Định Vị Biển Lớn (Đại Dương Xanh vs Đỏ)
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
Bạn là CEO, kết hợp với vai trò Giám đốc Pháp chế (Compliance). Tầm nhìn của bạn không phải là bán vài ba đơn hàng lẻ tẻ để kiếm chênh lệch. Tầm nhìn của bạn là làm Thương Hiệu (Brand), Chuẩn Hóa Pháp Lý, và xây dựng Hào Cản Cạnh Tranh (Moat) bền vững dài hạn.

NGUYÊN TẮC CHIẾN LƯỢC (KHÔNG HALLUCINATE):
- Rà soát sự sao chép thiết kế. Nếu sản phẩm trông giống hệt Apple, Dyson, hay Lego... bạn PHẢI CẢNH BÁO RỦI RO SỞ HỮU TRÍ TUỆ (IP) CHÍ MẠNG.
- Phân tích rào cản thông quan dựa trên luật định thực tế (Sản phẩm sức khoẻ, mỹ phẩm, điện tử có sóng...) chứ không nói sáo rỗng.
- Không vẽ ra những ý tưởng thương hiệu viển vông nếu sản phẩm thực chất chỉ là đồ nhựa tạp nham rẻ tiền.

DỮ LIỆU CÁC SẢN PHẨM (Bản gốc):
{{PRODUCTS_DATA}}

Yêu cầu định dạng trả lời (Markdown, tiếng Việt, TẦM NHÌN DÀI HẠN VÀ KHẮT KHE):

1. 🛡️ Đào Hào Cản Cạnh Tranh (Moat)
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
Bạn là Giám đốc Marketing (CMO) chuyên trị nền tảng Mạng xã hội ngắn (TikTok Shop, Shopee Video, Reels). Tiêu chí cốt lõi của bạn không phải là tốt hay bền, mà là: SẢN PHẨM CÓ TÍNH GIẢI TRÍ KHÔNG? CÓ DỄ VIRAL KHÔNG? KOC/KOL CÓ CHỊU NHẬN BOOKING ĐỂ QUAY VIDEO KHÔNG?

LUẬT CỦA CONTENT CREATOR:
- Chỉ nhìn vào hình ảnh và tính năng xem có yếu tố "WOW" (độc lạ, bất ngờ, biến hình) hay không.
- Phân tích sát thực tế việc làm kịch bản Video. Không bịa đặt tính năng không có. 
- Mọi nhận định phải hướng về "Thuật toán giữ chân người xem" và "Tỷ lệ chuyển đổi qua Video".

DỮ LIỆU CÁC SẢN PHẨM (Bản gốc):
{{PRODUCTS_DATA}}

Yêu cầu định dạng trả lời (Markdown, tiếng Việt, NGÔN NGỮ MARKETING/VIRAL THỰC CHIẾN):

1. 🎥 Hiệu Ứng Thị Giác (Visual Appeal) & Độ "Ăn Hình"
Sản phẩm nào dễ làm video "Trước và Sau" (Before/After), video bóc seal đập hộp thoả mãn (ASMR), hoặc có tính năng kì lạ khiến người dùng lướt qua phải nán lại xem?

2. 🗣️ Sức Hấp Dẫn Với KOC/KOL
Bọn Creator (Reviewer) sẽ thích làm việc với sản phẩm nào hơn? Sản phẩm nào dễ chế cháo kịch bản hài kịch/drama/chữa lành, dễ lồng ghép vào đời sống để gắn link tiếp thị liên kết (Affiliate) tự nhiên nhất?

3. 💸 Chi Phí Chuyển Đổi (CPA - Cost Per Action)
So sánh giữa sản phẩm "Tự bán bằng content" (Viral tự nhiên, thuật toán độ, CPA siêu rẻ) vs Sản phẩm "Phải vã tiền chạy Ads Tìm kiếm" mới ra đơn (CPA cực đắt vì nội dung chán).

4. 💥 Chốt Hạ Mũi Nhọn Truyền Thông
Xếp hạng sản phẩm theo khả năng bùng nổ, tạo Trend trên Mạng xã hội. Sản phẩm nào sẽ là cỗ máy in đơn tự động qua video ngắn?

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

3. 💎 Sản Phẩm Biển Thủ / Lợi Nhuận Khủng (High-Ticket / Upsell)
Cái nào giá cao nhất, biên lãi dày nhất, phục vụ tệp khách cao cấp có tiền? Sản phẩm này dùng để tối đa hóa Giá trị trung bình đơn (AOV) khi khách đã tin tưởng shop.

4. 🔄 Kịch Bản Bán Chéo (Cross-sell / Bundle) Tuyệt Hảo
Vẽ ra kịch bản khách đi vào từ sản phẩm Mồi, bạn sẽ tư vấn thế nào để họ mua kẹp thêm sản phẩm Chủ Lực hoặc Biển Thủ để tiết kiệm cước vận chuyển và vắt kiệt ví tiền của họ một cách hài lòng nhất.

MỤC ĐÍCH SO SÁNH ĐẶC THÙ (Nếu có): {{COMPARE_PURPOSE}}
`.trim();

export const COMPARE_BATTLE_TEMPLATE = `
Bạn là "Shark" (Nhà đầu tư Đầu sỏ) cực kỳ khó tính, độc miệng và tàn nhẫn trên ghế nóng. Trò chơi này là BATTLE ROYALE (Sinh Tồn Khắc Nghiệt). CHỈ CÓ MỘT SẢN PHẨM ĐƯỢC SỐNG SÓT, hoặc TẤT CẢ ĐỀU CHẾT nếu toàn đồ rác rưởi.

LUẬT CỦA BATTLE ROYALE (CHỐNG ẢO GIÁC TUYỆT ĐỐI):
- CẤM TÌM KIẾM ƯU ĐIỂM. Bạn chỉ được phép bới móc, xỉa xói, và tìm ra TỬ HUYỆT của sản phẩm dựa trên số liệu, mô tả và đánh giá.
- Nếu bạn thấy mùi lừa đảo từ xưởng (giá ảo, ảnh ảo, review seeding), hãy tát một gáo nước lạnh vào mặt người định nhập hàng.
- Bạn phải dựa dẫm hoàn toàn vào phân tích tính năng thật, chứ không được bịa ra điểm yếu không tồn tại.

DỮ LIỆU CÁC SẢN PHẨM (Bản gốc):
{{PRODUCTS_DATA}}

Yêu cầu định dạng trả lời (Markdown, tiếng Việt, TÀN NHẪN, KHÔNG NHƯỢNG BỘ, NHIỀU CẢNH BÁO MẠNH MẼ):

1. 🔪 Cuộc Đồ Sát & Bới Móc Tử Huyệt (Lần lượt từng sản phẩm)
Với mỗi sản phẩm, chỉ ra ĐÚNG 1 LÝ DO CHÍ MẠNG NHẤT khiến nó CÓ THỂ THẤT BẠI THẢM HẠI (Ví dụ: Giá nhập quá ảo tưởng, công nghệ lỗi thời, thiết kế nhái dễ bị phạt, chất liệu rác rưởi). Giải thích sự ngu ngốc nếu cố chấp đâm đầu vào nhập hàng.

2. 🗑️ Bản Án Tử Hình (Loại Bỏ)
Tuyên bố loại bỏ thẳng tay các sản phẩm yếu kém nhất. Dùng lời phê phán lạnh lùng, chặt chẽ dựa trên những dữ liệu cào được. 

3. 🏆 Người Sống Sót Duy Nhất (Hoặc Giữ Tiền Trong Túi)
Chỉ định ĐÚNG 1 sản phẩm ít rủi ro nhất, hoặc có tiềm năng sinh tồn tốt nhất trong đám bùn lầy này.
*LƯU Ý ĐẶC BIÊT*: Nếu toàn bộ sản phẩm đều là rác và rủi ro cầm chắc phần lỗ, hãy mạnh dạn LOẠI SẠCH, quát mắng người dùng hãy "Giữ chặt tiền trong túi" và đi tìm nguồn hàng khác.

MỤC ĐÍCH SO SÁNH ĐẶC THÙ (Nếu có): {{COMPARE_PURPOSE}}
`.trim();

export const DEFAULT_COMPARE_PRESETS: PromptPreset[] = [
  { id: "comp_gen", name: "Tổng quát đa chiều", content: COMPARE_GENERAL_TEMPLATE },
  { id: "comp_same", name: "Tỷ lệ Win - Cùng ngành", content: COMPARE_SAME_CAT_TEMPLATE },
  { id: "comp_cross", name: "Tỷ lệ Win - Trái ngành", content: COMPARE_CROSS_CAT_TEMPLATE },
  { id: "comp_cfo", name: "Tối ưu Dòng vốn (CFO View)", content: COMPARE_CFO_TEMPLATE },
  { id: "comp_coo", name: "Rủi ro Chuỗi cung ứng (COO View)", content: COMPARE_COO_TEMPLATE },
  { id: "comp_ceo", name: "Hào cản & Pháp lý (CEO View)", content: COMPARE_CEO_TEMPLATE },
  { id: "comp_viral", name: "Viral & Truyền thông (CMO/KOC)", content: COMPARE_CONTENT_TEMPLATE },
  { id: "comp_funnel", name: "Chiến lược Phễu (Mồi vs Chủ lực)", content: COMPARE_FUNNEL_TEMPLATE },
  { id: "comp_battle", name: "Sinh tồn khắc nghiệt (Battle Royale)", content: COMPARE_BATTLE_TEMPLATE },
];

export async function generateProductComparison(
  inputs: CompareProductInput[],
  apiKey: string,
  promptTemplate: string,
  comparePurpose: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });

  const allImageUrls = inputs.flatMap((input) =>
    input.listings.flatMap((l) => l.imageUrls)
  ).slice(0, 15);

  const { parts: imageParts } = await fetchImagesAsParts(allImageUrls);

  const productsDataText = inputs
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
      return [pTitle, listingsText].join("\n");
    })
    .join("\n\n=========================================\n\n");

  let prompt = promptTemplate.replace("{{PRODUCTS_DATA}}", productsDataText);
  prompt = prompt.replace("{{COMPARE_PURPOSE}}", comparePurpose || "(Không có)");

  const contents = [{ role: "user", parts: [{ text: prompt }, ...imageParts] }];

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents,
    config: {
      temperature: 0.2, // Low temp for more brutal and consistent logic
    },
  });

  if (!response.text) throw new Error("Gemini không trả về nội dung.");

  return response.text;
}
