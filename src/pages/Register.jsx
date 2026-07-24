import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/*
  Only works once: the backend rejects registration once any user exists.
  This is the "first admin" bootstrap screen.
*/
export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const res = await register(form.name, form.email, form.password);
    setSubmitting(false);
    if (res.ok) navigate('/');
    else setError(res.message);
  };

  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-card p-7">
          <h1 className="font-display text-xl text-ink-800 mb-1">Create admin account</h1>
          <p className="text-sm text-slate-500 mb-6">This only works for the very first user in the system.</p>

          {error && (
            <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Full name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-ledger-teal outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-ledger-teal outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-ledger-teal outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="bg-ink-900 hover:bg-ink-800 text-white rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-60"
            >
              {submitting ? 'Creating…' : 'Create account'}
            </button>
          </form>
        </div>
        <p className="text-center text-slate-500 text-xs mt-5">
          Already set up? <Link to="/login" className="text-ledger-teal hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
