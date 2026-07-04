# 03 — Dữ liệu được tổ chức ra sao

Định nghĩa đầy đủ nằm trong `prisma/schema.prisma` (có chú thích từng dòng). Đây là bức tranh tổng thể:

```
Product (Sản phẩm — "Mục mẹ" trong mindmap)
│  tên, mô tả tự viết, ngày tạo,
│  mô tả AI tổng hợp (aiSummary) + tệp khách hàng (aiAudience — mục "Tệp")
│    -> CẢ HAI sinh từ MỘT request LLM gộp dữ liệu của TẤT CẢ các link,
│       mỗi sản phẩm chỉ có 1 bộ, KHÔNG tách theo từng link
│  link cấp ảnh đại diện (mainImageListingId — người dùng chọn tay;
│    để trống = ưu tiên shop bán lẻ thêm sớm nhất, xem src/lib/product-image.ts)
│  ├── gắn 1 Category (Ngành hàng)
│  ├── gắn nhiều Tag
│  └── có nhiều Listing (mỗi link nguồn = 1 listing)
│
Listing (1 link trên 1 sàn: Taobao/Tmall/JD/Alibaba/1688)
│  url, sàn, loại nguồn (bán lẻ / nhà sản xuất),
│  tên gốc + tên dịch, mô tả gốc + dịch,
│  lượt bán tổng/tháng, lần cào cuối
│  ├── Variant   : phân loại (màu/size...) + giá ¥ (VNĐ quy đổi lúc hiển thị);
│  │               sửa tay được vì giá quét có thể sai — priceEdited đánh dấu
│  │               giá đã sửa để lần cào lại không ghi đè
│  ├── ListingImage : ảnh (MAIN = đại diện, GALLERY = phụ, DESCRIPTION = trong mô tả)
│  └── Review    : đánh giá người mua (gốc + bản dịch)

ApiProvider  : danh sách API bên thứ ba (cào/dịch/AI/lưu trữ) — bật/tắt, key
Setting      : cài đặt key-value (vd tỷ giá cny_vnd_rate)
ActivityLog  : log toàn bộ hoạt động
User         : người dùng (chuẩn bị cho đăng nhập team sau này)
```

## Vài quyết định thiết kế cần biết

1. **Giá chỉ lưu Nhân dân tệ (¥).** VNĐ được tính lúc hiển thị theo tỷ giá trong Cài đặt. Nhờ vậy đổi tỷ giá là toàn bộ app cập nhật theo, không phải sửa từng sản phẩm.

2. **Khoảng giá / tổng lượt bán không lưu sẵn** mà tính từ các listing mỗi lần xem. Dữ liệu ít (vài trăm~vài nghìn sản phẩm) thì cách này luôn đúng và không bao giờ lệch.

3. **Bản gốc tiếng Trung luôn được giữ lại** song song với bản dịch (`titleOriginal`/`titleVi`, ...). Sau này đổi dịch vụ dịch tốt hơn thì dịch lại được từ bản gốc.

4. **Xóa sản phẩm là xóa cả chuỗi** (listing → variant/ảnh/review tự xóa theo — `onDelete: Cascade`), không để rác trong database.

## Muốn xem dữ liệu trực tiếp?

```bash
npm run db:studio
```

Lệnh này mở Prisma Studio trong trình duyệt — xem/sửa/xóa từng dòng dữ liệu như bảng Excel.
