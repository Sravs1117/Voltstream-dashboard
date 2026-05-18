import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  Zap, LayoutDashboard, BarChart3, SlidersHorizontal, FileText,
  Bell, Search
} from 'lucide-react';
import FloatingChat from './FloatingChat';

const navItems = [
  { path: '/', label: 'Live Dashboard', icon: LayoutDashboard },
  { path: '/history', label: 'Usage History', icon: BarChart3 },
  { path: '/control', label: 'Smart Control', icon: SlidersHorizontal },
  { path: '/billing', label: 'Billing', icon: FileText },
];

export default function Layout() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/control?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <>
      <div className='flex h-screen bg-slate-50 overflow-hidden' style={{ fontFamily: "'Outfit', sans-serif" }}>
        <aside className='w-64 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white z-20'>
          <div className='h-24 flex items-center px-6 gap-4'>
            <div className='w-10 h-10 rounded-xl flex items-center justify-center bg-slate-900'>
              <Zap size={20} className='text-white' />
            </div>
            <h1 className='text-xl font-bold text-slate-800 tracking-tight'>VoltStream</h1>
          </div>
          <nav className='flex-1 px-4 py-6 space-y-2'>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    'flex items-center gap-4 px-4 py-3 rounded-xl transition-all ' +
                    (isActive ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100')
                  }
                >
                  <Icon size={18} />
                  <span className='text-sm font-semibold'>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </aside>
        <main className='flex-1 flex flex-col overflow-auto bg-slate-50'>
          <header className='h-20 flex-shrink-0 flex items-center justify-between px-10 bg-white/50 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10'>
            <h2 className='text-lg font-bold text-slate-800'>Operational Pulse</h2>
            <div className='flex items-center gap-6'>
              <div className='relative group'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-500 transition-colors' size={16} />
                <input
                  type='text'
                  placeholder='Find device and hit Enter...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearch}
                  className='pl-10 pr-4 py-2 rounded-xl bg-slate-100/50 border border-transparent focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 text-sm w-64 transition-all'
                />
              </div>
              <div className='relative'>
                <div
                  onClick={() => alert("You have 3 new alerts:\n\n1. Peak Load Protection activated.\n2. Invoices are ready.\n3. Server restarted.")}
                  className='w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 cursor-pointer hover:bg-slate-50 hover:text-emerald-500 transition-colors shadow-sm'
                >
                  <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
                  <Bell size={18} />
                </div>
              </div>
            </div>
          </header>
          <div className='p-10'>
            <Outlet />
          </div>
        </main>
      </div>
      <FloatingChat />
    </>
  );
}

