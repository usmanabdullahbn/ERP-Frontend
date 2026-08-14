import { useEffect, useRef } from 'react';

export default function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const focusTarget = panelRef.current?.querySelector(
      'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusTarget) {
      focusTarget.focus();
    } else {
      panelRef.current?.focus();
    }

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/40 p-6">
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-white rounded-xl shadow-xl w-full ${width} mt-10 mb-10 outline-none`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-display text-lg text-ink-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
