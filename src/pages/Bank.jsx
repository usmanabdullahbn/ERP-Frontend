import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { formatMoney, todayLocalISODate } from '../components/ui';

const emptyAcctForm = { name: '', accountNumber: '', bankName: '', type: 'BANK', openingBalance: 0 };
const emptyTxnForm = () => ({ bankAccount: '', date: todayLocalISODate(), type: 'DEPOSIT', amount: '', contraAccount: '', toBankAccount: '', reference: '', notes: '' });

export default function Bank() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('banking.manage');

  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [glAccounts, setGlAccounts] = useState([]);
  const [tab, setTab] = useState('accounts');
  const [loadError, setLoadError] = useState('');

  const [acctModal, setAcctModal] = useState(false);
  const [acctForm, setAcctForm] = useState(emptyAcctForm);
  const [acctError, setAcctError] = useState('');
  const [acctSubmitting, setAcctSubmitting] = useState(false);

  const [txnModal, setTxnModal] = useState(false);
  const [txnForm, setTxnForm] = useState(emptyTxnForm());
  const [txnError, setTxnError] = useState('');
  const [txnSubmitting, setTxnSubmitting] = useState(false);

  const [acctDetail, setAcctDetail] = useState(null);
  const [txnDetail, setTxnDetail] = useState(null);

  const load = () => {
    api.get('/bank/accounts').then((res) => setAccounts(res.data)).catch(() => setLoadError('Could not load bank accounts.'));
    api.get('/bank/transactions').then((res) => setTransactions(res.data)).catch(() => setLoadError('Could not load transactions.'));
  };
  useEffect(() => {
    load();
    api.get('/accounts').then((res) => setGlAccounts(res.data.filter((a) => a.subType !== 'Bank' && a.subType !== 'Cash'))).catch(() => setLoadError('Could not load chart of accounts.'));
  }, []);

  const openAcctModal = () => { setAcctForm(emptyAcctForm); setAcctError(''); setAcctModal(true); };
  const openTxnModal = () => { setTxnForm(emptyTxnForm()); setTxnError(''); setTxnModal(true); };

  const saveAccount = async (e) => {
    e.preventDefault();
    if (acctSubmitting) return;
    setAcctError('');
    setAcctSubmitting(true);
    try {
      await api.post('/bank/accounts', acctForm);
      setAcctModal(false);
      setAcctForm(emptyAcctForm);
      load();
    } catch (err) {
      setAcctError(err.response?.data?.message || 'Could not save bank account.');
    } finally {
      setAcctSubmitting(false);
    }
  };

  const saveTxn = async (e) => {
    e.preventDefault();
    if (txnSubmitting) return;
    setTxnError('');
    setTxnSubmitting(true);
    try {
      await api.post('/bank/transactions', { ...txnForm, amount: Number(txnForm.amount) });
      setTxnModal(false);
      setTxnForm(emptyTxnForm());
      load();
    } catch (err) {
      setTxnError(err.response?.data?.message || 'Could not save transaction.');
    } finally {
      setTxnSubmitting(false);
    }
  };

  const money = formatMoney;

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
          ? <button onClick={openAcctModal} className="flex items-center gap-1.5 btn-primary"><Plus size={15} /> New Bank Account</button>
          : <button onClick={openTxnModal} className="flex items-center gap-1.5 btn-primary"><Plus size={15} /> New Transaction</button>
      )}
    >
      {loadError && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{loadError}</div>}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('accounts')} className={`px-3 py-1.5 rounded-lg text-sm ${tab === 'accounts' ? 'bg-ink-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>Accounts</button>
        <button onClick={() => setTab('transactions')} className={`px-3 py-1.5 rounded-lg text-sm ${tab === 'transactions' ? 'bg-ink-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>Transactions</button>
      </div>

      {tab === 'accounts'
        ? <DataTable columns={acctColumns} data={accounts} onRowClick={setAcctDetail} />
        : <DataTable columns={txnColumns} data={transactions} onRowClick={setTxnDetail} />}

      <Modal open={acctModal} onClose={() => !acctSubmitting && setAcctModal(false)} title="New Bank Account">
        <form onSubmit={saveAccount} className="flex flex-col gap-3">
          {acctError && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{acctError}</div>}
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
          <button type="submit" disabled={acctSubmitting} className="mt-2 btn-teal disabled:opacity-60">{acctSubmitting ? 'Saving…' : 'Create bank account'}</button>
        </form>
      </Modal>

      <Modal open={txnModal} onClose={() => !txnSubmitting && setTxnModal(false)} title="New Bank Transaction">
        <form onSubmit={saveTxn} className="flex flex-col gap-3">
          {txnError && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{txnError}</div>}
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
              <input required type="number" min="0" value={txnForm.amount} onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })} className="input font-figures" /></label>
          </div>
          <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">Reference / Notes</span>
            <input value={txnForm.reference} onChange={(e) => setTxnForm({ ...txnForm, reference: e.target.value, notes: e.target.value })} className="input" /></label>
          <button type="submit" disabled={txnSubmitting} className="mt-2 btn-teal disabled:opacity-60">{txnSubmitting ? 'Saving…' : 'Save transaction'}</button>
        </form>
      </Modal>

      <Modal open={!!acctDetail} onClose={() => setAcctDetail(null)} title={acctDetail?.name || 'Bank Account'} width="max-w-2xl">
        {acctDetail && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 text-xs">Bank</p>
                <p className="font-medium">{acctDetail.bankName || '—'}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500 text-xs">Account Number</p>
                <p className="font-medium font-figures">{acctDetail.accountNumber || '—'}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Type</p>
                <p className="font-medium">{acctDetail.type}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500 text-xs">Opening Balance</p>
                <p className="font-medium font-figures">{money(acctDetail.openingBalance)}</p>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3">
              <p className="text-xs font-medium text-slate-600 mb-2">Recent transactions</p>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-600 border-b-2 border-slate-300">
                    <th className="py-2 font-semibold">Date</th>
                    <th className="font-semibold">Type</th>
                    <th className="font-semibold">To</th>
                    <th className="text-right font-semibold">Amount</th>
                    <th className="font-semibold">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.filter((t) => (t.bankAccount?._id || t.bankAccount) === acctDetail._id).map((t) => (
                    <tr key={t._id} className="border-b border-slate-100">
                      <td className="py-2">{new Date(t.date).toLocaleDateString()}</td>
                      <td>{t.type}</td>
                      <td>{t.toBankAccount?.name || t.contraAccount?.name || ''}</td>
                      <td className="text-right font-figures">{money(t.amount)}</td>
                      <td>{t.reference}</td>
                    </tr>
                  ))}
                  {transactions.filter((t) => (t.bankAccount?._id || t.bankAccount) === acctDetail._id).length === 0 && (
                    <tr><td colSpan={5} className="text-center text-slate-400 py-6">No transactions yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!txnDetail} onClose={() => setTxnDetail(null)} title="Bank Transaction">
        {txnDetail && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs">Date</p>
              <p className="font-medium">{new Date(txnDetail.date).toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-xs">Type</p>
              <p className="font-medium">{txnDetail.type}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Account</p>
              <p className="font-medium">{txnDetail.bankAccount?.name}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-xs">{txnDetail.type === 'TRANSFER' ? 'To Account' : 'Contra Account'}</p>
              <p className="font-medium">{txnDetail.toBankAccount?.name || txnDetail.contraAccount?.name || '—'}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Amount</p>
              <p className="font-medium font-figures">{money(txnDetail.amount)}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-xs">Reference</p>
              <p className="font-medium">{txnDetail.reference || '—'}</p>
            </div>
          </div>
        )}
      </Modal>
    </PageLayout>
  );
}
