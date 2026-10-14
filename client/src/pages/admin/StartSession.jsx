import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, Play, Settings, Target, ShieldCheck, Gamepad2, Calendar, Clock } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { DEFAULT_SETTINGS } from '../../lib/constants.js';
import { Segmented, Spinner, Toggle, useToast } from '../../components/ui.jsx';

// title / desc come from start:modes.<key>
const MODES = [
  { key: 'classic', cls: 'from-[#8a1c6c] to-[#5b0f4a]', big: true },
  { key: 'mastery', cls: 'from-slate-300 to-slate-400', disabled: true, big: true },
  { key: 'playground', cls: 'from-slate-400 to-slate-500', disabled: true, big: true },
  { key: 'test', cls: 'from-[#1f4f8a] to-[#173a6b]' },
  { key: 'team', cls: 'from-[#b23a55] to-[#8c2a40]', disabled: true },
];

function Row({ title, sub, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div><div className="text-sm font-semibold text-slate-800">{title}</div>{sub && <div className="text-xs text-slate-500">{sub}</div>}</div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const pad = (n) => String(n).padStart(2, '0');
const localInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export default function StartSession() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const { t } = useTranslation('start');
  const kind = params.get('kind') === 'homework' ? 'homework' : 'live';
  const pace = kind === 'homework' ? 'student' : params.get('pace') === 'teacher' ? 'teacher' : 'student';
  const [quiz, setQuiz] = useState(null);
  const [mode, setMode] = useState(pace === 'teacher' || kind === 'homework' ? 'classic' : null);
  const [s, setS] = useState({ ...DEFAULT_SETTINGS });
  const [tab, setTab] = useState('general');
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState(localInput(new Date(Date.now() + 7 * 86400000)));
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setS({ ...s, [k]: v });

  useEffect(() => { get(`/quizzes/${id}`).then((d) => { setQuiz(d.quiz); setTitle(d.quiz.title); }); }, [id]);

  const start = async () => {
    setBusy(true);
    try {
      const { session } = await post('/sessions', {
        quizId: +id, kind, pace, gameType: mode === 'test' ? 'test' : 'classic', settings: s,
        title: kind === 'homework' ? title : undefined,
        deadline: kind === 'homework' && deadline ? new Date(deadline).toISOString() : undefined,
      });
      nav(kind === 'homework' ? `/admin/reports/${session.id}?assigned=1` : `/host/${session.id}`);
    } catch (e) { toast(e.message, 'error'); setBusy(false); }
  };

  if (!quiz) return <div className="grid h-full place-items-center"><Spinner className="h-8 w-8 text-slate-400" /></div>;

  if (!mode) {
    return (
      <div className="min-h-full bg-white px-6 py-6">
        <button onClick={() => nav(-1)} className="flex items-center gap-2 font-semibold"><ArrowLeft className="h-5 w-5" />{t('selectMode')}</button>
        <div className="mx-auto mt-14 grid max-w-5xl gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            {MODES.filter((m) => m.big).map((m) => (
              <button key={m.key} disabled={m.disabled} onClick={() => setMode(m.key)} className={`relative flex h-72 flex-col items-center rounded-3xl bg-gradient-to-b ${m.cls} p-6 text-center text-white shadow-lg transition ${m.disabled ? 'cursor-not-allowed opacity-70' : 'hover:-translate-y-1'}`}>
                <span className="text-3xl font-extrabold">{t(`modes.${m.key}.title`)}</span>
                <span className="mt-3 text-sm text-white/80">{t(`modes.${m.key}.desc`)}</span>
                {m.key === 'classic' && <div className="absolute bottom-6 flex gap-2">{['A', 'B', 'C', 'D'].map((x, i) => <span key={x} className={`opt-${i} grid h-12 w-12 place-items-center rounded-lg font-bold`}>{x}</span>)}</div>}
              </button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {MODES.filter((m) => !m.big).map((m) => (
              <button key={m.key} disabled={m.disabled} onClick={() => setMode(m.key)} className={`flex h-24 flex-col items-center justify-center rounded-2xl bg-gradient-to-r ${m.cls} text-white shadow-lg transition ${m.disabled ? 'cursor-not-allowed opacity-70' : 'hover:-translate-y-1'}`}>
                <span className="text-2xl font-extrabold">{t(`modes.${m.key}.title`)}</span><span className="text-xs text-white/80">{t(`modes.${m.key}.desc`)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const tabs = [['general', t('tabs.general'), Settings], ['mastery', t('tabs.mastery'), Target], ['anti', t('tabs.anti'), ShieldCheck], ['game', t('tabs.game'), Gamepad2]];
  const on = t('opt.on'); const off = t('opt.off');

  return (
    <div className="min-h-full game-bg pb-16">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-black/20 px-4 py-3 text-white backdrop-blur">
        <button onClick={() => (pace === 'student' && kind === 'live' ? setMode(null) : nav(-1))} title={t('back')} className="rounded-lg bg-white p-1.5 text-slate-700"><ChevronLeft className="h-4 w-4" /></button>
        <span className="font-semibold">{kind === 'homework' ? t('common:actions.assign') : t('common:session.live')}</span><span className="text-white/40">|</span>
        <span className="truncate font-semibold">{quiz.title}</span><span className="text-xs text-white/60">• {t('common:count.questions', { count: quiz.questions.length })}</span>
        <button onClick={start} disabled={busy} className="ml-auto flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-800">{busy ? <Spinner className="h-4 w-4" /> : <Play className="h-4 w-4" />}{kind === 'homework' ? t('common:actions.assign') : t('common:actions.start')}</button>
      </header>
      <div className="mx-auto max-w-2xl px-4">
        <div className="py-8 text-white">
          <h1 className="text-2xl font-bold">{kind === 'homework' ? t('homeworkTitle') : pace === 'teacher' ? t('common:session.teacherLed') : t(`modes.${mode}.title`)}</h1>
          <p className="mt-1 text-white/80">{kind === 'homework' ? t('homeworkDesc') : pace === 'teacher' ? t('teacherDesc') : t(`modes.${mode}.desc`)}</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-xl">
          {kind === 'homework' && (
            <div className="mb-5 space-y-3 rounded-xl border border-slate-200 p-4">
              <div className="font-semibold">{t('details.title')}</div>
              <div><label className="label">{t('details.name')}</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{t('details.start')}</label><input className="input" disabled value={t('details.now')} /></div>
                <div><label className="label flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{t('details.deadline')}</label><input type="datetime-local" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
              </div>
            </div>
          )}
          <div className="rounded-xl border border-slate-200 px-4">
            <div className="pt-4 font-semibold text-slate-500">{t('primary')}</div>
            {pace === 'student' && (
              <Row title={t('rows.attempts')}><Segmented value={s.attempts} onChange={set('attempts')} options={[{ value: 0, label: t('opt.unlimited') }, { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }]} /></Row>
            )}
            {pace === 'student' && (
              <Row title={t('rows.timer')} sub={t('rows.timerSub')}>
                <select className="input w-40" value={s.timer ? 'on' : 'off'} onChange={(e) => set('timer')(e.target.value === 'on')}><option value="off">{off}</option><option value="on">{on}</option></select>
              </Row>
            )}
            {pace === 'teacher' && <Row title={t('rows.timer')} sub={t('rows.timerTeacherSub')}>{on}</Row>}
          </div>

          <div className="mt-6 font-semibold text-slate-500">{t('more')}</div>
          <div className="mt-2 flex gap-1 border-b border-slate-200">
            {tabs.map(([k, l, I]) => (
              <button key={k} onClick={() => { setTab(k); document.getElementById(`sec-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold ${tab === k ? 'border-slate-800 text-slate-900' : 'border-transparent text-slate-500'}`}><I className="h-4 w-4" />{l}</button>
            ))}
          </div>
          <div id="sec-general" className="mt-4 rounded-xl border border-slate-200 px-4 divide-y divide-slate-100">
            <Row title={t('rows.anonymize')} sub={t('rows.anonymizeSub')}><Toggle checked={s.anonymize} onChange={set('anonymize')} /></Row>
            {pace === 'student' && <Row title={t('rows.skip')}><Toggle checked={s.skipQuestions} onChange={set('skipQuestions')} /></Row>}
          </div>
          <div id="sec-mastery" className="mt-4 rounded-xl border border-slate-200 px-4 divide-y divide-slate-100">
            <div className="pt-3 text-lg font-semibold text-slate-700">{t('tabs.mastery')}</div>
            {pace === 'student' && (
              <Row title={t('rows.showAnswers')} sub={t('rows.showAnswersSub')}>
                <Segmented value={s.showAnswers} onChange={set('showAnswers')} options={[{ value: 'on', label: on }, { value: 'validate', label: t('opt.validate') }, { value: 'off', label: off }]} />
              </Row>
            )}
            <Row title={t('rows.showAll')}><Segmented value={s.showAnswersAfter} onChange={set('showAnswersAfter')} options={[{ value: 'on', label: on }, { value: 'questions', label: t('opt.questionsOnly') }, { value: 'off', label: off }]} /></Row>
          </div>
          <div id="sec-anti" className="mt-4 rounded-xl border border-slate-200 px-4 divide-y divide-slate-100">
            <div className="pt-3 text-lg font-semibold text-slate-700">{t('tabs.anti')}</div>
            {pace === 'student' && <Row title={t('rows.shuffleQuestions')}><Toggle checked={s.shuffleQuestions} onChange={set('shuffleQuestions')} /></Row>}
            <Row title={t('rows.shuffleAnswers')}><Toggle checked={s.shuffleAnswers} onChange={set('shuffleAnswers')} /></Row>
          </div>
          <div id="sec-game" className="mt-4 rounded-xl border border-slate-200 px-4 divide-y divide-slate-100">
            <div className="pt-3 text-lg font-semibold text-slate-700">{t('tabs.game')}</div>
            <Row title={<span>{t('rows.serious')} <span className="ml-1 rounded border border-brand-200 px-1 text-[10px] font-bold text-brand-500">{t('rows.new')}</span></span>} sub={t('rows.seriousSub')}><Toggle checked={s.serious} onChange={(v) => setS({ ...s, serious: v, memes: v ? false : s.memes })} /></Row>
            <Row title={t('rows.leaderboard')}><Toggle checked={s.leaderboard && mode !== 'test'} disabled={mode === 'test'} onChange={set('leaderboard')} /></Row>
            <Row title={t('rows.memes')} sub={t('rows.memesSub')}><Toggle checked={s.memes && !s.serious} disabled={s.serious} onChange={set('memes')} /></Row>
            <Row title={t('rows.sound')}><Toggle checked={s.music} onChange={set('music')} /></Row>
          </div>
          <button onClick={start} disabled={busy} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 py-3 font-bold hover:bg-slate-50">{busy ? <Spinner className="h-4 w-4" /> : <Play className="h-4 w-4" />}{kind === 'homework' ? t('common:actions.assign') : t('common:actions.start')}</button>
        </div>
      </div>
    </div>
  );
}
