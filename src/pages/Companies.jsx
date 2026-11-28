import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Edit2, Plus, ArrowRightLeft } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import { useAuth } from '../context/AuthContext';

const COMPANY_FEATURES = [
  {
    key: 'project_deals',
    label: 'Project Deals & Settlements',
    description: 'Enable separate Project Deals, Fabrication settlements, and Project Report for this company.'
  }
];

const emptyCompanyForm = {
  name: '',
  code: '',
  plan: 'pro',
  phone: '',
  email: '',
  address: '',
  taxNumber: '',
  whatsappPhoneNumberId: '',
  features: [],
  adminName: '',
  adminEmail: '',
  adminPassword: '',
  isActive: true
};

export default function Companies() {
  const { user, isAdmin, switchCompany, refreshUser } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [form, setForm] = useState(emptyCompanyForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [switchingId, setSwitchingId] = useState(null);

  const loadCompanies = () => {
    setLoadError('');
    api
      .get('/companies')
      .then((res) => setCompanies(res.data || []))
      .catch((err) =>
        setLoadError(err.response?.data?.message || 'Could not load companies.')
      );
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const openCreateModal = () => {
    setEditingCompany(null);
    setForm(emptyCompanyForm);
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (company) => {
    setEditingCompany(company);
    setForm({
      name: company.name || '',
      code: company.code || '',
      plan: company.plan || 'pro',
      phone: company.phone || '',
      email: company.email || '',
      address: company.address || '',
      taxNumber: company.taxNumber || '',
      whatsappPhoneNumberId: company.whatsappPhoneNumberId || '',
      features: Array.isArray(company.features) ? company.features : [],
      adminName: '',
      adminEmail: '',
      adminPassword: '',
      isActive: company.isActive !== false
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setFormError('');
    setSubmitting(true);

    try {
      if (editingCompany) {
        await api.put(`/companies/${editingCompany._id}`, {
          name: form.name,
          code: form.code,
          plan: form.plan,
          phone: form.phone,
          email: form.email,
          address: form.address,
          taxNumber: form.taxNumber,
          whatsappPhoneNumberId: form.whatsappPhoneNumberId,
          features: form.features,
          isActive: form.isActive
        });
      } else {
        await api.post('/companies', form);
      }
      setModalOpen(false);
      loadCompanies();
      await refreshUser();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Could not save company.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitch = async (company) => {
    if (!company?._id || switchingId) return;
    setSwitchingId(company._id);
    const res = await switchCompany(company._id);
    setSwitchingId(null);
    if (res.ok) {
      window.location.href = '/';
    } else {
      setLoadError(res.message);
    }
  };

  const activeDbName = user?.company?.dbName;
  const canManageCompanies = Boolean(
    user?.isSuperAdmin || (isAdmin && user?.company?.isDefault !== false)
  );

  const columns = [
    {
      key: 'name',
      label: 'Company',
      render: (r) => (
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-ledger-teal shrink-0" />
          <div>
            <div className="font-medium text-ink-800 flex items-center gap-2">
              {r.name}
              {r.isDefault && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-ledger-tealLight text-ledger-teal">
                  Primary DB
                </span>
              )}
              {r.dbName === activeDbName && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <CheckCircle2 size={12} /> Active
                </span>
              )}
            </div>
            {r.email && <div className="text-xs text-slate-400">{r.email}</div>}
          </div>
        </div>
      )
    },
    {
      key: 'code',
      label: 'Code',
      render: (r) => <span className="font-mono text-xs text-slate-700">{r.code}</span>
    },
    {
      key: 'dbName',
      label: 'Database',
      render: (r) => <span className="font-mono text-xs text-slate-500">{r.dbName}</span>
    },
    {
      key: 'plan',
      label: 'Plan',
      render: (r) => <span className="uppercase text-xs font-medium text-slate-600">{r.plan || 'pro'}</span>
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <Badge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} />
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (r) => (
        <div
          className="flex items-center justify-end gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {r.isActive && r.dbName !== activeDbName && (
            <button
              type="button"
              onClick={() => handleSwitch(r)}
              disabled={switchingId === r._id}
              className="btn-ghost text-xs inline-flex items-center gap-1.5 text-ledger-teal"
            >
              <ArrowRightLeft size={13} />
              {switchingId === r._id ? 'Switching…' : 'Switch'}
            </button>
          )}
          {canManageCompanies && (
            <button
              type="button"
              onClick={() => openEditModal(r)}
              className="btn-ghost text-xs inline-flex items-center gap-1"
            >
              <Edit2 size={13} /> Edit
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <PageLayout
      title="Companies (Multi-Tenant)"
      actions={
        canManageCompanies ? (
          <button
            type="button"
            onClick={openCreateModal}
            className="btn-teal flex items-center gap-1.5"
          >
            <Plus size={16} /> New Company
          </button>
        ) : null
      }
    >
      {loadError && (
        <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">
          {loadError}
        </div>
      )}

      <DataTable
        columns={columns}
        data={companies}
        emptyMessage="No companies registered."
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCompany ? `Edit Company — ${editingCompany.name}` : 'Create New Company'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Company Name *
              </label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Alpha Profiles Pvt Ltd"
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Company Code
              </label>
              <input
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.toUpperCase() })
                }
                placeholder="Auto-generated if blank"
                className="input font-mono uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Plan</label>
              <select
                value={form.plan}
                onChange={(e) => setForm({ ...form, plan: e.target.value })}
                className="input"
              >
                <option value="starter">Starter</option>
                <option value="pro">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Tax / NTN Number
              </label>
              <input
                value={form.taxNumber}
                onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Dedicated WhatsApp Phone Number ID (Optional)
            </label>
            <input
              value={form.whatsappPhoneNumberId}
              onChange={(e) =>
                setForm({ ...form, whatsappPhoneNumberId: e.target.value })
              }
              placeholder="Leave blank to use shared WhatsApp bot"
              className="input font-mono text-xs"
            />
          </div>

          <div className="border-t border-slate-200 pt-3">
            <p className="text-xs font-semibold text-ink-800 mb-2">Additional Features</p>
            <div className="space-y-2">
              {COMPANY_FEATURES.map((feat) => {
                const enabled = (form.features || []).includes(feat.key);
                return (
                  <label
                    key={feat.key}
                    className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 cursor-pointer hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...new Set([...(form.features || []), feat.key])]
                          : (form.features || []).filter((k) => k !== feat.key);
                        setForm({ ...form, features: next });
                      }}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-sm font-medium text-ink-900">{feat.label}</span>
                      <span className="block text-xs text-slate-500">{feat.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {!editingCompany && (
            <div className="border-t border-slate-200 pt-3 mt-2">
              <p className="text-xs font-semibold text-ink-800 mb-1">
                Optional Dedicated Company Admin
              </p>
              <p className="text-xs text-slate-500 mb-3">
                Your current admin account ({user?.email}) will automatically get full access to this new company. You can also create a separate company admin below:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  placeholder="Admin Name"
                  value={form.adminName}
                  onChange={(e) => setForm({ ...form, adminName: e.target.value })}
                  className="input"
                />
                <input
                  type="email"
                  placeholder="Admin Email"
                  value={form.adminEmail}
                  onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                  className="input"
                />
                <input
                  type="password"
                  minLength={6}
                  placeholder="Password (min 6 chars)"
                  value={form.adminPassword}
                  onChange={(e) =>
                    setForm({ ...form, adminPassword: e.target.value })
                  }
                  className="input"
                />
              </div>
            </div>
          )}

          {editingCompany && !editingCompany.isDefault && (
            <div className="flex items-center gap-2 pt-2">
              <input
                id="company-active"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              <label htmlFor="company-active" className="text-sm text-ink-800">
                Company is active
              </label>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-teal disabled:opacity-60">
              {submitting
                ? editingCompany
                  ? 'Saving…'
                  : 'Provisioning DB…'
                : editingCompany
                ? 'Save Changes'
                : 'Create & Provision DB'}
            </button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  );
}
