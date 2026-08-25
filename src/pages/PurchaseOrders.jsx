import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, ArrowRight, Printer } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Badge from '../components/Badge';
import { useAuth } from '../context/AuthContext';
import { formatMoney, todayLocalISODate } from '../components/ui';

let lineKeySeq = 0;
const newLine = (defaultWarehouse = '') => ({ _key: ++lineKeySeq, product: '', warehouse: defaultWarehouse, quantity: 1, unitCost: 0, taxRate: 0, discountRate: 0 });

export default function PurchaseOrders() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('purchases.manage');

  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loadError, setLoadError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [date, setDate] = useState(todayLocalISODate());
  const [dueDate, setDueDate] = useState('');
  const [lines, setLines] = useState([newLine()]);
  const [error, setError] = useState('');
  const [editingPO, setEditingPO] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');

  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState('');

  const load = () => api.get('/purchase-orders').then((res) => setPurchaseOrders(res.data)).catch(() => setLoadError('Could not load purchase orders.'));

  useEffect(() => {
    load();
    api.get('/suppliers').then((res) => setSuppliers(res.data)).catch(() => setLoadError('Could not load suppliers.'));
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
      if (prod) { next[i].unitCost = prod.costPrice; next[i].taxRate = prod.taxRate; }
    }
    setLines(next);
  };

  const addLine = () => setLines([...lines, newLine(defaultWarehouseId)]);
  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));

  const validLines = lines.filter((l) => l.product && l.warehouse && l.quantity > 0 && l.unitCost >= 0);
  const totals = validLines.reduce((acc, l) => {
    const base = (l.quantity || 0) * (l.unitCost || 0);
    const discount = base * ((l.discountRate || 0) / 100);
    const taxable = base - discount;
    const tax = (taxable * (l.taxRate || 0)) / 100;
    acc.subTotal += taxable;
    acc.taxTotal += tax;
    return acc;
  }, { subTotal: 0, taxTotal: 0 });

  const openCreate = () => {
    setEditingPO(null);
    setSupplier('');
    setDate(todayLocalISODate());
    setDueDate('');
    setLines([newLine(defaultWarehouseId)]);
    setError('');
    setModalOpen(true);
  };

  const save = async () => {
    if (submitting) return;
    setError('');
    if (!supplier) return setError('Select a supplier.');
    if (!validLines.length) return setError('Add at least one valid line item.');
    setSubmitting(true);
    try {
      const payload = {
        supplier,
        date,
        dueDate: dueDate || undefined,
        items: validLines.map(({ _key, ...rest }) => rest),
        notes: editingPO?.notes || ''
      };
      if (editingPO) await api.put(`/purchase-orders/${editingPO._id}`, payload);
      else await api.post('/purchase-orders', payload);
      setModalOpen(false);
      setDetail(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save purchase order.');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (po) => {
    setDetailError('');
    const { data } = await api.get(`/purchase-orders/${po._id}`);
    setDetail(data);
  };

  const openEdit = async (po) => {
    const { data } = await api.get(`/purchase-orders/${po._id}`);
    setEditingPO(data);
    setSupplier(data.supplier?._id || '');
    setDate(data.date ? new Date(data.date).toISOString().slice(0, 10) : todayLocalISODate());
    setDueDate(data.dueDate ? new Date(data.dueDate).toISOString().slice(0, 10) : '');
    setLines(data.items.map((item) => ({
      _key: ++lineKeySeq,
      product: item.product?._id || item.product,
      warehouse: item.warehouse?._id || item.warehouse || defaultWarehouseId,
      quantity: item.quantity,
      unitCost: item.unitCost,
      taxRate: item.taxRate,
      discountRate: item.discountRate || 0
    })));
    setError('');
    setModalOpen(true);
  };

  const handleDeleteClick = (id) => {
    setConfirmMessage('Delete this purchase order? This cannot be undone.');
    setConfirmAction(() => () => performDelete(id));
    setConfirmOpen(true);
  };

  const performDelete = async (id) => {
    try {
      await api.delete(`/purchase-orders/${id}`);
      if (detail?._id === id) setDetail(null);
      load();
      setConfirmOpen(false);
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Could not delete purchase order.');
      setConfirmOpen(false);
    }
  };

  const handleConvertToBill = async (id) => {
    try {
      await api.post(`/purchase-orders/${id}/to-bill`);
      setDetail(null);
      load();
    } catch (err) {
      const message = err.response?.data?.message || 'Could not convert purchase order to bill.';
      setLoadError(message);
      setDetailError(message);
    }
  };

  const money = formatMoney;

  const columns = [
    { key: 'poNumber', label: 'PO #' },
    { key: 'supplier', label: 'Supplier', render: (r) => r.supplier?.name },
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'grandTotal', label: 'Total', align: 'right', mono: true, render: (r) => money(r.grandTotal) },
    { key: 'balanceDue', label: 'Balance', align: 'right', mono: true, render: (r) => money(r.balanceDue) },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
    {
      key: 'actions', label: '', align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          {r.status !== 'BILLED' && r.status !== 'CANCELLED' && (
            <button type="button" onClick={() => openEdit(r)} className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-500 hover:text-ink-900 hover:border-slate-300" title="Edit purchase order">
              <Pencil size={16} />
            </button>
          )}
          {canManage && r.status !== 'BILLED' && r.status !== 'CANCELLED' && (
            <button type="button" onClick={() => handleDeleteClick(r._id)} className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-500 hover:text-rose-600 hover:border-rose-200" title="Delete purchase order">
              <Trash2 size={16} />
            </button>
          )}
          {canManage && r.status !== 'BILLED' && r.status !== 'CANCELLED' && (
            <button type="button" onClick={() => handleConvertToBill(r._id)} className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100" title="Create bill from purchase order">
              <ArrowRight size={14} /> Convert to bill
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <PageLayout title="Purchase Orders" actions={canManage && (
      <button onClick={openCreate} className="flex items-center gap-1.5 btn-primary"><Plus size={15} /> New Purchase Order</button>
    )}>
      {loadError && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{loadError}</div>}
      <DataTable columns={columns} data={purchaseOrders} onRowClick={openDetail} />

      <ConfirmModal
        open={confirmOpen}
        title="Delete Purchase Order"
        message={confirmMessage}
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (confirmAction) confirmAction();
        }}
      />

      <Modal open={modalOpen} onClose={() => !submitting && setModalOpen(false)} title={editingPO ? 'Edit Purchase Order' : 'New Purchase Order'} width="max-w-3xl">
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
                  <span className="block text-xs font-medium text-slate-600 mb-1">Unit cost</span>
                  <input type="number" min="0" step="0.01" value={line.unitCost} onChange={(e) => updateLine(idx, { unitCost: Number(e.target.value) })} className="input font-figures" />
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
              <span>Subtotal</span>
              <span className="font-figures">{money(totals.subTotal || 0)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-slate-200 pt-2 font-medium">
              <span>Grand total</span>
              <span className="font-figures">{money((totals.subTotal || 0) + (totals.taxTotal || 0))}</span>
            </div>
          </div>

          <button type="button" disabled={submitting} onClick={save} className="btn-teal disabled:opacity-60">
            {submitting ? 'Saving…' : editingPO ? 'Save purchase order' : 'Create purchase order'}
          </button>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Purchase Order ${detail?.poNumber || ''}`} width="max-w-2xl">
        {detail && (
          <div className="po-document flex flex-col gap-4">
            {detailError && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg print:hidden">{detailError}</div>}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
              <div>
                <p className="text-slate-500">Supplier</p>
                <p className="font-medium">{detail.supplier?.name}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => window.print()} className="btn-ghost inline-flex items-center gap-2">
                  <Printer size={16} /> Print
                </button>
                {detail.status !== 'BILLED' && detail.status !== 'CANCELLED' && (
                  <button type="button" onClick={() => openEdit(detail)} className="btn-ghost inline-flex items-center gap-2">
                    <Pencil size={16} /> Edit
                  </button>
                )}
                {canManage && detail.status !== 'BILLED' && detail.status !== 'CANCELLED' && (
                  <button type="button" onClick={() => handleDeleteClick(detail._id)} className="btn-ghost inline-flex items-center gap-2 text-rose-600 border-rose-200 hover:bg-rose-50">
                    <Trash2 size={16} /> Delete
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="text-xl font-semibold">Purchase Order</h1>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">PO Number</p>
                  <p className="font-medium">{detail.poNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 text-xs">Date</p>
                  <p className="font-medium">{new Date(detail.date).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <p className="text-slate-500 text-xs">Supplier</p>
                <p className="font-medium">{detail.supplier?.name}</p>
              </div>
            </div>

            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-600 border-b-2 border-slate-300">
                  <th className="py-2 font-semibold">Item</th>
                  <th className="font-semibold">Warehouse</th>
                  <th className="text-right font-semibold">Qty</th>
                  <th className="text-right font-semibold">Unit Cost</th>
                  <th className="text-right font-semibold">Disc %</th>
                  <th className="text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((it, i) => (
                  <tr key={it.product?._id ? `${it.product._id}-${i}` : i} className="border-b border-slate-100">
                    <td className="py-2">{it.product?.name}</td>
                    <td>{it.warehouse?.name}</td>
                    <td className="text-right font-figures">{it.quantity}</td>
                    <td className="text-right font-figures">{money(it.unitCost)}</td>
                    <td className="text-right font-figures">{it.discountRate || 0}%</td>
                    <td className="text-right font-figures">{money(it.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-slate-200 pt-3 space-y-1">
              <div className="flex justify-end gap-6 text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-figures w-24 text-right">{money(detail.subTotal)}</span>
              </div>
              <div className="flex justify-end gap-6 text-sm">
                <span className="text-slate-600">Tax</span>
                <span className="font-figures w-24 text-right">{money(detail.taxTotal)}</span>
              </div>
              <div className="flex justify-end gap-6 text-base font-semibold border-t border-slate-200 pt-2">
                <span>Total</span>
                <span className="font-figures w-24 text-right">{money(detail.grandTotal)}</span>
              </div>
            </div>

            {canManage && detail.status !== 'BILLED' && detail.status !== 'CANCELLED' && (
              <div className="print:hidden flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => handleConvertToBill(detail._id)} className="btn-teal inline-flex items-center gap-2">
                  <ArrowRight size={16} /> Convert to bill
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </PageLayout>
  );
}
