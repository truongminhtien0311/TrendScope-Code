// API: GET /api/settings (đọc tất cả) · PATCH /api/settings (sửa 1 key)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";

export async function GET() {
  const settings = await prisma.setting.findMany();
  return NextResponse.json(Object.fromEntries(settings.map((s) => [s.key, s.value])));
}

const schema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { key, value } = parsed.data;
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  await logActivity("setting.update", `Đổi cài đặt "${key}" = "${value}"`);
  return NextResponse.json({ ok: true });
}
