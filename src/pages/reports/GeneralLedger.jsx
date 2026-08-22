import { useEffect, useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import ReportExportButtons from '../../components/ReportExportButtons';
import { downloadReportPdf, downloadReportExcel } from '../../components/reportExport';
import { formatMoney, formatDate } from '../../components/ui';

const exportColumns = [
  { key: 'account', label: 'Account' },
  { key: 'date', label: 'Date', date: true },
  { key: 'reference', label: 'Reference' },
  { key: 'description', label: 'Description' },
  { key: 'debit', label: 'Debit', align: 'right', money: true },
  { key: 'credit', label: 'Credit', align: 'right', money: true },
  { key: 'balance', label: 'Balance', align: 'right', money: true }
];

export default function GeneralLedger() {
  const [data, setData] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [accountId, setAccountId] = useState('');
  const [bankId, setBankId] = useState('');
  const [showBf, setShowBf] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/accounts').then((res) => setAccounts(res.data)).catch(() => setError('Could not load chart of accounts.'));
    api.get('/bank/accounts').then((res) => setBankAccounts(res.data)).catch(() => setError('Could not load bank accounts.'));
  }, []);

  const run = () => {
    setLoading(true);
    setError('');
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (accountId) params.accountId = accountId;
    if (bankId) params.bankId = bankId;
    api.get('/reports/general-ledger', { params })
      .then((res) => setData(Array.isArray(res.data) ? res.data : [res.data].filter(Boolean)))
      .catch(() => setError('Could not load general ledger.'))
      .finally(() => setLoading(false));
  };

  const handleAccountChange = (value) => {
    setAccountId(value);
    if (value) setBankId('');
  };

  const handleBankChange = (value) => {
    setBankId(value);
    if (value) {
      const selectedBank = bankAccounts.find((bank) => bank._id === value);
      setAccountId(selectedBank?.account || '');
    } else {
      setAccountId('');
    }
  };

  const money = formatMoney;
  const subtitle = `Period: ${from ? formatDate(from) : 'inception'} to ${to ? formatDate(to) : 'today'}`;

  const exportRows = () => {
    const out = [];
    (data || []).forEach((ledger) => {
      const account = `${ledger.account.code} - ${ledger.account.name}`;
      if (showBf) out.push({ account, date: '', reference: '', description: 'Balance b/f', debit: '', credit: '', balance: ledger.openingBalance || 0 });
      ledger.entries.forEach((e) => out.push({ account, date: e.date, reference: e.reference, description: e.description, debit: e.debit || '', credit: e.credit || '', balance: e.balance }));
      out.push({ account, date: '', reference: '', description: 'Closing balance', debit: money(ledger.totalDebit), credit: money(ledger.totalCredit), balance: ledger.closingBalance });
    });
    return out;
  };
  const exportPdf = () => downloadReportPdf({ title: 'General Ledger', subtitle, columns: exportColumns, rows: exportRows() });
  const exportExcel = () => downloadReportExcel({ title: 'General Ledger', subtitle, columns: exportColumns, rows: exportRows() });

  return (
    <PageLayout title="General Ledger" actions={data && <ReportExportButtons onPdf={exportPdf} onExcel={exportExcel} />}>
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
      <div className="flex items-end gap-3 mb-4 flex-wrap">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Chart of Account</span>
          <select value={accountId} onChange={(e) => handleAccountChange(e.target.value)} className="input min-w-[240px]">
            <option value="">All Accounts</option>
            {accounts.map((account) => (
              <option key={account._id} value={account._id}>{account.code} - {account.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Bank Account</span>
          <select value={bankId} onChange={(e) => handleBankChange(e.target.value)} className="input min-w-[220px]">
            <option value="">All Banks</option>
            {bankAccounts.map((bank) => (
              <option key={bank._id} value={bank._id}>{bank.name} ({bank.accountNumber || '—'})</option>
            ))}
          </select>
        </label>
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" /></label>
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" /></label>
        <button onClick={run} disabled={loading} className="btn-primary disabled:opacity-60">{loading ? 'Running…' : 'Run Report'}</button>
      </div>

      <label className="mb-4 flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={showBf} onChange={(e) => setShowBf(e.target.checked)} />
        Show balance b/f
      </label>

      {!data && !loading && (
        <div className="text-center py-12 text-slate-400">Select filters and click "Run Report" to view the general ledger.</div>
      )}

      {data && data.length > 0 && (
        <div className="space-y-6">
          {data.map((ledger) => (
            <div key={ledger.account._id} className="bg-white rounded-xl border border-slate-200 shadow-card overflow-x-auto">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                <h3 className="font-semibold text-slate-900">{ledger.account.code} - {ledger.account.name}</h3>
                <p className="text-xs text-slate-500">{ledger.account.type}</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Debit</th>
                    <th className="px-4 py-3 text-right">Credit</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {showBf && (
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <td className="px-4 py-2">—</td>
                      <td className="px-4 py-2 font-mono text-xs"></td>
                      <td className="px-4 py-2 text-slate-600 font-medium">Balance b/f</td>
                      <td className="px-4 py-2 text-right font-figures"></td>
                      <td className="px-4 py-2 text-right font-figures"></td>
                      <td className="px-4 py-2 text-right font-figures font-semibold">{money(ledger.openingBalance || 0)}</td>
                    </tr>
                  )}
                  {ledger.entries.map((entry, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="px-4 py-2">{entry.date ? new Date(entry.date).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-2 font-mono text-xs">{entry.reference}</td>
                      <td className="px-4 py-2 text-slate-600">{entry.description}</td>
                      <td className="px-4 py-2 text-right font-figures">{entry.debit ? money(entry.debit) : ''}</td>
                      <td className="px-4 py-2 text-right font-figures">{entry.credit ? money(entry.credit) : ''}</td>
                      <td className="px-4 py-2 text-right font-figures font-semibold">{money(entry.balance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-ink-800 font-semibold">
                    <td className="px-4 py-3" colSpan={3}>Total</td>
                    <td className="px-4 py-3 text-right font-figures">{money(ledger.totalDebit)}</td>
                    <td className="px-4 py-3 text-right font-figures">{money(ledger.totalCredit)}</td>
                    <td className="px-4 py-3 text-right font-figures">{money(ledger.closingBalance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}
        </div>
      )}

      {data && data.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          No general ledger entries found for the selected period.
        </div>
      )}
    </PageLayout>
  );
}
