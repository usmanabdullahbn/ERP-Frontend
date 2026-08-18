import { useEffect, useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import DataTable from '../../components/DataTable';
import { formatMoney } from '../../components/ui';

export default function PurchaseJournal() {
  const [data, setData] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    api.get('/reports/purchase-journal', { params }).then((res) => setData(res.data)).catch(() => setError('Could not load purchase journal.'));
  };
  useEffect(() => { load(); }, []);

  const money = formatMoney;

  const columns = [
    { key: 'date', label: 'Date', render: (r) => r.date ? new Date(r.date).toLocaleDateString() : '—' },
    { key: 'type', label: 'Type' },
    { key: 'reference', label: 'Reference' },
    { key: 'supplier', label: 'Supplier' },
    { key: 'description', label: 'Description' },
    { key: 'status', label: 'Status' },
    { key: 'debit', label: 'Debit', align: 'right', mono: true, render: (r) => r.debit ? money(r.debit) : '' },
    { key: 'credit', label: 'Credit', align: 'right', mono: true, render: (r) => r.credit ? money(r.credit) : '' }
  ];

  return (
    <PageLayout title="Purchase Journal">
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
      <div className="flex items-end gap-3 mb-4">
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" /></label>
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" /></label>
        <button onClick={load} className="btn-primary">Apply</button>
      </div>

      {data && (
        <>
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
        </>
      )}
    </PageLayout>
  );
}
