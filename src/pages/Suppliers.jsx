import { useEffect, useState } from 'react';
import { Plus, Pencil, Printer, Trash2 } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Badge from '../components/Badge';
import { useAuth } from '../context/AuthContext';
import { formatMoney } from '../components/ui';

const empty = { name: '', email: '', phone: '', address: '', taxNumber: '', openingBalance: 0 };

export default function Suppliers() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('purchases.manage');
  const [suppliers, setSuppliers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [statementFor, setStatementFor] = useState(null);
  const [statement, setStatement] = useState(null);
  const [statementFrom, setStatementFrom] = useState('');
  const [statementTo, setStatementTo] = useState('');

  const load = () => api.get('/suppliers').then((res) => setSuppliers(res.data)).catch(() => setLoadError('Could not load suppliers.'));
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(empty); setError(''); setModalOpen(true); };
  const openEdit = (s) => { setEditing(s); setForm(s); setError(''); setModalOpen(true); };

  const loadStatement = async (supplier, from, to) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);

    const { data } = await api.get(
      `/suppliers/${supplier._id}/statement${params.toString() ? `?${params.toString()}` : ''}`
    );
    setStatement(data);
  };

  const openStatement = async (s) => {
    setStatementFor(s);
    setStatementFrom('');
    setStatementTo('');
    await loadStatement(s, '', '');
  };

  const handleStatementFromChange = async (value) => {
    setStatementFrom(value);
    if (statementFor) await loadStatement(statementFor, value, statementTo);
  };

  const handleStatementToChange = async (value) => {
    setStatementTo(value);
    if (statementFor) await loadStatement(statementFor, statementFrom, value);
  };

  const printStatement = () => {
    window.print();
  };

  const removeSupplier = async (supplier) => {
    setConfirmMessage(`Delete supplier ${supplier.name}? This cannot be undone.`);
    setConfirmAction(() => () => performRemoveSupplier(supplier._id));
    setConfirmOpen(true);
  };

  const performRemoveSupplier = async (id) => {
    try {
      await api.delete(`/suppliers/${id}`);
      setConfirmOpen(false);
      load();
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Could not delete supplier.');
      setConfirmOpen(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      if (editing) await api.put(`/suppliers/${editing._id}`, form);
      else await api.post('/suppliers', form);
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save supplier.');
    } finally {
      setSubmitting(false);
    }
  };

  const money = formatMoney;

  const columns = [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'openingBalance', label: 'Opening Bal.', align: 'right', mono: true, render: (r) => money(r.openingBalance) },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
    { key: 'actions', label: '', align: 'right', render: (r) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openEdit(r); }}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-500 hover:text-ink-900 hover:border-slate-300"
            title="Edit supplier"
          >
            <Pencil size={16} />
          </button>
          {canManage && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeSupplier(r); }}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-500 hover:text-rose-600 hover:border-rose-200"
              title="Delete supplier"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )
    }
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
      {loadError && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{loadError}</div>}
      <DataTable columns={columns} data={suppliers} onRowClick={openStatement} />

      <ConfirmModal
        open={confirmOpen}
        title="Delete Supplier"
        message={confirmMessage}
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (confirmAction) confirmAction();
        }}
      />

      <Modal open={modalOpen} onClose={() => !submitting && setModalOpen(false)} title={editing ? 'Edit Supplier' : 'New Supplier'}>
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
              <input type="number" min="0" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: Number(e.target.value) })} className="input font-figures" />
            </Field>
          )}
          <button type="submit" disabled={submitting} className="mt-2 btn-teal disabled:opacity-60">
            {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create supplier'}
          </button>
        </form>
      </Modal>

      <Modal open={!!statementFor} onClose={() => setStatementFor(null)} title={`Statement — ${statementFor?.name || ''}`} width="max-w-2xl">
        {statement && (
          <div className="print-area">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4 print:hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                <Field label="From">
                  <input
                    type="date"
                    value={statementFrom}
                    onChange={(e) => void handleStatementFromChange(e.target.value)}
                    className="input"
                  />
                </Field>
                <Field label="To">
                  <input
                    type="date"
                    value={statementTo}
                    onChange={(e) => void handleStatementToChange(e.target.value)}
                    className="input"
                  />
                </Field>
              </div>
              <button
                type="button"
                onClick={printStatement}
                className="btn-ghost inline-flex items-center gap-2 self-start whitespace-nowrap"
              >
                <Printer size={16} /> Print
              </button>
            </div>
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
