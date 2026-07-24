import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function PageLayout({ title, actions, children }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} />
        <main className="flex-1 p-6 overflow-x-hidden">
          {actions && <div className="flex justify-end mb-4 gap-2">{actions}</div>}
          {children}
        </main>
      </div>
    </div>
  );
}
