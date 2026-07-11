"use client";

// Nút copy nhanh toàn bộ API key (Gemini/Otapi...) đang bật thành 1 khối
// text gửi cho nhân sự dán vào máy của họ (Cài đặt > API > Cấu hình) —
// nhân sự thường không rành khái niệm "API key", chỉ cần copy đúng dòng.
// KHÔNG gồm Google Drive/Lark (STORAGE) — mỗi người phải tự kết nối
// Drive CỦA HỌ, không dùng chung được (xem docs/04-lo-trinh.md).
import { useState } from "react";

interface ProviderInfo {
  name: string;
  apiKey: string | null;
  baseUrl: string | null;
  enabled: boolean;
  kind: string;
}

export default function CopyApiConfigButton({ providers }: { providers: ProviderInfo[] }) {
  const [copied, setCopied] = useState(false);

  const shareable = providers.filter(
    (p) => p.kind !== "STORAGE" && !p.name.startsWith("Mock") && p.enabled && p.apiKey
  );

  async function copyAll() {
    const text = shareable
      .map((p, i) => {
        const lines = [`API ${i + 1}: ${p.name}`, p.apiKey!];
        if (p.baseUrl) lines.push(p.baseUrl);
        return lines.join("\n");
      })
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (shareable.length === 0) {
    return (
      <p className="text-xs text-slate-400">
        Chưa có API key nào đang bật để copy — cấu hình + bật provider trước.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={copyAll}
        className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        {copied ? "✓ Đã copy" : "📋 Copy cấu hình API cho nhân sự"}
      </button>
      <p className="text-xs text-slate-400">
        Copy xong dán thẳng vào tin nhắn gửi nhân sự — mỗi API cách nhau 1 dòng trống, key nằm
        riêng 1 dòng để double-click chọn nhanh. Nhân sự dán từng key vào đúng ô &quot;Cấu
        hình&quot; ở Cài đặt &gt; API máy họ.
      </p>
    </div>
  );
}
