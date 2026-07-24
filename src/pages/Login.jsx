import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const res = await login(email, password);
    setSubmitting(false);
    if (res.ok) navigate('/');
    else setError(res.message);
  };

  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-10 h-10 rounded-lg bg-ledger-teal flex items-center justify-center font-display font-bold text-white">
            L
          </div>
          <div>
            <p className="font-display text-white font-semibold text-lg leading-tight">Ledgerline</p>
            <p className="text-xs text-slate-400 leading-tight">ERP &amp; Accounting</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-card p-7">
          <h1 className="font-display text-xl text-ink-800 mb-1">Sign in</h1>
          <p className="text-sm text-slate-500 mb-6">Enter your credentials to access the workspace.</p>

          {error && (
            <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-ledger-teal outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-ledger-teal outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="bg-ink-900 hover:bg-ink-800 text-white rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-xs mt-5">
          First time setting up? <Link to="/register" className="text-ledger-teal hover:underline">Create the admin account</Link>
        </p>
      </div>
    </div>
  );
}
