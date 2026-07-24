import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

export default function Payments() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('purchases.manage');

  const [payments, setPayments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [openBills, setOpenBills] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [allocations, setAllocations] = useState({});
  const [error, setError] = useState('');

  const load = () => api.get('/payments').then((res) => setPayments(res.data));

  useEffect(() => {
    load();
    api.get('/suppliers').then((res) => setSuppliers(res.data));
    api.get('/bank/accounts').then((res) => setBankAccounts(res.data));
  }, []);

  useEffect(() => {
    if (supplier) {
      api.get(`/bills?supplier=${supplier}`).then((res) => {
        setOpenBills(res.data.filter((b) => ['POSTED', 'PARTIALLY_PAID'].includes(b.status)));
        setAllocations({});
      });
    } else {
      setOpenBills([]);
    }
  }, [supplier]);

  const openCreate = () => {
    setSupplier(''); setBankAccount(''); setAmount(''); setDate(new Date().toISOString().slice(0, 10));
    setMethod('BANK_TRANSFER'); setAllocations({}); setError(''); setModalOpen(true);
  };

  const allocatedTotal = Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const allocList = Object.entries(allocations).filter(([, v]) => Number(v) > 0).map(([bill, amt]) => ({ bill, amount: Number(amt) }));
    try {
      await api.post('/payments', { supplier, bankAccount, amount: Number(amount), date, method, allocations: allocList });
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save payment.');
    }
  };

  const money = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

  const columns = [
    { key: 'paymentNumber', label: 'Payment #' },
    { key: 'supplier', label: 'Supplier', render: (r) => r.supplier?.name },
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'bankAccount', label: 'Paid from', render: (r) => r.bankAccount?.name },
    { key: 'amount', label: 'Amount', align: 'right', mono: true, render: (r) => money(r.amount) },
    { key: 'method', label: 'Method' }
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record Payment">
        <form onSubmit={save} className="flex flex-col gap-3">
          {error && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Supplier</span>
            <select required value={supplier} onChange={(e) => setSupplier(e.target.value)} className="input">
              <option value="">Select…</option>
              {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </label>
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

          <button type="submit" className="mt-2 btn-teal">Save payment</button>
        </form>
      </Modal>
    </PageLayout>
  );
}
