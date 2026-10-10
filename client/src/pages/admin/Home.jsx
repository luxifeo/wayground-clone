import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Pencil, Search, Upload, ClipboardCheck, Presentation, Clapperboard, FileText, Layers, Play, Gamepad2 } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout.jsx';
import AIGenerateModal from '../../components/AIGenerateModal.jsx';
import { useAuth } from '../../lib/auth.jsx';
import { get } from '../../lib/api.js';
import { QuizThumb } from '../../components/ui.jsx';
import { timeAgo } from '../../lib/constants.js';

const RESOURCES = [
  { key: 'assessment', title: 'Assessment', sub: 'Quick & interactive questions', icon: ClipboardCheck, color: 'bg-green-600', to: '/admin/assessment/new' },
  { key: 'presentation', title: 'Presentation', sub: 'Slides with questions and whiteboard', icon: Presentation, color: 'bg-orange-500' },
  { key: 'video', title: 'Video', sub: 'Questions at key points in the video', icon: Clapperboard, color: 'bg-rose-600' },
  { key: 'passage', title: 'Passage', sub: 'Questions based on a passage', icon: FileText, color: 'bg-sky-600' },
  { key: 'flashcards', title: 'Flashcards', sub: 'Questions on front, answers on back', icon: Layers, color: 'bg-violet-600' },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState('create');
  const [q, setQ] = useState('');
  const [recent, setRecent] = useState([]);
  const [ai, setAi] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { get('/quizzes').then((d) => setRecent(d.quizzes.slice(0, 6))).catch(() => {}); }, []);

  const tabs = [
    { key: 'create', title: 'Create', sub: 'a resource', icon: Pencil },
    { key: 'search', title: 'Search', sub: 'for resources', icon: Search },
    { key: 'upload', title: 'Upload', sub: '& enhance your content', icon: Upload },
  ];

  return (
    <AdminLayout>
      <div className="flex justify-end px-6 pt-4">
        <Link to="/join" target="_blank" className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Gamepad2 className="h-4 w-4" />Enter code</Link>
      </div>
      <div className="relative pb-10 pt-2">
        <div className="absolute inset-x-0 top-0 -z-0 h-48 bg-gradient-to-b from-white via-brand-50 to-brand-100/60" />
        <div className="relative text-center text-lg font-medium">{greeting()}, {user?.name?.split(' ')[0]} 👋 Let&apos;s get started.</div>
        <div className="relative mt-5 flex justify-center gap-3">
          {tabs.map((t) => (
            <button
              key={t.key} onClick={() => setTab(t.key)}
              className={`relative flex w-36 flex-col items-center rounded-xl bg-white px-4 pb-3 pt-6 shadow-card transition ${tab === t.key ? 'text-brand-600 ring-1 ring-brand-200' : 'text-slate-700 hover:-translate-y-0.5'}`}
            >
              <span className="absolute -top-4 grid h-9 w-9 place-items-center rounded-full bg-white shadow-card"><t.icon className="h-4 w-4" /></span>
              <span className="font-semibold">{t.title}</span>
              <span className="text-xs text-slate-400">{t.sub}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-6">
        {tab === 'create' && (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
            {RESOURCES.map((r) => {
              const inner = (
                <>
                  <span className={`grid h-14 w-14 place-items-center rounded-xl ${r.color} text-white shadow-md transition group-hover:scale-105`}><r.icon className="h-7 w-7" /></span>
                  <span className="mt-3 font-semibold">{r.title}</span>
                  <span className="text-center text-xs text-slate-500">{r.sub}</span>
                  {!r.to && <span className="mt-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Coming soon</span>}
                </>
              );
              return r.to
                ? <Link key={r.key} to={r.to} className="group flex flex-col items-center rounded-xl p-3 hover:bg-slate-50">{inner}</Link>
                : <div key={r.key} className="group flex cursor-not-allowed flex-col items-center rounded-xl p-3 opacity-60">{inner}</div>;
            })}
          </div>
        )}
        {tab === 'search' && (
          <form onSubmit={(e) => { e.preventDefault(); nav(`/admin/explore?q=${encodeURIComponent(q)}`); }} className="mx-auto flex max-w-2xl gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input autoFocus className="input py-3 pl-9" placeholder="Search for quizzes on any topic" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button className="btn-primary px-5">Search</button>
          </form>
        )}
        {tab === 'upload' && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); setAi({ mode: 'upload', files: e.dataTransfer.files }); }}
            className="mx-auto flex max-w-2xl flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white py-10 text-center"
          >
            <Upload className="h-8 w-8 text-slate-400" />
            <div className="font-semibold">Upload lesson slides, worksheets or any document</div>
            <div className="text-sm text-slate-500">We&apos;ll turn it into an interactive assessment with AI</div>
            <button className="btn-outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />Device</button>
            <input ref={fileRef} hidden type="file" multiple accept=".pdf,.docx,.txt,.md,image/*" onChange={(e) => setAi({ mode: 'upload', files: e.target.files })} />
          </div>
        )}

        <div className="mt-12">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Recently edited</h2>
            <Link to="/admin/library" className="text-sm font-semibold text-violet-700">See all</Link>
          </div>
          {recent.length === 0 ? (
            <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Nothing here yet — create your first assessment!</div>
          ) : (
            <div className="grid gap-3 pb-10 md:grid-cols-2 lg:grid-cols-3">
              {recent.map((qz) => (
                <Link key={qz.id} to={`/admin/quiz/${qz.id}`} className="card flex items-center gap-3 p-3 hover:shadow-md">
                  <QuizThumb quiz={qz} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{qz.title}</div>
                    <div className="text-xs text-slate-500">{qz.question_count} Qs · {qz.status === 'draft' ? <span className="text-amber-600">Draft</span> : qz.subject || 'Assessment'} · {timeAgo(qz.updated_at)}</div>
                  </div>
                  <Play className="h-4 w-4 text-slate-400" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <AIGenerateModal open={!!ai} onClose={() => setAi(null)} initialMode={ai?.mode} initialFiles={ai?.files} />
    </AdminLayout>
  );
}
