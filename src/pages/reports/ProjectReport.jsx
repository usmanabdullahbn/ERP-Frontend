import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import StatCard from '../../components/StatCard';
import ReportExportButtons from '../../components/ReportExportButtons';
import { downloadReportPdf, downloadReportExcel } from '../../components/reportExport';
import { formatMoney, formatDate, firstOfMonthLocalISODate, lastOfMonthLocalISODate } from '../../components/ui';

export default function ProjectReport() {
  const [data, setData] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [projectType, setProjectType] = useState('');
  const [from, setFrom] = useState(firstOfMonthLocalISODate());
  const [to, setTo] = useState(lastOfMonthLocalISODate());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/customers').then((res) => setCustomers(res.data)).catch(() => {});
  }, []);

  const run = () => {
    setLoading(true);
    setError('');
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (customerId) params.customerId = customerId;
    if (projectType) params.projectType = projectType;
    api.get('/reports/projects', { params })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Could not load project report.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { run(); }, []);

  const money = formatMoney;
  const rows = data?.rows || [];
  const s = data?.summary || {};
  const subtitle = `Period: ${from ? formatDate(from) : 'inception'} to ${to ? formatDate(to) : 'today'}`;

  const exportColumns = [
    { key: 'projectNumber', label: 'Project #' },
    { key: 'projectType', label: 'Type' },
    { key: 'date', label: 'Date', format: 'date' },
    { key: 'customer', label: 'Client' },
    { key: 'maalInvoice', label: 'Maal Inv' },
    { key: 'dealAmount', label: 'Client Deal', align: 'right', format: 'money' },
    { key: 'maalInvoiceAmount', label: 'Maal Revenue', align: 'right', format: 'money' },
    { key: 'projectCharges', label: 'Project Revenue', align: 'right', format: 'money' },
    { key: 'totalExpenses', label: 'Project Cost', align: 'right', format: 'money' },
    { key: 'netProfit', label: 'Commission (4500)', align: 'right', format: 'money' },
    { key: 'clientBalance', label: 'Client Receivable', align: 'right', format: 'money' },
    { key: 'fabricatorBalanceDue', label: 'Fabricator Payable', align: 'right', format: 'money' }
  ];

  const exportRows = rows.map((r) => ({
    projectNumber: r.projectNumber,
    projectType: r.projectType === 'OUTSOURCE' ? 'Outsource' : 'In-House',
    date: r.date,
    customer: r.customer?.name || '',
    maalInvoice: r.maalInvoice?.invoiceNumber || '—',
    dealAmount: r.dealAmount,
    maalInvoiceAmount: r.maalInvoiceAmount || 0,
    projectCharges: r.projectCharges,
    totalExpenses: r.totalExpenses,
    netProfit: r.netProfit,
    clientBalance: r.clientBalance,
    fabricatorBalanceDue: r.fabricatorBalanceDue || 0
  }));

  const exportTotals = [
    'Total', '', '', '', '',
    money(s.totalDealAmount),
    money(s.totalMaalAmount),
    money(s.totalProjectCharges),
    money(s.totalExpenses),
    money(s.totalNetProfit),
    money(s.totalClientBalance),
    money(s.totalFabricatorBalanceDue)
  ];

  return (
    <PageLayout
      title="Project Settlements Report"
      actions={data && (
        <ReportExportButtons
          onPdf={() => downloadReportPdf({ title: 'Project Settlements Report', subtitle, columns: exportColumns, rows: exportRows, totals: exportTotals })}
          onExcel={() => downloadReportExcel({ title: 'Project Settlements Report', subtitle, columns: exportColumns, rows: exportRows, totals: exportTotals })}
        />
      )}
    >
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}

      <div className="flex items-end gap-3 mb-5 flex-wrap">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Client</span>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input w-auto min-w-[180px]">
            <option value="">All clients</option>
            {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Type</span>
          <select value={projectType} onChange={(e) => setProjectType(e.target.value)} className="input w-auto min-w-[150px]">
            <option value="">All types</option>
            <option value="OUTSOURCE">Outsource</option>
            <option value="IN_HOUSE">In-House</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
        </label>
        <button onClick={run} disabled={loading} className="btn-primary disabled:opacity-60">{loading ? 'Running…' : 'Run Report'}</button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
            <StatCard label="Total Deal Value" value={money(s.totalDealAmount)} />
            <StatCard label="Maal Revenue (Alag)" value={money(s.totalMaalAmount)} />
            <StatCard label="Project Revenue (Alag)" value={money(s.totalProjectCharges)} />
            <StatCard label="Net Commission (4500)" value={money(s.totalNetProfit)} tone="positive" />
            <StatCard label="Client Receivable" value={money(s.totalClientBalance)} tone={s.totalClientBalance > 0 ? 'warning' : 'default'} />
            <StatCard label="Fabricator Payable" value={money(s.totalFabricatorBalanceDue)} tone={s.totalFabricatorBalanceDue > 0 ? 'warning' : 'default'} />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-3">Project #</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Maal Inv</th>
                  <th className="px-4 py-3 text-right">Client Deal</th>
                  <th className="px-4 py-3 text-right">Maal Rev</th>
                  <th className="px-4 py-3 text-right">Project Rev</th>
                  <th className="px-4 py-3 text-right">Project Cost</th>
                  <th className="px-4 py-3 text-right">Commission</th>
                  <th className="px-4 py-3 text-right">Client Bal</th>
                  <th className="px-4 py-3 text-right">Fab Payable</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-figures font-medium">
                      <Link to={`/projects/${r._id}`} className="text-ledger-teal hover:underline">{r.projectNumber}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {r.projectType === 'OUTSOURCE' ? 'Outsource' : 'In-House'}
                    </td>
                    <td className="px-4 py-2.5">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5">{r.customer?.name}</td>
                    <td className="px-4 py-2.5 font-figures">{r.maalInvoice?.invoiceNumber || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-figures">{money(r.dealAmount)}</td>
                    <td className="px-4 py-2.5 text-right font-figures text-ledger-teal">{money(r.maalInvoiceAmount)}</td>
                    <td className="px-4 py-2.5 text-right font-figures text-indigo-700">{money(r.projectCharges)}</td>
                    <td className="px-4 py-2.5 text-right font-figures text-ledger-rose">{money(r.totalExpenses)}</td>
                    <td className="px-4 py-2.5 text-right font-figures font-medium text-emerald-700">{money(r.netProfit)}</td>
                    <td className="px-4 py-2.5 text-right font-figures">{money(r.clientBalance)}</td>
                    <td className="px-4 py-2.5 text-right font-figures">{r.projectType === 'OUTSOURCE' ? money(r.fabricatorBalanceDue) : '—'}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={12} className="px-4 py-10 text-center text-slate-400">No project settlements found for this period.</td></tr>
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-ink-800 font-semibold">
                    <td className="px-4 py-3" colSpan={5}>Total</td>
                    <td className="px-4 py-3 text-right font-figures">{money(s.totalDealAmount)}</td>
                    <td className="px-4 py-3 text-right font-figures">{money(s.totalMaalAmount)}</td>
                    <td className="px-4 py-3 text-right font-figures">{money(s.totalProjectCharges)}</td>
                    <td className="px-4 py-3 text-right font-figures">{money(s.totalExpenses)}</td>
                    <td className="px-4 py-3 text-right font-figures">{money(s.totalNetProfit)}</td>
                    <td className="px-4 py-3 text-right font-figures">{money(s.totalClientBalance)}</td>
                    <td className="px-4 py-3 text-right font-figures">{money(s.totalFabricatorBalanceDue)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </PageLayout>
  );
}
