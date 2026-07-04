// ============================================================
// LƯU TRỮ ẢNH & DỮ LIỆU (mindmap: Cài đặt > Lưu trữ)
//   - Local: tải ảnh về thư mục trên máy (mặc định trong Documents)
//   - Cloud: Google Drive, Lark... (bật/tắt trong Cài đặt > API)
// Chọn provider đang bật giống hệt cơ chế bên src/lib/scrapers/index.ts
// (getScraperFor) — không tự gọi database trong file provider, bên gọi
// tự tra bảng ApiProvider rồi truyền provider phù hợp ra.
//
// LƯU Ý: route POST /api/uploads (upload ảnh tay từ máy) CHƯA được nối
// qua registry này — vẫn ghi thẳng vào public/uploads/ như cũ. Việc nối
// route đó + luồng cào ảnh tự động qua storage provider thật là việc
// riêng (rủi ro cao hơn vì đụng luồng ảnh đang chạy ổn định), làm sau.
// ============================================================
import { prisma } from "@/lib/db";

export interface StorageProvider {
  id: string; // "local" | "google-drive" | "lark"
  name: string; // phải khớp CHÍNH XÁC với ApiProvider.name trong database
  // Tải ảnh từ url về nơi lưu trữ, trả về đường dẫn/URL mới
  saveImage: (url: string, fileName: string) => Promise<string>;
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
