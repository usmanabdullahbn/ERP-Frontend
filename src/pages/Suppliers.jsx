import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import { useAuth } from '../context/AuthContext';

const empty = { name: '', email: '', phone: '', address: '', taxNumber: '', openingBalance: 0 };

export default function Suppliers() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('purchases.manage');
  const [suppliers, setSuppliers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [statementFor, setStatementFor] = useState(null);
  const [statement, setStatement] = useState(null);

  const load = () => api.get('/suppliers').then((res) => setSuppliers(res.data));
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(empty); setError(''); setModalOpen(true); };
  const openEdit = (s) => { setEditing(s); setForm(s); setError(''); setModalOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) await api.put(`/suppliers/${editing._id}`, form);
      else await api.post('/suppliers', form);
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save supplier.');
    }
  };

  const openStatement = async (s) => {
    setStatementFor(s);
    const { data } = await api.get(`/suppliers/${s._id}/statement`);
    setStatement(data);
  };

  const money = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

  const columns = [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'openingBalance', label: 'Opening Bal.', align: 'right', mono: true, render: (r) => money(r.openingBalance) },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} /> }
  ];

  return (
    <PageLayout
      title="Suppliers"
      actions={canManage && (
        <button onClick={openCreate} className="flex items-center gap-1.5 btn-primary">
          <Plus size={15} /> New Supplier
        </button>
      )}
    >
      <DataTable columns={columns} data={suppliers} onRowClick={openStatement} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Supplier' : 'New Supplier'}>
        <form onSubmit={save} className="flex flex-col gap-3">
          {error && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
          <Field label="Name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" /></Field>
            <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" /></Field>
          </div>
          <Field label="Address"><textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input" rows={2} /></Field>
          <Field label="Tax Number"><input value={form.taxNumber} onChange={(e) => setForm({ ...form, taxNumber: e.target.value })} className="input" /></Field>
          {!editing && (
            <Field label="Opening Balance (amount you owe them)">
              <input type="number" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: Number(e.target.value) })} className="input font-figures" />
            </Field>
          )}
          <button type="submit" className="mt-2 btn-teal">
            {editing ? 'Save changes' : 'Create supplier'}
          </button>
        </form>
      </Modal>

      <Modal open={!!statementFor} onClose={() => setStatementFor(null)} title={`Statement — ${statementFor?.name || ''}`} width="max-w-2xl">
        {statement && (
          <div>
            <div className="flex justify-between text-sm mb-3">
              <span className="text-slate-500">Opening balance</span>
              <span className="font-figures">{money(statement.openingBalance)}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                  <th className="py-2">Date</th><th>Type</th><th>Ref</th>
                  <th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {statement.entries.map((e, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2">{new Date(e.date).toLocaleDateString()}</td>
                    <td>{e.type}</td>
                    <td>{e.ref}</td>
                    <td className="text-right font-figures">{e.debit ? money(e.debit) : ''}</td>
                    <td className="text-right font-figures">{e.credit ? money(e.credit) : ''}</td>
                    <td className="text-right font-figures font-medium">{money(e.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between text-sm mt-3 pt-3 border-t border-slate-200 font-medium">
              <span>Closing balance</span>
              <span className="font-figures">{money(statement.closingBalance)}</span>
            </div>
          </div>
        )}
      </Modal>
    </PageLayout>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}
