import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';

export default function Payments() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('purchases.manage');

  const [payments, setPayments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [openBills, setOpenBills] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [supplier, setSupplier] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [allocations, setAllocations] = useState({});
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const load = () => api.get('/payments').then((res) => setPayments(res.data));

  useEffect(() => {
    load();
    api.get('/suppliers').then((res) => setSuppliers(res.data));
    api.get('/bank/accounts').then((res) => setBankAccounts(res.data));
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
    if (!editingPayment && amount && openBills.length > 0) {
      setAllocations(autoAllocateBills(amount, openBills));
    }
  }, [amount, openBills, editingPayment]);

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
    setDate(new Date().toISOString().slice(0, 10));
    setMethod('BANK_TRANSFER');
    setAllocations({});
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
    setDate(payment.date ? new Date(payment.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    setMethod(payment.method || 'BANK_TRANSFER');
    setAllocations({});
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

  const allocatedTotal = Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const allocList = Object.entries(allocations).filter(([, v]) => Number(v) > 0).map(([bill, amt]) => ({ bill, amount: Number(amt) }));
    try {
      const payload = { supplier, bankAccount, amount: Number(amount), reference, date, method, allocations: allocList };
      if (editingPayment) {
        await api.put(`/payments/${editingPayment._id}`, payload);
      } else {
        await api.post('/payments', payload);
      }
      closeModal();
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save payment.');
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmAction(() => () => performDelete(id));
    setConfirmOpen(true);
  };

  const performDelete = async (id) => {
    try {
      await api.delete(`/payments/${id}`);
      load();
      setConfirmOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete payment.');
    }
  };

  const money = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

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
      <DataTable columns={columns} data={payments} />

      <Modal open={modalOpen} onClose={closeModal} title={editingPayment ? 'Edit Payment' : 'Record Payment'}>
        <form onSubmit={save} className="flex flex-col gap-3">
          {error && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Supplier</span>
            <select required value={supplier} onChange={(e) => { setSupplier(e.target.value); setAllocations({}); if (e.target.value) loadOpenBills(e.target.value); else setOpenBills([]); }} className="input">
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
              <input required type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input font-figures" />
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
                      className="input font-figures w-28 py-1"
                      value={allocations[b._id] || ''}
                      onChange={(e) => setAllocations({ ...allocations, [b._id]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1">Allocated: {money(allocatedTotal)} / {money(amount || 0)}</p>
            </div>
          )}

          <button type="submit" className="mt-2 btn-teal">{editingPayment ? 'Save changes' : 'Save payment'}</button>
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
    </PageLayout>
  );
}
