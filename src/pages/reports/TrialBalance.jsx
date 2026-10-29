import { useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import ReportExportButtons from '../../components/ReportExportButtons';
import FilterBar, { matchesSearch, distinctValues, filterNote } from '../../components/FilterBar';
import { downloadReportPdf, downloadReportExcel } from '../../components/reportExport';
import { formatMoney, formatDate, firstOfMonthLocalISODate, lastOfMonthLocalISODate } from '../../components/ui';

const columns = [
  { key: 'code', label: 'Code' },
  { key: 'name', label: 'Account' },
  { key: 'type', label: 'Type' },
  { key: 'debit', label: 'Debit', align: 'right', money: true },
  { key: 'credit', label: 'Credit', align: 'right', money: true }
];

export default function TrialBalance() {
  const [data, setData] = useState(null);
  const [from, setFrom] = useState(firstOfMonthLocalISODate());
  const [to, setTo] = useState(lastOfMonthLocalISODate());
  const [search, setSearch] = useState('');
  const [hideZero, setHideZero] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const run = () => {
    setLoading(true);
    setError('');
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    api.get('/reports/trial-balance', { params })
      .then((res) => setData(res.data))
      .catch(() => setError('Could not load the trial balance.'))
      .finally(() => setLoading(false));
  };

  const visibleRows = (data?.rows || []).filter((r) =>
    matchesSearch(search, r.code, r.name)
    && (!typeFilter || r.type === typeFilter)
    && (!hideZero || Number(r.debit || 0) !== 0 || Number(r.credit || 0) !== 0)
  );
  const totalDebit = visibleRows.reduce((sum, r) => sum + Number(r.debit || 0), 0);
  const totalCredit = visibleRows.reduce((sum, r) => sum + Number(r.credit || 0), 0);
  const hasFilters = Boolean(search || typeFilter || hideZero);
  const clearFilters = () => { setSearch(''); setTypeFilter(''); setHideZero(false); };
  const totalLabel = hasFilters ? `Total (${visibleRows.length} of ${data?.rows.length || 0} accounts)` : 'Total';
  const subtitle = `Period: ${from ? formatDate(from) : 'inception'} to ${to ? formatDate(to) : 'today'}${filterNote(search, ['Type', typeFilter], ['Balances', hideZero && 'Non-zero only'])}`;
  const exportPdf = () => downloadReportPdf({ title: 'Trial Balance', subtitle, columns, rows: visibleRows, totals: [totalLabel, '', '', formatMoney(totalDebit), formatMoney(totalCredit)] });
  const exportExcel = () => downloadReportExcel({ title: 'Trial Balance', subtitle, columns, rows: visibleRows, totals: [totalLabel, '', '', formatMoney(totalDebit), formatMoney(totalCredit)] });

  const money = formatMoney;

  return (
    <PageLayout title="Trial Balance" actions={data && <ReportExportButtons onPdf={exportPdf} onExcel={exportExcel} />}>
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
      <div className="flex items-end gap-3 mb-4">
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" /></label>
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" /></label>
        <button onClick={run} disabled={loading} className="btn-primary disabled:opacity-60">{loading ? 'Running…' : 'Run Report'}</button>
      </div>

      {!data && !loading && (
        <div className="text-center py-12 text-slate-400">Select a date range and click "Run Report" to view the trial balance.</div>
      )}

      {data && (
        <>
        <FilterBar search={search} onSearch={setSearch} placeholder="Search account code or name…" showClear={hasFilters} onClear={clearFilters}>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input w-auto">
            <option value="">All account types</option>
            {distinctValues(data.rows, 'type').map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} />
            Hide zero balances
          </label>
        </FilterBar>
        <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">Code</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No accounts match your filters.</td></tr>
              )}
              {visibleRows.map((r) => (
                <tr key={r.code} className="border-b border-slate-100">
                  <td className="px-4 py-2 font-figures">{r.code}</td>
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="px-4 py-2 text-slate-500">{r.type}</td>
                  <td className="px-4 py-2 text-right font-figures">{r.debit ? money(r.debit) : ''}</td>
                  <td className="px-4 py-2 text-right font-figures">{r.credit ? money(r.credit) : ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink-800 font-semibold">
                <td className="px-4 py-3" colSpan={3}>{totalLabel}</td>
                <td className="px-4 py-3 text-right font-figures">{money(totalDebit)}</td>
                <td className="px-4 py-3 text-right font-figures">{money(totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        </>
      )}
    </PageLayout>
  );
}
