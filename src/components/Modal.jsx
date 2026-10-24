import { useEffect, useRef, useState } from 'react';

// Each modal that opens stacks above the ones already open (e.g. an Edit form
// opened from a detail view sits on top of it, and closing it reveals the
// detail again) regardless of the order modals appear in the JSX.
let openSeq = 0;
const openStack = [];

export default function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const [layer, setLayer] = useState(0);

  useEffect(() => {
    if (!open) return;
    const id = ++openSeq;
    openStack.push(id);
    setLayer(id);
    return () => {
      const i = openStack.indexOf(id);
      if (i !== -1) openStack.splice(i, 1);
    };
  }, [open]);

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
      // Escape closes only the topmost modal.
      if (e.key === 'Escape' && openStack[openStack.length - 1] === layer) onCloseRef.current?.();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, layer]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-start justify-center overflow-y-auto bg-ink-900/40 p-6" style={{ zIndex: 50 + layer }}>
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
