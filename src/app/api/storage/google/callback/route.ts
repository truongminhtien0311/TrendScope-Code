// API: GET /api/storage/google/callback — Google chuyển hướng về đây
// sau khi người dùng đồng ý cấp quyền, kèm ?code=... Đổi code lấy
// refresh_token rồi lưu vào ApiProvider.configJson, sau đó điều hướng
// người dùng về lại trang Cài đặt.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/log";
import {
  exchangeCodeForTokens,
  fetchConnectedEmail,
  getRedirectUri,
  type GoogleDriveConfig,
} from "@/lib/storage/providers/google-drive";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const errorParam = request.nextUrl.searchParams.get("error");
  const settingsUrl = new URL("/settings", request.nextUrl.origin);

  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    settingsUrl.searchParams.set("google_drive_error", "Chỉ admin được kết nối Google Drive");
    return NextResponse.redirect(settingsUrl);
  }

  if (errorParam) {
    settingsUrl.searchParams.set("google_drive_error", errorParam);
    return NextResponse.redirect(settingsUrl);
  }
  if (!code) {
    settingsUrl.searchParams.set("google_drive_error", "Thiếu mã xác thực từ Google");
    return NextResponse.redirect(settingsUrl);
  }

  const row = await prisma.apiProvider.findFirst({ where: { kind: "STORAGE", name: "Google Drive" } });
  let config: GoogleDriveConfig = {};
  try {
    config = row?.configJson ? JSON.parse(row.configJson) : {};
  } catch {
    config = {};
  }
  if (!row || !config.clientId || !config.clientSecret) {
    settingsUrl.searchParams.set("google_drive_error", "Chưa có Client ID/Secret khi xử lý callback");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const { accessToken, refreshToken } = await exchangeCodeForTokens(
      code,
      config.clientId,
      config.clientSecret,
      getRedirectUri()
    );
    const connectedEmail = await fetchConnectedEmail(accessToken);

    const newConfig: GoogleDriveConfig = {
      ...config,
      // Google chỉ trả refresh_token ở lần đồng ý ĐẦU TIÊN (hoặc khi ép
      // prompt=consent như code đang làm) — giữ lại token cũ nếu lần
      // này không có để tránh mất kết nối.
      refreshToken: refreshToken ?? config.refreshToken,
      connectedEmail,
    };
    await prisma.apiProvider.update({
      where: { id: row.id },
      data: { configJson: JSON.stringify(newConfig), enabled: true },
    });
    await logActivity("storage.google_drive_connect", `Kết nối Google Drive (${connectedEmail ?? "?"})`);

    settingsUrl.searchParams.set("google_drive_connected", "1");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    settingsUrl.searchParams.set("google_drive_error", String(err));
    return NextResponse.redirect(settingsUrl);
  }
}
