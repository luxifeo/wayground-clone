import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, Play, Settings, Target, ShieldCheck, Gamepad2, Calendar, Clock } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { DEFAULT_SETTINGS } from '../../lib/constants.js';
import { Segmented, Spinner, Toggle, useToast } from '../../components/ui.jsx';

const MODES = [
  { key: 'classic', title: 'Classic', desc: 'Students answer at their own pace and you see results on a live leaderboard', cls: 'from-[#8a1c6c] to-[#5b0f4a]', big: true },
  { key: 'mastery', title: 'Mastery Peak', desc: 'Coming soon', cls: 'from-slate-300 to-slate-400', disabled: true, big: true },
  { key: 'playground', title: 'Playground', desc: 'Coming soon', cls: 'from-slate-400 to-slate-500', disabled: true, big: true },
  { key: 'test', title: 'Test mode', desc: 'Serious, no-frills assessment. No leaderboard, no timer pressure', cls: 'from-[#1f4f8a] to-[#173a6b]' },
  { key: 'team', title: 'Team mode', desc: 'Coming soon', cls: 'from-[#b23a55] to-[#8c2a40]', disabled: true },
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
        <button onClick={() => nav(-1)} className="flex items-center gap-2 font-semibold"><ArrowLeft className="h-5 w-5" />Select a session mode</button>
        <div className="mx-auto mt-14 grid max-w-5xl gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            {MODES.filter((m) => m.big).map((m) => (
              <button key={m.key} disabled={m.disabled} onClick={() => setMode(m.key)} className={`relative flex h-72 flex-col items-center rounded-3xl bg-gradient-to-b ${m.cls} p-6 text-center text-white shadow-lg transition ${m.disabled ? 'cursor-not-allowed opacity-70' : 'hover:-translate-y-1'}`}>
                <span className="text-3xl font-extrabold">{m.title}</span>
                <span className="mt-3 text-sm text-white/80">{m.desc}</span>
                {m.key === 'classic' && <div className="absolute bottom-6 flex gap-2">{['A', 'B', 'C', 'D'].map((x, i) => <span key={x} className={`opt-${i} grid h-12 w-12 place-items-center rounded-lg font-bold`}>{x}</span>)}</div>}
              </button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {MODES.filter((m) => !m.big).map((m) => (
              <button key={m.key} disabled={m.disabled} onClick={() => setMode(m.key)} className={`flex h-24 flex-col items-center justify-center rounded-2xl bg-gradient-to-r ${m.cls} text-white shadow-lg transition ${m.disabled ? 'cursor-not-allowed opacity-70' : 'hover:-translate-y-1'}`}>
                <span className="text-2xl font-extrabold">{m.title}</span><span className="text-xs text-white/80">{m.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const modeInfo = MODES.find((m) => m.key === mode);
  const tabs = [['general', 'General', Settings], ['mastery', 'Mastery', Target], ['anti', 'Anti-cheating', ShieldCheck], ['game', 'Gamification', Gamepad2]];

  return (
    <div className="min-h-full game-bg pb-16">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-black/20 px-4 py-3 text-white backdrop-blur">
        <button onClick={() => (pace === 'student' && kind === 'live' ? setMode(null) : nav(-1))} className="rounded-lg bg-white p-1.5 text-slate-700"><ChevronLeft className="h-4 w-4" /></button>
        <span className="font-semibold">{kind === 'homework' ? 'Assign' : 'Live'}</span><span className="text-white/40">|</span>
        <span className="truncate font-semibold">{quiz.title}</span><span className="text-xs text-white/60">• {quiz.questions.length} questions</span>
        <button onClick={start} disabled={busy} className="ml-auto flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-800">{busy ? <Spinner className="h-4 w-4" /> : <Play className="h-4 w-4" />}{kind === 'homework' ? 'Assign' : 'Start'}</button>
      </header>
      <div className="mx-auto max-w-2xl px-4">
        <div className="py-8 text-white">
          <h1 className="text-2xl font-bold">{kind === 'homework' ? 'Assign as homework' : pace === 'teacher' ? 'Teacher led' : modeInfo.title}</h1>
          <p className="mt-1 text-white/80">{kind === 'homework' ? 'Students join with a code and complete it any time before the deadline.' : pace === 'teacher' ? 'You control the pace from the big screen. Everyone answers the same question together.' : modeInfo.desc}</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-xl">
          {kind === 'homework' && (
            <div className="mb-5 space-y-3 rounded-xl border border-slate-200 p-4">
              <div className="font-semibold">Assignment details</div>
              <div><label className="label">Title</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Start</label><input className="input" disabled value="Now" /></div>
                <div><label className="label flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Deadline</label><input type="datetime-local" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
              </div>
            </div>
          )}
          <div className="rounded-xl border border-slate-200 px-4">
            <div className="pt-4 font-semibold text-slate-500">Primary Settings</div>
            {pace === 'student' && (
              <Row title="Session attempts"><Segmented value={s.attempts} onChange={set('attempts')} options={[{ value: 0, label: 'Unlimited' }, { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }]} /></Row>
            )}
            {pace === 'student' && (
              <Row title="Question timer" sub="Use each question's time limit and give speed bonuses">
                <select className="input w-40" value={s.timer ? 'on' : 'off'} onChange={(e) => set('timer')(e.target.value === 'on')}><option value="off">Off</option><option value="on">On</option></select>
              </Row>
            )}
            {pace === 'teacher' && <Row title="Question timer" sub="Each question uses its own time limit. You can reveal early.">On</Row>}
          </div>

          <div className="mt-6 font-semibold text-slate-500">More settings</div>
          <div className="mt-2 flex gap-1 border-b border-slate-200">
            {tabs.map(([k, l, I]) => (
              <button key={k} onClick={() => { setTab(k); document.getElementById(`sec-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold ${tab === k ? 'border-slate-800 text-slate-900' : 'border-transparent text-slate-500'}`}><I className="h-4 w-4" />{l}</button>
            ))}
          </div>
          <div id="sec-general" className="mt-4 rounded-xl border border-slate-200 px-4 divide-y divide-slate-100">
            <Row title="Anonymize student names" sub="Show fun names instead of real names on the leaderboard"><Toggle checked={s.anonymize} onChange={set('anonymize')} /></Row>
            {pace === 'student' && <Row title="Skip questions & attempt later"><Toggle checked={s.skipQuestions} onChange={set('skipQuestions')} /></Row>}
          </div>
          <div id="sec-mastery" className="mt-4 rounded-xl border border-slate-200 px-4 divide-y divide-slate-100">
            <div className="pt-3 text-lg font-semibold text-slate-700">Mastery</div>
            {pace === 'student' && (
              <Row title="Show answer after each question" sub="Validate only tells students if they were right">
                <Segmented value={s.showAnswers} onChange={set('showAnswers')} options={[{ value: 'on', label: 'On' }, { value: 'validate', label: 'Validate only' }, { value: 'off', label: 'Off' }]} />
              </Row>
            )}
            <Row title="Show all answers after session"><Segmented value={s.showAnswersAfter} onChange={set('showAnswersAfter')} options={[{ value: 'on', label: 'On' }, { value: 'questions', label: 'Questions only' }, { value: 'off', label: 'Off' }]} /></Row>
          </div>
          <div id="sec-anti" className="mt-4 rounded-xl border border-slate-200 px-4 divide-y divide-slate-100">
            <div className="pt-3 text-lg font-semibold text-slate-700">Anti-cheating</div>
            {pace === 'student' && <Row title="Shuffle questions"><Toggle checked={s.shuffleQuestions} onChange={set('shuffleQuestions')} /></Row>}
            <Row title="Shuffle answers"><Toggle checked={s.shuffleAnswers} onChange={set('shuffleAnswers')} /></Row>
          </div>
          <div id="sec-game" className="mt-4 rounded-xl border border-slate-200 px-4 divide-y divide-slate-100">
            <div className="pt-3 text-lg font-semibold text-slate-700">Gamification</div>
            <Row title={<span>Serious theme <span className="ml-1 rounded border border-brand-200 px-1 text-[10px] font-bold text-brand-500">NEW</span></span>} sub="Focused environment without gamifications"><Toggle checked={s.serious} onChange={(v) => setS({ ...s, serious: v, memes: v ? false : s.memes })} /></Row>
            <Row title="Leaderboard"><Toggle checked={s.leaderboard && mode !== 'test'} disabled={mode === 'test'} onChange={set('leaderboard')} /></Row>
            <Row title="Show memes" sub="Fun reactions after each answer"><Toggle checked={s.memes && !s.serious} disabled={s.serious} onChange={set('memes')} /></Row>
            <Row title="Sound effects"><Toggle checked={s.music} onChange={set('music')} /></Row>
          </div>
          <button onClick={start} disabled={busy} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 py-3 font-bold hover:bg-slate-50">{busy ? <Spinner className="h-4 w-4" /> : <Play className="h-4 w-4" />}{kind === 'homework' ? 'Assign' : 'Start'}</button>
        </div>
      </div>
    </div>
  );
}
