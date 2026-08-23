import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/*
  Checkbox dropdown for report filters: pick zero, one, or several options.
  Zero selected reads as "no filter" (all records) — the same meaning an
  empty native <select> option ("All customers" etc.) used to carry.
*/
export default function MultiSelect({ options, selected, onChange, placeholder = 'All', className = '' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggleValue = (value) => {
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  };

  const label = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? (options.find((o) => o.value === selected[0])?.label || '1 selected')
      : `${selected.length} selected`;

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input flex items-center justify-between gap-2 text-left"
      >
        <span className={`truncate ${selected.length ? '' : 'text-slate-400'}`}>{label}</span>
        <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[220px] max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg py-1">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-1.5 text-xs text-ledger-teal hover:bg-slate-50 border-b border-slate-100"
            >
              Clear selection
            </button>
          )}
          {options.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">No options.</div>}
          {options.map((o) => (
            <label key={o.value} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggleValue(o.value)} />
              <span className="truncate">{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
