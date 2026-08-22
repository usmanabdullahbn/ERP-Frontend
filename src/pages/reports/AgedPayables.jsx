import { useEffect, useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import DataTable from '../../components/DataTable';
import ReportExportButtons from '../../components/ReportExportButtons';
import { downloadReportPdf, downloadReportExcel } from '../../components/reportExport';
import { formatMoney, formatDate, todayLocalISODate } from '../../components/ui';

const columns = [
  { key: 'supplier', label: 'Supplier' },
  { key: 'billNumber', label: 'Bill #' },
  { key: 'dueDate', label: 'Due Date', render: (r) => r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—' },
  { key: 'daysOverdue', label: 'Days Overdue', align: 'right', mono: true },
  { key: 'bucket', label: 'Bucket' },
  { key: 'balanceDue', label: 'Balance Due', align: 'right', mono: true, render: (r) => formatMoney(r.balanceDue) }
];

const exportColumns = [
  { key: 'supplier', label: 'Supplier' },
  { key: 'billNumber', label: 'Bill #' },
  { key: 'dueDate', label: 'Due Date', date: true },
  { key: 'daysOverdue', label: 'Days Overdue', align: 'right' },
  { key: 'bucket', label: 'Bucket' },
  { key: 'balanceDue', label: 'Balance Due', align: 'right', money: true }
];

export default function AgedPayables() {
  const [rows, setRows] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [asOf, setAsOf] = useState(todayLocalISODate());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/suppliers').then((res) => setSuppliers(res.data)).catch(() => setError('Could not load suppliers.'));
  }, []);

  const run = () => {
    setLoading(true);
    setError('');
    const params = {};
    if (asOf) params.asOf = asOf;
    if (supplierId) params.supplierId = supplierId;
    api.get('/reports/aged-payables', { params })
      .then((res) => setRows(res.data.rows))
      .catch(() => setError('Could not load aged payables.'))
      .finally(() => setLoading(false));
  };

  const supplierName = suppliers.find((s) => s._id === supplierId)?.name;
  const subtitle = `As on ${formatDate(asOf)}${supplierName ? ` — ${supplierName}` : ''}`;
  const exportPdf = () => downloadReportPdf({ title: 'Aged Payables', subtitle, columns: exportColumns, rows });
  const exportExcel = () => downloadReportExcel({ title: 'Aged Payables', subtitle, columns: exportColumns, rows });

  return (
    <PageLayout title="Aged Payables" actions={rows && <ReportExportButtons onPdf={exportPdf} onExcel={exportExcel} />}>
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
      <div className="flex items-end gap-3 mb-4 flex-wrap">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Supplier</span>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="input min-w-[200px]">
            <option value="">All suppliers</option>
            {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </label>
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">As on date</span>
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="input" /></label>
        <button onClick={run} disabled={loading} className="btn-primary disabled:opacity-60">{loading ? 'Running…' : 'Run Report'}</button>
      </div>

      {!rows && !loading && (
        <div className="text-center py-12 text-slate-400">Select filters and click "Run Report" to view aged payables.</div>
      )}

      {rows && <DataTable columns={columns} data={rows} />}
    </PageLayout>
  );
}
