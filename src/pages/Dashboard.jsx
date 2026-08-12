import { useEffect, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Wallet, Landmark, Receipt, Package, AlertTriangle, TrendingUp } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import StatCard from '../components/StatCard';
import { formatMoney } from '../components/ui';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard/summary')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Could not load dashboard.'));
  }, []);

  // No currency symbol, matching every other page in the app — see formatMoney.
  const money = formatMoney;

  return (
    <PageLayout title="Dashboard">
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            <StatCard label="Cash & Bank" value={money(data.cashAndBank)} icon={Landmark} tone="positive" />
            <StatCard label="Receivable" value={money(data.totalReceivable)} icon={Wallet} />
            <StatCard label="Payable" value={money(data.totalPayable)} icon={Receipt} tone="negative" />
            <StatCard label="Sales (30d)" value={money(data.totalSales30d)} icon={TrendingUp} />
            <StatCard label="Stock Value" value={money(data.totalStockValue)} icon={Package} />
            <StatCard
              label="Low Stock Items"
              value={data.lowStockCount}
              icon={AlertTriangle}
              tone={data.lowStockCount > 0 ? 'warning' : 'default'}
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
            <h2 className="font-display text-base text-ink-800 mb-4">Sales — last 6 months</h2>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data.salesTrend}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0F766E" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0F766E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => money(v)} />
                <Area type="monotone" dataKey="total" stroke="#0F766E" strokeWidth={2} fill="url(#salesFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </PageLayout>
  );
}
