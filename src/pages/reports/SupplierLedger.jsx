import { useEffect, useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import ReportExportButtons from '../../components/ReportExportButtons';
import MultiSelect from '../../components/MultiSelect';
import { downloadReportPdf, downloadReportExcel } from '../../components/reportExport';
import { formatMoney, formatDate, firstOfMonthLocalISODate, lastOfMonthLocalISODate } from '../../components/ui';

const exportColumns = [
  { key: 'supplier', label: 'Supplier' },
  { key: 'date', label: 'Date', date: true },
  { key: 'type', label: 'Type' },
  { key: 'ref', label: 'Ref' },
  { key: 'debit', label: 'Debit', align: 'right', money: true },
  { key: 'credit', label: 'Credit', align: 'right', money: true },
  { key: 'balance', label: 'Balance', align: 'right', money: true }
];

export default function SupplierLedger() {
  const [rows, setRows] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierIds, setSupplierIds] = useState([]);
  const [from, setFrom] = useState(firstOfMonthLocalISODate());
  const [to, setTo] = useState(lastOfMonthLocalISODate());
  const [showBf, setShowBf] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/suppliers').then((res) => setSuppliers(res.data)).catch(() => setError('Could not load suppliers.'));
  }, []);

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (supplierIds.length) params.supplierId = supplierIds.join(',');
      if (from) params.from = from;
      if (to) params.to = to;
      const { data } = await api.get('/reports/supplier-ledger', { params });
      setRows(Array.isArray(data) ? data : [data].filter(Boolean));
    } catch {
      setError('Could not load supplier ledger.');
    } finally {
      setLoading(false);
    }
  };

  const money = formatMoney;

  const supplierNames = suppliers.filter((s) => supplierIds.includes(s._id)).map((s) => s.name).join(', ');
  const subtitle = `${supplierNames || 'All suppliers'} — ${from ? formatDate(from) : 'inception'} to ${to ? formatDate(to) : 'today'}`;

  const exportRows = () => {
    const out = [];
    (rows || []).forEach((ledger) => {
      const supplier = ledger.supplier?.name || '—';
      if (showBf) out.push({ supplier, date: '', type: 'Balance b/f', ref: '', debit: '', credit: '', balance: ledger.openingBalance || 0 });
      ledger.entries.forEach((e) => out.push({ supplier, date: e.date, type: e.type, ref: e.ref, debit: e.debit || '', credit: e.credit || '', balance: e.balance }));
      out.push({ supplier, date: '', type: 'Closing balance', ref: '', debit: '', credit: '', balance: ledger.closingBalance });
    });
    return out;
  };
  const exportPdf = () => downloadReportPdf({ title: 'Supplier Ledger', subtitle, columns: exportColumns, rows: exportRows() });
  const exportExcel = () => downloadReportExcel({ title: 'Supplier Ledger', subtitle, columns: exportColumns, rows: exportRows() });

  return (
    <PageLayout title="Supplier Ledger" actions={rows && <ReportExportButtons onPdf={exportPdf} onExcel={exportExcel} />}>
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Supplier</span>
          <MultiSelect
            options={suppliers.map((s) => ({ value: s._id, label: s.name }))}
            selected={supplierIds}
            onChange={setSupplierIds}
            placeholder="All suppliers"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
        </label>
        <div className="flex items-end gap-2">
          <button type="button" onClick={run} disabled={loading} className="btn-primary flex-1 disabled:opacity-60">{loading ? 'Running…' : 'Run Report'}</button>
          <button type="button" onClick={() => { setSupplierIds([]); setFrom(''); setTo(''); setRows(null); }} className="btn-ghost">Clear</button>
        </div>
      </div>

      <label className="mb-4 flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={showBf} onChange={(e) => setShowBf(e.target.checked)} />
        Show balance b/f
      </label>

      {!rows && !loading && (
        <div className="text-center py-12 text-slate-400">Select filters and click "Run Report" to view the supplier ledger.</div>
      )}

      {rows && rows.length > 0 && (
        <div className="space-y-6">
          {rows.map((ledger) => {
            const bfRow = { _bf: true, type: 'Balance b/f', ref: '', balance: ledger.openingBalance || 0 };
            const entryRows = showBf ? [bfRow, ...ledger.entries] : ledger.entries;
            return (
              <div key={ledger.supplier._id} className="bg-white rounded-xl border border-slate-200 shadow-card overflow-x-auto">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{ledger.supplier?.name}</h3>
                    <p className="text-xs text-slate-500">{ledger.supplier?.code}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-slate-500 text-xs">Closing balance</p>
                    <p className="font-figures font-semibold">{money(ledger.closingBalance || 0)}</p>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Ref</th>
                      <th className="px-4 py-3 text-right">Debit</th>
                      <th className="px-4 py-3 text-right">Credit</th>
                      <th className="px-4 py-3 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entryRows.map((r, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="px-4 py-2">{r._bf ? '—' : new Date(r.date).toLocaleDateString()}</td>
                        <td className="px-4 py-2">{r.type}</td>
                        <td className="px-4 py-2">{r.ref}</td>
                        <td className="px-4 py-2 text-right font-figures">{r._bf ? '' : (r.debit ? money(r.debit) : '')}</td>
                        <td className="px-4 py-2 text-right font-figures">{r._bf ? '' : (r.credit ? money(r.credit) : '')}</td>
                        <td className="px-4 py-2 text-right font-figures font-semibold">{money(r.balance)}</td>
                      </tr>
                    ))}
                    {entryRows.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No entries in this period.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {rows && rows.length === 0 && (
        <div className="text-center py-12 text-slate-400">No suppliers found.</div>
      )}
    </PageLayout>
  );
}
