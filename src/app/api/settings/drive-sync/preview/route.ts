// API: GET /api/settings/drive-sync/preview — tải bản Cài đặt đã lưu trên
// Drive (nếu có) để so sánh với máy này, KHÔNG ghi gì cả. Trả kèm luôn
// snapshot của CHÍNH máy này (mySnapshot) để component vừa dùng để so
// sánh vừa dùng cho ô "copy cấu hình thủ công" (phương án dự phòng — xem
// src/lib/settings-sync/index.ts, chưa kiểm chứng được drive.file scope
// có thấy file giữa 2 phiên OAuth độc lập cùng tài khoản hay không).
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { buildSettingsSnapshot, type SettingsSnapshot } from "@/lib/settings-sync";
import { getAccessToken, ensureRootFolder, findExistingFile, downloadFile } from "@/lib/storage/providers/google-drive";

const FILE_NAME = "settings.json";

export async function GET() {
  const { forbidden } = await requireAdmin();
  if (forbidden) return forbidden;

  const mySnapshot = await buildSettingsSnapshot();

  try {
    const { accessToken, providerId, config } = await getAccessToken();
    const rootFolderId = await ensureRootFolder(providerId, config, accessToken);
    const fileId = await findExistingFile(FILE_NAME, rootFolderId, accessToken);
    if (!fileId) {
      return NextResponse.json({ mySnapshot, driveSnapshot: null });
    }
    const buffer = await downloadFile(fileId, accessToken);
    const driveSnapshot = JSON.parse(buffer.toString("utf-8")) as SettingsSnapshot;
    return NextResponse.json({ mySnapshot, driveSnapshot });
  } catch (err) {
    // Chưa kết nối Drive — vẫn trả về mySnapshot để dùng ô copy thủ công.
    return NextResponse.json({ mySnapshot, driveSnapshot: null, error: String(err) });
  }
}
