import { useEffect, useState } from 'react';
import { Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { formatMoney, todayLocalISODate } from '../components/ui';

export default function Receipts() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('sales.manage');

  const [receipts, setReceipts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [openInvoices, setOpenInvoices] = useState([]);
  const [loadError, setLoadError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [customer, setCustomer] = useState('');
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

  const load = () => api.get('/receipts').then((res) => setReceipts(res.data)).catch(() => setLoadError('Could not load receipts.'));

  useEffect(() => {
    load();
    api.get('/customers').then((res) => setCustomers(res.data)).catch(() => setLoadError('Could not load customers.'));
    api.get('/bank/accounts').then((res) => setBankAccounts(res.data)).catch(() => setLoadError('Could not load bank accounts.'));
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

  useEffect(() => {
    if (!editingReceipt && !allocationsTouched && amount && openInvoices.length > 0) {
      setAllocations(autoAllocateInvoices(amount, openInvoices));
    }
  }, [amount, openInvoices, editingReceipt, allocationsTouched]);

  const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

  const autoAllocateInvoices = (amt, invoices) => {
    const amountValue = round2(Number(amt) || 0);
    const allocations = {};
    let remaining = amountValue;
    invoices.forEach((invoice) => {
      if (remaining <= 0) return;
      const due = round2(Number(invoice.grandTotal) - Number(invoice.amountPaid));
      if (due <= 0) return;
      const alloc = Math.min(remaining, due);
      if (alloc > 0) {
        allocations[invoice._id] = alloc;
        remaining = round2(remaining - alloc);
      }
    });
    return allocations;
  };

  const resetForm = () => {
    setCustomer('');
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
    setEditingReceipt(null);
    resetForm();
    setModalOpen(true);
  };

  const openEdit = async (receipt) => {
    setEditingReceipt(receipt);
    setCustomer(typeof receipt.customer === 'string' ? receipt.customer : receipt.customer?._id || '');
    setBankAccount(typeof receipt.bankAccount === 'string' ? receipt.bankAccount : receipt.bankAccount?._id || '');
    setAmount(receipt.amount || '');
    setReference(receipt.reference || '');
    setDate(receipt.date ? new Date(receipt.date).toISOString().slice(0, 10) : todayLocalISODate());
    setMethod(receipt.method || 'BANK_TRANSFER');
    setAllocations({});
    setAllocationsTouched(true);
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

  const openDetail = async (receipt) => {
    setDetailError('');
    const { data } = await api.get(`/receipts/${receipt._id}`);
    setDetail(data);
  };

  const allocatedTotal = Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0);

  const save = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    const allocList = Object.entries(allocations).filter(([, v]) => Number(v) > 0).map(([invoice, amt]) => ({ invoice, amount: Number(amt) }));
    setSubmitting(true);
    try {
      const payload = { customer, bankAccount, amount: Number(amount), reference, date, method, allocations: allocList };
      if (editingReceipt) {
        await api.put(`/receipts/${editingReceipt._id}`, payload);
      } else {
        await api.post('/receipts', payload);
      }
      closeModal();
      setDetail(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save receipt.');
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
      await api.delete(`/receipts/${id}`);
      if (detail?._id === id) setDetail(null);
      load();
      setConfirmOpen(false);
    } catch (err) {
      const message = err.response?.data?.message || 'Could not delete receipt.';
      setError(message);
      setDetailError(message);
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

  return (
    <PageLayout
      title="Receipts"
      actions={canManage && (
        <button onClick={openCreate} className="flex items-center gap-1.5 btn-primary">
          <Plus size={15} /> Record Receipt
        </button>
      )}
    >
      {loadError && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{loadError}</div>}
      <DataTable columns={columns} data={receipts} onRowClick={openDetail} />

      <Modal open={modalOpen} onClose={() => !submitting && closeModal()} title={editingReceipt ? 'Edit Receipt' : 'Record Receipt'}>
        <form onSubmit={save} className="flex flex-col gap-3">
          {error && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Customer</span>
            <select required value={customer} onChange={(e) => { setCustomer(e.target.value); setAllocations({}); setAllocationsTouched(false); if (e.target.value) loadOpenInvoices(e.target.value); else setOpenInvoices([]); }} className="input">
              <option value="">Select…</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Ref</span>
              <input value={reference} onChange={(e) => setReference(e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Deposit to</span>
              <select required value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className="input">
                <option value="">Select…</option>
                {bankAccounts.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Amount Received</span>
              <input required type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="input font-figures" />
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
                      min="0"
                      className="input font-figures w-28 py-1"
                      value={allocations[inv._id] || ''}
                      onChange={(e) => { setAllocationsTouched(true); setAllocations({ ...allocations, [inv._id]: e.target.value }); }}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1">Allocated: {money(allocatedTotal)} / {money(amount || 0)}</p>
            </div>
          )}

          <button type="submit" disabled={submitting} className="mt-2 btn-teal disabled:opacity-60">{submitting ? 'Saving…' : editingReceipt ? 'Save changes' : 'Save receipt'}</button>
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

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Receipt ${detail?.receiptNumber || ''}`} width="max-w-xl">
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
                  </tr>
                </thead>
                <tbody>
                  {detail.allocations.map((alloc, i) => (
                    <tr key={alloc.invoice?._id || i} className="border-b border-slate-100">
                      <td className="py-2">{alloc.invoice?.invoiceNumber || 'Unallocated'}</td>
                      <td className="text-right font-figures">{money(alloc.amount)}</td>
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
