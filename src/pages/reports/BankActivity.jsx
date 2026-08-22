import { useEffect, useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import DataTable from '../../components/DataTable';
import ReportExportButtons from '../../components/ReportExportButtons';
import { downloadReportPdf, downloadReportExcel } from '../../components/reportExport';
import { formatMoney, formatDate } from '../../components/ui';

const columns = [
  { key: 'date', label: 'Date', render: (r) => r.date ? new Date(r.date).toLocaleDateString() : '—' },
  { key: 'bankAccount', label: 'Bank Account' },
  { key: 'type', label: 'Type' },
  { key: 'reference', label: 'Reference' },
  { key: 'description', label: 'Description' },
  { key: 'contraDetails', label: 'Contra / Transfer' },
  { key: 'amount', label: 'Amount', align: 'right', mono: true, render: (r) => formatMoney(r.amount) }
];

const exportColumns = [
  { key: 'date', label: 'Date', date: true },
  { key: 'bankAccount', label: 'Bank Account' },
  { key: 'type', label: 'Type' },
  { key: 'reference', label: 'Reference' },
  { key: 'description', label: 'Description' },
  { key: 'contraDetails', label: 'Contra / Transfer' },
  { key: 'amount', label: 'Amount', align: 'right', money: true }
];

export default function BankActivity() {
  const [rows, setRows] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [bankId, setBankId] = useState('');
  const [bankAccounts, setBankAccounts] = useState([]);
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
    if (bankId) params.bankId = bankId;
    api.get('/reports/bank-activity', { params })
      .then((res) => setRows(res.data))
      .catch(() => setError('Could not load bank activity.'))
      .finally(() => setLoading(false));
  };

  const bankName = bankAccounts.find((b) => b._id === bankId)?.name;
  const subtitle = `Period: ${from ? formatDate(from) : 'inception'} to ${to ? formatDate(to) : 'today'}${bankName ? ` — ${bankName}` : ''}`;
  const exportPdf = () => downloadReportPdf({ title: 'Bank Activity', subtitle, columns: exportColumns, rows });
  const exportExcel = () => downloadReportExcel({ title: 'Bank Activity', subtitle, columns: exportColumns, rows });

  return (
    <PageLayout title="Bank Activity" actions={rows && <ReportExportButtons onPdf={exportPdf} onExcel={exportExcel} />}>
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
      <div className="flex items-end gap-3 mb-4 flex-wrap">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Bank</span>
          <select value={bankId} onChange={(e) => setBankId(e.target.value)} className="input min-w-[220px]">
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

      {!rows && !loading && (
        <div className="text-center py-12 text-slate-400">Select filters and click "Run Report" to view bank activity.</div>
      )}

      {rows && <DataTable columns={columns} data={rows} emptyMessage="No bank activity found." />}
    </PageLayout>
  );
}
