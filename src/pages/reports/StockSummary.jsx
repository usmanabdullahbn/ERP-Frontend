import { useEffect, useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import DataTable from '../../components/DataTable';
import { formatMoney } from '../../components/ui';

export default function StockSummary() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/reports/stock-summary').then((res) => setData(res.data)).catch(() => setError('Could not load the stock summary.')); }, []);

  const money = formatMoney;

  const columns = [
    { key: 'sku', label: 'SKU' },
    { key: 'name', label: 'Product' },
    { key: 'totalQuantity', label: 'Qty', align: 'right', mono: true },
    { key: 'stockValue', label: 'Stock Value', align: 'right', mono: true, render: (r) => money(r.stockValue) },
    { key: 'reorderLevel', label: 'Reorder Level', align: 'right', mono: true },
    { key: 'status', label: 'Status', render: (r) => r.belowReorder ? <span className="text-ledger-rose text-xs font-medium">Reorder needed</span> : <span className="text-ledger-teal text-xs">OK</span> }
  ];

  return (
    <PageLayout title="Stock Summary">
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
      {data && (
        <>
          <div className="mb-4 bg-white rounded-xl border border-slate-200 shadow-card p-5 flex justify-between items-center">
            <span className="font-display text-ink-800">Total Stock Value</span>
            <span className="font-figures text-xl font-semibold">{money(data.totalStockValue)}</span>
          </div>
          <DataTable columns={columns} data={data.rows} />
        </>
      )}
    </PageLayout>
  );
}
