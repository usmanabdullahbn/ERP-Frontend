import { useEffect, useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import ReportExportButtons from '../../components/ReportExportButtons';
import MultiSelect from '../../components/MultiSelect';
import FilterBar, { matchesSearch, distinctValues, filterNote } from '../../components/FilterBar';
import JvLink from '../../components/JvLink';
import { downloadReportPdf, downloadReportExcel } from '../../components/reportExport';
import { formatMoney, formatDate, firstOfMonthLocalISODate, lastOfMonthLocalISODate } from '../../components/ui';

// Each bank/cash account prints as its own section with the bank name & GL code in the heading.
const exportColumns = [
  { key: 'date', label: 'Date', date: true },
  { key: 'type', label: 'Type' },
  { key: 'reference', label: 'Reference' },
  { key: 'jvNumber', label: 'JV #' },
  { key: 'description', label: 'Description' },
  { key: 'contraDetails', label: 'Contra / Party' },
  { key: 'debit', label: 'In (Debit)', align: 'right', money: true },
  { key: 'credit', label: 'Out (Credit)', align: 'right', money: true },
  { key: 'balance', label: 'Balance', align: 'right', money: true }
];

export default function BankActivity() {
  const [sections, setSections] = useState(null);
  const [from, setFrom] = useState(firstOfMonthLocalISODate());
  const [to, setTo] = useState(lastOfMonthLocalISODate());
  const [bankIds, setBankIds] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [showBf, setShowBf] = useState(true);
  const [hideEmpty, setHideEmpty] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/bank/accounts').then((res) => setBankAccounts(res.data)).catch(() => setError('Could not load bank accounts.'));
  }, []);

  const run = () => {
    setLoading(true);
    setError('');
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (bankIds.length) params.bankId = bankIds.join(',');
    api.get('/reports/bank-activity', { params })
      .then((res) => setSections(Array.isArray(res.data) ? res.data : [res.data].filter(Boolean)))
      .catch(() => setError('Could not load bank activity.'))
      .finally(() => setLoading(false));
  };

  const money = formatMoney;
  const entryFilter = Boolean(search || typeFilter);

  const visibleSections = (sections || []).map((sec) => {
    const bankHit = search && matchesSearch(search, sec.bank?.name, sec.bank?.bankName, sec.bank?.accountNumber, sec.bank?.glCode);
    const entries = (sec.entries || []).filter((e) =>
      (bankHit || matchesSearch(search, e.reference, e.jvNumber, e.description, e.contraDetails))
      && (!typeFilter || e.type === typeFilter)
    );
    return {
      ...sec,
      entries,
      shownIn: entries.reduce((s, e) => s + Number(e.debit || 0), 0),
      shownOut: entries.reduce((s, e) => s + Number(e.credit || 0), 0)
    };
  }).filter((sec) =>
    (!hideEmpty || sec.entries.length > 0 || Math.abs(Number(sec.closingBalance || 0)) >= 0.005)
    && (!entryFilter || sec.entries.length > 0)
  );

  const allEntries = (sections || []).flatMap((s) => s.entries || []);
  const entryTypes = distinctValues(allEntries, 'type');
  const hasFilters = Boolean(search || typeFilter || hideEmpty);
  const clearFilters = () => { setSearch(''); setTypeFilter(''); setHideEmpty(false); };

  const grandOpening = visibleSections.reduce((s, sec) => s + Number(sec.openingBalance || 0), 0);
  const grandIn = visibleSections.reduce((s, sec) => s + Number(sec.shownIn || 0), 0);
  const grandOut = visibleSections.reduce((s, sec) => s + Number(sec.shownOut || 0), 0);
  const grandClosing = visibleSections.reduce((s, sec) => s + Number(sec.closingBalance || 0), 0);

  const bankNames = bankAccounts.filter((b) => bankIds.includes(b._id)).map((b) => b.name).join(', ');
  const subtitle = `${bankNames || 'All bank & cash accounts'} — ${from ? formatDate(from) : 'inception'} to ${to ? formatDate(to) : 'today'}${filterNote(search, ['Type', typeFilter], ['Accounts', hideEmpty && 'Active only'])}`;

  const exportSections = () => visibleSections.map((sec) => {
    const out = [];
    if (showBf) out.push({ _bold: true, description: 'Balance b/f', balance: sec.openingBalance || 0 });
    sec.entries.forEach((e) => {
      out.push({
        date: e.date,
        type: e.type,
        reference: e.reference,
        jvNumber: e.jvNumber || '',
        description: e.description,
        contraDetails: e.contraDetails,
        debit: e.debit || '',
        credit: e.credit || '',
        balance: e.balance
      });
    });
    return {
      title: `${sec.bank?.name || '—'}${sec.bank?.glCode ? ` (${sec.bank.glCode})` : ''}`,
      subtitle: `${sec.bank?.type || 'BANK'}  ·  Opening ${money(sec.openingBalance || 0)}  ·  In ${money(sec.shownIn)}  ·  Out ${money(sec.shownOut)}  ·  Closing ${money(sec.closingBalance)}`,
      rows: out,
      totals: ['Total', '', '', '', '', '', money(sec.shownIn), money(sec.shownOut), money(sec.closingBalance)]
    };
  });

  const exportPdf = () => downloadReportPdf({ title: 'Bank Activity', subtitle, columns: exportColumns, sections: exportSections() });
  const exportExcel = () => downloadReportExcel({ title: 'Bank Activity', subtitle, columns: exportColumns, sections: exportSections() });

  return (
    <PageLayout title="Bank Activity" actions={sections && <ReportExportButtons onPdf={exportPdf} onExcel={exportExcel} />}>
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
      <div className="flex items-end gap-3 mb-4 flex-wrap">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Bank</span>
          <MultiSelect
            className="min-w-[220px]"
            options={bankAccounts.map((bank) => ({ value: bank._id, label: `${bank.name} (${bank.accountNumber || bank.type || '—'})` }))}
            selected={bankIds}
            onChange={setBankIds}
            placeholder="All banks"
          />
        </label>
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" /></label>
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" /></label>
        <button onClick={run} disabled={loading} className="btn-primary disabled:opacity-60">{loading ? 'Running…' : 'Run Report'}</button>
        <button type="button" onClick={() => { setBankIds([]); setFrom(''); setTo(''); setSections(null); }} className="btn-ghost">Clear</button>
      </div>

      <label className="mb-4 flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
        <input type="checkbox" checked={showBf} onChange={(e) => setShowBf(e.target.checked)} />
        Show balance b/f
      </label>

      {!sections && !loading && (
        <div className="text-center py-12 text-slate-400">Select filters and click "Run Report" to view bank activity.</div>
      )}

      {sections && sections.length > 0 && (
        <>
          {/* Grand Summary Cards across shown banks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Opening Balance (b/f)</div>
              <div className="font-figures text-lg font-semibold text-ink-900 mt-1">{money(grandOpening)}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{visibleSections.length} bank/cash account(s)</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Total In (Deposits)</div>
              <div className="font-figures text-lg font-semibold text-ledger-teal mt-1">{money(grandIn)}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Receipts, advances &amp; transfers in</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Total Out (Withdrawals)</div>
              <div className="font-figures text-lg font-semibold text-ledger-rose mt-1">{money(grandOut)}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Payments, expenses &amp; transfers out</div>
            </div>
            <div className="bg-ink-900 rounded-xl p-4 text-white">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-300">Closing Balance</div>
              <div className="font-figures text-lg font-semibold text-ledger-teal mt-1">{money(grandClosing)}</div>
              <div className="text-[11px] text-slate-300 mt-0.5">Net period flow: {money(grandIn - grandOut)}</div>
            </div>
          </div>

          <FilterBar search={search} onSearch={setSearch} placeholder="Search bank, reference, JV #, description, contra…" showClear={hasFilters} onClear={clearFilters}>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input w-auto">
              <option value="">All types</option>
              {entryTypes.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
              Hide zero / inactive accounts
            </label>
          </FilterBar>

          {visibleSections.length === 0 ? (
            <div className="text-center py-12 text-slate-400">No bank transactions match your filters.</div>
          ) : (
            <div className="space-y-6">
              {visibleSections.map((sec) => {
                const bfRow = { _bf: true, description: 'Balance b/f', balance: sec.openingBalance || 0 };
                const entryRows = showBf ? [bfRow, ...sec.entries] : sec.entries;
                return (
                  <div key={sec.bank._id} className="bg-white rounded-xl border border-slate-200 shadow-card overflow-x-auto">
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          {sec.bank.name}
                          {sec.bank.bankName ? <span className="ml-2 text-xs font-normal text-slate-500">({sec.bank.bankName})</span> : null}
                        </h3>
                        <p className="text-xs text-slate-500 font-mono">
                          {sec.bank.glCode}{sec.bank.accountNumber ? ` · A/C: ${sec.bank.accountNumber}` : ''} · {sec.bank.type}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-6 text-right text-sm">
                        <div>
                          <p className="text-slate-500 text-xs">Opening (b/f)</p>
                          <p className="font-figures">{money(sec.openingBalance || 0)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">Total In</p>
                          <p className="font-figures text-ledger-teal">{money(sec.shownIn || 0)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">Total Out</p>
                          <p className="font-figures text-ledger-rose">{money(sec.shownOut || 0)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">Closing Balance</p>
                          <p className="font-figures font-semibold text-ink-900">{money(sec.closingBalance || 0)}</p>
                        </div>
                      </div>
                    </div>

                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Reference</th>
                          <th className="px-4 py-3">JV #</th>
                          <th className="px-4 py-3">Description</th>
                          <th className="px-4 py-3">Contra / Party</th>
                          <th className="px-4 py-3 text-right">In (Debit)</th>
                          <th className="px-4 py-3 text-right">Out (Credit)</th>
                          <th className="px-4 py-3 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entryRows.map((r, i) => (
                          <tr key={r._id || i} className={`border-b border-slate-100 ${r._bf ? 'bg-slate-50/60' : ''}`}>
                            <td className="px-4 py-2 whitespace-nowrap">{r._bf ? '—' : new Date(r.date).toLocaleDateString()}</td>
                            <td className="px-4 py-2 whitespace-nowrap">{r._bf ? '' : r.type}</td>
                            <td className="px-4 py-2">{r._bf ? '' : r.reference}</td>
                            <td className="px-4 py-2 whitespace-nowrap">{r._bf ? '' : <JvLink id={r.jvId} number={r.jvNumber} />}</td>
                            <td className={`px-4 py-2 ${r._bf ? 'font-medium text-slate-600' : ''}`}>{r.description}</td>
                            <td className="px-4 py-2 text-slate-600">{r._bf ? '' : r.contraDetails}</td>
                            <td className="px-4 py-2 text-right font-figures text-ledger-teal">{r._bf ? '' : (r.debit ? money(r.debit) : '—')}</td>
                            <td className="px-4 py-2 text-right font-figures text-ledger-rose">{r._bf ? '' : (r.credit ? money(r.credit) : '—')}</td>
                            <td className="px-4 py-2 text-right font-figures font-semibold">{money(r.balance)}</td>
                          </tr>
                        ))}
                        {sec.entries.length === 0 && (
                          <tr>
                            <td colSpan={9} className="px-4 py-6 text-center text-slate-400">
                              No transactions for {sec.bank.name} in this period.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-ink-800 font-semibold bg-slate-50/50">
                          <td className="px-4 py-3" colSpan={6}>Total — {sec.bank.name} ({sec.entries.length} entries)</td>
                          <td className="px-4 py-3 text-right font-figures text-ledger-teal">{money(sec.shownIn)}</td>
                          <td className="px-4 py-3 text-right font-figures text-ledger-rose">{money(sec.shownOut)}</td>
                          <td className="px-4 py-3 text-right font-figures">{money(sec.closingBalance)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </PageLayout>
  );
}
