// API: POST /api/listings/[id]/images — thêm 1 ảnh (đã upload xong,
// đã có url) vào listing. Dùng sau khi gọi /api/uploads thành công,
// hoặc khi người dùng dán thẳng URL ảnh có sẵn.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";

const schema = z.object({
  url: z.string().min(1),
  // Tên file dưới public/uploads/ nếu ảnh vừa lưu local (xem POST
  // /api/uploads) — cho phép runDriveSyncSweep() tìm thấy để đồng bộ Drive
  // ở nền sau này. Dán thẳng URL ảnh có sẵn (không qua /api/uploads) thì
  // để trống, không sao — ảnh đó không có bản local để đồng bộ.
  localPath: z.string().optional(),
  kind: z.enum(["MAIN", "GALLERY", "DESCRIPTION"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const sortOrder = await prisma.listingImage.count({
    where: { listingId: Number(id), kind: parsed.data.kind },
  });

  const image = await prisma.listingImage.create({
    data: {
      listingId: Number(id),
      url: parsed.data.url,
      localPath: parsed.data.localPath,
      kind: parsed.data.kind,
      sortOrder,
    },
  });

  await logActivity("image.add", `Thêm ảnh (${parsed.data.kind}) cho link #${id}`);
  return NextResponse.json(image, { status: 201 });
}
