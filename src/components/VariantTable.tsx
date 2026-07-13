"use client";

// Bảng phân loại + giá của 1 listing — sửa tay tên/giá, THÊM dòng mới,
// XÓA dòng (mindmap: "giá bán được quét có thể sai" + mọi trường phải
// nhập/sửa tay được). Giá sửa tay đánh dấu ✍️, không bị ghi đè khi
// bấm "Cào lại".
//
// Mỗi dòng sửa/thêm có: Tên gốc (dán tiếng Trung) + Tên Việt (tự điền
// khi chạy "Phân tích AI" — gộp chung 1 request, không còn nút dịch
// riêng lẻ tốn API); Giá + chọn đơn vị tiền tệ (¥/$/đ) — giá có thể
// copy theo bất kỳ đơn vị nào tùy nguồn.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import { cnyToVnd, formatVnd, formatCny, type PriceUnit } from "@/lib/currency";

export interface VariantData {
  id: number;
  nameOriginal: string;
  nameVi: string | null;
  priceCny: number;
  priceEdited: boolean;
}

const inputClass =
  "rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-sm";

const UNIT_LABEL: Record<PriceUnit, string> = { CNY: "¥ CNY", USD: "$ USD", VND: "đ VNĐ" };

export default function VariantTable({
  listingId,
  variants,
  rate,
}: {
  listingId: number;
  variants: VariantData[];
  rate: number;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-2">
      {variants.map((v) => (
        <VariantRow key={v.id} variant={v} rate={rate} />
      ))}

      {adding ? (
        <NewVariantRow listingId={listingId} onDone={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          + Thêm phân loại
        </button>
      )}
    </div>
  );
}

// Khung nhập chung cho 1 dòng phân loại (dùng cho cả "thêm mới" và "sửa")
function VariantEditor({
  nameOriginal,
  setNameOriginal,
  nameVi,
  setNameVi,
  price,
  setPrice,
  priceUnit,
  setPriceUnit,
}: {
  nameOriginal: string;
  setNameOriginal: (v: string) => void;
  nameVi: string;
  setNameVi: (v: string) => void;
  price: string;
  setPrice: (v: string) => void;
  priceUnit: PriceUnit;
  setPriceUnit: (v: PriceUnit) => void;
}) {
  return (
    <div className="space-y-1.5 rounded-lg border border-slate-200 dark:border-slate-800 p-2">
      <div className="flex items-center gap-1.5">
        <input
          value={nameOriginal}
          onChange={(e) => setNameOriginal(e.target.value)}
          placeholder="Tên gốc (dán tiếng Trung)"
          className={`${inputClass} flex-1`}
        />
        <input
          value={nameVi}
          onChange={(e) => setNameVi(e.target.value)}
          placeholder="Tên tiếng Việt"
          className={`${inputClass} flex-1`}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Giá"
          className={`${inputClass} w-28`}
        />
        <select
          value={priceUnit}
          onChange={(e) => setPriceUnit(e.target.value as PriceUnit)}
          className={inputClass}
        >
          {(Object.keys(UNIT_LABEL) as PriceUnit[]).map((u) => (
            <option key={u} value={u}>
              {UNIT_LABEL[u]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function NewVariantRow({ listingId, onDone }: { listingId: number; onDone: () => void }) {
  const router = useRouter();
  const [nameOriginal, setNameOriginal] = useState("");
  const [nameVi, setNameVi] = useState("");
  const [price, setPrice] = useState("");
  const [priceUnit, setPriceUnit] = useState<PriceUnit>("CNY");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const priceNum = Number(price);
    if (!nameOriginal.trim() && !nameVi.trim()) return setError("Cần nhập tên phân loại.");
    if (!Number.isFinite(priceNum) || priceNum <= 0) return setError("Giá phải lớn hơn 0.");
    setSaving(true);
    setError("");
    const res = await fetch(`/api/listings/${listingId}/variants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nameOriginal: nameOriginal.trim() || nameVi.trim(),
        nameVi: nameVi.trim() || undefined,
        price: priceNum,
        priceUnit,
      }),
    });
    setSaving(false);
    if (res.ok) {
      onDone();
      router.refresh();
    } else {
      setError("Lưu thất bại, thử lại nhé.");
    }
  }

  return (
    <div>
      <VariantEditor
        nameOriginal={nameOriginal}
        setNameOriginal={setNameOriginal}
        nameVi={nameVi}
        setNameVi={setNameVi}
        price={price}
        setPrice={setPrice}
        priceUnit={priceUnit}
        setPriceUnit={setPriceUnit}
      />
      <div className="flex gap-2 mt-1.5">
        <button onClick={save} disabled={saving} className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50">
          {saving ? "..." : "Lưu"}
        </button>
        <button onClick={onDone} className="text-xs text-slate-400 hover:underline">
          Hủy
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function VariantRow({ variant: v, rate }: { variant: VariantData; rate: number }) {
  const router = useRouter();
  const confirmDialog = useConfirm();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameOriginal, setNameOriginal] = useState(v.nameOriginal);
  const [nameVi, setNameVi] = useState(v.nameVi ?? "");
  const [price, setPrice] = useState(String(v.priceCny));
  const [priceUnit, setPriceUnit] = useState<PriceUnit>("CNY");

  async function save() {
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      toast.error("Giá phải là số lớn hơn 0.");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/variants/${v.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nameOriginal: nameOriginal.trim() || v.nameOriginal,
        nameVi: nameVi.trim() || null,
        price: priceNum,
        priceUnit,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      toast.error("Lưu thất bại, thử lại nhé.");
    }
  }

  async function remove() {
    if (!(await confirmDialog(`Xóa phân loại "${v.nameVi ?? v.nameOriginal}"?`, { danger: true }))) return;
    const res = await fetch(`/api/variants/${v.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else toast.error("Xóa thất bại, thử lại nhé.");
  }

  if (editing) {
    return (
      <div>
        <VariantEditor
          nameOriginal={nameOriginal}
          setNameOriginal={setNameOriginal}
          nameVi={nameVi}
          setNameVi={setNameVi}
          price={price}
          setPrice={setPrice}
          priceUnit={priceUnit}
          setPriceUnit={setPriceUnit}
        />
        <div className="flex gap-2 mt-1.5">
          <button onClick={save} disabled={saving} className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50">
            {saving ? "..." : "Lưu"}
          </button>
          <button onClick={() => setEditing(false)} className="text-xs text-slate-400 hover:underline">
            Hủy
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-100 dark:border-slate-800/50 text-sm">
      <span>
        {v.nameVi ?? v.nameOriginal}
        {v.nameVi && v.nameVi !== v.nameOriginal && (
          <span className="text-xs text-slate-400 ml-2">{v.nameOriginal}</span>
        )}
      </span>
      <span className="flex items-center gap-3 shrink-0 whitespace-nowrap">
        <span>
          {formatCny(v.priceCny)}
          {v.priceEdited && (
            <span className="ml-1 text-xs" title="Giá đã sửa tay — sẽ không bị ghi đè khi cào lại">
              ✍️
            </span>
          )}
        </span>
        <span className="font-medium text-blue-600 dark:text-blue-400">
          {formatVnd(cnyToVnd(v.priceCny, rate))}
        </span>
        <button onClick={() => setEditing(true)} className="text-xs text-slate-400 hover:text-blue-500" title="Sửa">
          ✏️
        </button>
        <button onClick={remove} className="text-xs text-slate-400 hover:text-red-500" title="Xóa">
          🗑️
        </button>
      </span>
    </div>
  );
}
