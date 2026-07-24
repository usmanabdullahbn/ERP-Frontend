import { useEffect, useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';

export default function ProfitAndLoss() {
  const [data, setData] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = () => {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    api.get('/reports/profit-and-loss', { params }).then((res) => setData(res.data));
  };
  useEffect(() => { load(); }, []);

  const money = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

  return (
    <PageLayout title="Profit &amp; Loss">
      <div className="flex items-end gap-3 mb-4">
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" /></label>
        <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" /></label>
        <button onClick={load} className="btn-primary">Apply</button>
      </div>

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
            <h2 className="font-display text-sm text-ink-800 mb-3">Income</h2>
            {data.income.map((r) => (
              <div key={r.code} className="flex justify-between text-sm py-1"><span>{r.name}</span><span className="font-figures">{money(r.amount)}</span></div>
            ))}
            <div className="flex justify-between text-sm font-semibold pt-2 mt-2 border-t border-slate-200"><span>Total Income</span><span className="font-figures text-ledger-teal">{money(data.totalIncome)}</span></div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
            <h2 className="font-display text-sm text-ink-800 mb-3">Expenses</h2>
            {data.expense.map((r) => (
              <div key={r.code} className="flex justify-between text-sm py-1"><span>{r.name}</span><span className="font-figures">{money(r.amount)}</span></div>
            ))}
            <div className="flex justify-between text-sm font-semibold pt-2 mt-2 border-t border-slate-200"><span>Total Expense</span><span className="font-figures text-ledger-rose">{money(data.totalExpense)}</span></div>
          </div>
          <div className="md:col-span-2 bg-ink-900 rounded-xl p-5 flex justify-between items-center">
            <span className="text-white font-display">Net Profit</span>
            <span className={`font-figures text-xl font-semibold ${data.netProfit >= 0 ? 'text-ledger-teal' : 'text-ledger-rose'}`}>{money(data.netProfit)}</span>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
