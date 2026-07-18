// API: POST /api/settings/exchange-rate/refresh — gọi ExchangeRate-API
// lấy tỷ giá CNY→VNĐ mới nhất ngay lập tức (nút "🔄 Cập nhật ngay" trong
// Cài đặt), dùng chung logic với job tự động chạy nền (xem
// src/lib/exchange-rate/index.ts).
import { NextResponse } from "next/server";
import { refreshCnyVndRate } from "@/lib/exchange-rate";
import { logActivity } from "@/lib/log";
import { requireAdmin } from "@/lib/auth";

export async function POST() {
  const { forbidden } = await requireAdmin();
  if (forbidden) return forbidden;

  try {
    const rate = await refreshCnyVndRate();
    await logActivity("exchange_rate.manual_update", `Cập nhật tay tỷ giá CNY→VNĐ = ${rate}`);
    return NextResponse.json({ rate });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
