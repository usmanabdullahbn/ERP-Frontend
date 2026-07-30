export default function ConfirmModal({ open, onConfirm, onCancel, message, title = 'Confirm', confirmLabel = 'Yes', cancelLabel = 'Cancel', danger = false }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-6">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-display text-lg text-ink-800">{title}</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-700 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6">
          <p className="text-slate-700">{message}</p>
        </div>
        <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-200">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-white ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
