import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/*
  Product field for document line items, searchable by SKU or name. Type a
  SKU ("TP-609") or part of a name, then pick with the mouse or ↑/↓ + Enter.
  Exact and leading SKU matches are listed first.
*/
export default function ProductPicker({ products: allProducts, value, onChange, placeholder = 'Search SKU or name…', className = '' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef(null);

  // Inactive products aren't offered, except the one already on this line.
  const products = allProducts.filter((p) => p.isActive !== false || p._id === value);
  const selected = products.find((p) => p._id === value);
  const label = (p) => (p.sku ? `${p.sku} — ${p.name}` : p.name);

  const q = query.trim().toLowerCase();
  const rank = (p) => {
    const sku = (p.sku || '').toLowerCase();
    if (sku === q) return 0;
    if (sku.startsWith(q)) return 1;
    if ((p.name || '').toLowerCase().startsWith(q)) return 2;
    return 3;
  };
  const matches = q
    ? products
      .filter((p) => (p.sku || '').toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q))
      .sort((a, b) => rank(a) - rank(b))
    : products;

  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const choose = (p) => {
    onChange(p._id);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && matches[active]) choose(matches[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={open ? query : (selected ? label(selected) : '')}
        onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
        onFocus={() => { setOpen(true); setQuery(''); setActive(0); }}
        onBlur={() => { setOpen(false); setQuery(''); }}
        onKeyDown={onKeyDown}
        placeholder={selected ? label(selected) : placeholder}
        title={selected ? label(selected) : ''}
        className="input pr-8 truncate"
      />
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      {open && (
        <div ref={listRef} className="absolute z-30 mt-1 w-full min-w-[280px] max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg py-1">
          {matches.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-400">{products.length === 0 ? 'No products.' : 'No matching product.'}</div>
          )}
          {matches.map((p, i) => (
            <div
              key={p._id}
              onMouseDown={(e) => { e.preventDefault(); choose(p); }}
              onMouseEnter={() => setActive(i)}
              className={`flex items-center gap-3 px-3 py-1.5 text-sm cursor-pointer ${i === active ? 'bg-slate-100' : ''} ${p._id === value ? 'font-medium' : ''}`}
            >
              <span className="font-figures text-xs text-slate-500 shrink-0 w-20 truncate">{p.sku}</span>
              <span className="truncate">{p.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
