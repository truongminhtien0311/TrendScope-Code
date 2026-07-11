"use client";

// Xuất dữ liệu lên Google Drive (chia sẻ cho người khác gộp vào) và
// Đồng bộ (dán link Drive người khác gửi để nhập vào máy này).
import { useState } from "react";

export default function SyncPanel() {
  return (
    <div className="space-y-6">
      <ExportBlock />
      <ImportBlock />
    </div>
  );
}

function ExportBlock() {
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<{ url: string; productCount: number; localImageWarningCount: number } | null>(
    null
  );
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function doExport() {
    setExporting(true);
    setError("");
    setResult(null);
    const res = await fetch("/api/sync/export", { method: "POST" });
    setExporting(false);
    if (res.ok) {
      setResult(await res.json());
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Xuất dữ liệu thất bại.");
    }
  }

  async function copyLink() {
    if (!result) return;
    await navigator.clipboard.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
      <h2 className="font-semibold">📤 Xuất dữ liệu lên Google Drive</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Xuất toàn bộ sản phẩm trên máy này lên Google Drive của mày, lấy link gửi cho người
        cần gộp dữ liệu (qua Zalo/email...). Cần đã kết nối Google Drive ở Cài đặt &gt; Lưu trữ.
      </p>
      <button
        onClick={doExport}
        disabled={exporting}
        className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium"
      >
        {exporting ? "Đang xuất..." : "📤 Xuất dữ liệu"}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {result && (
        <div className="space-y-2 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
          <p className="text-sm">
            ✅ Đã xuất <strong>{result.productCount}</strong> sản phẩm.
          </p>
          {result.localImageWarningCount > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ Có {result.localImageWarningCount} ảnh đang lưu trên ổ đĩa máy này (chưa bật
              Google Drive) — máy khác sẽ không xem được ảnh đó. Nên bật Google Drive ở Cài
              đặt &gt; Lưu trữ trước khi xuất.
            </p>
          )}
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={result.url}
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs"
            />
            <button
              onClick={copyLink}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              {copied ? "✓ Đã copy" : "Copy link"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ImportBlock() {
  const [link, setLink] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ newProducts: number; newListings: number } | null>(null);
  const [error, setError] = useState("");

  async function doImport(e: React.FormEvent) {
    e.preventDefault();
    setSyncing(true);
    setError("");
    setResult(null);
    const res = await fetch("/api/sync/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driveLink: link.trim() }),
    });
    setSyncing(false);
    if (res.ok) {
      setResult(await res.json());
      setLink("");
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Đồng bộ thất bại.");
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
      <h2 className="font-semibold">📥 Đồng bộ từ Drive</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Dán link Drive người khác gửi vào đây — chỉ sản phẩm/link MỚI (chưa từng nhập) mới
        được thêm vào, dữ liệu đã có trên máy này không bị đổi.
      </p>
      <form onSubmit={doImport} className="flex gap-2">
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Dán link Google Drive vào đây..."
          required
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={syncing}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium whitespace-nowrap"
        >
          {syncing ? "Đang đồng bộ..." : "🔄 Đồng bộ"}
        </button>
      </form>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {result && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          ✅ Đã thêm {result.newProducts} sản phẩm mới, {result.newListings} link mới.
        </p>
      )}
    </section>
  );
}
