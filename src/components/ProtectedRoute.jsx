import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, permission, feature }) {
  const { user, hasPermission, hasFeature } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (feature && !hasFeature(feature)) {
    return (
      <div className="p-10 text-center text-slate-500">
        <p className="font-display text-lg text-ink-800 mb-2">Feature not enabled</p>
        <p>This customized module is not enabled for the active company.</p>
      </div>
    );
  }
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
