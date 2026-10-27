import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Pencil, Printer, Ban, ArrowLeft } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import ConfirmModal from '../components/ConfirmModal';
import Badge from '../components/Badge';
import ProductPicker from '../components/ProductPicker';
import { useAuth } from '../context/AuthContext';
import { formatMoney, todayLocalISODate } from '../components/ui';

let lineKeySeq = 0;
// Product, Warehouse, Qty, Cost, Disc %, Disc Amt, Total, delete
const LINE_GRID = 'minmax(0,2.4fr) minmax(0,1.4fr) minmax(0,0.8fr) minmax(0,1.1fr) minmax(0,0.9fr) minmax(0,1.1fr) minmax(0,1.1fr) 32px';
const newLine = (defaultWarehouse = '') => ({ _key: ++lineKeySeq, product: '', warehouse: defaultWarehouse, quantity: 1, unitCost: 0, taxRate: 0, discountRate: 0 });

/*
  /bills lists bills; /bills/:id is the bill's own page; /bills/new and
  /bills/:id/edit (mode "new" / "edit") show the form as a full page. All share
  this component so the form, post, void and delete logic live in one place.
*/
export default function Bills({ mode }) {
  const { isAdmin } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();

  const [bills, setBills] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loadError, setLoadError] = useState('');

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

  useEffect(() => {
    setDetail(null);
    setDetailError('');
    if (id && !mode) openDetail({ _id: id }).catch(() => setDetailError('Could not load this bill — it may have been deleted.'));
  }, [id, mode]);

  useEffect(() => {
    if (mode === 'new') resetForm();
    if (mode === 'edit' && id) loadForEdit({ _id: id }).catch(() => setError('Could not load this bill — it may have been deleted.'));
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
      if (prod) { next[i].unitCost = prod.costPrice; next[i].taxRate = prod.taxRate; }
    }
    setLines(next);
  };

  const addLine = () => setLines([...lines, newLine(defaultWarehouseId)]);
  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));

  const lineGross = (l) => (l.quantity || 0) * (l.unitCost || 0);
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

  const validLines = lines.filter((l) => l.product && l.warehouse && l.quantity > 0 && l.unitCost >= 0);
  const hasIncompleteLines = validLines.length !== lines.length;

  const totals = validLines.reduce(
    (acc, l) => {
      const base = (l.quantity || 0) * (l.unitCost || 0);
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

  const openCreate = () => navigate('/bills/new');
  const openEdit = (b) => navigate(`/bills/${b._id}/edit`);
  const formBackTo = mode === 'edit' && id ? `/bills/${id}` : '/bills';

  const resetForm = () => {
    setEditingBill(null);
    setSupplier(''); setDate(todayLocalISODate()); setDueDate('');
    setLines([newLine(defaultWarehouseId)]); setError('');
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
        items: validLines.map(({ _key, _discAmtText, ...rest }) => rest),
        notes: editingBill?.notes || '',
        postNow
      };
      const { data: saved } = editingBill
        ? await api.put(`/bills/${editingBill._id}`, payload)
        : await api.post('/bills', payload);
      setEditingBill(null);
      load();
      // Land on the saved bill's own page.
      navigate(saved?._id ? `/bills/${saved._id}` : '/bills');
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

  const loadForEdit = async (b) => {
    setError('');
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
  };

  const handleDeleteClick = (id) => {
    setConfirmMessage('Delete this draft bill? This cannot be undone.');
    setConfirmAction(() => () => performDelete(id));
    setConfirmOpen(true);
  };

  const performDelete = async (billId) => {
    try {
      await api.delete(`/bills/${billId}`);
      setConfirmOpen(false);
      if (id) return navigate('/bills', { replace: true });
      load();
    } catch (err) {
      const message = err.response?.data?.message || 'Could not delete bill.';
      if (id) setDetailError(message); else setLoadError(message);
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
      const message = err.response?.data?.message || 'Could not void bill.';
      if (id) setDetailError(message); else setLoadError(message);
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
          {isAdmin && r.status !== 'POSTING' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openEdit(r); }}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-500 hover:text-ink-900 hover:border-slate-300"
              title="Edit bill"
            >
              <Pencil size={16} />
            </button>
          )}
          {isAdmin && r.status !== 'POSTING' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleDeleteClick(r._id); }}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-500 hover:text-rose-600 hover:border-slate-300"
              title="Delete bill"
            >
              <Trash2 size={16} />
            </button>
          )}
          {isAdmin && !['DRAFT', 'VOID', 'POSTING'].includes(r.status) && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleVoidClick(r._id); }}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-500 hover:text-rose-600 hover:border-slate-300"
              title="Void bill"
            >
              <Ban size={16} />
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
      {isAdmin && detail.status !== 'POSTING' && (
        <button type="button" onClick={() => openEdit(detail)} className="btn-ghost inline-flex items-center gap-2 print:hidden">
          <Pencil size={16} /> Edit
        </button>
      )}
      {isAdmin && detail.status !== 'POSTING' && (
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

  const listActions = isAdmin && (
    <button onClick={openCreate} className="flex items-center gap-1.5 btn-primary">
      <Plus size={15} /> New Bill
    </button>
  );

  return (
    <PageLayout
      title={mode === 'new' ? 'New Bill' : mode === 'edit' ? `Edit Bill ${editingBill?.billNumber || ''}` : id ? `Bill ${detail?.billNumber || ''}` : 'Purchase Bills'}
      actions={mode ? null : id ? viewActions : listActions}
    >
      {!mode && !id && loadError && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{loadError}</div>}
      {!mode && !id && <DataTable columns={columns} data={bills} onRowClick={(r) => navigate(`/bills/${r._id}`)} />}

      {!mode && id && (
        <div className="print-page">
          <Link to="/bills" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink-900 mb-4 print:hidden">
            <ArrowLeft size={15} /> Back to Purchase Bills
          </Link>
          {detailError && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg print:hidden">{detailError}</div>}
          {!detail && !detailError && <div className="text-sm text-slate-400 py-12 text-center">Loading…</div>}
          {detail && (
            <div className="bill-document bg-white rounded-xl border border-slate-200 shadow-card p-6 flex flex-col gap-4 max-w-4xl">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <h1 className="text-xl font-semibold">Purchase Bill</h1>
                  <Badge status={detail.status} />
                </div>
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

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-xs uppercase text-slate-600 border-b-2 border-slate-300">
                      <th className="py-2 font-semibold">Item</th>
                      <th className="font-semibold">Warehouse</th>
                      <th className="text-right font-semibold">Qty</th>
                      <th className="text-right font-semibold">Cost</th>
                      <th className="text-right font-semibold">Disc %</th>
                      <th className="text-right font-semibold">Disc Amt</th>
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

              {isAdmin && !['VOID', 'POSTING'].includes(detail.status) && (
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 print:hidden">
                  {detail.status === 'DRAFT' && <button disabled={detailBusy} onClick={() => handlePost(detail._id)} className="btn-teal disabled:opacity-60">{detailBusy ? 'Posting…' : 'Post to ledger'}</button>}
                  {!['VOID', 'DRAFT', 'POSTING'].includes(detail.status) && <button onClick={() => handleVoidClick(detail._id)} className="btn-ghost text-ledger-rose">Void</button>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {mode && (
        <div>
          <Link to={formBackTo} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink-900 mb-4">
            <ArrowLeft size={15} /> {mode === 'edit' ? 'Back to bill' : 'Back to Purchase Bills'}
          </Link>
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-6 flex flex-col gap-4">
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
              <div className="grid gap-2 text-[11px] font-medium uppercase tracking-wide text-slate-500" style={{ gridTemplateColumns: LINE_GRID }}>
                <span>Product</span>
                <span>Warehouse</span>
                <span>Qty</span>
                <span>Cost</span>
                <span>Disc %</span>
                <span>Disc Amt</span>
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
                    style={{ gridTemplateColumns: LINE_GRID }}
                  >
                    <ProductPicker products={products} value={line.product} onChange={(product) => updateLine(i, { product })} />
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

          <div className="flex flex-wrap justify-end text-sm gap-6 pt-2 border-t border-slate-200">
            <span className="text-slate-500">Gross <span className="font-figures text-ink-800 ml-2">{money(totals.gross)}</span></span>
            <span className="text-slate-500">Discount <span className="font-figures text-ledger-rose ml-2">−{money(totals.discount)}</span></span>
            <span className="text-slate-500">Subtotal <span className="font-figures text-ink-800 ml-2">{money(totals.subTotal)}</span></span>
            <span className="text-slate-500">Tax <span className="font-figures text-ink-800 ml-2">{money(totals.taxTotal)}</span></span>
            <span className="font-medium">Total <span className="font-figures ml-2">{money(totals.subTotal + totals.taxTotal)}</span></span>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" disabled={submitting} onClick={() => navigate(formBackTo)} className="btn-ghost disabled:opacity-60">Cancel</button>
            <button disabled={submitting} onClick={() => save(false)} className="btn-ghost disabled:opacity-60">Save as draft</button>
            <button disabled={submitting} onClick={() => save(true)} className="btn-teal disabled:opacity-60">{submitting ? 'Saving…' : 'Save & post'}</button>
          </div>
        </div>
        </div>
      )}

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
