import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Orders from './pages/Orders';
import Invoices from './pages/Invoices';
import Bills from './pages/Bills';
import Receipts from './pages/Receipts';
import Payments from './pages/Payments';
import Products from './pages/Products';
import Warehouses from './pages/Warehouses';
import Bank from './pages/Bank';
import ChartOfAccounts from './pages/ChartOfAccounts';
import Journal from './pages/Journal';
import Users from './pages/Users';

import TrialBalance from './pages/reports/TrialBalance';
import ProfitAndLoss from './pages/reports/ProfitAndLoss';
import BalanceSheet from './pages/reports/BalanceSheet';
import StockSummary from './pages/reports/StockSummary';
import PendingOrders from './pages/reports/PendingOrders';
import SalesJournal from './pages/reports/SalesJournal';
import PurchaseJournal from './pages/reports/PurchaseJournal';
import BankActivity from './pages/reports/BankActivity';
import GeneralLedger from './pages/reports/GeneralLedger';
import CustomerLedger from './pages/reports/CustomerLedger';
import SupplierLedger from './pages/reports/SupplierLedger';
import AgedReceivables from './pages/reports/AgedReceivables';
import AgedPayables from './pages/reports/AgedPayables';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

        <Route path="/customers" element={<ProtectedRoute permission={['sales.view', 'sales.manage']}><Customers /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute permission={['sales.view', 'sales.manage']}><Orders /></ProtectedRoute>} />
        <Route path="/invoices" element={<ProtectedRoute permission={['sales.view', 'sales.manage']}><Invoices /></ProtectedRoute>} />
        <Route path="/receipts" element={<ProtectedRoute permission={['sales.view', 'sales.manage']}><Receipts /></ProtectedRoute>} />

        <Route path="/suppliers" element={<ProtectedRoute permission={['purchases.view', 'purchases.manage']}><Suppliers /></ProtectedRoute>} />
        <Route path="/bills" element={<ProtectedRoute permission={['purchases.view', 'purchases.manage']}><Bills /></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute permission={['purchases.view', 'purchases.manage']}><Payments /></ProtectedRoute>} />

        <Route path="/products" element={<ProtectedRoute permission={['inventory.view', 'inventory.manage']}><Products /></ProtectedRoute>} />
        <Route path="/warehouses" element={<ProtectedRoute permission={['inventory.view', 'inventory.manage']}><Warehouses /></ProtectedRoute>} />

        <Route path="/bank" element={<ProtectedRoute permission={['banking.view', 'banking.manage']}><Bank /></ProtectedRoute>} />
        <Route path="/chart-of-accounts" element={<ProtectedRoute permission={['accounting.view', 'accounting.manage']}><ChartOfAccounts /></ProtectedRoute>} />
        <Route path="/journal" element={<ProtectedRoute permission={['accounting.view', 'accounting.manage']}><Journal /></ProtectedRoute>} />

        <Route path="/reports/trial-balance" element={<ProtectedRoute permission="reports.view"><TrialBalance /></ProtectedRoute>} />
        <Route path="/reports/profit-and-loss" element={<ProtectedRoute permission="reports.view"><ProfitAndLoss /></ProtectedRoute>} />
        <Route path="/reports/balance-sheet" element={<ProtectedRoute permission="reports.view"><BalanceSheet /></ProtectedRoute>} />
        <Route path="/reports/stock-summary" element={<ProtectedRoute permission="reports.view"><StockSummary /></ProtectedRoute>} />
        <Route path="/reports/pending-orders" element={<ProtectedRoute permission="reports.view"><PendingOrders /></ProtectedRoute>} />
        <Route path="/reports/sales-journal" element={<ProtectedRoute permission="reports.view"><SalesJournal /></ProtectedRoute>} />
        <Route path="/reports/purchase-journal" element={<ProtectedRoute permission="reports.view"><PurchaseJournal /></ProtectedRoute>} />
        <Route path="/reports/bank-activity" element={<ProtectedRoute permission="reports.view"><BankActivity /></ProtectedRoute>} />
        <Route path="/reports/general-ledger" element={<ProtectedRoute permission="reports.view"><GeneralLedger /></ProtectedRoute>} />
        <Route path="/reports/customer-ledger" element={<ProtectedRoute permission="reports.view"><CustomerLedger /></ProtectedRoute>} />
        <Route path="/reports/supplier-ledger" element={<ProtectedRoute permission="reports.view"><SupplierLedger /></ProtectedRoute>} />
        <Route path="/reports/aged-receivables" element={<ProtectedRoute permission="reports.view"><AgedReceivables /></ProtectedRoute>} />
        <Route path="/reports/aged-payables" element={<ProtectedRoute permission="reports.view"><AgedPayables /></ProtectedRoute>} />

        <Route path="/users" element={<ProtectedRoute permission="users.manage"><Users /></ProtectedRoute>} />
      </Routes>
    </>
  );
}
