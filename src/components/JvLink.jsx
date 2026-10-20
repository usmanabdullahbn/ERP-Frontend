/*
  Journal voucher number that opens the entry on the Journal page in a new
  tab. Renders an em dash when the row has no linked journal entry.
*/
export default function JvLink({ id, number }) {
  if (!id) return <span className="text-slate-300">—</span>;
  return (
    <a
      href={`/journal/${id}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="font-mono text-xs text-ledger-teal hover:underline whitespace-nowrap"
      title="Open journal entry in new tab"
    >
      {number || 'View'}
    </a>
  );
}
