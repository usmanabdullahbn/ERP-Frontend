import { useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import ReportExportButtons from '../../components/ReportExportButtons';
import FilterBar, { matchesSearch, filterNote } from '../../components/FilterBar';
import { downloadReportPdf, downloadReportExcel } from '../../components/reportExport';
import { formatMoney, formatDate, todayLocalISODate } from '../../components/ui';

const columns = [
  { key: 'code', label: 'Code' },
  { key: 'name', label: 'Account' },
  { key: 'section', label: 'Section' },
  { key: 'amount', label: 'Amount', align: 'right', money: true }
];

export default function BalanceSheet() {
  const [data, setData] = useState(null);
  const [asOf, setAsOf] = useState(todayLocalISODate());
  const [search, setSearch] = useState('');
  const [hideZero, setHideZero] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const run = () => {
    setLoading(true);
    setError('');
    const params = {};
    if (asOf) params.asOf = asOf;
    api.get('/reports/balance-sheet', { params })
      .then((res) => setData(res.data))
      .catch(() => setError('Could not load the balance sheet.'))
      .finally(() => setLoading(false));
  };

  const lineVisible = (r) => matchesSearch(search, r.code, r.name) && (!hideZero || Number(r.amount || 0) !== 0);
  const hasFilters = Boolean(search || hideZero);
  const clearFilters = () => { setSearch(''); setHideZero(false); };
  const subtitle = `As of ${formatDate(asOf || todayLocalISODate())}${filterNote(search, ['Balances', hideZero && 'Non-zero only'])}`;
  const exportRows = () => [
    ...data.assets.filter(lineVisible).map((r) => ({ ...r, section: 'Assets' })),
    ...data.liabilities.filter(lineVisible).map((r) => ({ ...r, section: 'Liabilities' })),
    ...data.equity.filter(lineVisible).map((r) => ({ ...r, section: 'Equity' }))
  ];
  const exportTotals = () => ['', '', 'Total', formatMoney(data.totalAssets)];
  const exportPdf = () => downloadReportPdf({ title: 'Balance Sheet', subtitle, columns, rows: exportRows(), totals: exportTotals() });
  const exportExcel = () => downloadReportExcel({ title: 'Balance Sheet', subtitle, columns, rows: exportRows(), totals: exportTotals() });

  const money = formatMoney;

  return (
    <PageLayout title="Balance Sheet" actions={data && <ReportExportButtons onPdf={exportPdf} onExcel={exportExcel} />}>
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
      <div className="flex items-end gap-3 mb-4">
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">As of</span>
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="input" /></label>
        <button onClick={run} disabled={loading} className="btn-primary disabled:opacity-60">{loading ? 'Running…' : 'Run Report'}</button>
      </div>

      {!data && !loading && (
        <div className="text-center py-12 text-slate-400">Pick an "as of" date and click "Run Report" to view the balance sheet.</div>
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
            <h2 className="font-display text-sm text-ink-800 mb-3">Assets</h2>
            {data.assets.filter(lineVisible).map((r) => <div key={r.code} className="flex justify-between text-sm py-1"><span>{r.name}</span><span className="font-figures">{money(r.amount)}</span></div>)}
            <div className="flex justify-between text-sm font-semibold pt-2 mt-2 border-t border-slate-200"><span>Total Assets</span><span className="font-figures">{money(data.totalAssets)}</span></div>
          </div>
          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
              <h2 className="font-display text-sm text-ink-800 mb-3">Liabilities</h2>
              {data.liabilities.filter(lineVisible).map((r) => <div key={r.code} className="flex justify-between text-sm py-1"><span>{r.name}</span><span className="font-figures">{money(r.amount)}</span></div>)}
              <div className="flex justify-between text-sm font-semibold pt-2 mt-2 border-t border-slate-200"><span>Total Liabilities</span><span className="font-figures">{money(data.totalLiabilities)}</span></div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
              <h2 className="font-display text-sm text-ink-800 mb-3">Equity</h2>
              {data.equity.filter(lineVisible).map((r) => <div key={r.code} className="flex justify-between text-sm py-1"><span>{r.name}</span><span className="font-figures">{money(r.amount)}</span></div>)}
              <div className="flex justify-between text-sm font-semibold pt-2 mt-2 border-t border-slate-200"><span>Total Equity</span><span className="font-figures">{money(data.totalEquity)}</span></div>
            </div>
          </div>
          <div className={`md:col-span-2 rounded-xl p-5 flex justify-between items-center ${data.balanced ? 'bg-ink-900' : 'bg-ledger-rose'}`}>
            <span className="text-white font-display">{data.balanced ? 'Balanced ✓' : 'Out of balance — check your postings'}</span>
            <span className="text-white font-figures text-sm">Assets {money(data.totalAssets)} = Liabilities + Equity {money(data.totalLiabilities + data.totalEquity)}</span>
          </div>
        </div>
        </>
      )}
    </PageLayout>
  );
}
