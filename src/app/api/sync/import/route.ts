// API: POST /api/sync/import — nhận link chia sẻ Drive (người dùng khác
// gửi qua chat), tải file JSON đồng bộ về và gộp vào database hiện tại. Chỉ
// CỘNG THÊM dữ liệu mới (xem src/lib/sync/index.ts), không sửa/đè.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/log";
import { extractDriveFileId, importSyncPayload, type SyncPayload } from "@/lib/sync";
import { getAccessToken, downloadFile } from "@/lib/storage/providers/google-drive";

const schema = z.object({
  driveLink: z.string().min(1, "Dán link Drive vào đây"),
});

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const fileId = extractDriveFileId(parsed.data.driveLink);
  if (!fileId) {
    return NextResponse.json({ error: "Không đọc được link Drive — kiểm tra lại link đã dán." }, { status: 400 });
  }

  let payload: SyncPayload;
  try {
    const { accessToken } = await getAccessToken();
    const buffer = await downloadFile(fileId, accessToken);
    const parsedJson = JSON.parse(buffer.toString("utf-8"));
    if (parsedJson?.syncVersion !== 1 || !Array.isArray(parsedJson?.products)) {
      return NextResponse.json({ error: "File không đúng định dạng dữ liệu đồng bộ." }, { status: 400 });
    }
    payload = parsedJson as SyncPayload;
  } catch (err) {
    return NextResponse.json(
      { error: "Không tải được file từ Drive — kiểm tra đã kết nối Google Drive và link còn hợp lệ: " + String(err) },
      { status: 400 }
    );
  }

  const result = await importSyncPayload(payload);
  const fromLabel = payload.exportedFrom ? ` từ "${payload.exportedFrom}"` : "";
  await logActivity(
    "sync.import",
    `Đồng bộ${fromLabel}: thêm ${result.newProducts} sản phẩm mới, ${result.newListings} link mới, ${result.newAnalyses} bản phân tích AI mới`,
    currentUser.id
  );
  return NextResponse.json(result);
}
