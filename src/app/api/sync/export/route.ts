// API: POST /api/sync/export — xuất toàn bộ dữ liệu (JSON đầy đủ, không
// phải CSV báo cáo — xem /api/export) lên Google Drive của người đang
// dùng, trả về link chia sẻ để gửi cho chủ app đồng bộ về.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/log";
import { buildSyncPayload } from "@/lib/sync";
import {
  getAccessToken,
  ensureNamedFolder,
  uploadBuffer,
  makePublic,
} from "@/lib/storage/providers/google-drive";

const SYNC_FOLDER_NAME = "sync-exports";

export async function POST() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { payload, localImageWarningCount } = await buildSyncPayload();
  const json = JSON.stringify(payload, null, 2);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `sync-${stamp}.json`;

  try {
    const { accessToken, providerId, config } = await getAccessToken();
    const folderId = await ensureNamedFolder(providerId, config, accessToken, SYNC_FOLDER_NAME, "syncExportsFolderId");
    const fileId = await uploadBuffer(Buffer.from(json, "utf-8"), fileName, "application/json", folderId, accessToken);
    await makePublic(fileId, accessToken);

    const url = `https://drive.google.com/file/d/${fileId}/view`;
    const fromLabel = payload.exportedFrom ? ` từ "${payload.exportedFrom}"` : "";
    await logActivity(
      "sync.export",
      `Xuất ${payload.products.length} sản phẩm lên Drive${fromLabel}: ${fileName}`,
      currentUser.id
    );

    return NextResponse.json({ url, productCount: payload.products.length, localImageWarningCount });
  } catch (err) {
    return NextResponse.json(
      { error: "Chưa kết nối Google Drive hoặc lỗi khi tải lên — vào Cài đặt > Lưu trữ để kết nối trước: " + String(err) },
      { status: 400 }
    );
  }
}
