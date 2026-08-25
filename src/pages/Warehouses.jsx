import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

const empty = { name: '', location: '', isDefault: false };

export default function Warehouses() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('inventory.manage');
  const [warehouses, setWarehouses] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [detail, setDetail] = useState(null);

  const load = () => api.get('/warehouses').then((res) => setWarehouses(res.data)).catch(() => setLoadError('Could not load warehouses.'));
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(empty); setError(''); setModalOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      await api.post('/warehouses', form);
      setModalOpen(false);
      setForm(empty);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save warehouse.');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
    { key: 'location', label: 'Location' },
    { key: 'isDefault', label: 'Default', render: (r) => (r.isDefault ? '✓' : '') }
  ];

  return (
    <PageLayout
      title="Warehouses"
      actions={canManage && (
        <button onClick={openCreate} className="flex items-center gap-1.5 btn-primary">
          <Plus size={15} /> New Warehouse
        </button>
      )}
    >
      {loadError && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{loadError}</div>}
      <DataTable columns={columns} data={warehouses} onRowClick={setDetail} />

      <Modal open={modalOpen} onClose={() => !submitting && setModalOpen(false)} title="New Warehouse">
        <form onSubmit={save} className="flex flex-col gap-3">
          {error && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Name</span>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Location</span>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="input" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
            Set as default warehouse
          </label>
          <button type="submit" disabled={submitting} className="mt-2 btn-teal disabled:opacity-60">{submitting ? 'Saving…' : 'Create warehouse'}</button>
        </form>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name || 'Warehouse'}>
        {detail && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs">Code</p>
              <p className="font-medium font-figures">{detail.code}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-xs">Default warehouse</p>
              <p className="font-medium">{detail.isDefault ? 'Yes' : 'No'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-slate-500 text-xs">Name</p>
              <p className="font-medium">{detail.name}</p>
            </div>
            <div className="col-span-2">
              <p className="text-slate-500 text-xs">Location</p>
              <p className="font-medium">{detail.location || '—'}</p>
            </div>
          </div>
        )}
      </Modal>
    </PageLayout>
  );
}
