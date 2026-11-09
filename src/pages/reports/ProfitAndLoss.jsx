import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import ReportExportButtons from '../../components/ReportExportButtons';
import FilterBar, { matchesSearch, filterNote } from '../../components/FilterBar';
import { downloadReportPdf, downloadReportExcel } from '../../components/reportExport';
import { formatMoney, formatDate, firstOfMonthLocalISODate, lastOfMonthLocalISODate } from '../../components/ui';

const columns = [
  { key: 'code', label: 'Code' },
  { key: 'name', label: 'Account / Line Item' },
  { key: 'section', label: 'Section' },
  { key: 'amount', label: 'Amount', align: 'right', money: true }
];

function buildStructuredPnl(raw) {
  if (!raw) return null;
  if (Array.isArray(raw.salesRevenue)) return raw;

  // Fallback if backend returns only { income, expense, totalIncome, totalExpense, netProfit }
  const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
  const salesRevenue = [];
  const salesDiscounts = [];
  const cogs = [];
  const purchaseDiscounts = [];
  const otherIncome = [];
  const operatingExpenses = [];

  for (const r of raw.income || []) {
    if (r.code === '4000') salesRevenue.push(r);
    else if (r.code === '4400') purchaseDiscounts.push(r);
    else otherIncome.push(r);
  }
  for (const r of raw.expense || []) {
    if (r.code === '5700') salesDiscounts.push(r);
    else if (['5000', '5800', '5900'].includes(r.code)) cogs.push(r);
    else operatingExpenses.push(r);
  }

  const sum = (arr) => round2(arr.reduce((s, x) => s + Number(x.amount || 0), 0));
  const grossSales = sum(salesRevenue);
  const totalSalesDiscounts = sum(salesDiscounts);
  const netSales = round2(grossSales - totalSalesDiscounts);
  const grossCogs = sum(cogs);
  const totalPurchaseDiscounts = sum(purchaseDiscounts);
  const netCogs = round2(grossCogs - totalPurchaseDiscounts);
  const grossProfit = round2(netSales - netCogs);
  const grossMarginPct = netSales !== 0 ? round2((grossProfit / netSales) * 100) : 0;
  const totalOperatingExpenses = sum(operatingExpenses);
  const totalOtherIncome = sum(otherIncome);
  const operatingProfit = round2(grossProfit - totalOperatingExpenses);
  const netProfit = round2(raw.netProfit ?? (operatingProfit + totalOtherIncome));
  const netMarginPct = netSales !== 0 ? round2((netProfit / netSales) * 100) : 0;

  return {
    ...raw,
    salesRevenue,
    salesDiscounts,
    grossSales,
    totalSalesDiscounts,
    netSales,
    cogs,
    purchaseDiscounts,
    grossCogs,
    totalPurchaseDiscounts,
    netCogs,
    grossProfit,
    grossMarginPct,
    operatingExpenses,
    totalOperatingExpenses,
    operatingProfit,
    otherIncome,
    totalOtherIncome,
    netProfit,
    netMarginPct
  };
}

export default function ProfitAndLoss() {
  const [rawData, setRawData] = useState(null);
  const [from, setFrom] = useState(firstOfMonthLocalISODate());
  const [to, setTo] = useState(lastOfMonthLocalISODate());
  const [search, setSearch] = useState('');
  const [hideZero, setHideZero] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const run = () => {
    setLoading(true);
    setError('');
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    api.get('/reports/profit-and-loss', { params })
      .then((res) => setRawData(res.data))
      .catch(() => setError('Could not load the profit & loss report.'))
      .finally(() => setLoading(false));
  };

  const data = buildStructuredPnl(rawData);
  const lineVisible = (r) => matchesSearch(search, r.code, r.name) && (!hideZero || Number(r.amount || 0) !== 0);
  const hasFilters = Boolean(search || !hideZero);
  const clearFilters = () => { setSearch(''); setHideZero(true); };
  const subtitle = `Period: ${from ? formatDate(from) : 'inception'} to ${to ? formatDate(to) : 'today'}${filterNote(search, ['Balances', hideZero && 'Non-zero only'])}`;

  const exportRows = () => {
    if (!data) return [];
    const rows = [];
    data.salesRevenue.filter(lineVisible).forEach((r) => rows.push({ code: r.code, name: r.name, section: '1. Sales Revenue', amount: r.amount }));
    data.salesDiscounts.filter(lineVisible).forEach((r) => rows.push({ code: r.code, name: `Less: ${r.name}`, section: '1. Sales Revenue', amount: -r.amount }));
    rows.push({ code: '', name: 'Net Sales Revenue', section: 'Subtotal', amount: data.netSales });

    data.cogs.filter(lineVisible).forEach((r) => rows.push({ code: r.code, name: r.name, section: '2. Cost of Sales', amount: r.amount }));
    data.purchaseDiscounts.filter(lineVisible).forEach((r) => rows.push({ code: r.code, name: `Less: ${r.name}`, section: '2. Cost of Sales', amount: -r.amount }));
    rows.push({ code: '', name: 'Net Cost of Sales', section: 'Subtotal', amount: data.netCogs });
    rows.push({ code: '', name: `Gross Profit (${data.grossMarginPct}%)`, section: 'Gross Profit', amount: data.grossProfit });

    data.operatingExpenses.filter(lineVisible).forEach((r) => rows.push({ code: r.code, name: r.name, section: '3. Operating Expenses', amount: r.amount }));
    rows.push({ code: '', name: 'Total Operating Expenses', section: 'Subtotal', amount: data.totalOperatingExpenses });
    rows.push({ code: '', name: 'Operating Profit (EBIT)', section: 'Operating Profit', amount: data.operatingProfit });

    data.otherIncome.filter(lineVisible).forEach((r) => rows.push({ code: r.code, name: r.name, section: '4. Other Income', amount: r.amount }));
    return rows;
  };

  const exportTotals = () => ['', `Net Profit (${data.netMarginPct}%)`, '', formatMoney(data.netProfit)];
  const exportPdf = () => downloadReportPdf({ title: 'Profit & Loss Statement', subtitle, columns, rows: exportRows(), totals: exportTotals() });
  const exportExcel = () => downloadReportExcel({ title: 'Profit & Loss Statement', subtitle, columns, rows: exportRows(), totals: exportTotals() });

  const money = formatMoney;

  const renderAccountRow = (r, { isDeduction = false } = {}) => {
    const displayAmount = isDeduction ? -Number(r.amount || 0) : Number(r.amount || 0);
    return (
      <div key={r.code} className="flex items-center justify-between py-2 px-4 text-sm border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">{r.code}</span>
          <span className="text-ink-800 truncate">
            {isDeduction ? `Less: ${r.name}` : r.name}
          </span>
        </div>
        <span className={`font-figures shrink-0 ml-3 ${isDeduction && r.amount > 0 ? 'text-ledger-rose' : 'text-ink-800'}`}>
          {isDeduction && r.amount > 0 ? `(${money(r.amount)})` : money(displayAmount)}
        </span>
      </div>
    );
  };

  return (
    <PageLayout
      title="Profit &amp; Loss Statement"
      subtitle="Multi-step Trading, Gross Profit, Operating Expenses &amp; Net Profit statement"
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/reports/sales-profit-loss" className="btn-ghost border border-slate-200 text-xs">
            View Sales Margin (By Invoice / Item) →
          </Link>
          {data && <ReportExportButtons onPdf={exportPdf} onExcel={exportExcel} />}
        </div>
      }
    >
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" /></label>
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" /></label>
        <button onClick={run} disabled={loading} className="btn-primary disabled:opacity-60">{loading ? 'Running…' : 'Run Report'}</button>
      </div>

      {!data && !loading && (
        <div className="text-center py-12 text-slate-400">Select a date range and click &ldquo;Run Report&rdquo; to view the profit &amp; loss statement.</div>
      )}

      {data && (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Net Sales Revenue</div>
              <div className="font-figures text-lg font-semibold text-ink-900 mt-1">{money(data.netSales)}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Gross {money(data.grossSales)} − Disc {money(data.totalSalesDiscounts)}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Net Cost of Sales</div>
              <div className="font-figures text-lg font-semibold text-ink-900 mt-1">{money(data.netCogs)}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Direct COGS &amp; Purchases</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Gross Profit</div>
              <div className={`font-figures text-lg font-semibold mt-1 ${data.grossProfit >= 0 ? 'text-ledger-teal' : 'text-ledger-rose'}`}>
                {money(data.grossProfit)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Gross Margin: <span className="font-semibold">{data.grossMarginPct}%</span>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Operating Expenses</div>
              <div className="font-figures text-lg font-semibold text-ledger-rose mt-1">{money(data.totalOperatingExpenses)}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Indirect / Admin Expenses</div>
            </div>
            <div className="bg-ink-900 rounded-xl p-4 text-white">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-300">Net Profit / (Loss)</div>
              <div className={`font-figures text-lg font-semibold mt-1 ${data.netProfit >= 0 ? 'text-ledger-teal' : 'text-ledger-rose'}`}>
                {money(data.netProfit)}
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                Net Margin: <span className="font-semibold">{data.netMarginPct}%</span>
              </div>
            </div>
          </div>

          <FilterBar search={search} onSearch={setSearch} placeholder="Search account code or name…" showClear={hasFilters} onClear={clearFilters}>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} />
              Hide zero balances
            </label>
            {search && <span className="text-xs text-slate-400">Subtotals below reflect the full statement.</span>}
          </FilterBar>

          <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden space-y-0">
            {/* 1. REVENUE */}
            <div>
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <span className="font-display text-xs uppercase tracking-wider font-semibold text-slate-600">1. Sales Revenue</span>
                <span className="text-xs text-slate-400">PKR</span>
              </div>
              {data.salesRevenue.filter(lineVisible).map((r) => renderAccountRow(r))}
              {data.salesDiscounts.filter(lineVisible).map((r) => renderAccountRow(r, { isDeduction: true }))}
              {data.salesRevenue.filter(lineVisible).length === 0 && data.salesDiscounts.filter(lineVisible).length === 0 && (
                <div className="px-4 py-3 text-xs text-slate-400">No sales revenue entries in this period.</div>
              )}
              <div className="px-4 py-2.5 bg-slate-50/80 border-y border-slate-200 flex justify-between items-center font-semibold text-sm">
                <span className="text-ink-900">Net Sales Revenue</span>
                <span className="font-figures text-ink-900">{money(data.netSales)}</span>
              </div>
            </div>

            {/* 2. COST OF GOODS SOLD */}
            <div>
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <span className="font-display text-xs uppercase tracking-wider font-semibold text-slate-600">2. Cost of Goods Sold &amp; Direct Purchases</span>
              </div>
              {data.cogs.filter(lineVisible).map((r) => renderAccountRow(r))}
              {data.purchaseDiscounts.filter(lineVisible).map((r) => renderAccountRow(r, { isDeduction: true }))}
              {data.cogs.filter(lineVisible).length === 0 && data.purchaseDiscounts.filter(lineVisible).length === 0 && (
                <div className="px-4 py-3 text-xs text-slate-400">No cost of sales entries in this period.</div>
              )}
              <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-200 flex justify-between items-center font-semibold text-sm">
                <span className="text-ink-900">Net Cost of Goods Sold</span>
                <span className="font-figures text-ink-900">{money(data.netCogs)}</span>
              </div>
            </div>

            {/* GROSS PROFIT BANNER */}
            <div className="px-4 py-3 bg-ledger-tealLight/60 border-y border-slate-200 flex flex-wrap justify-between items-center gap-2">
              <div>
                <span className="font-display text-sm font-semibold text-ink-900">Gross Profit</span>
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 font-figures">
                  Margin: {data.grossMarginPct}%
                </span>
              </div>
              <span className={`font-figures text-base font-bold ${data.grossProfit >= 0 ? 'text-ledger-teal' : 'text-ledger-rose'}`}>
                {money(data.grossProfit)}
              </span>
            </div>

            {/* 3. OPERATING EXPENSES */}
            <div>
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <span className="font-display text-xs uppercase tracking-wider font-semibold text-slate-600">3. Operating &amp; Administrative Expenses</span>
              </div>
              {data.operatingExpenses.filter(lineVisible).map((r) => renderAccountRow(r))}
              {data.operatingExpenses.filter(lineVisible).length === 0 && (
                <div className="px-4 py-3 text-xs text-slate-400">No operating expenses in this period.</div>
              )}
              <div className="px-4 py-2.5 bg-slate-50/80 border-y border-slate-200 flex justify-between items-center font-semibold text-sm">
                <span className="text-ink-900">Total Operating Expenses</span>
                <span className="font-figures text-ledger-rose">{money(data.totalOperatingExpenses)}</span>
              </div>
            </div>

            {/* 4. OTHER INCOME (if any) */}
            {(data.otherIncome.filter(lineVisible).length > 0 || data.totalOtherIncome !== 0) && (
              <div>
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <span className="font-display text-xs uppercase tracking-wider font-semibold text-slate-600">4. Other Income</span>
                </div>
                {data.otherIncome.filter(lineVisible).map((r) => renderAccountRow(r))}
                <div className="px-4 py-2.5 bg-slate-50/80 border-y border-slate-200 flex justify-between items-center font-semibold text-sm">
                  <span className="text-ink-900">Total Other Income</span>
                  <span className="font-figures text-ledger-teal">{money(data.totalOtherIncome)}</span>
                </div>
              </div>
            )}

            {/* NET PROFIT FOOTER */}
            <div className="bg-ink-900 px-5 py-4 flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center gap-2.5">
                <span className="text-white font-display text-base">Net Profit / (Loss)</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-ink-800 text-slate-300 font-figures">
                  Net Margin: {data.netMarginPct}%
                </span>
              </div>
              <span className={`font-figures text-xl font-semibold ${data.netProfit >= 0 ? 'text-ledger-teal' : 'text-ledger-rose'}`}>
                {money(data.netProfit)}
              </span>
            </div>
          </div>
        </>
      )}
    </PageLayout>
  );
}
