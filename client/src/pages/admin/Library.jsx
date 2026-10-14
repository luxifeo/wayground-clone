import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Pencil, Play, Share2, EllipsisVertical, Plus, ChevronDown, Clock, Copy, Trash2, Archive, ArchiveRestore, ClipboardCheck, BookOpen, Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../components/AdminLayout.jsx';
import { shareWithStudents } from '../../components/InvitePanel.jsx';
import { get, post, patch, del } from '../../lib/api.js';
import { timeAgo } from '../../lib/constants.js';
import { subjectLabel, gradeLabel } from '../../i18n/index.js';
import { Empty, Menu, MenuItem, QuizThumb, useToast } from '../../components/ui.jsx';

export default function Library() {
  const { t } = useTranslation('library');
  const nav = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState('published');
  const [q, setQ] = useState('');
  const [data, setData] = useState({ quizzes: [], counts: {} });
  const [recent, setRecent] = useState(null);
  const [side, setSide] = useState('created');

  const load = () => {
    if (side === 'recent') { get('/quizzes/recent').then((d) => setRecent(d.quizzes)); return; }
    get(`/quizzes?status=${tab}${q ? `&q=${encodeURIComponent(q)}` : ''}`).then(setData).catch((e) => toast(e.message, 'error'));
  };
  useEffect(load, [tab, side]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = side === 'recent' ? recent || [] : data.quizzes;
  const c = data.counts || {};

  return (
    <AdminLayout compact>
      <div className="flex h-full">
        <aside className="w-56 shrink-0 border-r border-slate-200 p-3">
          <div className="mb-3 px-2 text-lg font-bold">{t('title')}</div>
          {[['created', t('side.created'), Pencil, `${(c.published || 0) + (c.draft || 0)}`], ['recent', t('side.recent'), Clock]].map(([k, l, I, n]) => (
            <button key={k} onClick={() => setSide(k)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ${side === k ? 'bg-slate-100 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}><I className="h-4 w-4" />{l}<span className="ml-auto text-xs text-slate-400">{n}</span></button>
          ))}
          <Link to="/admin/explore" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><BookOpen className="h-4 w-4" />{t('side.explore')}</Link>
        </aside>
        <div className="min-w-0 flex-1">
          <div className="border-b border-slate-200 px-4 py-2.5">
            <form onSubmit={(e) => { e.preventDefault(); setSide('created'); load(); }} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5">
              <Search className="h-4 w-4 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPlaceholder')} className="flex-1 text-sm outline-none" />
            </form>
          </div>
          <div className="mx-auto max-w-5xl px-6 py-6">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold">{side === 'recent' ? t('side.recent') : t('createdByMe')}</h1>
              <Menu trigger={<button className="btn-primary"><Plus className="h-4 w-4" />{t('addResource')}<ChevronDown className="h-4 w-4" /></button>}>
                <MenuItem icon={ClipboardCheck} onClick={() => nav('/admin/assessment/new')}>{t('assessment')}</MenuItem>
              </Menu>
            </div>
            {side === 'created' && (
              <div className="mt-4 flex gap-2">
                {['published', 'draft', 'archived'].map((k) => (
                  <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === k ? 'border border-slate-300 bg-white shadow-card' : 'text-slate-600'}`}>{t(`tabs.${k}`, { n: c[k] || 0 })}</button>
                ))}
              </div>
            )}
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="flex justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600"><span>{t('cols.details')}</span><span className="mr-44">{t('cols.updated')}</span></div>
              {list.length === 0 ? (
                <Empty icon={BookOpen} title={t('empty.title')}>{t('empty.text')}</Empty>
              ) : list.map((qz) => (
                <div key={qz.id} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50/60">
                  <QuizThumb quiz={qz} />
                  <Link to={qz.status === 'draft' ? `/admin/quiz/${qz.id}/edit` : `/admin/quiz/${qz.id}`} className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 truncate font-semibold">{qz.title}{qz.status === 'draft' && <span className="rounded border border-slate-300 px-1 text-[10px] font-bold text-slate-500">{t('draftBadge')}</span>}</div>
                    <div className="flex items-center gap-1 text-xs text-slate-500"><ClipboardCheck className="h-3.5 w-3.5 text-green-600" />• {t('common:count.qs', { count: qz.question_count })}{qz.subject && ` • ${subjectLabel(qz.subject)}`}{qz.grade && ` • ${gradeLabel(qz.grade)}`}</div>
                  </Link>
                  <span className="w-36 text-sm text-slate-500">{timeAgo(qz.updated_at)}</span>
                  {qz.status === 'draft'
                    ? <Link to={`/admin/quiz/${qz.id}/edit`} className="btn-outline btn-sm"><Pencil className="h-3.5 w-3.5" />{t('common:actions.edit')}</Link>
                    : <Link to={`/admin/quiz/${qz.id}`} className="btn-outline btn-sm"><Play className="h-3.5 w-3.5" />{t('common:actions.play')}</Link>}
                  {qz.status !== 'draft' && <button title={t('shareWithStudents')} aria-label={t('shareWithStudents')} onClick={async () => { try { const s = await shareWithStudents(qz.id); nav(`/admin/reports/${s.id}`); } catch (e) { toast(e.message, 'error'); } }} className="btn-outline btn-sm px-2"><Share2 className="h-3.5 w-3.5" /></button>}
                  <Menu trigger={<button className="btn-outline btn-sm px-2"><EllipsisVertical className="h-3.5 w-3.5" /></button>}>
                    <MenuItem icon={Pencil} onClick={() => nav(`/admin/quiz/${qz.id}/edit`)}>{t('common:actions.edit')}</MenuItem>
                    <MenuItem icon={Copy} onClick={async () => { await post(`/quizzes/${qz.id}/duplicate`); toast(t('duplicated'), 'success'); load(); }}>{t('common:actions.duplicate')}</MenuItem>
                    <MenuItem icon={Link2} onClick={() => nav(`/admin/quiz/${qz.id}/start?kind=homework`)}>{t('common:actions.assign')}</MenuItem>
                    {qz.status === 'archived'
                      ? <MenuItem icon={ArchiveRestore} onClick={async () => { await patch(`/quizzes/${qz.id}`, { status: 'published' }); load(); }}>{t('common:actions.restore')}</MenuItem>
                      : <MenuItem icon={Archive} onClick={async () => { await patch(`/quizzes/${qz.id}`, { status: 'archived' }); load(); }}>{t('common:actions.archive')}</MenuItem>}
                    <MenuItem icon={Trash2} danger onClick={async () => { if (confirm(t('confirmDelete', { title: qz.title }))) { await del(`/quizzes/${qz.id}`); load(); } }}>{t('common:actions.delete')}</MenuItem>
                  </Menu>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
