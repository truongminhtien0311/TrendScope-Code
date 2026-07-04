// API: PATCH (đổi kind) / DELETE cho 1 ảnh cụ thể
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";

const schema = z.object({ kind: z.enum(["MAIN", "GALLERY", "DESCRIPTION"]) });

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
  const image = await prisma.listingImage.update({
    where: { id: Number(id) },
    data: { kind: parsed.data.kind },
  });
  await logActivity("image.update", `Đổi loại ảnh #${id} thành ${parsed.data.kind}`);
  return NextResponse.json(image);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const image = await prisma.listingImage.delete({ where: { id: Number(id) } });

  // Ảnh tải lên local (/uploads/...) thì xóa luôn file thật, tránh rác
  // trên đĩa. Ảnh từ CDN sàn TQ (url đầy đủ https://...) thì bỏ qua.
  if (image.url.startsWith("/uploads/")) {
    const filePath = path.join(process.cwd(), "public", image.url);
    await unlink(filePath).catch(() => {}); // file có thể đã mất, không sao
  }

  await logActivity("image.delete", `Xóa ảnh #${id}`);
  return NextResponse.json({ ok: true });
}
