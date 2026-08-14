import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [whatsappStatus, setWhatsappStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const res = await login(email, password);
    setSubmitting(false);
    if (res.ok) navigate('/');
    else setError(res.message);
  };

  const handleSendTestMessage = async () => {
    setWhatsappStatus('');
    setSendingTest(true);

    try {
      const { data } = await api.post('/whatsapp/test', { to: '03492045983' });
      setWhatsappStatus(data.message || 'WhatsApp test message sent successfully.');
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to send WhatsApp test message.';
      setWhatsappStatus(message);
    } finally {
      setSendingTest(false);
    }
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
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm focus:border-ledger-teal outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-2 inline-flex items-center p-1 text-slate-500 hover:text-ink-900"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="bg-ink-900 hover:bg-ink-800 text-white rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>

            <button
              type="button"
              onClick={handleSendTestMessage}
              disabled={sendingTest}
              className="border border-emerald-600 text-emerald-700 hover:bg-emerald-50 rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-60"
            >
              {sendingTest ? 'Sending test…' : 'Send test WhatsApp to 03492045983'}
            </button>

            {whatsappStatus && (
              <div className={`text-xs rounded-lg px-3 py-2 ${whatsappStatus.toLowerCase().includes('success') || whatsappStatus.toLowerCase().includes('sent') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {whatsappStatus}
              </div>
            )}
          </form>
        </div>

        <p className="text-center text-slate-500 text-xs mt-5">
          First time setting up? <Link to="/register" className="text-ledger-teal hover:underline">Create the admin account</Link>
        </p>
      </div>
    </div>
  );
}
