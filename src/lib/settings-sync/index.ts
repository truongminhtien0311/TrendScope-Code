// ============================================================
// ĐỒNG BỘ CÀI ĐẶT/API KEY qua Google Drive — CHỈ dùng khi 2 máy đăng nhập
// CÙNG 1 tài khoản Google Drive (khác hẳn "Đồng bộ dữ liệu" ở src/lib/sync/,
// vốn dành cho nhiều người/máy khác nhau qua link chia sẻ công khai).
//
// BẢN ĐẦU TIÊN (v1, phạm vi cố ý đơn giản): CHỈ có 1 luồng "nhập thủ công
// từ Drive/dán tay", LUÔN hiện xem trước từng trường để người dùng tự
// chọn áp dụng — KHÔNG có xử lý xung đột 2 chiều tự động, KHÔNG có gì tự
// động/ngầm định (Setting là dữ liệu dạng "1 giá trị duy nhất", không như
// Product/Listing có thể "cộng thêm" an toàn — đè nhầm sẽ mất cấu hình
// đang dùng mà không ai hay).
//
// AN TOÀN: file lưu trên Drive RIÊNG TƯ (không bao giờ gọi makePublic())
// — chỉ đọc được bởi cùng tài khoản Google đã kết nối app. KHÔNG BAO GIỜ
// mang theo refreshToken/connectedEmail của Google Drive (gắn với phiên
// đăng nhập RIÊNG của từng máy) — chỉ mang clientId/clientSecret (cấu
// hình OAuth Client, giống nhau nếu dùng chung 1 dự án Google Cloud).
// ============================================================
import { prisma } from "@/lib/db";

const SYNCED_SETTING_KEYS = [
  "cny_vnd_rate",
  "usd_cny_rate",
  "ai_prompt_presets",
  "ai_prompt_active_preset_id",
  "business_cost_assumptions",
  "category_markup_ratios",
  "compare_prompt_presets",
  "compare_prompt_active_preset_id",
  "compare_synthesis_prompt_presets",
  "compare_synthesis_prompt_active_preset_id",
] as const;

// Tên phải khớp CHÍNH XÁC ApiProvider.name trong database (xem
// electron/default-providers.json). Google Drive xử lý riêng bên dưới
// (chỉ lấy clientId/clientSecret, không lấy cả configJson).
const SYNCED_PROVIDER_NAMES = [
  "Google Gemini",
  "Grok (xAI)",
  "Otapi - Taobao & Tmall (RapidAPI)",
  "Taobao DataHub (RapidAPI)",
  "Alibaba DataHub (RapidAPI)",
  "ExchangeRate-API",
] as const;

export interface SettingsSnapshotProvider {
  name: string;
  apiKey: string | null;
  baseUrl: string | null;
  enabled: boolean;
}

export interface SettingsSnapshot {
  version: 1;
  settings: Record<string, string>;
  providers: SettingsSnapshotProvider[];
  driveClient: { clientId: string; clientSecret: string } | null;
}

export async function buildSettingsSnapshot(): Promise<SettingsSnapshot> {
  const [settingRows, providerRows, driveProviderRow] = await Promise.all([
    prisma.setting.findMany({ where: { key: { in: [...SYNCED_SETTING_KEYS] } } }),
    prisma.apiProvider.findMany({ where: { name: { in: [...SYNCED_PROVIDER_NAMES] } } }),
    prisma.apiProvider.findFirst({ where: { kind: "STORAGE", name: "Google Drive" } }),
  ]);

  let driveClient: SettingsSnapshot["driveClient"] = null;
  if (driveProviderRow?.configJson) {
    try {
      const config = JSON.parse(driveProviderRow.configJson);
      if (config.clientId && config.clientSecret) {
        driveClient = { clientId: config.clientId, clientSecret: config.clientSecret };
      }
    } catch {
      // configJson hỏng thì bỏ qua, không chặn cả snapshot
    }
  }

  return {
    version: 1,
    settings: Object.fromEntries(settingRows.map((s) => [s.key, s.value])),
    providers: providerRows.map((p) => ({
      name: p.name,
      apiKey: p.apiKey,
      baseUrl: p.baseUrl,
      enabled: p.enabled,
    })),
    driveClient,
  };
}

export interface ApplyFields {
  settingKeys: string[];
  providerNames: string[];
  applyDriveClient: boolean;
}

// Ghi CHỈ những field người dùng đã chọn áp dụng — không bao giờ ghi đè
// âm thầm field nào không được chọn.
export async function applySettingsSnapshot(snapshot: SettingsSnapshot, fields: ApplyFields): Promise<void> {
  for (const key of fields.settingKeys) {
    const value = snapshot.settings[key];
    if (value === undefined) continue;
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }

  for (const name of fields.providerNames) {
    const provider = snapshot.providers.find((p) => p.name === name);
    if (!provider) continue;
    const row = await prisma.apiProvider.findFirst({ where: { name } });
    if (!row) continue;
    await prisma.apiProvider.update({
      where: { id: row.id },
      data: { apiKey: provider.apiKey, baseUrl: provider.baseUrl, enabled: provider.enabled },
    });
  }

  if (fields.applyDriveClient && snapshot.driveClient) {
    const driveRow = await prisma.apiProvider.findFirst({ where: { kind: "STORAGE", name: "Google Drive" } });
    if (driveRow) {
      let config: Record<string, unknown> = {};
      try {
        config = driveRow.configJson ? JSON.parse(driveRow.configJson) : {};
      } catch {
        config = {};
      }
      await prisma.apiProvider.update({
        where: { id: driveRow.id },
        data: {
          configJson: JSON.stringify({
            ...config,
            clientId: snapshot.driveClient.clientId,
            clientSecret: snapshot.driveClient.clientSecret,
          }),
        },
      });
    }
  }
}
