import { useEffect, useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import ReportExportButtons from '../../components/ReportExportButtons';
import { downloadReportPdf, downloadReportExcel } from '../../components/reportExport';
import { formatMoney, formatDate } from '../../components/ui';

const columns = [
  { key: 'date', label: 'Date', render: (r) => r.date ? new Date(r.date).toLocaleDateString() : '—' },
  { key: 'type', label: 'Type' },
  { key: 'reference', label: 'Reference' },
  { key: 'customer', label: 'Customer' },
  { key: 'description', label: 'Description' },
  { key: 'status', label: 'Status' },
  { key: 'debit', label: 'Debit', align: 'right', mono: true, render: (r) => r.debit ? formatMoney(r.debit) : '' },
  { key: 'credit', label: 'Credit', align: 'right', mono: true, render: (r) => r.credit ? formatMoney(r.credit) : '' }
];

const exportColumns = [
  { key: 'date', label: 'Date', date: true },
  { key: 'type', label: 'Type' },
  { key: 'reference', label: 'Reference' },
  { key: 'customer', label: 'Customer' },
  { key: 'description', label: 'Description' },
  { key: 'status', label: 'Status' },
  { key: 'debit', label: 'Debit', align: 'right', money: true },
  { key: 'credit', label: 'Credit', align: 'right', money: true }
];

export default function SalesJournal() {
  const [data, setData] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/customers').then((res) => setCustomers(res.data)).catch(() => setError('Could not load customers.'));
  }, []);

  const run = () => {
    setLoading(true);
    setError('');
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (customerId) params.customerId = customerId;
    api.get('/reports/sales-journal', { params })
      .then((res) => setData(res.data))
      .catch(() => setError('Could not load sales journal.'))
      .finally(() => setLoading(false));
  };

  const money = formatMoney;
  const customerName = customers.find((c) => c._id === customerId)?.name;
  const subtitle = `Period: ${from ? formatDate(from) : 'inception'} to ${to ? formatDate(to) : 'today'}${customerName ? ` — ${customerName}` : ''}`;
  const exportTotals = () => ['', '', '', '', '', 'Total', money(data.totalDebit), money(data.totalCredit)];
  const exportPdf = () => downloadReportPdf({ title: 'Sales Journal', subtitle, columns: exportColumns, rows: data.rows, totals: exportTotals() });
  const exportExcel = () => downloadReportExcel({ title: 'Sales Journal', subtitle, columns: exportColumns, rows: data.rows, totals: exportTotals() });

  return (
    <PageLayout title="Sales Journal" actions={data && <ReportExportButtons onPdf={exportPdf} onExcel={exportExcel} />}>
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
      <div className="flex items-end gap-3 mb-4 flex-wrap">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Customer</span>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input min-w-[200px]">
            <option value="">All customers</option>
            {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" /></label>
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" /></label>
        <button onClick={run} disabled={loading} className="btn-primary disabled:opacity-60">{loading ? 'Running…' : 'Run Report'}</button>
      </div>

      {!data && !loading && (
        <div className="text-center py-12 text-slate-400">Select filters and click "Run Report" to view the sales journal.</div>
      )}

      {data && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                {columns.map((col) => (
                  <th key={col.key} className={`px-4 py-3 font-medium ${col.align === 'right' ? 'text-right' : ''}`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={row._id || i} className="border-b border-slate-100">
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 ${col.mono ? 'font-figures' : ''} ${col.align === 'right' ? 'text-right' : ''}`}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink-800 font-semibold">
                <td className="px-4 py-3" colSpan={6}>Total</td>
                <td className="px-4 py-3 text-right font-figures">{money(data.totalDebit)}</td>
                <td className="px-4 py-3 text-right font-figures">{money(data.totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </PageLayout>
  );
}
