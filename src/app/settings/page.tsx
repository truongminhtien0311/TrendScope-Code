// ============================================================
// TRANG CÀI ĐẶT — theo mindmap:
//   Giao diện · API (bật/tắt từng bên) · Lưu trữ · Bảo mật · Tỷ giá
// Các mục chưa làm được đánh dấu rõ để bổ sung ở giai đoạn sau.
// ============================================================
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { getCnyVndRate, getUsdCnyRate } from "@/lib/currency";
import {
  DEFAULT_PROMPT_PRESETS,
  DEFAULT_COMPARE_PRESETS,
  DEFAULT_COST_ASSUMPTIONS,
  type PromptPreset,
  type CostAssumptions,
} from "@/lib/llm";
import ProviderRow from "@/components/ProviderRow";
import RateForm from "@/components/RateForm";
import PromptEditor from "@/components/PromptEditor";
import CostAssumptionsForm from "@/components/CostAssumptionsForm";
import TaobaoLoginPanel from "@/components/TaobaoLoginPanel";
import GoogleDriveConnectPanel from "@/components/GoogleDriveConnectPanel";
import BackupPanel from "@/components/BackupPanel";
import SecurityPanel from "@/components/SecurityPanel";
import CopyApiConfigButton from "@/components/CopyApiConfigButton";
import SettingsTabs from "@/components/SettingsTabs";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  SCRAPER_RETAIL: "Cào dữ liệu shop bán lẻ (Taobao, Tmall, JD)",
  SCRAPER_MANUFACTURER: "Cào dữ liệu nhà sản xuất (Alibaba, 1688)",
  LLM: "AI tổng hợp mô tả (LLM)",
  STORAGE: "Lưu trữ cloud",
};

export default async function SettingsPage() {
  const currentUser = await getCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const [providers, rate, usdRate, presetsSetting, activePresetIdSetting, costSetting, comparePresetsSetting, compareActiveSetting] = await Promise.all([
    prisma.apiProvider.findMany({ orderBy: [{ kind: "asc" }, { id: "asc" }] }),
    getCnyVndRate(),
    getUsdCnyRate(),
    prisma.setting.findUnique({ where: { key: "ai_prompt_presets" } }),
    prisma.setting.findUnique({ where: { key: "ai_prompt_active_preset_id" } }),
    prisma.setting.findUnique({ where: { key: "business_cost_assumptions" } }),
    prisma.setting.findUnique({ where: { key: "compare_prompt_presets" } }),
    prisma.setting.findUnique({ where: { key: "compare_prompt_active_preset_id" } }),
  ]);

  let promptPresets: PromptPreset[] = DEFAULT_PROMPT_PRESETS;
  if (presetsSetting?.value) {
    try {
      const parsed = JSON.parse(presetsSetting.value);
      if (Array.isArray(parsed) && parsed.length > 0) promptPresets = parsed;
    } catch {
      // JSON hỏng thì dùng bộ preset mặc định
    }
  }
  const activePresetId = activePresetIdSetting?.value ?? promptPresets[0].id;

  let comparePresets: PromptPreset[] = DEFAULT_COMPARE_PRESETS;
  if (comparePresetsSetting?.value) {
    try {
      const parsed = JSON.parse(comparePresetsSetting.value);
      if (Array.isArray(parsed) && parsed.length > 0) comparePresets = parsed;
    } catch {
      // JSON hỏng thì dùng bộ preset mặc định
    }
  }
  const compareActiveId = compareActiveSetting?.value ?? comparePresets[0].id;

  let costAssumptions: CostAssumptions = DEFAULT_COST_ASSUMPTIONS;
  if (costSetting?.value) {
    try {
      const parsed = JSON.parse(costSetting.value);
      if (Array.isArray(parsed)) costAssumptions = parsed;
    } catch {
      // JSON hỏng thì dùng mặc định
    }
  }

  // Provider Google Drive — parse configJson (clientId/secret/refreshToken)
  const googleDriveProvider = providers.find((p) => p.kind === "STORAGE" && p.name === "Google Drive");
  let googleDriveConfig: {
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
    connectedEmail?: string;
  } = {};
  if (googleDriveProvider?.configJson) {
    try {
      googleDriveConfig = JSON.parse(googleDriveProvider.configJson);
    } catch {
      googleDriveConfig = {};
    }
  }

  // Gom provider theo nhóm để hiển thị
  const grouped = new Map<string, typeof providers>();
  for (const p of providers) {
    if (!grouped.has(p.kind)) grouped.set(p.kind, []);
    grouped.get(p.kind)!.push(p);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Cài đặt</h1>

      <SettingsTabs
        general={
          <>
            {/* ---- Giao diện ---- */}
            <Section title="🎨 Giao diện">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Dark/Light mode: dùng nút gạt ở góc dưới sidebar.
              </p>
            </Section>

            {/* ---- Tỷ giá ---- */}
            <Section title="💱 Tỷ giá quy đổi">
              <div className="space-y-3">
                <RateForm settingKey="cny_vnd_rate" currentRate={rate} fromLabel="CNY" toLabel="VNĐ" isAdmin={isAdmin} />
                <RateForm settingKey="usd_cny_rate" currentRate={usdRate} fromLabel="USD" toLabel="CNY" isAdmin={isAdmin} />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                CNY→VNĐ dùng để hiển thị giá VNĐ toàn app. USD→CNY dùng khi nhập tay giá
                bằng USD (form nhập tay sẽ tự quy đổi về CNY để lưu).
              </p>
            </Section>
          </>
        }
        integrations={
          <>
            {/* ---- API ---- */}
            <Section title="🔌 API bên thứ ba">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Bật/tắt từng nhà cung cấp. Bấm &quot;Cấu hình&quot; để nhập API key. Bật key
                sai/rỗng sẽ làm cào dữ liệu lỗi — chỉ bật khi đã có key thật.
              </p>
              {isAdmin && (
                <div className="mb-4">
                  <CopyApiConfigButton providers={providers} />
                </div>
              )}
              <div className="space-y-5">
                {[...grouped.entries()].map(([kind, list]) => (
                  <div key={kind}>
                    <h3 className="text-sm font-semibold mb-2">{KIND_LABELS[kind] ?? kind}</h3>
                    <ul className="space-y-2">
                      {list.map((p) => (
                        <ProviderRow
                          key={p.id}
                          id={p.id}
                          name={p.name}
                          enabled={p.enabled}
                          apiKey={p.apiKey}
                          baseUrl={p.baseUrl}
                          isAdmin={isAdmin}
                          hasSeparateConfig={p.kind === "STORAGE"}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>

            {/* ---- Lưu trữ ---- */}
            <Section title="💾 Lưu trữ">
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                <strong>Local:</strong> database SQLite + ảnh lưu trên máy này (mặc định).
              </p>
              <Suspense>
                <GoogleDriveConnectPanel
                  providerId={googleDriveProvider?.id ?? 0}
                  clientId={googleDriveConfig.clientId ?? ""}
                  clientSecret={googleDriveConfig.clientSecret ?? ""}
                  connectedEmail={googleDriveConfig.connectedEmail}
                  hasRefreshToken={!!googleDriveConfig.refreshToken}
                  isAdmin={isAdmin}
                />
              </Suspense>
              <p className="text-xs text-slate-400 mt-2">
                Bật provider &quot;Google Drive&quot; ở mục API phía trên để dùng làm nơi lưu ảnh.
              </p>
            </Section>

            {/* ---- Đăng nhập Taobao (giải mã link rút gọn từ mobile) ---- */}
            <Section title="🔑 Đăng nhập Taobao (giải mã link rút gọn từ mobile)">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                Link Taobao copy từ điện thoại thường là link rút gọn (dạng e.tb.cn/...),
                không chứa id sản phẩm. Đăng nhập 1 lần bằng quét mã QR để app tự giải mã
                link rút gọn ra link đầy đủ khi dán vào ô &quot;Dán link&quot; ở trang sản phẩm.
              </p>
              <TaobaoLoginPanel />
            </Section>
          </>
        }
        business={
          <>
            {/* ---- Prompt AI ---- */}
            <Section title="📝 Prompt gửi AI (mô tả sản phẩm + tệp khách hàng)">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                Lưu nhiều bản prompt đặt tên riêng để tự test theo từng hướng khác nhau
                (marketing, pháp lý, phản biện gắt...) thay vì chỉ sửa 1 bản duy nhất.
                Bản đang chọn &quot;dùng khi Tạo bằng AI&quot; sẽ được áp dụng cho lần bấm
                &quot;✨ Tạo bằng AI&quot; tiếp theo ở trang sản phẩm.
              </p>
              <PromptEditor
                presets={promptPresets}
                activePresetId={activePresetId}
                defaultPresets={DEFAULT_PROMPT_PRESETS}
                isAdmin={isAdmin}
              />
            </Section>

            {/* ---- Prompt So sánh Sản phẩm ---- */}
            <Section title="⚖️ Prompt AI So Sánh (C-Level Module)">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                Các kịch bản được thiết kế theo góc nhìn chuyên gia (CFO, COO, CEO...). AI sẽ chạy trên bảng so sánh nhiều sản phẩm.
              </p>
              <PromptEditor
                presets={comparePresets}
                activePresetId={compareActiveId}
                defaultPresets={DEFAULT_COMPARE_PRESETS}
                isAdmin={isAdmin}
                settingKey="compare_prompt_presets"
                activeSettingKey="compare_prompt_active_preset_id"
                placeholders={["{{PRODUCTS_DATA}}", "{{COMPARE_PURPOSE}}"]}
              />
            </Section>

            {/* ---- Giả định chi phí kinh doanh ---- */}
            <Section title="💰 Giả định chi phí kinh doanh (cho mục Đánh giá khả thi)">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                Phí sàn/ads/affiliate hay thay đổi theo thời gian — sửa số ở đây, AI sẽ tự
                dùng số mới nhất để bóc tách chi phí ẩn và tính giá bán khả thi, không cần
                sửa prompt.
              </p>
              <CostAssumptionsForm current={costAssumptions} isAdmin={isAdmin} />
            </Section>
          </>
        }
        security={
          <Section title="🔐 Bảo mật">
            {currentUser && (
              <SecurityPanel
                isAdmin={currentUser.role === "admin"}
                isOwner={currentUser.isOwner}
                currentUserId={currentUser.id}
              />
            )}
            <p className="text-xs text-slate-400 mt-3">
              💡 Muốn dùng chung dữ liệu với máy khác? Xem mục &quot;🔄 Đồng bộ dữ liệu&quot; ở sidebar.
            </p>
          </Section>
        }
        backup={
          <Section title="☁️ Sao lưu dữ liệu">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              Sao lưu toàn bộ database (sản phẩm, link, SKU, ảnh, phân tích AI...) lên
              Google Drive dạng snapshot nén — bấm tay khi cần, không tự động đồng bộ liên
              tục (tránh chụp phải lúc database đang ghi dở). Cần kết nối Google Drive ở mục
              &quot;🔌 API &amp; Kết nối&quot; trước.
            </p>
            <BackupPanel />
          </Section>
        }
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <h2 className="font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}
