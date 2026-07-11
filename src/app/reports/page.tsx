// ============================================================
// BÁO CÁO SẢN PHẨM MỚI — checklist trực quan theo ngày: sản phẩm nào
// được thêm, ai thêm, giờ nào. Dựa trên ActivityLog action "product.create"
// (đã gắn userId + productId thật khi tạo — xem src/app/api/products/route.ts,
// KHÔNG dò chuỗi "detail" bằng regex vì dễ vỡ nếu câu chữ đổi sau này).
// Bấm 1 dòng -> nhảy tới trang sản phẩm kèm ?from=/reports để trang đó
// hiện nút "Quay lại báo cáo" (xem src/app/products/[id]/page.tsx).
// ============================================================
import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const logs = await prisma.activityLog.findMany({
    where: { action: "product.create" },
    include: { user: true, product: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Gom theo ngày — chuỗi ngày kiểu vi-VN làm khóa nhóm, giữ nguyên thứ
  // tự mới nhất trước (logs đã sắp desc nên nhóm cũng theo đúng thứ tự đó).
  const groups = new Map<string, typeof logs>();
  for (const log of logs) {
    const dayKey = new Date(log.createdAt).toLocaleDateString("vi-VN");
    if (!groups.has(dayKey)) groups.set(dayKey, []);
    groups.get(dayKey)!.push(log);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">📋 Báo cáo sản phẩm mới</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Checklist sản phẩm mới được thêm, gom theo ngày — bấm vào 1 dòng để xem chi tiết
          sản phẩm đó, có nút to để quay lại đúng báo cáo này.
        </p>
      </div>

      {groups.size === 0 ? (
        <p className="text-slate-500 dark:text-slate-400">Chưa có sản phẩm nào được thêm.</p>
      ) : (
        [...groups.entries()].map(([day, dayLogs], i) => {
          // Tổng kết số lượng theo từng người trong ngày đó
          const countByUser = new Map<string, number>();
          for (const log of dayLogs) {
            const name = log.user?.name ?? "Không rõ";
            countByUser.set(name, (countByUser.get(name) ?? 0) + 1);
          }

          return (
            <details
              key={day}
              open={i === 0}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden group"
            >
              <summary className="cursor-pointer px-4 py-3 flex items-center justify-between gap-3 flex-wrap select-none">
                <span className="font-semibold flex items-center gap-2">
                  <span className="text-slate-400 group-open:rotate-90 transition-transform inline-block">
                    ▶
                  </span>
                  📅 {day}{" "}
                  <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                    ({dayLogs.length} sản phẩm)
                  </span>
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {[...countByUser.entries()].map(([name, count]) => `${name}: ${count}`).join(" · ")}
                </span>
              </summary>
              <ul className="border-t border-slate-100 dark:border-slate-800">
                {dayLogs.map((log) => (
                  <li key={log.id} className="border-b border-slate-100 dark:border-slate-800/50 last:border-0">
                    {log.productId ? (
                      <Link
                        href={`/products/${log.productId}?from=${encodeURIComponent("/reports")}`}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      >
                        <span className="text-emerald-500 shrink-0">✓</span>
                        <span className="text-slate-400 shrink-0 w-16">
                          {new Date(log.createdAt).toLocaleTimeString("vi-VN")}
                        </span>
                        <span className="flex-1 truncate">
                          {log.product?.name || <span className="italic text-slate-400">(chưa đặt tên)</span>}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 shrink-0">
                          {log.user?.name ?? "—"}
                        </span>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-400">
                        <span className="shrink-0">✓</span>
                        <span className="shrink-0 w-16">{new Date(log.createdAt).toLocaleTimeString("vi-VN")}</span>
                        <span className="flex-1 italic">
                          (không xác định được sản phẩm — dữ liệu cũ trước khi có liên kết, hoặc sản phẩm đã bị xóa)
                        </span>
                        <span className="shrink-0">{log.user?.name ?? "—"}</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          );
        })
      )}
    </div>
  );
}
