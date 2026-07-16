// API: GET (poll trạng thái) cho 1 bản so sánh cụ thể — xem
// src/app/api/compare/route.ts để biết cách 1 bản được tạo
// (PENDING -> DONE/FAILED chạy nền).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
