import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import JournalEntryForm from '../components/JournalEntryForm';

/*
  Dedicated page for creating a Manual Journal Entry (/journal/new) or editing
  an existing journal voucher (/journal/:id/edit).
*/
export default function JournalEntryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const backTo = isEdit ? `/journal/${id}` : '/journal';

  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!isEdit) {
      setEntry(null);
      setLoading(false);
      setLoadError('');
      return;
    }
    setLoading(true);
    setLoadError('');
    api.get(`/journal/${id}`)
      .then((res) => setEntry(res.data))
      .catch(() => setLoadError('Could not load this journal entry — it may have been deleted.'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const title = isEdit
    ? `Edit Journal Entry ${entry?.entryNumber || ''}`
    : 'New Manual Journal Entry';

  return (
    <PageLayout title={title}>
      <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink-900 mb-4">
        <ArrowLeft size={15} /> {isEdit ? 'Back to journal entry' : 'Back to General Journal'}
      </Link>

      {loadError && (
        <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{loadError}</div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400 py-12 text-center">Loading…</div>
      ) : (!isEdit || entry) ? (
        <JournalEntryForm
          asPage
          open
          entry={entry}
          onClose={() => navigate(backTo)}
          onSaved={(saved) => navigate(saved?._id ? `/journal/${saved._id}` : '/journal')}
        />
      ) : null}
    </PageLayout>
  );
}
