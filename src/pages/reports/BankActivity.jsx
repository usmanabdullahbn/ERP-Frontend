import { useEffect, useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import DataTable from '../../components/DataTable';
import { formatMoney } from '../../components/ui';

export default function BankActivity() {
  const [rows, setRows] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    api.get('/reports/bank-activity', { params }).then((res) => setRows(res.data)).catch(() => setError('Could not load bank activity.'));
  };
  useEffect(() => { load(); }, []);

  const money = formatMoney;

  const columns = [
    { key: 'date', label: 'Date', render: (r) => r.date ? new Date(r.date).toLocaleDateString() : '—' },
    { key: 'bankAccount', label: 'Bank Account' },
    { key: 'type', label: 'Type' },
    { key: 'reference', label: 'Reference' },
    { key: 'description', label: 'Description' },
    { key: 'contraDetails', label: 'Contra / Transfer' },
    { key: 'amount', label: 'Amount', align: 'right', mono: true, render: (r) => money(r.amount) }
  ];

  return (
    <PageLayout title="Bank Activity">
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
      <div className="flex items-end gap-3 mb-4">
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" /></label>
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" /></label>
        <button onClick={load} className="btn-primary">Apply</button>
      </div>
      <DataTable columns={columns} data={rows} emptyMessage="No bank activity found." />
    </PageLayout>
  );
}
