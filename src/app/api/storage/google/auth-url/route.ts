// API: GET /api/storage/google/auth-url — trả về link xin quyền Google
// Drive, dùng Client ID đã lưu trong Cài đặt > Lưu trữ. Frontend điều
// hướng thẳng trình duyệt sang link này (không phải fetch JSON).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { buildAuthUrl, GOOGLE_REDIRECT_PATH, type GoogleDriveConfig } from "@/lib/storage/providers/google-drive";

export async function GET(request: NextRequest) {
  const { forbidden } = await requireAdmin();
  if (forbidden) return forbidden;

  const row = await prisma.apiProvider.findFirst({ where: { kind: "STORAGE", name: "Google Drive" } });
  let config: GoogleDriveConfig = {};
  try {
    config = row?.configJson ? JSON.parse(row.configJson) : {};
  } catch {
    config = {};
  }

  if (!config.clientId) {
    return NextResponse.json(
      { error: "Chưa nhập Client ID — điền vào Cài đặt > Lưu trữ trước." },
      { status: 400 }
    );
  }

  const redirectUri = new URL(GOOGLE_REDIRECT_PATH, request.nextUrl.origin).toString();
  const url = buildAuthUrl(config.clientId, redirectUri);
  return NextResponse.json({ url });
}
