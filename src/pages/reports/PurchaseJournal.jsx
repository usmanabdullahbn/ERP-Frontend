import { useEffect, useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import ReportExportButtons from '../../components/ReportExportButtons';
import MultiSelect from '../../components/MultiSelect';
import { downloadReportPdf, downloadReportExcel } from '../../components/reportExport';
import { formatMoney, formatDate, firstOfMonthLocalISODate, lastOfMonthLocalISODate } from '../../components/ui';

const columns = [
  { key: 'date', label: 'Date', render: (r) => r.date ? new Date(r.date).toLocaleDateString() : '—' },
  { key: 'type', label: 'Type' },
  { key: 'reference', label: 'Reference' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'description', label: 'Description' },
  { key: 'status', label: 'Status' },
  { key: 'debit', label: 'Debit', align: 'right', mono: true, render: (r) => r.debit ? formatMoney(r.debit) : '' },
  { key: 'credit', label: 'Credit', align: 'right', mono: true, render: (r) => r.credit ? formatMoney(r.credit) : '' }
];

const exportColumns = [
  { key: 'date', label: 'Date', date: true },
  { key: 'type', label: 'Type' },
  { key: 'reference', label: 'Reference' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'description', label: 'Description' },
  { key: 'status', label: 'Status' },
  { key: 'debit', label: 'Debit', align: 'right', money: true },
  { key: 'credit', label: 'Credit', align: 'right', money: true }
];

export default function PurchaseJournal() {
  const [data, setData] = useState(null);
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
    api.get('/reports/purchase-journal', { params })
      .then((res) => setData(res.data))
      .catch(() => setError('Could not load purchase journal.'))
      .finally(() => setLoading(false));
  };

  const money = formatMoney;
  const supplierNames = suppliers.filter((s) => supplierIds.includes(s._id)).map((s) => s.name).join(', ');
  const subtitle = `Period: ${from ? formatDate(from) : 'inception'} to ${to ? formatDate(to) : 'today'}${supplierNames ? ` — ${supplierNames}` : ''}`;
  const exportTotals = () => ['', '', '', '', '', 'Total', money(data.totalDebit), money(data.totalCredit)];
  const exportPdf = () => downloadReportPdf({ title: 'Purchase Journal', subtitle, columns: exportColumns, rows: data.rows, totals: exportTotals() });
  const exportExcel = () => downloadReportExcel({ title: 'Purchase Journal', subtitle, columns: exportColumns, rows: data.rows, totals: exportTotals() });

  return (
    <PageLayout title="Purchase Journal" actions={data && <ReportExportButtons onPdf={exportPdf} onExcel={exportExcel} />}>
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

      {!data && !loading && (
        <div className="text-center py-12 text-slate-400">Select filters and click "Run Report" to view the purchase journal.</div>
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
