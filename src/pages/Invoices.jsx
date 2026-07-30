import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, Printer } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Badge from '../components/Badge';
import { useAuth } from '../context/AuthContext';

const emptyLine = { product: '', warehouse: '', quantity: 1, unitPrice: 0, taxRate: 0 };

export default function Invoices() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('sales.manage');

  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [customer, setCustomer] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [lines, setLines] = useState([{ ...emptyLine }]);
  const [error, setError] = useState('');
  const [editingInvoice, setEditingInvoice] = useState(null);

  const [detail, setDetail] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');

  const load = () => api.get('/invoices').then((res) => setInvoices(res.data));

  useEffect(() => {
    load();
    api.get('/customers').then((res) => setCustomers(res.data));
    api.get('/products').then((res) => setProducts(res.data));
    api.get('/warehouses').then((res) => setWarehouses(res.data));
  }, []);

  const updateLine = (i, patch) => {
    const next = [...lines];
    next[i] = { ...next[i], ...patch };
    if (patch.product) {
      const prod = products.find((p) => p._id === patch.product);
      if (prod) { next[i].unitPrice = prod.salePrice; next[i].taxRate = prod.taxRate; }
    }
    setLines(next);
  };

  const addLine = () => setLines([...lines, { ...emptyLine }]);
  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));

  const totals = lines.reduce(
    (acc, l) => {
      const base = (l.quantity || 0) * (l.unitPrice || 0);
      const tax = (base * (l.taxRate || 0)) / 100;
      acc.subTotal += base;
      acc.taxTotal += tax;
      return acc;
    },
    { subTotal: 0, taxTotal: 0 }
  );

  const openCreate = () => {
    setEditingInvoice(null);
    setCustomer(''); setDate(new Date().toISOString().slice(0, 10)); setDueDate('');
    setLines([{ ...emptyLine }]); setError(''); setModalOpen(true);
  };

  const save = async (postNow) => {
    setError('');
    if (!customer) return setError('Select a customer.');
    const validLines = lines.filter((l) => l.product && l.warehouse && l.quantity > 0);
    if (!validLines.length) return setError('Add at least one valid line item.');
    try {
      const payload = { customer, date, dueDate: dueDate || undefined, items: validLines, notes: editingInvoice?.notes || '', postNow };
      if (editingInvoice) {
        await api.put(`/invoices/${editingInvoice._id}`, payload);
      } else {
        await api.post('/invoices', payload);
      }
      setEditingInvoice(null);
      setModalOpen(false);
      setDetail(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save invoice.');
    }
  };

  const openDetail = async (inv) => {
    const { data } = await api.get(`/invoices/${inv._id}`);
    setDetail(data);
  };

  const openEdit = async (inv) => {
    const { data } = await api.get(`/invoices/${inv._id}`);
    setEditingInvoice(data);
    setCustomer(data.customer?._id || '');
    setDate(data.date ? new Date(data.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    setDueDate(data.dueDate ? new Date(data.dueDate).toISOString().slice(0, 10) : '');
    setLines(data.items.map((item) => ({
      product: item.product?._id || item.product,
      warehouse: item.warehouse?._id || item.warehouse,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate
    })));
    setError('');
    setModalOpen(true);
  };

  const handleDeleteClick = (id) => {
    setConfirmMessage('Delete this invoice? Only draft invoices can be deleted.');
    setConfirmAction(() => () => performDelete(id));
    setConfirmOpen(true);
  };

  const performDelete = async (id) => {
    try {
      await api.delete(`/invoices/${id}`);
      if (detail?._id === id) setDetail(null);
      load();
      setConfirmOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete invoice.');
    }
  };

  const handleVoidClick = (id) => {
    setConfirmMessage('Void this invoice? This creates a reversing entry.');
    setConfirmAction(() => () => performVoid(id));
    setConfirmOpen(true);
  };

  const performVoid = async (id) => {
    try {
      await api.post(`/invoices/${id}/void`);
      const { data } = await api.get(`/invoices/${id}`);
      setDetail(data);
      load();
      setConfirmOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not void invoice.');
    }
  };

  const money = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

  const columns = [
    { key: 'invoiceNumber', label: 'Invoice #' },
    { key: 'customer', label: 'Customer', render: (r) => r.customer?.name },
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'grandTotal', label: 'Total', align: 'right', mono: true, render: (r) => money(r.grandTotal) },
    { key: 'balanceDue', label: 'Balance Due', align: 'right', mono: true, render: (r) => money(r.grandTotal - r.amountPaid) },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
    { key: 'actions', label: '', align: 'right', render: (r) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openEdit(r); }}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-500 hover:text-ink-900 hover:border-slate-300"
            title="Edit invoice"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDeleteClick(r._id); }}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-500 hover:text-rose-600 hover:border-slate-300"
            title="Delete invoice"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ];

  return (
    <PageLayout
      title="Sales Invoices"
      actions={canManage && (
        <button onClick={openCreate} className="flex items-center gap-1.5 btn-primary">
          <Plus size={15} /> New Invoice
        </button>
      )}
    >
      <DataTable columns={columns} data={invoices} onRowClick={openDetail} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingInvoice ? 'Edit Invoice' : 'New Invoice'} width="max-w-3xl">
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
                  <input type="number" placeholder="Price" value={line.unitPrice} onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value) })} className="input font-figures col-span-2" />
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

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Invoice ${detail?.invoiceNumber || ''}`} width="max-w-2xl">
        {detail && (
          <div className="invoice-document flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
              <div>
                <p className="text-slate-500">Customer</p>
                <p className="font-medium">{detail.customer?.name}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={printInvoice}
                  className="btn-ghost inline-flex items-center gap-2"
                >
                  <Printer size={16} /> Print
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(detail)}
                  className="btn-ghost inline-flex items-center gap-2"
                >
                  <Pencil size={16} /> Edit
                </button>
                {detail.status === 'DRAFT' && (
                  <button
                    type="button"
                    onClick={() => deleteInvoice(detail._id)}
                    className="btn-ghost inline-flex items-center gap-2 text-rose-600 border-rose-200 hover:bg-rose-50"
                  >
                    <Trash2 size={16} /> Delete
                  </button>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              <h1 className="text-xl font-semibold">Sales Invoice</h1>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Invoice Number</p>
                  <p className="font-medium">{detail.invoiceNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 text-xs">Date</p>
                  <p className="font-medium">{new Date(detail.date).toLocaleDateString()}</p>
                </div>
              </div>
              
              <div className="border-t border-slate-200 pt-3">
                <p className="text-slate-500 text-xs">Customer</p>
                <p className="font-medium">{detail.customer?.name}</p>
              </div>
            </div>

            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-600 border-b-2 border-slate-300">
                  <th className="py-2 font-semibold">Item</th>
                  <th className="font-semibold">Warehouse</th>
                  <th className="text-right font-semibold">Qty</th>
                  <th className="text-right font-semibold">Price</th>
                  <th className="text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((it, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2">{it.product?.name}</td>
                    <td>{it.warehouse?.name}</td>
                    <td className="text-right font-figures">{it.quantity}</td>
                    <td className="text-right font-figures">{money(it.unitPrice)}</td>
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
                  {detail.status === 'DRAFT' && <button onClick={() => postInvoice(detail._id)} className="btn-teal">Post to ledger</button>}
                  {detail.status !== 'VOID' && detail.status !== 'DRAFT' && <button onClick={() => voidInvoice(detail._id)} className="btn-ghost text-ledger-rose">Void</button>}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </PageLayout>
  );
}
