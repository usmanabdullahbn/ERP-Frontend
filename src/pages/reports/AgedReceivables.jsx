import { useEffect, useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import DataTable from '../../components/DataTable';
import { formatMoney, todayLocalISODate } from '../../components/ui';

export default function AgedReceivables() {
  const [rows, setRows] = useState([]);
  const [asOf, setAsOf] = useState(todayLocalISODate());
  const [error, setError] = useState('');

  const load = () => {
    const params = {};
    if (asOf) params.asOf = asOf;
    api.get('/reports/aged-receivables', { params })
      .then((res) => setRows(res.data.rows))
      .catch(() => setError('Could not load aged receivables.'));
  };
  useEffect(() => { load(); }, []);

  const money = formatMoney;

  const columns = [
    { key: 'customer', label: 'Customer' },
    { key: 'invoiceNumber', label: 'Invoice #' },
    { key: 'dueDate', label: 'Due Date', render: (r) => r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—' },
    { key: 'daysOverdue', label: 'Days Overdue', align: 'right', mono: true },
    { key: 'bucket', label: 'Bucket' },
    { key: 'balanceDue', label: 'Balance Due', align: 'right', mono: true, render: (r) => money(r.balanceDue) }
  ];

  return (
    <PageLayout title="Aged Receivables">
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
      <div className="flex items-end gap-3 mb-4">
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">As on date</span>
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="input" /></label>
        <button onClick={load} className="btn-primary">Apply</button>
      </div>
      <DataTable columns={columns} data={rows} />
    </PageLayout>
  );
}
