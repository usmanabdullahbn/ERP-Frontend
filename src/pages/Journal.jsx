import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Pencil } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import FilterBar, { matchesSearch, toLocalISODate } from '../components/FilterBar';
import { useAuth } from '../context/AuthContext';
import { formatMoney, todayLocalISODate } from '../components/ui';

const SOURCE_TYPES = ['INVOICE', 'RECEIPT', 'BILL', 'PAYMENT', 'BANK_TRANSFER', 'MANUAL', 'OPENING_BALANCE'];

let lineKeySeq = 0;
const newLine = () => ({ _key: ++lineKeySeq, account: '', debit: 0, credit: 0, memo: '' });

export default function Journal() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  // Set when editing was started from the entry's own page — save returns there.
  const [returnToEntryId, setReturnToEntryId] = useState(null);
  const [date, setDate] = useState(todayLocalISODate());
  const [reference, setReference] = useState('');
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState([newLine(), newLine()]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionError, setActionError] = useState('');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const load = () => api.get('/journal').then((res) => setEntries(res.data)).catch(() => setLoadError('Could not load journal entries.'));
  useEffect(() => {
    load();
    api.get('/accounts').then((res) => setAccounts(res.data)).catch(() => setLoadError('Could not load chart of accounts.'));
  }, []);

  // /journal?edit=<id> comes from the Edit button on the entry page.
  const editParam = searchParams.get('edit');
  useEffect(() => {
    if (!editParam) return;
    setSearchParams({}, { replace: true });
    setReturnToEntryId(editParam);
    openEdit({ _id: editParam }).catch(() => setLoadError('Could not load that journal entry for editing.'));
  }, [editParam]);

  const updateLine = (i, patch) => {
    const next = [...lines];
    next[i] = { ...next[i], ...patch };
    setLines(next);
  };
  const addLine = () => setLines([...lines, newLine()]);
  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;

  const openCreate = () => {
    setEditingEntry(null);
    setDate(todayLocalISODate()); setReference(''); setNarration('');
    setLines([newLine(), newLine()]); setError(''); setModalOpen(true);
  };

  const openEdit = async (entry) => {
    const { data } = await api.get(`/journal/${entry._id}`);
    setEditingEntry(data);
    setDate(data.date ? new Date(data.date).toISOString().slice(0, 10) : todayLocalISODate());
    setReference(data.reference || '');
    setNarration(data.narration || '');
    setLines(data.lines.map((l) => ({
      _key: ++lineKeySeq,
      account: l.account?._id || l.account,
      debit: l.debit || 0,
      credit: l.credit || 0,
      memo: l.memo || ''
    })));
    setError('');
    setModalOpen(true);
  };

  const closeForm = () => {
    if (submitting) return;
    setModalOpen(false);
    if (editingEntry && returnToEntryId === editingEntry._id) navigate(`/journal/${editingEntry._id}`);
  };

  const save = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    if (!balanced) return setError('Debits must equal credits before saving.');
    setSubmitting(true);
    const payload = {
      date, reference, narration,
      lines: lines
        .filter((l) => l.account && (l.debit > 0 || l.credit > 0))
        .map(({ _key, ...l }) => ({ ...l, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 }))
    };
    try {
      if (editingEntry) {
        await api.put(`/journal/${editingEntry._id}`, payload);
      } else {
        await api.post('/journal/manual', payload);
      }
      setModalOpen(false);
      setEditingEntry(null);
      if (editingEntry && returnToEntryId === editingEntry._id) {
        navigate(`/journal/${editingEntry._id}`);
        return;
      }
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save journal entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (entry) => {
    setActionError('');
    setConfirmAction(() => async () => {
      try {
        await api.delete(`/journal/${entry._id}`);
        setConfirmOpen(false);
        load();
      } catch (err) {
        setActionError(err.response?.data?.message || 'Could not delete journal entry.');
        setConfirmOpen(false);
      }
    });
    setConfirmOpen(true);
  };

  const money = formatMoney;

  const filteredEntries = entries.filter((e) => {
    const day = toLocalISODate(e.date);
    return (!sourceFilter || e.sourceType === sourceFilter) &&
      (!accountFilter || (e.lines || []).some((l) => (l.account?._id || l.account) === accountFilter)) &&
      (!statusFilter || (statusFilter === 'reversed' ? e.isReversed : !e.isReversed)) &&
      (!fromDate || day >= fromDate) &&
      (!toDate || day <= toDate) &&
      matchesSearch(search, e.entryNumber, e.reference, e.narration, e.totalDebit,
        ...(e.lines || []).flatMap((l) => [l.memo, l.account?.code, l.account?.name]));
  });
  const hasFilters = !!(search || sourceFilter || accountFilter || statusFilter || fromDate || toDate);
  const clearFilters = () => { setSearch(''); setSourceFilter(''); setAccountFilter(''); setStatusFilter(''); setFromDate(''); setToDate(''); };

  return (
    <PageLayout
      title="General Journal"
      actions={isAdmin && (
        <button onClick={openCreate} className="flex items-center gap-1.5 btn-primary">
          <Plus size={15} /> Manual Entry
        </button>
      )}
    >
      {loadError && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{loadError}</div>}
      {actionError && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{actionError}</div>}
      <FilterBar search={search} onSearch={setSearch} placeholder="Search entry #, reference, narration, account…" showClear={hasFilters} onClear={clearFilters}>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="input w-auto">
          <option value="">All sources</option>
          {SOURCE_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
        </select>
        <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} className="input w-auto max-w-[220px]">
          <option value="">All accounts</option>
          {accounts.map((a) => <option key={a._id} value={a._id}>{a.code} — {a.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-auto">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="reversed">Reversed</option>
        </select>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input w-auto" title="From date" />
        <span className="text-xs text-slate-400">to</span>
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input w-auto" title="To date" />
      </FilterBar>
      <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Entry #</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Reference</th><th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th>
              {isAdmin && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map((e) => (
              <tr key={e._id} onClick={() => navigate(`/journal/${e._id}`)} className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50">
                <td className="px-4 py-3">{e.entryNumber}{e.isReversed && <span className="ml-1 text-xs text-ledger-rose">(reversed)</span>}</td>
                <td className="px-4 py-3">{new Date(e.date).toLocaleDateString()}</td>
                <td className="px-4 py-3">{e.sourceType}</td>
                <td className="px-4 py-3">{e.reference}</td>
                <td className="px-4 py-3 text-right font-figures">{money(e.totalDebit)}</td>
                <td className="px-4 py-3 text-right font-figures">{money(e.totalCredit)}</td>
                {isAdmin && (
                  <td className="px-4 py-3" onClick={(ev) => ev.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(e)}
                        className="inline-flex items-center justify-center rounded-full border border-slate-200 p-1.5 text-slate-500 hover:text-ink-900 hover:border-slate-300"
                        title="Edit entry"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(e)}
                        className="inline-flex items-center justify-center rounded-full border border-slate-200 p-1.5 text-slate-500 hover:text-rose-600 hover:border-slate-300"
                        title="Delete entry"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {filteredEntries.length === 0 && <tr><td colSpan={isAdmin ? 7 : 6} className="text-center text-slate-400 py-8">{hasFilters ? 'No journal entries match your filters.' : 'No journal entries yet.'}</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={closeForm} title={editingEntry ? `Edit ${editingEntry.entryNumber}` : 'Manual Journal Entry'} width="max-w-2xl">
        <form onSubmit={save} className="flex flex-col gap-3">
          {error && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" /></label>
            <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">Reference</span>
              <input value={reference} onChange={(e) => setReference(e.target.value)} className="input" /></label>
          </div>
          <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">Narration</span>
            <input value={narration} onChange={(e) => setNarration(e.target.value)} className="input" /></label>

          <div className="flex flex-col gap-2">
            {lines.map((line, i) => (
              <div key={line._key} className="grid grid-cols-12 gap-2 items-end">
                <select value={line.account} onChange={(e) => updateLine(i, { account: e.target.value })} className="input col-span-5">
                  <option value="">Account…</option>
                  {accounts.map((a) => <option key={a._id} value={a._id}>{a.code} — {a.name}</option>)}
                </select>
                <input type="number" min="0" placeholder="Debit" value={line.debit} onChange={(e) => updateLine(i, { debit: e.target.value, credit: 0 })} className="input font-figures col-span-3" />
                <input type="number" min="0" placeholder="Credit" value={line.credit} onChange={(e) => updateLine(i, { credit: e.target.value, debit: 0 })} className="input font-figures col-span-3" />
                <button type="button" onClick={() => removeLine(i)} className="text-slate-400 hover:text-ledger-rose col-span-1 flex justify-center"><Trash2 size={16} /></button>
              </div>
            ))}
            <button type="button" onClick={addLine} className="text-xs text-ledger-teal hover:underline self-start">+ Add line</button>
          </div>

          <div className={`flex justify-end gap-6 text-sm pt-2 border-t border-slate-200 ${balanced ? '' : 'text-ledger-rose'}`}>
            <span>Total Debit <span className="font-figures ml-2">{money(totalDebit)}</span></span>
            <span>Total Credit <span className="font-figures ml-2">{money(totalCredit)}</span></span>
          </div>

          <button type="submit" className="mt-2 btn-teal disabled:opacity-50" disabled={!balanced || submitting}>
            {submitting ? 'Saving…' : editingEntry ? 'Save changes' : 'Post entry'}
          </button>
        </form>
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        title="Delete Journal Entry"
        message="Delete this journal entry? This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={confirmAction}
        onCancel={() => setConfirmOpen(false)}
      />
    </PageLayout>
  );
}
