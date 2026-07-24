import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

const TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];
const NORMAL = { ASSET: 'debit', EXPENSE: 'debit', LIABILITY: 'credit', EQUITY: 'credit', INCOME: 'credit' };

export default function ChartOfAccounts() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('accounting.manage');
  const [accounts, setAccounts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', type: 'ASSET', subType: '', description: '' });
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState('');

  const load = () => api.get('/accounts').then((res) => setAccounts(res.data));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/accounts', { ...form, normalBalance: NORMAL[form.type] });
      setModalOpen(false);
      setForm({ code: '', name: '', type: 'ASSET', subType: '', description: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create account.');
    }
  };

  const filtered = filterType ? accounts.filter((a) => a.type === filterType) : accounts;

  const columns = [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type' },
    { key: 'subType', label: 'Sub Type' },
    { key: 'normalBalance', label: 'Normal Balance' },
    { key: 'isSystem', label: 'System', render: (r) => (r.isSystem ? '🔒' : '') }
  ];

  return (
    <PageLayout
      title="Chart of Accounts"
      actions={canManage && (
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-1.5 btn-primary">
          <Plus size={15} /> New Account
        </button>
      )}
    >
      <div className="flex gap-2 mb-4">
        <button onClick={() => setFilterType('')} className={`px-3 py-1.5 rounded-lg text-xs ${!filterType ? 'bg-ink-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>All</button>
        {TYPES.map((t) => (
          <button key={t} onClick={() => setFilterType(t)} className={`px-3 py-1.5 rounded-lg text-xs ${filterType === t ? 'bg-ink-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{t}</button>
        ))}
      </div>

      <DataTable columns={columns} data={filtered} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Account">
        <form onSubmit={save} className="flex flex-col gap-3">
          {error && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">Code</span>
              <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="input font-figures" /></label>
            <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">Type</span>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select></label>
          </div>
          <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">Name</span>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" /></label>
          <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">Sub Type</span>
            <input value={form.subType} onChange={(e) => setForm({ ...form, subType: e.target.value })} className="input" /></label>
          <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">Description</span>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" rows={2} /></label>
          <button type="submit" className="mt-2 btn-teal">Create account</button>
        </form>
      </Modal>
    </PageLayout>
  );
}
