// API: POST /api/settings/drive-sync/import — ghi CHỈ những trường người
// dùng đã tự chọn áp dụng, từ 1 snapshot đã xem trước (tải từ Drive hoặc
// dán tay — xem src/lib/settings-sync/index.ts). Không có gì tự động/ngầm
// định — client phải gửi rõ danh sách field đã tick chọn.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/log";
import { applySettingsSnapshot, type SettingsSnapshot } from "@/lib/settings-sync";

const schema = z.object({
  snapshot: z.object({
    version: z.literal(1),
    settings: z.record(z.string(), z.string()),
    providers: z.array(
      z.object({
        name: z.string(),
        apiKey: z.string().nullable(),
        baseUrl: z.string().nullable(),
        enabled: z.boolean(),
      })
    ),
    driveClient: z.object({ clientId: z.string(), clientSecret: z.string() }).nullable(),
  }),
  settingKeys: z.array(z.string()),
  providerNames: z.array(z.string()),
  applyDriveClient: z.boolean(),
});

export async function POST(request: NextRequest) {
  const { forbidden } = await requireAdmin();
  if (forbidden) return forbidden;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await applySettingsSnapshot(parsed.data.snapshot as SettingsSnapshot, {
    settingKeys: parsed.data.settingKeys,
    providerNames: parsed.data.providerNames,
    applyDriveClient: parsed.data.applyDriveClient,
  });

  await logActivity(
    "settings.drive_sync_import",
    `Nhập Cài đặt: ${parsed.data.settingKeys.length} mục cài đặt, ${parsed.data.providerNames.length} API key${parsed.data.applyDriveClient ? ", cấu hình OAuth Drive" : ""}`
  );
  return NextResponse.json({ ok: true });
}
