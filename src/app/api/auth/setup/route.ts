import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const schema = z.object({
  clientId: z.string().min(1, "Thiếu Client ID"),
  clientSecret: z.string().min(1, "Thiếu Client Secret"),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  let provider = await prisma.apiProvider.findFirst({ where: { kind: "STORAGE", name: "Google Drive" } });
  if (!provider) {
    provider = await prisma.apiProvider.create({
      data: { kind: "STORAGE", name: "Google Drive", enabled: true, configJson: "{}" }
    });
  }

  await prisma.apiProvider.update({
    where: { id: provider.id },
    data: { configJson: JSON.stringify({ clientId: parsed.data.clientId.trim(), clientSecret: parsed.data.clientSecret.trim() }), enabled: true },
  });

  return NextResponse.json({ ok: true });
}
