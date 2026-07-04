// ============================================================
// TRANG LOG — mindmap: "Log ghi lại TOÀN BỘ lịch sử hoạt động".
// Mọi API route đều gọi logActivity() (src/lib/log.ts) nên
// thao tác nào cũng hiện ở đây.
// ============================================================
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const logs = await prisma.activityLog.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">Log hoạt động</h1>

      {logs.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400">Chưa có hoạt động nào.</p>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="px-4 py-2.5 font-medium">Thời gian</th>
                <th className="px-4 py-2.5 font-medium">Hành động</th>
                <th className="px-4 py-2.5 font-medium">Chi tiết</th>
                <th className="px-4 py-2.5 font-medium">Người dùng</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-slate-100 dark:border-slate-800/50 last:border-0"
                >
                  <td className="px-4 py-2 whitespace-nowrap text-slate-500 dark:text-slate-400">
                    {new Date(log.createdAt).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-4 py-2">
                    <code className="text-xs bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5">
                      {log.action}
                    </code>
                  </td>
                  <td className="px-4 py-2">{log.detail}</td>
                  <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                    {log.user?.name ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
