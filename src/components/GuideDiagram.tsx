// Sơ đồ minh họa đơn giản cho trang Hướng dẫn sử dụng — chuỗi ô vuông
// bo góc nối bằng mũi tên, không cần thư viện vẽ sơ đồ nào. Tự xuống
// dòng (mũi tên đổi hướng ↓) trên màn hình hẹp.
interface GuideStep {
  icon: string;
  label: string;
}

export default function GuideDiagram({ steps }: { steps: GuideStep[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 justify-center py-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 min-w-[120px] text-center">
            <span className="text-2xl">{step.icon}</span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{step.label}</span>
          </div>
          {i < steps.length - 1 && (
            <span className="text-xl text-slate-300 dark:text-slate-600 shrink-0">→</span>
          )}
        </div>
      ))}
    </div>
  );
}
