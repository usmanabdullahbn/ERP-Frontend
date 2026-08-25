import { useEffect, useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import DataTable from '../../components/DataTable';
import ReportExportButtons from '../../components/ReportExportButtons';
import MultiSelect from '../../components/MultiSelect';
import { downloadReportPdf, downloadReportExcel } from '../../components/reportExport';
import { formatMoney, formatDate, firstOfMonthLocalISODate, lastOfMonthLocalISODate } from '../../components/ui';

const columns = [
  { key: 'poNumber', label: 'PO #' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'supplierCode', label: 'Supplier Code' },
  { key: 'date', label: 'Date', render: (r) => r.date ? new Date(r.date).toLocaleDateString() : '—' },
  { key: 'dueDate', label: 'Due Date', render: (r) => r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—' },
  { key: 'status', label: 'Status' },
  { key: 'grandTotal', label: 'PO Total', align: 'right', mono: true, render: (r) => formatMoney(r.grandTotal) },
  { key: 'amountBilled', label: 'Billed', align: 'right', mono: true, render: (r) => formatMoney(r.amountBilled) },
  { key: 'balanceDue', label: 'Balance Due', align: 'right', mono: true, render: (r) => formatMoney(r.balanceDue) }
];

const exportColumns = [
  { key: 'poNumber', label: 'PO #' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'supplierCode', label: 'Supplier Code' },
  { key: 'date', label: 'Date', date: true },
  { key: 'dueDate', label: 'Due Date', date: true },
  { key: 'status', label: 'Status' },
  { key: 'grandTotal', label: 'PO Total', align: 'right', money: true },
  { key: 'amountBilled', label: 'Billed', align: 'right', money: true },
  { key: 'balanceDue', label: 'Balance Due', align: 'right', money: true }
];

export default function PendingPurchaseOrders() {
  const [rows, setRows] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierIds, setSupplierIds] = useState([]);
  const [from, setFrom] = useState(firstOfMonthLocalISODate());
  const [to, setTo] = useState(lastOfMonthLocalISODate());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/suppliers').then((res) => setSuppliers(res.data)).catch(() => setError('Could not load suppliers.'));
  }, []);

  const run = () => {
    setLoading(true);
    setError('');
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (supplierIds.length) params.supplierId = supplierIds.join(',');
    api.get('/reports/pending-purchase-orders', { params })
      .then((res) => setRows(res.data))
      .catch(() => setError('Could not load pending purchase orders.'))
      .finally(() => setLoading(false));
  };

  const supplierNames = suppliers.filter((s) => supplierIds.includes(s._id)).map((s) => s.name).join(', ');
  const subtitle = `Period: ${from ? formatDate(from) : 'inception'} to ${to ? formatDate(to) : 'today'}${supplierNames ? ` — ${supplierNames}` : ''}`;
  const exportPdf = () => downloadReportPdf({ title: 'Pending Purchase Orders', subtitle, columns: exportColumns, rows });
  const exportExcel = () => downloadReportExcel({ title: 'Pending Purchase Orders', subtitle, columns: exportColumns, rows });

  return (
    <PageLayout title="Pending Purchase Orders" actions={rows && <ReportExportButtons onPdf={exportPdf} onExcel={exportExcel} />}>
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
      <div className="flex items-end gap-3 mb-4 flex-wrap">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Supplier</span>
          <MultiSelect
            className="min-w-[200px]"
            options={suppliers.map((s) => ({ value: s._id, label: s.name }))}
            selected={supplierIds}
            onChange={setSupplierIds}
            placeholder="All suppliers"
          />
        </label>
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" /></label>
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" /></label>
        <button onClick={run} disabled={loading} className="btn-primary disabled:opacity-60">{loading ? 'Running…' : 'Run Report'}</button>
      </div>

      {!rows && !loading && (
        <div className="text-center py-12 text-slate-400">Select filters and click "Run Report" to view pending purchase orders.</div>
      )}

      {rows && <DataTable columns={columns} data={rows} emptyMessage="No pending purchase orders found." />}
    </PageLayout>
  );
}
