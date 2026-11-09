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
  { id: 'invoice', label: 'By Invoice' },
  { id: 'product', label: 'By Product (Item)' },
  { id: 'customer', label: 'By Customer' }
];

export default function SalesProfitLoss() {
  const [data, setData] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerIds, setCustomerIds] = useState([]);
  const [productIds, setProductIds] = useState([]);
  const [from, setFrom] = useState(firstOfMonthLocalISODate());
  const [to, setTo] = useState(lastOfMonthLocalISODate());
  const [view, setView] = useState('invoice');
  const [expandedInvoices, setExpandedInvoices] = useState({});
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/customers').then((res) => setCustomers(res.data)).catch(() => {});
    api.get('/products').then((res) => setProducts(res.data)).catch(() => {});
  }, []);

  const run = () => {
    setLoading(true);
    setError('');
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (customerIds.length) params.customerId = customerIds.join(',');
    if (productIds.length) params.productId = productIds.join(',');
    api.get('/reports/sales-profit-loss', { params })
      .then((res) => {
        setData(res.data);
        setExpandedInvoices({});
      })
      .catch(() => setError('Could not load sales profit & margin report.'))
      .finally(() => setLoading(false));
  };

  const toggleInvoice = (id) => {
    setExpandedInvoices((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const money = formatMoney;
  const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

  const visibleInvoices = (data?.invoiceRows || []).filter((r) =>
    matchesSearch(search, r.invoiceNumber, r.customerName, r.customerCode, r.jvNumber)
  );
  const visibleProducts = (data?.productRows || []).filter((r) =>
    matchesSearch(search, r.sku, r.productName, r.unit)
  );
  const visibleCustomers = (data?.customerRows || []).filter((r) =>
    matchesSearch(search, r.customerCode, r.customerName)
  );

  const activeRows = view === 'invoice' ? visibleInvoices : view === 'product' ? visibleProducts : visibleCustomers;

  const totals = activeRows.reduce(
    (acc, r) => {
      acc.quantity = round2(acc.quantity + Number(r.quantity || 0));
      acc.grossSale = round2(acc.grossSale + Number(r.grossSale || 0));
      acc.discount = round2(acc.discount + Number(r.discount || 0));
      acc.netSale = round2(acc.netSale + Number(r.netSale || 0));
      acc.cogs = round2(acc.cogs + Number(r.cogs || 0));
      acc.grossProfit = round2(acc.grossProfit + Number(r.grossProfit || 0));
      return acc;
    },
    { quantity: 0, grossSale: 0, discount: 0, netSale: 0, cogs: 0, grossProfit: 0 }
  );
  totals.marginPct = totals.netSale !== 0 ? round2((totals.grossProfit / totals.netSale) * 100) : 0;

  const customerNames = customers.filter((c) => customerIds.includes(c._id)).map((c) => c.name).join(', ');
  const productNames = products.filter((p) => productIds.includes(p._id)).map((p) => p.name).join(', ');
  const subtitle = `Period: ${from ? formatDate(from) : 'inception'} to ${to ? formatDate(to) : 'today'}${customerNames ? ` — Customer: ${customerNames}` : ''}${productNames ? ` — Product: ${productNames}` : ''}${filterNote(search, ['View', view])}`;

  const getExportSpec = () => {
    if (view === 'invoice') {
      const cols = [
        { key: 'date', label: 'Date', date: true },
        { key: 'invoiceNumber', label: 'Invoice #' },
        { key: 'customerName', label: 'Customer' },
        { key: 'quantity', label: 'Qty', align: 'right' },
        { key: 'grossSale', label: 'Gross Sale', align: 'right', money: true },
        { key: 'discount', label: 'Discount', align: 'right', money: true },
        { key: 'netSale', label: 'Net Sale', align: 'right', money: true },
        { key: 'cogs', label: 'COGS (Cost)', align: 'right', money: true },
        { key: 'grossProfit', label: 'Profit', align: 'right', money: true },
        { key: 'marginPct', label: 'Margin %', align: 'right' }
      ];
      const rows = visibleInvoices.map((r) => ({ ...r, marginPct: `${r.marginPct}%` }));
      const tot = [`Total (${rows.length})`, '', '', totals.quantity, money(totals.grossSale), money(totals.discount), money(totals.netSale), money(totals.cogs), money(totals.grossProfit), `${totals.marginPct}%`];
      return { title: 'Sales Profit & Margin (By Invoice)', columns: cols, rows, totals: tot };
    }
    if (view === 'product') {
      const cols = [
        { key: 'sku', label: 'SKU' },
        { key: 'productName', label: 'Product' },
        { key: 'unit', label: 'Unit' },
        { key: 'invoiceCount', label: 'Invoices', align: 'right' },
        { key: 'quantity', label: 'Qty Sold', align: 'right' },
        { key: 'grossSale', label: 'Gross Sale', align: 'right', money: true },
        { key: 'discount', label: 'Discount', align: 'right', money: true },
        { key: 'netSale', label: 'Net Sale', align: 'right', money: true },
        { key: 'cogs', label: 'COGS (Cost)', align: 'right', money: true },
        { key: 'grossProfit', label: 'Profit', align: 'right', money: true },
        { key: 'marginPct', label: 'Margin %', align: 'right' }
      ];
      const rows = visibleProducts.map((r) => ({ ...r, marginPct: `${r.marginPct}%` }));
      const tot = [`Total (${rows.length})`, '', '', '', totals.quantity, money(totals.grossSale), money(totals.discount), money(totals.netSale), money(totals.cogs), money(totals.grossProfit), `${totals.marginPct}%`];
      return { title: 'Sales Profit & Margin (By Product)', columns: cols, rows, totals: tot };
    }
    const cols = [
      { key: 'customerCode', label: 'Code' },
      { key: 'customerName', label: 'Customer' },
      { key: 'invoiceCount', label: 'Invoices', align: 'right' },
      { key: 'quantity', label: 'Qty Sold', align: 'right' },
      { key: 'grossSale', label: 'Gross Sale', align: 'right', money: true },
      { key: 'discount', label: 'Discount', align: 'right', money: true },
      { key: 'netSale', label: 'Net Sale', align: 'right', money: true },
      { key: 'cogs', label: 'COGS (Cost)', align: 'right', money: true },
      { key: 'grossProfit', label: 'Profit', align: 'right', money: true },
      { key: 'marginPct', label: 'Margin %', align: 'right' }
    ];
    const rows = visibleCustomers.map((r) => ({ ...r, marginPct: `${r.marginPct}%` }));
    const tot = [`Total (${rows.length})`, '', '', totals.quantity, money(totals.grossSale), money(totals.discount), money(totals.netSale), money(totals.cogs), money(totals.grossProfit), `${totals.marginPct}%`];
    return { title: 'Sales Profit & Margin (By Customer)', columns: cols, rows, totals: tot };
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
      title="Sales Profit &amp; Margin"
      subtitle="Invoice-wise, Product-wise &amp; Customer-wise Gross Profit and Margin breakdown"
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/reports/profit-and-loss" className="btn-ghost border border-slate-200 text-xs">
            ← Financial P&amp;L Statement
          </Link>
          {data && <ReportExportButtons onPdf={exportPdf} onExcel={exportExcel} />}
        </div>
      }
    >
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
      <div className="flex items-end gap-3 mb-4 flex-wrap">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Customer</span>
          <MultiSelect
            className="min-w-[200px]"
            options={customers.map((c) => ({ value: c._id, label: c.name }))}
            selected={customerIds}
            onChange={setCustomerIds}
            placeholder="All customers"
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
        <div className="text-center py-12 text-slate-400">Select filters and click &ldquo;Run Report&rdquo; to view sales profit and margins.</div>
      )}

      {data && (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Gross Sales</div>
              <div className="font-figures text-lg font-semibold text-ink-900 mt-1">{money(totals.grossSale)}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{data.summary.invoiceCount} posted invoice(s)</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Discounts Given</div>
              <div className="font-figures text-lg font-semibold text-ledger-rose mt-1">{money(totals.discount)}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Line-item sales discounts</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Net Sales Revenue</div>
              <div className="font-figures text-lg font-semibold text-ink-900 mt-1">{money(totals.netSale)}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Gross − Discounts (Excl. tax)</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Cost of Goods Sold</div>
              <div className="font-figures text-lg font-semibold text-ink-900 mt-1">{money(totals.cogs)}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Stock cost at sale time</div>
            </div>
            <div className="bg-ink-900 rounded-xl p-4 text-white">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-300">Gross Profit &amp; Margin</div>
              <div className={`font-figures text-lg font-semibold mt-1 ${totals.grossProfit >= 0 ? 'text-ledger-teal' : 'text-ledger-rose'}`}>
                {money(totals.grossProfit)}
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                Margin: <span className="font-semibold">{totals.marginPct}%</span>
              </div>
            </div>
          </div>

          <FilterBar
            search={search}
            onSearch={setSearch}
            placeholder={
              view === 'invoice'
                ? 'Search invoice #, customer, JV #…'
                : view === 'product'
                  ? 'Search SKU or product name…'
                  : 'Search customer code or name…'
            }
            showClear={Boolean(search)}
            onClear={() => setSearch('')}
          >
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
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

          {/* TAB 1: BY INVOICE */}
          {view === 'invoice' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                    <th className="py-3 px-3 w-8"></th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Invoice #</th>
                    <th className="py-3 px-3">JV #</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3 text-right">Qty</th>
                    <th className="py-3 px-3 text-right">Gross Sale</th>
                    <th className="py-3 px-3 text-right">Discount</th>
                    <th className="py-3 px-3 text-right">Net Sale</th>
                    <th className="py-3 px-3 text-right">COGS (Cost)</th>
                    <th className="py-3 px-3 text-right">Profit</th>
                    <th className="py-3 px-3 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleInvoices.length === 0 ? (
                    <tr><td colSpan={12} className="text-center py-8 text-slate-400">No invoices match the selected filters.</td></tr>
                  ) : (
                    visibleInvoices.map((r) => {
                      const open = Boolean(expandedInvoices[r._id]);
                      return (
                        <Fragment key={r._id}>
                          <tr
                            onClick={() => toggleInvoice(r._id)}
                            className="border-b border-slate-100 hover:bg-slate-50/70 cursor-pointer"
                          >
                            <td className="py-2.5 px-3 text-slate-400">
                              {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">{formatDate(r.date)}</td>
                            <td className="py-2.5 px-3 font-medium text-ink-900 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <Link to={`/invoices/${r._id}`} className="text-ledger-teal hover:underline">{r.invoiceNumber}</Link>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <JvLink id={r.jvId} number={r.jvNumber} />
                            </td>
                            <td className="py-2.5 px-3">{r.customerName}</td>
                            <td className="py-2.5 px-3 text-right font-figures">{r.quantity}</td>
                            <td className="py-2.5 px-3 text-right font-figures">{money(r.grossSale)}</td>
                            <td className="py-2.5 px-3 text-right font-figures text-ledger-rose">{r.discount > 0 ? money(r.discount) : '—'}</td>
                            <td className="py-2.5 px-3 text-right font-figures font-medium">{money(r.netSale)}</td>
                            <td className="py-2.5 px-3 text-right font-figures">{money(r.cogs)}</td>
                            <td className={`py-2.5 px-3 text-right font-figures font-semibold ${r.grossProfit >= 0 ? 'text-ledger-teal' : 'text-ledger-rose'}`}>
                              {money(r.grossProfit)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-figures">
                              <span className={`px-2 py-0.5 rounded-full text-xs ${r.marginPct >= 0 ? 'bg-ledger-tealLight text-ledger-teal' : 'bg-ledger-roseLight text-ledger-rose'}`}>
                                {r.marginPct}%
                              </span>
                            </td>
                          </tr>
                          {open && (
                            <tr className="bg-slate-50/90 border-b border-slate-200">
                              <td colSpan={12} className="px-6 py-3">
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                  Line Items in {r.invoiceNumber}
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-left text-slate-400 border-b border-slate-200">
                                        <th className="py-1.5 pr-3">SKU</th>
                                        <th className="py-1.5 px-3">Product</th>
                                        <th className="py-1.5 px-3 text-right">Qty</th>
                                        <th className="py-1.5 px-3 text-right">Unit Price</th>
                                        <th className="py-1.5 px-3 text-right">Gross</th>
                                        <th className="py-1.5 px-3 text-right">Disc ({`%`})</th>
                                        <th className="py-1.5 px-3 text-right">Net Sale</th>
                                        <th className="py-1.5 px-3 text-right">Unit Cost</th>
                                        <th className="py-1.5 px-3 text-right">COGS</th>
                                        <th className="py-1.5 px-3 text-right">Profit</th>
                                        <th className="py-1.5 pl-3 text-right">Margin</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {r.items.map((it, idx) => (
                                        <tr key={idx} className="border-b border-slate-100 last:border-b-0">
                                          <td className="py-1.5 pr-3 font-mono text-slate-500">{it.sku}</td>
                                          <td className="py-1.5 px-3 font-medium text-ink-800">{it.productName}</td>
                                          <td className="py-1.5 px-3 text-right font-figures">{it.quantity} {it.unit}</td>
                                          <td className="py-1.5 px-3 text-right font-figures">{money(it.unitPrice)}</td>
                                          <td className="py-1.5 px-3 text-right font-figures">{money(it.grossSale)}</td>
                                          <td className="py-1.5 px-3 text-right font-figures text-ledger-rose">
                                            {it.discount > 0 ? `${money(it.discount)} (${it.discountRate}%)` : '—'}
                                          </td>
                                          <td className="py-1.5 px-3 text-right font-figures">{money(it.netSale)}</td>
                                          <td className="py-1.5 px-3 text-right font-figures">{money(it.unitCost)}</td>
                                          <td className="py-1.5 px-3 text-right font-figures">{money(it.cogs)}</td>
                                          <td className={`py-1.5 px-3 text-right font-figures font-semibold ${it.grossProfit >= 0 ? 'text-ledger-teal' : 'text-ledger-rose'}`}>
                                            {money(it.grossProfit)}
                                          </td>
                                          <td className="py-1.5 pl-3 text-right font-figures">{it.marginPct}%</td>
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
                {visibleInvoices.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 font-semibold bg-slate-50">
                      <td colSpan={5} className="py-3 px-3">Total ({visibleInvoices.length} invoice{visibleInvoices.length === 1 ? '' : 's'})</td>
                      <td className="py-3 px-3 text-right font-figures">{totals.quantity}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.grossSale)}</td>
                      <td className="py-3 px-3 text-right font-figures text-ledger-rose">{money(totals.discount)}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.netSale)}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.cogs)}</td>
                      <td className={`py-3 px-3 text-right font-figures ${totals.grossProfit >= 0 ? 'text-ledger-teal' : 'text-ledger-rose'}`}>
                        {money(totals.grossProfit)}
                      </td>
                      <td className="py-3 px-3 text-right font-figures">{totals.marginPct}%</td>
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
                    <th className="py-3 px-3 text-right">Invoices</th>
                    <th className="py-3 px-3 text-right">Qty Sold</th>
                    <th className="py-3 px-3 text-right">Gross Sale</th>
                    <th className="py-3 px-3 text-right">Discount</th>
                    <th className="py-3 px-3 text-right">Net Sale</th>
                    <th className="py-3 px-3 text-right">COGS (Cost)</th>
                    <th className="py-3 px-3 text-right">Profit</th>
                    <th className="py-3 px-4 text-right">Margin %</th>
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
                        <td className="py-2.5 px-3 text-right font-figures">{r.invoiceCount}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{r.quantity} {r.unit}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{money(r.grossSale)}</td>
                        <td className="py-2.5 px-3 text-right font-figures text-ledger-rose">{r.discount > 0 ? money(r.discount) : '—'}</td>
                        <td className="py-2.5 px-3 text-right font-figures font-medium">{money(r.netSale)}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{money(r.cogs)}</td>
                        <td className={`py-2.5 px-3 text-right font-figures font-semibold ${r.grossProfit >= 0 ? 'text-ledger-teal' : 'text-ledger-rose'}`}>
                          {money(r.grossProfit)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-figures">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${r.marginPct >= 0 ? 'bg-ledger-tealLight text-ledger-teal' : 'bg-ledger-roseLight text-ledger-rose'}`}>
                            {r.marginPct}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {visibleProducts.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 font-semibold bg-slate-50">
                      <td colSpan={3} className="py-3 px-4">Total ({visibleProducts.length} product{visibleProducts.length === 1 ? '' : 's'})</td>
                      <td className="py-3 px-3 text-right font-figures">{totals.quantity}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.grossSale)}</td>
                      <td className="py-3 px-3 text-right font-figures text-ledger-rose">{money(totals.discount)}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.netSale)}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.cogs)}</td>
                      <td className={`py-3 px-3 text-right font-figures ${totals.grossProfit >= 0 ? 'text-ledger-teal' : 'text-ledger-rose'}`}>
                        {money(totals.grossProfit)}
                      </td>
                      <td className="py-3 px-4 text-right font-figures">{totals.marginPct}%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* TAB 3: BY CUSTOMER */}
          {view === 'customer' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-3 text-right">Invoices</th>
                    <th className="py-3 px-3 text-right">Qty Sold</th>
                    <th className="py-3 px-3 text-right">Gross Sale</th>
                    <th className="py-3 px-3 text-right">Discount</th>
                    <th className="py-3 px-3 text-right">Net Sale</th>
                    <th className="py-3 px-3 text-right">COGS (Cost)</th>
                    <th className="py-3 px-3 text-right">Profit</th>
                    <th className="py-3 px-4 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCustomers.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-8 text-slate-400">No customers match the selected filters.</td></tr>
                  ) : (
                    visibleCustomers.map((r) => (
                      <tr key={r._id} className="border-b border-slate-100 hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-mono text-xs text-slate-600">{r.customerCode}</td>
                        <td className="py-2.5 px-4 font-medium text-ink-900">{r.customerName}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{r.invoiceCount}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{r.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{money(r.grossSale)}</td>
                        <td className="py-2.5 px-3 text-right font-figures text-ledger-rose">{r.discount > 0 ? money(r.discount) : '—'}</td>
                        <td className="py-2.5 px-3 text-right font-figures font-medium">{money(r.netSale)}</td>
                        <td className="py-2.5 px-3 text-right font-figures">{money(r.cogs)}</td>
                        <td className={`py-2.5 px-3 text-right font-figures font-semibold ${r.grossProfit >= 0 ? 'text-ledger-teal' : 'text-ledger-rose'}`}>
                          {money(r.grossProfit)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-figures">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${r.marginPct >= 0 ? 'bg-ledger-tealLight text-ledger-teal' : 'bg-ledger-roseLight text-ledger-rose'}`}>
                            {r.marginPct}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {visibleCustomers.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 font-semibold bg-slate-50">
                      <td colSpan={3} className="py-3 px-4">Total ({visibleCustomers.length} customer{visibleCustomers.length === 1 ? '' : 's'})</td>
                      <td className="py-3 px-3 text-right font-figures">{totals.quantity}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.grossSale)}</td>
                      <td className="py-3 px-3 text-right font-figures text-ledger-rose">{money(totals.discount)}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.netSale)}</td>
                      <td className="py-3 px-3 text-right font-figures">{money(totals.cogs)}</td>
                      <td className={`py-3 px-3 text-right font-figures ${totals.grossProfit >= 0 ? 'text-ledger-teal' : 'text-ledger-rose'}`}>
                        {money(totals.grossProfit)}
                      </td>
                      <td className="py-3 px-4 text-right font-figures">{totals.marginPct}%</td>
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
