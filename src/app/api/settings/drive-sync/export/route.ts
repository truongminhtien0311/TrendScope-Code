// API: POST /api/settings/drive-sync/export — đẩy Cài đặt/API key hiện
// tại lên Google Drive dưới dạng file RIÊNG TƯ (không public) trong folder
// gốc "TrendScope-DoNotDelete" — chỉ máy đăng nhập CÙNG tài khoản Google
// mới đọc lại được. Xem src/lib/settings-sync/index.ts.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/log";
import { buildSettingsSnapshot } from "@/lib/settings-sync";
import { getAccessToken, ensureRootFolder, findExistingFile, uploadBuffer, deleteFile } from "@/lib/storage/providers/google-drive";

const FILE_NAME = "settings.json";

export async function POST() {
  const { forbidden } = await requireAdmin();
  if (forbidden) return forbidden;

  try {
    const snapshot = await buildSettingsSnapshot();
    const json = JSON.stringify(snapshot, null, 2);

    const { accessToken, providerId, config } = await getAccessToken();
    const rootFolderId = await ensureRootFolder(providerId, config, accessToken);
    const oldFileId = await findExistingFile(FILE_NAME, rootFolderId, accessToken);

    // Upload bản mới trước, chỉ xóa bản cũ SAU KHI upload mới thành công —
    // tránh mất trắng nếu crash giữa chừng. KHÔNG gọi makePublic() — file
    // này chỉ đọc được bởi cùng tài khoản Google đã kết nối app.
    await uploadBuffer(Buffer.from(json, "utf-8"), FILE_NAME, "application/json", rootFolderId, accessToken);
    if (oldFileId) await deleteFile(oldFileId, accessToken);

    await logActivity("settings.drive_sync_export", "Đẩy Cài đặt/API key lên Google Drive (riêng tư)");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Chưa kết nối Google Drive hoặc lỗi khi tải lên: " + String(err) },
      { status: 400 }
    );
  }
}
