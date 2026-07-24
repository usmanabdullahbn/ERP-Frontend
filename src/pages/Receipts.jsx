import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

export default function Receipts() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('sales.manage');

  const [receipts, setReceipts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [openInvoices, setOpenInvoices] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [customer, setCustomer] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [allocations, setAllocations] = useState({});
  const [error, setError] = useState('');

  const load = () => api.get('/receipts').then((res) => setReceipts(res.data));

  useEffect(() => {
    load();
    api.get('/customers').then((res) => setCustomers(res.data));
    api.get('/bank/accounts').then((res) => setBankAccounts(res.data));
  }, []);

  useEffect(() => {
    if (customer) {
      api.get(`/invoices?customer=${customer}`).then((res) => {
        setOpenInvoices(res.data.filter((i) => ['POSTED', 'PARTIALLY_PAID'].includes(i.status)));
        setAllocations({});
      });
    } else {
      setOpenInvoices([]);
    }
  }, [customer]);

  const openCreate = () => {
    setCustomer(''); setBankAccount(''); setAmount(''); setDate(new Date().toISOString().slice(0, 10));
    setMethod('BANK_TRANSFER'); setAllocations({}); setError(''); setModalOpen(true);
  };

  const allocatedTotal = Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const allocList = Object.entries(allocations).filter(([, v]) => Number(v) > 0).map(([invoice, amt]) => ({ invoice, amount: Number(amt) }));
    try {
      await api.post('/receipts', { customer, bankAccount, amount: Number(amount), date, method, allocations: allocList });
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save receipt.');
    }
  };

  const money = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

  const columns = [
    { key: 'receiptNumber', label: 'Receipt #' },
    { key: 'customer', label: 'Customer', render: (r) => r.customer?.name },
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'bankAccount', label: 'Deposited to', render: (r) => r.bankAccount?.name },
    { key: 'amount', label: 'Amount', align: 'right', mono: true, render: (r) => money(r.amount) },
    { key: 'method', label: 'Method' }
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record Receipt">
        <form onSubmit={save} className="flex flex-col gap-3">
          {error && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Customer</span>
            <select required value={customer} onChange={(e) => setCustomer(e.target.value)} className="input">
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

          <button type="submit" className="mt-2 btn-teal">Save receipt</button>
        </form>
      </Modal>
    </PageLayout>
  );
}
