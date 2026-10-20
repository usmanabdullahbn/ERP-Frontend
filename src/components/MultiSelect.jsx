import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

/*
  Checkbox dropdown for report filters: pick zero, one, or several options.
  Zero selected reads as "no filter" (all records) — the same meaning an
  empty native <select> option ("All customers" etc.) used to carry.
*/
export default function MultiSelect({ options, selected, onChange, placeholder = 'All', className = '' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    searchRef.current?.focus();
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

  const q = query.trim().toLowerCase();
  const visible = q ? options.filter((o) => String(o.label).toLowerCase().includes(q)) : options;
  const canSelectVisible = q && visible.length > 0 && !visible.every((o) => selected.includes(o.value));
  const selectVisible = () => onChange([...new Set([...selected, ...visible.map((o) => o.value)])]);

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
        <div className="absolute z-30 mt-1 w-full min-w-[220px] bg-white border border-slate-200 rounded-lg shadow-lg">
          <div className="relative p-2 border-b border-slate-100">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
              placeholder="Search…"
              className="w-full border border-slate-200 rounded-md pl-7 pr-2 py-1.5 text-sm outline-none focus:border-ledger-teal"
            />
          </div>
          {(selected.length > 0 || canSelectVisible) && (
            <div className="flex justify-between gap-2 px-3 py-1.5 text-xs border-b border-slate-100">
              {canSelectVisible
                ? <button type="button" onClick={selectVisible} className="text-ledger-teal hover:underline">Select all {visible.length} shown</button>
                : <span />}
              {selected.length > 0 && (
                <button type="button" onClick={() => onChange([])} className="text-ledger-teal hover:underline">Clear selection</button>
              )}
            </div>
          )}
          <div className="max-h-64 overflow-y-auto py-1">
            {visible.length === 0 && (
              <div className="px-3 py-2 text-sm text-slate-400">{options.length === 0 ? 'No options.' : 'No matches.'}</div>
            )}
            {visible.map((o) => (
              <label key={o.value} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggleValue(o.value)} />
                <span className="truncate">{o.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
