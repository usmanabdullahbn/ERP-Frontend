const STYLES = {
  DRAFT: 'bg-slate-100 text-slate-600',
  POSTED: 'bg-ledger-tealLight text-ledger-teal',
  PARTIALLY_PAID: 'bg-ledger-amberLight text-ledger-amber',
  PAID: 'bg-emerald-100 text-emerald-700',
  VOID: 'bg-ledger-roseLight text-ledger-rose',
  ACTIVE: 'bg-ledger-tealLight text-ledger-teal',
  INACTIVE: 'bg-slate-100 text-slate-500'
};

export default function Badge({ status }) {
  const cls = STYLES[status] || 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
}
