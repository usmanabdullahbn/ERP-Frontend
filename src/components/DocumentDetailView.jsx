import { Link } from 'react-router-dom';
import Badge from './Badge';
import { formatAltQty } from './ui';

/**
 * Shared detail card for Sales Invoices, Purchase Bills, Sales Orders and
 * Purchase Orders so all four document views share one clean, readable layout.
 */
export default function DocumentDetailView({
  doc,
  docClassName = '',
  title,
  numberLabel,
  numberValue,
  partyLabel,
  partyName,
  linkedDoc,
  priceLabel = 'Price',
  getUnitPrice,
  lineGross,
  lineDiscount,
  money,
  footerActions,
}) {
  const items = doc.items || [];
  const hasDiscount = items.some((it) => it.discountRate);
  const hasAlt = items.some((it) => Boolean(formatAltQty(it.quantity, it.product || {})));
  const altUnits = [...new Set(items.map((it) => it.product?.altUnit).filter(Boolean))];
  const altLabel = altUnits.length === 1 ? `Qty (${altUnits[0]})` : 'Qty (alt unit)';

  return (
    <div className={`${docClassName} bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden flex flex-col`}>
      {/* Header banner */}
      <div className="bg-slate-50/80 border-b border-slate-200 px-5 sm:px-7 py-5 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold text-ink-900">{title}</h1>
            <Badge status={doc.status} />
          </div>
          <p className="text-sm text-slate-500">
            {numberLabel}: <span className="font-figures font-semibold text-ink-800">{numberValue}</span>
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[11px] uppercase tracking-wider font-medium text-slate-500">Grand Total</p>
          <p className="text-2xl font-semibold font-figures text-ink-900">{money(doc.grandTotal)}</p>
        </div>
      </div>

      <div className="p-5 sm:p-7 flex flex-col gap-6">
        {/* Party & metadata */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4">
          <div className="rounded-lg border border-slate-200/90 bg-slate-50/50 p-4 flex flex-col justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider font-medium text-slate-400">{partyLabel}</p>
              <p className="text-base font-semibold text-ink-900 mt-0.5">{partyName || '—'}</p>
            </div>
            {linkedDoc && (
              <div className="pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-sm">
                <span className="text-slate-500 text-xs">{linkedDoc.label}</span>
                <Link to={linkedDoc.to} className="font-figures font-medium text-ledger-teal hover:underline">
                  {linkedDoc.number}
                </Link>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200/90 bg-slate-50/50 p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 items-start">
            <div>
              <p className="text-[11px] uppercase tracking-wider font-medium text-slate-400">Date</p>
              <p className="text-sm font-medium text-ink-900 mt-0.5 font-figures">
                {new Date(doc.date).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider font-medium text-slate-400">Due Date</p>
              <p className="text-sm font-medium text-ink-900 mt-0.5 font-figures">
                {doc.dueDate ? new Date(doc.dueDate).toLocaleDateString() : '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider font-medium text-slate-400">Doc #</p>
              <p className="text-sm font-medium text-ink-900 mt-0.5">{doc.docRef || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider font-medium text-slate-400">Payment Terms</p>
              <p className="text-sm font-medium text-ink-900 mt-0.5">{doc.paymentTerms || '—'}</p>
            </div>
          </div>
        </div>

        {doc.notes && (
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 px-4 py-3 text-sm">
            <p className="text-[11px] uppercase tracking-wider font-medium text-slate-400 mb-1">Notes</p>
            <p className="whitespace-pre-wrap text-slate-700">{doc.notes}</p>
          </div>
        )}

        {/* Line items table */}
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="py-2.5 px-3 font-semibold whitespace-nowrap">SKU</th>
                  <th className="py-2.5 px-3 font-semibold">Item</th>
                  <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Warehouse</th>
                  <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">Qty</th>
                  {hasAlt && <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">{altLabel}</th>}
                  <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">{priceLabel}</th>
                  <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">Disc %</th>
                  <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">Disc Amt</th>
                  <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it, i) => (
                  <tr key={it.product?._id ? `${it.product._id}-${i}` : i} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 font-figures text-slate-500 whitespace-nowrap">{it.product?.sku}</td>
                    <td className="py-2.5 px-3 font-medium text-ink-900">{it.product?.name}</td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{it.warehouse?.name}</td>
                    <td className="py-2.5 px-3 text-right font-figures whitespace-nowrap">
                      {`${it.quantity} ${it.product?.unit || ''}`.trim()}
                    </td>
                    {hasAlt && (
                      <td className="py-2.5 px-3 text-right font-figures text-slate-600 whitespace-nowrap">
                        {formatAltQty(it.quantity, it.product || {}) || '—'}
                      </td>
                    )}
                    <td className="py-2.5 px-3 text-right font-figures whitespace-nowrap">{money(getUnitPrice(it))}</td>
                    <td className="py-2.5 px-3 text-right font-figures text-slate-600 whitespace-nowrap">
                      {Math.round((it.discountRate || 0) * 100) / 100}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-figures text-slate-600 whitespace-nowrap">
                      {money(lineDiscount(it))}
                    </td>
                    <td className="py-2.5 px-3 text-right font-figures font-medium text-ink-900 whitespace-nowrap">
                      {money(it.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals summary */}
        <div className="flex justify-end">
          <div className="w-full sm:w-80 rounded-lg border border-slate-200/90 bg-slate-50/60 p-4 space-y-1.5">
            {hasDiscount && (
              <>
                <div className="flex justify-between gap-6 text-sm">
                  <span className="text-slate-600">Gross</span>
                  <span className="font-figures text-ink-800">{money(items.reduce((s, it) => s + lineGross(it), 0))}</span>
                </div>
                <div className="flex justify-between gap-6 text-sm">
                  <span className="text-slate-600">Discount</span>
                  <span className="font-figures text-ledger-rose">−{money(items.reduce((s, it) => s + lineDiscount(it), 0))}</span>
                </div>
              </>
            )}
            <div className="flex justify-between gap-6 text-sm">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-figures text-ink-800">{money(doc.subTotal)}</span>
            </div>
            <div className="flex justify-between gap-6 text-sm">
              <span className="text-slate-600">Tax</span>
              <span className="font-figures text-ink-800">{money(doc.taxTotal)}</span>
            </div>
            {doc.roundOff ? (
              <div className="flex justify-between gap-6 text-sm">
                <span className="text-slate-600">Round off</span>
                <span className="font-figures text-ink-800">{money(doc.roundOff)}</span>
              </div>
            ) : null}
            <div className="flex justify-between gap-6 text-base font-semibold border-t border-slate-200 pt-2 mt-1">
              <span className="text-ink-900">Total</span>
              <span className="font-figures text-ink-900">{money(doc.grandTotal)}</span>
            </div>
          </div>
        </div>

        {footerActions && (
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 print:hidden">
            {footerActions}
          </div>
        )}
      </div>
    </div>
  );
}
