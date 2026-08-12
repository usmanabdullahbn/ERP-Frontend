import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { formatMoney, todayLocalISODate } from '../components/ui';

let lineKeySeq = 0;
const newLine = () => ({ _key: ++lineKeySeq, account: '', debit: 0, credit: 0, memo: '' });

export default function Journal() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('accounting.manage');
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [date, setDate] = useState(todayLocalISODate());
  const [reference, setReference] = useState('');
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState([newLine(), newLine()]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = () => api.get('/journal').then((res) => setEntries(res.data)).catch(() => setLoadError('Could not load journal entries.'));
  useEffect(() => {
    load();
    api.get('/accounts').then((res) => setAccounts(res.data)).catch(() => setLoadError('Could not load chart of accounts.'));
  }, []);

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
    setDate(todayLocalISODate()); setReference(''); setNarration('');
    setLines([newLine(), newLine()]); setError(''); setModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    if (!balanced) return setError('Debits must equal credits before saving.');
    setSubmitting(true);
    try {
      await api.post('/journal/manual', {
        date, reference, narration,
        lines: lines
          .filter((l) => l.account && (l.debit > 0 || l.credit > 0))
          .map(({ _key, ...l }) => ({ ...l, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 }))
      });
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save journal entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const money = formatMoney;

  return (
    <PageLayout
      title="General Journal"
      actions={canManage && (
        <button onClick={openCreate} className="flex items-center gap-1.5 btn-primary">
          <Plus size={15} /> Manual Entry
        </button>
      )}
    >
      {loadError && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{loadError}</div>}
      <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Entry #</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Reference</th><th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e._id} onClick={() => setDetail(e)} className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50">
                <td className="px-4 py-3">{e.entryNumber}{e.isReversed && <span className="ml-1 text-xs text-ledger-rose">(reversed)</span>}</td>
                <td className="px-4 py-3">{new Date(e.date).toLocaleDateString()}</td>
                <td className="px-4 py-3">{e.sourceType}</td>
                <td className="px-4 py-3">{e.reference}</td>
                <td className="px-4 py-3 text-right font-figures">{money(e.totalDebit)}</td>
                <td className="px-4 py-3 text-right font-figures">{money(e.totalCredit)}</td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-8">No journal entries yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => !submitting && setModalOpen(false)} title="Manual Journal Entry" width="max-w-2xl">
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

          <button type="submit" className="mt-2 btn-teal disabled:opacity-50" disabled={!balanced || submitting}>{submitting ? 'Saving…' : 'Post entry'}</button>
        </form>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Journal Entry ${detail?.entryNumber || ''}`} width="max-w-2xl">
        {detail && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                <th className="py-2">Account</th><th>Memo</th><th className="text-right">Debit</th><th className="text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {detail.lines.map((l, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2">{l.account?.code} — {l.account?.name}</td>
                  <td className="text-slate-500">{l.memo}</td>
                  <td className="text-right font-figures">{l.debit ? money(l.debit) : ''}</td>
                  <td className="text-right font-figures">{l.credit ? money(l.credit) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>
    </PageLayout>
  );
}
