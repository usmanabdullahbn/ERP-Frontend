import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';

export default function Receipts() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('sales.manage');

  const [receipts, setReceipts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [openInvoices, setOpenInvoices] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [customer, setCustomer] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [allocations, setAllocations] = useState({});
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const load = () => api.get('/receipts').then((res) => setReceipts(res.data));

  useEffect(() => {
    load();
    api.get('/customers').then((res) => setCustomers(res.data));
    api.get('/bank/accounts').then((res) => setBankAccounts(res.data));
  }, []);

  const loadOpenInvoices = async (customerId, currentReceipt = null) => {
    if (!customerId) {
      setOpenInvoices([]);
      return;
    }

    try {
      const res = await api.get(`/invoices?customer=${customerId}`);
      const currentAllocations = currentReceipt?.allocations || [];
      const currentInvoiceIds = new Set(currentAllocations.map((alloc) => alloc.invoice?.toString?.() || alloc.invoice));
      const selectableInvoices = res.data.filter((invoice) => {
        const isOpen = ['POSTED', 'PARTIALLY_PAID'].includes(invoice.status);
        const hasExistingAllocation = currentInvoiceIds.has(invoice._id);
        return isOpen || hasExistingAllocation;
      });
      setOpenInvoices(selectableInvoices);
    } catch {
      setOpenInvoices([]);
    }
  };

  useEffect(() => {
    if (customer) {
      loadOpenInvoices(customer);
    } else {
      setOpenInvoices([]);
    }
  }, [customer]);

  const resetForm = () => {
    setCustomer('');
    setBankAccount('');
    setAmount('');
    setDate(new Date().toISOString().slice(0, 10));
    setMethod('BANK_TRANSFER');
    setAllocations({});
    setError('');
  };

  const openCreate = () => {
    setEditingReceipt(null);
    resetForm();
    setModalOpen(true);
  };

  const openEdit = async (receipt) => {
    setEditingReceipt(receipt);
    setCustomer(typeof receipt.customer === 'string' ? receipt.customer : receipt.customer?._id || '');
    setBankAccount(typeof receipt.bankAccount === 'string' ? receipt.bankAccount : receipt.bankAccount?._id || '');
    setAmount(receipt.amount || '');
    setDate(receipt.date ? new Date(receipt.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    setMethod(receipt.method || 'BANK_TRANSFER');
    setAllocations({});
    setError('');

    const customerId = typeof receipt.customer === 'string' ? receipt.customer : receipt.customer?._id;
    if (customerId) {
      await loadOpenInvoices(customerId, receipt);
      const initialAllocations = {};
      (receipt.allocations || []).forEach((alloc) => {
        if (alloc.invoice) initialAllocations[alloc.invoice] = alloc.amount;
      });
      setAllocations(initialAllocations);
    } else {
      setOpenInvoices([]);
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingReceipt(null);
    resetForm();
  };

  const allocatedTotal = Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const allocList = Object.entries(allocations).filter(([, v]) => Number(v) > 0).map(([invoice, amt]) => ({ invoice, amount: Number(amt) }));
    try {
      const payload = { customer, bankAccount, amount: Number(amount), date, method, allocations: allocList };
      if (editingReceipt) {
        await api.put(`/receipts/${editingReceipt._id}`, payload);
      } else {
        await api.post('/receipts', payload);
      }
      closeModal();
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save receipt.');
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmAction(() => () => performDelete(id));
    setConfirmOpen(true);
  };

  const performDelete = async (id) => {
    try {
      await api.delete(`/receipts/${id}`);
      load();
      setConfirmOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete receipt.');
    }
  };

  const money = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

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

  return (
    <PageLayout
      title="Receipts"
      actions={canManage && (
        <button onClick={openCreate} className="flex items-center gap-1.5 btn-primary">
          <Plus size={15} /> Record Receipt
        </button>
      )}
    >
      <DataTable columns={columns} data={receipts} />

      <Modal open={modalOpen} onClose={closeModal} title={editingReceipt ? 'Edit Receipt' : 'Record Receipt'}>
        <form onSubmit={save} className="flex flex-col gap-3">
          {error && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Customer</span>
            <select required value={customer} onChange={(e) => { setCustomer(e.target.value); setAllocations({}); if (e.target.value) loadOpenInvoices(e.target.value); else setOpenInvoices([]); }} className="input">
              <option value="">Select…</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Deposit to</span>
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
                <option value="OTHER">Other</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Amount Received</span>
              <input required type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input font-figures" />
            </label>
          </div>

          {openInvoices.length > 0 && (
            <div>
              <span className="block text-xs font-medium text-slate-600 mb-1">Apply against invoices (optional)</span>
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2">
                {openInvoices.map((inv) => (
                  <div key={inv._id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{inv.invoiceNumber} <span className="text-slate-400">({money(inv.grandTotal - inv.amountPaid)} due)</span></span>
                    <input
                      type="number"
                      className="input font-figures w-28 py-1"
                      value={allocations[inv._id] || ''}
                      onChange={(e) => setAllocations({ ...allocations, [inv._id]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1">Allocated: {money(allocatedTotal)} / {money(amount || 0)}</p>
            </div>
          )}

          <button type="submit" className="mt-2 btn-teal">{editingReceipt ? 'Save changes' : 'Save receipt'}</button>
        </form>
      </Modal>

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
    </PageLayout>
  );
}
