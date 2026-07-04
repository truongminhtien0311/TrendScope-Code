// ============================================================
// MOCK SCRAPER — trả về dữ liệu GIẢ để test toàn bộ luồng
// "dán link -> cào -> lưu -> hiển thị" mà chưa cần API thật.
// Khi tích hợp API thật, giữ file này lại để dev/test không tốn tiền API.
// ============================================================
import type { Platform, ScrapedListing, ScraperProvider } from "../types";

export const mockScraper: ScraperProvider = {
  id: "mock",
  name: "Mock - dữ liệu giả để test",
  dbName: "Mock - dữ liệu giả để test",

  supports: () => true, // hỗ trợ mọi sàn

  async scrape(url: string, externalId?: string): Promise<ScrapedListing> {
    // Giả lập độ trễ mạng ~0.8s cho giống thật
    await new Promise((r) => setTimeout(r, 800));

    const seed = Math.abs(hash(url)).toString(36).slice(0, 6);
    const platform = guessPlatform(url);

    return {
      platform,
      externalId: externalId ?? `mock-${seed}`,
      titleOriginal: `【测试数据】商品 ${seed} 高品质 厂家直供`,
      titleVi: `[Dữ liệu test] Sản phẩm ${seed} chất lượng cao, xưởng cung cấp trực tiếp`,
      sellerName: "测试店铺 (Shop test)",
      descriptionOriginal: "这是模拟抓取的商品描述。",
      descriptionVi: "Đây là mô tả sản phẩm được cào giả lập.",
      soldTotal: 1000 + (Math.abs(hash(seed)) % 90000),
      soldMonthly: 50 + (Math.abs(hash(seed + "m")) % 900),
      variants: [
        { nameOriginal: "红色", nameVi: "Đỏ", priceCny: 19.9 + (Math.abs(hash(seed + "1")) % 50) },
        { nameOriginal: "蓝色", nameVi: "Xanh", priceCny: 24.9 + (Math.abs(hash(seed + "2")) % 50) },
      ],
      images: [
        { url: `https://picsum.photos/seed/${seed}a/600/600`, kind: "MAIN" },
        { url: `https://picsum.photos/seed/${seed}b/600/600`, kind: "GALLERY", sortOrder: 1 },
        { url: `https://picsum.photos/seed/${seed}c/600/900`, kind: "DESCRIPTION" },
      ],
      reviews: [
        { contentOriginal: "质量不错！", contentVi: "Chất lượng ổn!", rating: 5 },
        { contentOriginal: "物流有点慢。", contentVi: "Giao hàng hơi chậm.", rating: 4 },
      ],
    };
  },
};

function guessPlatform(url: string): Platform {
  const u = url.toLowerCase();
  if (u.includes("tmall")) return "TMALL";
  if (u.includes("jd.")) return "JD";
  if (u.includes("1688")) return "C1688";
  if (u.includes("alibaba")) return "ALIBABA";
  return "TAOBAO";
}

// Hash đơn giản để dữ liệu giả ổn định theo URL (cùng link -> cùng dữ liệu)
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
