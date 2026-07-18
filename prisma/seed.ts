// ============================================================
// SEED — đổ dữ liệu mẫu vào database để nhìn thấy giao diện ngay.
// Chạy: npx prisma db seed
// Dữ liệu ở đây là GIẢ, chỉ để test giao diện; xóa lúc nào cũng được.
// ============================================================
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // --- Người dùng đầu tiên (admin) ---
  const admin = await prisma.user.upsert({
    where: { email: "truongminhtien0311@gmail.com" },
    update: { isOwner: true },
    create: {
      email: "truongminhtien0311@gmail.com",
      name: "Tiến",
      role: "admin",
      isOwner: true,
    },
  });

  // --- Cài đặt mặc định ---
  await prisma.setting.upsert({
    where: { key: "cny_vnd_rate" },
    update: {},
    create: { key: "cny_vnd_rate", value: "3650" }, // 1 CNY ≈ 3.650 VNĐ
  });

  // --- Ngành hàng mặc định — gộp từ danh mục thật của Shopee VN (23
  // ngành hàng, 5 nhóm chính thức) + đối chiếu TikTok Shop VN, mỗi
  // ngành có emoji đại diện để hiển thị đẹp hơn (emoji + tên ghép lại).
  // Người dùng vẫn tự thêm/sửa/xóa được ở trang "Tag & Ngành hàng".
  const DEFAULT_CATEGORIES: { name: string; icon: string }[] = [
    { name: "Thời trang nữ", icon: "👗" },
    { name: "Phụ kiện & Túi ví nữ", icon: "👜" },
    { name: "Giày dép nữ", icon: "👠" },
    { name: "Thời trang nam", icon: "👔" },
    { name: "Giày dép nam", icon: "👞" },
    { name: "Thời trang trẻ em", icon: "🧒" },
    { name: "Đồng hồ", icon: "⌚" },
    { name: "Thể thao & Du lịch", icon: "🏃" },
    { name: "Điện thoại & Phụ kiện", icon: "📱" },
    { name: "Thiết bị điện tử", icon: "🔌" },
    { name: "Máy tính & Laptop", icon: "💻" },
    { name: "Máy ảnh", icon: "📷" },
    { name: "Điện gia dụng", icon: "🧺" },
    { name: "Sắc đẹp & Sức khỏe", icon: "💄" },
    { name: "Mẹ và bé", icon: "👶" },
    { name: "Giặt giũ & Chăm sóc nhà cửa", icon: "🧼" },
    { name: "Bách hóa Online", icon: "🛒" },
    { name: "Chăm sóc thú cưng", icon: "🐾" },
    { name: "Nhà cửa & Đời sống", icon: "🏠" },
    { name: "Ô tô, xe máy & Phụ kiện", icon: "🏍️" },
    { name: "Đồ chơi", icon: "🧸" },
    { name: "Nhà sách Online", icon: "📚" },
  ];
  const categories = await Promise.all(
    DEFAULT_CATEGORIES.map((c) =>
      prisma.category.upsert({ where: { name: c.name }, update: { icon: c.icon }, create: c })
    )
  );
  const dienGiaDung = categories.find((c) => c.name === "Điện gia dụng")!;
  const dienThoai = categories.find((c) => c.name === "Điện thoại & Phụ kiện")!;
  const [tagHot, tagCanKiemTra] = await Promise.all([
    prisma.tag.upsert({
      where: { name: "Hot" },
      update: {},
      create: { name: "Hot", color: "#ef4444" },
    }),
    prisma.tag.upsert({
      where: { name: "Cần kiểm tra" },
      update: {},
      create: { name: "Cần kiểm tra", color: "#f59e0b" },
    }),
    prisma.tag.upsert({
      where: { name: "Đã đặt mẫu" },
      update: {},
      create: { name: "Đã đặt mẫu", color: "#22c55e" },
    }),
  ]);

  // --- Sản phẩm mẫu 1: có cả link shop bán lẻ + nhà sản xuất ---
  // Chỉ tạo nếu CHƯA có (kiểm tra theo tên) — chạy seed lại nhiều lần
  // không được tự nhân đôi sản phẩm giả.
  const existingSp1 = await prisma.product.findFirst({ where: { name: "Máy hút bụi mini cầm tay" } });
  const sp1 = existingSp1 ?? await prisma.product.create({
    data: {
      name: "Máy hút bụi mini cầm tay",
      description: "Hàng test dữ liệu giả — dùng để xem giao diện.",
      categories: { connect: [{ id: dienGiaDung.id }] },
      tags: { connect: [{ id: tagHot.id }] },
      listings: {
        create: [
          {
            sourceType: "RETAIL",
            platform: "TAOBAO",
            url: "https://item.taobao.com/item.htm?id=123456789",
            sellerName: "小家电旗舰店",
            titleOriginal: "无线迷你吸尘器 大吸力 家用车用",
            titleVi: "Máy hút bụi mini không dây lực hút lớn, dùng cho nhà và ô tô",
            descriptionOriginal: "轻巧便携，一键启动，USB充电。",
            descriptionVi: "Nhỏ gọn dễ mang theo, khởi động một nút, sạc USB.",
            soldTotal: 15230,
            soldMonthly: 842,
            lastScrapedAt: new Date(),
            variants: {
              create: [
                { nameOriginal: "白色 标准版", nameVi: "Trắng - Bản tiêu chuẩn", priceCny: 39.9 },
                { nameOriginal: "黑色 升级版", nameVi: "Đen - Bản nâng cấp", priceCny: 59.9 },
              ],
            },
            images: {
              create: [
                { url: "https://picsum.photos/seed/vacuum1/600/600", kind: "MAIN" },
                { url: "https://picsum.photos/seed/vacuum2/600/600", kind: "GALLERY", sortOrder: 1 },
                { url: "https://picsum.photos/seed/vacuum3/600/900", kind: "DESCRIPTION" },
              ],
            },
            reviews: {
              create: [
                {
                  contentOriginal: "吸力很大，很好用！",
                  contentVi: "Lực hút mạnh, rất dễ dùng!",
                  rating: 5,
                },
                {
                  contentOriginal: "电池续航一般。",
                  contentVi: "Pin dùng được ở mức trung bình.",
                  rating: 3,
                },
              ],
            },
          },
          {
            sourceType: "MANUFACTURER",
            platform: "C1688",
            url: "https://detail.1688.com/offer/987654321.html",
            sellerName: "深圳市XX电器有限公司",
            titleOriginal: "厂家直销 无线迷你吸尘器 OEM定制",
            titleVi: "Xưởng bán trực tiếp - Máy hút bụi mini không dây, nhận OEM",
            soldTotal: 98000,
            lastScrapedAt: new Date(),
            variants: {
              create: [
                { nameOriginal: "标准版 (起批100件)", nameVi: "Bản tiêu chuẩn (tối thiểu 100 cái)", priceCny: 18.5 },
              ],
            },
            images: {
              create: [{ url: "https://picsum.photos/seed/factory1/600/600", kind: "MAIN" }],
            },
          },
        ],
      },
    },
  });

  // --- Sản phẩm mẫu 2 (cũng chỉ tạo nếu chưa có) ---
  const existingSp2 = await prisma.product.findFirst({ where: { name: "Giá đỡ điện thoại để bàn" } });
  if (!existingSp2) await prisma.product.create({
    data: {
      name: "Giá đỡ điện thoại để bàn",
      categories: { connect: [{ id: dienThoai.id }] },
      tags: { connect: [{ id: tagCanKiemTra.id }] },
      listings: {
        create: [
          {
            sourceType: "RETAIL",
            platform: "TMALL",
            url: "https://detail.tmall.com/item.htm?id=555666777",
            titleOriginal: "桌面手机支架 铝合金 可调节",
            titleVi: "Giá đỡ điện thoại để bàn hợp kim nhôm, điều chỉnh được",
            soldTotal: 3200,
            soldMonthly: 210,
            variants: {
              create: [{ nameOriginal: "银色", nameVi: "Bạc", priceCny: 25.0 }],
            },
            images: {
              create: [{ url: "https://picsum.photos/seed/stand1/600/600", kind: "MAIN" }],
            },
          },
        ],
      },
    },
  });

  // --- Danh sách API bên thứ ba (mục Cài đặt > API trong mindmap) ---
  // Dùng chung file JSON với electron/seed-providers.js (bản đóng gói không
  // chạy file seed.ts này — xem electron/main.js — nhưng vẫn cần đúng danh
  // sách provider, nên tách ra 1 nguồn duy nhất tránh lệch nhau).
  const providers = (await import("../electron/default-providers.json", { with: { type: "json" } })).default as Array<{
    kind: string;
    name: string;
    enabled: boolean;
    referenceUrl?: string;
  }>;
  for (const p of providers) {
    const existing = await prisma.apiProvider.findFirst({
      where: { kind: p.kind, name: p.name },
    });
    if (!existing) await prisma.apiProvider.create({ data: p });
  }

  await prisma.activityLog.create({
    data: {
      action: "system.seed",
      detail: `Đã tạo dữ liệu mẫu (sản phẩm #${sp1.id}...)`,
      userId: admin.id,
    },
  });

  console.log("Seed xong: 2 sản phẩm mẫu, tag, ngành hàng, API providers.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
