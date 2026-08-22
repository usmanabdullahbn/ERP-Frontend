import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { todayLocalISODate } from '../components/ui';

const empty = { product: '', warehouse: '', direction: 'IN', quantity: 1, note: '' };

export default function StockAdjustments() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('inventory.manage');

  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loadError, setLoadError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [date, setDate] = useState(todayLocalISODate());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => api.get('/products/adjustments').then((res) => setMovements(res.data)).catch(() => setLoadError('Could not load stock adjustments.'));

  useEffect(() => {
    load();
    api.get('/products').then((res) => setProducts(res.data)).catch(() => setLoadError('Could not load products.'));
    api.get('/warehouses').then((res) => setWarehouses(res.data)).catch(() => setLoadError('Could not load warehouses.'));
  }, []);

  const defaultWarehouseId = warehouses.find((w) => w.isDefault)?._id || warehouses[0]?._id || '';

  const openCreate = () => {
    setForm({ ...empty, warehouse: defaultWarehouseId });
    setDate(todayLocalISODate());
    setError('');
    setModalOpen(true);
  };

  const currentStock = () => {
    const prod = products.find((p) => p._id === form.product);
    const entry = prod?.stockByWarehouse?.find((s) => (s.warehouse?._id || s.warehouse) === form.warehouse);
    return entry ? entry.quantity : 0;
  };

  const save = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    if (!form.product) return setError('Select a product.');
    if (!form.warehouse) return setError('Select a warehouse.');
    if (!form.quantity || form.quantity <= 0) return setError('Quantity must be greater than zero.');
    if (!form.note) return setError('A reason/note is required for the audit trail.');
    setSubmitting(true);
    try {
      await api.post(`/products/${form.product}/adjust`, {
        warehouse: form.warehouse, direction: form.direction, quantity: form.quantity, note: form.note, date
      });
      setModalOpen(false);
      load();
      api.get('/products').then((res) => setProducts(res.data));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not record this adjustment.');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'product', label: 'Product', render: (r) => r.product?.name },
    { key: 'warehouse', label: 'Warehouse', render: (r) => r.warehouse?.name },
    { key: 'direction', label: 'Direction', render: (r) => (
        <span className={r.direction === 'IN' ? 'text-ledger-teal font-medium' : 'text-ledger-rose font-medium'}>
          {r.direction === 'IN' ? 'Increase' : 'Decrease'}
        </span>
      ) },
    { key: 'quantity', label: 'Qty', align: 'right', mono: true },
    { key: 'note', label: 'Reason' }
  ];

  return (
    <PageLayout
      title="Stock Adjustments"
      actions={canManage && (
        <button onClick={openCreate} className="flex items-center gap-1.5 btn-primary">
          <Plus size={15} /> New Adjustment
        </button>
      )}
    >
      {loadError && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{loadError}</div>}
      <DataTable columns={columns} data={movements} emptyMessage="No stock adjustments recorded yet." />

      <Modal open={modalOpen} onClose={() => !submitting && setModalOpen(false)} title="New Stock Adjustment">
        <form onSubmit={save} className="flex flex-col gap-3">
          {error && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Product</span>
            <select value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} className="input">
              <option value="">Select…</option>
              {products.filter((p) => p.type === 'STOCK').map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Warehouse</span>
            <select value={form.warehouse} onChange={(e) => setForm({ ...form, warehouse: e.target.value })} className="input">
              <option value="">Select…</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </label>
          {form.product && form.warehouse && (
            <p className="text-xs text-slate-500 -mt-1">Current stock in this warehouse: <span className="font-figures">{currentStock()}</span></p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Direction</span>
              <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })} className="input">
                <option value="IN">Increase stock</option>
                <option value="OUT">Decrease stock</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Quantity</span>
              <input type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} className="input font-figures" />
            </label>
          </div>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Reason / note</span>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="input" placeholder="e.g. Damaged in warehouse, stock count correction" />
          </label>
          <button type="submit" disabled={submitting} className="mt-2 btn-teal disabled:opacity-60">{submitting ? 'Saving…' : 'Record adjustment'}</button>
        </form>
      </Modal>
    </PageLayout>
  );
}
