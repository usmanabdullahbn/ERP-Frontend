import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, permission }) {
  const { user, hasPermission } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (permission && !hasPermission(...[].concat(permission))) {
    return (
      <div className="p-10 text-center text-slate-500">
        <p className="font-display text-lg text-ink-800 mb-2">Access restricted</p>
        <p>Your role doesn't include permission for this section.</p>
      </div>
    );
  }
  return children;
}
