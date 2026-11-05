import { useAuth } from '../context/AuthContext';
import { LogOut, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Topbar({ title, onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="h-14 sm:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 shrink-0 gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 shrink-0"
            aria-label="Open navigation menu"
          >
            <Menu size={18} />
          </button>
        )}
        <h1 className="font-display text-base sm:text-lg text-ink-800 truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
        <div className="hidden xs:block sm:block text-right leading-tight max-w-[140px] sm:max-w-none">
          <p className="text-xs sm:text-sm font-medium text-ink-800 truncate">{user?.name}</p>
          <p className="text-[11px] sm:text-xs text-slate-400 truncate">{user?.role?.name}</p>
        </div>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 shrink-0"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
