import { Search, X } from 'lucide-react';

/*
  Search box plus optional filter controls (passed as children) for list
  pages. Filtering itself happens in the page — this is just the layout.
*/
export default function FilterBar({ search, onSearch, placeholder = 'Search…', onClear, showClear, children }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <div className="relative flex-1 min-w-[220px] max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          className="input pl-9"
        />
      </div>
      {children}
      {showClear && (
        <button type="button" onClick={onClear} className="flex items-center gap-1 px-3 py-2 text-xs text-slate-500 hover:text-ink-900">
          <X size={14} /> Clear
        </button>
      )}
    </div>
  );
}

// Case-insensitive match of `term` against any of the given values.
export function matchesSearch(term, ...values) {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  return values.some((v) => v != null && String(v).toLowerCase().includes(q));
}

// Local YYYY-MM-DD for comparing against <input type="date"> values.
export function toLocalISODate(d) {
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
