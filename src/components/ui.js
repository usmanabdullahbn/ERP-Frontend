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

/*
  Express a base-unit quantity in the product's secondary unit, e.g.
  575 ft with 1 length = 19 ft → "30 length + 5 ft". Returns '' when the
  product has no secondary unit set.
*/
export function formatAltQty(qty, { unit, altUnit, altUnitFactor } = {}) {
  const factor = Number(altUnitFactor || 0);
  if (!altUnit || factor <= 0) return '';
  const total = Number(qty || 0);
  const abs = Math.abs(total);
  const whole = Math.floor(abs / factor + 1e-9);
  const rest = Math.round((abs - whole * factor) * 100) / 100;
  let text = `${whole} ${altUnit}`;
  if (rest > 0) text += ` + ${rest} ${unit || ''}`.trimEnd();
  return total < 0 ? `-(${text})` : text;
}

/*
  Options for a document form's dropdown: active records only, plus the
  one already chosen so editing an old document still shows its party/product.
  (Report filters keep inactive records — their history still matters.)
*/
export function activeOrSelected(list, ...selectedIds) {
  return list.filter((item) => item.isActive !== false || selectedIds.includes(item._id));
}

function toLocalISODate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/* First day of the current local month, for a report's default "From" date. */
export function firstOfMonthLocalISODate() {
  const d = new Date();
  return toLocalISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

/* Last day of the current local month, for a report's default "To" date. */
export function lastOfMonthLocalISODate() {
  const d = new Date();
  return toLocalISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
