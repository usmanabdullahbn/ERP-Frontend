import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Pencil, Printer, Truck, ArrowRight, ArrowLeft } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import ConfirmModal from '../components/ConfirmModal';
import Badge from '../components/Badge';
import ProductPicker from '../components/ProductPicker';
import { useAuth } from '../context/AuthContext';
import { formatMoney, todayLocalISODate, activeOrSelected, PAYMENT_TERMS, dueDateFromTerms } from '../components/ui';
import { printDocument, printGoodsNote, documentLines, documentTotals, LINE_COLUMNS, partyOf, statusLabel, docMeta } from '../components/printDocument';

let lineKeySeq = 0;
// Product, Warehouse, Qty, Price, Disc %, Disc Amt, Total, delete
const LINE_GRID = 'minmax(0,2.4fr) minmax(0,1.4fr) minmax(0,0.8fr) minmax(0,1.1fr) minmax(0,0.9fr) minmax(0,1.1fr) minmax(0,1.1fr) 32px';
const newLine = (defaultWarehouse = '') => ({ _key: ++lineKeySeq, product: '', warehouse: defaultWarehouse, quantity: 1, unitPrice: 0, taxRate: 0, discountRate: 0 });

// Orders that have become an invoice (or were cancelled) are closed to edits.
const isClosed = (o) => ['INVOICED', 'CANCELLED'].includes(o?.status);

/*
  Same layout as Invoices: /orders lists orders; /orders/:id is the order's
  own page; /orders/new and /orders/:id/edit (mode "new" / "edit") show the
  form as a full page.
*/
export default function Orders({ mode }) {
  const { hasPermission, isAdmin } = useAuth();
  const canManage = hasPermission('sales.manage');
  const { id } = useParams();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loadError, setLoadError] = useState('');

  const [customer, setCustomer] = useState('');
  const [date, setDate] = useState(todayLocalISODate());
  const [dueDate, setDueDate] = useState('');
  const [docRef, setDocRef] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [lines, setLines] = useState([newLine()]);
  const [error, setError] = useState('');
  const [editingOrder, setEditingOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [detail, setDetail] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [detailError, setDetailError] = useState('');
  const [detailBusy, setDetailBusy] = useState(false);

  const load = () => api.get('/orders').then((res) => setOrders(res.data)).catch(() => setLoadError('Could not load orders.'));

  useEffect(() => {
    load();
    api.get('/customers').then((res) => setCustomers(res.data)).catch(() => setLoadError('Could not load customers.'));
    api.get('/products').then((res) => setProducts(res.data)).catch(() => setLoadError('Could not load products.'));
    api.get('/warehouses').then((res) => setWarehouses(res.data)).catch(() => setLoadError('Could not load warehouses.'));
  }, []);

  useEffect(() => {
    setDetail(null);
    setDetailError('');
    if (id && !mode) openDetail({ _id: id }).catch(() => setDetailError('Could not load this order — it may have been deleted.'));
  }, [id, mode]);

  useEffect(() => {
    if (mode === 'new') resetForm();
    if (mode === 'edit' && id) loadForEdit({ _id: id }).catch(() => setError('Could not load this order — it may have been deleted.'));
  }, [mode, id]);

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
      if (prod) { next[i].unitPrice = prod.salePrice; next[i].taxRate = prod.taxRate; }
    }
    setLines(next);
  };

  const selectedCustomerDiscount = Number(customers.find((c) => c._id === customer)?.discountRate || 0);

  // New lines start with the selected customer's default discount.
  const addLine = () => setLines([...lines, { ...newLine(defaultWarehouseId), discountRate: selectedCustomerDiscount }]);
  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));

  // Lines still on the previous customer's default (or 0) move to the new
  // customer's default; a discount typed in by hand is left alone.
  const applyCustomerDiscount = (nextCustomerId) => {
    const nextDiscount = Number(customers.find((c) => c._id === nextCustomerId)?.discountRate || 0);
    setLines((prev) => prev.map((line) => {
      const current = Number(line.discountRate || 0);
      return current === 0 || current === selectedCustomerDiscount ? { ...line, discountRate: nextDiscount } : line;
    }));
  };

  const lineGross = (l) => (l.quantity || 0) * (l.unitPrice || 0);
  const lineDiscount = (l) => Math.round(lineGross(l) * (l.discountRate || 0)) / 100;

  // Typing a discount amount converts it to the line's discount %, which is
  // what gets saved. The raw text is kept while typing so "12." isn't lost.
  const setDiscountAmount = (i, text) => {
    const gross = lineGross(lines[i]);
    const amount = Math.min(Math.max(Number(text) || 0, 0), gross);
    // 6 decimals keeps the saved amount exact to the paisa even on large lines.
    const rate = gross > 0 ? Math.round((amount / gross) * 100 * 1e6) / 1e6 : 0;
    updateLine(i, { discountRate: rate, _discAmtText: text });
  };

  const validLines = lines.filter((l) => l.product && l.warehouse && l.quantity > 0 && l.unitPrice >= 0);
  const hasIncompleteLines = validLines.length !== lines.length;

  // Totals mirror validLines exactly — every line included here is a line
  // that will actually be submitted, so what's previewed is what gets saved.
  const totals = validLines.reduce(
    (acc, l) => {
      const base = (l.quantity || 0) * (l.unitPrice || 0);
      const discount = base * ((l.discountRate || 0) / 100);
      const taxable = base - discount;
      const tax = (taxable * (l.taxRate || 0)) / 100;
      acc.gross += base;
      acc.discount += discount;
      acc.subTotal += taxable;
      acc.taxTotal += tax;
      return acc;
    },
    { gross: 0, discount: 0, subTotal: 0, taxTotal: 0 }
  );

  const openCreate = () => navigate('/orders/new');
  const openEdit = (order) => navigate(`/orders/${order._id}/edit`);
  const formBackTo = mode === 'edit' && id ? `/orders/${id}` : '/orders';

  const resetForm = () => {
    setEditingOrder(null);
    setCustomer(''); setDate(todayLocalISODate()); setDueDate(''); setDocRef(''); setPaymentTerms('');
    setLines([newLine(defaultWarehouseId)]); setError('');
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
        docRef,
        paymentTerms,
        items: validLines.map(({ _key, _discAmtText, ...rest }) => rest),
        notes: editingOrder?.notes || ''
      };
      const { data: saved } = editingOrder
        ? await api.put(`/orders/${editingOrder._id}`, payload)
        : await api.post('/orders', payload);
      setEditingOrder(null);
      load();
      // Land on the saved order's own page.
      navigate(saved?._id ? `/orders/${saved._id}` : '/orders');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save order.');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (order) => {
    setDetailError('');
    const { data } = await api.get(`/orders/${order._id}`);
    setDetail(data);
  };

  const loadForEdit = async (order) => {
    setError('');
    const { data } = await api.get(`/orders/${order._id}`);
    setEditingOrder(data);
    setCustomer(data.customer?._id || '');
    setDate(data.date ? new Date(data.date).toISOString().slice(0, 10) : todayLocalISODate());
    setDueDate(data.dueDate ? new Date(data.dueDate).toISOString().slice(0, 10) : '');
    setDocRef(data.docRef || '');
    setPaymentTerms(data.paymentTerms || '');
    setLines(data.items.map((item) => ({
      _key: ++lineKeySeq,
      product: item.product?._id || item.product,
      warehouse: item.warehouse?._id || item.warehouse || defaultWarehouseId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      discountRate: item.discountRate || 0
    })));
  };

  const handleDeleteClick = (orderId) => {
    setConfirmMessage('Delete this order? This cannot be undone.');
    setConfirmAction(() => () => performDelete(orderId));
    setConfirmOpen(true);
  };

  const performDelete = async (orderId) => {
    try {
      await api.delete(`/orders/${orderId}`);
      setConfirmOpen(false);
      if (id) return navigate('/orders', { replace: true });
      load();
    } catch (err) {
      const message = err.response?.data?.message || 'Could not delete order.';
      if (id) setDetailError(message); else setLoadError(message);
      setConfirmOpen(false);
    }
  };

  // Creates a draft invoice from the order and opens it.
  const handleConvertToInvoice = async (orderId) => {
    setDetailBusy(true);
    setDetailError('');
    try {
      const { data: invoice } = await api.post(`/orders/${orderId}/to-invoice`);
      navigate(`/invoices/${invoice._id}`);
    } catch (err) {
      const message = err.response?.data?.message || 'Could not convert order to invoice.';
      if (id) setDetailError(message); else setLoadError(message);
    } finally {
      setDetailBusy(false);
    }
  };

  const handlePrint = () => {
    const lines = documentLines(detail.items, 'unitPrice');
    printDocument({
      title: 'Sales Order',
      number: detail.orderNumber,
      date: detail.date,
      dueDate: detail.dueDate,
      status: statusLabel(detail.status),
      party: { label: 'Customer', ...partyOf(detail.customer) },
      meta: docMeta(detail),
      columns: LINE_COLUMNS('Price'),
      rows: lines,
      totals: documentTotals(detail, lines),
      notes: detail.notes
    });
  };
  // Goods-only copy (no prices) to send with the delivery / sign on receipt.
  const handlePrintGoodsNote = () => printGoodsNote({
    title: 'Delivery Challan',
    number: detail.orderNumber,
    date: detail.date,
    party: { label: 'Deliver to', ...partyOf(detail.customer) },
    meta: docMeta(detail),
    items: detail.items,
    notes: detail.notes,
    signs: ['Delivered by', 'Received by (sign & stamp)']
  });

  const money = formatMoney;

  const columns = [
    { key: 'orderNumber', label: 'Order #' },
    { key: 'customer', label: 'Customer', render: (r) => r.customer?.name },
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'grandTotal', label: 'Total', align: 'right', mono: true, render: (r) => money(r.grandTotal) },
    { key: 'balanceDue', label: 'Not Invoiced', align: 'right', mono: true, render: (r) => money(r.balanceDue) },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
    { key: 'actions', label: '', align: 'right', render: (r) => (
        <div className="flex items-center justify-end gap-2">
          {canManage && !isClosed(r) && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openEdit(r); }}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-500 hover:text-ink-900 hover:border-slate-300"
              title="Edit order"
            >
              <Pencil size={16} />
            </button>
          )}
          {canManage && !isClosed(r) && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleDeleteClick(r._id); }}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-500 hover:text-rose-600 hover:border-slate-300"
              title="Delete order"
            >
              <Trash2 size={16} />
            </button>
          )}
          {isAdmin && !isClosed(r) && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleConvertToInvoice(r._id); }}
              className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100"
              title="Create invoice from order"
            >
              <ArrowRight size={14} /> Convert to invoice
            </button>
          )}
        </div>
      )
    }
  ];

  const viewActions = detail && (
    <>
      <button type="button" onClick={handlePrint} className="btn-ghost inline-flex items-center gap-2 print:hidden">
        <Printer size={16} /> Print
      </button>
      <button type="button" onClick={handlePrintGoodsNote} className="btn-ghost inline-flex items-center gap-2 print:hidden" title="Print without prices">
        <Truck size={16} /> Delivery Challan
      </button>
      {canManage && !isClosed(detail) && (
        <button type="button" onClick={() => openEdit(detail)} className="btn-ghost inline-flex items-center gap-2 print:hidden">
          <Pencil size={16} /> Edit
        </button>
      )}
      {canManage && !isClosed(detail) && (
        <button
          type="button"
          onClick={() => handleDeleteClick(detail._id)}
          className="btn-ghost inline-flex items-center gap-2 text-rose-600 border-rose-200 hover:bg-rose-50 print:hidden"
        >
          <Trash2 size={16} /> Delete
        </button>
      )}
    </>
  );

  const listActions = canManage && (
    <button onClick={openCreate} className="flex items-center gap-1.5 btn-primary">
      <Plus size={15} /> New Order
    </button>
  );

  return (
    <PageLayout
      title={mode === 'new' ? 'New Order' : mode === 'edit' ? `Edit Order ${editingOrder?.orderNumber || ''}` : id ? `Order ${detail?.orderNumber || ''}` : 'Sales Orders'}
      actions={mode ? null : id ? viewActions : listActions}
    >
      {!mode && !id && loadError && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{loadError}</div>}
      {!mode && !id && <DataTable columns={columns} data={orders} onRowClick={(r) => navigate(`/orders/${r._id}`)} />}

      {!mode && id && (
        <div className="print-page">
          <Link to="/orders" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink-900 mb-4 print:hidden">
            <ArrowLeft size={15} /> Back to Sales Orders
          </Link>
          {detailError && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg print:hidden">{detailError}</div>}
          {!detail && !detailError && <div className="text-sm text-slate-400 py-12 text-center">Loading…</div>}
          {detail && (
            <div className="order-document bg-white rounded-xl border border-slate-200 shadow-card p-6 flex flex-col gap-4 max-w-4xl">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <h1 className="text-xl font-semibold">Sales Order</h1>
                  <Badge status={detail.status} />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs">Order Number</p>
                    <p className="font-medium">{detail.orderNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-500 text-xs">Date</p>
                    <p className="font-medium">{new Date(detail.date).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs">Due Date</p>
                    <p className="font-medium">{detail.dueDate ? new Date(detail.dueDate).toLocaleDateString() : '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Doc #</p>
                    <p className="font-medium">{detail.docRef || '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-500 text-xs">Payment Terms</p>
                    <p className="font-medium">{detail.paymentTerms || '—'}</p>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-slate-500 text-xs">Customer</p>
                    <p className="font-medium">{detail.customer?.name}</p>
                  </div>
                  {detail.invoice && (
                    <div className="text-right">
                      <p className="text-slate-500 text-xs">Invoice</p>
                      <Link to={`/invoices/${detail.invoice._id}`} className="font-medium text-ledger-teal hover:underline">{detail.invoice.invoiceNumber}</Link>
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-xs uppercase text-slate-600 border-b-2 border-slate-300">
                      <th className="py-2 font-semibold">SKU</th>
                      <th className="font-semibold">Item</th>
                      <th className="font-semibold">Warehouse</th>
                      <th className="text-right font-semibold">Qty</th>
                      <th className="text-right font-semibold">Price</th>
                      <th className="text-right font-semibold">Disc %</th>
                      <th className="text-right font-semibold">Disc Amt</th>
                      <th className="text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((it, i) => (
                      <tr key={it.product?._id ? `${it.product._id}-${i}` : i} className="border-b border-slate-100">
                        <td className="py-2 font-figures text-slate-600 whitespace-nowrap pr-3">{it.product?.sku}</td>
                        <td>{it.product?.name}</td>
                        <td>{it.warehouse?.name}</td>
                        <td className="text-right font-figures">{it.quantity}</td>
                        <td className="text-right font-figures">{money(it.unitPrice)}</td>
                        <td className="text-right font-figures">{Math.round((it.discountRate || 0) * 100) / 100}%</td>
                        <td className="text-right font-figures">{money(lineDiscount(it))}</td>
                        <td className="text-right font-figures">{money(it.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-200 pt-3 space-y-1">
                {detail.items.some((it) => it.discountRate) && (
                  <>
                    <div className="flex justify-end gap-6 text-sm">
                      <span className="text-slate-600">Gross</span>
                      <span className="font-figures w-28 text-right">{money(detail.items.reduce((s, it) => s + lineGross(it), 0))}</span>
                    </div>
                    <div className="flex justify-end gap-6 text-sm">
                      <span className="text-slate-600">Discount</span>
                      <span className="font-figures w-28 text-right">−{money(detail.items.reduce((s, it) => s + lineDiscount(it), 0))}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-end gap-6 text-sm">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-figures w-28 text-right">{money(detail.subTotal)}</span>
                </div>
                <div className="flex justify-end gap-6 text-sm">
                  <span className="text-slate-600">Tax</span>
                  <span className="font-figures w-28 text-right">{money(detail.taxTotal)}</span>
                </div>
                <div className="flex justify-end gap-6 text-base font-semibold border-t border-slate-200 pt-2">
                  <span>Total</span>
                  <span className="font-figures w-28 text-right">{money(detail.grandTotal)}</span>
                </div>
              </div>

              {isAdmin && !isClosed(detail) && (
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 print:hidden">
                  <button disabled={detailBusy} onClick={() => handleConvertToInvoice(detail._id)} className="btn-teal inline-flex items-center gap-2 disabled:opacity-60">
                    <ArrowRight size={16} /> {detailBusy ? 'Converting…' : 'Convert to invoice'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {mode && (
        <div>
          <Link to={formBackTo} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink-900 mb-4">
            <ArrowLeft size={15} /> {mode === 'edit' ? 'Back to order' : 'Back to Sales Orders'}
          </Link>
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-6 flex flex-col gap-4">
          {error && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Customer</span>
              <select value={customer} onChange={(e) => {
                const nextCustomer = e.target.value;
                setCustomer(nextCustomer);
                if (nextCustomer) applyCustomerDiscount(nextCustomer);
              }} className="input">
                <option value="">Select…</option>
                {activeOrSelected(customers, customer).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Order Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Due Date</span>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Doc #</span>
              <input value={docRef} onChange={(e) => setDocRef(e.target.value)} placeholder="Reference no." className="input" />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Payment Terms</span>
              <input
                list="payment-terms"
                value={paymentTerms}
                onChange={(e) => {
                  setPaymentTerms(e.target.value);
                  // "Net 30", "Cash"… also set the due date from the document date.
                  const due = dueDateFromTerms(date, e.target.value);
                  if (due) setDueDate(due);
                }}
                placeholder="e.g. Net 30"
                className="input"
              />
              <datalist id="payment-terms">{PAYMENT_TERMS.map((t) => <option key={t} value={t} />)}</datalist>
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-600">Line items</span>
              <button onClick={addLine} type="button" className="text-xs text-ledger-teal hover:underline">+ Add line</button>
            </div>
            <div className="flex flex-col gap-2">
              <div className="grid gap-2 text-[11px] font-medium uppercase tracking-wide text-slate-500" style={{ gridTemplateColumns: LINE_GRID }}>
                <span>Product</span>
                <span>Warehouse</span>
                <span>Qty</span>
                <span>Price</span>
                <span>Disc %</span>
                <span>Disc Amt</span>
                <span>Total</span>
                <span className="sr-only">Delete</span>
              </div>
              {lines.map((line, i) => {
                const incomplete = !(line.product && line.warehouse && line.quantity > 0 && line.unitPrice >= 0);
                const lineTotal = ((line.quantity || 0) * (line.unitPrice || 0)) * (1 - ((line.discountRate || 0) / 100));
                return (
                  <div
                    key={line._key}
                    className="grid gap-2 items-end"
                    style={{ gridTemplateColumns: LINE_GRID }}
                  >
                    <ProductPicker products={products} value={line.product} onChange={(product) => updateLine(i, { product })} />
                    <select value={line.warehouse} onChange={(e) => updateLine(i, { warehouse: e.target.value })} className={`input ${!line.warehouse && line.product ? 'border-ledger-rose' : ''}`}>
                      <option value="">Warehouse…</option>
                      {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
                    </select>
                    <input type="number" min="0" placeholder="Qty" value={line.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} className="input font-figures" />
                    <input type="number" min="0" placeholder="Price" value={line.unitPrice} onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value) })} className="input font-figures" />
                    <div className="relative">
                      <input type="number" min="0" max="100" step="0.01" placeholder="0" value={line.discountRate} onChange={(e) => updateLine(i, { discountRate: Number(e.target.value) })} className="input font-figures pr-7" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      title="Discount amount — converted to the line's discount %"
                      value={line._discAmtText ?? lineDiscount(line)}
                      onChange={(e) => setDiscountAmount(i, e.target.value)}
                      onBlur={() => updateLine(i, { _discAmtText: undefined })}
                      className="input font-figures"
                    />
                    <div className="input font-figures bg-slate-50 text-slate-700 flex items-center justify-end h-[42px] px-3 rounded-lg">
                      {money(lineTotal)}
                    </div>
                    <button type="button" onClick={() => removeLine(i)} className="text-slate-400 hover:text-ledger-rose flex justify-center h-[42px] items-center">
                      <Trash2 size={16} />
                    </button>
                    {incomplete && (
                      <p className="col-span-full -mt-1 text-xs text-ledger-rose">
                        This line needs a product, warehouse, quantity above zero, and a non-negative price — it won't be saved until then.
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

          <div className="flex items-center justify-between text-sm gap-6 pt-2 border-t border-slate-200">
            <div className="text-slate-500">
              Customer discount
              <span className="font-figures text-ink-800 ml-2">{selectedCustomerDiscount}%</span>
            </div>
            <div className="flex flex-wrap justify-end gap-6">
              <span className="text-slate-500">Gross <span className="font-figures text-ink-800 ml-2">{money(totals.gross)}</span></span>
              <span className="text-slate-500">Discount <span className="font-figures text-ledger-rose ml-2">−{money(totals.discount)}</span></span>
              <span className="text-slate-500">Subtotal <span className="font-figures text-ink-800 ml-2">{money(totals.subTotal)}</span></span>
              <span className="text-slate-500">Tax <span className="font-figures text-ink-800 ml-2">{money(totals.taxTotal)}</span></span>
              <span className="font-medium">Total <span className="font-figures ml-2">{money(totals.subTotal + totals.taxTotal)}</span></span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" disabled={submitting} onClick={() => navigate(formBackTo)} className="btn-ghost disabled:opacity-60">Cancel</button>
            <button disabled={submitting} onClick={save} className="btn-teal disabled:opacity-60">{submitting ? 'Saving…' : editingOrder ? 'Save order' : 'Create order'}</button>
          </div>
        </div>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        onConfirm={confirmAction}
        onCancel={() => {
          setConfirmOpen(false);
          setConfirmAction(null);
        }}
        message={confirmMessage}
        title="Confirm"
        confirmLabel="Confirm"
        danger
      />
    </PageLayout>
  );
}
