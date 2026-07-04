// API: POST /api/backup/create — sao lưu database lên Google Drive
// ngay lập tức (snapshot 1 lần, không đồng bộ liên tục).
import { NextResponse } from "next/server";
import { createBackup } from "@/lib/backup";
import { logActivity } from "@/lib/log";

export async function POST() {
  try {
    const info = await createBackup();
    await logActivity("backup.create", `Sao lưu database lên Google Drive: ${info.name}`);
    return NextResponse.json(info);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
