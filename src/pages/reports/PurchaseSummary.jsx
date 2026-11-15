import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import ReportExportButtons from '../../components/ReportExportButtons';
import MultiSelect from '../../components/MultiSelect';
import FilterBar, { matchesSearch, filterNote } from '../../components/FilterBar';
import JvLink from '../../components/JvLink';
import { downloadReportPdf, downloadReportExcel } from '../../components/reportExport';
import { formatMoney, formatDate, firstOfMonthLocalISODate, lastOfMonthLocalISODate } from '../../components/ui';

const VIEW_TABS = [
  { id: 'bill', label: 'By Bill' },
  { id: 'product', label: 'By Product (Item)' },
  { id: 'supplier', label: 'By Supplier' },
  { id: 'daily', label: 'By Day' },
  { id: 'monthly', label: 'By Month' }
];

export default function PurchaseSummary() {
  const [data, setData] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [supplierIds, setSupplierIds] = useState([]);
  const [productIds, setProductIds] = useState([]);
  const [from, setFrom] = useState(firstOfMonthLocalISODate());
  const [to, setTo] = useState(lastOfMonthLocalISODate());
  const [view, setView] = useState('bill');
  const [expandedBills, setExpandedBills] = useState({});
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/suppliers').then((res) => setSuppliers(res.data)).catch(() => {});
    api.get('/products').then((res) => setProducts(res.data)).catch(() => {});
  }, []);

  const run = () => {
    setLoading(true);
    setError('');
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (supplierIds.length) params.supplierId = supplierIds.join(',');
    if (productIds.length) params.productId = productIds.join(',');
    api.get('/reports/purchase-summary', { params })
      .then((res) => {
        setData(res.data);
        setExpandedBills({});
      })
      .catch(() => setError('Could not load purchase summary report.'))
      .finally(() => setLoading(false));
  };

  const toggleBill = (id) => {
    setExpandedBills((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const money = formatMoney;
  const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

  const visibleBills = (data?.billRows || []).filter((r) =>
    matchesSearch(search, r.billNumber, r.docRef, r.supplierName, r.supplierCode, r.jvNumber, r.status)
  );
  const visibleProducts = (data?.productRows || []).filter((r) =>
    matchesSearch(search, r.sku, r.productName, r.category, r.unit)
  );
  const visibleSuppliers = (data?.supplierRows || []).filter((r) =>
    matchesSearch(search, r.supplierCode, r.supplierName)
  );
  const visibleDaily = (data?.dailyRows || []).filter((r) =>
    matchesSearch(search, r.date, formatDate(r.date))
  );
  const visibleMonthly = (data?.monthlyRows || []).filter((r) =>
    matchesSearch(search, r.month, r.monthLabel)
  );

  const activeRows =
    view === 'bill'
      ? visibleBills
      : view === 'product'
        ? visibleProducts
        : view === 'supplier'
          ? visibleSuppliers
          : view === 'daily'
            ? visibleDaily
            : visibleMonthly;

  const totals = activeRows.reduce(
    (acc, r) => {
      acc.billCount += Number(r.billCount || (view === 'bill' ? 1 : 0));
      acc.quantity = round2(acc.quantity + Number(r.quantity || 0));
      acc.grossAmount = round2(acc.grossAmount + Number(r.grossAmount || 0));
      acc.discount = round2(acc.discount + Number(r.discount || 0));
      acc.netAmount = round2(acc.netAmount + Number(r.netAmount || 0));
      acc.tax = round2(acc.tax + Number(r.tax || 0));
      acc.grandTotal = round2(acc.grandTotal + Number(view === 'product' ? r.lineTotal : r.grandTotal || 0));
      acc.amountPaid = round2(acc.amountPaid + Number(r.amountPaid || 0));
      acc.balanceDue = round2(acc.balanceDue + Number(r.balanceDue || 0));
      return acc;
    },
    { billCount: 0, quantity: 0, grossAmount: 0, discount: 0, netAmount: 0, tax: 0, grandTotal: 0, amountPaid: 0, balanceDue: 0 }
  );

  const supplierNames = suppliers.filter((s) => supplierIds.includes(s._id)).map((s) => s.name).join(', ');
  const productNames = products.filter((p) => productIds.includes(p._id)).map((p) => p.name).join(', ');
  const subtitle = `Period: ${from ? formatDate(from) : 'inception'} to ${to ? formatDate(to) : 'today'}${supplierNames ? ` — Supplier: ${supplierNames}` : ''}${productNames ? ` — Product: ${productNames}` : ''}${filterNote(search, ['View', view])}`;

  const getExportSpec = () => {
    if (view === 'bill') {
      const cols = [
        { key: 'date', label: 'Date', date: true },
        { key: 'billNumber', label: 'Bill #' },
        { key: 'supplierName', label: 'Supplier' },
        { key: 'status', label: 'Status' },
        { key: 'quantity', label: 'Qty', align: 'right' },
        { key: 'grossAmount', label: 'Gross Amount', align: 'right', money: true },
        { key: 'discount', label: 'Discount', align: 'right', money: true },
        { key: 'netAmount', label: 'Net Amount', align: 'right', money: true },
        { key: 'tax', label: 'Tax', align: 'right', money: true },
        { key: 'grandTotal', label: 'Grand Total', align: 'right', money: true },
        { key: 'amountPaid', label: 'Paid', align: 'right', money: true },
        { key: 'balanceDue', label: 'Balance Due', align: 'right', money: true }
      ];
      const tot = [
        `Total (${visibleBills.length})`,
        '',
        '',
        '',
        totals.quantity,
        money(totals.grossAmount),
        money(totals.discount),
        money(totals.netAmount),
        money(totals.tax),
        money(totals.grandTotal),
        money(totals.amountPaid),
        money(totals.balanceDue)
      ];
      return { title: 'Purchase Summary (By Bill)', columns: cols, rows: visibleBills, totals: tot };
    }
    if (view === 'product') {
      const cols = [
        { key: 'sku', label: 'SKU' },
        { key: 'productName', label: 'Product' },
        { key: 'unit', label: 'Unit' },
        { key: 'billCount', label: 'Bills', align: 'right' },
        { key: 'quantity', label: 'Qty Purchased', align: 'right' },
        { key: 'avgCost', label: 'Avg Net Cost', align: 'right', money: true },
        { key: 'grossAmount', label: 'Gross Amount', align: 'right', money: true },
        { key: 'discount', label: 'Discount', align: 'right', money: true },
        { key: 'netAmount', label: 'Net Amount', align: 'right', money: true },
        { key: 'tax', label: 'Tax', align: 'right', money: true },
        { key: 'lineTotal', label: 'Total (Incl. Tax)', align: 'right', money: true }
      ];
      const tot = [
        `Total (${visibleProducts.length})`,
        '',
        '',
        '',
        totals.quantity,
        '',
        money(totals.grossAmount),
        money(totals.discount),
        money(totals.netAmount),
        money(totals.tax),
        money(totals.grandTotal)
      ];
      return { title: 'Purchase Summary (By Product)', columns: cols, rows: visibleProducts, totals: tot };
    }
    if (view === 'supplier') {
      const cols = [
        { key: 'supplierCode', label: 'Code' },
        { key: 'supplierName', label: 'Supplier' },
        { key: 'billCount', label: 'Bills', align: 'right' },
        { key: 'quantity', label: 'Qty Purchased', align: 'right' },
        { key: 'grossAmount', label: 'Gross Amount', align: 'right', money: true },
        { key: 'discount', label: 'Discount', align: 'right', money: true },
        { key: 'netAmount', label: 'Net Amount', align: 'right', money: true },
        { key: 'tax', label: 'Tax', align: 'right', money: true },
        { key: 'grandTotal', label: 'Grand Total', align: 'right', money: true },
        { key: 'amountPaid', label: 'Paid', align: 'right', money: true },
        { key: 'balanceDue', label: 'Balance Due', align: 'right', money: true }
      ];
      const tot = [
        `Total (${visibleSuppliers.length})`,
        '',
        totals.billCount,
        totals.quantity,
        money(totals.grossAmount),
        money(totals.discount),
        money(totals.netAmount),
        money(totals.tax),
        money(totals.grandTotal),
        money(totals.amountPaid),
        money(totals.balanceDue)
      ];
      return { title: 'Purchase Summary (By Supplier)', columns: cols, rows: visibleSuppliers, totals: tot };
    }
    if (view === 'daily') {
      const cols = [
        { key: 'date', label: 'Date', date: true },
        { key: 'billCount', label: 'Bills', align: 'right' },
        { key: 'quantity', label: 'Qty Purchased', align: 'right' },
        { key: 'grossAmount', label: 'Gross Amount', align: 'right', money: true },
        { key: 'discount', label: 'Discount', align: 'right', money: true },
        { key: 'netAmount', label: 'Net Amount', align: 'right', money: true },
        { key: 'tax', label: 'Tax', align: 'right', money: true },
        { key: 'grandTotal', label: 'Grand Total', align: 'right', money: true },
        { key: 'amountPaid', label: 'Paid', align: 'right', money: true },
        { key: 'balanceDue', label: 'Balance Due', align: 'right', money: true }
      ];
      const tot = [
        `Total (${visibleDaily.length} day${visibleDaily.length === 1 ? '' : 's'})`,
        totals.billCount,
        totals.quantity,
        money(totals.grossAmount),
        money(totals.discount),
        money(totals.netAmount),
        money(totals.tax),
        money(totals.grandTotal),
        money(totals.amountPaid),
        money(totals.balanceDue)
      ];
      return { title: 'Purchase Summary (By Day)', columns: cols, rows: visibleDaily, totals: tot };
    }
    const cols = [
      { key: 'monthLabel', label: 'Month' },
      { key: 'billCount', label: 'Bills', align: 'right' },
      { key: 'quantity', label: 'Qty Purchased', align: 'right' },
      { key: 'grossAmount', label: 'Gross Amount', align: 'right', money: true },
      { key: 'discount', label: 'Discount', align: 'right', money: true },
      { key: 'netAmount', label: 'Net Amount', align: 'right', money: true },
      { key: 'tax', label: 'Tax', align: 'right', money: true },
      { key: 'grandTotal', label: 'Grand Total', align: 'right', money: true },
      { key: 'amountPaid', label: 'Paid', align: 'right', money: true },
      { key: 'balanceDue', label: 'Balance Due', align: 'right', money: true }
    ];
    const tot = [
      `Total (${visibleMonthly.length} month${visibleMonthly.length === 1 ? '' : 's'})`,
      totals.billCount,
      totals.quantity,
      money(totals.grossAmount),
      money(totals.discount),
      money(totals.netAmount),
      money(totals.tax),
      money(totals.grandTotal),
      money(totals.amountPaid),
      money(totals.balanceDue)
    ];
    return { title: 'Purchase Summary (By Month)', columns: cols, rows: visibleMonthly, totals: tot };
  };

  const exportPdf = () => {
    const spec = getExportSpec();
    downloadReportPdf({ ...spec, subtitle });
  };
  const exportExcel = () => {
    const spec = getExportSpec();
    downloadReportExcel({ ...spec, subtitle });
  };

  return (
    <PageLayout
      title="Purchase Summary"
      subtitle="Bill-wise, Product-wise, Supplier-wise &amp; Period-wise Purchases Breakdown"
      actions={data && <ReportExportButtons onPdf={exportPdf} onExcel={exportExcel} />}
    >
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
      <div className="flex items-end gap-3 mb-4 flex-wrap">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Supplier</span>
          <MultiSelect
            className="min-w-[200px]"
            options={suppliers.map((s) => ({ value: s._id, label: s.name }))}
            selected={supplierIds}
            onChange={setSupplierIds}
            placeholder="All suppliers"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Product</span>
          <MultiSelect
            className="min-w-[200px]"
            options={products.map((p) => ({ value: p._id, label: `${p.name} (${p.sku})` }))}
            selected={productIds}
            onChange={setProductIds}
            placeholder="All products"
          />
        </label>
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" /></label>
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" /></label>
        <button onClick={run} disabled={loading} className="btn-primary disabled:opacity-60">{loading ? 'Running…' : 'Run Report'}</button>
      </div>

      {!data && !loading && (
        <div className="text-center py-12 text-slate-400">Select filters and click &ldquo;Run Report&rdquo; to view the purchase summary.</div>
      )}

      {data && (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Gross Purchases</div>
              <div className="font-figures text-lg font-semibold text-ink-900 mt-1">{money(data.summary.grossAmount)}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{data.summary.billCount} posted bill(s)</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Discounts Received</div>
              <div className="font-figures text-lg font-semibold text-ledger-teal mt-1">{money(data.summary.discount)}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Net Purchases: {money(data.summary.netAmount)}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Grand Total (Billed)</div>
              <div className="font-figures text-lg font-semibold text-ink-900 mt-1">{money(data.summary.grandTotal)}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Includes Tax: {money(data.summary.tax)}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Amount Paid</div>
              <div className="font-figures text-lg font-semibold text-ledger-teal mt-1">{money(data.summary.amountPaid)}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Allocated against bills</div>
            </div>
            <div className="bg-ink-900 rounded-xl p-4 text-white">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-300">Balance Due</div>
              <div className={`font-figures text-lg font-semibold mt-1 ${data.summary.balanceDue > 0 ? 'text-amber-300' : 'text-ledger-teal'}`}>
                {money(data.summary.balanceDue)}
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                Qty Purchased: <span className="font-semibold">{data.summary.quantity}</span>
              </div>
            </div>
          </div>

          <FilterBar
            search={search}
            onSearch={setSearch}
            placeholder={
              view === 'bill'
                ? 'Search bill #, ref, supplier, JV #, status…'
                : view === 'product'
                  ? 'Search SKU, product name, category…'
                  : view === 'supplier'
                    ? 'Search supplier code or name…'
                    : 'Search date or month…'
            }
            showClear={Boolean(search)}
            onClear={() => setSearch('')}
          >
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 flex-wrap">
              {VIEW_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setView(t.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    view === t.id ? 'bg-white text-ink-900 shadow-sm' : 'text-slate-600 hover:text-ink-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </FilterBar>

          {/* TAB 1: BY BILL */}
          {view === 'bill' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                    <th className="py-3 px-3 w-8"></th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Bill #</th>
                    <th className="py-3 px-3">JV #</th>
                    <th className="py-3 px-3">Supplier</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Qty</th>
                    <th className="py-3 px-3 text-right">Gross</th>
                    <th className="py-3 px-3 text-right">Discount</th>
                    <th className="py-3 px-3 text-right">Net Purchase</th>
                    <th className="py-3 px-3 text-right">Tax</th>
                    <th className="py-3 px-3 text-right">Grand Total</th>
                    <th className="py-3 px-3 text-right">Paid</th>
                    <th className="py-3 px-3 text-right">Balance Due</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleBills.length === 0 ? (
                    <tr><td colSpan={14} className="text-center py-8 text-slate-400">No bills match the selected filters.</td></tr>
                  ) : (
                    visibleBills.map((r) => {
                      const open = Boolean(expandedBills[r._id]);
                      return (
                        <Fragment key={r._id}>
                          <tr
                            onClick={() => toggleBill(r._id)}
                            className="border-b border-slate-100 hover:bg-slate-50/70 cursor-pointer"
                          >
                            <td className="py-2.5 px-3 text-slate-400">
                              {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">{formatDate(r.date)}</td>
                            <td className="py-2.5 px-3 font-medium text-ink-900 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <Link to={`/bills/${r._id}`} className="text-ledger-teal hover:underline">{r.billNumber}</Link>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <JvLink id={r.jvId} number={r.jvNumber} />
                            </td>
                            <td className="py-2.5 px-3">{r.supplierName}</td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                r.status === 'PAID'
                                  ? 'bg-ledger-tealLight text-ledger-teal'
                                  : r.status === 'PARTIALLY_PAID'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-slate-100 text-slate-700'
                              }`}>
                                {r.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-figures">{r.quantity}</td>
                            <td className="py-2.5 px-3 text-right font-figures">{money(r.grossAmount)}</td>
                            <td className="py-2.5 px-3 text-right font-figures text-ledger-teal">{r.discount > 0 ? money(r.discount) : '—'}</td>
                            <td className="py-2.5 px-3 text-right font-figures">{money(r.netAmount)}</td>
                            <td className="py-2.5 px-3 text-right font-figures">{r.tax > 0 ? money(r.tax) : '—'}</td>
                            <td className="py-2.5 px-3 text-right font-figures font-semibold text-ink-900">{money(r.grandTotal)}</td>
                            <td className="py-2.5 px-3 text-right font-figures text-ledger-teal">{r.amountPaid > 0 ? money(r.amountPaid) : '—'}</td>
                            <td className={`py-2.5 px-3 text-right font-figures font-medium ${r.balanceDue > 0 ? 'text-ledger-rose' : 'text-slate-400'}`}>
                              {r.balanceDue > 0 ? money(r.balanceDue) : '0.00'}
                            </td>
                          </tr>
                          {open && (
                            <tr className="bg-slate-50/90 border-b border-slate-200">
                              <td colSpan={14} className="px-6 py-3">
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                  Line Items in {r.billNumber}
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-left text-slate-400 border-b border-slate-200">
                                        <th className="py-1.5 pr-3">SKU</th>
                                        <th className="py-1.5 px-3">Product</th>
                                        <th className="py-1.5 px-3 text-right">Qty</th>
                                        <th className="py-1.5 px-3 text-right">Unit Cost</th>
                                        <th className="py-1.5 px-3 text-right">Gross</th>
                                        <th className="py-1.5 px-3 text-right">Disc ({`%`})</th>
                                        <th className="py-1.5 px-3 text-right">Net Cost</th>
                                        <th className="py-1.5 px-3 text-right">Tax ({`%`})</th>
                                        <th className="py-1.5 pl-3 text-right">Line Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {r.items.map((it, idx) => (
                                        <tr key={idx} className="border-b border-slate-100 last:border-b-0">
                                          <td className="py-1.5 pr-3 font-mono text-slate-500">{it.sku}</td>
                                          <td className="py-1.5 px-3 font-medium text-ink-800">{it.productName}</td>
                                          <td className="py-1.5 px-3 text-right font-figures">{it.quantity} {it.unit}</td>
                                          <td className="py-1.5 px-3 text-right font-figures">{money(it.unitCost)}</td>
                                          <td className="py-1.5 px-3 text-right font-figures">{money(it.grossAmount)}</td>
                                          <td className="py-1.5 px-3 text-right font-figures text-ledger-teal">
                                            {it.discount > 0 ? `${money(it.discount)} (${it.discountRate}%)` : '—'}
                                          </td>
                                          <td className="py-1.5 px-3 text-right font-figures">{money(it.netAmount)}</td>
                                          <td className="py-1.5 px-3 text-right font-figures">
                                            {it.tax > 0 ? `${money(it.tax)} (${it.taxRate}%)` : '—'}
                                          </td>
                                          <td className="py-1.5 pl-3 text-right font-figures font-semibold text-ink-900">
                                            {money(it.lineTotal)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
                {visibleBills.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 font-semibold bg-slate-50">
                      <td colSpan={6} className="py-3 px-3">Total ({visibleBills.length} bill{visibleBills.length === 1 ? '' : 's'})</td>
                      <td className="py-3 px-3 text-right font-figures">{totals.quantity}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.grossAmount)}</td>
                      <td className="py-3 px-3 text-right font-figures text-ledger-teal">{money(totals.discount)}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.netAmount)}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.tax)}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.grandTotal)}</td>
                      <td className="py-3 px-3 text-right font-figures text-ledger-teal">{money(totals.amountPaid)}</td>
                      <td className="py-3 px-3 text-right font-figures text-ledger-rose">{money(totals.balanceDue)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* TAB 2: BY PRODUCT */}
          {view === 'product' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-3 text-right">Bills</th>
                    <th className="py-3 px-3 text-right">Qty Purchased</th>
                    <th className="py-3 px-3 text-right">Avg Net Cost</th>
                    <th className="py-3 px-3 text-right">Gross Amount</th>
                    <th className="py-3 px-3 text-right">Discount</th>
                    <th className="py-3 px-3 text-right">Net Purchase</th>
                    <th className="py-3 px-3 text-right">Tax</th>
                    <th className="py-3 px-4 text-right">Total (Incl. Tax)</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-8 text-slate-400">No products match the selected filters.</td></tr>
                  ) : (
                    visibleProducts.map((r) => (
                      <tr key={r._id} className="border-b border-slate-100 hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-mono text-xs text-slate-600">{r.sku}</td>
                        <td className="py-2.5 px-4 font-medium text-ink-900">{r.productName}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{r.billCount}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{r.quantity} {r.unit}</td>
                        <td className="py-2.5 px-3 text-right font-figures text-slate-600">{money(r.avgCost)}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{money(r.grossAmount)}</td>
                        <td className="py-2.5 px-3 text-right font-figures text-ledger-teal">{r.discount > 0 ? money(r.discount) : '—'}</td>
                        <td className="py-2.5 px-3 text-right font-figures font-medium">{money(r.netAmount)}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{r.tax > 0 ? money(r.tax) : '—'}</td>
                        <td className="py-2.5 px-4 text-right font-figures font-semibold text-ink-900">{money(r.lineTotal)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {visibleProducts.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 font-semibold bg-slate-50">
                      <td colSpan={3} className="py-3 px-4">Total ({visibleProducts.length} product{visibleProducts.length === 1 ? '' : 's'})</td>
                      <td className="py-3 px-3 text-right font-figures">{totals.quantity}</td>
                      <td className="py-3 px-3 text-right font-figures"></td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.grossAmount)}</td>
                      <td className="py-3 px-3 text-right font-figures text-ledger-teal">{money(totals.discount)}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.netAmount)}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.tax)}</td>
                      <td className="py-3 px-4 text-right font-figures">{money(totals.grandTotal)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* TAB 3: BY SUPPLIER */}
          {view === 'supplier' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-3 text-right">Bills</th>
                    <th className="py-3 px-3 text-right">Qty Purchased</th>
                    <th className="py-3 px-3 text-right">Gross Amount</th>
                    <th className="py-3 px-3 text-right">Discount</th>
                    <th className="py-3 px-3 text-right">Net Purchase</th>
                    <th className="py-3 px-3 text-right">Tax</th>
                    <th className="py-3 px-3 text-right">Grand Total</th>
                    <th className="py-3 px-3 text-right">Paid</th>
                    <th className="py-3 px-4 text-right">Balance Due</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSuppliers.length === 0 ? (
                    <tr><td colSpan={11} className="text-center py-8 text-slate-400">No suppliers match the selected filters.</td></tr>
                  ) : (
                    visibleSuppliers.map((r) => (
                      <tr key={r._id} className="border-b border-slate-100 hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-mono text-xs text-slate-600">{r.supplierCode}</td>
                        <td className="py-2.5 px-4 font-medium text-ink-900">{r.supplierName}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{r.billCount}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{r.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{money(r.grossAmount)}</td>
                        <td className="py-2.5 px-3 text-right font-figures text-ledger-teal">{r.discount > 0 ? money(r.discount) : '—'}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{money(r.netAmount)}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{r.tax > 0 ? money(r.tax) : '—'}</td>
                        <td className="py-2.5 px-3 text-right font-figures font-semibold text-ink-900">{money(r.grandTotal)}</td>
                        <td className="py-2.5 px-3 text-right font-figures text-ledger-teal">{r.amountPaid > 0 ? money(r.amountPaid) : '—'}</td>
                        <td className={`py-2.5 px-4 text-right font-figures font-medium ${r.balanceDue > 0 ? 'text-ledger-rose' : 'text-slate-400'}`}>
                          {r.balanceDue > 0 ? money(r.balanceDue) : '0.00'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {visibleSuppliers.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 font-semibold bg-slate-50">
                      <td colSpan={2} className="py-3 px-4">Total ({visibleSuppliers.length} supplier{visibleSuppliers.length === 1 ? '' : 's'})</td>
                      <td className="py-3 px-3 text-right font-figures">{totals.billCount}</td>
                      <td className="py-3 px-3 text-right font-figures">{totals.quantity}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.grossAmount)}</td>
                      <td className="py-3 px-3 text-right font-figures text-ledger-teal">{money(totals.discount)}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.netAmount)}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.tax)}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.grandTotal)}</td>
                      <td className="py-3 px-3 text-right font-figures text-ledger-teal">{money(totals.amountPaid)}</td>
                      <td className="py-3 px-4 text-right font-figures text-ledger-rose">{money(totals.balanceDue)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* TAB 4: BY DAY */}
          {view === 'daily' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-3 text-right">Bills</th>
                    <th className="py-3 px-3 text-right">Qty Purchased</th>
                    <th className="py-3 px-3 text-right">Gross Amount</th>
                    <th className="py-3 px-3 text-right">Discount</th>
                    <th className="py-3 px-3 text-right">Net Purchase</th>
                    <th className="py-3 px-3 text-right">Tax</th>
                    <th className="py-3 px-3 text-right">Grand Total</th>
                    <th className="py-3 px-3 text-right">Paid</th>
                    <th className="py-3 px-4 text-right">Balance Due</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDaily.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-8 text-slate-400">No daily records match the selected filters.</td></tr>
                  ) : (
                    visibleDaily.map((r) => (
                      <tr key={r._id} className="border-b border-slate-100 hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-medium text-ink-900 whitespace-nowrap">{formatDate(r.date)}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{r.billCount}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{r.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{money(r.grossAmount)}</td>
                        <td className="py-2.5 px-3 text-right font-figures text-ledger-teal">{r.discount > 0 ? money(r.discount) : '—'}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{money(r.netAmount)}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{r.tax > 0 ? money(r.tax) : '—'}</td>
                        <td className="py-2.5 px-3 text-right font-figures font-semibold text-ink-900">{money(r.grandTotal)}</td>
                        <td className="py-2.5 px-3 text-right font-figures text-ledger-teal">{r.amountPaid > 0 ? money(r.amountPaid) : '—'}</td>
                        <td className={`py-2.5 px-4 text-right font-figures font-medium ${r.balanceDue > 0 ? 'text-ledger-rose' : 'text-slate-400'}`}>
                          {r.balanceDue > 0 ? money(r.balanceDue) : '0.00'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {visibleDaily.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 font-semibold bg-slate-50">
                      <td className="py-3 px-4">Total ({visibleDaily.length} day{visibleDaily.length === 1 ? '' : 's'})</td>
                      <td className="py-3 px-3 text-right font-figures">{totals.billCount}</td>
                      <td className="py-3 px-3 text-right font-figures">{totals.quantity}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.grossAmount)}</td>
                      <td className="py-3 px-3 text-right font-figures text-ledger-teal">{money(totals.discount)}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.netAmount)}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.tax)}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.grandTotal)}</td>
                      <td className="py-3 px-3 text-right font-figures text-ledger-teal">{money(totals.amountPaid)}</td>
                      <td className="py-3 px-4 text-right font-figures text-ledger-rose">{money(totals.balanceDue)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* TAB 5: BY MONTH */}
          {view === 'monthly' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                    <th className="py-3 px-4">Month</th>
                    <th className="py-3 px-3 text-right">Bills</th>
                    <th className="py-3 px-3 text-right">Qty Purchased</th>
                    <th className="py-3 px-3 text-right">Gross Amount</th>
                    <th className="py-3 px-3 text-right">Discount</th>
                    <th className="py-3 px-3 text-right">Net Purchase</th>
                    <th className="py-3 px-3 text-right">Tax</th>
                    <th className="py-3 px-3 text-right">Grand Total</th>
                    <th className="py-3 px-3 text-right">Paid</th>
                    <th className="py-3 px-4 text-right">Balance Due</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMonthly.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-8 text-slate-400">No monthly records match the selected filters.</td></tr>
                  ) : (
                    visibleMonthly.map((r) => (
                      <tr key={r._id} className="border-b border-slate-100 hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-medium text-ink-900 whitespace-nowrap">{r.monthLabel}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{r.billCount}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{r.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{money(r.grossAmount)}</td>
                        <td className="py-2.5 px-3 text-right font-figures text-ledger-teal">{r.discount > 0 ? money(r.discount) : '—'}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{money(r.netAmount)}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{r.tax > 0 ? money(r.tax) : '—'}</td>
                        <td className="py-2.5 px-3 text-right font-figures font-semibold text-ink-900">{money(r.grandTotal)}</td>
                        <td className="py-2.5 px-3 text-right font-figures text-ledger-teal">{r.amountPaid > 0 ? money(r.amountPaid) : '—'}</td>
                        <td className={`py-2.5 px-4 text-right font-figures font-medium ${r.balanceDue > 0 ? 'text-ledger-rose' : 'text-slate-400'}`}>
                          {r.balanceDue > 0 ? money(r.balanceDue) : '0.00'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {visibleMonthly.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 font-semibold bg-slate-50">
                      <td className="py-3 px-4">Total ({visibleMonthly.length} month{visibleMonthly.length === 1 ? '' : 's'})</td>
                      <td className="py-3 px-3 text-right font-figures">{totals.billCount}</td>
                      <td className="py-3 px-3 text-right font-figures">{totals.quantity}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.grossAmount)}</td>
                      <td className="py-3 px-3 text-right font-figures text-ledger-teal">{money(totals.discount)}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.netAmount)}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.tax)}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.grandTotal)}</td>
                      <td className="py-3 px-3 text-right font-figures text-ledger-teal">{money(totals.amountPaid)}</td>
                      <td className="py-3 px-4 text-right font-figures text-ledger-rose">{money(totals.balanceDue)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </>
      )}
    </PageLayout>
  );
}
