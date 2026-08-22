import { useEffect, useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import DataTable from '../../components/DataTable';
import ReportExportButtons from '../../components/ReportExportButtons';
import { downloadReportPdf, downloadReportExcel } from '../../components/reportExport';
import { formatMoney, formatDate } from '../../components/ui';

const exportColumns = [
  { key: 'date', label: 'Date', date: true },
  { key: 'type', label: 'Type' },
  { key: 'ref', label: 'Ref' },
  { key: 'debit', label: 'Debit', align: 'right', money: true },
  { key: 'credit', label: 'Credit', align: 'right', money: true },
  { key: 'balance', label: 'Balance', align: 'right', money: true }
];

export default function CustomerLedger() {
  const [rows, setRows] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showBf, setShowBf] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/customers').then((res) => setCustomers(res.data)).catch(() => setError('Could not load customers.'));
  }, []);

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (selectedCustomer) params.append('customerId', selectedCustomer);
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      const { data } = await api.get(`/reports/customer-ledger${params.toString() ? `?${params.toString()}` : ''}`);
      setRows(Array.isArray(data) ? data : [data].filter(Boolean));
    } catch {
      setError('Could not load customer ledger.');
    } finally {
      setLoading(false);
    }
  };

  const money = formatMoney;

  const ledgerColumns = [
    { key: 'date', label: 'Date', render: (r) => r._bf ? '—' : new Date(r.date).toLocaleDateString() },
    { key: 'type', label: 'Type' },
    { key: 'ref', label: 'Ref' },
    { key: 'debit', label: 'Debit', align: 'right', mono: true, render: (r) => r._bf ? '' : money(r.debit) },
    { key: 'credit', label: 'Credit', align: 'right', mono: true, render: (r) => r._bf ? '' : money(r.credit) },
    { key: 'balance', label: 'Balance', align: 'right', mono: true, render: (r) => money(r.balance) }
  ];

  const selectedLedger = rows?.[0];
  const bfRow = selectedLedger ? { _bf: true, type: 'Balance b/f', ref: '', balance: selectedLedger.openingBalance || 0 } : null;
  const tableRows = showBf && bfRow ? [bfRow, ...(selectedLedger?.entries || [])] : (selectedLedger?.entries || []);

  const customerName = customers.find((c) => c._id === selectedCustomer)?.name;
  const subtitle = `${customerName || 'All customers'} — ${from ? formatDate(from) : 'inception'} to ${to ? formatDate(to) : 'today'}`;
  const exportRows = () => tableRows.map((r) => ({ ...r, date: r._bf ? '' : r.date, debit: r._bf ? '' : r.debit, credit: r._bf ? '' : r.credit }));
  const exportPdf = () => downloadReportPdf({ title: 'Customer Ledger', subtitle, columns: exportColumns, rows: exportRows() });
  const exportExcel = () => downloadReportExcel({ title: 'Customer Ledger', subtitle, columns: exportColumns, rows: exportRows() });

  return (
    <PageLayout title="Customer Ledger" actions={rows && <ReportExportButtons onPdf={exportPdf} onExcel={exportExcel} />}>
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Customer</span>
          <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)} className="input">
            <option value="">All customers</option>
            {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
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
          <button type="button" onClick={() => { setSelectedCustomer(''); setFrom(''); setTo(''); setRows(null); }} className="btn-ghost">Clear</button>
        </div>
      </div>

      <label className="mb-4 flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={showBf} onChange={(e) => setShowBf(e.target.checked)} />
        Show balance b/f
      </label>

      {!rows && !loading && (
        <div className="text-center py-12 text-slate-400">Select filters and click "Run Report" to view the customer ledger.</div>
      )}

      {selectedLedger && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-500">Customer</span>
            <span className="font-medium">{selectedLedger.customer?.name || '—'}</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-500">Opening balance</span>
            <span className="font-figures">{money(selectedLedger.openingBalance || 0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Closing balance</span>
            <span className="font-figures font-medium">{money(selectedLedger.closingBalance || 0)}</span>
          </div>
        </div>
      )}

      {rows && <DataTable columns={ledgerColumns} data={tableRows} />}
    </PageLayout>
  );
}
