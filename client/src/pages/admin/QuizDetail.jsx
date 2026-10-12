import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Share2, Download, Eye, EllipsisVertical, Bookmark, Pencil, Clock, Play, ChevronDown, Rocket, Settings2, Copy, Trash2,
  Sparkles, Languages, Lightbulb, ClipboardCheck, Link2, ChartPie, Archive, Users, ImagePlus,
} from 'lucide-react';
import AdminLayout from '../../components/AdminLayout.jsx';
import { shareWithStudents } from '../../components/InvitePanel.jsx';
import { api, get, post, del, patch } from '../../lib/api.js';
import { QTYPE_UPPER, QTYPES, fmtShortTime, UNGRADED, LANGUAGES } from '../../lib/constants.js';
import { Menu, MenuItem, Modal, QuizThumb, Spinner, Toggle, Select, useToast } from '../../components/ui.jsx';
import { QuestionBody } from '../../components/QuestionCard.jsx';
import { openPreview } from './QuizEditor.jsx';
import { useAuth } from '../../lib/auth.jsx';

export function HostChoiceModal({ open, onClose, quizId }) {
  const nav = useNavigate();
  return (
    <Modal open={open} onClose={onClose} width="max-w-xl" title="How would you like to host the session?">
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ['student', 'Student paced', 'Students work at their own pace', 'from-[#7a1660] to-[#4f1446]', '🧑‍💻'],
          ['teacher', 'Teacher led', 'You lead the session, students answer on their devices', 'from-[#1d4f91] to-[#173a6b]', '🧑‍🏫'],
        ].map(([pace, t, d, bg, emo]) => (
          <button key={pace} onClick={() => nav(`/admin/quiz/${quizId}/start?pace=${pace}`)} className="overflow-hidden rounded-xl border border-slate-200 text-left shadow-card transition hover:-translate-y-1 hover:shadow-lg">
            <div className={`grid h-28 place-items-center bg-gradient-to-br ${bg} text-5xl`}>{emo}</div>
            <div className="p-3"><div className="flex items-center justify-between font-bold">{t}<span>→</span></div><div className="text-xs text-slate-500">{d}</div></div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export default function QuizDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [quiz, setQuiz] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [showAns, setShowAns] = useState(false);
  const [host, setHost] = useState(false);
  const [aiBusy, setAiBusy] = useState(null);
  const [translate, setTranslate] = useState(false);
  const [lang, setLang] = useState('Vietnamese');
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    get(`/quizzes/${id}`).then((d) => { setQuiz(d.quiz); setIsOwner(d.isOwner); }).catch((e) => toast(e.message, 'error'));
    get(`/sessions?quizId=${id}`).then((d) => setSessions(d.sessions)).catch(() => {});
  }, [id, toast]);

  if (!quiz) return <AdminLayout compact><div className="grid h-full place-items-center"><Spinner className="h-8 w-8 text-slate-400" /></div></AdminLayout>;
  const qs = quiz.questions;
  const pts = qs.filter((q) => !UNGRADED.includes(q.type)).reduce((a, q) => a + q.points, 0);

  const quickStart = async () => {
    const { session } = await post('/sessions', { quizId: quiz.id, kind: 'live', pace: 'student' });
    nav(`/host/${session.id}`);
  };
  const copyToLibrary = async () => {
    const d = await post(`/quizzes/${quiz.id}/duplicate`);
    toast('Copied to your library', 'success');
    nav(`/admin/quiz/${d.quiz.id}/edit`);
  };
  const ai = async (key, fn) => { setAiBusy(key); try { await fn(); } catch (e) { toast(e.message, 'error'); } finally { setAiBusy(null); } };
  const shareLink = `${window.location.origin}/admin/quiz/${quiz.id}`;

  return (
    <AdminLayout compact>
      <div className="mx-auto w-full max-w-5xl px-6 py-6">
        <div className="flex items-start gap-4">
          <QuizThumb quiz={quiz} size={64} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold">{quiz.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className="flex items-center gap-1"><ClipboardCheck className="h-4 w-4 text-green-600" />Assessment</span>•
              <span>{quiz.owner_name}</span>{quiz.subject && <>•<span>{quiz.subject}</span></>}{quiz.grade && <>•<span>{quiz.grade}</span></>}
              {quiz.status === 'draft' && <span className="rounded bg-amber-100 px-2 text-xs font-bold text-amber-700">DRAFT</span>}
              {quiz.visibility === 'private' && <span className="rounded bg-slate-100 px-2 text-xs font-bold">PRIVATE</span>}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-5">
          <Menu align="left" trigger={<button className="btn-outline"><Share2 className="h-4 w-4" />Share<ChevronDown className="h-4 w-4" /></button>}>
            <MenuItem icon={Users} onClick={async () => { try { const s = await shareWithStudents(quiz.id); nav(`/admin/reports/${s.id}`); } catch (e) { toast(e.message, 'error'); } }}>Share with students</MenuItem>
            <MenuItem icon={Link2} onClick={() => { navigator.clipboard.writeText(shareLink); toast('Link copied', 'success'); }}>Copy quiz link</MenuItem>
          </Menu>
          <Link to={`/admin/quiz/${quiz.id}/worksheet`} className="btn-outline"><Download className="h-4 w-4" />Worksheet</Link>
          <button className="btn-outline" onClick={() => openPreview(quiz.id).catch((e) => toast(e.message, 'error'))}><Eye className="h-4 w-4" />Preview</button>
          <Menu align="left" trigger={<button className="btn-outline px-2.5"><EllipsisVertical className="h-4 w-4" /></button>}>
            <MenuItem icon={Copy} onClick={copyToLibrary}>Duplicate</MenuItem>
            {isOwner && <MenuItem icon={Archive} onClick={async () => { await patch(`/quizzes/${quiz.id}`, { status: 'archived' }); toast('Archived'); nav('/admin/library'); }}>Archive</MenuItem>}
            {isOwner && <MenuItem icon={Trash2} danger onClick={async () => { if (confirm('Delete this quiz and all its reports?')) { await del(`/quizzes/${quiz.id}`); nav('/admin/library'); } }}>Delete</MenuItem>}
          </Menu>
          <div className="ml-auto flex flex-wrap gap-2">
            {!isOwner && <button className="btn-outline" onClick={copyToLibrary}><Bookmark className="h-4 w-4" />Save</button>}
            {isOwner && <Link to={`/admin/quiz/${quiz.id}/edit`} className="btn-outline"><Pencil className="h-4 w-4" />Edit</Link>}
            <button className="btn-brand-outline" onClick={() => nav(`/admin/quiz/${quiz.id}/start?kind=homework`)}><Clock className="h-4 w-4" />Assign</button>
            <Menu trigger={<button className="btn-primary"><Play className="h-4 w-4" />Play<ChevronDown className="h-4 w-4" /></button>}>
              <MenuItem icon={Rocket} sub="Recommended" onClick={quickStart}>Quick start</MenuItem>
              <MenuItem icon={Settings2} onClick={() => setHost(true)}>Custom settings</MenuItem>
            </Menu>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.15fr]">
          <div className="space-y-5">
            <div className="card overflow-hidden">
              <div className="border-b border-slate-100 px-4 py-3 font-semibold">Student Preview</div>
              <div className="relative m-3 grid h-56 place-items-center overflow-hidden rounded-xl game-bg">
                <div className="absolute inset-x-6 top-6 h-10 rounded-lg bg-black/30" />
                <div className="absolute inset-x-6 bottom-4 grid grid-cols-4 gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className={`opt-${i} h-20 rounded-lg opacity-60`} />)}</div>
                <button onClick={() => openPreview(quiz.id).catch((e) => toast(e.message, 'error'))} className="relative flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold shadow-lg"><Play className="h-4 w-4" />Try it as a student</button>
              </div>
            </div>
            {isOwner && (
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-600">Improve your activity</div>
                <div className="card divide-y divide-slate-100">
                  <div className="flex items-center gap-2 px-4 py-3 font-semibold"><Sparkles className="h-4 w-4 text-cyan-500" />AI actions</div>
                  {[
                    ['similar', 'Add similar questions', Sparkles, async () => { const d = await api(`/ai/quizzes/${quiz.id}/similar`, { method: 'POST', body: { count: 5 } }); setQuiz(d.quiz); toast(`Added ${d.added} questions`, 'success'); }],
                    ['expl', 'Add answer explanations', Lightbulb, async () => { const d = await api(`/ai/quizzes/${quiz.id}/explanations`, { method: 'POST', body: {} }); setQuiz(d.quiz); toast(`Wrote ${d.updated} explanations`, 'success'); }],
                    ['images', 'Add illustration images', ImagePlus, async () => { const d = await api(`/ai/quizzes/${quiz.id}/images`, { method: 'POST', body: {} }); setQuiz(d.quiz); toast(d.illustrated ? `Added ${d.illustrated} images` : 'No new images found', 'success'); }],
                    ['translate', 'Translate quiz', Languages, async () => setTranslate(true)],
                  ].map(([k, label, I, fn]) => (
                    <button key={k} disabled={!!aiBusy} onClick={() => ai(k, fn)} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold hover:bg-slate-50">
                      {aiBusy === k ? <Spinner className="h-4 w-4" /> : <I className="h-4 w-4" />}{label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {sessions.length > 0 && (
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-600">Past sessions</div>
                <div className="card divide-y divide-slate-100">
                  {sessions.slice(0, 5).map((s) => (
                    <Link key={s.id} to={`/admin/reports/${s.id}`} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-50">
                      <ChartPie className="h-4 w-4 text-slate-400" />
                      <span className="flex-1">{new Date(s.created_at).toLocaleString()} · {s.kind === 'homework' ? 'Homework' : s.pace === 'teacher' ? 'Teacher led' : 'Student paced'}</span>
                      <span className="text-slate-500">{s.participants} players · {s.accuracy ?? '–'}%</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card h-fit">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm">
              <span className="text-slate-600">{qs.length} questions • {pts} Points</span>
              <label className="flex items-center gap-2 font-semibold text-slate-700">Show answer options <Toggle checked={showAns} onChange={setShowAns} /></label>
            </div>
            <div className="divide-y divide-slate-100">
              {qs.map((q, i) => {
                const T = QTYPES[q.type] || QTYPES.mcq;
                return (
                  <div key={q.id} className="px-4 py-3">
                    <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-500"><T.icon className={`h-3.5 w-3.5 ${T.color}`} />{i + 1}. {QTYPE_UPPER[q.type]} • {fmtShortTime(q.time_limit)} • {UNGRADED.includes(q.type) ? 'Ungraded' : `${q.points} pt`}</div>
                    {showAns ? <QuestionBody q={q} /> : <div className="font-semibold text-slate-800">{q.text.replace(/\[\[[^\]]+\]\]/g, '_____') || QTYPES[q.type]?.label}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <HostChoiceModal open={host} onClose={() => setHost(false)} quizId={quiz.id} />
      <Modal open={translate} onClose={() => setTranslate(false)} title="Translate quiz" icon={<Languages className="h-5 w-5 text-violet-600" />}
        footer={<><button className="btn-outline" onClick={() => setTranslate(false)}>Cancel</button><button className="btn-violet" disabled={aiBusy === 'tr'} onClick={() => ai('tr', async () => { const d = await api(`/ai/quizzes/${quiz.id}/translate`, { method: 'POST', body: { language: lang } }); setTranslate(false); toast('Translated copy created', 'success'); nav(`/admin/quiz/${d.quiz.id}/edit`); })}>{aiBusy === 'tr' ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}Translate</button></>}
      >
        <p className="mb-3 text-sm text-slate-600">AI creates a translated copy of this quiz in your library.</p>
        <Select value={lang} onChange={(v) => setLang(v || 'Vietnamese')} options={LANGUAGES} icon={Languages} />
      </Modal>
      {user && null}
    </AdminLayout>
  );
}
