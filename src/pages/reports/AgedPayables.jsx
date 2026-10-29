import { useEffect, useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import DataTable from '../../components/DataTable';
import ReportExportButtons from '../../components/ReportExportButtons';
import MultiSelect from '../../components/MultiSelect';
import FilterBar, { matchesSearch, distinctValues, filterNote } from '../../components/FilterBar';
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
  const [supplierIds, setSupplierIds] = useState([]);
  const [asOf, setAsOf] = useState(todayLocalISODate());
  const [search, setSearch] = useState('');
  const [bucketFilter, setBucketFilter] = useState('');
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
    if (supplierIds.length) params.supplierId = supplierIds.join(',');
    api.get('/reports/aged-payables', { params })
      .then((res) => setRows(res.data.rows))
      .catch(() => setError('Could not load aged payables.'))
      .finally(() => setLoading(false));
  };

  const supplierNames = suppliers.filter((s) => supplierIds.includes(s._id)).map((s) => s.name).join(', ');
  const subtitle = `As on ${formatDate(asOf)}${supplierNames ? ` — ${supplierNames}` : ''}${filterNote(search, ['Bucket', bucketFilter])}`;
  const visibleRows = (rows || []).filter((r) =>
    matchesSearch(search, r.billNumber, r.supplier)
    && (!bucketFilter || r.bucket === bucketFilter)
  );
  const hasFilters = Boolean(search || bucketFilter);
  const clearFilters = () => { setSearch(''); setBucketFilter(''); };
  const totalDue = visibleRows.reduce((s, r) => s + Number(r.balanceDue || 0), 0);
  const totals = [`Total (${visibleRows.length} bills)`, '', '', '', '', formatMoney(totalDue)];
  const exportPdf = () => downloadReportPdf({ title: 'Aged Payables', subtitle, columns: exportColumns, rows: visibleRows, totals });
  const exportExcel = () => downloadReportExcel({ title: 'Aged Payables', subtitle, columns: exportColumns, rows: visibleRows, totals });

  return (
    <PageLayout title="Aged Payables" actions={rows && <ReportExportButtons onPdf={exportPdf} onExcel={exportExcel} />}>
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
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">As on date</span>
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="input" /></label>
        <button onClick={run} disabled={loading} className="btn-primary disabled:opacity-60">{loading ? 'Running…' : 'Run Report'}</button>
      </div>

      {!rows && !loading && (
        <div className="text-center py-12 text-slate-400">Select filters and click "Run Report" to view aged payables.</div>
      )}

      {rows && (
        <>
          <FilterBar search={search} onSearch={setSearch} placeholder="Search supplier, bill #…" showClear={hasFilters} onClear={clearFilters}>
            <select value={bucketFilter} onChange={(e) => setBucketFilter(e.target.value)} className="input w-auto">
              <option value="">All ageing buckets</option>
              {distinctValues(rows, 'bucket').map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </FilterBar>
          <DataTable columns={columns} data={visibleRows} emptyMessage={hasFilters ? 'Nothing matches your filters.' : 'Nothing outstanding.'} footer={[totals]} />
        </>
      )}
    </PageLayout>
  );
}
