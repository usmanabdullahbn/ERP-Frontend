import { useEffect, useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import DataTable from '../../components/DataTable';
import ReportExportButtons from '../../components/ReportExportButtons';
import { downloadReportPdf, downloadReportExcel } from '../../components/reportExport';
import { formatMoney, formatDate } from '../../components/ui';

const columns = [
  { key: 'orderNumber', label: 'Order #' },
  { key: 'customer', label: 'Customer' },
  { key: 'customerCode', label: 'Customer Code' },
  { key: 'date', label: 'Date', render: (r) => r.date ? new Date(r.date).toLocaleDateString() : '—' },
  { key: 'dueDate', label: 'Due Date', render: (r) => r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—' },
  { key: 'status', label: 'Status' },
  { key: 'grandTotal', label: 'Order Total', align: 'right', mono: true, render: (r) => formatMoney(r.grandTotal) },
  { key: 'amountInvoiced', label: 'Invoiced', align: 'right', mono: true, render: (r) => formatMoney(r.amountInvoiced) },
  { key: 'balanceDue', label: 'Balance Due', align: 'right', mono: true, render: (r) => formatMoney(r.balanceDue) }
];

const exportColumns = [
  { key: 'orderNumber', label: 'Order #' },
  { key: 'customer', label: 'Customer' },
  { key: 'customerCode', label: 'Customer Code' },
  { key: 'date', label: 'Date', date: true },
  { key: 'dueDate', label: 'Due Date', date: true },
  { key: 'status', label: 'Status' },
  { key: 'grandTotal', label: 'Order Total', align: 'right', money: true },
  { key: 'amountInvoiced', label: 'Invoiced', align: 'right', money: true },
  { key: 'balanceDue', label: 'Balance Due', align: 'right', money: true }
];

export default function PendingOrders() {
  const [rows, setRows] = useState(null);
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
    api.get('/reports/pending-orders', { params })
      .then((res) => setRows(res.data))
      .catch(() => setError('Could not load pending orders.'))
      .finally(() => setLoading(false));
  };

  const customerName = customers.find((c) => c._id === customerId)?.name;
  const subtitle = `Period: ${from ? formatDate(from) : 'inception'} to ${to ? formatDate(to) : 'today'}${customerName ? ` — ${customerName}` : ''}`;
  const exportPdf = () => downloadReportPdf({ title: 'Pending Orders', subtitle, columns: exportColumns, rows });
  const exportExcel = () => downloadReportExcel({ title: 'Pending Orders', subtitle, columns: exportColumns, rows });

  return (
    <PageLayout title="Pending Orders" actions={rows && <ReportExportButtons onPdf={exportPdf} onExcel={exportExcel} />}>
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

      {!rows && !loading && (
        <div className="text-center py-12 text-slate-400">Select filters and click "Run Report" to view pending orders.</div>
      )}

      {rows && <DataTable columns={columns} data={rows} emptyMessage="No pending orders found." />}
    </PageLayout>
  );
}
