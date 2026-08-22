import { useEffect, useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import DataTable from '../../components/DataTable';
import ReportExportButtons from '../../components/ReportExportButtons';
import { downloadReportPdf, downloadReportExcel } from '../../components/reportExport';
import { formatMoney, formatDate, todayLocalISODate } from '../../components/ui';

const columns = [
  { key: 'customer', label: 'Customer' },
  { key: 'invoiceNumber', label: 'Invoice #' },
  { key: 'dueDate', label: 'Due Date', render: (r) => r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—' },
  { key: 'daysOverdue', label: 'Days Overdue', align: 'right', mono: true },
  { key: 'bucket', label: 'Bucket' },
  { key: 'balanceDue', label: 'Balance Due', align: 'right', mono: true, render: (r) => formatMoney(r.balanceDue) }
];

const exportColumns = [
  { key: 'customer', label: 'Customer' },
  { key: 'invoiceNumber', label: 'Invoice #' },
  { key: 'dueDate', label: 'Due Date', date: true },
  { key: 'daysOverdue', label: 'Days Overdue', align: 'right' },
  { key: 'bucket', label: 'Bucket' },
  { key: 'balanceDue', label: 'Balance Due', align: 'right', money: true }
];

export default function AgedReceivables() {
  const [rows, setRows] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [asOf, setAsOf] = useState(todayLocalISODate());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/customers').then((res) => setCustomers(res.data)).catch(() => setError('Could not load customers.'));
  }, []);

  const run = () => {
    setLoading(true);
    setError('');
    const params = {};
    if (asOf) params.asOf = asOf;
    if (customerId) params.customerId = customerId;
    api.get('/reports/aged-receivables', { params })
      .then((res) => setRows(res.data.rows))
      .catch(() => setError('Could not load aged receivables.'))
      .finally(() => setLoading(false));
  };

  const customerName = customers.find((c) => c._id === customerId)?.name;
  const subtitle = `As on ${formatDate(asOf)}${customerName ? ` — ${customerName}` : ''}`;
  const exportPdf = () => downloadReportPdf({ title: 'Aged Receivables', subtitle, columns: exportColumns, rows });
  const exportExcel = () => downloadReportExcel({ title: 'Aged Receivables', subtitle, columns: exportColumns, rows });

  return (
    <PageLayout title="Aged Receivables" actions={rows && <ReportExportButtons onPdf={exportPdf} onExcel={exportExcel} />}>
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
      <div className="flex items-end gap-3 mb-4 flex-wrap">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Customer</span>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input min-w-[200px]">
            <option value="">All customers</option>
            {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">As on date</span>
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="input" /></label>
        <button onClick={run} disabled={loading} className="btn-primary disabled:opacity-60">{loading ? 'Running…' : 'Run Report'}</button>
      </div>

      {!rows && !loading && (
        <div className="text-center py-12 text-slate-400">Select filters and click "Run Report" to view aged receivables.</div>
      )}

      {rows && <DataTable columns={columns} data={rows} />}
    </PageLayout>
  );
}
