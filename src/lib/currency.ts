// Quy đổi và định dạng tiền tệ: Nhân dân tệ (CNY) -> VNĐ, và USD -> CNY
// (khi người dùng nhập tay giá bằng USD/VNĐ thay vì CNY).
// Tỷ giá lưu trong bảng Setting ("cny_vnd_rate", "usd_cny_rate"), sửa
// được ở trang Cài đặt.
import { prisma } from "./db";

export const DEFAULT_CNY_VND_RATE = 3650;
export const DEFAULT_USD_CNY_RATE = 7.2; // 1 USD ≈ 7.2 CNY

export async function getCnyVndRate(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: "cny_vnd_rate" } });
  const rate = row ? Number(row.value) : NaN;
  return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_CNY_VND_RATE;
}

export async function getUsdCnyRate(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: "usd_cny_rate" } });
  const rate = row ? Number(row.value) : NaN;
  return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_USD_CNY_RATE;
}

export function cnyToVnd(priceCny: number, rate: number): number {
  return Math.round(priceCny * rate);
}

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCny(amount: number): string {
  return `¥${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(amount)}`;
}

// Đơn vị người dùng chọn khi nhập tay giá phân loại
export type PriceUnit = "CNY" | "USD" | "VND";

// Quy đổi giá nhập tay (bất kể đơn vị nào) về CNY để lưu DB — schema
// Variant chỉ có 1 cột priceCny, không đổi cấu trúc DB vì việc này.
export function toPriceCny(
  value: number,
  unit: PriceUnit,
  rates: { cnyVndRate: number; usdCnyRate: number }
): number {
  if (unit === "CNY") return value;
  if (unit === "USD") return value * rates.usdCnyRate;
  return value / rates.cnyVndRate; // VND
}
