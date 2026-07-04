// ============================================================
// LƯU TRỮ ẢNH & DỮ LIỆU (mindmap: Cài đặt > Lưu trữ)
//   - Local: tải ảnh về thư mục trên máy (mặc định trong Documents)
//   - Cloud: Google Drive, Lark... (bật/tắt trong Cài đặt > API)
// Chọn provider đang bật giống hệt cơ chế bên src/lib/scrapers/index.ts
// (getScraperFor) — không tự gọi database trong file provider, bên gọi
// tự tra bảng ApiProvider rồi truyền provider phù hợp ra.
//
// CHẶNG 5b: đã nối vào 2 luồng ảnh thật của app —
//   1. Cào dữ liệu (src/app/api/scrape, rescrape) -> saveScrapedImages()
//   2. Tải ảnh tay/dán clipboard (src/app/api/uploads) -> saveBuffer()
// 1 ảnh lỗi (mạng, quota Drive...) KHÔNG được làm hỏng cả listing — rơi
// về giữ nguyên URL gốc, log lại để biết, giống cách các scraper khác
// xử lý lỗi từng phần (vd fetchReviews trả [] khi lỗi).
// ============================================================
import { prisma } from "@/lib/db";
import type { ScrapedImage } from "@/lib/scrapers/types";

export interface StorageProvider {
  id: string; // "local" | "google-drive" | "lark"
  name: string; // phải khớp CHÍNH XÁC với ApiProvider.name trong database
  // Tải ảnh từ url về nơi lưu trữ, trả về đường dẫn/URL mới
  saveImage: (url: string, fileName: string) => Promise<string>;
  // Lưu buffer ảnh có sẵn (tải tay/dán clipboard) — provider nào không
  // hỗ trợ thì để trống, bên gọi tự fallback ghi local.
  saveBuffer?: (buffer: Buffer, fileName: string, mimeType: string) => Promise<string>;
}

export const localStorageProvider: StorageProvider = {
  id: "local",
  name: "Thư mục trên máy",
  async saveImage(url: string, _fileName: string): Promise<string> {
    // TODO: fetch ảnh -> ghi vào thư mục cấu hình trong Setting
    // (key "local_storage_dir", mặc định ~/Documents/ProductScrap)
    // -> cập nhật ListingImage.localPath
    return url; // tạm thời trả lại link gốc
  },
};

// Đăng ký theo thứ tự ưu tiên — local đứng đầu để mặc định không đổi gì
// cho tới khi người dùng chủ động bật 1 provider cloud thật.
async function loadProviders(): Promise<StorageProvider[]> {
  const { googleDriveProvider } = await import("./providers/google-drive");
  return [localStorageProvider, googleDriveProvider];
}

// Chọn provider lưu trữ đang bật trong Cài đặt (kind "STORAGE"). Nếu
// không có provider cloud nào bật, mặc định dùng local.
export async function getStorageProvider(): Promise<StorageProvider> {
  const providers = await loadProviders();
  for (const provider of providers) {
    if (provider.id === "local") continue; // xét cloud trước, local là fallback cuối
    const row = await prisma.apiProvider.findFirst({
      where: { kind: "STORAGE", name: provider.name, enabled: true },
    });
    if (row) return provider;
  }
  return localStorageProvider;
}

// Dùng ngay sau khi cào dữ liệu (trước khi lưu DB) — với provider local
// thì không làm gì (trả nguyên link gốc, y hệt hành vi cũ). Với provider
// cloud: tải từng ảnh về rồi lưu qua provider đó, ảnh nào lỗi thì GIỮ
// LẠI link gốc thay vì làm hỏng cả listing.
export async function saveScrapedImages(images: ScrapedImage[]): Promise<ScrapedImage[]> {
  const provider = await getStorageProvider();
  if (provider.id === "local") return images;

  return Promise.all(
    images.map(async (img) => {
      try {
        const newUrl = await provider.saveImage(img.url, `${crypto.randomUUID()}`);
        return { ...img, url: newUrl };
      } catch (err) {
        console.error(`Lưu ảnh qua ${provider.name} thất bại, giữ link gốc:`, img.url, err);
        return img;
      }
    })
  );
}
