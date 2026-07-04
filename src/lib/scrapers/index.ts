// ============================================================
// BỘ ĐIỀU PHỐI SCRAPER: nhận URL -> nhận diện sàn -> chọn
// provider phù hợp ĐANG BẬT trong Cài đặt để cào dữ liệu.
// ============================================================
import { prisma } from "@/lib/db";
import { getUsdCnyRate } from "@/lib/currency";
import type { Platform, SourceType, ScraperProvider, ProviderConfig } from "./types";
import { mockScraper } from "./providers/mock";
import { otapiTaobaoTmallScraper } from "./providers/otapi-taobao-tmall";
import { otapiAlibabaScraper } from "./providers/otapi-alibaba";

// Danh sách provider theo thứ tự ưu tiên (đứng trước = ưu tiên hơn nếu
// nhiều provider cùng bật cho 1 sàn). Mock đứng đầu để mặc định luôn
// dùng dữ liệu giả cho tới khi người dùng chủ động bật provider thật.
const providers: ScraperProvider[] = [mockScraper, otapiTaobaoTmallScraper, otapiAlibabaScraper];

// Nhận diện sàn từ URL người dùng dán vào
export function detectPlatform(url: string): Platform | null {
  const u = url.toLowerCase();
  if (u.includes("detail.tmall.com") || u.includes("tmall.com")) return "TMALL";
  if (u.includes("taobao.com")) return "TAOBAO";
  if (u.includes("jd.com") || u.includes("jd.hk")) return "JD";
  if (u.includes("1688.com")) return "C1688";
  if (u.includes("alibaba.com")) return "ALIBABA";
  return null;
}

// Sàn nào thuộc nhóm shop bán lẻ / nhà sản xuất
export function platformToSourceType(platform: Platform): SourceType {
  return platform === "ALIBABA" || platform === "C1688" ? "MANUFACTURER" : "RETAIL";
}

// Chọn provider đầu tiên hỗ trợ sàn này VÀ đang bật trong Cài đặt,
// kèm apiKey/baseUrl đã lưu để truyền vào scrape().
export async function getScraperFor(
  platform: Platform
): Promise<{ provider: ScraperProvider; config: ProviderConfig } | null> {
  const kind = platformToSourceType(platform) === "RETAIL" ? "SCRAPER_RETAIL" : "SCRAPER_MANUFACTURER";

  for (const provider of providers) {
    if (!provider.supports(platform)) continue;
    const row = await prisma.apiProvider.findFirst({
      where: { kind, name: provider.dbName, enabled: true },
    });
    if (row) {
      const usdCnyRate = await getUsdCnyRate();
      return {
        provider,
        config: { apiKey: row.apiKey ?? undefined, baseUrl: row.baseUrl ?? undefined, usdCnyRate },
      };
    }
  }
  return null;
}
