import { useEffect, useState } from 'react';
import api from '../../api/client';
import PageLayout from '../../components/PageLayout';
import DataTable from '../../components/DataTable';
import { formatMoney } from '../../components/ui';

export default function PendingOrders() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/reports/pending-orders')
      .then((res) => setRows(res.data))
      .catch(() => setError('Could not load pending orders.'));
  }, []);

  const money = formatMoney;

  const columns = [
    { key: 'orderNumber', label: 'Order #' },
    { key: 'customer', label: 'Customer' },
    { key: 'customerCode', label: 'Customer Code' },
    { key: 'date', label: 'Date', render: (r) => r.date ? new Date(r.date).toLocaleDateString() : '—' },
    { key: 'dueDate', label: 'Due Date', render: (r) => r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—' },
    { key: 'status', label: 'Status' },
    { key: 'grandTotal', label: 'Order Total', align: 'right', mono: true, render: (r) => money(r.grandTotal) },
    { key: 'amountInvoiced', label: 'Invoiced', align: 'right', mono: true, render: (r) => money(r.amountInvoiced) },
    { key: 'balanceDue', label: 'Balance Due', align: 'right', mono: true, render: (r) => money(r.balanceDue) }
  ];

  return (
    <PageLayout title="Pending Orders">
      {error && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{error}</div>}
      <DataTable columns={columns} data={rows} emptyMessage="No pending orders found." />
    </PageLayout>
  );
}
