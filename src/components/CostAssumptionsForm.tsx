"use client";

// Giả định chi phí kinh doanh dùng để AI tính độ khả thi/giá bán gợi ý
// (mục "Đánh giá tính khả thi" trong phân tích AI). Bảng ĐỘNG — người
// dùng tự thêm/bớt dòng chi phí tùy ý (tên + số + 2 ô đơn vị), toàn bộ
// được chèn thẳng vào prompt dạng text nên không giới hạn tên trường cố
// định, AI vẫn hiểu được. Phí sàn/ads/thuế hay đổi theo thời gian nên
// để tự sửa ở đây thay vì nhét cứng vào prompt.
//
// 2 ô đơn vị (Đơn vị 1: VNĐ/%..., Đơn vị 2: /đơn hàng, /doanh thu...)
// dùng <input list> (datalist) — vừa chọn nhanh từ gợi ý có sẵn, vừa gõ
// tự do thêm giá trị mới, vì bản chất vẫn chỉ là text gửi cho LLM.
//
// Ô "Giá trị" tự định dạng: dấu "," ngăn hàng nghìn, dấu "." cho phần
// thập phân (vd 20,000 hoặc 1,000.5) — trong lúc đang gõ giữ nguyên
// text thô để không phá gõ dở, chỉ định dạng lại đẹp khi rời khỏi ô.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CostAssumptions, CostLineItem } from "@/lib/llm";

const UNIT1_OPTIONS = ["VNĐ", "%"];
const UNIT2_OPTIONS = ["/ đơn hàng", "/ doanh thu", "/ tháng", "/ tổng đơn hàng"];

const inputClass =
  "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm";

function newRow(): CostLineItem {
  return { id: crypto.randomUUID(), name: "", value: 0, unit1: "%", unit2: "/ doanh thu" };
}

function formatValue(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 10 }) : "0";
}

function parseValue(s: string): number {
  const n = Number(s.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function ValueInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(() => formatValue(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(formatValue(value));
  }, [value, focused]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseValue(e.target.value));
      }}
      onBlur={() => {
        setFocused(false);
        setText(formatValue(value));
      }}
      className={inputClass}
    />
  );
}

export default function CostAssumptionsForm({ current }: { current: CostAssumptions }) {
  const router = useRouter();
  const [rows, setRows] = useState<CostLineItem[]>(current.length ? current : [newRow()]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function updateRow(id: string, patch: Partial<CostLineItem>) {
    setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setRows(rows.filter((r) => r.id !== id));
  }

  function addRow() {
    setRows([...rows, newRow()]);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const cleaned = rows.filter((r) => r.name.trim());
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "business_cost_assumptions", value: JSON.stringify(cleaned) }),
    });
    setRows(cleaned.length ? cleaned : [newRow()]);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <datalist id="cost-unit1-options">
        {UNIT1_OPTIONS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <datalist id="cost-unit2-options">
        {UNIT2_OPTIONS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      <div className="space-y-2">
        {/* Header — ẩn trên mobile, dùng làm nhãn cột trên desktop */}
        <div className="hidden sm:grid grid-cols-[1fr_90px_100px_120px_32px] gap-2 text-xs text-slate-500 dark:text-slate-400 px-0.5">
          <span>Tên chi phí</span>
          <span>Giá trị</span>
          <span>Đơn vị 1</span>
          <span>Đơn vị 2</span>
          <span />
        </div>
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-1 sm:grid-cols-[1fr_90px_100px_120px_32px] gap-2">
            <input
              value={r.name}
              onChange={(e) => updateRow(r.id, { name: e.target.value })}
              placeholder="VD: Phí hoa hồng"
              className={inputClass}
            />
            <ValueInput value={r.value} onChange={(v) => updateRow(r.id, { value: v })} />
            <input
              list="cost-unit1-options"
              value={r.unit1}
              onChange={(e) => updateRow(r.id, { unit1: e.target.value })}
              placeholder="VNĐ, %..."
              className={inputClass}
            />
            <input
              list="cost-unit2-options"
              value={r.unit2}
              onChange={(e) => updateRow(r.id, { unit2: e.target.value })}
              placeholder="/ đơn hàng..."
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => removeRow(r.id)}
              className="text-slate-400 hover:text-red-500 text-sm justify-self-start sm:justify-self-center"
              title="Xóa dòng này"
            >
              🗑️
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
      >
        + Thêm dòng chi phí
      </button>

      <div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 text-sm"
        >
          {saved ? "✓ Đã lưu" : saving ? "Đang lưu..." : "Lưu"}
        </button>
      </div>
      <p className="text-xs text-slate-400">
        💡 Đơn vị 1/2 có gợi ý sẵn nhưng gõ tự do được (bấm vào ô, gõ chữ mới) — AI đọc
        hiểu mọi tên chi phí/đơn vị, không giới hạn theo mẫu cố định. Ô Giá trị tự thêm
        dấu phẩy ngăn hàng nghìn (vd 20,000) khi rời khỏi ô. Sửa số ở đây khi sàn đổi
        cơ cấu phí — lần &quot;Tạo bằng AI&quot; tiếp theo sẽ tự dùng số mới nhất.
      </p>
    </form>
  );
}
