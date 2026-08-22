import { useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import DataTable from '../../components/DataTable';
import ReportExportButtons from '../../components/ReportExportButtons';
import { downloadReportPdf, downloadReportExcel } from '../../components/reportExport';
import { formatMoney, formatDate, todayLocalISODate } from '../../components/ui';

const columns = [
  { key: 'sku', label: 'SKU' },
  { key: 'name', label: 'Product' },
  { key: 'totalQuantity', label: 'Qty', align: 'right', mono: true },
  { key: 'stockValue', label: 'Stock Value', align: 'right', mono: true, render: (r) => formatMoney(r.stockValue) },
  { key: 'reorderLevel', label: 'Reorder Level', align: 'right', mono: true },
  { key: 'status', label: 'Status', render: (r) => r.belowReorder ? <span className="text-ledger-rose text-xs font-medium">Reorder needed</span> : <span className="text-ledger-teal text-xs">OK</span> }
];

const exportColumns = [
  { key: 'sku', label: 'SKU' },
  { key: 'name', label: 'Product' },
  { key: 'totalQuantity', label: 'Qty', align: 'right' },
  { key: 'stockValue', label: 'Stock Value', align: 'right', money: true },
  { key: 'reorderLevel', label: 'Reorder Level', align: 'right' },
  { key: 'status', label: 'Status' }
];

export default function StockSummary() {
  const [data, setData] = useState(null);
  const [asOf, setAsOf] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const run = () => {
    setLoading(true);
    setError('');
    const params = {};
    if (asOf) params.asOf = asOf;
    api.get('/reports/stock-summary', { params })
      .then((res) => setData(res.data))
      .catch(() => setError('Could not load the stock summary.'))
      .finally(() => setLoading(false));
  };

  const subtitle = `As of ${formatDate(asOf || todayLocalISODate())}`;
  const exportRows = () => data.rows.map((r) => ({ ...r, status: r.belowReorder ? 'Reorder needed' : 'OK' }));
  const exportTotals = () => ['', '', 'Total', formatMoney(data.totalStockValue), '', ''];
  const exportPdf = () => downloadReportPdf({ title: 'Stock Summary', subtitle, columns: exportColumns, rows: exportRows(), totals: exportTotals() });
  const exportExcel = () => downloadReportExcel({ title: 'Stock Summary', subtitle, columns: exportColumns, rows: exportRows(), totals: exportTotals() });

  const money = formatMoney;

  return (
    <PageLayout title="Stock Summary" actions={data && <ReportExportButtons onPdf={exportPdf} onExcel={exportExcel} />}>
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
      <div className="flex items-end gap-3 mb-4">
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">As of</span>
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="input" /></label>
        <button onClick={run} disabled={loading} className="btn-primary disabled:opacity-60">{loading ? 'Running…' : 'Run Report'}</button>
        {asOf && <span className="text-xs text-slate-400 pb-2">Showing stock as it stood on {asOf}. Stock value still uses current cost price.</span>}
      </div>

      {!data && !loading && (
        <div className="text-center py-12 text-slate-400">Click "Run Report" to view the stock summary.</div>
      )}

      {data && (
        <>
          <div className="mb-4 bg-white rounded-xl border border-slate-200 shadow-card p-5 flex justify-between items-center">
            <span className="font-display text-ink-800">Total Stock Value</span>
            <span className="font-figures text-xl font-semibold">{money(data.totalStockValue)}</span>
          </div>
          <DataTable columns={columns} data={data.rows} />
        </>
      )}
    </PageLayout>
  );
}
