import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, getSession } from "@/lib/auth";
import { logActivity } from "@/lib/log";
import {
  exchangeCodeForTokens,
  fetchGoogleProfile,
  getRedirectUri,
  type GoogleDriveConfig,
} from "@/lib/storage/providers/google-drive";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const errorParam = request.nextUrl.searchParams.get("error");
  
  const currentUser = await getCurrentUser();
  const redirectUrl = new URL(currentUser ? "/settings" : "/", request.nextUrl.origin);

  if (errorParam) {
    redirectUrl.searchParams.set("google_error", errorParam);
    return NextResponse.redirect(redirectUrl);
  }
  if (!code) {
    redirectUrl.searchParams.set("google_error", "Thiếu mã xác thực từ Google");
    return NextResponse.redirect(redirectUrl);
  }

  const row = await prisma.apiProvider.findFirst({ where: { kind: "STORAGE", name: "Google Drive" } });
  let config: GoogleDriveConfig = {};
  try {
    config = row?.configJson ? JSON.parse(row.configJson) : {};
  } catch {
    config = {};
  }

  const clientId = process.env.GOOGLE_CLIENT_ID !== "xxx" ? process.env.GOOGLE_CLIENT_ID : null || config.clientId;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET !== "xxx" ? process.env.GOOGLE_CLIENT_SECRET : null || config.clientSecret;

  if (!clientId || !clientSecret) {
    redirectUrl.searchParams.set("google_error", "Chưa cấu hình Google Client ID/Secret");
    return NextResponse.redirect(redirectUrl);
  }

  if (!row) {
    redirectUrl.searchParams.set("google_error", "Không tìm thấy cấu hình Google Drive trong CSDL");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const { accessToken, refreshToken } = await exchangeCodeForTokens(
      code,
      clientId,
      clientSecret,
      getRedirectUri()
    );
    const profile = await fetchGoogleProfile(accessToken);
    
    if (!profile) {
      redirectUrl.searchParams.set("google_error", "Không lấy được thông tin từ Google");
      return NextResponse.redirect(redirectUrl);
    }

    // 1. Lưu Google Drive tokens
    const newConfig: GoogleDriveConfig = {
      ...config,
      refreshToken: refreshToken ?? config.refreshToken,
      connectedEmail: profile.email,
    };
    await prisma.apiProvider.update({
      where: { id: row.id },
      data: { configJson: JSON.stringify(newConfig), enabled: true },
    });
    
    if (currentUser) {
      await logActivity("storage.google_drive_connect", `Kết nối Google Drive (${profile.email})`);
      redirectUrl.searchParams.set("google_drive_connected", "1");
    } else {
      // 2. Đăng nhập / Đăng ký User
      let user = await prisma.user.findFirst({
        where: {
          OR: [{ googleId: profile.id }, { email: profile.email }]
        }
      });
      
      if (!user) {
        const userCount = await prisma.user.count();
        user = await prisma.user.create({
          data: {
            googleId: profile.id,
            email: profile.email,
            name: profile.name,
            role: userCount === 0 ? "admin" : "member",
            isOwner: userCount === 0
          }
        });
      } else if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: profile.id }
        });
      }
      
      const session = await getSession();
      session.userId = user.id;
      await session.save();
      await logActivity("auth.login", `Đăng nhập Google: ${profile.email}`);
    }

    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    redirectUrl.searchParams.set("google_error", String(err));
    return NextResponse.redirect(redirectUrl);
  }
}
