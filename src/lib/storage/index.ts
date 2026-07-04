// ============================================================
// LƯU TRỮ ẢNH & DỮ LIỆU (mindmap: Cài đặt > Lưu trữ)
//   - Local: tải ảnh về thư mục trên máy (mặc định trong Documents)
//   - Cloud: Google Drive, Lark... (bật/tắt trong Cài đặt > API)
// Hiện là STUB — ảnh đang hiển thị trực tiếp từ link gốc trên sàn.
// Giai đoạn sau sẽ tải ảnh về để không phụ thuộc link Trung Quốc
// (link gốc có thể chết hoặc chặn truy cập từ VN).
// ============================================================

export interface StorageProvider {
  id: string; // "local" | "google-drive" | "lark"
  name: string;
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

// TODO giai đoạn sau: googleDriveProvider, larkProvider (OAuth đăng nhập)
