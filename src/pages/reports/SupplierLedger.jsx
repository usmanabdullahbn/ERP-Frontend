import { useEffect, useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import DataTable from '../../components/DataTable';
import { formatMoney } from '../../components/ui';

export default function SupplierLedger() {
  const [rows, setRows] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showBf, setShowBf] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedSupplier) params.append('supplierId', selectedSupplier);
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      const { data } = await api.get(`/reports/supplier-ledger${params.toString() ? `?${params.toString()}` : ''}`);
      setRows(Array.isArray(data) ? data : [data].filter(Boolean));
    } catch {
      setError('Could not load supplier ledger.');
    }
  };

  useEffect(() => {
    api.get('/suppliers').then((res) => setSuppliers(res.data)).catch(() => setError('Could not load suppliers.'));
  }, []);

  useEffect(() => {
    load();
  }, [selectedSupplier, from, to]);

  const money = formatMoney;

  const ledgerColumns = [
    { key: 'date', label: 'Date', render: (r) => r._bf ? '—' : new Date(r.date).toLocaleDateString() },
    { key: 'type', label: 'Type' },
    { key: 'ref', label: 'Ref' },
    { key: 'debit', label: 'Debit', align: 'right', mono: true, render: (r) => r._bf ? '' : money(r.debit) },
    { key: 'credit', label: 'Credit', align: 'right', mono: true, render: (r) => r._bf ? '' : money(r.credit) },
    { key: 'balance', label: 'Balance', align: 'right', mono: true, render: (r) => money(r.balance) }
  ];

  const selectedLedger = rows[0];
  const bfRow = selectedLedger ? { _bf: true, type: 'Balance b/f', ref: '', balance: selectedLedger.openingBalance || 0 } : null;
  const tableRows = showBf && bfRow ? [bfRow, ...(selectedLedger?.entries || [])] : (selectedLedger?.entries || []);

  return (
    <PageLayout title="Supplier Ledger">
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Supplier</span>
          <select value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)} className="input">
            <option value="">All suppliers</option>
            {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
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
        <div className="flex items-end">
          <button type="button" onClick={() => { setSelectedSupplier(''); setFrom(''); setTo(''); }} className="btn-ghost w-full">Clear</button>
        </div>
      </div>

      <label className="mb-4 flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={showBf} onChange={(e) => setShowBf(e.target.checked)} />
        Show balance b/f
      </label>

      {selectedLedger && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-500">Supplier</span>
            <span className="font-medium">{selectedLedger.supplier?.name || '—'}</span>
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

      <DataTable columns={ledgerColumns} data={tableRows} />
    </PageLayout>
  );
}
