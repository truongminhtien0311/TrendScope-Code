// API: GET /api/sessions/[sessionId] — chi tiết 1 phiên đánh giá, dùng cho
// trang /compare/session/[sessionId] tự hydrate lại state khi F5/mở lại.
// PATCH /api/sessions/[sessionId] — đổi tên phiên (đặt lại "" để xóa tên,
// quay về hiển thị mặc định "Phiên #N").
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await prisma.evaluationSession.findUnique({
    where: { id: Number(sessionId) },
    include: {
      comparisons: { orderBy: { startedAt: "asc" } },
      scores: true,
    },
  });
  if (!session) {
    return NextResponse.json({ error: "Không tìm thấy phiên đánh giá" }, { status: 404 });
  }
  return NextResponse.json(session);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = await request.json().catch(() => ({}));
  const name: string | null = typeof body?.name === "string" ? body.name.trim() || null : null;

  const existing = await prisma.evaluationSession.findUnique({ where: { id: Number(sessionId) } });
  if (!existing) {
    return NextResponse.json({ error: "Không tìm thấy phiên đánh giá" }, { status: 404 });
  }

  const session = await prisma.evaluationSession.update({
    where: { id: Number(sessionId) },
    data: { name },
  });

  await logActivity("session.rename", `Đổi tên phiên đánh giá #${session.id} thành "${name ?? ""}"`);

  return NextResponse.json({ id: session.id, name: session.name });
}
