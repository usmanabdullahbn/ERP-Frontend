import { useEffect, useState } from 'react';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Badge from '../components/Badge';

export default function Users() {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState([]);

  const [userModal, setUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: '' });
  const [showPassword, setShowPassword] = useState(false);

  const [roleModal, setRoleModal] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: '', description: '', permissions: [] });

  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');

  const load = () => {
    api.get('/users').then((res) => setUsers(res.data));
    api.get('/roles').then((res) => setRoles(res.data));
  };
  useEffect(() => {
    load();
    api.get('/roles/catalog').then((res) => setCatalog(res.data));
  }, []);

  const saveUser = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/users', userForm);
      setUserModal(false);
      setUserForm({ name: '', email: '', password: '', role: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create user.');
    }
  };

  const toggleActive = async (u) => {
    await api.put(`/users/${u._id}`, { isActive: !u.isActive });
    load();
  };

  const removeUser = async (u) => {
    setConfirmMessage(`Delete user ${u.name}?`);
    setConfirmAction(() => () => performRemoveUser(u._id));
    setConfirmOpen(true);
  };

  const performRemoveUser = async (id) => {
    try {
      await api.delete(`/users/${id}`);
      load();
      setConfirmOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete user.');
    }
  };

  const saveRole = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/roles', roleForm);
      setRoleModal(false);
      setRoleForm({ name: '', description: '', permissions: [] });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create role.');
    }
  };

  const togglePerm = (p) => {
    setRoleForm((f) => ({
      ...f,
      permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p]
    }));
  };

  const removeRole = async (r) => {
    setConfirmMessage(`Delete role ${r.name}?`);
    setConfirmAction(() => () => performRemoveRole(r._id));
    setConfirmOpen(true);
  };

  const performRemoveRole = async (id) => {
    try {
      await api.delete(`/roles/${id}`);
      load();
      setConfirmOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete role.');
    }
  };

  const userColumns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: (r) => r.role?.name },
    { key: 'isActive', label: 'Status', render: (r) => <Badge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
    {
      key: 'actions', label: '', align: 'right',
      render: (r) => (
        <div className="flex gap-2 justify-end">
          <button onClick={() => toggleActive(r)} className="text-xs text-slate-500 hover:underline">{r.isActive ? 'Deactivate' : 'Activate'}</button>
          <button onClick={() => removeUser(r)} className="text-slate-400 hover:text-ledger-rose"><Trash2 size={14} /></button>
        </div>
      )
    }
  ];

  const roleColumns = [
    { key: 'name', label: 'Role' },
    { key: 'description', label: 'Description' },
    { key: 'permissions', label: 'Permissions', render: (r) => (r.permissions.includes('*') ? 'All (system)' : `${r.permissions.length} granted`) },
    {
      key: 'actions', label: '', align: 'right',
      render: (r) => !r.isSystem && (
        <button onClick={() => removeRole(r)} className="text-slate-400 hover:text-ledger-rose"><Trash2 size={14} /></button>
      )
    }
  ];

  return (
    <PageLayout
      title="Users & Roles"
      actions={
        tab === 'users'
          ? <button onClick={() => setUserModal(true)} className="flex items-center gap-1.5 btn-primary"><Plus size={15} /> New User</button>
          : <button onClick={() => setRoleModal(true)} className="flex items-center gap-1.5 btn-primary"><Plus size={15} /> New Role</button>
      }
    >
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('users')} className={`px-3 py-1.5 rounded-lg text-sm ${tab === 'users' ? 'bg-ink-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>Users</button>
        <button onClick={() => setTab('roles')} className={`px-3 py-1.5 rounded-lg text-sm ${tab === 'roles' ? 'bg-ink-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>Roles</button>
      </div>

      {tab === 'users' ? <DataTable columns={userColumns} data={users} /> : <DataTable columns={roleColumns} data={roles} />}

      <Modal open={userModal} onClose={() => setUserModal(false)} title="New User">
        <form onSubmit={saveUser} className="flex flex-col gap-3">
          {error && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
          <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">Name</span>
            <input required value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} className="input" /></label>
          <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">Email</span>
            <input required type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className="input" /></label>
          <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">Password</span>
            <div className="relative">
              <input
                required
                type={showPassword ? 'text' : 'password'}
                minLength={6}
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                className="input pr-10"
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
          </label>
          <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">Role</span>
            <select required value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} className="input">
              <option value="">Select…</option>
              {roles.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
            </select></label>
          <button type="submit" className="mt-2 btn-teal">Create user</button>
        </form>
      </Modal>

      <Modal open={roleModal} onClose={() => setRoleModal(false)} title="New Role">
        <form onSubmit={saveRole} className="flex flex-col gap-3">
          {error && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
          <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">Name</span>
            <input required value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} className="input" /></label>
          <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">Description</span>
            <input value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} className="input" /></label>
          <div>
            <span className="block text-xs font-medium text-slate-600 mb-2">Permissions</span>
            <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto border border-slate-200 rounded-lg p-3">
              {catalog.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={roleForm.permissions.includes(p)} onChange={() => togglePerm(p)} />
                  {p}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="mt-2 btn-teal">Create role</button>
        </form>
      </Modal>
    </PageLayout>
  );
}
