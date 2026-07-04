// API: GET /api/backup/list — danh sách bản backup hiện có trên Drive.
import { NextResponse } from "next/server";
import { listBackups } from "@/lib/backup";

export async function GET() {
  try {
    const backups = await listBackups();
    return NextResponse.json({ backups });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
