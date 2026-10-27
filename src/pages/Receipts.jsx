import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Plus, Printer, Trash2, ArrowLeft } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { formatMoney, todayLocalISODate, activeOrSelected } from '../components/ui';

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;
const idOf = (ref) => (ref && typeof ref === 'object' ? ref._id : ref);

/*
  /receipts lists receipts (detail opens in a modal); /receipts/new and
  /receipts/:id/edit (mode "new" / "edit") show the receipt form as a full page.
*/
export default function Receipts({ mode }) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('sales.manage');
  const { id } = useParams();
  const navigate = useNavigate();

  const [receipts, setReceipts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [openInvoices, setOpenInvoices] = useState([]);
  const [loadError, setLoadError] = useState('');

  const [editingReceipt, setEditingReceipt] = useState(null);
  const [customer, setCustomer] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(todayLocalISODate());
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [allocations, setAllocations] = useState({});
  // Settlement discount per invoice — writes off a short payment.
  const [discounts, setDiscounts] = useState({});
  const [allocationsTouched, setAllocationsTouched] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState('');

  const load = () => api.get('/receipts').then((res) => setReceipts(res.data)).catch(() => setLoadError('Could not load receipts.'));

  useEffect(() => {
    load();
    api.get('/customers').then((res) => setCustomers(res.data)).catch(() => setLoadError('Could not load customers.'));
    api.get('/bank/accounts').then((res) => setBankAccounts(res.data)).catch(() => setLoadError('Could not load bank accounts.'));
  }, []);

  // What the receipt being edited already settled on each invoice (cash +
  // discount). Those amounts are inside the invoice's amountPaid, so they're
  // added back to show the true balance open to this receipt.
  const originalAllocs = {};
  (editingReceipt?.allocations || []).forEach((a) => {
    const invId = idOf(a.invoice);
    if (invId) originalAllocs[invId] = (originalAllocs[invId] || 0) + Number(a.amount || 0) + Number(a.discount || 0);
  });
  const dueFor = (inv) => round2(Number(inv.grandTotal) - Number(inv.amountPaid) + (originalAllocs[inv._id] || 0));

  const loadOpenInvoices = async (customerId, currentReceipt = null) => {
    if (!customerId) {
      setOpenInvoices([]);
      return;
    }
    try {
      const res = await api.get(`/invoices?customer=${customerId}`);
      const currentInvoiceIds = new Set((currentReceipt?.allocations || []).map((a) => idOf(a.invoice)));
      setOpenInvoices(res.data
        .filter((invoice) => ['POSTED', 'PARTIALLY_PAID'].includes(invoice.status) || currentInvoiceIds.has(invoice._id))
        .sort((a, b) => new Date(a.date) - new Date(b.date)));
    } catch {
      setOpenInvoices([]);
    }
  };

  useEffect(() => {
    if (!mode) return;
    loadOpenInvoices(customer, editingReceipt);
  }, [customer, editingReceipt, mode]);

  // Oldest invoices are paid first; any discount already entered is left out of the cash needed.
  const autoAllocateInvoices = (amt, invoices) => {
    const next = {};
    let remaining = round2(amt);
    invoices.forEach((invoice) => {
      if (remaining <= 0) return;
      const due = round2(dueFor(invoice) - Number(discounts[invoice._id] || 0));
      if (due <= 0) return;
      const alloc = round2(Math.min(remaining, due));
      next[invoice._id] = alloc;
      remaining = round2(remaining - alloc);
    });
    return next;
  };

  useEffect(() => {
    if (!editingReceipt && !allocationsTouched && amount && openInvoices.length > 0) {
      setAllocations(autoAllocateInvoices(amount, openInvoices));
    }
  }, [amount, openInvoices, editingReceipt, allocationsTouched]);

  const resetForm = () => {
    setEditingReceipt(null);
    setCustomer('');
    setBankAccount('');
    setAmount('');
    setReference('');
    setDate(todayLocalISODate());
    setMethod('BANK_TRANSFER');
    setAllocations({});
    setDiscounts({});
    setAllocationsTouched(false);
    setError('');
  };

  const loadForEdit = async (receiptId) => {
    setError('');
    const { data: receipt } = await api.get(`/receipts/${receiptId}`);
    setEditingReceipt(receipt);
    setCustomer(idOf(receipt.customer) || '');
    setBankAccount(idOf(receipt.bankAccount) || '');
    setAmount(receipt.amount || '');
    setReference(receipt.reference || '');
    setDate(receipt.date ? new Date(receipt.date).toISOString().slice(0, 10) : todayLocalISODate());
    setMethod(receipt.method || 'BANK_TRANSFER');
    const initial = {};
    const initialDiscounts = {};
    (receipt.allocations || []).forEach((a) => {
      const invId = idOf(a.invoice);
      if (!invId) return;
      if (a.amount) initial[invId] = a.amount;
      if (a.discount) initialDiscounts[invId] = a.discount;
    });
    setAllocations(initial);
    setDiscounts(initialDiscounts);
    setAllocationsTouched(true);
  };

  useEffect(() => {
    if (mode === 'new') resetForm();
    if (mode === 'edit' && id) loadForEdit(id).catch(() => setError('Could not load this receipt — it may have been deleted.'));
  }, [mode, id]);

  const openCreate = () => navigate('/receipts/new');
  const openEdit = (receipt) => { setDetail(null); navigate(`/receipts/${receipt._id}/edit`); };

  const openDetail = async (receipt) => {
    setDetailError('');
    const { data } = await api.get(`/receipts/${receipt._id}`);
    setDetail(data);
  };

  const amountValue = round2(amount);
  const allocatedTotal = round2(Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0));
  const unallocated = round2(amountValue - allocatedTotal);
  const discountTotal = round2(Object.values(discounts).reduce((s, v) => s + (Number(v) || 0), 0));
  const outstanding = round2(openInvoices.reduce((s, inv) => s + Math.max(dueFor(inv), 0), 0));
  const overAllocated = allocatedTotal > amountValue;
  const remainingFor = (inv) => round2(dueFor(inv) - Number(allocations[inv._id] || 0) - Number(discounts[inv._id] || 0));
  const overSettled = openInvoices.some((inv) => remainingFor(inv) < 0);

  const setAllocation = (invoiceId, value) => {
    setAllocationsTouched(true);
    setAllocations((prev) => ({ ...prev, [invoiceId]: value }));
  };
  const setDiscount = (invoiceId, value) => setDiscounts((prev) => ({ ...prev, [invoiceId]: value }));
  // Short payment: whatever the cash doesn't cover becomes discount.
  const writeOffRest = (inv) => setDiscount(inv._id, Math.max(round2(dueFor(inv) - Number(allocations[inv._id] || 0)), 0));

  const save = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    if (overAllocated) return setError('Allocated amount is more than the amount received.');
    if (overSettled) return setError('Amount plus discount is more than the balance due on an invoice.');
    const allocList = [...new Set([...Object.keys(allocations), ...Object.keys(discounts)])]
      .map((invoice) => ({ invoice, amount: round2(allocations[invoice]), discount: round2(discounts[invoice]) }))
      .filter((a) => a.amount > 0 || a.discount > 0);
    setSubmitting(true);
    try {
      const payload = { customer, bankAccount, amount: Number(amount), reference, date, method, allocations: allocList };
      if (editingReceipt) {
        await api.put(`/receipts/${editingReceipt._id}`, payload);
      } else {
        await api.post('/receipts', payload);
      }
      load();
      navigate('/receipts');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save receipt.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (receiptId) => {
    setConfirmAction(() => () => performDelete(receiptId));
    setConfirmOpen(true);
  };

  const performDelete = async (receiptId) => {
    try {
      await api.delete(`/receipts/${receiptId}`);
      if (detail?._id === receiptId) setDetail(null);
      load();
      setConfirmOpen(false);
    } catch (err) {
      const message = err.response?.data?.message || 'Could not delete receipt.';
      setLoadError(message);
      setDetailError(message);
      setConfirmOpen(false);
    }
  };

  const money = formatMoney;

  const columns = [
    { key: 'receiptNumber', label: 'Receipt #' },
    { key: 'customer', label: 'Customer', render: (r) => r.customer?.name },
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'bankAccount', label: 'Deposited to', render: (r) => r.bankAccount?.name },
    { key: 'amount', label: 'Amount', align: 'right', mono: true, render: (r) => money(r.amount) },
    { key: 'method', label: 'Method' },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openEdit(r)} className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100" title="Edit receipt">
            <Pencil size={14} />
          </button>
          <button type="button" onClick={() => handleDeleteClick(r._id)} className="rounded-md border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50" title="Delete receipt">
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ];

  const field = (label, control, hint) => (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {control}
      {hint && <span className="block text-xs text-slate-400 mt-1">{hint}</span>}
    </label>
  );

  return (
    <PageLayout
      title={mode === 'new' ? 'Record Receipt' : mode === 'edit' ? `Edit Receipt ${editingReceipt?.receiptNumber || ''}` : 'Receipts'}
      actions={!mode && canManage && (
        <button onClick={openCreate} className="flex items-center gap-1.5 btn-primary">
          <Plus size={15} /> Record Receipt
        </button>
      )}
    >
      {!mode && loadError && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{loadError}</div>}
      {!mode && <DataTable columns={columns} data={receipts} onRowClick={openDetail} />}

      {mode && (
        <form onSubmit={save}>
          <Link to="/receipts" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink-900 mb-4">
            <ArrowLeft size={15} /> Back to Receipts
          </Link>
          {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            <div className="lg:col-span-2 flex flex-col gap-4">
              <section className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
                <h2 className="font-display text-ink-800 mb-4">Receipt details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {field('Customer', (
                    <select required value={customer} onChange={(e) => { setCustomer(e.target.value); setAllocations({}); setDiscounts({}); setAllocationsTouched(false); }} className="input">
                      <option value="">Select customer…</option>
                      {activeOrSelected(customers, customer).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  ), customer ? `Outstanding: ${money(outstanding)} across ${openInvoices.length} invoice(s)` : null)}
                  {field('Date', <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />)}
                  {field('Amount Received', (
                    <input required type="number" min="0" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="input font-figures text-lg" />
                  ))}
                  {field('Deposit to', (
                    <select required value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className="input">
                      <option value="">Select account…</option>
                      {bankAccounts.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                    </select>
                  ))}
                  {field('Method', (
                    <select value={method} onChange={(e) => setMethod(e.target.value)} className="input">
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CASH">Cash</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="CARD">Card</option>
                      <option value="ONLINE">Online</option>
                      <option value="OTHER">Other</option>
                    </select>
                  ))}
                  {field('Reference', <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Cheque no., transaction ID…" className="input" />)}
                </div>
              </section>

              <section className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b border-slate-200">
                  <div>
                    <h2 className="font-display text-ink-800">Apply against invoices</h2>
                    <p className="text-xs text-slate-400">Optional — anything not applied stays as an advance. Use Discount to write off a short payment.</p>
                  </div>
                  {openInvoices.length > 0 && (
                    <div className="flex gap-2">
                      <button type="button" disabled={!amountValue} onClick={() => { setAllocationsTouched(true); setAllocations(autoAllocateInvoices(amount, openInvoices)); }} className="btn-ghost text-xs disabled:opacity-50">Auto-apply (oldest first)</button>
                      <button type="button" onClick={() => { setAllocationsTouched(true); setAllocations({}); setDiscounts({}); }} className="btn-ghost text-xs">Clear</button>
                    </div>
                  )}
                </div>
                {!customer && <div className="px-5 py-8 text-center text-sm text-slate-400">Select a customer to see their open invoices.</div>}
                {customer && openInvoices.length === 0 && <div className="px-5 py-8 text-center text-sm text-slate-400">This customer has no open invoices.</div>}
                {customer && openInvoices.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-4 py-3 font-medium">Invoice #</th>
                          <th className="px-4 py-3 font-medium">Date</th>
                          <th className="px-4 py-3 font-medium text-right">Total</th>
                          <th className="px-4 py-3 font-medium text-right">Balance Due</th>
                          <th className="px-4 py-3 font-medium text-right">Apply</th>
                          <th className="px-4 py-3 font-medium text-right">Discount</th>
                          <th className="px-4 py-3 font-medium text-right">Remaining</th>
                        </tr>
                      </thead>
                      <tbody>
                        {openInvoices.map((inv) => {
                          const due = dueFor(inv);
                          const remaining = remainingFor(inv);
                          return (
                            <tr key={inv._id} className="border-b border-slate-100 last:border-0">
                              <td className="px-4 py-2.5 font-medium">{inv.invoiceNumber}</td>
                              <td className="px-4 py-2.5 text-slate-500">{new Date(inv.date).toLocaleDateString()}</td>
                              <td className="px-4 py-2.5 text-right font-figures">{money(inv.grandTotal)}</td>
                              <td className="px-4 py-2.5 text-right font-figures">{money(due)}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center justify-end gap-2">
                                  <button type="button" onClick={() => setAllocation(inv._id, Math.max(round2(due - Number(discounts[inv._id] || 0)), 0))} className="text-xs text-ledger-teal hover:underline whitespace-nowrap" title="Apply the full balance">Full</button>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    className={`input font-figures w-28 text-right ${remaining < 0 ? 'border-ledger-rose' : ''}`}
                                    value={allocations[inv._id] ?? ''}
                                    onChange={(e) => setAllocation(inv._id, e.target.value)}
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center justify-end gap-2">
                                  <button type="button" onClick={() => writeOffRest(inv)} className="text-xs text-ledger-teal hover:underline whitespace-nowrap" title="Write off whatever the payment doesn't cover">Write off</button>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    className={`input font-figures w-28 text-right ${remaining < 0 ? 'border-ledger-rose' : ''}`}
                                    value={discounts[inv._id] ?? ''}
                                    onChange={(e) => setDiscount(inv._id, e.target.value)}
                                  />
                                </div>
                              </td>
                              <td className={`px-4 py-2.5 text-right font-figures ${remaining < 0 ? 'text-ledger-rose' : remaining === 0 ? 'text-ledger-teal' : ''}`}>
                                {remaining === 0 ? 'Settled' : money(remaining)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            <aside className="bg-white rounded-xl border border-slate-200 shadow-card p-5 lg:sticky lg:top-4 flex flex-col gap-3">
              <h2 className="font-display text-ink-800">Summary</h2>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Amount received</span>
                <span className="font-figures">{money(amountValue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Applied to invoices</span>
                <span className={`font-figures ${overAllocated ? 'text-ledger-rose' : ''}`}>{money(allocatedTotal)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold border-t border-slate-200 pt-3">
                <span>{unallocated < 0 ? 'Over-applied' : 'Unapplied (advance)'}</span>
                <span className={`font-figures ${unallocated < 0 ? 'text-ledger-rose' : ''}`}>{money(Math.abs(unallocated))}</span>
              </div>
              {overAllocated && <p className="text-xs text-ledger-rose">Applied total is more than the amount received.</p>}
              <div className="flex justify-between text-sm border-t border-slate-200 pt-3">
                <span className="text-slate-500">Discount allowed</span>
                <span className="font-figures">{money(discountTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Invoices settled by</span>
                <span className="font-figures">{money(allocatedTotal + discountTotal)}</span>
              </div>
              {overSettled && <p className="text-xs text-ledger-rose">Amount plus discount is more than an invoice's balance due.</p>}
              <button type="submit" disabled={submitting || overAllocated || overSettled} className="btn-teal mt-2 disabled:opacity-60">
                {submitting ? 'Saving…' : editingReceipt ? 'Save changes' : 'Save receipt'}
              </button>
              <button type="button" disabled={submitting} onClick={() => navigate('/receipts')} className="btn-ghost disabled:opacity-60">Cancel</button>
            </aside>
          </div>
        </form>
      )}

      <ConfirmModal
        open={confirmOpen}
        title="Delete Receipt"
        message="Delete this receipt? This will reverse all allocations and the journal entry."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={confirmAction}
        onCancel={() => setConfirmOpen(false)}
      />

      <Modal open={!!detail && !mode} onClose={() => setDetail(null)} title={`Receipt ${detail?.receiptNumber || ''}`} width="max-w-xl">
        {detail && (
          <div className="receipt-document flex flex-col gap-4">
            {detailError && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg print:hidden">{detailError}</div>}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
              <div>
                <p className="text-slate-500">Customer</p>
                <p className="font-medium">{detail.customer?.name}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => window.print()} className="btn-ghost inline-flex items-center gap-2">
                  <Printer size={16} /> Print
                </button>
                <button type="button" onClick={() => openEdit(detail)} className="btn-ghost inline-flex items-center gap-2">
                  <Pencil size={16} /> Edit
                </button>
                {canManage && (
                  <button type="button" onClick={() => handleDeleteClick(detail._id)} className="btn-ghost inline-flex items-center gap-2 text-rose-600 border-rose-200 hover:bg-rose-50">
                    <Trash2 size={16} /> Delete
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="text-xl font-semibold">Receipt</h1>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Receipt Number</p>
                  <p className="font-medium">{detail.receiptNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 text-xs">Date</p>
                  <p className="font-medium">{new Date(detail.date).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm border-t border-slate-200 pt-3">
                <div>
                  <p className="text-slate-500 text-xs">Customer</p>
                  <p className="font-medium">{detail.customer?.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 text-xs">Deposited to</p>
                  <p className="font-medium">{detail.bankAccount?.name}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Method</p>
                  <p className="font-medium">{detail.method}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 text-xs">Reference</p>
                  <p className="font-medium">{detail.reference || '—'}</p>
                </div>
              </div>
            </div>

            {detail.allocations?.length > 0 && (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-600 border-b-2 border-slate-300">
                    <th className="py-2 font-semibold">Applied to invoice</th>
                    <th className="text-right font-semibold">Amount</th>
                    <th className="text-right font-semibold">Discount</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.allocations.map((alloc, i) => (
                    <tr key={alloc.invoice?._id || i} className="border-b border-slate-100">
                      <td className="py-2">{alloc.invoice?.invoiceNumber || 'Unallocated'}</td>
                      <td className="text-right font-figures">{money(alloc.amount)}</td>
                      <td className="text-right font-figures">{alloc.discount ? money(alloc.discount) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="border-t border-slate-200 pt-3">
              <div className="flex justify-end gap-6 text-base font-semibold">
                <span>Amount Received</span>
                <span className="font-figures w-24 text-right">{money(detail.amount)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </PageLayout>
  );
}
