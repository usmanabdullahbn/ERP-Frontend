export const inputCls =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-ledger-teal focus:ring-1 focus:ring-ledger-teal outline-none bg-white';

export function formatMoney(n) {
  const num = Number(n || 0);
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString();
}
