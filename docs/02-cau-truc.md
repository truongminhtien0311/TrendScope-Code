# 02 — Cấu trúc thư mục: muốn sửa gì thì mở file nào

```
trendscope/
├── prisma/
│   ├── schema.prisma      ← ĐỊNH NGHĨA DATABASE (các bảng dữ liệu)
│   ├── seed.ts            ← Dữ liệu mẫu (chạy: npx prisma db seed)
│   └── dev.db             ← File database thật (KHÔNG sửa tay, không đưa lên git)
│
├── src/
│   ├── app/               ← MỖI THƯ MỤC = 1 TRANG hoặc 1 API
│   │   ├── page.tsx               ← Trang Dashboard (trang chủ)
│   │   ├── products/[id]/page.tsx ← Trang chi tiết 1 sản phẩm
│   │   ├── manage/page.tsx        ← Trang quản lý Tag & Ngành hàng
│   │   ├── settings/page.tsx      ← Trang Cài đặt
│   │   ├── logs/page.tsx          ← Trang Log hoạt động
│   │   ├── layout.tsx             ← Khung chung (sidebar + nội dung)
│   │   ├── globals.css            ← Màu nền, dark mode
│   │   └── api/                   ← BACKEND (xử lý dữ liệu)
│   │       ├── products/          ← Thêm/sửa/xóa sản phẩm
│   │       ├── products/[id]/analyze/ ← Tạo mô tả AI + tệp khách hàng (Gemini)
│   │       ├── listings/          ← POST tạo link THỦ CÔNG (không qua scraper)
│   │       ├── listings/[id]/     ← Sửa (PATCH)/xóa link, cào lại (rescrape/)
│   │       ├── listings/[id]/variants/ ← Thêm phân loại thủ công
│   │       ├── listings/[id]/images/   ← Gắn ảnh (sau khi /api/uploads xong)
│   │       ├── listings/[id]/reviews/  ← Thêm đánh giá thủ công
│   │       ├── variants/[id]/     ← Sửa (PATCH)/xóa (DELETE) 1 phân loại
│   │       ├── images/[id]/       ← Đổi loại/xóa 1 ảnh (xóa cả file thật nếu ở /uploads/)
│   │       ├── reviews/[id]/      ← Sửa/xóa 1 đánh giá
│   │       ├── uploads/           ← Nhận file ảnh (tải lên/dán clipboard), lưu vào public/uploads/
│   │       ├── translate/         ← Dịch nhanh 1 đoạn text Trung→Việt (nút 🔤, dùng Gemini)
│   │       ├── scrape/            ← Nhận link → cào dữ liệu → lưu
│   │       ├── providers/[id]/    ← Bật/tắt API bên thứ ba
│   │       ├── settings/          ← Lưu cài đặt (tỷ giá, giả định chi phí, prompt...)
│   │       ├── tags/              ← Thêm/xóa tag
│   │       └── categories/        ← Thêm/xóa ngành hàng
│   │
│   ├── components/        ← CÁC MẢNH GIAO DIỆN tái sử dụng
│   │   ├── Sidebar.tsx            ← Thanh điều hướng trái
│   │   ├── ThemeToggle.tsx        ← Nút Dark/Light
│   │   ├── ProductCard.tsx        ← Thẻ sản phẩm trên Dashboard
│   │   ├── FilterBar.tsx          ← Bộ lọc (tìm tên/ngày/tag/giá/ngành hàng)
│   │   ├── AddProductForm.tsx     ← Form thêm sản phẩm
│   │   ├── EditProductForm.tsx    ← Form sửa/xóa sản phẩm (nút ✏️/🗑️)
│   │   ├── AiAnalysisPanel.tsx    ← Nút "Tạo bằng AI" + sửa mô tả/tệp khách hàng (render markdown đẹp)
│   │   ├── PromptEditor.tsx       ← Sửa prompt gửi AI (Cài đặt), khôi phục mặc định
│   │   ├── CostAssumptionsForm.tsx ← Sửa % phí sàn/ads/... cho mục Đánh giá khả thi
│   │   ├── VariantTable.tsx       ← Bảng phân loại: sửa/thêm/xóa tên+giá
│   │   ├── AddListingForm.tsx     ← 2 chế độ: 🔗 Dán link (tự cào) / ✍️ Nhập tay
│   │   ├── EditListingForm.tsx    ← Sửa tay tên/mô tả/người bán/lượt bán/URL của link
│   │   ├── ImageManager.tsx       ← Ảnh: tải lên từ máy HOẶC Ctrl+V dán clipboard
│   │   ├── ReviewManager.tsx      ← Đánh giá: sửa/thêm/xóa tay
│   │   ├── TranslateButton.tsx    ← Nút 🔤 dịch nhanh Trung→Việt (Gemini), dùng chung nhiều nơi
│   │   ├── ListingActions.tsx     ← Nút "Cào lại" / "Xóa link"
│   │   ├── SetMainImageButton.tsx ← Chọn link cấp ảnh đại diện sản phẩm
│   │   ├── TagManager.tsx         ← Thêm/xóa tag (trang /manage)
│   │   ├── CategoryManager.tsx    ← Thêm/xóa ngành hàng (trang /manage)
│   │   ├── ProviderRow.tsx        ← Dòng API: bật/tắt + ô nhập API key/URL
│   │   └── RateForm.tsx           ← Form chỉnh tỷ giá
│   │
│   └── lib/               ← LOGIC NGHIỆP VỤ (không dính giao diện)
│       ├── db.ts                  ← Kết nối database (luôn import từ đây)
│       ├── currency.ts            ← Quy đổi ¥ → VNĐ, định dạng tiền
│       ├── log.ts                 ← Ghi log hoạt động
│       ├── product-image.ts       ← Luật chọn ảnh đại diện sản phẩm
│       ├── scrapers/              ← ⭐ Cào dữ liệu
│       │   ├── types.ts           ← Chuẩn chung mọi scraper phải theo
│       │   ├── index.ts           ← Nhận diện sàn, chọn scraper
│       │   └── providers/
│       │       ├── mock.ts        ← Scraper giả (dùng khi provider thật đang tắt)
│       │       ├── otapi-taobao-tmall.ts ← Scraper THẬT cho Taobao/Tmall (RapidAPI)
│       │       ├── otapi-alibaba.ts ← 🚧 Khung sẵn cho Alibaba.com, CHƯA xong (thiếu endpoint thật)
│       │       └── tmapi.example.ts ← File mẫu để thêm provider mới (vd JD)
│       ├── translate/             ← Dịch nhanh Trung → Việt — dùng Gemini thật (không còn stub)
│       ├── llm/                   ← AI tổng hợp mô tả — Gemini thật
│       ├── notify.ts              ← Toast + tiếng "ding" khi cào/AI xong
│       └── storage/               ← Lưu ảnh local/cloud (stub — ảnh tải tay đã dùng public/uploads/ riêng, xem api/uploads/)
│
├── public/uploads/        ← Ảnh người dùng tải lên/dán tay (không commit — .gitignore)
├── docs/                  ← Tài liệu bạn đang đọc
├── .env                   ← Đường dẫn database (không đưa lên git)
└── package.json           ← Danh sách thư viện + các lệnh npm
```

## Các tình huống sửa đổi thường gặp

| Muốn... | Mở file |
|---|---|
| Đổi giao diện Dashboard | `src/app/page.tsx`, `src/components/ProductCard.tsx` |
| Đổi giao diện trang chi tiết | `src/app/products/[id]/page.tsx` |
| Thêm 1 cột dữ liệu mới (vd: ghi chú giá vốn) | `prisma/schema.prisma` → chạy `npx prisma db push` → sửa trang hiển thị |
| Nối API cào dữ liệu thật | Chép `src/lib/scrapers/providers/tmapi.example.ts` thành file mới, viết logic, đăng ký trong `scrapers/index.ts` |
| Nối API dịch / AI | `src/lib/translate/index.ts` / `src/lib/llm/index.ts` |
| Thêm 1 trang mới (vd: /report) | Tạo thư mục `src/app/report/` với file `page.tsx` |
| Đổi màu sắc, dark mode | `src/app/globals.css` |
| Thêm mục cài đặt mới | `src/app/settings/page.tsx` + lưu qua `/api/settings` |
