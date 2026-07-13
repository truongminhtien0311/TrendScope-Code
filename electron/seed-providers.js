// ============================================================
// Đảm bảo danh sách API provider (Otapi/Alibaba/Gemini/Grok/Google
// Drive/Lark Drive) luôn tồn tại — kể cả bản đóng gói KHÔNG chạy
// prisma/seed.ts (cố tình bỏ qua dữ liệu sản phẩm mẫu, xem electron/main.js).
// Không tạo sản phẩm/tài khoản gì ở đây, chỉ đúng phần provider để trang
// Cài đặt > API luôn hiển thị đủ ngay cả trên máy mới cài lần đầu.
// An toàn chạy lại nhiều lần (chỉ tạo nếu chưa có).
// ============================================================
const path = require("path");

async function main() {
  const resourcesPath = process.argv[2];
  const clientPath = path.join(resourcesPath, "node_modules", "@prisma", "client");
  const { PrismaClient } = require(clientPath);
  const prisma = new PrismaClient();
  const providers = require("./default-providers.json");

  // Dọn các dòng "Mock - dữ liệu giả để test" đã seed từ trước (đã bỏ
  // hẳn khỏi default-providers.json) — dữ liệu giả gây nhầm với dữ liệu
  // cào thật nên bỏ luôn, không chỉ ẩn ở giao diện.
  await prisma.apiProvider.deleteMany({ where: { name: { startsWith: "Mock" } } });

  for (const p of providers) {
    const existing = await prisma.apiProvider.findFirst({ where: { kind: p.kind, name: p.name } });
    if (!existing) await prisma.apiProvider.create({ data: p });
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Seed provider thất bại:", err);
  process.exit(1);
});
