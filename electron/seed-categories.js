// ============================================================
// Đảm bảo danh sách ngành hàng mặc định (gộp từ Shopee VN + đối chiếu
// TikTok Shop VN, xem electron/default-categories.json) luôn tồn tại —
// kể cả bản đóng gói KHÔNG chạy prisma/seed.ts (cố tình bỏ dữ liệu sản
// phẩm mẫu, xem electron/main.js). Không tạo sản phẩm/tài khoản gì ở
// đây, chỉ đúng phần ngành hàng để trang "Tag & Ngành hàng" và mục
// "Tỷ lệ markup theo ngành hàng" trong Cài đặt không trống trơn ngay
// cả trên máy mới cài lần đầu. An toàn chạy lại nhiều lần (chỉ tạo nếu
// chưa có, không đụng ngành hàng người dùng đã tự thêm/sửa/xóa).
// ============================================================
const path = require("path");

async function main() {
  const resourcesPath = process.argv[2];
  const clientPath = path.join(resourcesPath, "node_modules", "@prisma", "client");
  const { PrismaClient } = require(clientPath);
  const prisma = new PrismaClient();
  const categories = require("./default-categories.json");

  for (const c of categories) {
    const existing = await prisma.category.findUnique({ where: { name: c.name } });
    if (!existing) await prisma.category.create({ data: c });
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Seed ngành hàng thất bại:", err);
  process.exit(1);
});
