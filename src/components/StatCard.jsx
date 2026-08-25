export default function StatCard({ label, value, tone = 'default', icon: Icon, sub }) {
  const toneClasses = {
    default: 'text-ink-800',
    positive: 'text-ledger-teal',
    negative: 'text-ledger-rose',
    warning: 'text-ledger-amber'
  };
  return (
    <div className="min-w-0 overflow-hidden bg-white rounded-xl border border-slate-200 shadow-card p-5 flex flex-col gap-1">
      <div className="min-w-0 flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-slate-500 font-medium">{label}</span>
        {Icon && <Icon size={16} className="text-slate-400" />}
      </div>
      <span
        className={`block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-figures text-2xl font-semibold ${toneClasses[tone]}`}
        title={String(value)}
      >
        {value}
      </span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}
