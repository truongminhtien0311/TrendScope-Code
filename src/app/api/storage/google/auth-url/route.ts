import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildAuthUrl, getRedirectUri } from "@/lib/storage/providers/google-drive";

export async function GET() {
  const row = await prisma.apiProvider.findFirst({ where: { kind: "STORAGE", name: "Google Drive" } });
  let config: any = {};
  try {
    config = row?.configJson ? JSON.parse(row.configJson) : {};
  } catch {}

  let envClientId = process.env.GOOGLE_CLIENT_ID;
  if (envClientId === "xxx") envClientId = undefined;
  
  const clientId = envClientId || config.clientId;

  if (!clientId) {
    return NextResponse.json({ error: "MISSING_CONFIG" }, { status: 400 });
  }

  const url = buildAuthUrl(clientId, getRedirectUri());
  return NextResponse.json({ url });
}
