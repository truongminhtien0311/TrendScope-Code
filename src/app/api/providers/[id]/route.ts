// API: PATCH /api/providers/[id] — bật/tắt hoặc sửa thông tin 1 API provider
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";

const schema = z.object({
  enabled: z.boolean().optional(),
  apiKey: z.string().nullable().optional(),
  baseUrl: z.string().nullable().optional(),
  name: z.string().min(1).optional(),
  // Cấu hình dạng JSON tự do — dùng cho provider cần nhiều hơn 1 khóa bí
  // mật (vd Google Drive: clientId + clientSecret + refreshToken sau khi
  // kết nối OAuth), thay vì chỉ có apiKey/baseUrl.
  configJson: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const provider = await prisma.apiProvider.update({
    where: { id: Number(id) },
    data: parsed.data,
  });

  if (parsed.data.enabled !== undefined) {
    await logActivity(
      "provider.toggle",
      `${parsed.data.enabled ? "Bật" : "Tắt"} API "${provider.name}"`
    );
  } else {
    await logActivity("provider.update", `Sửa API "${provider.name}"`);
  }
  return NextResponse.json(provider);
}
