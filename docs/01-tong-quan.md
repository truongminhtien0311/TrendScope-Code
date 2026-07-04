# 01 — Tổng quan: app hoạt động thế nào

## Công nghệ (và lý do chọn)

| Thành phần | Công nghệ | Tại sao |
|---|---|---|
| Khung app | **Next.js 16** (React + TypeScript) | Một framework lo cả giao diện lẫn backend. Phổ biến nhất hiện nay → nhờ AI hoặc thuê dev sửa đều dễ. |
| Giao diện | **Tailwind CSS 4** | Viết style ngay trong code, có sẵn dark mode. |
| Database | **SQLite** (qua Prisma) | Toàn bộ dữ liệu nằm trong 1 file `prisma/dev.db` trên máy — không phải cài gì thêm. Khi team đông, đổi sang PostgreSQL mà không phải viết lại code. |
| Kiểm tra dữ liệu | **Zod** | Chặn dữ liệu sai trước khi vào database. |

## Luồng hoạt động chính

```
Người dùng dán link Taobao/1688...
        │
        ▼
POST /api/scrape  (src/app/api/scrape/route.ts)
        │
        ▼
Nhận diện sàn từ URL  (src/lib/scrapers/index.ts)
        │
        ▼
Chọn scraper phù hợp ──► hiện tại: MOCK (dữ liệu giả)
        │                 sau này: TMAPI/OneBound... (API thật)
        ▼
Dịch tiếng Việt (src/lib/translate — hiện là stub)
        │
        ▼
Lưu database: Listing + Variant (giá) + Image + Review
        │
        ▼
Trang chi tiết sản phẩm hiển thị, giá quy đổi VNĐ theo tỷ giá trong Cài đặt
```

## Nguyên tắc kiến trúc quan trọng nhất: ADAPTER

Mọi dịch vụ bên ngoài (cào dữ liệu, dịch, AI, lưu trữ cloud) đều đi qua một "ổ cắm" chuẩn trong `src/lib/`:

- `src/lib/scrapers/` — cào dữ liệu. Muốn thêm nhà cung cấp mới chỉ cần thêm 1 file trong `providers/`, không sửa chỗ khác.
- `src/lib/translate/` — dịch Trung → Việt (đang là stub, trả nguyên văn).
- `src/lib/llm/` — AI tổng hợp mô tả (đang trả bản nháp mẫu).
- `src/lib/storage/` — tải ảnh về local/Google Drive/Lark (đang là stub).

Nhờ vậy, mục **Cài đặt > API** trong app có thể bật/tắt từng nhà cung cấp đúng như mindmap, và đổi nhà cung cấp không làm hỏng phần còn lại.

## Những gì ĐÃ chạy được ngay

- Dashboard: lưới sản phẩm, filter theo ngày/tag/giá/ngành hàng
- Thêm sản phẩm, dán link → cào dữ liệu giả → hiển thị đầy đủ (phân loại, giá ¥/VNĐ, ảnh, đánh giá đã dịch)
- Cài đặt: bật/tắt API provider, chỉnh tỷ giá CNY→VNĐ
- Dark/Light mode
- Log ghi mọi hoạt động

## Những gì CHƯA làm (có chủ đích — chờ giai đoạn sau)

- API cào dữ liệu **thật** (đang dùng mock)
- Dịch thật, AI tổng hợp mô tả thật
- Đăng nhập nhiều người dùng
- Tải ảnh về máy / đồng bộ cloud
- Quét mã QR lấy uid sản phẩm

Chi tiết từng giai đoạn: xem [04-lo-trinh.md](04-lo-trinh.md).
