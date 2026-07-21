"use client";

// Form thêm link sản phẩm — 2 CHẾ ĐỘ, người dùng tự chọn:
//   🔗 Dán link (tự động cào) — hành vi cũ: gọi /api/scrape
//   ✍️ Nhập tay — không gọi API cào, tự gõ toàn bộ dữ liệu.
//      Dùng khi API cào lỗi/hết quota, hoặc nhập tay nhanh hơn tự cào
//      bằng mắt. Người dùng thường CHỈ COPY ĐƯỢC ảnh + text tiếng
//      Trung (không hiểu nghĩa) — để trống ô tiếng Việt cũng được,
//      bản dịch tự điền khi chạy "Phân tích AI" (gộp chung 1 request).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { notifyDone } from "@/lib/notify";
import type { PriceUnit } from "@/lib/currency";
import ElapsedBadge from "@/components/ElapsedBadge";

const PLATFORM_SUGGESTIONS = ["Taobao", "Tmall", "JD.com", "Alibaba.com", "1688.com"];

export default function AddListingForm({ productId }: { productId: number }) {
  const [mode, setMode] = useState<"auto" | "manual">("auto");

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-2">
        <ModeCard
          active={mode === "auto"}
          onClick={() => setMode("auto")}
          icon="🔗"
          title="Dán link"
          desc="Tự động cào dữ liệu từ URL"
        />
        <ModeCard
          active={mode === "manual"}
          onClick={() => setMode("manual")}
          icon="✍️"
          title="Nhập tay"
          desc="Khi API lỗi, hoặc muốn nhanh hơn tự cào"
        />
      </div>
      {mode === "auto" ? <AutoForm productId={productId} /> : <ManualForm productId={productId} />}
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg px-3 py-2 border transition ${
        active
          ? "bg-blue-50 dark:bg-blue-950 border-blue-400 dark:border-blue-700"
          : "border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
      }`}
    >
      <span className="text-sm font-medium">
        {icon} {title}
      </span>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
    </button>
  );
}

// Domain link rút gọn Taobao từ mobile (vd https://e.tb.cn/h.xxxx,
// https://m.tb.cn/..., hoặc dạng trần https://tb.cn/...) — không chứa id
// sản phẩm, cần giải mã qua phiên đăng nhập Taobao trước. Khớp chung
// "tb.cn" (không chỉ "e."/"m.") để không bỏ sót các tiền tố khác.
const SHORT_LINK_PATTERN = /tb\.cn/i;

// Key lưu link đang dán dở vào localStorage, riêng theo từng sản phẩm —
// để lỡ đóng app/tắt máy giữa chừng (kể cả khi đang chờ giải mã link rút
// gọn) thì mở lại vẫn còn nguyên link, không phải dán/giải mã lại từ đầu.
function draftUrlKey(productId: number) {
  return `addListing:draftUrl:${productId}`;
}

function AutoForm({ productId }: { productId: number }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  // Nạp link còn dang dở (nếu có) ngay khi mở form — chạy trên client nên
  // phải dùng useEffect, không đọc localStorage trực tiếp trong useState().
  useEffect(() => {
    const saved = localStorage.getItem(draftUrlKey(productId));
    if (saved) setUrl(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // Lưu lại mỗi khi url đổi (gõ tay, dán, hoặc sau khi giải mã xong) —
  // xóa khỏi localStorage khi ô trống để không tồn đọng rác.
  useEffect(() => {
    if (url) localStorage.setItem(draftUrlKey(productId), url);
    else localStorage.removeItem(draftUrlKey(productId));
  }, [url, productId]);
  const [resolving, setResolving] = useState(false);
  const [resolveStart, setResolveStart] = useState<number | null>(null);
  const [error, setError] = useState("");

  // Đếm giây trôi qua trong lúc chờ giải mã link rút gọn (Playwright mở
  // trình duyệt ẩn, tải trang thật — có thể mất vài giây tới nửa phút) —
  // interval CHỈ chạy khi đang resolving, tự dừng ngay khi xong/lỗi, nên
  // không tốn tài nguyên lúc không có thao tác nào đang chạy.
  const [resolveNow, setResolveNow] = useState(() => Date.now());
  useEffect(() => {
    if (!resolving) return;
    const timer = setInterval(() => setResolveNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resolving]);
  const resolveElapsedSec = resolveStart ? Math.max(0, Math.floor((resolveNow - resolveStart) / 1000)) : 0;

  // Đếm giây trong lúc chờ /api/scrape cào dữ liệu (mở trình duyệt ẩn, tải
  // trang thật — có thể mất vài giây tới cả phút) — cùng cơ chế với
  // resolveElapsedSec ở trên, interval riêng vì 2 thao tác không chạy cùng lúc.
  const [scrapeStart, setScrapeStart] = useState<number | null>(null);
  const [scrapeNow, setScrapeNow] = useState(() => Date.now());
  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => setScrapeNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [loading]);
  const scrapeElapsedSec = scrapeStart ? Math.max(0, Math.floor((scrapeNow - scrapeStart) / 1000)) : 0;

  async function resolveShortLink() {
    setError("");
    setResolving(true);
    setResolveStart(Date.now());
    const res = await fetch("/api/taobao-login/resolve-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
    });
    setResolving(false);
    setResolveStart(null);
    if (res.ok) {
      const { resolvedUrl } = await res.json();
      setUrl(resolvedUrl);
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Giải mã link rút gọn thất bại.");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    // Link rút gọn CHƯA giải mã thì chặn lại thay vì để API tự báo lỗi
    // "Không tách được id" (gây hiểu lầm là link sai hẳn) — hướng đúng
    // người dùng bấm nút "Giải mã link" trước, dễ bị bỏ qua vì nút Thêm
    // link trước đây không bị khoá khi vẫn còn là link rút gọn.
    if (SHORT_LINK_PATTERN.test(url)) {
      setError('Đây vẫn là link rút gọn — bấm "🔓 Giải mã link" trước khi thêm.');
      return;
    }
    setLoading(true);
    setScrapeStart(Date.now());
    setError("");

    const res = await fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, url: url.trim() }),
    });

    setLoading(false);
    setScrapeStart(null);
    if (res.ok) {
      setUrl("");
      notifyDone("Đã cào xong dữ liệu link mới 🎉");
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Cào dữ liệu thất bại, vui lòng thử lại.");
    }
  }

  const isShortLink = SHORT_LINK_PATTERN.test(url);

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Dán link Taobao / Tmall / JD / Alibaba / 1688..."
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
        />
        {isShortLink && (
          <button
            type="button"
            onClick={resolveShortLink}
            disabled={resolving}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm whitespace-nowrap hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
            title="Link rút gọn từ mobile — giải mã ra link đầy đủ trước khi cào"
          >
            {resolving ? (
              <span className="inline-flex items-center gap-1.5">
                Đang giải mã...
                <ElapsedBadge seconds={resolveElapsedSec} />
              </span>
            ) : (
              "🔓 Giải mã link"
            )}
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 text-sm whitespace-nowrap"
        >
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              Đang cào dữ liệu...
              <ElapsedBadge seconds={scrapeElapsedSec} />
            </span>
          ) : (
            "🔗 Thêm link"
          )}
        </button>
      </div>
      {isShortLink && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          ⚠️ Đây là link rút gọn (không có id sản phẩm) — bấm &quot;🔓 Giải mã link&quot;
          trước (cần đăng nhập Taobao ở Cài đặt).
        </p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        💡 Nếu API cào lỗi/hết quota, chuyển sang &quot;✍️ Nhập tay&quot; ở trên.
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        📷 Không có sẵn link? Trong app Taobao, bấm <strong>Chia sẻ</strong> sản phẩm → chọn mã QR
        (&quot;当面扫码&quot;) → quét mã đó bằng Zalo/Camera điện thoại (KHÔNG dùng app Taobao để
        quét chính mã của nó) → copy link <code>e.tb.cn/...</code> vừa ra → dán vào ô trên, xử lý
        y hệt link rút gọn thường.
      </p>
    </form>
  );
}

interface ManualVariant {
  nameOriginal: string;
  nameVi: string;
  price: string;
  priceUnit: PriceUnit;
}

const UNIT_LABEL: Record<PriceUnit, string> = { CNY: "¥ CNY", USD: "$ USD", VND: "đ VNĐ" };

function ManualForm({ productId }: { productId: number }) {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<"RETAIL" | "MANUFACTURER">("RETAIL");
  const [platform, setPlatform] = useState("");
  const [url, setUrl] = useState("");
  const [titleOriginal, setTitleOriginal] = useState("");
  const [titleVi, setTitleVi] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [descriptionOriginal, setDescriptionOriginal] = useState("");
  const [descriptionVi, setDescriptionVi] = useState("");
  const [variants, setVariants] = useState<ManualVariant[]>([
    { nameOriginal: "", nameVi: "", price: "", priceUnit: "CNY" },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateVariant(i: number, patch: Partial<ManualVariant>) {
    setVariants(variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }
  function addVariant() {
    setVariants([...variants, { nameOriginal: "", nameVi: "", price: "", priceUnit: "CNY" }]);
  }
  function removeVariant(i: number) {
    setVariants(variants.filter((_, idx) => idx !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!platform.trim()) return setError("Cần nhập tên sàn/nguồn.");
    if (!url.trim()) return setError("Cần nhập URL hoặc ghi chú nguồn.");

    const cleanedVariants = variants
      .filter((v) => (v.nameOriginal || v.nameVi).trim() && v.price.trim())
      .map((v) => ({
        nameOriginal: (v.nameOriginal || v.nameVi).trim(),
        nameVi: v.nameVi.trim() || undefined,
        price: Number(v.price),
        priceUnit: v.priceUnit,
      }));
    if (cleanedVariants.length === 0) return setError("Cần ít nhất 1 phân loại + giá.");
    if (cleanedVariants.some((v) => !Number.isFinite(v.price) || v.price <= 0)) {
      return setError("Giá phân loại phải là số lớn hơn 0.");
    }

    setLoading(true);
    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        sourceType,
        platform: platform.trim(),
        url: url.trim(),
        titleVi: titleVi.trim() || undefined,
        titleOriginal: titleOriginal.trim() || undefined,
        sellerName: sellerName.trim() || undefined,
        descriptionOriginal: descriptionOriginal.trim() || undefined,
        descriptionVi: descriptionVi.trim() || undefined,
        variants: cleanedVariants,
      }),
    });
    setLoading(false);

    if (res.ok) {
      setSourceType("RETAIL");
      setPlatform("");
      setUrl("");
      setTitleVi("");
      setTitleOriginal("");
      setSellerName("");
      setDescriptionOriginal("");
      setDescriptionVi("");
      setVariants([{ nameOriginal: "", nameVi: "", price: "", priceUnit: "CNY" }]);
      notifyDone("Đã thêm link nhập tay 📝");
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Lưu thất bại, vui lòng thử lại.");
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm";

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <datalist id="platform-suggestions">
        {PLATFORM_SUGGESTIONS.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Nhóm nguồn</label>
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as "RETAIL" | "MANUFACTURER")}
            className={inputClass}
          >
            <option value="RETAIL">🛍️ Shop bán lẻ</option>
            <option value="MANUFACTURER">🏭 Nhà sản xuất</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
            Sàn/nguồn (gõ tự do, có gợi ý)
          </label>
          <input
            list="platform-suggestions"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            placeholder="Taobao, Pinduoduo, chợ offline..."
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
            URL (hoặc ghi chú nguồn nếu không có link)
          </label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} className={inputClass} />
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <label className="block text-xs text-slate-500 dark:text-slate-400">Tên gốc (dán tiếng Trung)</label>
          </div>
          <input value={titleOriginal} onChange={(e) => setTitleOriginal(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Tên tiếng Việt</label>
          <input value={titleVi} onChange={(e) => setTitleVi(e.target.value)} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Tên shop/nhà bán</label>
          <input value={sellerName} onChange={(e) => setSellerName(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Mô tả gốc (dán tiếng Trung)</label>
          <textarea
            value={descriptionOriginal}
            onChange={(e) => setDescriptionOriginal(e.target.value)}
            rows={2}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Mô tả tiếng Việt</label>
          <textarea
            value={descriptionVi}
            onChange={(e) => setDescriptionVi(e.target.value)}
            rows={2}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Phân loại + giá</label>
        <div className="space-y-2">
          {variants.map((v, i) => (
            <div key={i} className="space-y-1.5 rounded-lg border border-slate-200 dark:border-slate-800 p-2">
              <div className="flex items-center gap-1.5">
                <input
                  value={v.nameOriginal}
                  onChange={(e) => updateVariant(i, { nameOriginal: e.target.value })}
                  placeholder="Tên gốc (dán tiếng Trung)"
                  className={`${inputClass} flex-1`}
                />
                <input
                  value={v.nameVi}
                  onChange={(e) => updateVariant(i, { nameVi: e.target.value })}
                  placeholder="Tên tiếng Việt (vd: Đỏ)"
                  className={`${inputClass} flex-1`}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.01"
                  value={v.price}
                  onChange={(e) => updateVariant(i, { price: e.target.value })}
                  placeholder="Giá"
                  className={`${inputClass} w-28`}
                />
                <select
                  value={v.priceUnit}
                  onChange={(e) => updateVariant(i, { priceUnit: e.target.value as PriceUnit })}
                  className={inputClass}
                >
                  {(Object.keys(UNIT_LABEL) as PriceUnit[]).map((u) => (
                    <option key={u} value={u}>
                      {UNIT_LABEL[u]}
                    </option>
                  ))}
                </select>
                {variants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeVariant(i)}
                    className="text-slate-500 dark:text-slate-400 hover:text-red-500 px-1"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addVariant}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
        >
          + Thêm phân loại
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 text-sm"
      >
        {loading ? "Đang lưu..." : "✍️ Lưu link nhập tay"}
      </button>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        💡 Thêm ảnh và đánh giá sau khi tạo xong, ngay trong thẻ link vừa tạo.
      </p>
    </form>
  );
}
