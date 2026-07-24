import { useEffect, useState } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

const empty = { name: '', category: '', unit: 'pcs', type: 'STOCK', costPrice: 0, salePrice: 0, taxRate: 0, reorderLevel: 0, openingStock: 0 };

export default function Products() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('inventory.manage');
  const [products, setProducts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [movements, setMovements] = useState([]);

  const load = () => api.get('/products').then((res) => setProducts(res.data));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/products', form);
      setModalOpen(false);
      setForm(empty);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save product.');
    }
  };

  const openDetail = async (p) => {
    setDetail(p);
    const { data } = await api.get(`/products/${p._id}/movements`);
    setMovements(data);
  };

  const money = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

  const columns = [
    { key: 'sku', label: 'SKU' },
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type' },
    { key: 'unit', label: 'Unit' },
    { key: 'salePrice', label: 'Sale Price', align: 'right', mono: true, render: (r) => money(r.salePrice) },
    {
      key: 'totalStock', label: 'Stock', align: 'right', mono: true,
      render: (r) => (
        <span className={r.type === 'STOCK' && r.totalStock <= r.reorderLevel ? 'text-ledger-rose flex items-center justify-end gap-1' : ''}>
          {r.type === 'STOCK' && r.totalStock <= r.reorderLevel && <AlertTriangle size={12} />}
          {r.type === 'STOCK' ? r.totalStock : '—'}
        </span>
      )
    }
  ];

  return (
    <PageLayout
      title="Products"
      actions={canManage && (
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-1.5 btn-primary">
          <Plus size={15} /> New Product
        </button>
      )}
    >
      <DataTable columns={columns} data={products} onRowClick={openDetail} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Product">
        <form onSubmit={save} className="flex flex-col gap-3">
          {error && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Name</span>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Category</span>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input" />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Unit</span>
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input" />
            </label>
          </div>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Type</span>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input">
              <option value="STOCK">Stock item</option>
              <option value="NON_STOCK">Non-stock item</option>
              <option value="SERVICE">Service</option>
            </select>
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Cost Price</span>
              <input type="number" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })} className="input font-figures" />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Sale Price</span>
              <input type="number" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: Number(e.target.value) })} className="input font-figures" />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Tax %</span>
              <input type="number" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) })} className="input font-figures" />
            </label>
          </div>
          {form.type === 'STOCK' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-medium text-slate-600 mb-1">Reorder Level</span>
                <input type="number" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) })} className="input font-figures" />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-600 mb-1">Opening Stock</span>
                <input type="number" value={form.openingStock} onChange={(e) => setForm({ ...form, openingStock: Number(e.target.value) })} className="input font-figures" />
              </label>
            </div>
          )}
          <button type="submit" className="mt-2 btn-teal">Create product</button>
        </form>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Stock movements — ${detail?.name || ''}`} width="max-w-2xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
              <th className="py-2">Date</th><th>Warehouse</th><th>Direction</th>
              <th className="text-right">Qty</th><th>Source</th><th>Note</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m._id} className="border-b border-slate-100">
                <td className="py-2">{new Date(m.date).toLocaleDateString()}</td>
                <td>{m.warehouse?.name}</td>
                <td className={m.direction === 'IN' ? 'text-ledger-teal' : 'text-ledger-rose'}>{m.direction}</td>
                <td className="text-right font-figures">{m.quantity}</td>
                <td>{m.sourceType}</td>
                <td>{m.note}</td>
              </tr>
            ))}
            {movements.length === 0 && (
              <tr><td colSpan={6} className="text-center text-slate-400 py-6">No stock movements yet.</td></tr>
            )}
          </tbody>
        </table>
      </Modal>
    </PageLayout>
  );
}
