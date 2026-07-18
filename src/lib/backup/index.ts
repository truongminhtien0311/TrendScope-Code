// ============================================================
// SAO LƯU DATABASE lên Google Drive (Chặng 7 — tách riêng hoàn toàn
// khỏi luồng lưu ảnh, KHÔNG đụng file nào của app hiện tại).
//
// KHÔNG đồng bộ liên tục (database SQLite đang được ghi/đọc liên tục
// lúc app chạy — đồng bộ real-time dễ chụp phải file đang ghi dở, hỏng
// dữ liệu). Thay vào đó: xuất 1 bản snapshot toàn bộ file .db, NÉN GZIP
// (giảm dung lượng đáng kể vì SQLite nén tốt), đẩy lên folder con
// "backups" trong "ProductHunt-DoNotDelete" trên Drive.
//
// TỐI ƯU DUNG LƯỢNG: chỉ giữ lại tối đa MAX_BACKUPS_KEPT bản gần nhất —
// tạo bản mới xong tự xóa bớt bản cũ hơn, tránh phình dung lượng vô hạn
// theo thời gian mà vẫn luôn có đủ các bản backup gần đây.
//
// Dùng lại các hàm helper Drive (ensureNamedFolder/uploadBuffer/...)
// từ src/lib/storage/providers/google-drive.ts thay vì viết lại logic
// gọi REST API Drive lần thứ 2.
// ============================================================
import fs from "node:fs/promises";
import zlib from "node:zlib";
import {
  getAccessToken,
  ensureNamedFolder,
  uploadBuffer,
  listFilesInFolder,
  deleteFile,
} from "@/lib/storage/providers/google-drive";
import { resolveDatabaseFilePath } from "@/lib/paths";

const BACKUPS_FOLDER_NAME = "backups";
const MAX_BACKUPS_KEPT = 10;

function backupFileName(): string {
  // Thay ":" bằng "-" vì 1 số hệ thống file/URL không thích ký tự ":"
  const stamp = new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "");
  return `backup-${stamp}.db.gz`;
}

export interface BackupInfo {
  id: string;
  name: string;
  createdTime: string;
  sizeBytes?: number;
}

// Tạo 1 bản sao lưu mới, upload lên Drive, rồi xóa bớt bản cũ nếu vượt
// quá MAX_BACKUPS_KEPT.
export async function createBackup(): Promise<BackupInfo> {
  const dbBuffer = await fs.readFile(resolveDatabaseFilePath());
  const gzipped = zlib.gzipSync(dbBuffer);

  const { accessToken, providerId, config } = await getAccessToken();
  const backupsFolderId = await ensureNamedFolder(
    providerId,
    config,
    accessToken,
    BACKUPS_FOLDER_NAME,
    "backupsFolderId"
  );

  const fileName = backupFileName();
  const fileId = await uploadBuffer(gzipped, fileName, "application/gzip", backupsFolderId, accessToken);

  // Dọn bớt bản cũ — giữ lại đúng MAX_BACKUPS_KEPT bản gần nhất
  const files = await listFilesInFolder(backupsFolderId, accessToken); // đã sắp createdTime desc
  const toDelete = files.filter((f) => f.id !== fileId).slice(MAX_BACKUPS_KEPT - 1);
  await Promise.all(toDelete.map((f) => deleteFile(f.id, accessToken)));

  return { id: fileId, name: fileName, createdTime: new Date().toISOString(), sizeBytes: gzipped.byteLength };
}

// Danh sách bản backup hiện có trên Drive, mới nhất trước — dùng cho
// UI hiển thị trong Cài đặt.
export async function listBackups(): Promise<BackupInfo[]> {
  const { accessToken, providerId, config } = await getAccessToken();
  if (!config.backupsFolderId) return []; // chưa từng sao lưu lần nào

  const backupsFolderId = await ensureNamedFolder(
    providerId,
    config,
    accessToken,
    BACKUPS_FOLDER_NAME,
    "backupsFolderId"
  );
  const files = await listFilesInFolder(backupsFolderId, accessToken);
  return files.map((f) => ({
    id: f.id,
    name: f.name,
    createdTime: f.createdTime,
    sizeBytes: f.size ? Number(f.size) : undefined,
  }));
}
