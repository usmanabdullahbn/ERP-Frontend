import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Plus, Printer, Trash2, ArrowLeft, FileText, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { formatMoney, todayLocalISODate, activeOrSelected } from '../components/ui';
import { printDocument, partyOf, statusLabel } from '../components/printDocument';

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;
const idOf = (ref) => (ref && typeof ref === 'object' ? ref._id : ref);

const PAYMENT_METHODS = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer', refHint: 'Transaction / IBFT / UTR ID…' },
  { value: 'CASH', label: 'Cash', refHint: 'Cash voucher or slip no.…' },
  { value: 'CHEQUE', label: 'Cheque', refHint: 'Cheque number & bank…' },
  { value: 'ONLINE', label: 'Online', refHint: 'Gateway / wallet reference…' },
  { value: 'CARD', label: 'Card', refHint: 'POS / card approval code…' },
  { value: 'OTHER', label: 'Other', refHint: 'Reference no.…' }
];

const methodLabel = (val) => PAYMENT_METHODS.find((m) => m.value === val)?.label || statusLabel(val);

/*
  /payments lists payments (detail opens in a modal); /payments/new and
  /payments/:id/edit (mode "new" / "edit") show the payment form as a full page.
*/
export default function Payments({ mode }) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('purchases.manage');
  const { id } = useParams();
  const navigate = useNavigate();

  const [payments, setPayments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [openBills, setOpenBills] = useState([]);
  const [loadError, setLoadError] = useState('');

  const [editingPayment, setEditingPayment] = useState(null);
  const [supplier, setSupplier] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(todayLocalISODate());
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [allocations, setAllocations] = useState({});
  // Settlement discount per bill — writes off a short payment.
  const [discounts, setDiscounts] = useState({});
  const [allocationsTouched, setAllocationsTouched] = useState(false);
  // Until an amount is typed, Amount Paid follows whatever is applied to bills.
  const [amountTouched, setAmountTouched] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState('');

  const load = () => api.get('/payments').then((res) => setPayments(res.data)).catch(() => setLoadError('Could not load payments.'));

  useEffect(() => {
    load();
    api.get('/suppliers').then((res) => setSuppliers(res.data)).catch(() => setLoadError('Could not load suppliers.'));
    api.get('/bank/accounts').then((res) => setBankAccounts(res.data)).catch(() => setLoadError('Could not load bank accounts.'));
  }, []);

  // What the payment being edited already settled on each bill (cash +
  // discount). Those amounts are inside the bill's amountPaid, so they're
  // added back to show the true balance open to this payment.
  const originalAllocs = {};
  (editingPayment?.allocations || []).forEach((a) => {
    const invId = idOf(a.bill);
    if (invId) originalAllocs[invId] = (originalAllocs[invId] || 0) + Number(a.amount || 0) + Number(a.discount || 0);
  });
  const dueFor = (inv) => round2(Number(inv.grandTotal) - Number(inv.amountPaid) + (originalAllocs[inv._id] || 0));

  const loadOpenBills = async (supplierId, currentPayment = null) => {
    if (!supplierId) {
      setOpenBills([]);
      return;
    }
    try {
      const res = await api.get(`/bills?supplier=${supplierId}`);
      const currentBillIds = new Set((currentPayment?.allocations || []).map((a) => idOf(a.bill)));
      setOpenBills(res.data
        .filter((bill) => ['POSTED', 'PARTIALLY_PAID'].includes(bill.status) || currentBillIds.has(bill._id))
        .sort((a, b) => new Date(a.date) - new Date(b.date)));
    } catch {
      setOpenBills([]);
    }
  };

  useEffect(() => {
    if (!mode) return;
    loadOpenBills(supplier, editingPayment);
  }, [supplier, editingPayment, mode]);

  // Oldest bills are paid first; any discount already entered is left out of the cash needed.
  const autoAllocateBills = (amt, bills) => {
    const next = {};
    let remaining = round2(amt);
    bills.forEach((bill) => {
      if (remaining <= 0) return;
      const due = round2(dueFor(bill) - Number(discounts[bill._id] || 0));
      if (due <= 0) return;
      const alloc = round2(Math.min(remaining, due));
      next[bill._id] = alloc;
      remaining = round2(remaining - alloc);
    });
    return next;
  };

  useEffect(() => {
    if (!editingPayment && !allocationsTouched && amount && openBills.length > 0) {
      setAllocations(autoAllocateBills(amount, openBills));
    }
  }, [amount, openBills, editingPayment, allocationsTouched]);

  const resetForm = () => {
    setEditingPayment(null);
    setSupplier('');
    setBankAccount('');
    setAmount('');
    setReference('');
    setNotes('');
    setDate(todayLocalISODate());
    setMethod('BANK_TRANSFER');
    setAllocations({});
    setDiscounts({});
    setAllocationsTouched(false);
    setAmountTouched(false);
    setError('');
  };

  const loadForEdit = async (paymentId) => {
    setError('');
    const { data: payment } = await api.get(`/payments/${paymentId}`);
    setEditingPayment(payment);
    setSupplier(idOf(payment.supplier) || '');
    setBankAccount(idOf(payment.bankAccount) || '');
    setAmount(payment.amount || '');
    setReference(payment.reference || '');
    setNotes(payment.notes || '');
    setDate(payment.date ? new Date(payment.date).toISOString().slice(0, 10) : todayLocalISODate());
    setMethod(payment.method || 'BANK_TRANSFER');
    const initial = {};
    const initialDiscounts = {};
    (payment.allocations || []).forEach((a) => {
      const invId = idOf(a.bill);
      if (!invId) return;
      if (a.amount) initial[invId] = a.amount;
      if (a.discount) initialDiscounts[invId] = a.discount;
    });
    setAllocations(initial);
    setDiscounts(initialDiscounts);
    setAllocationsTouched(true);
    setAmountTouched(true);
  };

  useEffect(() => {
    if (mode === 'new') resetForm();
    if (mode === 'edit' && id) loadForEdit(id).catch(() => setError('Could not load this payment — it may have been deleted.'));
  }, [mode, id]);

  const openCreate = () => navigate('/payments/new');
  const openEdit = (payment) => { setDetail(null); navigate(`/payments/${payment._id}/edit`); };

  const openDetail = async (payment) => {
    setDetailError('');
    const { data } = await api.get(`/payments/${payment._id}`);
    setDetail(data);
  };

  const amountValue = round2(amount);
  const allocatedTotal = round2(Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0));
  const unallocated = round2(amountValue - allocatedTotal);
  const discountTotal = round2(Object.values(discounts).reduce((s, v) => s + (Number(v) || 0), 0));
  const outstanding = round2(openBills.reduce((s, inv) => s + Math.max(dueFor(inv), 0), 0));
  const totalBillGrand = round2(openBills.reduce((s, inv) => s + Number(inv.grandTotal || 0), 0));
  const overAllocated = allocatedTotal > amountValue;
  const remainingFor = (inv) => round2(dueFor(inv) - Number(allocations[inv._id] || 0) - Number(discounts[inv._id] || 0));
  const totalRemaining = round2(openBills.reduce((s, inv) => s + remainingFor(inv), 0));
  const overSettled = openBills.some((inv) => remainingFor(inv) < 0);

  useEffect(() => {
    if (!amountTouched && allocationsTouched) setAmount(allocatedTotal ? String(allocatedTotal) : '');
  }, [allocatedTotal, amountTouched, allocationsTouched]);

  const setAllocation = (billId, value) => {
    setAllocationsTouched(true);
    setAllocations((prev) => ({ ...prev, [billId]: value }));
  };
  const setDiscount = (billId, value) => setDiscounts((prev) => ({ ...prev, [billId]: value }));
  // Short payment: whatever the cash doesn't cover becomes discount.
  const writeOffRest = (inv) => setDiscount(inv._id, Math.max(round2(dueFor(inv) - Number(allocations[inv._id] || 0)), 0));

  const applyAllInFull = () => {
    const next = {};
    let sum = 0;
    openBills.forEach((inv) => {
      const needed = Math.max(round2(dueFor(inv) - Number(discounts[inv._id] || 0)), 0);
      if (needed > 0) {
        next[inv._id] = needed;
        sum = round2(sum + needed);
      }
    });
    setAllocationsTouched(true);
    setAllocations(next);
    setAmount(sum ? String(sum) : '');
    setAmountTouched(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    if (overAllocated) return setError('Allocated amount is more than the amount paid.');
    if (overSettled) return setError('Amount plus discount is more than the balance due on a bill.');
    const allocList = [...new Set([...Object.keys(allocations), ...Object.keys(discounts)])]
      .map((bill) => ({ bill, amount: round2(allocations[bill]), discount: round2(discounts[bill]) }))
      .filter((a) => a.amount > 0 || a.discount > 0);
    setSubmitting(true);
    try {
      const payload = { supplier, bankAccount, amount: Number(amount), reference, notes, date, method, allocations: allocList };
      if (editingPayment) {
        await api.put(`/payments/${editingPayment._id}`, payload);
      } else {
        await api.post('/payments', payload);
      }
      load();
      navigate('/payments');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (paymentId) => {
    setConfirmAction(() => () => performDelete(paymentId));
    setConfirmOpen(true);
  };

  const performDelete = async (paymentId) => {
    try {
      await api.delete(`/payments/${paymentId}`);
      if (detail?._id === paymentId) setDetail(null);
      load();
      setConfirmOpen(false);
    } catch (err) {
      const message = err.response?.data?.message || 'Could not delete payment.';
      setLoadError(message);
      setDetailError(message);
      setConfirmOpen(false);
    }
  };

  const handlePrint = () => {
    const rows = (detail.allocations || []).map((a, i) => ({ n: i + 1, doc: a.bill?.billNumber || 'Unallocated', amount: a.amount, discount: a.discount || 0 }));
    const discount = rows.reduce((s, r) => s + r.discount, 0);
    printDocument({
      title: 'Payment Voucher',
      number: detail.paymentNumber,
      date: detail.date,
      party: { label: 'Paid to', ...partyOf(detail.supplier) },
      meta: [['Method', statusLabel(detail.method)], ['Paid from', detail.bankAccount?.name || ''], ...(detail.reference ? [['Reference', detail.reference]] : [])],
      columns: [
        { label: '#', key: 'n' },
        { label: 'Applied to bill', key: 'doc' },
        { label: 'Amount', key: 'amount', align: 'right', money: true },
        { label: 'Discount', key: 'discount', align: 'right', money: true }
      ],
      rows,
      totals: [
        ...(discount > 0 ? [['Discount received', formatMoney(discount)]] : []),
        ['Amount paid', formatMoney(detail.amount), { strong: true }]
      ],
      notes: detail.notes
    });
  };

  const money = formatMoney;
  const activeMethodObj = PAYMENT_METHODS.find((m) => m.value === method) || PAYMENT_METHODS[0];

  const columns = [
    { key: 'paymentNumber', label: 'Payment #' },
    { key: 'supplier', label: 'Supplier', render: (r) => r.supplier?.name },
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'bankAccount', label: 'Paid from', render: (r) => r.bankAccount?.name },
    { key: 'amount', label: 'Amount', align: 'right', mono: true, render: (r) => money(r.amount) },
    {
      key: 'method',
      label: 'Method',
      render: (r) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
          {methodLabel(r.method)}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openEdit(r)} className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100" title="Edit payment">
            <Pencil size={14} />
          </button>
          <button type="button" onClick={() => handleDeleteClick(r._id)} className="rounded-md border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50" title="Delete payment">
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ];

  const field = (label, control, hint) => (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1.5">{label}</span>
      {control}
      {hint && <span className="block text-xs text-slate-400 mt-1">{hint}</span>}
    </label>
  );

  return (
    <PageLayout
      title={mode === 'new' ? 'Record Payment' : mode === 'edit' ? `Edit Payment ${editingPayment?.paymentNumber || ''}` : 'Payments'}
      actions={!mode && canManage && (
        <button onClick={openCreate} className="flex items-center gap-1.5 btn-primary">
          <Plus size={15} /> Record Payment
        </button>
      )}
    >
      {!mode && loadError && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{loadError}</div>}
      {!mode && <DataTable columns={columns} data={payments} onRowClick={openDetail} />}

      {mode && (
        <form onSubmit={save}>
          <Link to="/payments" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink-900 mb-4">
            <ArrowLeft size={15} /> Back to Payments
          </Link>
          {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            <div className="lg:col-span-2 flex flex-col gap-5">
              {/* STEP 1: PAYMENT DETAILS */}
              <section className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-sm font-semibold text-ink-800">Payment Details</h2>
                    <p className="text-xs text-slate-400">Supplier, bank/cash account, payment method &amp; reference</p>
                  </div>
                  {editingPayment?.paymentNumber && (
                    <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-600">
                      {editingPayment.paymentNumber}
                    </span>
                  )}
                </div>

                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {field('Supplier', (
                      <select
                        required
                        value={supplier}
                        onChange={(e) => {
                          setSupplier(e.target.value);
                          setAllocations({});
                          setDiscounts({});
                          setAllocationsTouched(false);
                        }}
                        className="input"
                      >
                        <option value="">Select supplier…</option>
                        {activeOrSelected(suppliers, supplier).map((c) => (
                          <option key={c._id} value={c._id}>{c.name} ({c.code})</option>
                        ))}
                      </select>
                    ))}
                    {field('Payment Date', (
                      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
                    ))}
                  </div>

                  {/* Supplier Outstanding Strip */}
                  {supplier && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-slate-500">
                          Open Bills: <span className="font-semibold text-ink-800">{openBills.length}</span>
                        </div>
                        <span className="text-slate-300">|</span>
                        <div className="text-xs text-slate-500">
                          Total Payable: <span className="font-figures font-semibold text-ink-900">Rs. {money(outstanding)}</span>
                        </div>
                      </div>
                      {outstanding > 0 && (
                        <button
                          type="button"
                          onClick={applyAllInFull}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-ledger-teal hover:underline"
                        >
                          <Sparkles size={13} /> Pay full balance (Rs. {money(outstanding)})
                        </button>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {field('Amount Paid', (
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                          Rs.
                        </span>
                        <input
                          required
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={amount}
                          onChange={(e) => {
                            setAmount(e.target.value);
                            setAmountTouched(e.target.value !== '');
                          }}
                          className="input pl-9 font-figures font-semibold"
                        />
                      </div>
                    ), !amountTouched && allocatedTotal > 0 ? 'Auto-filled from bill allocations below' : null)}
                    {field('Pay From (Bank / Cash)', (
                      <select required value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className="input">
                        <option value="">Select account…</option>
                        {bankAccounts.map((b) => (
                          <option key={b._id} value={b._id}>{b.name}{b.bankName ? ` — ${b.bankName}` : ''}</option>
                        ))}
                      </select>
                    ))}
                  </div>

                  {/* Quick Payment Method Pills */}
                  <div>
                    <span className="block text-xs font-medium text-slate-600 mb-1.5">Payment Method</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                      {PAYMENT_METHODS.map((m) => {
                        const active = method === m.value;
                        return (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => setMethod(m.value)}
                            className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all text-center ${
                              active
                                ? 'border-ledger-teal bg-ledger-tealLight text-ledger-teal shadow-xs'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {field('Reference #', (
                      <input
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder={activeMethodObj.refHint}
                        className="input"
                      />
                    ))}
                    {field('Notes / Narration (Optional)', (
                      <input
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Shown on printed voucher & purchase journal…"
                        className="input"
                      />
                    ))}
                  </div>
                </div>
              </section>

              {/* STEP 2: APPLY AGAINST BILLS */}
              <section className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-sm font-semibold text-ink-800">Apply Against Bills</h2>
                      {supplier && openBills.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700 font-medium">
                          {openBills.length} open
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">Optional — any unapplied amount stays as a supplier advance. Use Discount to write off short payments.</p>
                  </div>
                  {openBills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={!amountValue}
                        onClick={() => {
                          setAllocationsTouched(true);
                          setAllocations(autoAllocateBills(amount, openBills));
                        }}
                        className="btn-ghost text-xs py-1.5 px-2.5 border border-slate-200 bg-white disabled:opacity-50"
                      >
                        Auto-apply (oldest first)
                      </button>
                      <button
                        type="button"
                        onClick={applyAllInFull}
                        className="btn-ghost text-xs py-1.5 px-2.5 border border-slate-200 bg-white"
                      >
                        Apply all in full
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAllocationsTouched(true);
                          setAllocations({});
                          setDiscounts({});
                        }}
                        className="btn-ghost text-xs py-1.5 px-2.5 text-slate-500 hover:text-ledger-rose"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {!supplier && (
                  <div className="px-5 py-10 text-center">
                    <FileText size={28} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-medium text-slate-500">No supplier selected</p>
                    <p className="text-xs text-slate-400 mt-0.5">Choose a supplier above to view and settle their open bills.</p>
                  </div>
                )}

                {supplier && openBills.length === 0 && (
                  <div className="px-5 py-10 text-center">
                    <CheckCircle2 size={28} className="mx-auto text-ledger-teal/60 mb-2" />
                    <p className="text-sm font-medium text-slate-600">No open bills for this supplier</p>
                    <p className="text-xs text-slate-400 mt-0.5">Saving this payment will record the full amount as an advance on their account.</p>
                  </div>
                )}

                {supplier && openBills.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/40 text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-4 py-3 font-medium">Bill #</th>
                          <th className="px-3 py-3 font-medium">Date</th>
                          <th className="px-3 py-3 font-medium text-right">Total</th>
                          <th className="px-3 py-3 font-medium text-right">Balance Due</th>
                          <th className="px-3 py-3 font-medium text-right">Amount to Apply</th>
                          <th className="px-3 py-3 font-medium text-right">Discount</th>
                          <th className="px-4 py-3 font-medium text-right">Remaining</th>
                        </tr>
                      </thead>
                      <tbody>
                        {openBills.map((inv) => {
                          const due = dueFor(inv);
                          const remaining = remainingFor(inv);
                          const hasApplied = Number(allocations[inv._id] || 0) > 0 || Number(discounts[inv._id] || 0) > 0;
                          return (
                            <tr
                              key={inv._id}
                              className={`border-b border-slate-100 last:border-0 transition-colors ${
                                hasApplied ? 'bg-ledger-tealLight/20' : 'hover:bg-slate-50/60'
                              }`}
                            >
                              <td className="px-4 py-2.5 font-medium text-ink-900 whitespace-nowrap">{inv.billNumber}</td>
                              <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{new Date(inv.date).toLocaleDateString()}</td>
                              <td className="px-3 py-2.5 text-right font-figures text-slate-500">{money(inv.grandTotal)}</td>
                              <td className="px-3 py-2.5 text-right font-figures font-medium text-ink-900">{money(due)}</td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setAllocation(inv._id, Math.max(round2(due - Number(discounts[inv._id] || 0)), 0))}
                                    className="px-2 py-1 rounded bg-slate-100 hover:bg-ledger-tealLight text-ledger-teal font-medium text-xs transition-colors whitespace-nowrap"
                                    title="Apply the full balance due"
                                  >
                                    Full
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    className={`input font-figures w-28 text-right py-1.5 ${remaining < 0 ? 'border-ledger-rose' : ''}`}
                                    value={allocations[inv._id] ?? ''}
                                    onChange={(e) => setAllocation(inv._id, e.target.value)}
                                  />
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => writeOffRest(inv)}
                                    className="px-2 py-1 rounded bg-slate-100 hover:bg-ledger-tealLight text-slate-600 hover:text-ledger-teal font-medium text-xs transition-colors whitespace-nowrap"
                                    title="Write off remaining balance as settlement discount"
                                  >
                                    Write off
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    className={`input font-figures w-24 text-right py-1.5 ${remaining < 0 ? 'border-ledger-rose' : ''}`}
                                    value={discounts[inv._id] ?? ''}
                                    onChange={(e) => setDiscount(inv._id, e.target.value)}
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-right font-figures whitespace-nowrap">
                                {remaining === 0 ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-ledger-tealLight text-ledger-teal">
                                    Settled
                                  </span>
                                ) : remaining < 0 ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-ledger-roseLight text-ledger-rose">
                                    {money(remaining)}
                                  </span>
                                ) : (
                                  <span className="text-ink-800">{money(remaining)}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-xs">
                          <td colSpan={2} className="px-4 py-2.5 text-slate-600 uppercase">Total ({openBills.length} bill{openBills.length === 1 ? '' : 's'})</td>
                          <td className="px-3 py-2.5 text-right font-figures text-slate-600">{money(totalBillGrand)}</td>
                          <td className="px-3 py-2.5 text-right font-figures text-ink-900">{money(outstanding)}</td>
                          <td className="px-3 py-2.5 text-right font-figures text-ledger-teal">{money(allocatedTotal)}</td>
                          <td className="px-3 py-2.5 text-right font-figures text-ink-800">{money(discountTotal)}</td>
                          <td className={`px-4 py-2.5 text-right font-figures ${totalRemaining < 0 ? 'text-ledger-rose' : 'text-ink-900'}`}>
                            {money(totalRemaining)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </section>
            </div>

            {/* RIGHT SIDEBAR: PAYMENT SUMMARY */}
            <aside className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden lg:sticky lg:top-4">
              <div className="bg-ink-900 px-5 py-4 text-white">
                <p className="text-xs uppercase tracking-wider text-slate-400">Amount Paid</p>
                <p className="font-figures text-2xl font-bold mt-1">Rs. {money(amountValue)}</p>
                <p className="text-xs text-slate-400 mt-1">{methodLabel(method)}</p>
              </div>

              <div className="p-5 flex flex-col gap-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Applied to bills</span>
                  <span className={`font-figures font-medium ${overAllocated ? 'text-ledger-rose' : 'text-ink-900'}`}>{money(allocatedTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Discount received</span>
                  <span className="font-figures text-ink-800">{money(discountTotal)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-slate-100 pt-2.5">
                  <span className="text-slate-600 font-medium">Bills settled by</span>
                  <span className="font-figures font-semibold text-ink-900">{money(allocatedTotal + discountTotal)}</span>
                </div>

                {/* Unapplied / Advance / Over-applied status box */}
                <div
                  className={`rounded-lg p-3 border mt-1 ${
                    unallocated < 0
                      ? 'bg-ledger-roseLight/60 border-rose-200 text-ledger-rose'
                      : unallocated > 0
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>{unallocated < 0 ? 'Over-applied' : 'Unapplied (Advance)'}</span>
                    <span className="font-figures">Rs. {money(Math.abs(unallocated))}</span>
                  </div>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    {unallocated < 0
                      ? 'Applied total exceeds the amount paid.'
                      : unallocated > 0
                        ? 'Will remain as an unallocated advance on the supplier account.'
                        : 'Entire payment amount is allocated to bills.'}
                  </p>
                </div>

                {overSettled && (
                  <div className="flex items-start gap-2 rounded-lg bg-ledger-roseLight p-3 text-xs text-ledger-rose">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span>Amount plus discount exceeds the balance due on one or more bills.</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || overAllocated || overSettled}
                  className="btn-teal w-full py-2.5 mt-1 font-medium disabled:opacity-60"
                >
                  {submitting ? 'Saving…' : editingPayment ? 'Save Changes' : 'Save Payment'}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => navigate('/payments')}
                  className="btn-ghost w-full border border-slate-200 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </aside>
          </div>
        </form>
      )}

      <ConfirmModal
        open={confirmOpen}
        title="Delete Payment"
        message="Delete this payment? This will reverse all allocations and the journal entry."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={confirmAction}
        onCancel={() => setConfirmOpen(false)}
      />

      <Modal open={!!detail && !mode} onClose={() => setDetail(null)} title={`Payment ${detail?.paymentNumber || ''}`} width="max-w-xl">
        {detail && (
          <div className="payment-document flex flex-col gap-4">
            {detailError && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg print:hidden">{detailError}</div>}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
              <div>
                <p className="text-slate-500 text-xs">Supplier</p>
                <p className="font-medium text-ink-900">{detail.supplier?.name}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={handlePrint} className="btn-ghost inline-flex items-center gap-2">
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
              <h1 className="text-xl font-semibold">Payment</h1>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Payment Number</p>
                  <p className="font-medium">{detail.paymentNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 text-xs">Date</p>
                  <p className="font-medium">{new Date(detail.date).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm border-t border-slate-200 pt-3">
                <div>
                  <p className="text-slate-500 text-xs">Supplier</p>
                  <p className="font-medium">{detail.supplier?.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 text-xs">Paid from</p>
                  <p className="font-medium">{detail.bankAccount?.name}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Method</p>
                  <p className="font-medium">{methodLabel(detail.method)}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 text-xs">Reference</p>
                  <p className="font-medium">{detail.reference || '—'}</p>
                </div>
              </div>
              {detail.notes && (
                <div className="text-sm border-t border-slate-100 pt-2">
                  <p className="text-slate-500 text-xs">Notes</p>
                  <p className="text-ink-800">{detail.notes}</p>
                </div>
              )}
            </div>

            {detail.allocations?.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-xs uppercase text-slate-600 border-b-2 border-slate-300">
                      <th className="py-2 font-semibold">Applied to bill</th>
                      <th className="text-right font-semibold">Amount</th>
                      <th className="text-right font-semibold">Discount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.allocations.map((alloc, i) => (
                      <tr key={alloc.bill?._id || i} className="border-b border-slate-100">
                        <td className="py-2">{alloc.bill?.billNumber || 'Unallocated'}</td>
                        <td className="text-right font-figures">{money(alloc.amount)}</td>
                        <td className="text-right font-figures">{alloc.discount ? money(alloc.discount) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="border-t border-slate-200 pt-3">
              <div className="flex justify-end gap-6 text-base font-semibold">
                <span>Amount Paid</span>
                <span className="font-figures w-28 text-right">Rs. {money(detail.amount)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </PageLayout>
  );
}
