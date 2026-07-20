// ============================================================
// CHẤM ĐIỂM ĐA TRỤC — định nghĩa 5 nhóm × 3 trục (15 trục), thang 100/trục.
// Mọi trục đóng khung theo hướng "điểm cao = tốt" (kể cả trục rủi ro, vd
// "rủi ro pháp lý" chấm ngược thành "mức độ AN TOÀN pháp lý") để tránh
// nhầm lẫn khi tính trung bình — KHÔNG cần cờ inverse riêng.
//
// AI chấm hết 15 trục (kèm lý do ngắn/trục) trong 1 lần gọi cho cả phiên
// (xem generateProductScores trong lib/llm/index.ts) — người dùng override
// từng trục nếu không đồng ý, lý do AI gốc GIỮ NGUYÊN để đối chiếu (xem
// ProductScore.axesJson trong prisma/schema.prisma).
//
// Điểm nhóm = trung bình 3 trục trong nhóm. Điểm tổng = trung bình đều 5
// điểm nhóm — tính Ở ĐÂY (tầng ứng dụng) từ axesJson, KHÔNG lưu cột cứng,
// để sau này đổi công thức/trọng số không cần migrate dữ liệu cũ.
// ============================================================

export interface ScoreAxis {
  id: string;
  label: string;
}

export interface ScoreGroup {
  id: string;
  label: string;
  icon: string;
  axes: ScoreAxis[];
}

export const SCORE_GROUPS: ScoreGroup[] = [
  {
    id: "financial",
    label: "Tài chính & Lợi nhuận",
    icon: "💰",
    axes: [
      { id: "fin_margin", label: "Tỷ suất lợi nhuận tiềm năng" },
      { id: "fin_capital_velocity", label: "Tốc độ thu hồi vốn (vòng quay)" },
      { id: "fin_inventory_safety", label: "Mức an toàn vốn nếu ế hàng" },
    ],
  },
  {
    id: "operations",
    label: "Vận hành & Chuỗi cung ứng",
    icon: "🚚",
    axes: [
      { id: "ops_logistics_simplicity", label: "Độ đơn giản khi đóng gói/vận chuyển" },
      { id: "ops_transit_safety", label: "Mức an toàn khi vận chuyển (ít vỡ/hỏng/lỗi)" },
      { id: "ops_supply_stability", label: "Độ ổn định nguồn cung" },
    ],
  },
  {
    id: "market",
    label: "Thị trường & Cạnh tranh",
    icon: "📊",
    axes: [
      { id: "mkt_opportunity", label: "Cơ hội thị trường (đại dương xanh và đỏ)" },
      { id: "mkt_price_tolerance", label: "Mức độ khách ít nhạy cảm giá" },
      { id: "mkt_trend_durability", label: "Tính bền vững xu hướng (không phải trend lướt sóng)" },
    ],
  },
  {
    id: "legal",
    label: "Pháp lý & Tuân thủ",
    icon: "⚖️",
    axes: [
      { id: "legal_ip_safety", label: "Mức an toàn sở hữu trí tuệ/nhái thương hiệu" },
      { id: "legal_customs_safety", label: "Mức an toàn hải quan/kiểm định/hợp quy" },
      { id: "legal_product_safety", label: "Mức an toàn sản phẩm (pin/hóa chất/đồ trẻ em...)" },
    ],
  },
  {
    id: "brand",
    label: "Thương hiệu & Khách hàng",
    icon: "🎯",
    axes: [
      { id: "brand_content_potential", label: "Tiềm năng nội dung/viral marketing" },
      { id: "brand_whitelabel_potential", label: "Khả năng xây thương hiệu riêng (OEM/white-label)" },
      { id: "brand_aftersale_safety", label: "Mức an toàn hậu mãi (ít rủi ro bảo hành/khiếu nại)" },
    ],
  },
];

export const ALL_SCORE_AXES: ScoreAxis[] = SCORE_GROUPS.flatMap((g) => g.axes);

export interface AxisScoreEntry {
  ai: number; // 0-100, AI chấm
  user: number | null; // 0-100 nếu người dùng override, null = dùng điểm AI
  reason: string; // lý do ngắn AI đưa ra — GIỮ NGUYÊN dù đã override
}

export type AxesScoreMap = Record<string, AxisScoreEntry>;

// Điểm hiệu lực của 1 trục — ưu tiên user override, rơi về AI nếu chưa override.
export function effectiveAxisScore(entry: AxisScoreEntry | undefined): number | null {
  if (!entry) return null;
  return entry.user ?? entry.ai;
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

// Điểm từng nhóm (trung bình 3 trục), null nếu thiếu hết dữ liệu nhóm đó.
export function computeGroupScores(axes: AxesScoreMap): { groupId: string; label: string; icon: string; score: number | null }[] {
  return SCORE_GROUPS.map((g) => {
    const values = g.axes
      .map((a) => effectiveAxisScore(axes[a.id]))
      .filter((v): v is number => v !== null);
    return { groupId: g.id, label: g.label, icon: g.icon, score: average(values) };
  });
}

// Điểm tổng = trung bình đều điểm 5 nhóm (bỏ qua nhóm thiếu dữ liệu).
export function computeOverallScore(axes: AxesScoreMap): number | null {
  const groupScores = computeGroupScores(axes)
    .map((g) => g.score)
    .filter((v): v is number => v !== null);
  return average(groupScores);
}
