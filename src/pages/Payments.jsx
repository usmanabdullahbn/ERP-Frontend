import { useEffect, useState } from 'react';
import { Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { formatMoney, todayLocalISODate } from '../components/ui';

export default function Payments() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('purchases.manage');

  const [payments, setPayments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [openBills, setOpenBills] = useState([]);
  const [loadError, setLoadError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [supplier, setSupplier] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(todayLocalISODate());
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [allocations, setAllocations] = useState({});
  const [allocationsTouched, setAllocationsTouched] = useState(false);
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

  const loadOpenBills = async (supplierId, currentPayment = null) => {
    if (!supplierId) {
      setOpenBills([]);
      return;
    }

    try {
      const res = await api.get(`/bills?supplier=${supplierId}`);
      const currentAllocations = currentPayment?.allocations || [];
      const currentBillIds = new Set(currentAllocations.map((alloc) => alloc.bill?.toString?.() || alloc.bill));
      const selectableBills = res.data.filter((bill) => {
        const isOpen = ['POSTED', 'PARTIALLY_PAID'].includes(bill.status);
        const hasExistingAllocation = currentBillIds.has(bill._id);
        return isOpen || hasExistingAllocation;
      });
      setOpenBills(selectableBills);
    } catch {
      setOpenBills([]);
    }
  };

  useEffect(() => {
    if (supplier) {
      loadOpenBills(supplier);
    } else {
      setOpenBills([]);
    }
  }, [supplier]);

  useEffect(() => {
    if (!editingPayment && !allocationsTouched && amount && openBills.length > 0) {
      setAllocations(autoAllocateBills(amount, openBills));
    }
  }, [amount, openBills, editingPayment, allocationsTouched]);

  const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

  const autoAllocateBills = (amt, bills) => {
    const amountValue = round2(Number(amt) || 0);
    const allocations = {};
    let remaining = amountValue;
    bills.forEach((bill) => {
      if (remaining <= 0) return;
      const due = round2(Number(bill.grandTotal) - Number(bill.amountPaid));
      if (due <= 0) return;
      const alloc = Math.min(remaining, due);
      if (alloc > 0) {
        allocations[bill._id] = alloc;
        remaining = round2(remaining - alloc);
      }
    });
    return allocations;
  };

  const resetForm = () => {
    setSupplier('');
    setBankAccount('');
    setAmount('');
    setReference('');
    setDate(todayLocalISODate());
    setMethod('BANK_TRANSFER');
    setAllocations({});
    setAllocationsTouched(false);
    setError('');
  };

  const openCreate = () => {
    setEditingPayment(null);
    resetForm();
    setModalOpen(true);
  };

  const openEdit = async (payment) => {
    setEditingPayment(payment);
    setSupplier(typeof payment.supplier === 'string' ? payment.supplier : payment.supplier?._id || '');
    setBankAccount(typeof payment.bankAccount === 'string' ? payment.bankAccount : payment.bankAccount?._id || '');
    setAmount(payment.amount || '');
    setReference(payment.reference || '');
    setDate(payment.date ? new Date(payment.date).toISOString().slice(0, 10) : todayLocalISODate());
    setMethod(payment.method || 'BANK_TRANSFER');
    setAllocations({});
    setAllocationsTouched(true);
    setError('');

    const supplierId = typeof payment.supplier === 'string' ? payment.supplier : payment.supplier?._id;
    if (supplierId) {
      await loadOpenBills(supplierId, payment);
      const initialAllocations = {};
      (payment.allocations || []).forEach((alloc) => {
        if (alloc.bill) initialAllocations[alloc.bill] = alloc.amount;
      });
      setAllocations(initialAllocations);
    } else {
      setOpenBills([]);
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingPayment(null);
    resetForm();
  };

  const openDetail = async (payment) => {
    setDetailError('');
    const { data } = await api.get(`/payments/${payment._id}`);
    setDetail(data);
  };

  const allocatedTotal = Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0);

  const save = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    const allocList = Object.entries(allocations).filter(([, v]) => Number(v) > 0).map(([bill, amt]) => ({ bill, amount: Number(amt) }));
    setSubmitting(true);
    try {
      const payload = { supplier, bankAccount, amount: Number(amount), reference, date, method, allocations: allocList };
      if (editingPayment) {
        await api.put(`/payments/${editingPayment._id}`, payload);
      } else {
        await api.post('/payments', payload);
      }
      closeModal();
      setDetail(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmAction(() => () => performDelete(id));
    setConfirmOpen(true);
  };

  const performDelete = async (id) => {
    try {
      await api.delete(`/payments/${id}`);
      if (detail?._id === id) setDetail(null);
      load();
      setConfirmOpen(false);
    } catch (err) {
      const message = err.response?.data?.message || 'Could not delete payment.';
      setError(message);
      setDetailError(message);
    }
  };

  const money = formatMoney;

  const columns = [
    { key: 'paymentNumber', label: 'Payment #' },
    { key: 'supplier', label: 'Supplier', render: (r) => r.supplier?.name },
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'bankAccount', label: 'Paid from', render: (r) => r.bankAccount?.name },
    { key: 'amount', label: 'Amount', align: 'right', mono: true, render: (r) => money(r.amount) },
    { key: 'method', label: 'Method' },
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

  return (
    <PageLayout
      title="Payments"
      actions={canManage && (
        <button onClick={openCreate} className="flex items-center gap-1.5 btn-primary">
          <Plus size={15} /> Record Payment
        </button>
      )}
    >
      {loadError && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{loadError}</div>}
      <DataTable columns={columns} data={payments} onRowClick={openDetail} />

      <Modal open={modalOpen} onClose={() => !submitting && closeModal()} title={editingPayment ? 'Edit Payment' : 'Record Payment'}>
        <form onSubmit={save} className="flex flex-col gap-3">
          {error && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Supplier</span>
            <select required value={supplier} onChange={(e) => { setSupplier(e.target.value); setAllocations({}); setAllocationsTouched(false); if (e.target.value) loadOpenBills(e.target.value); else setOpenBills([]); }} className="input">
              <option value="">Select…</option>
              {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Ref</span>
              <input value={reference} onChange={(e) => setReference(e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Pay from</span>
              <select required value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className="input">
                <option value="">Select…</option>
                {bankAccounts.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Method</span>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="input">
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CASH">Cash</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CARD">Card</option>
                <option value="ONLINE">Online</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Amount Paid</span>
              <input required type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="input font-figures" />
            </label>
          </div>

          {openBills.length > 0 && (
            <div>
              <span className="block text-xs font-medium text-slate-600 mb-1">Apply against bills (optional)</span>
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2">
                {openBills.map((b) => (
                  <div key={b._id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{b.billNumber} <span className="text-slate-400">({money(b.grandTotal - b.amountPaid)} due)</span></span>
                    <input
                      type="number"
                      min="0"
                      className="input font-figures w-28 py-1"
                      value={allocations[b._id] || ''}
                      onChange={(e) => { setAllocationsTouched(true); setAllocations({ ...allocations, [b._id]: e.target.value }); }}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1">Allocated: {money(allocatedTotal)} / {money(amount || 0)}</p>
            </div>
          )}

          <button type="submit" disabled={submitting} className="mt-2 btn-teal disabled:opacity-60">{submitting ? 'Saving…' : editingPayment ? 'Save changes' : 'Save payment'}</button>
        </form>
      </Modal>

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

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Payment ${detail?.paymentNumber || ''}`} width="max-w-xl">
        {detail && (
          <div className="payment-document flex flex-col gap-4">
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
                    <th className="py-2 font-semibold">Applied to bill</th>
                    <th className="text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.allocations.map((alloc, i) => (
                    <tr key={alloc.bill?._id || i} className="border-b border-slate-100">
                      <td className="py-2">{alloc.bill?.billNumber || 'Unallocated'}</td>
                      <td className="text-right font-figures">{money(alloc.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="border-t border-slate-200 pt-3">
              <div className="flex justify-end gap-6 text-base font-semibold">
                <span>Amount Paid</span>
                <span className="font-figures w-24 text-right">{money(detail.amount)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </PageLayout>
  );
}
