# 🛒 Product Scrap

App quản lý & nghiên cứu sản phẩm nguồn Trung Quốc: gom link từ **Taobao, Tmall, JD** (shop bán lẻ) và **Alibaba** (nhà sản xuất) về một chỗ, cào dữ liệu thật, dịch sang tiếng Việt, quy đổi giá VNĐ, và dùng AI (Gemini) phân tích sản phẩm — mô tả, tệp khách hàng, kênh bán, chi phí nhập khẩu, tính khả thi kinh doanh...

Chạy dưới dạng **app cài đặt trên Windows** (đóng gói bằng Electron) — mỗi người tự cài và chạy độc lập trên máy riêng, dữ liệu lưu trong 1 file database SQLite trên máy đó. Có tính năng đồng bộ dữ liệu giữa các máy qua Google Drive.

## 📥 Cài đặt (dành cho người dùng)

1. Vào mục [Releases](../../releases) của repo này
2. Tải file **`Product Scrap Setup x.x.x.exe`** mới nhất
3. Chạy file vừa tải, cài như phần mềm Windows bình thường
4. Mở app từ Start Menu / Desktop shortcut

Lần đầu mở app sẽ hỏi tạo tài khoản quản trị (admin). Các API key (cào dữ liệu, dịch, AI, Google Drive...) cấu hình trong app ở mục **Cài đặt**, không cần sửa file gì bằng tay.

## 💻 Chạy từ code (dành cho người muốn sửa/phát triển)

Cần cài sẵn [Node.js](https://nodejs.org) (bản LTS).

```bash
npm install                 # cài thư viện, chỉ cần lần đầu
cp .env.example .env        # tạo file cấu hình, sửa SESSION_SECRET
npx prisma migrate dev      # tạo database
npm run dev                 # chạy app dev, mở http://localhost:3000
```

## Các lệnh hay dùng

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Chạy app (chế độ dev, sửa code là tự cập nhật) |
| `npm run build` | Kiểm tra toàn bộ code có lỗi không |
| `npm run db:studio` | Mở giao diện xem/sửa database trực tiếp |
| `npm run db:reset` | ⚠️ Xóa sạch database và đổ lại dữ liệu mẫu |
| `npm run electron:build` | Đóng gói thành file cài đặt `.exe` (ra thư mục `dist/`) |

## Đọc thêm

- [docs/01-tong-quan.md](docs/01-tong-quan.md) — App hoạt động thế nào, công nghệ dùng là gì
- [docs/02-cau-truc.md](docs/02-cau-truc.md) — File nào nằm ở đâu, muốn sửa gì thì mở file nào
- [docs/03-du-lieu.md](docs/03-du-lieu.md) — Dữ liệu được tổ chức ra sao
- [docs/04-lo-trinh.md](docs/04-lo-trinh.md) — Lộ trình phát triển tiếp theo (đã làm được gì, còn thiếu gì)
