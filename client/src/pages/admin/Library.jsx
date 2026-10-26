import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Pencil, Play, Share2, EllipsisVertical, Plus, ChevronDown, ChevronRight, Clock, Copy, Trash2, Archive, ArchiveRestore, ClipboardCheck, BookOpen, Link2, Folder, FolderPlus, FolderInput, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../components/AdminLayout.jsx';
import { shareWithStudents } from '../../components/InvitePanel.jsx';
import { get, post, patch, del } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { timeAgo } from '../../lib/constants.js';
import { subjectLabel, gradeLabel } from '../../i18n/index.js';
import { Empty, Menu, MenuItem, Modal, QuizThumb, useToast } from '../../components/ui.jsx';

/** Lookups over the flat folder list from GET /folders. */
function useFolderTree(folders) {
  return useMemo(() => {
    const list = folders || [];
    const byId = new Map(list.map((f) => [f.id, f]));
    const kids = new Map();
    list.forEach((f) => kids.set(f.parent_id, [...(kids.get(f.parent_id) || []), f]));
    // root first, current folder last; the length guard stops on bad data
    const pathOf = (id) => {
      const out = [];
      for (let f = byId.get(id); f && out.length <= list.length; f = byId.get(f.parent_id)) out.unshift(f);
      return out;
    };
    return { byId, pathOf, childrenOf: (id) => kids.get(id ?? null) || [] };
  }, [folders]);
}

// selection / drag keys: 'q12' is quiz 12, 'f3' is folder 3
const itemsOf = (keys) => ({
  quizzes: keys.filter((k) => k[0] === 'q').map((k) => +k.slice(1)),
  folders: keys.filter((k) => k[0] === 'f').map((k) => +k.slice(1)),
});

function FolderThumb() {
  return <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-amber-200 bg-amber-50"><Folder className="h-6 w-6 fill-amber-200 text-amber-500" /></div>;
}

function FolderNameModal({ folder, onClose, onSave }) {
  const { t } = useTranslation('library');
  const [name, setName] = useState(folder?.name || '');
  return (
    <Modal open onClose={onClose} title={folder ? t('folder.renameTitle') : t('newFolder')} icon={<FolderPlus className="h-5 w-5 text-amber-500" />}>
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave(name.trim()); }}>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={t('folder.namePlaceholder')} className="input" />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>{t('common:actions.cancel')}</button>
          <button className="btn-primary" disabled={!name.trim()}>{folder ? t('common:actions.save') : t('common:actions.create')}</button>
        </div>
      </form>
    </Modal>
  );
}

function MoveModal({ items, tree, onClose, onMove }) {
  const { t } = useTranslation('library');
  const [to, setTo] = useState(undefined);
  // a folder cannot go into itself or one of its subfolders
  const blocked = (id) => tree.pathOf(id).some((f) => items.folders.includes(f.id));
  const row = (id, label, depth) => (
    <button
      disabled={id !== null && blocked(id)} onClick={() => setTo(id)} style={{ paddingLeft: 12 + depth * 18 }}
      className={`flex w-full items-center gap-2 rounded-lg py-2 pr-3 text-left text-sm disabled:opacity-40 ${to === id ? 'bg-brand-50 font-semibold text-brand-700' : 'hover:bg-slate-50'}`}
    >
      {id === null ? <BookOpen className="h-4 w-4 shrink-0 text-slate-500" /> : <Folder className="h-4 w-4 shrink-0 fill-amber-200 text-amber-500" />}
      <span className="truncate">{label}</span>
    </button>
  );
  const node = (f, depth) => (
    <Fragment key={f.id}>
      {row(f.id, f.name, depth)}
      {!blocked(f.id) && tree.childrenOf(f.id).map((k) => node(k, depth + 1))}
    </Fragment>
  );
  return (
    <Modal
      open onClose={onClose} title={t('move.title', { count: items.quizzes.length + items.folders.length })} icon={<FolderInput className="h-5 w-5" />}
      footer={<><button className="btn-outline" onClick={onClose}>{t('common:actions.cancel')}</button><button className="btn-primary" disabled={to === undefined} onClick={() => onMove(to)}>{t('move.here')}</button></>}
    >
      <div className="max-h-80 overflow-auto scrollbar-thin">
        {row(null, t('move.root'), 0)}
        {tree.childrenOf(null).map((f) => node(f, 1))}
      </div>
    </Modal>
  );
}

export default function Library() {
  const { t } = useTranslation('library');
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const folderId = parseInt(params.get('folder'), 10) || null;
  const [tab, setTab] = useState('published');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState({ quizzes: [], counts: {} });
  const [recent, setRecent] = useState(null);
  const [side, setSide] = useState('created');
  const [folders, setFolders] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [selected, setSelected] = useState(() => new Set());
  const [moving, setMoving] = useState(null); // { quizzes, folders } in the move dialog
  const [naming, setNaming] = useState(null); // { parent } to create, { folder } to rename
  const [dropOn, setDropOn] = useState(undefined); // highlighted drop target: folder id, null = root
  const drag = useRef(null);
  const tree = useFolderTree(folders);

  const load = () => {
    if (side === 'recent') { get('/quizzes/recent').then((d) => setRecent(d.quizzes)); return; }
    const p = new URLSearchParams({ status: tab });
    if (search) p.set('q', search); else p.set('folder', folderId || 'root');
    get(`/quizzes?${p}`).then(setData).catch((e) => toast(e.message, 'error'));
  };
  const loadFolders = () => get('/folders').then((d) => setFolders(d.folders)).catch((e) => toast(e.message, 'error'));
  const refresh = () => { load(); loadFolders(); };
  useEffect(load, [tab, side, folderId, search]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadFolders(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setSelected(new Set()), [tab, side, folderId, search]);
  // keep the sidebar tree open down to the current folder
  useEffect(() => { if (folderId) setExpanded((s) => new Set([...s, ...tree.pathOf(folderId).map((f) => f.id)])); }, [folderId, tree]);

  const openFolder = (id) => { setSide('created'); setSearch(''); setQ(''); setParams(id ? { folder: String(id) } : {}); };
  // a deleted or foreign folder in the URL falls back to the root
  useEffect(() => { if (folders && folderId && !tree.byId.has(folderId)) openFolder(null); }, [folders, folderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const browsing = side === 'created' && !search;
  const path = browsing ? tree.pathOf(folderId) : [];
  const current = path[path.length - 1];
  const subfolders = browsing ? tree.childrenOf(folderId) : [];
  const list = side === 'recent' ? recent || [] : data.quizzes;
  const c = data.counts || {};
  const keys = side === 'created' ? [...subfolders.map((f) => `f${f.id}`), ...list.map((qz) => `q${qz.id}`)] : [];
  const allOn = keys.length > 0 && keys.every((k) => selected.has(k));

  const toggle = (key) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });

  const move = async (items, to) => {
    try {
      await post('/library/move', { ...items, to });
      toast(t('move.done'), 'success');
      setSelected(new Set()); setMoving(null); refresh();
    } catch (e) { toast(e.message, 'error'); }
  };

  const saveFolder = async (name) => {
    try {
      if (naming.folder) await patch(`/folders/${naming.folder.id}`, { name });
      else await post('/folders', { name, parent_id: naming.parent });
      setNaming(null); loadFolders();
    } catch (e) { toast(e.message, 'error'); }
  };

  const deleteFolder = async (f) => {
    if (!confirm(t('folder.confirmDelete', { name: f.name }))) return;
    try {
      await del(`/folders/${f.id}`);
      if (f.id === folderId) openFolder(f.parent_id);
      refresh();
    } catch (e) { toast(e.message, 'error'); }
  };

  // ---------- drag & drop: rows drag (with the selection), folders take drops
  const canDrop = (items, to) => !(browsing && to === folderId) && !tree.pathOf(to).some((f) => items.folders.includes(f.id));
  const dragProps = (key) => (side === 'created' ? {
    draggable: true,
    onDragStart: (e) => {
      drag.current = itemsOf(selected.has(key) ? [...selected] : [key]);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', key);
    },
    onDragEnd: () => { drag.current = null; setDropOn(undefined); },
  } : {});
  const dropProps = (to) => ({
    onDragOver: (e) => { if (drag.current && canDrop(drag.current, to)) { e.preventDefault(); setDropOn(to); } },
    onDragLeave: () => setDropOn((d) => (d === to ? undefined : d)),
    onDrop: (e) => {
      e.preventDefault();
      const items = drag.current;
      drag.current = null; setDropOn(undefined);
      if (items) move(items, to);
    },
  });
  const dropCls = (to) => (dropOn === to ? 'bg-brand-50 ring-2 ring-brand-200' : '');

  const folderMenu = (f, trigger) => (
    <Menu trigger={trigger}>
      <MenuItem icon={Pencil} onClick={() => setNaming({ folder: f })}>{t('common:actions.rename')}</MenuItem>
      <MenuItem icon={FolderInput} onClick={() => setMoving({ quizzes: [], folders: [f.id] })}>{t('move.action')}</MenuItem>
      <MenuItem icon={Trash2} danger onClick={() => deleteFolder(f)}>{t('common:actions.delete')}</MenuItem>
    </Menu>
  );
  const folderSummary = (f) => {
    const parts = [];
    const n = tree.childrenOf(f.id).length;
    if (n) parts.push(t('folder.subfolders', { count: n }));
    if (f.quiz_count) parts.push(t('folder.activities', { count: f.quiz_count }));
    return parts.join(' • ') || t('folder.empty');
  };
  const check = (key) => side === 'created' && (
    <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} aria-label={t('select')} className="h-4 w-4 shrink-0 accent-brand-500" />
  );

  const treeNode = (f, depth) => {
    const kids = tree.childrenOf(f.id);
    const open = expanded.has(f.id);
    return (
      <div key={f.id}>
        <div {...dropProps(f.id)} style={{ paddingLeft: depth * 14 }} className={`flex items-center rounded-lg text-sm ${browsing && folderId === f.id ? 'bg-slate-100 font-semibold' : 'text-slate-600 hover:bg-slate-50'} ${dropCls(f.id)}`}>
          <button onClick={() => setExpanded((s) => { const n = new Set(s); if (open) n.delete(f.id); else n.add(f.id); return n; })} className={`grid h-8 w-6 shrink-0 place-items-center text-slate-400 ${kids.length ? '' : 'invisible'}`} aria-label={f.name}>
            <ChevronRight className={`h-3.5 w-3.5 transition ${open ? 'rotate-90' : ''}`} />
          </button>
          <button onClick={() => openFolder(f.id)} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-left">
            <Folder className="h-4 w-4 shrink-0 fill-amber-200 text-amber-500" /><span className="truncate">{f.name}</span>
          </button>
        </div>
        {open && kids.map((k) => treeNode(k, depth + 1))}
      </div>
    );
  };

  return (
    <AdminLayout compact>
      <div className="flex h-full">
        <aside className="w-56 shrink-0 overflow-y-auto border-r border-slate-200 p-3 scrollbar-thin">
          <div className="mb-3 px-2 text-lg font-bold">{t('title')}</div>
          <button onClick={() => openFolder(null)} {...dropProps(null)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ${browsing && !folderId ? 'bg-slate-100 font-semibold' : 'text-slate-600 hover:bg-slate-50'} ${dropCls(null)}`}><Pencil className="h-4 w-4" />{t('side.created')}<span className="ml-auto text-xs text-slate-400">{c.total ?? ''}</span></button>
          <button onClick={() => setSide('recent')} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ${side === 'recent' ? 'bg-slate-100 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}><Clock className="h-4 w-4" />{t('side.recent')}</button>
          <Link to="/admin/explore" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><BookOpen className="h-4 w-4" />{t('side.explore')}</Link>
          <div className="mt-4 flex items-center justify-between pl-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('folders')}
            <button onClick={() => setNaming({ parent: null })} title={t('newFolder')} aria-label={t('newFolder')} className="rounded p-1 hover:bg-slate-100 hover:text-slate-700"><Plus className="h-3.5 w-3.5" /></button>
          </div>
          <div className="mt-1">{tree.childrenOf(null).map((f) => treeNode(f, 0))}</div>
          {folders?.length === 0 && <div className="px-3 py-1 text-xs text-slate-400">{t('noFolders')}</div>}
        </aside>
        <div className="min-w-0 flex-1">
          <div className="border-b border-slate-200 px-4 py-2.5">
            <form onSubmit={(e) => { e.preventDefault(); setSide('created'); setSearch(q.trim()); }} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5">
              <Search className="h-4 w-4 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPlaceholder')} className="flex-1 text-sm outline-none" />
            </form>
          </div>
          <div className="mx-auto max-w-5xl px-6 py-6">
            <div className="flex items-center justify-between gap-3">
              <h1 className="flex min-w-0 items-center gap-1 text-xl font-bold">
                {side === 'recent' ? t('side.recent') : search ? (
                  <>
                    <span className="truncate">{t('searchResults', { q: search })}</span>
                    <button onClick={() => { setQ(''); setSearch(''); }} title={t('clearSearch')} aria-label={t('clearSearch')} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => openFolder(null)} {...dropProps(null)} className={`shrink-0 rounded px-1 ${folderId ? 'text-slate-500 hover:text-slate-800' : ''} ${dropCls(null)}`}>{t('createdByMe')}</button>
                    {path.map((f) => (
                      <Fragment key={f.id}>
                        <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                        <button onClick={() => openFolder(f.id)} {...dropProps(f.id)} className={`truncate rounded px-1 ${f === current ? '' : 'text-slate-500 hover:text-slate-800'} ${dropCls(f.id)}`}>{f.name}</button>
                      </Fragment>
                    ))}
                    {current && folderMenu(current, <button className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={t('folder.actions')}><EllipsisVertical className="h-4 w-4" /></button>)}
                  </>
                )}
              </h1>
              <div className="flex shrink-0 gap-2">
                {browsing && <button className="btn-outline" onClick={() => setNaming({ parent: folderId })}><FolderPlus className="h-4 w-4" />{t('newFolder')}</button>}
                <Menu trigger={<button className="btn-primary"><Plus className="h-4 w-4" />{t('addResource')}<ChevronDown className="h-4 w-4" /></button>}>
                  <MenuItem icon={ClipboardCheck} onClick={() => nav(`/admin/assessment/new${browsing && folderId ? `?folder=${folderId}` : ''}`)}>{t('assessment')}</MenuItem>
                </Menu>
              </div>
            </div>
            {side === 'created' && (
              <div className="mt-4 flex gap-2">
                {['published', 'draft', 'archived'].map((k) => (
                  <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === k ? 'border border-slate-300 bg-white shadow-card' : 'text-slate-600'}`}>{t(`tabs.${k}`, { n: c[k] || 0 })}</button>
                ))}
              </div>
            )}
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600">
                {side === 'created' && <input type="checkbox" checked={allOn} disabled={!keys.length} onChange={() => setSelected(allOn ? new Set() : new Set(keys))} aria-label={t('selectAll')} className="h-4 w-4 accent-brand-500" />}
                {selected.size ? (
                  <>
                    <span>{t('selected', { count: selected.size })}</span>
                    <button className="btn-outline btn-sm" onClick={() => setMoving(itemsOf([...selected]))}><FolderInput className="h-3.5 w-3.5" />{t('move.action')}</button>
                    <button className="btn-sm text-slate-500 hover:text-slate-800" onClick={() => setSelected(new Set())}>{t('clearSelection')}</button>
                  </>
                ) : (
                  <><span className="flex-1">{t('cols.details')}</span><span className="mr-44">{t('cols.updated')}</span></>
                )}
              </div>
              {list.length === 0 && subfolders.length === 0 ? (
                current
                  ? <Empty icon={Folder} title={t('emptyFolder.title')}>{t('emptyFolder.text')}</Empty>
                  : <Empty icon={BookOpen} title={t('empty.title')}>{t('empty.text')}</Empty>
              ) : (
                <>
                  {subfolders.map((f) => (
                    <div key={`f${f.id}`} {...dragProps(`f${f.id}`)} {...dropProps(f.id)} className={`flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50/60 ${dropCls(f.id)}`}>
                      {check(`f${f.id}`)}
                      <button onClick={() => openFolder(f.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <FolderThumb />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{f.name}</span>
                          <span className="block text-xs text-slate-500">{folderSummary(f)}</span>
                        </span>
                      </button>
                      {folderMenu(f, <button className="btn-outline btn-sm px-2" aria-label={t('folder.actions')}><EllipsisVertical className="h-3.5 w-3.5" /></button>)}
                    </div>
                  ))}
                  {list.map((qz) => (
                    <div key={qz.id} {...dragProps(`q${qz.id}`)} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50/60">
                      {check(`q${qz.id}`)}
                      <QuizThumb quiz={qz} />
                      <Link to={qz.status === 'draft' ? `/admin/quiz/${qz.id}/edit` : `/admin/quiz/${qz.id}`} className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 truncate font-semibold">{qz.title}{qz.status === 'draft' && <span className="rounded border border-slate-300 px-1 text-[10px] font-bold text-slate-500">{t('draftBadge')}</span>}</div>
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <ClipboardCheck className="h-3.5 w-3.5 text-green-600" />• {t('common:count.qs', { count: qz.question_count })}{qz.subject && ` • ${subjectLabel(qz.subject)}`}{qz.grade && ` • ${gradeLabel(qz.grade)}`}
                          {!browsing && tree.byId.has(qz.folder_id) && <span className="flex min-w-0 items-center gap-1 truncate">• <Folder className="h-3 w-3 shrink-0 text-amber-500" />{tree.pathOf(qz.folder_id).map((f) => f.name).join(' / ')}</span>}
                        </div>
                      </Link>
                      <span className="w-36 text-sm text-slate-500">{timeAgo(qz.updated_at)}</span>
                      {qz.status === 'draft'
                        ? <Link to={`/admin/quiz/${qz.id}/edit`} className="btn-outline btn-sm"><Pencil className="h-3.5 w-3.5" />{t('common:actions.edit')}</Link>
                        : <Link to={`/admin/quiz/${qz.id}`} className="btn-outline btn-sm"><Play className="h-3.5 w-3.5" />{t('common:actions.play')}</Link>}
                      {qz.status !== 'draft' && <button title={t('shareWithStudents')} aria-label={t('shareWithStudents')} onClick={async () => { try { const s = await shareWithStudents(qz.id); nav(`/admin/reports/${s.id}`); } catch (e) { toast(e.message, 'error'); } }} className="btn-outline btn-sm px-2"><Share2 className="h-3.5 w-3.5" /></button>}
                      <Menu trigger={<button className="btn-outline btn-sm px-2"><EllipsisVertical className="h-3.5 w-3.5" /></button>}>
                        <MenuItem icon={Pencil} onClick={() => nav(`/admin/quiz/${qz.id}/edit`)}>{t('common:actions.edit')}</MenuItem>
                        <MenuItem icon={Copy} onClick={async () => { await post(`/quizzes/${qz.id}/duplicate`); toast(t('duplicated'), 'success'); refresh(); }}>{t('common:actions.duplicate')}</MenuItem>
                        <MenuItem icon={Link2} onClick={() => nav(`/admin/quiz/${qz.id}/start?kind=homework`)}>{t('common:actions.assign')}</MenuItem>
                        {qz.owner_id === user?.id && <MenuItem icon={FolderInput} onClick={() => setMoving({ quizzes: [qz.id], folders: [] })}>{t('move.action')}</MenuItem>}
                        {qz.status === 'archived'
                          ? <MenuItem icon={ArchiveRestore} onClick={async () => { await patch(`/quizzes/${qz.id}`, { status: 'published' }); load(); }}>{t('common:actions.restore')}</MenuItem>
                          : <MenuItem icon={Archive} onClick={async () => { await patch(`/quizzes/${qz.id}`, { status: 'archived' }); load(); }}>{t('common:actions.archive')}</MenuItem>}
                        <MenuItem icon={Trash2} danger onClick={async () => { if (confirm(t('confirmDelete', { title: qz.title }))) { await del(`/quizzes/${qz.id}`); refresh(); } }}>{t('common:actions.delete')}</MenuItem>
                      </Menu>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {naming && <FolderNameModal folder={naming.folder} onClose={() => setNaming(null)} onSave={saveFolder} />}
      {moving && <MoveModal items={moving} tree={tree} onClose={() => setMoving(null)} onMove={(to) => move(moving, to)} />}
    </AdminLayout>
  );
}
