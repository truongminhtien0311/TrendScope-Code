// API: PATCH (đổi kind) / DELETE cho 1 ảnh cụ thể
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";
import { deleteOrphanedLocalFiles } from "@/lib/storage/cleanup";

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

  // Dọn file local nếu không còn dòng ListingImage/ReviewImage nào khác
  // tham chiếu — dùng localPath (không phải url), vì ảnh đã đồng bộ Drive
  // vẫn còn giữ bản local làm dự phòng (localPath khác null dù url đã là
  // link Drive) — xem src/lib/storage/index.ts.
  await deleteOrphanedLocalFiles([image.localPath]);

  await logActivity("image.delete", `Xóa ảnh #${id}`);
  return NextResponse.json({ ok: true });
}
