import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext';

// Legacy global print helpers for older builds/pages that call `printInvoice`/`printBill`
if (typeof window !== 'undefined') {
  window.printInvoice = () => window.print();
  window.printBill = () => window.print();
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
