"use client";

// Đồng bộ Cài đặt/API key qua Google Drive — CHỈ nên dùng khi 2 máy đăng
// nhập CÙNG 1 tài khoản Drive (khác "🔄 Đồng bộ dữ liệu", dành cho nhiều
// người/máy khác nhau). Luôn xem trước từng trường, tự tick chọn áp dụng
// — không có gì tự động/ngầm định (xem src/lib/settings-sync/index.ts).
//
// Có ô "dán cấu hình thủ công" làm phương án dự phòng — vì chưa kiểm
// chứng được cơ chế tự phát hiện qua Drive có hoạt động đúng giữa 2 phiên
// đăng nhập độc lập cùng tài khoản hay không.
import { useState } from "react";
import { toast } from "sonner";

interface SettingsSnapshotProvider {
  name: string;
  apiKey: string | null;
  baseUrl: string | null;
  enabled: boolean;
}
interface SettingsSnapshot {
  version: 1;
  settings: Record<string, string>;
  providers: SettingsSnapshotProvider[];
  driveClient: { clientId: string; clientSecret: string } | null;
}

const SETTING_LABELS: Record<string, string> = {
  cny_vnd_rate: "Tỷ giá CNY→VNĐ",
  usd_cny_rate: "Tỷ giá USD→CNY",
  ai_prompt_presets: "Các preset Prompt AI phân tích",
  ai_prompt_active_preset_id: "Preset AI đang dùng mặc định",
  business_cost_assumptions: "Giả định chi phí kinh doanh",
  category_markup_ratios: "Tỷ lệ markup theo ngành hàng",
  compare_prompt_presets: "Các preset Prompt So sánh",
  compare_prompt_active_preset_id: "Preset So sánh đang dùng mặc định",
  compare_synthesis_prompt_presets: "Các preset Tổng hợp hội đồng",
  compare_synthesis_prompt_active_preset_id: "Preset Tổng hợp đang dùng mặc định",
};

function maskKey(key: string | null): string {
  if (!key) return "(chưa có)";
  return key.length <= 6 ? "••••" : `${key.slice(0, 3)}···${key.slice(-3)}`;
}

export default function SettingsDriveSyncPanel() {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [mySnapshot, setMySnapshot] = useState<SettingsSnapshot | null>(null);
  const [incoming, setIncoming] = useState<SettingsSnapshot | null>(null);
  const [driveHadFile, setDriveHadFile] = useState<boolean | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [selectedSettingKeys, setSelectedSettingKeys] = useState<Set<string>>(new Set());
  const [selectedProviderNames, setSelectedProviderNames] = useState<Set<string>>(new Set());
  const [applyDriveClient, setApplyDriveClient] = useState(false);
  const [error, setError] = useState("");

  async function checkDrive() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/settings/drive-sync/preview").catch(() => null);
    setLoading(false);
    if (!res?.ok) {
      setError("Không kiểm tra được — xem đã kết nối Google Drive ở mục Lưu trữ chưa.");
      return;
    }
    const data = await res.json();
    setMySnapshot(data.mySnapshot);
    setDriveHadFile(!!data.driveSnapshot);
    if (data.driveSnapshot) setIncoming(data.driveSnapshot);
  }

  async function pushToDrive() {
    setExporting(true);
    setError("");
    const res = await fetch("/api/settings/drive-sync/export", { method: "POST" });
    setExporting(false);
    if (res.ok) {
      toast.success("Đã lưu Cài đặt hiện tại lên Drive (riêng tư).");
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Lưu lên Drive thất bại.");
    }
  }

  async function copySnapshot() {
    if (!mySnapshot) {
      await checkDrive();
    }
    if (mySnapshot) {
      await navigator.clipboard.writeText(JSON.stringify(mySnapshot));
      toast.success("Đã copy — dán sang máy kia vào ô bên dưới.");
    }
  }

  function previewFromPaste() {
    try {
      const parsed = JSON.parse(pasteText);
      if (parsed?.version !== 1) throw new Error("Sai định dạng");
      setIncoming(parsed);
      setError("");
    } catch {
      setError("Nội dung dán không đúng định dạng — kiểm tra đã copy đủ chưa.");
    }
  }

  function toggleSetting(key: string) {
    setSelectedSettingKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleProvider(name: string) {
    setSelectedProviderNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function applySelected() {
    if (!incoming) return;
    setImporting(true);
    setError("");
    const res = await fetch("/api/settings/drive-sync/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshot: incoming,
        settingKeys: [...selectedSettingKeys],
        providerNames: [...selectedProviderNames],
        applyDriveClient,
      }),
    });
    setImporting(false);
    if (res.ok) {
      toast.success("Đã áp dụng các mục đã chọn.");
      setIncoming(null);
      setSelectedSettingKeys(new Set());
      setSelectedProviderNames(new Set());
      setApplyDriveClient(false);
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Áp dụng thất bại.");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Chỉ nên dùng khi máy này và máy kia đăng nhập <strong>CÙNG 1 tài khoản Google Drive</strong>.
        Mang theo tỷ giá, prompt AI, API key... — luôn hiện xem trước, bạn tự chọn từng mục muốn áp
        dụng, không có gì tự động ghi đè.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={checkDrive}
          disabled={loading}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "Đang kiểm tra..." : "🔍 Kiểm tra Drive có sẵn cấu hình không"}
        </button>
        <button
          onClick={pushToDrive}
          disabled={exporting}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          {exporting ? "Đang lưu..." : "📤 Lưu cấu hình máy này lên Drive"}
        </button>
        <button
          onClick={copySnapshot}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          📋 Copy cấu hình máy này (dán thủ công sang máy khác)
        </button>
      </div>

      {driveHadFile === false && (
        <p className="text-xs text-slate-400">Chưa có cấu hình nào được lưu trên Drive này.</p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
          Hoặc dán cấu hình đã copy từ máy khác vào đây (phương án dự phòng nếu Drive không tự thấy):
        </p>
        <div className="flex gap-2">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={2}
            placeholder="Dán JSON đã copy ở đây..."
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono"
          />
          <button
            onClick={previewFromPaste}
            disabled={!pasteText.trim()}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 shrink-0 self-start"
          >
            Xem trước
          </button>
        </div>
      </div>

      {incoming && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-3">
          <p className="text-sm font-medium">Chọn mục muốn áp dụng vào máy này:</p>

          <div className="space-y-1">
            {Object.entries(incoming.settings).map(([key, value]) => (
              <label key={key} className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selectedSettingKeys.has(key)}
                  onChange={() => toggleSetting(key)}
                />
                <span>
                  <strong>{SETTING_LABELS[key] ?? key}</strong>
                  {mySnapshot && (
                    <>
                      {" "}
                      — hiện tại: <code className="text-slate-500">{(mySnapshot.settings[key] ?? "(trống)").slice(0, 40)}</code>{" "}
                      → Drive/dán: <code className="text-emerald-600 dark:text-emerald-400">{value.slice(0, 40)}</code>
                    </>
                  )}
                </span>
              </label>
            ))}
          </div>

          {incoming.providers.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-800">
              {incoming.providers.map((p) => {
                const mine = mySnapshot?.providers.find((x) => x.name === p.name);
                return (
                  <label key={p.name} className="flex items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={selectedProviderNames.has(p.name)}
                      onChange={() => toggleProvider(p.name)}
                    />
                    <span>
                      <strong>{p.name}</strong> — hiện tại: <code className="text-slate-500">{maskKey(mine?.apiKey ?? null)}</code>{" "}
                      → Drive/dán: <code className="text-emerald-600 dark:text-emerald-400">{maskKey(p.apiKey)}</code>
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {incoming.driveClient && (
            <label className="flex items-start gap-2 text-xs pt-2 border-t border-slate-200 dark:border-slate-800">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={applyDriveClient}
                onChange={(e) => setApplyDriveClient(e.target.checked)}
              />
              <span>
                <strong>Client ID/Secret Google Drive (OAuth)</strong> — chỉ áp dụng nếu 2 máy dùng
                chung 1 dự án Google Cloud, KHÔNG ảnh hưởng tài khoản Drive đang đăng nhập trên máy này.
              </span>
            </label>
          )}

          <button
            onClick={applySelected}
            disabled={
              importing || (selectedSettingKeys.size === 0 && selectedProviderNames.size === 0 && !applyDriveClient)
            }
            className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 text-sm"
          >
            {importing ? "Đang áp dụng..." : "📥 Áp dụng các mục đã chọn"}
          </button>
        </div>
      )}
    </div>
  );
}
