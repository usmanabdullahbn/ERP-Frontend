import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Printer, Trash2 } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import ConfirmModal from '../components/ConfirmModal';
import JournalEntryForm from '../components/JournalEntryForm';
import { useAuth } from '../context/AuthContext';
import { formatMoney } from '../components/ui';

/*
  Full page for one journal voucher — reached from the Journal list and from
  the JV # links on reports (which open it in a new tab).
*/
export default function JournalEntryView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [entry, setEntry] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const load = () => api.get(`/journal/${id}`)
    .then((res) => setEntry(res.data))
    .catch(() => setLoadError('Could not load this journal entry — it may have been deleted.'));

  useEffect(() => {
    setEntry(null);
    setLoadError('');
    load();
  }, [id]);

  // Edit happens right here on the entry's page; saving refreshes it in place.
  const handleSaved = () => {
    setEditOpen(false);
    load();
  };

  const deleteEntry = async () => {
    try {
      await api.delete(`/journal/${id}`);
      setConfirmOpen(false);
      navigate('/journal', { replace: true });
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not delete journal entry.');
      setConfirmOpen(false);
    }
  };

  const money = formatMoney;

  return (
    <PageLayout
      title={entry ? `Journal Entry ${entry.entryNumber}` : 'Journal Entry'}
      actions={entry && (
        <>
          <button type="button" onClick={() => window.print()} className="btn-ghost inline-flex items-center gap-2 print:hidden">
            <Printer size={15} /> Print
          </button>
          {isAdmin && (
            <>
              <button type="button" onClick={() => { setActionError(''); setEditOpen(true); }} className="btn-ghost inline-flex items-center gap-2 print:hidden">
                <Pencil size={15} /> Edit
              </button>
              <button
                type="button"
                onClick={() => { setActionError(''); setConfirmOpen(true); }}
                className="btn-ghost inline-flex items-center gap-2 text-rose-600 border-rose-200 hover:bg-rose-50 print:hidden"
              >
                <Trash2 size={15} /> Delete
              </button>
            </>
          )}
        </>
      )}
    >
      <div className="print-page">
      <Link to="/journal" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink-900 mb-4 print:hidden">
        <ArrowLeft size={15} /> Back to General Journal
      </Link>

      {loadError && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{loadError}</div>}
      {actionError && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{actionError}</div>}

      {!entry && !loadError && <div className="text-sm text-slate-400 py-12 text-center">Loading…</div>}

      {entry && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-card">
          <div className="px-6 py-5 border-b border-slate-200 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Journal Voucher</p>
              <h2 className="text-2xl font-semibold text-slate-900 font-figures">{entry.entryNumber}</h2>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${entry.isReversed ? 'bg-ledger-roseLight text-ledger-rose' : 'bg-emerald-50 text-emerald-700'}`}>
              {entry.isReversed ? 'Reversed' : 'Posted'}
            </span>
          </div>

          <div className="px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-5 text-sm border-b border-slate-200">
            <div>
              <p className="text-slate-500 text-xs">Date</p>
              <p className="font-medium">{new Date(entry.date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Source</p>
              <p className="font-medium">{entry.sourceType?.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Reference</p>
              <p className="font-medium">{entry.reference || '—'}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Created by</p>
              <p className="font-medium">{entry.createdBy?.name || '—'}</p>
            </div>
            <div className="col-span-2 md:col-span-4">
              <p className="text-slate-500 text-xs">Narration</p>
              <p className="font-medium">{entry.narration || '—'}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <th className="px-6 py-3">Account</th>
                  <th className="px-6 py-3">Memo</th>
                  <th className="px-6 py-3 text-right">Debit</th>
                  <th className="px-6 py-3 text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {entry.lines.map((l, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-6 py-3">
                      <span className="font-figures text-slate-500 mr-2">{l.account?.code}</span>
                      {l.account?.name}
                    </td>
                    <td className="px-6 py-3 text-slate-500">{l.memo}</td>
                    <td className="px-6 py-3 text-right font-figures">{l.debit ? money(l.debit) : ''}</td>
                    <td className="px-6 py-3 text-right font-figures">{l.credit ? money(l.credit) : ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink-800 font-semibold">
                  <td className="px-6 py-3" colSpan={2}>Total</td>
                  <td className="px-6 py-3 text-right font-figures">{money(entry.totalDebit)}</td>
                  <td className="px-6 py-3 text-right font-figures">{money(entry.totalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
      </div>

      <JournalEntryForm
        open={editOpen}
        entry={entry}
        onClose={() => setEditOpen(false)}
        onSaved={handleSaved}
      />

      <ConfirmModal
        open={confirmOpen}
        title="Delete Journal Entry"
        message="Delete this journal entry? This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={deleteEntry}
        onCancel={() => setConfirmOpen(false)}
      />
    </PageLayout>
  );
}
