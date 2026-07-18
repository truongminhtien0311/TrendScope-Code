// API: GET /api/sync/status — trạng thái đồng bộ ảnh lên Drive + vài chỉ
// số kho dữ liệu (số phân tích AI, dung lượng database) cho khung hiển thị
// trực quan (SyncStatusPanel.tsx) — chỉ đọc, an toàn gọi liên tục (poll).
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSyncStatus } from "@/lib/storage/sync-status";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  return NextResponse.json(await getSyncStatus());
}
