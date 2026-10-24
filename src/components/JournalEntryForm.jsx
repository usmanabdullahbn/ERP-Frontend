import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import api from '../api/client';
import Modal from './Modal';
import { formatMoney, todayLocalISODate } from './ui';

let lineKeySeq = 0;
const newLine = () => ({ _key: ++lineKeySeq, account: '', debit: 0, credit: 0, memo: '' });

/*
  Create / edit form for a journal voucher. Shared by the General Journal list
  and the entry's own page, so editing from the entry page stays on that page.
  Pass `entry` (with populated lines) to edit, or null to create a manual entry.
*/
export default function JournalEntryForm({ open, entry, onClose, onSaved }) {
  const [accounts, setAccounts] = useState([]);
  const [date, setDate] = useState(todayLocalISODate());
  const [reference, setReference] = useState('');
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState([newLine(), newLine()]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || accounts.length) return;
    api.get('/accounts').then((res) => setAccounts(res.data)).catch(() => setError('Could not load chart of accounts.'));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (entry) {
      setDate(entry.date ? new Date(entry.date).toISOString().slice(0, 10) : todayLocalISODate());
      setReference(entry.reference || '');
      setNarration(entry.narration || '');
      setLines(entry.lines.map((l) => ({
        _key: ++lineKeySeq,
        account: l.account?._id || l.account,
        debit: l.debit || 0,
        credit: l.credit || 0,
        memo: l.memo || ''
      })));
    } else {
      setDate(todayLocalISODate()); setReference(''); setNarration('');
      setLines([newLine(), newLine()]);
    }
  }, [open, entry]);

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

  const close = () => { if (!submitting) onClose(); };

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
      const { data } = entry
        ? await api.put(`/journal/${entry._id}`, payload)
        : await api.post('/journal/manual', payload);
      onSaved(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save journal entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const money = formatMoney;

  return (
    <Modal open={open} onClose={close} title={entry ? `Edit ${entry.entryNumber}` : 'Manual Journal Entry'} width="max-w-2xl">
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
          {submitting ? 'Saving…' : entry ? 'Save changes' : 'Post entry'}
        </button>
      </form>
    </Modal>
  );
}
