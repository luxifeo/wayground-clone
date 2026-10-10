import { NavLink, useNavigate } from 'react-router-dom';
import { House, BookOpen, ChartPie, Search, LogOut, Gamepad2, Sparkles } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { Logo, LogoMark, Menu, MenuItem } from './ui.jsx';

const NAV = [
  { to: '/admin', label: 'Home', icon: House, end: true },
  { to: '/admin/library', label: 'My library', icon: BookOpen },
  { to: '/admin/reports', label: 'Reports', icon: ChartPie },
  { to: '/admin/explore', label: 'Explore', icon: Search },
];

function UserBadge({ compact }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const initials = (user?.name || '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <Menu
      align="left"
      className="mt-auto"
      trigger={(
        <button className={`flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-slate-100 ${compact ? 'justify-center' : ''}`}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-450 text-sm font-bold text-white">{initials}</span>
          {!compact && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{user?.name}</span>
              <span className="block truncate text-xs text-slate-500">{user?.email}</span>
            </span>
          )}
        </button>
      )}
    >
      <div className="border-b border-slate-100 px-3.5 py-2 text-xs text-slate-500">Signed in as <b>{user?.email}</b></div>
      <MenuItem icon={LogOut} onClick={() => { logout(); nav('/'); }}>Log out</MenuItem>
    </Menu>
  );
}

export default function AdminLayout({ children, compact = false, header }) {
  return (
    <div className="flex h-full">
      {compact ? (
        <aside className="no-print flex w-[68px] shrink-0 flex-col items-center gap-1 border-r border-slate-200 bg-white py-4">
          <NavLink to="/admin" className="mb-4"><LogoMark className="h-7 w-7" /></NavLink>
          {NAV.map((n) => (
            <NavLink
              key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => `flex w-14 flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium ${isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <n.icon className="h-4 w-4" />{n.label}
            </NavLink>
          ))}
          <NavLink to="/join" target="_blank" className="flex w-14 flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium text-slate-500 hover:bg-slate-50">
            <Gamepad2 className="h-4 w-4" />Join
          </NavLink>
          <UserBadge compact />
        </aside>
      ) : (
        <aside className="no-print flex w-[210px] shrink-0 flex-col border-r border-slate-200 bg-slate-50/60 px-3 py-4">
          <NavLink to="/admin" className="mb-6 px-1"><Logo small /></NavLink>
          <nav className="flex flex-col gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${isActive ? 'border border-slate-200 bg-white font-semibold text-slate-900 shadow-card' : 'text-slate-600 hover:bg-white'}`}
              >
                <n.icon className="h-4 w-4" />{n.label}
              </NavLink>
            ))}
            <div className="my-2 border-t border-slate-200" />
            <a href="/join" target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-white">
              <Gamepad2 className="h-4 w-4" />Join a game
            </a>
          </nav>
          <div className="mt-auto rounded-xl bg-gradient-to-br from-violet-100 to-brand-50 p-3 text-xs text-slate-600">
            <div className="mb-1 flex items-center gap-1 font-bold text-violet-700"><Sparkles className="h-3.5 w-3.5" /> AI powered by Gemma</div>
            Generate quizzes from a topic, a document or a photo of a worksheet.
          </div>
          <div className="mt-3"><UserBadge /></div>
        </aside>
      )}
      <main className="flex min-w-0 flex-1 flex-col overflow-auto scrollbar-thin">
        {header}
        {children}
      </main>
    </div>
  );
}
