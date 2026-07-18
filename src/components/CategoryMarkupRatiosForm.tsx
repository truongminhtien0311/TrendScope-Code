"use client";

// Tỷ lệ markup (giá bán lẻ / giá xưởng) theo NGÀNH HÀNG — dùng để AI ước
// tính giá xưởng khi sản phẩm chỉ có giá bán lẻ (Taobao/Tmall/JD), chưa
// có giá xưởng thật (Alibaba/1688). Mỗi ngành hàng có tỷ lệ markup khác
// nhau nên KHÔNG hardcode 1 số chung — người dùng tự thêm/sửa/xóa dòng,
// chọn ngành hàng có sẵn trong danh sách Category của app (xem
// src/lib/llm/index.ts — CategoryMarkupRatio, buildPriceBasisNote).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SUGGESTED_MARKUP_BY_CATEGORY, FALLBACK_MARKUP_RATIO, type CategoryMarkupRatio } from "@/lib/llm";

const inputClass =
  "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm";

function suggestedRatio(categoryName: string): number {
  return SUGGESTED_MARKUP_BY_CATEGORY[categoryName] ?? FALLBACK_MARKUP_RATIO;
}

function newRow(defaultCategory: string): CategoryMarkupRatio {
  return { id: crypto.randomUUID(), categoryName: defaultCategory, ratio: suggestedRatio(defaultCategory) };
}

// markup% (trên giá xưởng) <-> số lần giá bán so với giá xưởng — 2 ô bổ
// trợ nhau, đổi ô nào ô còn lại tự tính theo: giá bán = giá xưởng × (1 + ratio/100)
function ratioToMultiplier(ratio: number): number {
  return 1 + ratio / 100;
}
function multiplierToRatio(multiplier: number): number {
  return (multiplier - 1) * 100;
}

export default function CategoryMarkupRatiosForm({
  current,
  categories,
  isAdmin,
}: {
  current: CategoryMarkupRatio[];
  categories: { id: number; name: string }[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  // Chưa cấu hình gì (current rỗng) -> điền sẵn TẤT CẢ ngành hàng đang có
  // kèm mức markup GỢI Ý (SUGGESTED_MARKUP_BY_CATEGORY) để người dùng đỡ
  // phải tự tra cứu — vẫn sửa/xóa thoải mái trước khi bấm Lưu.
  const [rows, setRows] = useState<CategoryMarkupRatio[]>(() =>
    current.length > 0
      ? current
      : categories.map((c) => ({ id: crypto.randomUUID(), categoryName: c.name, ratio: suggestedRatio(c.name) }))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function updateRow(id: string, patch: Partial<CategoryMarkupRatio>) {
    setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setRows(rows.filter((r) => r.id !== id));
  }

  function addRow() {
    setRows([...rows, newRow(categories[0]?.name ?? "")]);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const cleaned = rows.filter((r) => r.categoryName.trim());
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "category_markup_ratios", value: JSON.stringify(cleaned) }),
    });
    setRows(cleaned);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  if (categories.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Chưa có ngành hàng nào — thêm ngành hàng ở trang &quot;Tag &amp; Ngành hàng&quot; trước.
      </p>
    );
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="space-y-2">
        <div className="hidden sm:grid grid-cols-[1fr_110px_110px_32px] gap-2 text-xs text-slate-500 dark:text-slate-400 px-0.5">
          <span>Ngành hàng</span>
          <span>Markup (%)</span>
          <span>Gấp X lần</span>
          <span />
        </div>
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-1 sm:grid-cols-[1fr_110px_110px_32px] gap-2">
            <select
              value={r.categoryName}
              onChange={(e) => updateRow(r.id, { categoryName: e.target.value })}
              disabled={!isAdmin}
              className={inputClass}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              step="0.1"
              value={r.ratio}
              onChange={(e) => updateRow(r.id, { ratio: Number(e.target.value) })}
              readOnly={!isAdmin}
              title="Markup (%) trên giá xưởng — giá bán lẻ = giá xưởng × (1 + markup/100)"
              className={inputClass}
            />
            <input
              type="number"
              min={1}
              step="0.1"
              value={ratioToMultiplier(r.ratio).toFixed(2)}
              onChange={(e) => updateRow(r.id, { ratio: multiplierToRatio(Number(e.target.value)) })}
              readOnly={!isAdmin}
              title="Giá bán lẻ gấp bao nhiêu lần giá xưởng — đổi ô này, ô Markup (%) tự tính lại"
              className={inputClass}
            />
            {isAdmin && (
              <button
                type="button"
                onClick={() => removeRow(r.id)}
                className="text-slate-500 dark:text-slate-400 hover:text-red-500 text-sm justify-self-start sm:justify-self-center"
                title="Xóa dòng này"
              >
                🗑️
              </button>
            )}
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Chưa có dòng nào (đã xóa hết) — AI sẽ tự nêu rõ chưa có tỷ lệ để ước tính. Bấm &quot;+ Thêm ngành
            hàng&quot; để thêm lại.
          </p>
        )}
      </div>

      {!isAdmin && <p className="text-xs text-slate-500 dark:text-slate-400">(chỉ admin sửa được)</p>}

      {isAdmin && (
        <>
          <button
            type="button"
            onClick={addRow}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            + Thêm ngành hàng
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
          <p className="text-xs text-slate-500 dark:text-slate-400">
            💡 Markup (%) tính trên GIÁ XƯỞNG (giá vốn) — vd markup 150% nghĩa là giá bán lẻ ≈ giá
            xưởng × 2.5 (ô &quot;Gấp X lần&quot; bên cạnh). 2 ô tự đồng bộ, sửa ô nào cũng được. App
            đã điền sẵn mức markup GỢI Ý theo ngành hàng (ước tính tham khảo, KHÔNG chính xác cho
            mọi trường hợp) — vì thực tế chỉ có giá bán lẻ để cào, không tra được giá xưởng thật,
            nên cứ sửa lại theo kinh nghiệm thực tế của bạn. Chỉ dùng khi sản phẩm CHƯA có giá
            xưởng thật — AI sẽ luôn ưu tiên giá xưởng thật nếu có.
          </p>
        </>
      )}
    </form>
  );
}
