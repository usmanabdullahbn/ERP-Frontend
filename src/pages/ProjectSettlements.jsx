import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Ban, Hammer, Users, CheckCircle2, Wallet, Building2, Pencil, Printer } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import JvLink from '../components/JvLink';
import { useAuth } from '../context/AuthContext';
import { formatMoney, todayLocalISODate, activeOrSelected } from '../components/ui';
import { printDocument, partyOf } from '../components/printDocument';

let expKeySeq = 0;
const newExpense = (label = '', account = '', amount = '') => ({
  _key: ++expKeySeq,
  label,
  account,
  amount
});

export default function ProjectSettlements({ mode }) {
  const { isAdmin, hasPermission } = useAuth();
  const canManage = isAdmin || hasPermission('accounting.manage', 'sales.manage');
  const { id } = useParams();
  const navigate = useNavigate();
  const isFormMode = mode === 'new' || mode === 'edit';
  const isEditMode = mode === 'edit';

  const [rows, setRows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [editingDoc, setEditingDoc] = useState(null);

  // Form state
  const [projectType, setProjectType] = useState('OUTSOURCE');
  const [customer, setCustomer] = useState('');
  const [date, setDate] = useState(todayLocalISODate());
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [maalInvoice, setMaalInvoice] = useState('');
  const [dealAmount, setDealAmount] = useState('');

  // Outsource Fabricator state
  const [fabricatorAccount, setFabricatorAccount] = useState('');
  const [fabricatorName, setFabricatorName] = useState('');
  const [fabricatorQuotation, setFabricatorQuotation] = useState('');
  const [fabricatorPaidAmount, setFabricatorPaidAmount] = useState('');
  const [fabricatorPaidFromBankAccount, setFabricatorPaidFromBankAccount] = useState('');

  // Direct Expenses state
  const [expenses, setExpenses] = useState([
    newExpense('Hardware Material'),
    newExpense('Fabricator Labour'),
    newExpense('Carriage / Transport')
  ]);
  const [cashAmount, setCashAmount] = useState('');
  const [cashBankAccount, setCashBankAccount] = useState('');
  const [bankAmount, setBankAmount] = useState('');
  const [bankBankAccount, setBankBankAccount] = useState('');
  const [expensePaidFromBankAccount, setExpensePaidFromBankAccount] = useState('');
  const [incomeAccount, setIncomeAccount] = useState('');
  const [receivableAccount, setReceivableAccount] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Quick Add Customer Modal
  const [newCustOpen, setNewCustOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustBusy, setNewCustBusy] = useState(false);

  // Detail & Follow-up Payment Modals
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [voidBusy, setVoidBusy] = useState(false);

  const [clientPayOpen, setClientPayOpen] = useState(false);
  const [clientPayAmt, setClientPayAmt] = useState('');
  const [clientPayDate, setClientPayDate] = useState(todayLocalISODate());
  const [clientPayBank, setClientPayBank] = useState('');
  const [clientPayRef, setClientPayRef] = useState('');
  const [clientPayBusy, setClientPayBusy] = useState(false);

  const [fabPayOpen, setFabPayOpen] = useState(false);
  const [fabPayAmt, setFabPayAmt] = useState('');
  const [fabPayDate, setFabPayDate] = useState(todayLocalISODate());
  const [fabPayBank, setFabPayBank] = useState('');
  const [fabPayRef, setFabPayRef] = useState('');
  const [fabPayBusy, setFabPayBusy] = useState(false);

  const money = formatMoney;

  const loadList = () =>
    api.get('/project-settlements')
      .then((res) => setRows(res.data))
      .catch(() => setLoadError('Could not load project settlements.'));

  const loadInvoices = () =>
    api.get('/invoices').then((res) => setInvoices(res.data)).catch(() => {});

  useEffect(() => {
    loadList();
    api.get('/customers').then((res) => setCustomers(res.data)).catch(() => {});
    loadInvoices();
    api.get('/bank/accounts').then((res) => setBankAccounts(res.data)).catch(() => {});
    api.get('/accounts').then((res) => setAccounts(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!bankAccounts.length) return;
    const defaultCash = bankAccounts.find((b) => b.isActive !== false && b.type === 'CASH')?._id || bankAccounts[0]?._id || '';
    const defaultBank = bankAccounts.find((b) => b.isActive !== false && /ha mbl/i.test(b.name))?._id
      || bankAccounts.find((b) => b.isActive !== false && b.type === 'BANK')?._id
      || bankAccounts[0]?._id
      || '';
    setCashBankAccount((v) => v || defaultCash);
    setExpensePaidFromBankAccount((v) => v || defaultCash);
    setBankBankAccount((v) => v || defaultBank);
    setFabricatorPaidFromBankAccount((v) => v || defaultBank);
    setClientPayBank((v) => v || defaultBank);
    setFabPayBank((v) => v || defaultBank);
  }, [bankAccounts]);

  useEffect(() => {
    if (!accounts.length) return;
    const incomeAccs = accounts.filter((a) => a.isActive !== false && a.type === 'INCOME');
    const assetAccs = accounts.filter((a) => a.isActive !== false && a.type === 'ASSET');
    const expAccs = accounts.filter((a) => a.isActive !== false && a.type === 'EXPENSE');

    const preferredIncome =
      incomeAccs.find((a) => a.code === '4500') ||
      incomeAccs.find((a) => /commission/i.test(a.name)) ||
      incomeAccs.find((a) => /project|fabrication/i.test(a.name)) ||
      incomeAccs[0];

    const preferredReceivable =
      assetAccs.find((a) => a.code === '1110') ||
      assetAccs.find((a) => /project.*receivable/i.test(a.name)) ||
      assetAccs.find((a) => a.code === '1100') ||
      assetAccs[0];

    const preferredFab =
      expAccs.find((a) => a.code === '5050') ||
      expAccs.find((a) => /outsource|rashid|sajjad/i.test(a.name)) ||
      expAccs[0];

    if (preferredIncome) setIncomeAccount((v) => v || preferredIncome._id);
    if (preferredReceivable) setReceivableAccount((v) => v || preferredReceivable._id);
    if (preferredFab) setFabricatorAccount((v) => v || preferredFab._id);

    const acc5020 = expAccs.find((a) => a.code === '5020')?._id || '';
    const acc5030 = expAccs.find((a) => a.code === '5030')?._id || '';
    const acc5040 = expAccs.find((a) => a.code === '5040')?._id || '';
    setExpenses((prev) =>
      prev.map((row, idx) => {
        if (row.account) return row;
        if (idx === 0 && acc5020) return { ...row, account: acc5020 };
        if (idx === 1 && acc5030) return { ...row, account: acc5030 };
        if (idx === 2 && acc5040) return { ...row, account: acc5040 };
        return row;
      })
    );
  }, [accounts]);

  // Load detail for view (/projects/:id) OR pre-populate form for edit (/projects/:id/edit)
  useEffect(() => {
    setDetail(null);
    setDetailError('');
    setEditingDoc(null);
    setError('');

    if (id && !mode) {
      api.get(`/project-settlements/${id}`)
        .then((res) => setDetail(res.data))
        .catch(() => setDetailError('Could not load this project settlement.'));
    } else if (id && mode === 'edit') {
      api.get(`/project-settlements/${id}`)
        .then((res) => {
          const d = res.data;
          setEditingDoc(d);
          setProjectType(d.projectType || 'IN_HOUSE');
          setCustomer(d.customer?._id || d.customer || '');
          setDate(d.date ? new Date(d.date).toISOString().slice(0, 10) : todayLocalISODate());
          setReference(d.reference || '');
          setNotes(d.notes || '');
          setMaalInvoice(d.maalInvoice?._id || d.maalInvoice || '');
          setDealAmount(d.dealAmount != null ? String(d.dealAmount) : '');
          setFabricatorName(d.fabricatorName || '');
          if (d.fabricatorAccount) setFabricatorAccount(d.fabricatorAccount?._id || d.fabricatorAccount);
          setFabricatorQuotation(d.fabricatorQuotation ? String(d.fabricatorQuotation) : '');
          setFabricatorPaidAmount(d.fabricatorPaidAmount ? String(d.fabricatorPaidAmount) : '');
          if (d.fabricatorPaidFromBankAccount) {
            setFabricatorPaidFromBankAccount(d.fabricatorPaidFromBankAccount?._id || d.fabricatorPaidFromBankAccount);
          }
          if (d.expenses?.length) {
            setExpenses(
              d.expenses.map((ex) =>
                newExpense(ex.label || '', ex.account?._id || ex.account || '', ex.amount != null ? String(ex.amount) : '')
              )
            );
          }
          setCashAmount(d.cashAmount ? String(d.cashAmount) : '');
          if (d.cashBankAccount) setCashBankAccount(d.cashBankAccount?._id || d.cashBankAccount);
          setBankAmount(d.bankAmount ? String(d.bankAmount) : '');
          if (d.bankBankAccount) setBankBankAccount(d.bankBankAccount?._id || d.bankBankAccount);
          if (d.expensePaidFromBankAccount) {
            setExpensePaidFromBankAccount(d.expensePaidFromBankAccount?._id || d.expensePaidFromBankAccount);
          }
          if (d.incomeAccount) setIncomeAccount(d.incomeAccount?._id || d.incomeAccount);
          if (d.receivableAccount) setReceivableAccount(d.receivableAccount?._id || d.receivableAccount);
        })
        .catch(() => setError('Could not load project settlement for editing.'));
    }
  }, [id, mode]);

  const availableInvoices = useMemo(
    () =>
      invoices
        .filter((inv) => !['DRAFT', 'VOID', 'POSTING'].includes(inv.status))
        .sort((a, b) => {
          const aCust = (a.customer?._id || a.customer) === customer ? 0 : 1;
          const bCust = (b.customer?._id || b.customer) === customer ? 0 : 1;
          if (aCust !== bCust) return aCust - bCust;
          return new Date(b.date) - new Date(a.date);
        }),
    [invoices, customer]
  );

  const isOutsource = projectType === 'OUTSOURCE';
  const selectedInvoice = availableInvoices.find((inv) => inv._id === maalInvoice) || null;
  const maalAmount = selectedInvoice ? Number(selectedInvoice.grandTotal || 0) : 0;

  // When editing an existing project, add back what this project itself settled on that invoice
  const alreadySettledByThisDoc =
    isEditMode && editingDoc && (editingDoc.maalInvoice?._id || editingDoc.maalInvoice) === maalInvoice
      ? Number(editingDoc.maalSettledByProject || 0)
      : 0;

  const maalDue = selectedInvoice
    ? Math.max(0, maalAmount - Math.max(0, Number(selectedInvoice.amountPaid || 0) - alreadySettledByThisDoc))
    : 0;

  const dealNum = Number(dealAmount) || 0;
  const projectCharges = Math.max(0, dealNum - maalAmount);

  const fabQuoteNum = isOutsource ? (Number(fabricatorQuotation) || 0) : 0;
  const fabNetCost = isOutsource ? Math.max(0, fabQuoteNum - maalAmount) : 0;
  const fabPaidNowNum = isOutsource ? (Number(fabricatorPaidAmount) || 0) : 0;
  const fabBalanceDue = isOutsource ? Math.max(0, fabNetCost - fabPaidNowNum) : 0;

  const extraExpensesTotal = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalExpenses = isOutsource ? (fabNetCost + extraExpensesTotal) : extraExpensesTotal;
  const netProfit = projectCharges - totalExpenses;

  const cashNum = Number(cashAmount) || 0;
  const bankNum = Number(bankAmount) || 0;
  const totalReceived = cashNum + bankNum;

  const maalPaidNow = isOutsource
    ? (selectedInvoice ? maalDue : 0)
    : Math.min(maalDue, totalReceived);

  const remainingClientBalance = isOutsource
    ? Math.max(0, (projectCharges + maalPaidNow) - totalReceived)
    : Math.max(0, dealNum - (maalAmount - maalDue) - totalReceived);

  const netCashInDrawer = isOutsource ? cashNum : (cashNum - extraExpensesTotal);

  const incomeAccounts = accounts.filter((a) => a.isActive !== false && a.type === 'INCOME');
  const assetAccounts = accounts.filter((a) => a.isActive !== false && a.type === 'ASSET');
  const expenseAccounts = accounts.filter((a) => a.isActive !== false && a.type === 'EXPENSE');

  const updateExpense = (i, patch) => {
    const next = [...expenses];
    next[i] = { ...next[i], ...patch };
    setExpenses(next);
  };

  const handleQuickAddCustomer = async (e) => {
    e.preventDefault();
    if (!newCustName.trim() || newCustBusy) return;
    setNewCustBusy(true);
    try {
      const { data: created } = await api.post('/customers', {
        name: newCustName.trim(),
        phone: newCustPhone.trim()
      });
      setCustomers((prev) => [...prev, created]);
      setCustomer(created._id);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create customer.');
    } finally {
      setNewCustBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    if (!customer) return setError('Select a customer (project client).');
    if (dealNum <= 0) return setError('Enter total client deal / quotation amount.');
    if (dealNum < maalAmount) return setError('Total client deal amount cannot be less than Maal invoice amount.');
    if (isOutsource) {
      if (fabQuoteNum <= 0) return setError('Enter the Outsource Fabricator Quotation amount (e.g. 364281).');
      if (fabQuoteNum < maalAmount) return setError('Fabricator Quotation cannot be less than the Maal Invoice given to the fabricator.');
      if (!fabricatorAccount) return setError('Select the Outsource Fabricator account (e.g. 5050 Rashid Butt).');
    }
    if (!incomeAccount) return setError('Select a Project Commission / Income account.');
    if (!receivableAccount) return setError('Select a Project Receivable account.');

    setSubmitting(true);
    try {
      const payload = {
        projectType,
        customer,
        date,
        reference,
        notes,
        maalInvoice: maalInvoice || undefined,
        dealAmount: dealNum,
        fabricatorName: isOutsource ? fabricatorName : undefined,
        fabricatorAccount: isOutsource ? fabricatorAccount : undefined,
        fabricatorQuotation: isOutsource ? fabQuoteNum : undefined,
        fabricatorPaidAmount: isOutsource ? fabPaidNowNum : undefined,
        fabricatorPaidFromBankAccount: isOutsource && fabPaidNowNum > 0 ? fabricatorPaidFromBankAccount : undefined,
        expenses: expenses
          .filter((ex) => (Number(ex.amount) || 0) > 0)
          .map(({ label, account, amount }) => ({ label, account, amount: Number(amount) })),
        cashAmount: cashNum,
        cashBankAccount: cashNum > 0 ? cashBankAccount : undefined,
        bankAmount: bankNum,
        bankBankAccount: bankNum > 0 ? bankBankAccount : undefined,
        expensePaidFromBankAccount: extraExpensesTotal > 0 ? expensePaidFromBankAccount : undefined,
        incomeAccount,
        receivableAccount
      };
      const { data: saved } = isEditMode
        ? await api.put(`/project-settlements/${id}`, payload)
        : await api.post('/project-settlements', payload);
      loadList();
      loadInvoices();
      navigate(saved?._id ? `/projects/${saved._id}` : '/projects');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save project settlement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceiveClient = async (e) => {
    e.preventDefault();
    if (clientPayBusy) return;
    setClientPayBusy(true);
    setDetailError('');
    try {
      const { data } = await api.post(`/project-settlements/${id}/receive-client`, {
        amount: Number(clientPayAmt),
        date: clientPayDate,
        bankAccount: clientPayBank,
        reference: clientPayRef
      });
      setDetail(data);
      loadList();
      setClientPayOpen(false);
    } catch (err) {
      setDetailError(err.response?.data?.message || 'Could not record client payment.');
    } finally {
      setClientPayBusy(false);
    }
  };

  const handlePayFabricator = async (e) => {
    e.preventDefault();
    if (fabPayBusy) return;
    setFabPayBusy(true);
    setDetailError('');
    try {
      const { data } = await api.post(`/project-settlements/${id}/pay-fabricator`, {
        amount: Number(fabPayAmt),
        date: fabPayDate,
        bankAccount: fabPayBank,
        reference: fabPayRef
      });
      setDetail(data);
      loadList();
      setFabPayOpen(false);
    } catch (err) {
      setDetailError(err.response?.data?.message || 'Could not record fabricator payment.');
    } finally {
      setFabPayBusy(false);
    }
  };

  const handleVoid = async () => {
    setVoidBusy(true);
    try {
      await api.post(`/project-settlements/${id}/void`);
      const { data } = await api.get(`/project-settlements/${id}`);
      setDetail(data);
      loadList();
      loadInvoices();
      setConfirmOpen(false);
    } catch (err) {
      setDetailError(err.response?.data?.message || 'Could not void project settlement.');
      setConfirmOpen(false);
    } finally {
      setVoidBusy(false);
    }
  };

  const handlePrint = (d) => {
    if (!d) return;
    const isOut = d.projectType === 'OUTSOURCE';
    const clientPaid = d.clientPaidTotal ?? ((d.cashAmount || 0) + (d.bankAmount || 0));
    const esc = (v) =>
      String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const companyName = import.meta.env.VITE_COMPANY_NAME || 'Hussain Aluminum & uPVC';
    const companyAddress = import.meta.env.VITE_COMPANY_ADDRESS || '';
    const companyPhone = import.meta.env.VITE_COMPANY_PHONE || '';

    const jvs = d.journalEntries?.length ? d.journalEntries : d.journalEntry ? [d.journalEntry] : [];
    const rcpts = d.receipts || [];

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(d.projectNumber)} ${esc(d.customer?.name || '')}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      margin: 0;
      padding: 12mm 12mm;
      font-family: Inter, "Segoe UI", system-ui, -apple-system, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 12px;
    }
    .num { font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-variant-numeric: tabular-nums; }
    .company-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-bottom: 10px;
      margin-bottom: 14px;
      border-bottom: 2px solid #0f172a;
    }
    .company-title { font-size: 17px; font-weight: 800; color: #0f172a; letter-spacing: 0.2px; }
    .company-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
    .card-shell {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      background: #ffffff;
    }
    .header-box {
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    .header-title-row { display: flex; align-items: center; gap: 10px; }
    .header-title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; }
    .badge {
      display: inline-block;
      padding: 2px 9px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-radius: 999px;
      background: #d1fae5;
      color: #065f46;
      border: 1px solid #a7f3d0;
    }
    .badge-void { background: #ffe4e6; color: #9f1239; border-color: #fecdd3; }
    .header-sub { font-size: 12px; color: #64748b; margin-top: 4px; }
    .deal-total-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.7px; color: #64748b; font-weight: 600; text-align: right; }
    .deal-total-val { font-size: 22px; font-weight: 700; color: #0f172a; text-align: right; margin-top: 2px; }

    .body-pad { padding: 18px 20px; display: flex; flex-direction: column; gap: 16px; }

    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }

    .info-card {
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      border-radius: 9px;
      padding: 12px 14px;
    }
    .cap { font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: #94a3b8; font-weight: 600; }
    .val-main { font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 4px; }
    .val-teal { font-size: 14px; font-weight: 700; color: #0f766e; text-decoration: underline; margin-top: 4px; }
    .val-lg { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 4px; }
    .sub-line { font-size: 11px; color: #64748b; margin-top: 4px; }

    .outsource-box {
      border: 1px solid #c7d2fe;
      background: #eef2ff;
      border-radius: 11px;
      padding: 14px 16px;
    }
    .outsource-cap { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700; color: #4338ca; }
    .outsource-title { font-size: 13.5px; font-weight: 700; color: #0f172a; margin-top: 2px; margin-bottom: 10px; }
    .outsource-acc { font-size: 11.5px; font-weight: 400; color: #64748b; margin-left: 6px; }

    .sub-card {
      background: #ffffff;
      border: 1px solid #e0e7ff;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .sub-card-amber {
      background: #ffffff;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .sub-label { font-size: 11px; color: #64748b; }
    .sub-label-amber { font-size: 11px; color: #92400e; font-weight: 500; }
    .sub-val { font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 3px; }
    .sub-val-indigo { font-size: 14px; font-weight: 700; color: #3730a3; margin-top: 3px; }
    .sub-val-amber { font-size: 14px; font-weight: 700; color: #78350f; margin-top: 3px; }

    .metric-emerald {
      border: 1px solid #a7f3d0;
      background: #ecfdf5;
      border-radius: 9px;
      padding: 12px 14px;
    }
    .metric-emerald .m-label { font-size: 11px; color: #047857; font-weight: 500; }
    .metric-emerald .m-val { font-size: 17px; font-weight: 700; color: #065f46; margin-top: 3px; }

    .metric-white {
      border: 1px solid #e2e8f0;
      background: #ffffff;
      border-radius: 9px;
      padding: 12px 14px;
    }
    .metric-white .m-label { font-size: 11px; color: #64748b; }
    .metric-white .m-val { font-size: 17px; font-weight: 700; color: #0f172a; margin-top: 3px; }
    .metric-white .m-val-rose { font-size: 17px; font-weight: 700; color: #e11d48; margin-top: 3px; }

    .metric-amber {
      border: 1px solid #fde68a;
      background: #fffbeb;
      border-radius: 9px;
      padding: 12px 14px;
    }
    .metric-amber .m-label { font-size: 11px; color: #92400e; font-weight: 500; }
    .metric-amber .m-val { font-size: 17px; font-weight: 700; color: #78350f; margin-top: 3px; }

    .section-box {
      border: 1px solid #e2e8f0;
      border-radius: 9px;
      padding: 12px 14px;
      background: #ffffff;
    }
    .pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .pill {
      display: inline-block;
      padding: 5px 10px;
      border-radius: 7px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      font-size: 11px;
      color: #334155;
    }
    .pill-teal {
      border-color: #99f6e4;
      background: #f0fdfa;
      color: #115e59;
      font-weight: 600;
    }

    table.exp-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    table.exp-table th {
      background: #f8fafc;
      color: #64748b;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: left;
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    table.exp-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
    table.exp-table .r { text-align: right; }

    .notes-box {
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      border-radius: 9px;
      padding: 11px 14px;
      font-size: 12px;
      color: #334155;
      white-space: pre-wrap;
    }

    .signs {
      display: flex;
      justify-content: space-between;
      margin-top: 36px;
      padding-top: 12px;
      page-break-inside: avoid;
    }
    .sign {
      width: 190px;
      border-top: 1px solid #94a3b8;
      padding-top: 6px;
      text-align: center;
      font-size: 11px;
      color: #475569;
    }
    .footer { margin-top: 18px; text-align: center; font-size: 10px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="company-bar">
    <div>
      <div class="company-title">${esc(companyName)}</div>
      ${companyAddress || companyPhone ? `<div class="company-sub">${[companyAddress, companyPhone && `Phone: ${companyPhone}`].filter(Boolean).map(esc).join(' · ')}</div>` : ''}
    </div>
    <div class="company-sub">Printed: ${esc(new Date().toLocaleDateString())}</div>
  </div>

  <div class="card-shell">
    <div class="header-box">
      <div>
        <div class="header-title-row">
          <h1 class="header-title">${isOut ? 'Outsource Project Deal' : 'In-House Project Deal'}</h1>
          <span class="badge ${d.status === 'VOID' ? 'badge-void' : ''}">${esc(d.status)}</span>
        </div>
        <div class="header-sub">
          Project #: <strong class="num" style="color:#0f172a">${esc(d.projectNumber)}</strong>
          &nbsp;·&nbsp; ${esc(new Date(d.date).toLocaleDateString())}
          ${d.reference ? ` &nbsp;·&nbsp; ${esc(d.reference)}` : ''}
        </div>
      </div>
      <div>
        <div class="deal-total-label">Total Deal Amount</div>
        <div class="deal-total-val num">${esc(money(d.dealAmount))}</div>
      </div>
    </div>

    <div class="body-pad">
      <!-- ROW 1: 3 SEPARATED REVENUE & CLIENT CARDS -->
      <div class="grid-3">
        <div class="info-card">
          <div class="cap">Client (Customer)</div>
          <div class="val-main">${esc(d.customer?.name || '—')}</div>
          <div class="sub-line">Total Quotation / Deal: <strong class="num" style="color:#0f172a">${esc(money(d.dealAmount))}</strong></div>
        </div>

        <div class="info-card">
          <div class="cap">1. Maal Sales Revenue (Alag)</div>
          ${
            d.maalInvoice
              ? `<div class="val-teal num">${esc(d.maalInvoice.invoiceNumber)} — ${esc(money(d.maalInvoiceAmount))}</div>
                 <div class="sub-line">Billed to: ${esc(d.maalInvoice.customer?.name || d.customer?.name || '')} · Status: ${esc(d.maalInvoice.status || 'PAID')}</div>`
              : `<div class="val-main" style="color:#64748b;font-weight:500">No Linked Maal Invoice (0.00)</div>`
          }
        </div>

        <div class="info-card">
          <div class="cap">2. Project Extra Revenue (Deal − Maal)</div>
          <div class="val-lg num">${esc(money(d.projectCharges))}</div>
          <div class="sub-line">Deal (${esc(money(d.dealAmount))}) − Maal (${esc(money(d.maalInvoiceAmount))})</div>
        </div>
      </div>

      <!-- ROW 2: OUTSOURCE FABRICATOR SETTLEMENT BOX -->
      ${
        isOut
          ? `<div class="outsource-box">
              <div class="outsource-cap">Outsource Fabricator Settlement</div>
              <div class="outsource-title">
                ${esc(d.fabricatorName || d.fabricatorAccount?.name || 'Outsource Fabricator')}
                ${d.fabricatorAccount ? `<span class="outsource-acc">(${esc(d.fabricatorAccount.code)} — ${esc(d.fabricatorAccount.name)})</span>` : ''}
              </div>
              <div class="grid-4">
                <div class="sub-card">
                  <div class="sub-label">Fabricator Quotation</div>
                  <div class="sub-val num">${esc(money(d.fabricatorQuotation))}</div>
                </div>
                <div class="sub-card">
                  <div class="sub-label">Less: Maal Inv Given</div>
                  <div class="sub-val num" style="color:#334155">− ${esc(money(d.maalInvoiceAmount))}</div>
                </div>
                <div class="sub-card">
                  <div class="sub-label">Net Payable (Quotation − Maal)</div>
                  <div class="sub-val-indigo num">${esc(money(d.fabricatorNetCost))}</div>
                </div>
                <div class="sub-card-amber">
                  <div class="sub-label-amber">Remaining to Pay Fabricator</div>
                  <div class="sub-val-amber num">${esc(money(d.fabricatorBalanceDue))}</div>
                </div>
              </div>
            </div>`
          : ''
      }

      <!-- ROW 3: 4 COLORED METRIC CARDS -->
      <div class="grid-4">
        <div class="metric-emerald">
          <div class="m-label">Net Commission Income (${esc(d.incomeAccount?.code || '4500')})</div>
          <div class="m-val num">${esc(money(d.netProfit))}</div>
        </div>
        <div class="metric-white">
          <div class="m-label">Client Paid So Far</div>
          <div class="m-val num">${esc(money(clientPaid))}</div>
        </div>
        <div class="metric-amber">
          <div class="m-label">Client Receivable Due (${esc(d.receivableAccount?.code || '1110')})</div>
          <div class="m-val num">${esc(money(d.clientBalance))}</div>
        </div>
        <div class="metric-white">
          <div class="m-label">Project Direct Costs</div>
          <div class="m-val-rose num">${esc(money(d.totalExpenses))}</div>
        </div>
      </div>

      <!-- ROW 4: GENERATED JVs & RECEIPTS -->
      ${
        rcpts.length > 0 || jvs.length > 0
          ? `<div class="section-box">
              <div class="cap" style="color:#64748b">Generated Accounting Entries (JVs & Receipts)</div>
              <div class="pills">
                ${rcpts.map((r) => `<span class="pill pill-teal num">✓ ${esc(r.receiptNumber)} — ${esc(money(r.amount))}</span>`).join('')}
                ${jvs.map((j) => `<span class="pill"><strong class="num" style="color:#0f766e">${esc(j.entryNumber)}</strong> ${j.reference ? `(${esc(j.reference)})` : ''}</span>`).join('')}
              </div>
            </div>`
          : ''
      }

      <!-- ROW 5: DIRECT EXPENSES TABLE IF ANY -->
      ${
        d.expenses?.length > 0
          ? `<div class="card-shell">
              <table class="exp-table">
                <thead>
                  <tr>
                    <th>Expense Account</th>
                    <th>Description</th>
                    <th class="r">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${d.expenses
                    .map(
                      (ex) => `<tr>
                        <td><strong>${esc(ex.account ? `${ex.account.code} — ${ex.account.name}` : 'Direct Expense')}</strong></td>
                        <td style="color:#475569">${esc(ex.label)}</td>
                        <td class="r num">${esc(money(ex.amount))}</td>
                      </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>`
          : ''
      }

      <!-- ROW 6: NOTES IF ANY -->
      ${
        d.notes
          ? `<div class="notes-box">
              <div class="cap" style="margin-bottom:4px">Notes</div>
              <div>${esc(d.notes)}</div>
            </div>`
          : ''
      }
    </div>
  </div>

  <div class="signs">
    <div class="sign">Prepared by</div>
    <div class="sign">Approved by</div>
    <div class="sign">Client / Fabricator Sign</div>
  </div>
  <div class="footer">Computer-generated Project Deal Settlement · ${esc(companyName)}</div>
</body>
</html>`;

    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(frame);

    const win = frame.contentWindow;
    win.document.open();
    win.document.write(html);
    win.document.close();

    const appTitle = document.title;
    document.title = [d.projectNumber, d.customer?.name].filter(Boolean).join(' ').replace(/[\\/:*?"<>|]/g, '-');

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      document.title = appTitle;
      setTimeout(() => frame.remove(), 500);
    };
    win.addEventListener('afterprint', cleanup);
    setTimeout(() => {
      win.focus();
      win.print();
      setTimeout(cleanup, 60000);
    }, 250);
  };

  const columns = [
    { key: 'projectNumber', label: 'Project #', render: (r) => <span className="font-figures font-medium">{r.projectNumber}</span> },
    {
      key: 'projectType',
      label: 'Type',
      render: (r) => (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.projectType === 'OUTSOURCE' ? 'bg-indigo-50 text-indigo-700' : 'bg-teal-50 text-teal-700'}`}>
          {r.projectType === 'OUTSOURCE' ? 'Outsource' : 'In-House'}
        </span>
      )
    },
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'customer', label: 'Client', render: (r) => r.customer?.name },
    { key: 'maalInvoice', label: 'Maal Inv', render: (r) => r.maalInvoice ? `${r.maalInvoice.invoiceNumber} (${money(r.maalInvoiceAmount)})` : '—' },
    { key: 'dealAmount', label: 'Client Deal', align: 'right', render: (r) => money(r.dealAmount) },
    { key: 'projectCharges', label: 'Project Rev', align: 'right', render: (r) => money(r.projectCharges) },
    { key: 'netProfit', label: 'Commission (4500)', align: 'right', render: (r) => <span className="text-emerald-700 font-medium">{money(r.netProfit)}</span> },
    { key: 'clientBalance', label: 'Client Receivable', align: 'right', render: (r) => money(r.clientBalance) },
    {
      key: 'fabricatorBalanceDue',
      label: 'Fabricator Payable',
      align: 'right',
      render: (r) => (r.projectType === 'OUTSOURCE' ? money(r.fabricatorBalanceDue || 0) : '—')
    },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (r) => (
        <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={async () => {
              try {
                const { data: full } = await api.get(`/project-settlements/${r._id}`);
                handlePrint(full);
              } catch {
                handlePrint(r);
              }
            }}
            className="text-slate-600 hover:text-ink-900 px-2 py-1 rounded border border-slate-200 bg-white inline-flex items-center gap-1 text-xs font-medium"
            title="Print Project Deal"
          >
            <Printer size={13} /> Print
          </button>
          {canManage && r.status === 'POSTED' && (
            <button
              type="button"
              onClick={() => navigate(`/projects/${r._id}/edit`)}
              className="text-ledger-teal hover:underline px-2 py-1 rounded border border-teal-200 bg-teal-50/60 inline-flex items-center gap-1 text-xs font-semibold"
              title="Edit Project Deal"
            >
              <Pencil size={13} /> Edit
            </button>
          )}
        </div>
      )
    }
  ];

  const listActions = canManage && (
    <button onClick={() => navigate('/projects/new')} className="flex items-center gap-1.5 btn-primary">
      <Plus size={15} /> New Project Deal
    </button>
  );

  return (
    <PageLayout
      title={
        mode === 'new'
          ? 'New Project / Fabrication Deal'
          : mode === 'edit'
            ? `Edit Project ${editingDoc?.projectNumber || ''}`
            : id
              ? `Project ${detail?.projectNumber || ''}`
              : 'Project Deals'
      }
      actions={isFormMode ? null : id ? null : listActions}
    >
      {!isFormMode && !id && loadError && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{loadError}</div>}
      {!isFormMode && !id && <DataTable columns={columns} data={rows} onRowClick={(r) => navigate(`/projects/${r._id}`)} />}

      {/* ====================================================================
          PROJECT DETAIL VIEW (/projects/:id)
         ==================================================================== */}
      {!isFormMode && id && (
        <div>
          <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink-900 mb-4 print:hidden">
            <ArrowLeft size={15} /> Back to Project Deals
          </Link>
          {detailError && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{detailError}</div>}
          {!detail && !detailError && <div className="text-sm text-slate-400 py-12 text-center">Loading…</div>}
          {detail && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
              <div className="bg-slate-50/80 border-b border-slate-200 px-5 sm:px-7 py-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-xl font-semibold text-ink-900">
                      {detail.projectType === 'OUTSOURCE' ? 'Outsource Project Deal' : 'In-House Project Deal'}
                    </h1>
                    <Badge status={detail.status} />
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Project #: <span className="font-figures font-semibold text-ink-800">{detail.projectNumber}</span>
                    {' · '}{new Date(detail.date).toLocaleDateString()}
                    {detail.reference && ` · ${detail.reference}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => handlePrint(detail)}
                    className="btn-ghost border border-slate-200 bg-white text-xs inline-flex items-center gap-1.5"
                  >
                    <Printer size={14} /> Print / PDF
                  </button>
                  {canManage && detail.status === 'POSTED' && (
                    <button
                      onClick={() => navigate(`/projects/${detail._id}/edit`)}
                      className="btn-primary text-xs inline-flex items-center gap-1.5"
                    >
                      <Pencil size={14} /> Edit Project Deal
                    </button>
                  )}
                  {canManage && detail.status === 'POSTED' && detail.clientBalance > 0 && (
                    <button
                      onClick={() => {
                        setClientPayAmt(String(detail.clientBalance));
                        setClientPayDate(todayLocalISODate());
                        setClientPayRef(`${detail.customer?.name || 'Client'} / Final Balance (${detail.projectNumber})`);
                        setClientPayOpen(true);
                      }}
                      className="btn-primary text-xs inline-flex items-center gap-1.5"
                    >
                      <Wallet size={14} /> Receive Client Balance ({money(detail.clientBalance)})
                    </button>
                  )}
                  {canManage && detail.status === 'POSTED' && detail.projectType === 'OUTSOURCE' && detail.fabricatorBalanceDue > 0 && (
                    <button
                      onClick={() => {
                        setFabPayAmt(String(detail.fabricatorBalanceDue));
                        setFabPayDate(todayLocalISODate());
                        setFabPayRef(`${detail.fabricatorName || 'Fabricator'} / Settlement (${detail.projectNumber})`);
                        setFabPayOpen(true);
                      }}
                      className="btn-teal text-xs inline-flex items-center gap-1.5"
                    >
                      <Hammer size={14} /> Pay Fabricator ({money(detail.fabricatorBalanceDue)})
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5 sm:p-7 space-y-6">
                {/* Separated Revenue & Party Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                    <p className="text-[11px] uppercase tracking-wider text-slate-400">Client (Customer)</p>
                    <p className="font-semibold text-ink-900 mt-0.5">{detail.customer?.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Total Quotation / Deal: <span className="font-figures font-semibold text-ink-800">{money(detail.dealAmount)}</span>
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                    <p className="text-[11px] uppercase tracking-wider text-slate-400">1. Maal Sales Revenue (Alag)</p>
                    {detail.maalInvoice ? (
                      <>
                        <Link to={`/invoices/${detail.maalInvoice._id}`} className="font-figures font-semibold text-ledger-teal hover:underline mt-0.5 inline-block">
                          {detail.maalInvoice.invoiceNumber} — {money(detail.maalInvoiceAmount)}
                        </Link>
                        <p className="text-xs text-slate-500 mt-1">
                          Billed to: {detail.maalInvoice.customer?.name || detail.customer?.name} · Status: {detail.maalInvoice.status}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-500 mt-0.5">No Linked Maal Invoice (Rs. 0.00)</p>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                    <p className="text-[11px] uppercase tracking-wider text-slate-400">2. Project Extra Revenue (Deal − Maal)</p>
                    <p className="text-lg font-figures font-semibold text-ink-900 mt-0.5">{money(detail.projectCharges)}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Deal ({money(detail.dealAmount)}) − Maal ({money(detail.maalInvoiceAmount)})
                    </p>
                  </div>
                </div>

                {/* Outsource Fabricator Breakdown if Outsource */}
                {detail.projectType === 'OUTSOURCE' && (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs uppercase tracking-wider font-semibold text-indigo-700">Outsource Fabricator Settlement</p>
                        <p className="text-sm font-semibold text-ink-900">
                          {detail.fabricatorName || detail.fabricatorAccount?.name}
                          {detail.fabricatorAccount && (
                            <span className="text-xs font-normal text-slate-500 ml-2">
                              ({detail.fabricatorAccount.code} — {detail.fabricatorAccount.name})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div className="bg-white rounded-lg border border-indigo-100 p-3">
                        <p className="text-xs text-slate-500">Fabricator Quotation</p>
                        <p className="font-figures font-semibold text-ink-900">{money(detail.fabricatorQuotation)}</p>
                      </div>
                      <div className="bg-white rounded-lg border border-indigo-100 p-3">
                        <p className="text-xs text-slate-500">Less: Maal Inv Given</p>
                        <p className="font-figures font-semibold text-slate-700">− {money(detail.maalInvoiceAmount)}</p>
                      </div>
                      <div className="bg-white rounded-lg border border-indigo-100 p-3">
                        <p className="text-xs text-slate-500">Net Payable (Quotation − Maal)</p>
                        <p className="font-figures font-semibold text-indigo-800">{money(detail.fabricatorNetCost)}</p>
                      </div>
                      <div className="bg-white rounded-lg border border-amber-200 p-3">
                        <p className="text-xs text-amber-800">Remaining to Pay Fabricator</p>
                        <p className="font-figures font-semibold text-amber-900">{money(detail.fabricatorBalanceDue)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Key Financial Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3.5">
                    <p className="text-xs text-emerald-700">Net Commission Income ({detail.incomeAccount?.code || '4500'})</p>
                    <p className="text-lg font-semibold font-figures text-emerald-800">{money(detail.netProfit)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3.5">
                    <p className="text-xs text-slate-500">Client Paid So Far</p>
                    <p className="text-lg font-semibold font-figures text-ink-900">
                      {money(detail.clientPaidTotal ?? ((detail.cashAmount || 0) + (detail.bankAmount || 0)))}
                    </p>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3.5">
                    <p className="text-xs text-amber-800">Client Receivable Due ({detail.receivableAccount?.code || '1110'})</p>
                    <p className="text-lg font-semibold font-figures text-amber-900">{money(detail.clientBalance)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3.5">
                    <p className="text-xs text-slate-500">Project Direct Costs</p>
                    <p className="text-lg font-semibold font-figures text-ledger-rose">{money(detail.totalExpenses)}</p>
                  </div>
                </div>

                {/* All Linked Receipts & Journal Entries */}
                <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                  <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                    Generated Accounting Entries (JVs & Receipts)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(detail.receipts || []).map((rcpt) => (
                      <Link
                        key={rcpt._id}
                        to="/receipts"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50/60 text-xs font-medium text-teal-800 hover:bg-teal-100"
                      >
                        <CheckCircle2 size={13} /> {rcpt.receiptNumber} — {money(rcpt.amount)}
                      </Link>
                    ))}
                    {(detail.journalEntries?.length ? detail.journalEntries : detail.journalEntry ? [detail.journalEntry] : []).map((jv) => (
                      <div key={jv._id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                        <JvLink id={jv._id} number={jv.entryNumber} />
                        {jv.reference && <span className="text-slate-600">({jv.reference})</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {detail.expenses?.length > 0 && (
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                          <th className="py-2.5 px-3">Expense Account</th>
                          <th className="py-2.5 px-3">Description</th>
                          <th className="py-2.5 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detail.expenses.map((ex, idx) => (
                          <tr key={idx}>
                            <td className="py-2.5 px-3 font-medium">
                              {ex.account ? `${ex.account.code} — ${ex.account.name}` : 'Direct Expense'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">{ex.label}</td>
                            <td className="py-2.5 px-3 text-right font-figures">{money(ex.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {detail.notes && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm">
                    <p className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Notes</p>
                    <p className="whitespace-pre-wrap text-slate-700">{detail.notes}</p>
                  </div>
                )}

                {canManage && detail.status === 'POSTED' && (
                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 print:hidden">
                    <button
                      onClick={() => navigate(`/projects/${detail._id}/edit`)}
                      className="btn-primary inline-flex items-center gap-1.5"
                    >
                      <Pencil size={15} /> Edit Project Deal
                    </button>
                    <button onClick={() => setConfirmOpen(true)} className="btn-ghost text-ledger-rose inline-flex items-center gap-1.5">
                      <Ban size={15} /> Void Settlement
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          NEW / EDIT PROJECT DEAL FORM (/projects/new & /projects/:id/edit)
         ==================================================================== */}
      {isFormMode && (
        <div>
          <Link to={isEditMode ? `/projects/${id}` : '/projects'} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink-900 mb-4">
            <ArrowLeft size={15} /> {isEditMode ? 'Back to Project Detail' : 'Back to Project Deals'}
          </Link>

          <form onSubmit={submit} className="bg-white rounded-xl border border-slate-200 shadow-card p-5 sm:p-6 flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2">
                <Hammer size={18} className="text-ledger-teal" />
                <h2 className="text-base font-semibold text-ink-900">
                  {isEditMode ? `Edit Project Deal (${editingDoc?.projectNumber || ''})` : 'Project / Door Deal Single-Page Settlement'}
                </h2>
              </div>

              {/* Project Mode Switch: Outsource (Najam Masjid / Rashid) vs In-House (Imran) */}
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setProjectType('OUTSOURCE')}
                  className={`px-3 py-1.5 rounded-md transition ${
                    isOutsource ? 'bg-white text-ink-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-ink-900'
                  }`}
                >
                  🤝 Outsource to Fabricator (Rashid / Sajjad)
                </button>
                <button
                  type="button"
                  onClick={() => setProjectType('IN_HOUSE')}
                  className={`px-3 py-1.5 rounded-md transition ${
                    !isOutsource ? 'bg-white text-ink-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-ink-900'
                  }`}
                >
                  🔨 In-House Direct Deal (Imran Style)
                </button>
              </div>
            </div>

            {error && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}

            {/* SECTION 1: CLIENT & OUR QUOTATION */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink-800 flex items-center gap-1.5">
                  <Users size={15} className="text-ledger-teal" /> 1. Client & Our Quotation (Project Deal)
                </h3>
                <button
                  type="button"
                  onClick={() => setNewCustOpen(true)}
                  className="text-xs text-ledger-teal hover:underline font-medium"
                >
                  + Quick Add New Client
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <label className="block">
                  <span className="block text-xs font-medium text-slate-600 mb-1">Project Client (Customer)</span>
                  <select value={customer} onChange={(e) => setCustomer(e.target.value)} className="input">
                    <option value="">Select client…</option>
                    {activeOrSelected(customers, customer).map((c) => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-xs font-medium text-slate-600 mb-1">Project / Site Name (Ref)</span>
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. Najam Masjid / Ref 1016-R"
                    className="input"
                  />
                </label>

                <label className="block">
                  <span className="block text-xs font-medium text-slate-600 mb-1">Our Quotation / Total Deal (PKR)</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={dealAmount}
                    onChange={(e) => setDealAmount(e.target.value)}
                    placeholder={isOutsource ? 'e.g. 413837' : 'e.g. 45900'}
                    className="input font-figures font-semibold"
                  />
                </label>

                <label className="block">
                  <span className="block text-xs font-medium text-slate-600 mb-1">Date</span>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
                </label>
              </div>
            </div>

            {/* SECTION 2: LINKED MAAL INVOICE (NO CUSTOMER RESTRICTION!) */}
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <h3 className="text-sm font-semibold text-ink-800 flex items-center gap-1.5">
                <Building2 size={15} className="text-ledger-teal" /> 2. Maal Invoice & Revenue Separation (Maal vs Project)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <label className="block sm:col-span-2">
                  <span className="block text-xs font-medium text-slate-600 mb-1">
                    {isOutsource
                      ? 'Maal Invoice Given to Fabricator (e.g. INV-000020 in Rashid’s name)'
                      : 'Maal Invoice Cut for Order (e.g. INV-000013)'}
                  </span>
                  <select value={maalInvoice} onChange={(e) => setMaalInvoice(e.target.value)} className="input">
                    <option value="">None (No Linked Maal Invoice)</option>
                    {availableInvoices.map((inv) => (
                      <option key={inv._id} value={inv._id}>
                        {inv.invoiceNumber} — {inv.customer?.name || 'Customer'} — Total: {money(inv.grandTotal)} (Due: {money(Math.max(0, (inv.grandTotal || 0) - (inv.amountPaid || 0)))}) [{inv.status}]
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-xs font-medium text-slate-600 mb-1">Notes (Optional)</span>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional deal notes…"
                    className="input"
                  />
                </label>
              </div>

              {/* Revenue Split Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Total Client Deal Amount</p>
                  <p className="font-figures font-semibold text-ink-900">{money(dealNum)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Maal Sales Revenue (4000 — Alag)</p>
                  <p className="font-figures font-semibold text-ledger-teal">
                    {money(maalAmount)} {selectedInvoice ? `(${selectedInvoice.invoiceNumber})` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Project Extra Revenue (Deal − Maal)</p>
                  <p className="font-figures font-semibold text-indigo-700">{money(projectCharges)}</p>
                </div>
              </div>
            </div>

            {/* SECTION 3A: OUTSOURCE FABRICATOR QUOTATION & NET SETTLEMENT */}
            {isOutsource && (
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <h3 className="text-sm font-semibold text-indigo-900">
                  3. Outsource Fabricator Quotation & Maal Deduction (Rashid / Sajjad)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="block">
                    <span className="block text-xs font-medium text-slate-600 mb-1">Outsource Fabricator Account</span>
                    <select value={fabricatorAccount} onChange={(e) => setFabricatorAccount(e.target.value)} className="input">
                      <option value="">Select Fabricator Account…</option>
                      {expenseAccounts.map((a) => (
                        <option key={a._id} value={a._id}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="block text-xs font-medium text-slate-600 mb-1">Fabricator Quotation Amount (PKR)</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={fabricatorQuotation}
                      onChange={(e) => setFabricatorQuotation(e.target.value)}
                      placeholder="e.g. 364281"
                      className="input font-figures font-semibold"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-xs font-medium text-slate-600 mb-1">Fabricator Quotation # / Name</span>
                    <input
                      value={fabricatorName}
                      onChange={(e) => setFabricatorName(e.target.value)}
                      placeholder="e.g. Rashid Butt — Quotation #644"
                      className="input"
                    />
                  </label>
                </div>

                {/* Live Formula Box for Outsource Fabricator */}
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3.5 grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Fabricator Quotation</p>
                    <p className="font-figures font-semibold text-ink-900">{money(fabQuoteNum)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Less: Maal Inv Given</p>
                    <p className="font-figures font-semibold text-slate-700">− {money(maalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-indigo-800 font-medium">Net to Pay Fabricator (Quotation − Maal)</p>
                    <p className="font-figures font-bold text-indigo-900">{money(fabNetCost)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-800 font-medium">Your Net Commission (Deal − Quotation)</p>
                    <p className="font-figures font-bold text-emerald-700">{money(netProfit)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className="block">
                    <span className="block text-xs font-medium text-slate-600 mb-1">
                      Cash/Bank Paid to Fabricator Today (Leave 0 if paying on completion)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={fabricatorPaidAmount}
                      onChange={(e) => setFabricatorPaidAmount(e.target.value)}
                      placeholder="0 (Pay Rs. 89,383 when work completes)"
                      className="input font-figures"
                    />
                  </label>
                  {fabPaidNowNum > 0 && (
                    <label className="block">
                      <span className="block text-xs font-medium text-slate-600 mb-1">Paid to Fabricator From</span>
                      <select
                        value={fabricatorPaidFromBankAccount}
                        onChange={(e) => setFabricatorPaidFromBankAccount(e.target.value)}
                        className="input"
                      >
                        <option value="">Select Bank/Cash…</option>
                        {bankAccounts.filter((b) => b.isActive !== false).map((b) => (
                          <option key={b._id} value={b._id}>{b.name}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* SECTION 3B: DIRECT PROJECT EXPENSES (Hardware, Labour, Transport) */}
            <div className="border-t border-slate-200 pt-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-ink-800">
                  {isOutsource ? 'Optional Extra Shop Expenses (If any beyond Fabricator Quotation)' : '3. Direct Project Expenses (Hardware, Labour, Transport)'}
                </h3>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <span>Paid from:</span>
                  <select value={expensePaidFromBankAccount} onChange={(e) => setExpensePaidFromBankAccount(e.target.value)} className="input w-auto py-1 text-xs">
                    <option value="">Select Cash/Bank…</option>
                    {bankAccounts.filter((b) => b.isActive !== false).map((b) => (
                      <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              {expenses.map((exp, i) => (
                <div key={exp._key} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    value={exp.label}
                    onChange={(e) => updateExpense(i, { label: e.target.value })}
                    placeholder="Expense description…"
                    className="input col-span-12 sm:col-span-4 text-sm"
                  />
                  <select
                    value={exp.account}
                    onChange={(e) => updateExpense(i, { account: e.target.value })}
                    className="input col-span-12 sm:col-span-5 text-sm"
                  >
                    <option value="">Select Expense Account…</option>
                    {expenseAccounts.map((a) => <option key={a._id} value={a._id}>{a.code} — {a.name}</option>)}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={exp.amount}
                    onChange={(e) => updateExpense(i, { amount: e.target.value })}
                    placeholder="0"
                    className="input font-figures text-right col-span-10 sm:col-span-2"
                  />
                  <button
                    type="button"
                    onClick={() => setExpenses(expenses.filter((_, idx) => idx !== i))}
                    className="text-slate-400 hover:text-ledger-rose col-span-2 sm:col-span-1 flex justify-center"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setExpenses([...expenses, newExpense()])} className="text-xs text-ledger-teal hover:underline">
                + Add expense line
              </button>
            </div>

            {/* SECTION 4: ADVANCE / PAYMENTS RECEIVED FROM CLIENT */}
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <h3 className="text-sm font-semibold text-ink-800">4. Advance / Payments Received from Client</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="block text-xs font-medium text-slate-600 mb-1">Cash Advance Received</span>
                    <input type="number" min="0" step="any" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} placeholder="0" className="input font-figures" />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-medium text-slate-600 mb-1">Deposited to (Cash)</span>
                    <select value={cashBankAccount} onChange={(e) => setCashBankAccount(e.target.value)} className="input">
                      <option value="">Select…</option>
                      {bankAccounts.filter((b) => b.isActive !== false).map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="block text-xs font-medium text-slate-600 mb-1">Bank Advance / Transfer</span>
                    <input type="number" min="0" step="any" value={bankAmount} onChange={(e) => setBankAmount(e.target.value)} placeholder="e.g. 270000" className="input font-figures" />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-medium text-slate-600 mb-1">Deposited to (Bank)</span>
                    <select value={bankBankAccount} onChange={(e) => setBankBankAccount(e.target.value)} className="input">
                      <option value="">Select…</option>
                      {bankAccounts.filter((b) => b.isActive !== false).map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            </div>

            {/* SECTION 5: LEDGER ACCOUNTS */}
            <div className="border-t border-slate-200 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-medium text-slate-600 mb-1">Commission / Project Income Account (Default: 4500)</span>
                <select value={incomeAccount} onChange={(e) => setIncomeAccount(e.target.value)} className="input">
                  <option value="">Select Income Account…</option>
                  {incomeAccounts.map((a) => <option key={a._id} value={a._id}>{a.code} — {a.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-600 mb-1">Project Receivable Account (Default: 1110)</span>
                <select value={receivableAccount} onChange={(e) => setReceivableAccount(e.target.value)} className="input">
                  <option value="">Select Receivable Account…</option>
                  {assetAccounts.map((a) => <option key={a._id} value={a._id}>{a.code} — {a.name}</option>)}
                </select>
              </label>
            </div>

            {/* LIVE COMPLETE SUMMARY & RECEIVABLES PREVIEW */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Live Accounting & Revenue Summary (Auto-Calculated)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
                <div className="bg-white rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">1. Maal Revenue (4000)</p>
                  <p className="font-figures font-semibold text-ledger-teal">{money(maalAmount)}</p>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">2. Project Rev (Alag)</p>
                  <p className="font-figures font-semibold text-indigo-700">{money(projectCharges)}</p>
                </div>
                <div className="bg-white rounded-lg border border-emerald-200 p-3">
                  <p className="text-xs text-emerald-700 font-medium">3. Net Commission (4500)</p>
                  <p className="font-figures font-bold text-emerald-700">{money(netProfit)}</p>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Client Advance Recv</p>
                  <p className="font-figures font-semibold text-ink-900">{money(totalReceived)}</p>
                </div>
                <div className="bg-white rounded-lg border border-amber-200 p-3">
                  <p className="text-xs text-amber-800 font-medium">Client Receivable (1110)</p>
                  <p className="font-figures font-bold text-amber-800">{money(remainingClientBalance)}</p>
                </div>
                {isOutsource ? (
                  <div className="bg-white rounded-lg border border-indigo-200 p-3">
                    <p className="text-xs text-indigo-800 font-medium">Fabricator Payable Due</p>
                    <p className="font-figures font-bold text-indigo-900">{money(fabBalanceDue)}</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">Net Cash in Drawer</p>
                    <p className="font-figures font-semibold text-ink-900">{money(netCashInDrawer)}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => navigate(isEditMode ? `/projects/${id}` : '/projects')} className="btn-ghost">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="btn-teal disabled:opacity-60">
                {submitting ? 'Saving…' : isEditMode ? 'Save Changes & Update JVs' : 'Post Project Deal'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick Add New Client Modal */}
      <Modal open={newCustOpen} onClose={() => setNewCustOpen(false)} title="Quick Add Project Client">
        <form onSubmit={handleQuickAddCustomer} className="space-y-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Client / Masjid / Customer Name</span>
            <input
              value={newCustName}
              onChange={(e) => setNewCustName(e.target.value)}
              placeholder="e.g. Abdullah Sahab (Najam Masjid)"
              className="input"
              required
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Phone (Optional)</span>
            <input
              value={newCustPhone}
              onChange={(e) => setNewCustPhone(e.target.value)}
              placeholder="03xx-xxxxxxx"
              className="input"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setNewCustOpen(false)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={newCustBusy} className="btn-primary">
              {newCustBusy ? 'Saving…' : 'Create Client'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Receive Client Balance Modal */}
      <Modal open={clientPayOpen} onClose={() => setClientPayOpen(false)} title="Receive Client Project Balance">
        <form onSubmit={handleReceiveClient} className="space-y-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Amount Received (PKR)</span>
            <input
              type="number"
              min="1"
              step="any"
              value={clientPayAmt}
              onChange={(e) => setClientPayAmt(e.target.value)}
              className="input font-figures"
              required
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Deposited To (Bank / Cash)</span>
            <select value={clientPayBank} onChange={(e) => setClientPayBank(e.target.value)} className="input" required>
              <option value="">Select account…</option>
              {bankAccounts.filter((b) => b.isActive !== false).map((b) => (
                <option key={b._id} value={b._id}>{b.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Date</span>
            <input type="date" value={clientPayDate} onChange={(e) => setClientPayDate(e.target.value)} className="input" required />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Reference</span>
            <input value={clientPayRef} onChange={(e) => setClientPayRef(e.target.value)} className="input" />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setClientPayOpen(false)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={clientPayBusy} className="btn-primary">
              {clientPayBusy ? 'Posting…' : 'Post Client Receipt'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Pay Fabricator Balance Modal */}
      <Modal open={fabPayOpen} onClose={() => setFabPayOpen(false)} title="Pay Outsource Fabricator Balance">
        <form onSubmit={handlePayFabricator} className="space-y-3">
          <p className="text-xs text-slate-500">
            Net Payable after deducting Maal Invoice: <span className="font-figures font-semibold text-ink-900">{money(detail?.fabricatorBalanceDue)}</span>
          </p>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Amount Paid to Fabricator (PKR)</span>
            <input
              type="number"
              min="1"
              step="any"
              value={fabPayAmt}
              onChange={(e) => setFabPayAmt(e.target.value)}
              className="input font-figures"
              required
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Paid From (Bank / Cash)</span>
            <select value={fabPayBank} onChange={(e) => setFabPayBank(e.target.value)} className="input" required>
              <option value="">Select account…</option>
              {bankAccounts.filter((b) => b.isActive !== false).map((b) => (
                <option key={b._id} value={b._id}>{b.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Date</span>
            <input type="date" value={fabPayDate} onChange={(e) => setFabPayDate(e.target.value)} className="input" required />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Reference</span>
            <input value={fabPayRef} onChange={(e) => setFabPayRef(e.target.value)} className="input" />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setFabPayOpen(false)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={fabPayBusy} className="btn-teal">
              {fabPayBusy ? 'Posting…' : 'Post Fabricator Payment'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        title="Void Project Settlement"
        message="Void this project settlement? All linked Maal receipts, invoice offsets, and journal entries will be reversed."
        confirmLabel={voidBusy ? 'Voiding…' : 'Void'}
        danger
        onConfirm={handleVoid}
        onCancel={() => setConfirmOpen(false)}
      />
    </PageLayout>
  );
}
