"use client";

// Sao lưu database (SQLite) lên Google Drive — snapshot theo yêu cầu,
// KHÔNG tự động đồng bộ liên tục. Giữ lại tối đa 10 bản gần nhất, tự
// xóa bản cũ hơn để không phình dung lượng.
import { useEffect, useState } from "react";

interface Backup {
  id: string;
  name: string;
  createdTime: string;
  sizeBytes?: number;
}

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function BackupPanel() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/backup/list");
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      setBackups(data.backups);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tải danh sách backup 1 lần lúc mount, không phải vòng lặp render
    load();
  }, []);

  async function createNow() {
    setCreating(true);
    setError("");
    const res = await fetch("/api/backup/create", { method: "POST" });
    setCreating(false);
    if (res.ok) {
      load();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Sao lưu thất bại, thử lại nhé.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={createNow}
          disabled={creating}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 text-sm"
        >
          {creating ? "Đang sao lưu..." : "💾 Sao lưu ngay"}
        </button>
        <span className="text-xs text-slate-500 dark:text-slate-400">Giữ tối đa 10 bản gần nhất, tự xóa bản cũ hơn.</span>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Đang tải danh sách...</p>
      ) : backups.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có bản sao lưu nào.</p>
      ) : (
        <ul className="text-sm space-y-1">
          {backups.map((b) => (
            <li key={b.id} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 py-1">
              <span>{b.name}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {formatSize(b.sizeBytes)} · {new Date(b.createdTime).toLocaleString("vi-VN")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
