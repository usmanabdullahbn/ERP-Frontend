import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, ArrowRight } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Badge from '../components/Badge';
import { useAuth } from '../context/AuthContext';
import { formatMoney, todayLocalISODate } from '../components/ui';

let lineKeySeq = 0;
const newLine = (defaultWarehouse = '') => ({ _key: ++lineKeySeq, product: '', warehouse: defaultWarehouse, quantity: 1, unitPrice: 0, taxRate: 0, discountRate: 0 });

export default function Orders() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('sales.manage');

  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loadError, setLoadError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [customer, setCustomer] = useState('');
  const [date, setDate] = useState(todayLocalISODate());
  const [dueDate, setDueDate] = useState('');
  const [lines, setLines] = useState([newLine()]);
  const [error, setError] = useState('');
  const [editingOrder, setEditingOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');

  const load = () => api.get('/orders').then((res) => setOrders(res.data)).catch(() => setLoadError('Could not load orders.'));

  useEffect(() => {
    load();
    api.get('/customers').then((res) => setCustomers(res.data)).catch(() => setLoadError('Could not load customers.'));
    api.get('/products').then((res) => setProducts(res.data)).catch(() => setLoadError('Could not load products.'));
    api.get('/warehouses').then((res) => setWarehouses(res.data)).catch(() => setLoadError('Could not load warehouses.'));
  }, []);

  const defaultWarehouseId = warehouses.find((w) => w.isDefault)?._id || warehouses[0]?._id || '';

  useEffect(() => {
    if (!warehouses.length) return;
    setLines((prev) => prev.map((line) => ({ ...line, warehouse: line.warehouse || defaultWarehouseId })));
  }, [warehouses, defaultWarehouseId]);

  const updateLine = (i, patch) => {
    const next = [...lines];
    next[i] = { ...next[i], ...patch };
    if (patch.product) {
      const prod = products.find((p) => p._id === patch.product);
      if (prod) { next[i].unitPrice = prod.salePrice; next[i].taxRate = prod.taxRate; }
    }
    setLines(next);
  };

  const addLine = () => setLines([...lines, newLine(defaultWarehouseId)]);
  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));

  const selectedCustomerDiscount = Number(customers.find((c) => c._id === customer)?.discountRate || 0);
  const validLines = lines.filter((l) => l.product && l.warehouse && l.quantity > 0 && l.unitPrice >= 0);
  const totals = validLines.reduce((acc, l) => {
    const base = (l.quantity || 0) * (l.unitPrice || 0);
    const discount = base * ((l.discountRate || 0) / 100);
    const taxable = base - discount;
    const tax = (taxable * (l.taxRate || 0)) / 100;
    acc.subTotal += taxable;
    acc.taxTotal += tax;
    return acc;
  }, { subTotal: 0, taxTotal: 0 });

  const openCreate = () => {
    setEditingOrder(null);
    setCustomer('');
    setDate(todayLocalISODate());
    setDueDate('');
    setLines([newLine(defaultWarehouseId)]);
    setError('');
    setModalOpen(true);
  };

  const save = async () => {
    if (submitting) return;
    setError('');
    if (!customer) return setError('Select a customer.');
    if (!validLines.length) return setError('Add at least one valid line item.');
    setSubmitting(true);
    try {
      const payload = {
        customer,
        date,
        dueDate: dueDate || undefined,
        items: validLines.map(({ _key, ...rest }) => rest),
        notes: editingOrder?.notes || ''
      };
      if (editingOrder) await api.put(`/orders/${editingOrder._id}`, payload);
      else await api.post('/orders', payload);
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save order.');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = async (order) => {
    const { data } = await api.get(`/orders/${order._id}`);
    setEditingOrder(data);
    setCustomer(data.customer?._id || '');
    setDate(data.date ? new Date(data.date).toISOString().slice(0, 10) : todayLocalISODate());
    setDueDate(data.dueDate ? new Date(data.dueDate).toISOString().slice(0, 10) : '');
    setLines(data.items.map((item) => ({
      _key: ++lineKeySeq,
      product: item.product?._id || item.product,
      warehouse: item.warehouse?._id || item.warehouse || defaultWarehouseId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      discountRate: item.discountRate || 0
    })));
    setError('');
    setModalOpen(true);
  };

  const handleDeleteClick = (id) => {
    setConfirmMessage('Delete this order? This cannot be undone.');
    setConfirmAction(() => () => performDelete(id));
    setConfirmOpen(true);
  };

  const performDelete = async (id) => {
    try {
      await api.delete(`/orders/${id}`);
      load();
      setConfirmOpen(false);
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Could not delete order.');
      setConfirmOpen(false);
    }
  };

  const handleConvertToInvoice = async (id) => {
    try {
      await api.post(`/orders/${id}/to-invoice`);
      load();
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Could not convert order to invoice.');
    }
  };

  const money = formatMoney;

  const columns = [
    { key: 'orderNumber', label: 'Order #' },
    { key: 'customer', label: 'Customer', render: (r) => r.customer?.name },
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'grandTotal', label: 'Total', align: 'right', mono: true, render: (r) => money(r.grandTotal) },
    { key: 'balanceDue', label: 'Balance', align: 'right', mono: true, render: (r) => money(r.balanceDue) },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
    {
      key: 'actions', label: '', align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          {r.status !== 'INVOICED' && r.status !== 'CANCELLED' && (
            <button type="button" onClick={() => openEdit(r)} className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-500 hover:text-ink-900 hover:border-slate-300" title="Edit order">
              <Pencil size={16} />
            </button>
          )}
          {canManage && r.status !== 'INVOICED' && r.status !== 'CANCELLED' && (
            <button type="button" onClick={() => handleDeleteClick(r._id)} className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-500 hover:text-rose-600 hover:border-rose-200" title="Delete order">
              <Trash2 size={16} />
            </button>
          )}
          {canManage && r.status !== 'INVOICED' && r.status !== 'CANCELLED' && (
            <button type="button" onClick={() => handleConvertToInvoice(r._id)} className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100" title="Create invoice from order">
              <ArrowRight size={14} /> Convert to invoice
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <PageLayout title="Sales Orders" actions={canManage && (
      <button onClick={openCreate} className="flex items-center gap-1.5 btn-primary"><Plus size={15} /> New Order</button>
    )}>
      {loadError && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{loadError}</div>}
      <DataTable columns={columns} data={orders} />

      <ConfirmModal
        open={confirmOpen}
        title="Delete Order"
        message={confirmMessage}
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (confirmAction) confirmAction();
        }}
      />

      <Modal open={modalOpen} onClose={() => !submitting && setModalOpen(false)} title={editingOrder ? 'Edit Order' : 'New Order'} width="max-w-3xl">
        <div className="flex flex-col gap-4">
          {error && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Customer</span>
              <select value={customer} onChange={(e) => setCustomer(e.target.value)} className="input">
                <option value="">Select…</option>
                {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Order date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Due date</span>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" />
            </label>
          </div>

          <div className="space-y-3">
            {lines.map((line, idx) => (
              <div key={line._key} className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto] gap-2 items-end">
                <label className="block">
                  <span className="block text-xs font-medium text-slate-600 mb-1">Product</span>
                  <select value={line.product} onChange={(e) => updateLine(idx, { product: e.target.value })} className="input">
                    <option value="">Select product…</option>
                    {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-slate-600 mb-1">Warehouse</span>
                  <select value={line.warehouse} onChange={(e) => updateLine(idx, { warehouse: e.target.value })} className="input">
                    <option value="">Select…</option>
                    {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-slate-600 mb-1">Qty</span>
                  <input type="number" min="0.001" step="0.001" value={line.quantity} onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })} className="input font-figures" />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-slate-600 mb-1">Unit price</span>
                  <input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => updateLine(idx, { unitPrice: Number(e.target.value) })} className="input font-figures" />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-slate-600 mb-1">Disc %</span>
                  <input type="number" min="0" max="100" step="0.01" value={line.discountRate} onChange={(e) => updateLine(idx, { discountRate: Number(e.target.value) })} className="input font-figures" />
                </label>
                <button type="button" onClick={() => removeLine(idx)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:text-rose-600 hover:border-rose-200" title="Remove line">×</button>
              </div>
            ))}
            <button type="button" onClick={addLine} className="btn-ghost self-start">+ Add line</button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex justify-between text-sm pb-2">
              <span>Default customer discount</span>
              <span className="font-figures">{selectedCustomerDiscount}%</span>
            </div>
            <div className="flex justify-between text-sm pb-2">
              <span>Subtotal</span>
              <span className="font-figures">{money(totals.subTotal || 0)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-slate-200 pt-2 font-medium">
              <span>Grand total</span>
              <span className="font-figures">{money((totals.subTotal || 0) + (totals.taxTotal || 0))}</span>
            </div>
          </div>

          <button type="button" disabled={submitting} onClick={save} className="btn-teal disabled:opacity-60">
            {submitting ? 'Saving…' : editingOrder ? 'Save order' : 'Create order'}
          </button>
        </div>
      </Modal>
    </PageLayout>
  );
}
