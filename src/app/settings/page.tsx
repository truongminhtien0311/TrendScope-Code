// ============================================================
// TRANG CÀI ĐẶT — theo mindmap:
//   Giao diện · API (bật/tắt từng bên) · Lưu trữ · Bảo mật · Tỷ giá
// Các mục chưa làm được đánh dấu rõ để bổ sung ở giai đoạn sau.
// ============================================================
import { prisma } from "@/lib/db";
import { getCnyVndRate, getUsdCnyRate } from "@/lib/currency";
import { DEFAULT_PROMPT_TEMPLATE, DEFAULT_COST_ASSUMPTIONS, type CostAssumptions } from "@/lib/llm";
import ProviderRow from "@/components/ProviderRow";
import RateForm from "@/components/RateForm";
import PromptEditor from "@/components/PromptEditor";
import CostAssumptionsForm from "@/components/CostAssumptionsForm";
import TaobaoLoginPanel from "@/components/TaobaoLoginPanel";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  SCRAPER_RETAIL: "Cào dữ liệu shop bán lẻ (Taobao, Tmall, JD)",
  SCRAPER_MANUFACTURER: "Cào dữ liệu nhà sản xuất (Alibaba, 1688)",
  LLM: "AI tổng hợp mô tả (LLM)",
  STORAGE: "Lưu trữ cloud",
};

export default async function SettingsPage() {
  const [providers, rate, usdRate, promptSetting, costSetting] = await Promise.all([
    prisma.apiProvider.findMany({ orderBy: [{ kind: "asc" }, { id: "asc" }] }),
    getCnyVndRate(),
    getUsdCnyRate(),
    prisma.setting.findUnique({ where: { key: "ai_prompt_template" } }),
    prisma.setting.findUnique({ where: { key: "business_cost_assumptions" } }),
  ]);

  let costAssumptions: CostAssumptions = DEFAULT_COST_ASSUMPTIONS;
  if (costSetting?.value) {
    try {
      const parsed = JSON.parse(costSetting.value);
      if (Array.isArray(parsed)) costAssumptions = parsed;
    } catch {
      // JSON hỏng thì dùng mặc định
    }
  }

  // Gom provider theo nhóm để hiển thị
  const grouped = new Map<string, typeof providers>();
  for (const p of providers) {
    if (!grouped.has(p.kind)) grouped.set(p.kind, []);
    grouped.get(p.kind)!.push(p);
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-2xl font-bold">Cài đặt</h1>

      {/* ---- Giao diện ---- */}
      <Section title="🎨 Giao diện">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Dark/Light mode: dùng nút gạt ở góc dưới sidebar.
        </p>
        <p className="text-sm text-slate-400 mt-1">
          🔜 Theme màu tùy chỉnh độ tương phản cao — làm ở giai đoạn sau.
        </p>
      </Section>

      {/* ---- Tỷ giá ---- */}
      <Section title="💱 Tỷ giá quy đổi">
        <div className="space-y-3">
          <RateForm settingKey="cny_vnd_rate" currentRate={rate} fromLabel="CNY" toLabel="VNĐ" />
          <RateForm settingKey="usd_cny_rate" currentRate={usdRate} fromLabel="USD" toLabel="CNY" />
        </div>
        <p className="text-xs text-slate-400 mt-2">
          CNY→VNĐ dùng để hiển thị giá VNĐ toàn app. USD→CNY dùng khi nhập tay giá
          bằng USD (form nhập tay sẽ tự quy đổi về CNY để lưu).
          🔜 Tự động cập nhật tỷ giá theo ngày — làm ở giai đoạn sau.
        </p>
      </Section>

      {/* ---- API ---- */}
      <Section title="🔌 API bên thứ ba">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Bật/tắt từng nhà cung cấp. Provider không phải Mock có nút &quot;Cấu hình&quot;
          để nhập API key. Bật key sai/rỗng cho provider chưa tích hợp thật sẽ làm
          cào dữ liệu lỗi — cứ để &quot;Mock&quot; bật cho tới khi có key thật.
        </p>
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
                    isMock={p.name.startsWith("Mock")}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* ---- Prompt AI ---- */}
      <Section title="📝 Prompt gửi AI (mô tả sản phẩm + tệp khách hàng)">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
          Tùy chỉnh nội dung yêu cầu gửi cho AI — mỗi người cần khai thác dữ liệu
          khác nhau, không nhất thiết chạy theo mẫu có sẵn.
        </p>
        <PromptEditor
          currentValue={promptSetting?.value ?? DEFAULT_PROMPT_TEMPLATE}
          defaultValue={DEFAULT_PROMPT_TEMPLATE}
        />
      </Section>

      {/* ---- Giả định chi phí kinh doanh ---- */}
      <Section title="💰 Giả định chi phí kinh doanh (cho mục Đánh giá khả thi)">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
          Phí sàn/ads/affiliate hay thay đổi theo thời gian — sửa số ở đây, AI sẽ tự
          dùng số mới nhất để bóc tách chi phí ẩn và tính giá bán khả thi, không cần
          sửa prompt.
        </p>
        <CostAssumptionsForm current={costAssumptions} />
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

      {/* ---- Lưu trữ ---- */}
      <Section title="💾 Lưu trữ">
        <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
          <li>
            <strong>Local:</strong> database SQLite + ảnh lưu trên máy này.
          </li>
          <li className="text-slate-400">
            🔜 Đăng nhập Google Drive / Lark để đồng bộ — làm ở giai đoạn sau
            (bật/tắt ở mục API phía trên).
          </li>
        </ul>
      </Section>

      {/* ---- Bảo mật ---- */}
      <Section title="🔐 Bảo mật">
        <p className="text-sm text-slate-400">
          🔜 Đăng nhập tài khoản/mật khẩu cho team + chia sẻ qua Cloudflare Tunnel —
          làm ở giai đoạn sau (xem docs/04-lo-trinh.md).
        </p>
      </Section>
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
