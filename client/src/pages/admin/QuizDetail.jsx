import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { fmtDate, subjectLabel, gradeLabel, languageLabel } from '../../i18n/index.js';

export function HostChoiceModal({ open, onClose, quizId }) {
  const nav = useNavigate();
  const { t } = useTranslation('quiz');
  return (
    <Modal open={open} onClose={onClose} width="max-w-xl" title={t('host.title')}>
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ['student', t('common:session.studentPaced'), t('host.studentDesc'), 'from-[#7a1660] to-[#4f1446]', '🧑‍💻'],
          ['teacher', t('common:session.teacherLed'), t('host.teacherDesc'), 'from-[#1d4f91] to-[#173a6b]', '🧑‍🏫'],
        ].map(([pace, title, d, bg, emo]) => (
          <button key={pace} onClick={() => nav(`/admin/quiz/${quizId}/start?pace=${pace}`)} className="overflow-hidden rounded-xl border border-slate-200 text-left shadow-card transition hover:-translate-y-1 hover:shadow-lg">
            <div className={`grid h-28 place-items-center bg-gradient-to-br ${bg} text-5xl`}>{emo}</div>
            <div className="p-3"><div className="flex items-center justify-between font-bold">{title}<span>→</span></div><div className="text-xs text-slate-500">{d}</div></div>
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
  const { t } = useTranslation('quiz');
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
    toast(t('detail.copiedToLibrary'), 'success');
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
              <span className="flex items-center gap-1"><ClipboardCheck className="h-4 w-4 text-green-600" />{t('detail.assessment')}</span>•
              <span>{quiz.owner_name}</span>{quiz.subject && <>•<span>{subjectLabel(quiz.subject)}</span></>}{quiz.grade && <>•<span>{gradeLabel(quiz.grade)}</span></>}
              {quiz.status === 'draft' && <span className="rounded bg-amber-100 px-2 text-xs font-bold text-amber-700">{t('detail.draftBadge')}</span>}
              {quiz.visibility === 'private' && <span className="rounded bg-slate-100 px-2 text-xs font-bold">{t('detail.privateBadge')}</span>}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-5">
          <Menu align="left" trigger={<button className="btn-outline"><Share2 className="h-4 w-4" />{t('common:actions.share')}<ChevronDown className="h-4 w-4" /></button>}>
            <MenuItem icon={Users} onClick={async () => { try { const s = await shareWithStudents(quiz.id); nav(`/admin/reports/${s.id}`); } catch (e) { toast(e.message, 'error'); } }}>{t('detail.shareWithStudents')}</MenuItem>
            <MenuItem icon={Link2} onClick={() => { navigator.clipboard.writeText(shareLink); toast(t('detail.linkCopied'), 'success'); }}>{t('detail.copyLink')}</MenuItem>
          </Menu>
          <Link to={`/admin/quiz/${quiz.id}/worksheet`} className="btn-outline"><Download className="h-4 w-4" />{t('detail.worksheet')}</Link>
          <button className="btn-outline" onClick={() => openPreview(quiz.id).catch((e) => toast(e.message, 'error'))}><Eye className="h-4 w-4" />{t('common:actions.preview')}</button>
          <Menu align="left" trigger={<button className="btn-outline px-2.5"><EllipsisVertical className="h-4 w-4" /></button>}>
            <MenuItem icon={Copy} onClick={copyToLibrary}>{t('common:actions.duplicate')}</MenuItem>
            {isOwner && <MenuItem icon={Archive} onClick={async () => { await patch(`/quizzes/${quiz.id}`, { status: 'archived' }); toast(t('detail.archived')); nav('/admin/library'); }}>{t('common:actions.archive')}</MenuItem>}
            {isOwner && <MenuItem icon={Trash2} danger onClick={async () => { if (confirm(t('detail.confirmDelete'))) { await del(`/quizzes/${quiz.id}`); nav('/admin/library'); } }}>{t('common:actions.delete')}</MenuItem>}
          </Menu>
          <div className="ml-auto flex flex-wrap gap-2">
            {!isOwner && <button className="btn-outline" onClick={copyToLibrary}><Bookmark className="h-4 w-4" />{t('common:actions.save')}</button>}
            {isOwner && <Link to={`/admin/quiz/${quiz.id}/edit`} className="btn-outline"><Pencil className="h-4 w-4" />{t('common:actions.edit')}</Link>}
            <button className="btn-brand-outline" onClick={() => nav(`/admin/quiz/${quiz.id}/start?kind=homework`)}><Clock className="h-4 w-4" />{t('common:actions.assign')}</button>
            <Menu trigger={<button className="btn-primary"><Play className="h-4 w-4" />{t('common:actions.play')}<ChevronDown className="h-4 w-4" /></button>}>
              <MenuItem icon={Rocket} sub={t('detail.recommended')} onClick={quickStart}>{t('detail.quickStart')}</MenuItem>
              <MenuItem icon={Settings2} onClick={() => setHost(true)}>{t('detail.customSettings')}</MenuItem>
            </Menu>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.15fr]">
          <div className="space-y-5">
            <div className="card overflow-hidden">
              <div className="border-b border-slate-100 px-4 py-3 font-semibold">{t('detail.studentPreview')}</div>
              <div className="relative m-3 grid h-56 place-items-center overflow-hidden rounded-xl game-bg">
                <div className="absolute inset-x-6 top-6 h-10 rounded-lg bg-black/30" />
                <div className="absolute inset-x-6 bottom-4 grid grid-cols-4 gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className={`opt-${i} h-20 rounded-lg opacity-60`} />)}</div>
                <button onClick={() => openPreview(quiz.id).catch((e) => toast(e.message, 'error'))} className="relative flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold shadow-lg"><Play className="h-4 w-4" />{t('detail.tryAsStudent')}</button>
              </div>
            </div>
            {isOwner && (
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-600">{t('detail.improve')}</div>
                <div className="card divide-y divide-slate-100">
                  <div className="flex items-center gap-2 px-4 py-3 font-semibold"><Sparkles className="h-4 w-4 text-cyan-500" />{t('ai.actions')}</div>
                  {[
                    ['similar', t('ai.similar'), Sparkles, async () => { const d = await api(`/ai/quizzes/${quiz.id}/similar`, { method: 'POST', body: { count: 5 } }); setQuiz(d.quiz); toast(t('ai.addedQuestions', { count: d.added }), 'success'); }],
                    ['expl', t('ai.explanations'), Lightbulb, async () => { const d = await api(`/ai/quizzes/${quiz.id}/explanations`, { method: 'POST', body: {} }); setQuiz(d.quiz); toast(t('ai.wroteExplanations', { count: d.updated }), 'success'); }],
                    ['images', t('ai.illustrations'), ImagePlus, async () => { const d = await api(`/ai/quizzes/${quiz.id}/images`, { method: 'POST', body: {} }); setQuiz(d.quiz); toast(d.illustrated ? t('ai.addedImages', { count: d.illustrated }) : t('ai.noImages'), 'success'); }],
                    ['translate', t('ai.translate'), Languages, async () => setTranslate(true)],
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
                <div className="mb-2 text-sm font-semibold text-slate-600">{t('detail.pastSessions')}</div>
                <div className="card divide-y divide-slate-100">
                  {sessions.slice(0, 5).map((s) => (
                    <Link key={s.id} to={`/admin/reports/${s.id}`} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-50">
                      <ChartPie className="h-4 w-4 text-slate-400" />
                      <span className="flex-1">{fmtDate(s.created_at)} · {s.kind === 'homework' ? t('common:session.homework') : s.pace === 'teacher' ? t('common:session.teacherLed') : t('common:session.studentPaced')}</span>
                      <span className="text-slate-500">{t('detail.players', { count: s.participants })} · {s.accuracy ?? '–'}%</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card h-fit">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm">
              <span className="text-slate-600">{t('common:count.questions', { count: qs.length })} • {t('common:count.points', { count: pts })}</span>
              <label className="flex items-center gap-2 font-semibold text-slate-700">{t('detail.showAnswerOptions')} <Toggle checked={showAns} onChange={setShowAns} /></label>
            </div>
            <div className="divide-y divide-slate-100">
              {qs.map((q, i) => {
                const T = QTYPES[q.type] || QTYPES.mcq;
                return (
                  <div key={q.id} className="px-4 py-3">
                    <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-500"><T.icon className={`h-3.5 w-3.5 ${T.color}`} />{i + 1}. {QTYPE_UPPER[q.type]} • {fmtShortTime(q.time_limit)} • {UNGRADED.includes(q.type) ? t('common:result.ungraded') : t('detail.pt', { count: q.points })}</div>
                    {showAns ? <QuestionBody q={q} /> : <div className="font-semibold text-slate-800">{q.text.replace(/\[\[[^\]]+\]\]/g, '_____') || QTYPES[q.type]?.label}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <HostChoiceModal open={host} onClose={() => setHost(false)} quizId={quiz.id} />
      <Modal open={translate} onClose={() => setTranslate(false)} title={t('translate.title')} icon={<Languages className="h-5 w-5 text-violet-600" />}
        footer={<><button className="btn-outline" onClick={() => setTranslate(false)}>{t('common:actions.cancel')}</button><button className="btn-violet" disabled={aiBusy === 'tr'} onClick={() => ai('tr', async () => { const d = await api(`/ai/quizzes/${quiz.id}/translate`, { method: 'POST', body: { language: lang } }); setTranslate(false); toast(t('translate.done'), 'success'); nav(`/admin/quiz/${d.quiz.id}/edit`); })}>{aiBusy === 'tr' ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}{t('translate.button')}</button></>}
      >
        <p className="mb-3 text-sm text-slate-600">{t('translate.hint')}</p>
        <Select value={lang} onChange={(v) => setLang(v || 'Vietnamese')} options={LANGUAGES.map((v) => ({ value: v, label: languageLabel(v) }))} icon={Languages} />
      </Modal>
      {user && null}
    </AdminLayout>
  );
}
