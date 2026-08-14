import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, Printer } from 'lucide-react';
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

export default function Bills() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('purchases.manage');

  const [bills, setBills] = useState([]);
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
  const [editingBill, setEditingBill] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [detailBusy, setDetailBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');

  const load = () => api.get('/bills').then((res) => setBills(res.data)).catch(() => setLoadError('Could not load bills.'));

  useEffect(() => {
    load();
    api.get('/suppliers').then((res) => setSuppliers(res.data)).catch(() => setLoadError('Could not load suppliers.'));
    api.get('/products').then((res) => setProducts(res.data)).catch(() => setLoadError('Could not load products.'));
    api.get('/warehouses').then((res) => setWarehouses(res.data)).catch(() => setLoadError('Could not load warehouses.'));
  }, []);

  const defaultWarehouseId = warehouses.find((w) => w.isDefault)?._id || warehouses[0]?._id || '';

  useEffect(() => {
    if (!warehouses.length) return;
    setLines((prev) => prev.map((line) => ({
      ...line,
      warehouse: line.warehouse || defaultWarehouseId
    })));
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
  const hasIncompleteLines = validLines.length !== lines.length;

  const totals = validLines.reduce(
    (acc, l) => {
      const base = (l.quantity || 0) * (l.unitCost || 0);
      const discount = base * ((l.discountRate || 0) / 100);
      const taxable = base - discount;
      const tax = (taxable * (l.taxRate || 0)) / 100;
      acc.subTotal += taxable;
      acc.taxTotal += tax;
      return acc;
    },
    { subTotal: 0, taxTotal: 0 }
  );

  const openCreate = () => {
    setEditingBill(null);
    setSupplier(''); setDate(todayLocalISODate()); setDueDate('');
    setLines([newLine(defaultWarehouseId)]); setError(''); setModalOpen(true);
  };

  const save = async (postNow) => {
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
        notes: editingBill?.notes || '',
        postNow
      };
      if (editingBill) {
        await api.put(`/bills/${editingBill._id}`, payload);
      } else {
        await api.post('/bills', payload);
      }
      setEditingBill(null);
      setModalOpen(false);
      setDetail(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save bill.');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (b) => {
    setDetailError('');
    const { data } = await api.get(`/bills/${b._id}`);
    setDetail(data);
  };

  const openEdit = async (b) => {
    const { data } = await api.get(`/bills/${b._id}`);
    setEditingBill(data);
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
    setConfirmMessage('Delete this draft bill? This cannot be undone.');
    setConfirmAction(() => () => performDelete(id));
    setConfirmOpen(true);
  };

  const performDelete = async (id) => {
    try {
      await api.delete(`/bills/${id}`);
      if (detail?._id === id) setDetail(null);
      load();
      setConfirmOpen(false);
    } catch (err) {
      setDetailError(err.response?.data?.message || 'Could not delete bill.');
      setConfirmOpen(false);
    }
  };

  const handleVoidClick = (id) => {
    setConfirmMessage('Void this bill? This creates a reversing entry and removes the stock it added.');
    setConfirmAction(() => () => performVoid(id));
    setConfirmOpen(true);
  };

  const performVoid = async (id) => {
    try {
      await api.post(`/bills/${id}/void`);
      const { data } = await api.get(`/bills/${id}`);
      setDetail(data);
      load();
      setConfirmOpen(false);
    } catch (err) {
      setDetailError(err.response?.data?.message || 'Could not void bill.');
      setConfirmOpen(false);
    }
  };

  const handlePost = async (id) => {
    setDetailBusy(true);
    setDetailError('');
    try {
      await api.post(`/bills/${id}/post`);
      const { data } = await api.get(`/bills/${id}`);
      setDetail(data);
      load();
    } catch (err) {
      setDetailError(err.response?.data?.message || 'Could not post bill.');
    } finally {
      setDetailBusy(false);
    }
  };

  const handlePrint = () => window.print();

  const money = formatMoney;

  const columns = [
    { key: 'billNumber', label: 'Bill #' },
    { key: 'supplier', label: 'Supplier', render: (r) => r.supplier?.name },
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'grandTotal', label: 'Total', align: 'right', mono: true, render: (r) => money(r.grandTotal) },
    { key: 'balanceDue', label: 'Balance Due', align: 'right', mono: true, render: (r) => money(r.grandTotal - r.amountPaid) },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
    { key: 'actions', label: '', align: 'right', render: (r) => (
        <div className="flex items-center justify-end gap-2">
          {r.status === 'DRAFT' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openEdit(r); }}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-500 hover:text-ink-900 hover:border-slate-300"
              title="Edit bill"
            >
              <Pencil size={16} />
            </button>
          )}
          {canManage && r.status === 'DRAFT' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleDeleteClick(r._id); }}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-500 hover:text-rose-600 hover:border-slate-300"
              title="Delete bill"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )
    }
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
      {loadError && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{loadError}</div>}
      <DataTable columns={columns} data={bills} onRowClick={openDetail} />

      <Modal open={modalOpen} onClose={() => !submitting && setModalOpen(false)} title={editingBill ? 'Edit Bill' : 'New Bill'} width="max-w-3xl">
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
              <div className="grid gap-2 text-[11px] font-medium uppercase tracking-wide text-slate-500" style={{ gridTemplateColumns: 'minmax(0,2.5fr) minmax(0,1.7fr) minmax(0,0.8fr) minmax(0,1.2fr) minmax(0,1.1fr) minmax(0,1.1fr) 32px' }}>
                <span>Product</span>
                <span>Warehouse</span>
                <span>Qty</span>
                <span>Cost</span>
                <span>Discount</span>
                <span>Total</span>
                <span className="sr-only">Delete</span>
              </div>
              {lines.map((line, i) => {
                const incomplete = !(line.product && line.warehouse && line.quantity > 0 && line.unitCost >= 0);
                const lineTotal = ((line.quantity || 0) * (line.unitCost || 0)) * (1 - ((line.discountRate || 0) / 100));
                return (
                  <div
                    key={line._key}
                    className="grid gap-2 items-end"
                    style={{ gridTemplateColumns: 'minmax(0,2.5fr) minmax(0,1.7fr) minmax(0,0.8fr) minmax(0,1.2fr) minmax(0,1.1fr) minmax(0,1.1fr) 32px' }}
                  >
                    <select value={line.product} onChange={(e) => updateLine(i, { product: e.target.value })} className="input">
                      <option value="">Product…</option>
                      {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                    <select value={line.warehouse} onChange={(e) => updateLine(i, { warehouse: e.target.value })} className={`input ${!line.warehouse && line.product ? 'border-ledger-rose' : ''}`}>
                      <option value="">Warehouse…</option>
                      {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
                    </select>
                    <input type="number" min="0" placeholder="Qty" value={line.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} className="input font-figures" />
                    <input type="number" min="0" placeholder="Cost" value={line.unitCost} onChange={(e) => updateLine(i, { unitCost: Number(e.target.value) })} className="input font-figures" />
                    <div className="relative">
                      <input type="number" min="0" max="100" step="0.01" placeholder="0" value={line.discountRate} onChange={(e) => updateLine(i, { discountRate: Number(e.target.value) })} className="input font-figures pr-7" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
                    </div>
                    <div className="input font-figures bg-slate-50 text-slate-700 flex items-center justify-end h-[42px] px-3 rounded-lg">
                      {money(lineTotal)}
                    </div>
                    <button type="button" onClick={() => removeLine(i)} className="text-slate-400 hover:text-ledger-rose flex justify-center h-[42px] items-center">
                      <Trash2 size={16} />
                    </button>
                    {incomplete && (
                      <p className="col-span-12 -mt-1 text-xs text-ledger-rose">
                        This line needs a product, warehouse, quantity above zero, and a non-negative cost — it won't be saved until then.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            {hasIncompleteLines && (
              <p className="text-xs text-ledger-rose mt-2">
                {lines.length - validLines.length} line(s) above are incomplete and are excluded from the totals below and from what gets saved.
              </p>
            )}
          </div>

          <div className="flex justify-end text-sm gap-6 pt-2 border-t border-slate-200">
            <span className="text-slate-500">Subtotal <span className="font-figures text-ink-800 ml-2">{money(totals.subTotal)}</span></span>
            <span className="text-slate-500">Tax <span className="font-figures text-ink-800 ml-2">{money(totals.taxTotal)}</span></span>
            <span className="font-medium">Total <span className="font-figures ml-2">{money(totals.subTotal + totals.taxTotal)}</span></span>
          </div>

          <div className="flex justify-end gap-2">
            <button disabled={submitting} onClick={() => save(false)} className="btn-ghost disabled:opacity-60">Save as draft</button>
            <button disabled={submitting} onClick={() => save(true)} className="btn-teal disabled:opacity-60">{submitting ? 'Saving…' : 'Save & post'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Bill ${detail?.billNumber || ''}`} width="max-w-2xl">
        {detail && (
          <div className="bill-document flex flex-col gap-4">
            {detailError && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg print:hidden">{detailError}</div>}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
              <div>
                <p className="text-slate-500">Supplier</p>
                <p className="font-medium">{detail.supplier?.name}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="btn-ghost inline-flex items-center gap-2"
                >
                  <Printer size={16} /> Print
                </button>
                {detail.status === 'DRAFT' && (
                  <button
                    type="button"
                    onClick={() => openEdit(detail)}
                    className="btn-ghost inline-flex items-center gap-2"
                  >
                    <Pencil size={16} /> Edit
                  </button>
                )}
                {canManage && detail.status === 'DRAFT' && (
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(detail._id)}
                    className="btn-ghost inline-flex items-center gap-2 text-rose-600 border-rose-200 hover:bg-rose-50"
                  >
                    <Trash2 size={16} /> Delete
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="text-xl font-semibold">Purchase Bill</h1>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Bill Number</p>
                  <p className="font-medium">{detail.billNumber}</p>
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
                  <th className="text-right font-semibold">Cost</th>
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

            <div className="print:hidden">
              {canManage && (
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                  {detail.status === 'DRAFT' && <button disabled={detailBusy} onClick={() => handlePost(detail._id)} className="btn-teal disabled:opacity-60">{detailBusy ? 'Posting…' : 'Post to ledger'}</button>}
                  {detail.status !== 'VOID' && detail.status !== 'DRAFT' && detail.status !== 'POSTING' && <button onClick={() => handleVoidClick(detail._id)} className="btn-ghost text-ledger-rose">Void</button>}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        title="Confirm Action"
        message={confirmMessage}
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        danger
        onConfirm={confirmAction}
        onCancel={() => setConfirmOpen(false)}
      />
    </PageLayout>
  );
}
