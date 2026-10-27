import { useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import DataTable from '../../components/DataTable';
import ReportExportButtons from '../../components/ReportExportButtons';
import { downloadReportPdf, downloadReportExcel } from '../../components/reportExport';
import { formatMoney, formatDate, todayLocalISODate, formatAltQty } from '../../components/ui';

const columns = [
  { key: 'sku', label: 'SKU' },
  { key: 'name', label: 'Product' },
  { key: 'totalQuantity', label: 'Qty', align: 'right', mono: true, render: (r) => `${r.totalQuantity} ${r.unit || ''}` },
  { key: 'altQuantity', label: 'Qty (Alt Unit)', align: 'right', mono: true, render: (r) => formatAltQty(r.totalQuantity, r) || '—' },
  { key: 'stockValue', label: 'Stock Value', align: 'right', mono: true, render: (r) => formatMoney(r.stockValue) }
];

const exportColumns = [
  { key: 'sku', label: 'SKU' },
  { key: 'name', label: 'Product' },
  { key: 'totalQuantity', label: 'Qty', align: 'right' },
  { key: 'unit', label: 'Unit' },
  { key: 'altQuantity', label: 'Qty (Alt Unit)', align: 'right' },
  { key: 'stockValue', label: 'Stock Value', align: 'right', money: true }
];

// "21,560 ft" — summed per unit so mixed units (ft, pcs…) are never added together.
function sumByUnit(rows) {
  const totals = {};
  rows.forEach((r) => { totals[r.unit || ''] = (totals[r.unit || ''] || 0) + Number(r.totalQuantity || 0); });
  return Object.entries(totals).map(([unit, qty]) => `${Math.round(qty * 100) / 100} ${unit}`.trim()).join(' · ');
}

// Whole alt units summed per alt unit, with the loose base-unit remainders kept separate.
function sumAltUnits(rows) {
  const whole = {};
  const rest = {};
  rows.forEach((r) => {
    const factor = Number(r.altUnitFactor || 0);
    if (!r.altUnit || factor <= 0) return;
    const qty = Number(r.totalQuantity || 0);
    const w = Math.trunc(qty / factor + (qty < 0 ? -1e-9 : 1e-9));
    whole[r.altUnit] = (whole[r.altUnit] || 0) + w;
    rest[r.unit || ''] = (rest[r.unit || ''] || 0) + (qty - w * factor);
  });
  const parts = Object.entries(whole).map(([u, n]) => `${n} ${u}`);
  Object.entries(rest).forEach(([u, n]) => {
    const v = Math.round(n * 100) / 100;
    if (v !== 0) parts.push(`${v} ${u}`.trim());
  });
  return parts.join(' + ');
}

export default function StockSummary() {
  const [data, setData] = useState(null);
  const [asOf, setAsOf] = useState(todayLocalISODate());
  const [excludeZero, setExcludeZero] = useState(false);
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

  const visibleRows = data ? (excludeZero ? data.rows.filter((r) => r.totalQuantity !== 0) : data.rows) : [];
  const subtitle = `As of ${formatDate(asOf || todayLocalISODate())}`;
  const exportRows = () => visibleRows.map((r) => ({ ...r, altQuantity: formatAltQty(r.totalQuantity, r) || '—' }));
  const visibleValue = visibleRows.reduce((s, r) => s + Number(r.stockValue || 0), 0);
  const footer = [[`Total (${visibleRows.length} items)`, '', sumByUnit(visibleRows), sumAltUnits(visibleRows) || '—', formatMoney(visibleValue)]];
  // Export has separate Qty / Unit columns, so the combined "570 ft" text goes in Qty and Unit stays blank.
  const exportTotals = () => [`Total (${visibleRows.length} items)`, '', sumByUnit(visibleRows), '', sumAltUnits(visibleRows), formatMoney(visibleValue)];
  const exportPdf = () => downloadReportPdf({ title: 'Stock Summary', subtitle, columns: exportColumns, rows: exportRows(), totals: exportTotals() });
  const exportExcel = () => downloadReportExcel({ title: 'Stock Summary', subtitle, columns: exportColumns, rows: exportRows(), totals: exportTotals() });

  const money = formatMoney;

  return (
    <PageLayout title="Stock Summary" actions={data && <ReportExportButtons onPdf={exportPdf} onExcel={exportExcel} />}>
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
      <div className="flex items-end gap-3 mb-4">
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">As of</span>
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="input" /></label>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={excludeZero} onChange={(e) => setExcludeZero(e.target.checked)} />
          Exclude zero
        </label>
        <button onClick={run} disabled={loading} className="btn-primary disabled:opacity-60">{loading ? 'Running…' : 'Run Report'}</button>
        {asOf && <span className="text-xs text-slate-400 pb-2">Showing stock as it stood on {asOf}. Stock value uses each product's current average cost.</span>}
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
          <DataTable columns={columns} data={visibleRows} footer={footer} />
        </>
      )}
    </PageLayout>
  );
}
