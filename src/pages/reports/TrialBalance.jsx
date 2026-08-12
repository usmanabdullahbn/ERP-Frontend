import { useEffect, useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import { formatMoney } from '../../components/ui';

export default function TrialBalance() {
  const [data, setData] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    api.get('/reports/trial-balance', { params }).then((res) => setData(res.data)).catch(() => setError('Could not load the trial balance.'));
  };
  useEffect(() => { load(); }, []);

  const money = formatMoney;

  return (
    <PageLayout title="Trial Balance">
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
      <div className="flex items-end gap-3 mb-4">
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" /></label>
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" /></label>
        <button onClick={load} className="btn-primary">Apply</button>
      </div>

      {data && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">Code</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.code} className="border-b border-slate-100">
                  <td className="px-4 py-2 font-figures">{r.code}</td>
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="px-4 py-2 text-slate-500">{r.type}</td>
                  <td className="px-4 py-2 text-right font-figures">{r.debit ? money(r.debit) : ''}</td>
                  <td className="px-4 py-2 text-right font-figures">{r.credit ? money(r.credit) : ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink-800 font-semibold">
                <td className="px-4 py-3" colSpan={3}>Total</td>
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
