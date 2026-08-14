import { useEffect, useState } from 'react';
import { Plus, AlertTriangle, Pencil } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { formatMoney } from '../components/ui';

const empty = { sku: '', name: '', category: '', unit: 'pcs', type: 'STOCK', costPrice: 0, salePrice: 0, taxRate: 0, reorderLevel: 0, openingStock: 0 };

export default function Products() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('inventory.manage');
  const [products, setProducts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [detail, setDetail] = useState(null);
  const [movements, setMovements] = useState([]);

  const load = () => api.get('/products').then((res) => setProducts(res.data)).catch(() => setLoadError('Could not load products.'));
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(empty); setError(''); setModalOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm({ ...p, openingStock: Number(p.totalStock || 0) }); setError(''); setModalOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      if (editing) {
        await api.put(`/products/${editing._id}`, form);
      } else {
        await api.post('/products', form);
      }
      setModalOpen(false);
      setForm(empty);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save product.');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (p) => {
    setDetail(p);
    const { data } = await api.get(`/products/${p._id}/movements`);
    setMovements(data);
  };

  const money = formatMoney;

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
    },
    { key: 'actions', label: '', align: 'right', render: (r) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); openEdit(r); }}
          className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-500 hover:text-ink-900 hover:border-slate-300"
          title="Edit product"
        >
          <Pencil size={16} />
        </button>
      ) } 
  ];

  return (
    <PageLayout
      title="Products"
      actions={canManage && (
        <button onClick={openCreate} className="flex items-center gap-1.5 btn-primary">
          <Plus size={15} /> New Product
        </button>
      )}
    >
      {loadError && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{loadError}</div>}
      <DataTable columns={columns} data={products} onRowClick={openDetail} />

      <Modal open={modalOpen} onClose={() => !submitting && setModalOpen(false)} title={editing ? 'Edit Product' : 'New Product'}>
        <form onSubmit={save} className="flex flex-col gap-3">
          {error && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">SKU</span>
              <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="input" />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Name</span>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
            </label>
          </div>
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
              <input type="number" min="0" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })} className="input font-figures" />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Sale Price</span>
              <input type="number" min="0" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: Number(e.target.value) })} className="input font-figures" />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Tax %</span>
              <input type="number" min="0" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) })} className="input font-figures" />
            </label>
          </div>
          {form.type === 'STOCK' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-medium text-slate-600 mb-1">Reorder Level</span>
                <input type="number" min="0" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) })} className="input font-figures" />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-600 mb-1">Opening Stock</span>
                <input type="number" min="0" value={form.openingStock} onChange={(e) => setForm({ ...form, openingStock: Number(e.target.value) })} className="input font-figures" />
              </label>
            </div>
          )}
          <button type="submit" disabled={submitting} className="mt-2 btn-teal disabled:opacity-60">{submitting ? 'Saving…' : editing ? 'Save changes' : 'Create product'}</button>
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
