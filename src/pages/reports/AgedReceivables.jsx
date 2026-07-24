import { useEffect, useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import DataTable from '../../components/DataTable';

export default function AgedReceivables() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get('/reports/aged-receivables').then((res) => setRows(res.data)); }, []);

  const money = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

  const columns = [
    { key: 'customer', label: 'Customer' },
    { key: 'invoiceNumber', label: 'Invoice #' },
    { key: 'dueDate', label: 'Due Date', render: (r) => r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—' },
    { key: 'daysOverdue', label: 'Days Overdue', align: 'right', mono: true },
    { key: 'bucket', label: 'Bucket' },
    { key: 'balanceDue', label: 'Balance Due', align: 'right', mono: true, render: (r) => money(r.balanceDue) }
  ];

  return (
    <PageLayout title="Aged Receivables">
      <DataTable columns={columns} data={rows} />
    </PageLayout>
  );
}
