// API: GET (poll trạng thái) / DELETE (xóa bản lỗi) cho 1 bản so sánh cụ
// thể — xem src/app/api/compare/route.ts để biết cách 1 bản được tạo
// (PENDING -> DONE/FAILED chạy nền).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ comparisonId: string }> }
) {
  const { comparisonId } = await params;
  const comparison = await prisma.productComparison.findUnique({
    where: { id: Number(comparisonId) },
    select: {
      id: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      errorMessage: true,
      resultMarkdown: true,
      presetName: true,
      sourceComparisonIds: true,
    },
  });
  if (!comparison) {
    return NextResponse.json({ error: "Không tìm thấy bản so sánh" }, { status: 404 });
  }
  return NextResponse.json(comparison);
}

// Xóa 1 lượt so sánh — chỉ cho xóa bản FAILED, tránh xóa nhầm bản đã xong
// hoặc đang chạy nền.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ comparisonId: string }> }
) {
  const { comparisonId } = await params;
  const existing = await prisma.productComparison.findUnique({ where: { id: Number(comparisonId) } });
  if (!existing) {
    return NextResponse.json({ error: "Không tìm thấy bản so sánh" }, { status: 404 });
  }
  if (existing.status !== "FAILED") {
    return NextResponse.json({ error: "Chỉ xóa được bản bị lỗi." }, { status: 400 });
  }

  await prisma.productComparison.delete({ where: { id: existing.id } });
  await logActivity(
    "compare.delete_failed",
    `Xóa lượt so sánh AI lỗi #${existing.id}`,
    undefined,
    undefined
  );
  return NextResponse.json({ ok: true });
}
