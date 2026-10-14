import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ClipboardCheck, EllipsisVertical, Trash2, ChartPie, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../components/AdminLayout.jsx';
import { get, del, post } from '../../lib/api.js';
import { fmtDate, fmtDay } from '../../i18n/index.js';
import { Empty, Menu, MenuItem, useToast } from '../../components/ui.jsx';

export default function Reports() {
  const { t } = useTranslation('reports');
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
          <h1 className="text-xl font-bold">{t('title')}</h1>
          <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex w-72 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPlaceholder')} className="flex-1 text-sm outline-none" />
          </form>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {[['all', t('tabs.all')], ['running', t('common:status.running')], ['completed', t('common:status.completed')]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === k ? 'border border-slate-300 shadow-card' : 'text-slate-600'}`}>{l}{k === 'all' && list && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs">{list.length}</span>}</button>
          ))}
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="input ml-auto w-44"><option value="">{t('kind.all')}</option><option value="live">{t('kind.live')}</option><option value="homework">{t('common:session.homework')}</option></select>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr><th className="p-3">{t('cols.name')}</th><th className="p-3">{t('cols.date')}</th><th className="p-3">{t('cols.type')}</th><th className="p-3">{t('cols.participants')}</th><th className="p-3">{t('cols.accuracy')}</th><th className="p-3">{t('cols.code')}</th><th className="p-3">{t('cols.status')}</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {(list || []).map((s) => (
                <tr key={s.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => nav(`/admin/reports/${s.id}`)}>
                  <td className="p-3"><div className="font-semibold">{s.title}</div><div className="flex items-center gap-1 text-xs text-slate-500"><ClipboardCheck className="h-3.5 w-3.5 text-green-600" />{t('assessment')} · {t('common:count.qs', { count: s.question_count })}</div></td>
                  <td className="p-3">{fmtDay(s.created_at, { month: 'short', day: 'numeric' })}</td>
                  <td className="p-3">{s.kind === 'homework' ? t('common:session.homework') : s.pace === 'teacher' ? t('common:session.teacherLed') : t('common:session.studentPaced')}{s.game_type === 'test' && ` · ${t('test')}`}</td>
                  <td className="p-3">{s.participants}</td>
                  <td className="p-3">{s.accuracy === null ? '–' : <span className={`font-bold ${s.accuracy >= 70 ? 'text-emerald-600' : s.accuracy >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{s.accuracy}%</span>}</td>
                  <td className="p-3 font-mono">{s.code}</td>
                  <td className="p-3">{s.status === 'ended' ? <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold">{t('common:status.completed')}</span> : <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">{s.status === 'lobby' ? t('common:status.inLobby') : t('common:status.running')}</span>}{s.deadline && s.status !== 'ended' && <div className="text-[11px] text-slate-400">{t('until', { date: fmtDate(s.deadline) })}</div>}</td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <Menu trigger={<button className="btn-outline btn-sm px-2"><EllipsisVertical className="h-4 w-4" /></button>}>
                      <MenuItem icon={ChartPie} onClick={() => nav(`/admin/reports/${s.id}`)}>{t('menu.open')}</MenuItem>
                      {s.status !== 'ended' && s.kind === 'live' && <MenuItem onClick={() => nav(`/host/${s.id}`)}>{t('menu.host')}</MenuItem>}
                      {s.status !== 'ended' && <MenuItem icon={Square} onClick={async () => { await post(`/sessions/${s.id}/end`); load(); }}>{t('menu.end')}</MenuItem>}
                      <MenuItem icon={Trash2} danger onClick={async () => { if (confirm(t('confirmDelete'))) { await del(`/sessions/${s.id}`); load(); } }}>{t('common:actions.delete')}</MenuItem>
                    </Menu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list && !list.length && <Empty icon={ChartPie} title={t('empty.title')}>{t('empty.text')} <Link to="/admin/library" className="font-semibold text-violet-700">{t('empty.library')}</Link></Empty>}
        </div>
      </div>
    </AdminLayout>
  );
}
