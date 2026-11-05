import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function PageLayout({ title, actions, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">
          {actions && <div className="flex flex-wrap justify-end mb-4 gap-2">{actions}</div>}
          {children}
        </main>
      </div>
    </div>
  );
}
