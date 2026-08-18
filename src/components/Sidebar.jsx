import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Truck, Package, Landmark, BookOpen, BarChart3, ShieldCheck, ChevronDown
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const SECTIONS = [
  {
    title: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, perm: null }]
  },
  {
    title: 'Sales',
    perm: ['sales.view', 'sales.manage'],
    items: [
      { to: '/customers', label: 'Customers', icon: Users },
      { to: '/orders', label: 'Orders' },
      { to: '/invoices', label: 'Invoices' },
      { to: '/receipts', label: 'Receipts' }
    ]
  },
  {
    title: 'Purchases',
    perm: ['purchases.view', 'purchases.manage'],
    items: [
      { to: '/suppliers', label: 'Suppliers', icon: Truck },
      { to: '/bills', label: 'Bills' },
      { to: '/payments', label: 'Payments' }
    ]
  },
  {
    title: 'Inventory',
    perm: ['inventory.view', 'inventory.manage'],
    items: [
      { to: '/products', label: 'Products', icon: Package },
      { to: '/warehouses', label: 'Warehouses' }
    ]
  },
  {
    title: 'Banking & GL',
    perm: ['banking.view', 'banking.manage', 'accounting.view', 'accounting.manage'],
    items: [
      { to: '/bank', label: 'Bank Accounts', icon: Landmark },
      { to: '/chart-of-accounts', label: 'Chart of Accounts', icon: BookOpen },
      { to: '/journal', label: 'Journal' }
    ]
  },
  {
    title: 'Reports',
    perm: ['reports.view'],
    items: [
      { to: '/reports/trial-balance', label: 'Trial Balance', icon: BarChart3 },
      { to: '/reports/profit-and-loss', label: 'Profit & Loss' },
      { to: '/reports/balance-sheet', label: 'Balance Sheet' },
      { to: '/reports/stock-summary', label: 'Stock Summary' },
      { to: '/reports/pending-orders', label: 'Pending Orders' },
      { to: '/reports/sales-journal', label: 'Sales Journal' },
      { to: '/reports/purchase-journal', label: 'Purchase Journal' },
      { to: '/reports/bank-activity', label: 'Bank Activity' },
      { to: '/reports/general-ledger', label: 'General Ledger' },
      { to: '/reports/customer-ledger', label: 'Customer Ledger' },
      { to: '/reports/supplier-ledger', label: 'Supplier Ledger' },
      { to: '/reports/aged-receivables', label: 'Aged Receivables' },
      { to: '/reports/aged-payables', label: 'Aged Payables' }
    ]
  },
  {
    title: 'Administration',
    perm: ['users.manage'],
    items: [{ to: '/users', label: 'Users & Roles', icon: ShieldCheck }]
  }
];

function Section({ section }) {
  const { hasPermission } = useAuth();
  const [open, setOpen] = useState(true);
  if (section.perm && !hasPermission(...section.perm)) return null;

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs uppercase tracking-wide text-slate-400 hover:text-slate-200"
      >
        {section.title}
        <ChevronDown size={14} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-0.5">
          {section.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg mx-1 text-sm transition-colors ${
                  isActive ? 'bg-ledger-teal/20 text-white' : 'text-slate-300 hover:bg-ink-600 hover:text-white'
                }`
              }
            >
              {item.icon && <item.icon size={16} />}
              <span className={item.icon ? '' : 'ml-[26px]'}>{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside className="w-64 shrink-0 bg-ink-900 min-h-screen flex flex-col py-5">
      <div className="px-5 mb-6 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-ledger-teal flex items-center justify-center font-display font-bold text-white text-sm">
          L
        </div>
        <div>
          <p className="font-display text-white font-semibold leading-tight">Ledgerline</p>
          <p className="text-[11px] text-slate-400 leading-tight">ERP &amp; Accounting</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto">
        {SECTIONS.map((s) => (
          <Section key={s.title} section={s} />
        ))}
      </nav>
    </aside>
  );
}
