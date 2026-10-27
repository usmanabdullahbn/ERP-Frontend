import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Pencil } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import ConfirmModal from '../components/ConfirmModal';
import JournalEntryForm from '../components/JournalEntryForm';
import FilterBar, { matchesSearch, toLocalISODate } from '../components/FilterBar';
import { useAuth } from '../context/AuthContext';
import { formatMoney } from '../components/ui';

const SOURCE_TYPES = ['INVOICE', 'RECEIPT', 'BILL', 'PAYMENT', 'BANK_TRANSFER', 'MANUAL', 'OPENING_BALANCE', 'OPENING_STOCK', 'STOCK_ADJUSTMENT'];

export default function Journal() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
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

  const openCreate = () => {
    setEditingEntry(null);
    setFormOpen(true);
  };

  const openEdit = async (entry) => {
    setActionError('');
    try {
      const { data } = await api.get(`/journal/${entry._id}`);
      setEditingEntry(data);
      setFormOpen(true);
    } catch {
      setActionError('Could not load that journal entry for editing.');
    }
  };

  const handleSaved = () => {
    setFormOpen(false);
    setEditingEntry(null);
    load();
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

      <JournalEntryForm
        open={formOpen}
        entry={editingEntry}
        onClose={() => { setFormOpen(false); setEditingEntry(null); }}
        onSaved={handleSaved}
      />

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
