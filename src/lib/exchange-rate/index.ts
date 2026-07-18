// ============================================================
// TỰ ĐỘNG CẬP NHẬT TỶ GIÁ CNY→VNĐ hàng ngày — dùng ExchangeRate-API
// (https://www.exchangerate-api.com), gói Free: 1.500 request/tháng,
// đăng ký email lấy key, KHÔNG tốn phí (app chỉ cần ~1 request/ngày,
// dư dả gấp nhiều lần nhu cầu thật). Endpoint đã test thật:
//   GET https://v6.exchangerate-api.com/v6/{API_KEY}/pair/CNY/VND
//   -> { result: "success", conversion_rate: number, ... }
//
// App chạy như 1 Node process thường trực (không phải serverless — xem
// giải thích trong src/app/api/products/[id]/analyze/route.ts), nên
// dùng setInterval kiểm tra mỗi giờ thay vì cron server riêng (không có
// server chung để đặt cron — mỗi người tự chạy app trên máy mình).
//
// ĐÃ CHỐT: nếu người dùng tự sửa tay "cny_vnd_rate" trong lúc auto đang
// bật, lần tự động tiếp theo VẪN GHI ĐÈ theo lịch — muốn giữ số tự sửa
// thì tắt hẳn tính năng tự động, không có cơ chế "tạm dừng" riêng.
// ============================================================
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/log";

const API_HOST = "v6.exchangerate-api.com";

export const SETTING_KEY_AUTO_ENABLED = "cny_vnd_rate_auto_enabled"; // "true" | "false"
export const SETTING_KEY_UPDATED_AT = "cny_vnd_rate_updated_at"; // ISO date string, lần cập nhật gần nhất (tự động HOẶC tay đều ghi lại)

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // kiểm tra mỗi giờ
const STALE_MS = 24 * 60 * 60 * 1000; // quá 24h kể từ lần cập nhật gần nhất mới gọi API lại

export async function fetchCnyVndRate(apiKey: string): Promise<number> {
  const res = await fetch(`https://${API_HOST}/v6/${apiKey}/pair/CNY/VND`);
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new Error(`ExchangeRate-API trả lỗi HTTP ${res.status}${bodyText ? ": " + bodyText : ""}`);
  }
  const data = (await res.json()) as {
    result: string;
    conversion_rate?: number;
    "error-type"?: string;
  };
  if (data.result !== "success" || typeof data.conversion_rate !== "number") {
    throw new Error(`ExchangeRate-API báo lỗi: ${data["error-type"] ?? JSON.stringify(data)}`);
  }
  return data.conversion_rate;
}

// Gọi API lấy tỷ giá mới nhất + lưu vào Setting — dùng chung cho cả nút
// "Cập nhật ngay" (tay) lẫn job tự động chạy nền.
export async function refreshCnyVndRate(): Promise<number> {
  const provider = await prisma.apiProvider.findFirst({
    where: { kind: "EXCHANGE_RATE", name: "ExchangeRate-API", enabled: true },
  });
  if (!provider?.apiKey) {
    throw new Error("Chưa bật/chưa có API key cho ExchangeRate-API — vào Cài đặt > API để cấu hình.");
  }
  const rate = await fetchCnyVndRate(provider.apiKey);
  const nowIso = new Date().toISOString();
  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: "cny_vnd_rate" },
      update: { value: String(rate) },
      create: { key: "cny_vnd_rate", value: String(rate) },
    }),
    prisma.setting.upsert({
      where: { key: SETTING_KEY_UPDATED_AT },
      update: { value: nowIso },
      create: { key: SETTING_KEY_UPDATED_AT, value: nowIso },
    }),
  ]);
  return rate;
}

// ------------------------------------------------------------
// SCHEDULER — gắn vào globalThis (không phải biến module thường) để né
// bị Next.js dev hot-reload (Turbopack) tạo nhiều setInterval chồng
// nhau mỗi lần code đổi — cùng lý do/pattern đã áp dụng cho phiên chờ
// QR Taobao (xem src/lib/taobao-login/index.ts).
// ------------------------------------------------------------
declare global {
  // eslint-disable-next-line no-var
  var __exchangeRateSchedulerStarted: boolean | undefined;
}

export function ensureExchangeRateSchedulerStarted(): void {
  if (globalThis.__exchangeRateSchedulerStarted) return;
  globalThis.__exchangeRateSchedulerStarted = true;

  const tick = async () => {
    try {
      const enabledSetting = await prisma.setting.findUnique({ where: { key: SETTING_KEY_AUTO_ENABLED } });
      if (enabledSetting?.value !== "true") return;

      const updatedAtSetting = await prisma.setting.findUnique({ where: { key: SETTING_KEY_UPDATED_AT } });
      const lastUpdated = updatedAtSetting ? new Date(updatedAtSetting.value).getTime() : 0;
      if (Date.now() - lastUpdated < STALE_MS) return;

      const rate = await refreshCnyVndRate();
      await logActivity("exchange_rate.auto_update", `Tự động cập nhật tỷ giá CNY→VNĐ = ${rate}`);
    } catch (err) {
      console.error("Tự động cập nhật tỷ giá thất bại:", err);
      await logActivity("exchange_rate.auto_update_failed", `Tự động cập nhật tỷ giá thất bại: ${String(err)}`).catch(
        () => {}
      );
    }
  };

  void tick(); // kiểm tra ngay lúc server khởi động (phòng trường hợp đã quá hạn 24h)
  setInterval(tick, CHECK_INTERVAL_MS);
}
