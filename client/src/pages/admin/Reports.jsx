import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ClipboardCheck, EllipsisVertical, Trash2, ChartPie, Square } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout.jsx';
import { get, del, post } from '../../lib/api.js';
import { Empty, Menu, MenuItem, useToast } from '../../components/ui.jsx';

export default function Reports() {
  const nav = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState('all');
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [list, setList] = useState(null);
  const load = () => {
    const p = new URLSearchParams();
    if (tab !== 'all') p.set('status', tab);
    if (kind) p.set('kind', kind);
    if (q) p.set('q', q);
    get(`/sessions?${p}`).then((d) => setList(d.sessions)).catch((e) => toast(e.message, 'error'));
  };
  useEffect(load, [tab, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AdminLayout compact>
      <div className="px-6 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Reports</h1>
          <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex w-72 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by report name" className="flex-1 text-sm outline-none" />
          </form>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {[['all', 'All'], ['running', 'Running'], ['completed', 'Completed']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === k ? 'border border-slate-300 shadow-card' : 'text-slate-600'}`}>{l}{k === 'all' && list && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs">{list.length}</span>}</button>
          ))}
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="input ml-auto w-44"><option value="">All reports</option><option value="live">Live sessions</option><option value="homework">Homework</option></select>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr><th className="p-3">Activity name</th><th className="p-3">Date</th><th className="p-3">Type</th><th className="p-3">Participants</th><th className="p-3">Accuracy</th><th className="p-3">Code</th><th className="p-3">Status</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {(list || []).map((s) => (
                <tr key={s.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => nav(`/admin/reports/${s.id}`)}>
                  <td className="p-3"><div className="font-semibold">{s.title}</div><div className="flex items-center gap-1 text-xs text-slate-500"><ClipboardCheck className="h-3.5 w-3.5 text-green-600" />Assessment · {s.question_count} Qs</div></td>
                  <td className="p-3">{new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                  <td className="p-3">{s.kind === 'homework' ? 'Homework' : s.pace === 'teacher' ? 'Teacher led' : 'Student paced'}{s.game_type === 'test' && ' · Test'}</td>
                  <td className="p-3">{s.participants}</td>
                  <td className="p-3">{s.accuracy === null ? '–' : <span className={`font-bold ${s.accuracy >= 70 ? 'text-emerald-600' : s.accuracy >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{s.accuracy}%</span>}</td>
                  <td className="p-3 font-mono">{s.code}</td>
                  <td className="p-3">{s.status === 'ended' ? <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold">Completed</span> : <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">{s.status === 'lobby' ? 'In lobby' : 'Running'}</span>}{s.deadline && s.status !== 'ended' && <div className="text-[11px] text-slate-400">until {new Date(s.deadline).toLocaleString()}</div>}</td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <Menu trigger={<button className="btn-outline btn-sm px-2"><EllipsisVertical className="h-4 w-4" /></button>}>
                      <MenuItem icon={ChartPie} onClick={() => nav(`/admin/reports/${s.id}`)}>Open report</MenuItem>
                      {s.status !== 'ended' && s.kind === 'live' && <MenuItem onClick={() => nav(`/host/${s.id}`)}>Open host screen</MenuItem>}
                      {s.status !== 'ended' && <MenuItem icon={Square} onClick={async () => { await post(`/sessions/${s.id}/end`); load(); }}>End now</MenuItem>}
                      <MenuItem icon={Trash2} danger onClick={async () => { if (confirm('Delete this report?')) { await del(`/sessions/${s.id}`); load(); } }}>Delete</MenuItem>
                    </Menu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list && !list.length && <Empty icon={ChartPie} title="No reports yet">Host or assign a quiz and the results will show up here. <Link to="/admin/library" className="font-semibold text-violet-700">Go to library</Link></Empty>}
        </div>
      </div>
    </AdminLayout>
  );
}
