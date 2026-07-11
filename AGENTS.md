<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project: Product Scrap

App quản lý & nghiên cứu sản phẩm nguồn Trung Quốc (Taobao/Tmall/JD + Alibaba/1688) cho người dùng Việt Nam. Chủ dự án KHÔNG phải dev — giải thích bằng tiếng Việt, đơn giản, tránh thuật ngữ khi trả lời.

## Bối cảnh nhanh
- Stack: Next.js 16 (App Router, src dir) + Tailwind 4 + Prisma 6 + SQLite (`prisma/dev.db`).
- Ý tưởng gốc: mindmap Obsidian tại `C:\Users\Admin\Documents\Obsidian Vault\Product Scrap-mindmap.md`.
- Tài liệu chính bằng tiếng Việt trong `docs/` — đọc `docs/02-cau-truc.md` (bản đồ file) và `docs/04-lo-trinh.md` (roadmap) trước khi thêm tính năng.

## Quy ước
- Mọi dịch vụ ngoài đi qua adapter trong `src/lib/` (scrapers/translate/llm/storage). Thêm nhà cung cấp = thêm file provider + đăng ký, không sửa nơi khác.
- Import database từ `src/lib/db.ts` (singleton), không tự `new PrismaClient()`.
- Mọi thao tác ghi dữ liệu trong API route phải gọi `logActivity()` (`src/lib/log.ts`).
- Giá chỉ lưu CNY; VNĐ quy đổi lúc hiển thị theo Setting `cny_vnd_rate` (`src/lib/currency.ts`).
- Giữ song song bản gốc tiếng Trung và bản dịch (`*Original` / `*Vi`).
- UI text bằng tiếng Việt; comment code bằng tiếng Việt.
- Database: SQLite (`prisma/dev.db`) — mỗi người tự chạy app độc lập trên máy riêng (không còn server/VPS chung, đã bỏ Docker). Đổi schema: sửa `prisma/schema.prisma` → `npx prisma migrate dev --name <tên>` (tạo migration mới trong `prisma/migrations/`). Reset sạch + seed lại: `npm run db:reset`. KHÔNG dùng `prisma db push` (không tạo lịch sử migration).
- Chỉ-admin (dùng `requireAdmin()` trong `src/lib/auth.ts`): sửa Cài đặt/tỷ giá/chi phí/prompt AI, bật/tắt & sửa API key provider, kết nối/ngắt Google Drive, xóa sản phẩm. Member vẫn tự do thêm/sửa sản phẩm, cào dữ liệu, xóa Listing lẻ.
- Đồng bộ dữ liệu giữa các máy (`src/lib/sync/`, `src/app/sync/`, `src/app/api/sync/`): xuất/nhập JSON đầy đủ qua Google Drive, nhận diện trùng lặp bằng `Product.uuid` (ổn định, khác `id` tự tăng chỉ có nghĩa trong 1 database) và `Listing.url`. Import CHỈ CỘNG THÊM dữ liệu mới, không bao giờ sửa/đè dữ liệu đã có.
