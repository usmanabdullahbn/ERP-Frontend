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

/*
  Today's date in the browser's local timezone, formatted for a <input
  type="date"> default value. `new Date().toISOString()` always returns the
  UTC date, which rolls over to "tomorrow" for anyone west of UTC before
  midnight local time — this uses the local calendar date instead.
*/
export function todayLocalISODate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
