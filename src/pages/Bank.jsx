import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

export default function Bank() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('banking.manage');

  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [glAccounts, setGlAccounts] = useState([]);
  const [tab, setTab] = useState('accounts');

  const [acctModal, setAcctModal] = useState(false);
  const [acctForm, setAcctForm] = useState({ name: '', accountNumber: '', bankName: '', type: 'BANK', openingBalance: 0 });

  const [txnModal, setTxnModal] = useState(false);
  const [txnForm, setTxnForm] = useState({ bankAccount: '', date: new Date().toISOString().slice(0, 10), type: 'DEPOSIT', amount: '', contraAccount: '', toBankAccount: '', reference: '', notes: '' });

  const [error, setError] = useState('');

  const load = () => {
    api.get('/bank/accounts').then((res) => setAccounts(res.data));
    api.get('/bank/transactions').then((res) => setTransactions(res.data));
  };
  useEffect(() => {
    load();
    api.get('/accounts').then((res) => setGlAccounts(res.data.filter((a) => a.subType !== 'Bank' && a.subType !== 'Cash')));
  }, []);

  const saveAccount = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/bank/accounts', acctForm);
      setAcctModal(false);
      setAcctForm({ name: '', accountNumber: '', bankName: '', type: 'BANK', openingBalance: 0 });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save bank account.');
    }
  };

  const saveTxn = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/bank/transactions', { ...txnForm, amount: Number(txnForm.amount) });
      setTxnModal(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save transaction.');
    }
  };

  const money = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

  const acctColumns = [
    { key: 'name', label: 'Name' },
    { key: 'bankName', label: 'Bank' },
    { key: 'accountNumber', label: 'Account No.' },
    { key: 'type', label: 'Type' },
    { key: 'openingBalance', label: 'Opening Bal.', align: 'right', mono: true, render: (r) => money(r.openingBalance) }
  ];

  const txnColumns = [
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'bankAccount', label: 'Account', render: (r) => r.bankAccount?.name },
    { key: 'type', label: 'Type' },
    { key: 'toBankAccount', label: 'To', render: (r) => r.toBankAccount?.name || r.contraAccount?.name || '' },
    { key: 'amount', label: 'Amount', align: 'right', mono: true, render: (r) => money(r.amount) },
    { key: 'reference', label: 'Reference' }
  ];

  return (
    <PageLayout
      title="Banking"
      actions={canManage && (
        tab === 'accounts'
          ? <button onClick={() => setAcctModal(true)} className="flex items-center gap-1.5 btn-primary"><Plus size={15} /> New Bank Account</button>
          : <button onClick={() => setTxnModal(true)} className="flex items-center gap-1.5 btn-primary"><Plus size={15} /> New Transaction</button>
      )}
    >
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('accounts')} className={`px-3 py-1.5 rounded-lg text-sm ${tab === 'accounts' ? 'bg-ink-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>Accounts</button>
        <button onClick={() => setTab('transactions')} className={`px-3 py-1.5 rounded-lg text-sm ${tab === 'transactions' ? 'bg-ink-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>Transactions</button>
      </div>

      {tab === 'accounts' ? <DataTable columns={acctColumns} data={accounts} /> : <DataTable columns={txnColumns} data={transactions} />}

      <Modal open={acctModal} onClose={() => setAcctModal(false)} title="New Bank Account">
        <form onSubmit={saveAccount} className="flex flex-col gap-3">
          {error && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
          <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">Name</span>
            <input required value={acctForm.name} onChange={(e) => setAcctForm({ ...acctForm, name: e.target.value })} className="input" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">Bank Name</span>
              <input value={acctForm.bankName} onChange={(e) => setAcctForm({ ...acctForm, bankName: e.target.value })} className="input" /></label>
            <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">Account Number</span>
              <input value={acctForm.accountNumber} onChange={(e) => setAcctForm({ ...acctForm, accountNumber: e.target.value })} className="input" /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">Type</span>
              <select value={acctForm.type} onChange={(e) => setAcctForm({ ...acctForm, type: e.target.value })} className="input">
                <option value="BANK">Bank</option>
                <option value="CASH">Cash</option>
              </select></label>
            <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">Opening Balance</span>
              <input type="number" value={acctForm.openingBalance} onChange={(e) => setAcctForm({ ...acctForm, openingBalance: Number(e.target.value) })} className="input font-figures" /></label>
          </div>
          <button type="submit" className="mt-2 btn-teal">Create bank account</button>
        </form>
      </Modal>

      <Modal open={txnModal} onClose={() => setTxnModal(false)} title="New Bank Transaction">
        <form onSubmit={saveTxn} className="flex flex-col gap-3">
          {error && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">From Account</span>
              <select required value={txnForm.bankAccount} onChange={(e) => setTxnForm({ ...txnForm, bankAccount: e.target.value })} className="input">
                <option value="">Select…</option>
                {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select></label>
            <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">Type</span>
              <select value={txnForm.type} onChange={(e) => setTxnForm({ ...txnForm, type: e.target.value })} className="input">
                <option value="DEPOSIT">Deposit</option>
                <option value="WITHDRAWAL">Withdrawal</option>
                <option value="TRANSFER">Transfer</option>
              </select></label>
          </div>
          {txnForm.type === 'TRANSFER' ? (
            <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">To Account</span>
              <select required value={txnForm.toBankAccount} onChange={(e) => setTxnForm({ ...txnForm, toBankAccount: e.target.value })} className="input">
                <option value="">Select…</option>
                {accounts.filter((a) => a._id !== txnForm.bankAccount).map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select></label>
          ) : (
            <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">{txnForm.type === 'DEPOSIT' ? 'Income Account' : 'Expense Account'}</span>
              <select required value={txnForm.contraAccount} onChange={(e) => setTxnForm({ ...txnForm, contraAccount: e.target.value })} className="input">
                <option value="">Select…</option>
                {glAccounts.map((a) => <option key={a._id} value={a._id}>{a.code} — {a.name}</option>)}
              </select></label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">Date</span>
              <input type="date" value={txnForm.date} onChange={(e) => setTxnForm({ ...txnForm, date: e.target.value })} className="input" /></label>
            <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">Amount</span>
              <input required type="number" value={txnForm.amount} onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })} className="input font-figures" /></label>
          </div>
          <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">Reference / Notes</span>
            <input value={txnForm.reference} onChange={(e) => setTxnForm({ ...txnForm, reference: e.target.value, notes: e.target.value })} className="input" /></label>
          <button type="submit" className="mt-2 btn-teal">Save transaction</button>
        </form>
      </Modal>
    </PageLayout>
  );
}
