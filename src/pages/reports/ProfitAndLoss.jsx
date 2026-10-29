import { useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import ReportExportButtons from '../../components/ReportExportButtons';
import FilterBar, { matchesSearch, filterNote } from '../../components/FilterBar';
import { downloadReportPdf, downloadReportExcel } from '../../components/reportExport';
import { formatMoney, formatDate, firstOfMonthLocalISODate, lastOfMonthLocalISODate } from '../../components/ui';

const columns = [
  { key: 'code', label: 'Code' },
  { key: 'name', label: 'Account' },
  { key: 'section', label: 'Section' },
  { key: 'amount', label: 'Amount', align: 'right', money: true }
];

export default function ProfitAndLoss() {
  const [data, setData] = useState(null);
  const [from, setFrom] = useState(firstOfMonthLocalISODate());
  const [to, setTo] = useState(lastOfMonthLocalISODate());
  const [search, setSearch] = useState('');
  const [hideZero, setHideZero] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const run = () => {
    setLoading(true);
    setError('');
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    api.get('/reports/profit-and-loss', { params })
      .then((res) => setData(res.data))
      .catch(() => setError('Could not load the profit & loss report.'))
      .finally(() => setLoading(false));
  };

  const lineVisible = (r) => matchesSearch(search, r.code, r.name) && (!hideZero || Number(r.amount || 0) !== 0);
  const hasFilters = Boolean(search || hideZero);
  const clearFilters = () => { setSearch(''); setHideZero(false); };
  const subtitle = `Period: ${from ? formatDate(from) : 'inception'} to ${to ? formatDate(to) : 'today'}${filterNote(search, ['Balances', hideZero && 'Non-zero only'])}`;
  const exportRows = () => [
    ...data.income.filter(lineVisible).map((r) => ({ ...r, section: 'Income' })),
    ...data.expense.filter(lineVisible).map((r) => ({ ...r, section: 'Expense' }))
  ];
  const exportTotals = () => ['', '', 'Net Profit', formatMoney(data.netProfit)];
  const exportPdf = () => downloadReportPdf({ title: 'Profit & Loss', subtitle, columns, rows: exportRows(), totals: exportTotals() });
  const exportExcel = () => downloadReportExcel({ title: 'Profit & Loss', subtitle, columns, rows: exportRows(), totals: exportTotals() });

  const money = formatMoney;

  return (
    <PageLayout title="Profit &amp; Loss" actions={data && <ReportExportButtons onPdf={exportPdf} onExcel={exportExcel} />}>
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
      <div className="flex items-end gap-3 mb-4">
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" /></label>
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" /></label>
        <button onClick={run} disabled={loading} className="btn-primary disabled:opacity-60">{loading ? 'Running…' : 'Run Report'}</button>
      </div>

      {!data && !loading && (
        <div className="text-center py-12 text-slate-400">Select a date range and click "Run Report" to view the profit &amp; loss statement.</div>
      )}

      {data && (
        <>
        <FilterBar search={search} onSearch={setSearch} placeholder="Search account code or name…" showClear={hasFilters} onClear={clearFilters}>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} />
            Hide zero balances
          </label>
        {hasFilters && <span className="text-xs text-slate-400">Totals below are for the full statement.</span>}
        </FilterBar>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
            <h2 className="font-display text-sm text-ink-800 mb-3">Income</h2>
            {data.income.filter(lineVisible).map((r) => (
              <div key={r.code} className="flex justify-between text-sm py-1"><span>{r.name}</span><span className="font-figures">{money(r.amount)}</span></div>
            ))}
            <div className="flex justify-between text-sm font-semibold pt-2 mt-2 border-t border-slate-200"><span>Total Income</span><span className="font-figures text-ledger-teal">{money(data.totalIncome)}</span></div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
            <h2 className="font-display text-sm text-ink-800 mb-3">Expenses</h2>
            {data.expense.filter(lineVisible).map((r) => (
              <div key={r.code} className="flex justify-between text-sm py-1"><span>{r.name}</span><span className="font-figures">{money(r.amount)}</span></div>
            ))}
            <div className="flex justify-between text-sm font-semibold pt-2 mt-2 border-t border-slate-200"><span>Total Expense</span><span className="font-figures text-ledger-rose">{money(data.totalExpense)}</span></div>
          </div>
          <div className="md:col-span-2 bg-ink-900 rounded-xl p-5 flex justify-between items-center">
            <span className="text-white font-display">Net Profit</span>
            <span className={`font-figures text-xl font-semibold ${data.netProfit >= 0 ? 'text-ledger-teal' : 'text-ledger-rose'}`}>{money(data.netProfit)}</span>
          </div>
        </div>
        </>
      )}
    </PageLayout>
  );
}
