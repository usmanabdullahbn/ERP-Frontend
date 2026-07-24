import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import { useAuth } from '../context/AuthContext';

const emptyLine = { product: '', warehouse: '', quantity: 1, unitCost: 0, taxRate: 0 };

export default function Bills() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('purchases.manage');

  const [bills, setBills] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [lines, setLines] = useState([{ ...emptyLine }]);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);

  const load = () => api.get('/bills').then((res) => setBills(res.data));

  useEffect(() => {
    load();
    api.get('/suppliers').then((res) => setSuppliers(res.data));
    api.get('/products').then((res) => setProducts(res.data));
    api.get('/warehouses').then((res) => setWarehouses(res.data));
  }, []);

  const updateLine = (i, patch) => {
    const next = [...lines];
    next[i] = { ...next[i], ...patch };
    if (patch.product) {
      const prod = products.find((p) => p._id === patch.product);
      if (prod) { next[i].unitCost = prod.costPrice; next[i].taxRate = prod.taxRate; }
    }
    setLines(next);
  };

  const addLine = () => setLines([...lines, { ...emptyLine }]);
  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));

  const totals = lines.reduce(
    (acc, l) => {
      const base = (l.quantity || 0) * (l.unitCost || 0);
      const tax = (base * (l.taxRate || 0)) / 100;
      acc.subTotal += base;
      acc.taxTotal += tax;
      return acc;
    },
    { subTotal: 0, taxTotal: 0 }
  );

  const openCreate = () => {
    setSupplier(''); setDate(new Date().toISOString().slice(0, 10)); setDueDate('');
    setLines([{ ...emptyLine }]); setError(''); setModalOpen(true);
  };

  const save = async (postNow) => {
    setError('');
    if (!supplier) return setError('Select a supplier.');
    const validLines = lines.filter((l) => l.product && l.warehouse && l.quantity > 0);
    if (!validLines.length) return setError('Add at least one valid line item.');
    try {
      await api.post('/bills', { supplier, date, dueDate: dueDate || undefined, items: validLines, postNow });
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save bill.');
    }
  };

  const openDetail = async (b) => {
    const { data } = await api.get(`/bills/${b._id}`);
    setDetail(data);
  };

  const postBill = async (id) => {
    await api.post(`/bills/${id}/post`);
    const { data } = await api.get(`/bills/${id}`);
    setDetail(data);
    load();
  };

  const voidBill = async (id) => {
    if (!confirm('Void this bill? This creates a reversing entry.')) return;
    await api.post(`/bills/${id}/void`);
    const { data } = await api.get(`/bills/${id}`);
    setDetail(data);
    load();
  };

  const money = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

  const columns = [
    { key: 'billNumber', label: 'Bill #' },
    { key: 'supplier', label: 'Supplier', render: (r) => r.supplier?.name },
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'grandTotal', label: 'Total', align: 'right', mono: true, render: (r) => money(r.grandTotal) },
    { key: 'balanceDue', label: 'Balance Due', align: 'right', mono: true, render: (r) => money(r.grandTotal - r.amountPaid) },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> }
  ];

  return (
    <PageLayout
      title="Purchase Bills"
      actions={canManage && (
        <button onClick={openCreate} className="flex items-center gap-1.5 btn-primary">
          <Plus size={15} /> New Bill
        </button>
      )}
    >
      <DataTable columns={columns} data={bills} onRowClick={openDetail} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Bill" width="max-w-3xl">
        <div className="flex flex-col gap-4">
          {error && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Supplier</span>
              <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className="input">
                <option value="">Select…</option>
                {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Due Date</span>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-600">Line items</span>
              <button onClick={addLine} type="button" className="text-xs text-ledger-teal hover:underline">+ Add line</button>
            </div>
            <div className="flex flex-col gap-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <select value={line.product} onChange={(e) => updateLine(i, { product: e.target.value })} className="input col-span-4">
                    <option value="">Product…</option>
                    {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                  <select value={line.warehouse} onChange={(e) => updateLine(i, { warehouse: e.target.value })} className="input col-span-3">
                    <option value="">Warehouse…</option>
                    {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
                  </select>
                  <input type="number" placeholder="Qty" value={line.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} className="input font-figures col-span-2" />
                  <input type="number" placeholder="Cost" value={line.unitCost} onChange={(e) => updateLine(i, { unitCost: Number(e.target.value) })} className="input font-figures col-span-2" />
                  <button type="button" onClick={() => removeLine(i)} className="text-slate-400 hover:text-ledger-rose col-span-1 flex justify-center">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end text-sm gap-6 pt-2 border-t border-slate-200">
            <span className="text-slate-500">Subtotal <span className="font-figures text-ink-800 ml-2">{money(totals.subTotal)}</span></span>
            <span className="text-slate-500">Tax <span className="font-figures text-ink-800 ml-2">{money(totals.taxTotal)}</span></span>
            <span className="font-medium">Total <span className="font-figures ml-2">{money(totals.subTotal + totals.taxTotal)}</span></span>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => save(false)} className="btn-ghost">Save as draft</button>
            <button onClick={() => save(true)} className="btn-teal">Save &amp; post</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Bill ${detail?.billNumber || ''}`} width="max-w-2xl">
        {detail && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between text-sm">
              <div>
                <p className="text-slate-500">Supplier</p>
                <p className="font-medium">{detail.supplier?.name}</p>
              </div>
              <Badge status={detail.status} />
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                  <th className="py-2">Item</th><th>Warehouse</th><th className="text-right">Qty</th>
                  <th className="text-right">Cost</th><th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((it, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2">{it.product?.name}</td>
                    <td>{it.warehouse?.name}</td>
                    <td className="text-right font-figures">{it.quantity}</td>
                    <td className="text-right font-figures">{money(it.unitCost)}</td>
                    <td className="text-right font-figures">{money(it.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end text-sm gap-6">
              <span>Subtotal <span className="font-figures ml-2">{money(detail.subTotal)}</span></span>
              <span>Tax <span className="font-figures ml-2">{money(detail.taxTotal)}</span></span>
              <span className="font-medium">Total <span className="font-figures ml-2">{money(detail.grandTotal)}</span></span>
            </div>
            {canManage && (
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                {detail.status === 'DRAFT' && <button onClick={() => postBill(detail._id)} className="btn-teal">Post to ledger</button>}
                {detail.status !== 'VOID' && detail.status !== 'DRAFT' && <button onClick={() => voidBill(detail._id)} className="btn-ghost text-ledger-rose">Void</button>}
              </div>
            )}
          </div>
        )}
      </Modal>
    </PageLayout>
  );
}
