import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function PageLayout({ title, actions, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mainRef = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden print:h-auto print:overflow-visible">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 min-h-0 print:min-h-auto">
        <Topbar title={title} onMenuClick={() => setSidebarOpen(true)} />
        <main ref={mainRef} className="flex-1 p-4 sm:p-6 overflow-y-auto overflow-x-hidden print:overflow-visible">
          {actions && <div className="flex flex-wrap justify-end mb-4 gap-2">{actions}</div>}
          {children}
        </main>
      </div>
    </div>
  );
}
