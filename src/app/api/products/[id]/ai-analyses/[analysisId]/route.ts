// API: GET (poll trạng thái) / PATCH (sửa tay nội dung) cho 1 bản phân
// tích AI cụ thể — xem src/app/api/products/[id]/analyze/route.ts để
// biết cách 1 bản được tạo (PENDING -> DONE/FAILED chạy nền).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";

// GET nhẹ, chỉ trả trạng thái + mốc thời gian — client dùng để poll biết
// khi nào bản PENDING chuyển xong, KHÔNG trả 7 nội dung (client đã có sẵn
// từ SSR, chỉ cần router.refresh() khi status đổi).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; analysisId: string }> }
) {
  const { analysisId } = await params;
  const analysis = await prisma.productAiAnalysis.findUnique({
    where: { id: Number(analysisId) },
    select: { id: true, status: true, startedAt: true, finishedAt: true, errorMessage: true },
  });
  if (!analysis) {
    return NextResponse.json({ error: "Không tìm thấy bản phân tích" }, { status: 404 });
  }
  return NextResponse.json(analysis);
}

const patchSchema = z.object({
  aiSummary: z.string().nullable().optional(),
  aiAudience: z.string().nullable().optional(),
  aiChannels: z.string().nullable().optional(),
  aiCustomization: z.string().nullable().optional(),
  aiImportInfo: z.string().nullable().optional(),
  aiShipping: z.string().nullable().optional(),
  aiFeasibility: z.string().nullable().optional(),
});

// Sửa tay nội dung 1 bản đã DONE — chỉ có ý nghĩa với bản đã xong, bản
// PENDING/FAILED chưa có nội dung để sửa.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; analysisId: string }> }
) {
  const { id, analysisId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await prisma.productAiAnalysis.findUnique({ where: { id: Number(analysisId) } });
  if (!existing || existing.productId !== Number(id)) {
    return NextResponse.json({ error: "Không tìm thấy bản phân tích" }, { status: 404 });
  }
  if (existing.status !== "DONE") {
    return NextResponse.json({ error: "Chỉ sửa được bản đã tạo xong." }, { status: 400 });
  }

  const updated = await prisma.productAiAnalysis.update({
    where: { id: existing.id },
    data: parsed.data,
  });
  await logActivity(
    "product.ai_analyze_edit",
    `Sửa tay phân tích AI #${existing.id} của sản phẩm #${id}`,
    undefined,
    Number(id)
  );
  return NextResponse.json(updated);
}

// Xóa 1 bản phân tích — chỉ cho xóa bản FAILED (bản lỗi chỉ để tham khảo
// nhanh, không ai cần giữ lại làm rác danh sách). Bản DONE/PENDING không
// xóa qua đây để tránh mất dữ liệu quý hoặc xóa nhầm bản đang chạy.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; analysisId: string }> }
) {
  const { id, analysisId } = await params;
  const existing = await prisma.productAiAnalysis.findUnique({ where: { id: Number(analysisId) } });
  if (!existing || existing.productId !== Number(id)) {
    return NextResponse.json({ error: "Không tìm thấy bản phân tích" }, { status: 404 });
  }
  if (existing.status !== "FAILED") {
    return NextResponse.json({ error: "Chỉ xóa được bản bị lỗi." }, { status: 400 });
  }

  await prisma.productAiAnalysis.delete({ where: { id: existing.id } });
  await logActivity(
    "product.ai_analyze_delete_failed",
    `Xóa bản phân tích AI lỗi #${existing.id} của sản phẩm #${id}`,
    undefined,
    Number(id)
  );
  return NextResponse.json({ ok: true });
}
