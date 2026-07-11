# 04 — Lộ trình phát triển

Khung hiện tại đã chạy được với dữ liệu giả. Các giai đoạn tiếp theo, xếp theo thứ tự nên làm:

## Giai đoạn 1 — Hoàn thiện quản lý thủ công
*Không tốn tiền API, dùng được ngay cho công việc thật.*

- [x] Sửa/xóa sản phẩm ngay trên giao diện (đổi tên, mô tả, gắn tag/ngành hàng) — nút ✏️/🗑️ trên trang chi tiết (`EditProductForm.tsx`)
- [x] Sửa tay tên/giá từng phân loại ngay trên bảng giá — nút ✏️ mỗi dòng (`VariantTable.tsx`), giá sửa tay đánh dấu ✍️
- [x] Trang quản lý Tag & Ngành hàng — `/manage` trên sidebar (`TagManager.tsx`, `CategoryManager.tsx`)
- [x] Xóa listing, bấm "cào lại" để cập nhật giá — `ListingActions.tsx` + `POST /api/listings/[id]/rescrape`; phân loại có `priceEdited = true` được GIỮ NGUYÊN giá, không ghi đè
- [x] Ô tìm kiếm sản phẩm theo tên trên Dashboard — `FilterBar.tsx` (param `?q=`)
- [x] **Nhập tay / sửa tay TOÀN BỘ trường của Listing** — dùng khi API cào lỗi/hết quota, hoặc nhập tay còn nhanh hơn tự cào bằng mắt:
  - `AddListingForm.tsx` — 2 chế độ: 🔗 Dán link (tự động cào, như cũ) / ✍️ Nhập tay (chọn sàn, gõ tên/người bán/mô tả/phân loại, KHÔNG gọi scraper). API: `POST /api/listings`, `lastScrapedAt` để trống đánh dấu chưa từng cào.
  - `EditListingForm.tsx` — nút ✏️ sửa tên/người bán/mô tả/lượt bán/URL sau khi đã tạo (`PATCH /api/listings/[id]`).
  - `VariantTable.tsx` mở rộng: thêm dòng mới (`POST /api/listings/[id]/variants`) + xóa dòng (`DELETE /api/variants/[id]`), không chỉ sửa như trước.
  - `ReviewManager.tsx` (mới) — sửa/thêm/xóa từng đánh giá tay (`POST/PATCH/DELETE .../reviews`).
  - `ImageManager.tsx` (mới) — **ảnh đại diện & ảnh mô tả** đều thêm được bằng 2 cách: nút "📤 Tải ảnh lên" (chọn file máy) HOẶC bấm vào vùng ảnh rồi `Ctrl+V` dán từ clipboard. Ảnh lưu thật vào `public/uploads/` qua `POST /api/uploads` (giới hạn 10MB, chỉ nhận JPEG/PNG/WEBP/GIF), xóa ảnh thì xóa cả file thật trên đĩa (`DELETE /api/images/[id]`).
  - Đã test thật toàn bộ (không chỉ build): tạo listing tay, sửa, thêm/xóa phân loại + đánh giá, upload ảnh thật (xác nhận file ghi ra đĩa và xóa đúng khi remove).
- [x] **Thông báo hoàn thành** — `sonner` (toast đẹp) + tiếng "ding" nhẹ tự tạo bằng Web Audio API (`src/lib/notify.ts`, không cần file âm thanh). Gắn vào: cào link mới xong, cào lại xong, tạo phân tích AI xong.
- [x] **Cải thiện nhập tay sau khi user test thật** (3 vấn đề):
  1. Người dùng chỉ copy được ảnh + text tiếng Trung, không hiểu nghĩa → thêm nút **"🔤 Dịch"** (`TranslateButton.tsx`, `POST /api/translate`, dùng luôn Gemini đã cấu hình) cạnh mọi ô "gốc": tên sản phẩm, mô tả, tên phân loại — cả lúc tạo mới lẫn sửa sau. `src/lib/translate/index.ts` không còn là stub nữa, đã cài thật.
  2. Ô "Tên phân loại" quá hẹp + giá không đổi được đơn vị → bố cục lại thành 2 hàng (Tên gốc+dịch+Tên Việt ở trên, Giá+chọn đơn vị ¥/$/đ ở dưới), áp dụng ở cả `AddListingForm.tsx` (tạo mới) và `VariantTable.tsx` (thêm/sửa dòng có sẵn). Thêm tỷ giá **USD→CNY** (`Setting` key `usd_cny_rate`, mặc định 7.2, sửa ở Cài đặt cạnh tỷ giá CNY→VNĐ) — `src/lib/currency.ts` có `toPriceCny()` tự quy đổi bất kỳ đơn vị nào về CNY khi lưu.
  3. Nhập tay không tùy chỉnh được Sàn/Nhóm nguồn → `sourceType` (Shop bán lẻ/Nhà sản xuất) giờ là **lựa chọn tường minh** (không suy ra từ platform), ô "Sàn" đổi từ dropdown cố định 5 sàn thành **ô gõ tự do có gợi ý** (datalist) — nhập được bất kỳ nguồn nào (Pinduoduo, chợ offline...). 2 nút chuyển chế độ "Dán link"/"Nhập tay" đổi thành thẻ lớn có mô tả ngắn, dễ phân biệt hơn.
  - Đã test thật qua API: dịch "红色"→"Màu đỏ" đúng; tạo listing `sourceType=MANUFACTURER, platform="Pinduoduo"` (ngoài 5 sàn cố định) lưu đúng; giá nhập 5 USD → lưu `priceCny = 36` (5×7.2) đúng công thức; sửa giá sang 100.000đ → `priceCny` tính lại đúng theo tỷ giá hiện tại.

## Giai đoạn 2 — Cào dữ liệu THẬT
*Bắt đầu tốn phí API — chọn nhà cung cấp trước.*

- [x] Đăng ký **Otapi (Taobao Tmall API trên RapidAPI)** — gói Basic miễn phí: 10 "advanced request"/ngày, 20 request thường/ngày. Chỉ phủ Taobao/Tmall, **chưa có JD**.
- [x] Provider thật: `src/lib/scrapers/providers/otapi-taobao-tmall.ts` — gọi `BatchGetItemFullInfo` (chi tiết + phân loại + giá + ảnh) và `SearchItemReviews` (đánh giá). Dùng tham số `language=vi` của chính API để dịch tên sản phẩm/phân loại sang tiếng Việt — **không cần bước dịch riêng cho provider này**.
- [x] Ô nhập API key trong Cài đặt — nút "Cấu hình" bên cạnh mỗi provider không phải Mock (`ProviderRow.tsx`, lưu vào bảng ApiProvider qua `PATCH /api/providers/[id]`)
- [x] `getScraperFor()` giờ đọc database để chỉ dùng provider đang bật + tự truyền `apiKey` (`src/lib/scrapers/index.ts`)
- ⚠️ **Chưa kiểm chứng được** cấu trúc JSON thật của đánh giá người mua (`SearchItemReviews`) — sản phẩm test không có review nào. Cần cào thử 1 sản phẩm có nhiều đánh giá, xem review có hiện đúng không; nếu sai thì sửa hàm `fetchReviews()` trong file provider.
- [ ] Provider cho **JD** (bán lẻ) — chưa có, cần tìm thêm API khác. Viết theo khung mẫu `src/lib/scrapers/providers/tmapi.example.ts`.
- [ ] **1688** (nhà sản xuất) — quyết định bỏ qua theo yêu cầu người dùng, chỉ tập trung Alibaba.com quốc tế.
- [🚧] **Otapi - Alibaba.com** — đã đăng ký qua RapidAPI (kênh RapidAPI, KHÔNG dùng kênh otcommerce.com trực tiếp vì giá tối thiểu $150-600/tháng không phù hợp). Khung provider đã viết sẵn tại `src/lib/scrapers/providers/otapi-alibaba.ts` (đã test thật: trích id từ URL Alibaba.com hoạt động đúng; đã xác nhận fetch trực tiếp trang Alibaba.com bị chặn bởi CAPTCHA nên bắt buộc phải qua API bên thứ ba). **Còn thiếu: HOST + đường dẫn endpoint + tên tham số thật** — trang RapidAPI bị lỗi tạm thời (504) lúc làm nên chưa lấy được Code Snippets. Việc cần làm tiếp: vào lại trang RapidAPI, test 1 endpoint chi tiết sản phẩm, gửi JSON kết quả + Code Snippets để hoàn thiện file.
- [ ] Cơ chế quét/nhập mã QR để lấy uid sản phẩm (cột `externalId` đã chừa sẵn)

## Giai đoạn 3 — Dịch + AI
- [x] Nối LLM thật trong `src/lib/llm/` — dùng **Google Gemini** (`gemini-3.5-flash`, có gói miễn phí 1.500 request/ngày). MỘT request cho CẢ sản phẩm, GỘP dữ liệu tất cả link (ảnh, mô tả, đánh giá), trả JSON có cấu trúc gồm (A) mô tả tổng hợp + (B) tệp khách hàng mục tiêu đủ 6 mục theo mindmap.
- [x] Nút "✨ Tạo bằng AI" + khung sửa tay trên trang chi tiết sản phẩm (`AiAnalysisPanel.tsx`, gọi `POST /api/products/[id]/analyze`)
- [x] Chèn ảnh gốc vào bài AI — prompt yêu cầu Gemini dùng cú pháp `![](url)` với đúng url ảnh thật đã cung cấp
- [x] Dịch Trung→Việt cho Taobao/Tmall — **đã có sẵn** qua tham số `language=vi` của chính Otapi (xem Giai đoạn 2), không cần bước dịch riêng cho nhóm này. Module `src/lib/translate/` vẫn là stub, chỉ cần dùng nếu sau này có provider không tự dịch được (vd nếu Otapi Alibaba không hỗ trợ `language=vi`).
- [x] Render markdown đẹp bằng `react-markdown` + `@tailwindcss/typography` (class `prose`) — tiêu đề/in đậm/ảnh hiện đúng thay vì chữ thô, đã test thật (kiểm tra HTML trả về có `<h1>`, `<strong>`, `<img>` thay vì `#`/`**`).
- [x] **Prompt gửi AI có thể tùy chỉnh** — Cài đặt > "📝 Prompt gửi AI", sửa toàn bộ phần hướng dẫn, giữ lại các placeholder `{{PRODUCT_NAME}}` `{{USER_DESCRIPTION}}` `{{LISTINGS_DATA}}` `{{IMAGE_URLS}}` `{{COST_ASSUMPTIONS}}` để app tự điền dữ liệu thật. Có nút "Khôi phục mặc định". Lưu trong `Setting` key `ai_prompt_template`.
- [x] **Phân tích AI mở rộng thành 7 mục** (`AiAnalysisPanel.tsx`, thu gọn/mở rộng từng mục):
  - A. Mô tả tổng hợp · B. Tệp khách hàng · C. Kênh bán hàng & hướng tiếp thị (offline/TikTok/Shopee, lý do phù hợp theo từng kênh)
  - D. **Gợi ý tùy chỉnh sản phẩm** — ý tưởng CỤ THỂ theo từng sản phẩm (không chung chung), từ rẻ tiền tới "wow"
  - E. Nhập khẩu (HS Code/thuế/VAT/kiểm định, có Google Search Grounding tra luật hiện hành — tự fallback bỏ grounding nếu tài khoản Google chưa liên kết thanh toán, lỗi 429)
  - F. Đóng gói & vận chuyển nội địa
  - G. **Đánh giá tính khả thi kinh doanh** — so sánh mô hình Tổng kho vs Tự bán Online, bóc tách chi phí ẩn dựa trên số liệu người dùng tự nhập (mục "💰 Giả định chi phí kinh doanh"), tính giá hòa vốn bằng công thức thật, **so sánh với sản phẩm cùng chức năng đang thực bán trên thị trường** (phân khúc ngang bằng + thấp hơn, đánh giá khác biệt hóa theo từng tệp khách hàng chứ không chỉ so giá — vd sản phẩm giá cao vẫn khả thi nếu hợp thẩm mỹ/tiện ích với đúng tệp khách), bảng chiến lược giá tăng dần từ hòa vốn tới lãi cao kèm phản ứng khách hàng dự kiến từng mức, cơ hội/thách thức gồm cả vận chuyển/thông quan/kho bãi/kiểm hóa.
  - Đã test thật với key Gemini của user: chất lượng cao, đúng công thức tính toán, đúng đặc thù từng sản phẩm.
- [x] **"💰 Giả định chi phí kinh doanh"** trong Cài đặt (`CostAssumptionsForm.tsx`) — **bảng động**, người dùng tự thêm/bớt dòng chi phí tùy ý: tên + số + **2 ô đơn vị tách riêng** (Đơn vị 1: VNĐ/%..., Đơn vị 2: /đơn hàng, /doanh thu, /tháng, /tổng đơn hàng...), cả 2 ô dùng datalist — chọn nhanh từ gợi ý HOẶC gõ tự do thêm đơn vị mới hoàn toàn (đã test: "USD" / "pallet" tự đặt vẫn lưu đúng). Ô "Giá trị" tự định dạng dấu phẩy ngăn hàng nghìn + dấu chấm thập phân (vd `20,000`, `1,000.5`) khi rời khỏi ô, không phá gõ dở lúc đang focus. Không giới hạn tên trường cố định vì toàn bộ chèn thẳng vào prompt dạng text, AI đọc hiểu bất kể tên gì. Mặc định 9 dòng: Chi phí vận hành, Phí cố định, Voucher sàn, Ads nội sàn, Phí hoa hồng, Thuế GTGT/TNCN/TNDN, Tỷ lệ hoàn hàng. Lưu `Setting` key `business_cost_assumptions` (JSON mảng, field `unit1`/`unit2`).
- [ ] Tự động cập nhật tỷ giá CNY→VNĐ hàng ngày

## Giai đoạn 4 — Lưu trữ & nhiều người dùng
- [x] Tải ảnh về máy hoặc Google Drive (`src/lib/storage/`) — có sẵn `localStorageProvider` (fallback ổ đĩa) và `googleDriveProvider` (OAuth2, dedupe, resize), chọn provider đang bật trong Cài đặt > API.
- [x] Đăng nhập nhiều tài khoản (không dùng Auth.js — tự viết bằng `iron-session` + `bcryptjs`, xem `src/lib/auth.ts`, `src/middleware.ts`). Bảng User có `role` admin/member, quản lý tài khoản ở Cài đặt > Bảo mật (`src/components/SecurityPanel.tsx`).
- [x] **Phân quyền admin/member** — `requireAdmin()` (`src/lib/auth.ts`) chặn các thao tác nhạy cảm: sửa Cài đặt/tỷ giá/chi phí/prompt AI (`PATCH /api/settings`), bật/tắt & sửa API key provider (`PATCH /api/providers/[id]`), kết nối/ngắt Google Drive (`/api/storage/google/*`), xóa sản phẩm (`DELETE /api/products/[id]`). Member vẫn tự do thêm/sửa sản phẩm, cào dữ liệu, xóa Listing lẻ (việc hàng ngày).
- [x] **Đổi hướng: bỏ VPS/server chung** — đã thử Docker + Postgres + thuê VPS, nhưng quyết định cuối: **mỗi người (chủ app + nhân sự sau này) tự chạy app độc lập trên máy riêng** (không đăng nhập chung 1 server). Quay lại SQLite (`prisma/schema.prisma`), bỏ hẳn Docker (đã xóa `Dockerfile`/`docker-compose.yml`/`.dockerignore`) — chạy thẳng bằng `npm run dev` như ban đầu.
- [x] Tính năng xuất báo cáo (CSV/Excel, chọn trường tùy ý, cho người đọc) — `src/app/export/`
- [x] **Tính năng Đồng bộ dữ liệu giữa các máy** (`src/app/sync/`, `src/lib/sync/`) — vì mỗi người chạy database riêng, cần cách gộp dữ liệu lại: xuất toàn bộ dữ liệu (JSON đầy đủ, không phải CSV báo cáo) lên Google Drive của người đó, lấy link chia sẻ gửi cho chủ app, chủ app dán link vào app rồi bấm "Đồng bộ" để tải về và gộp. Product có thêm field `uuid` ổn định để nhận diện xuyên suốt các máy (chống trùng khi nhập lại nhiều lần) — chỉ CỘNG THÊM dữ liệu mới, không sửa/đè dữ liệu đã có.
- [x] Ảnh bắt buộc lưu qua Google Drive (không lưu ổ đĩa local) để file đồng bộ giữa các máy gọn nhẹ, chỉ cần link ảnh.

## Giai đoạn 5 — Chỉ số & phân tích
*Mindmap có ghi "cài đặt liên quan đến các chỉ số tính toán sau này".*

- [ ] Tính lãi gộp dự kiến: giá xưởng + phí ship + thuế → so với giá bán lẻ
- [ ] Theo dõi biến động giá theo thời gian (cần bảng lịch sử giá)
- [ ] Xuất Excel danh sách sản phẩm

---

💡 **Cách làm việc gợi ý:** mỗi lần chỉ làm 1 mục, chạy `npm run dev` xem kết quả, ưng rồi mới làm mục tiếp theo. Khi nhờ AI code, mở kèm file docs này + `docs/02-cau-truc.md` để AI hiểu ngay bối cảnh.
