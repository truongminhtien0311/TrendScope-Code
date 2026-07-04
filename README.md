# 🛒 Product Scrap

App quản lý & nghiên cứu sản phẩm nguồn Trung Quốc: gom link từ **Taobao, Tmall, JD** (shop bán lẻ) và **Alibaba, 1688** (nhà sản xuất) về một chỗ, cào dữ liệu, dịch sang tiếng Việt, quy đổi giá VNĐ, và (sau này) dùng AI tổng hợp mô tả sản phẩm.

> Dự án đang ở **giai đoạn khung xương (skeleton)**: giao diện và luồng dữ liệu chạy được với dữ liệu giả (mock), các API thật (cào dữ liệu, dịch, AI) sẽ nối vào sau. Xem [docs/04-lo-trinh.md](docs/04-lo-trinh.md).

## Chạy app

Mở terminal trong thư mục này rồi chạy:

```bash
npm install        # chỉ cần lần đầu tiên (hoặc sau khi thêm thư viện mới)
npm run dev        # khởi động app
```

Mở trình duyệt vào **http://localhost:3000** — sẽ thấy Dashboard với 2 sản phẩm mẫu.

## Các lệnh hay dùng

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Chạy app (chế độ dev, sửa code là tự cập nhật) |
| `npm run build` | Kiểm tra toàn bộ code có lỗi không |
| `npm run db:studio` | Mở giao diện xem/sửa database trực tiếp |
| `npm run db:reset` | ⚠️ Xóa sạch database và đổ lại dữ liệu mẫu |

## Đọc thêm

- [docs/01-tong-quan.md](docs/01-tong-quan.md) — App hoạt động thế nào, công nghệ dùng là gì
- [docs/02-cau-truc.md](docs/02-cau-truc.md) — File nào nằm ở đâu, muốn sửa gì thì mở file nào
- [docs/03-du-lieu.md](docs/03-du-lieu.md) — Dữ liệu được tổ chức ra sao
- [docs/04-lo-trinh.md](docs/04-lo-trinh.md) — Lộ trình phát triển tiếp theo
