import { useEffect, useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import ReportExportButtons from '../../components/ReportExportButtons';
import MultiSelect from '../../components/MultiSelect';
import { downloadReportPdf, downloadReportExcel } from '../../components/reportExport';
import { formatMoney, formatDate, firstOfMonthLocalISODate, lastOfMonthLocalISODate } from '../../components/ui';

// Each product prints as its own section with the SKU and name in the heading.
const exportColumns = [
  { key: 'date', label: 'Date', date: true },
  { key: 'type', label: 'Type' },
  { key: 'ref', label: 'Ref' },
  { key: 'warehouse', label: 'Warehouse' },
  { key: 'inQty', label: 'In', align: 'right' },
  { key: 'outQty', label: 'Out', align: 'right' },
  { key: 'unitCost', label: 'Unit Cost', align: 'right', money: true },
  { key: 'balance', label: 'Balance', align: 'right' }
];

export default function ItemActivity() {
  const [rows, setRows] = useState(null);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [productIds, setProductIds] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [from, setFrom] = useState(firstOfMonthLocalISODate());
  const [to, setTo] = useState(lastOfMonthLocalISODate());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/products').then((res) => setProducts(res.data.filter((p) => p.type === 'STOCK'))).catch(() => setError('Could not load products.'));
    api.get('/warehouses').then((res) => setWarehouses(res.data)).catch(() => setError('Could not load warehouses.'));
  }, []);

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (productIds.length) params.productId = productIds.join(',');
      if (warehouseId) params.warehouseId = warehouseId;
      if (from) params.from = from;
      if (to) params.to = to;
      const { data } = await api.get('/reports/item-activity', { params });
      setRows(data);
    } catch {
      setError('Could not load item activity.');
    } finally {
      setLoading(false);
    }
  };

  const qty = (n) => (n ? Number(n).toLocaleString() : '');

  const warehouseName = warehouses.find((w) => w._id === warehouseId)?.name;
  const subtitle = `${warehouseName || 'All warehouses'} — ${from ? formatDate(from) : 'inception'} to ${to ? formatDate(to) : 'today'}`;

  const exportSections = () => (rows || []).map((r) => ({
    title: `${r.product.sku} - ${r.product.name}`,
    subtitle: `Opening ${r.openingQty}  ·  In ${r.totalIn}  ·  Out ${r.totalOut}  ·  Closing ${r.closingQty}`,
    rows: [
      { _bold: true, type: 'Opening balance', balance: r.openingQty },
      ...r.entries.map((e) => ({ ...e, inQty: e.inQty || '', outQty: e.outQty || '' }))
    ],
    totals: ['Total', '', '', '', String(r.totalIn), String(r.totalOut), '', String(r.closingQty)]
  }));
  const exportPdf = () => downloadReportPdf({ title: 'Item Activity', subtitle, columns: exportColumns, sections: exportSections() });
  const exportExcel = () => downloadReportExcel({ title: 'Item Activity', subtitle, columns: exportColumns, sections: exportSections() });

  return (
    <PageLayout title="Item Activity" actions={rows && rows.length > 0 && <ReportExportButtons onPdf={exportPdf} onExcel={exportExcel} />}>
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Product</span>
          <MultiSelect
            options={products.map((p) => ({ value: p._id, label: `${p.sku} - ${p.name}` }))}
            selected={productIds}
            onChange={setProductIds}
            placeholder="All products"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Warehouse</span>
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="input">
            <option value="">All warehouses</option>
            {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
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
          <button type="button" onClick={() => { setProductIds([]); setWarehouseId(''); setFrom(''); setTo(''); setRows(null); }} className="btn-ghost">Clear</button>
        </div>
      </div>

      {!rows && !loading && (
        <div className="text-center py-12 text-slate-400">Select filters and click "Run Report" to view item activity.</div>
      )}

      {rows && rows.length > 0 && (
        <div className="space-y-6">
          {rows.map((r) => (
            <div key={r.product._id} className="bg-white rounded-xl border border-slate-200 shadow-card overflow-x-auto">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-900">{r.product.name}</h3>
                  <p className="text-xs text-slate-500">{r.product.sku}{r.product.unit ? ` · ${r.product.unit}` : ''}</p>
                </div>
                <div className="flex gap-6 text-right text-sm">
                  <div><p className="text-slate-500 text-xs">Opening</p><p className="font-figures">{r.openingQty.toLocaleString()}</p></div>
                  <div><p className="text-slate-500 text-xs">In</p><p className="font-figures text-ledger-teal">{r.totalIn.toLocaleString()}</p></div>
                  <div><p className="text-slate-500 text-xs">Out</p><p className="font-figures text-ledger-rose">{r.totalOut.toLocaleString()}</p></div>
                  <div><p className="text-slate-500 text-xs">Closing</p><p className="font-figures font-semibold">{r.closingQty.toLocaleString()}</p></div>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Ref</th>
                    <th className="px-4 py-3">Warehouse</th>
                    <th className="px-4 py-3 text-right">In</th>
                    <th className="px-4 py-3 text-right">Out</th>
                    <th className="px-4 py-3 text-right">Unit Cost</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <td className="px-4 py-2">—</td>
                    <td className="px-4 py-2 font-medium" colSpan={6}>Opening balance</td>
                    <td className="px-4 py-2 text-right font-figures font-semibold">{r.openingQty.toLocaleString()}</td>
                  </tr>
                  {r.entries.map((e, i) => (
                    <tr key={i} className="border-b border-slate-100" title={e.note}>
                      <td className="px-4 py-2">{new Date(e.date).toLocaleDateString()}</td>
                      <td className="px-4 py-2">{e.type}</td>
                      <td className="px-4 py-2">{e.ref}</td>
                      <td className="px-4 py-2">{e.warehouse}</td>
                      <td className="px-4 py-2 text-right font-figures text-ledger-teal">{qty(e.inQty)}</td>
                      <td className="px-4 py-2 text-right font-figures text-ledger-rose">{qty(e.outQty)}</td>
                      <td className="px-4 py-2 text-right font-figures">{formatMoney(e.unitCost)}</td>
                      <td className="px-4 py-2 text-right font-figures font-semibold">{e.balance.toLocaleString()}</td>
                    </tr>
                  ))}
                  {r.entries.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">No movements in this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {rows && rows.length === 0 && (
        <div className="text-center py-12 text-slate-400">No stock activity found for these filters.</div>
      )}
    </PageLayout>
  );
}
