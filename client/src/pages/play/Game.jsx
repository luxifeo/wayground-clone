import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Trophy, Flame, Check, X, Clock, SkipForward, ChevronRight, Maximize, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api.js';
import { useSocket } from '../../lib/socket.js';
import { sfx } from '../../lib/sound.js';
import { UNGRADED } from '../../lib/constants.js';
import { Avatar, LogoMark, Spinner } from '../../components/ui.jsx';
import QuestionPlayer from '../../components/play/QuestionPlayer.jsx';
import Summary from './Summary.jsx';
import LanguageSwitcher from '../../components/LanguageSwitcher.jsx';
import { fmtDate } from '../../i18n/index.js';

const REACTIONS = ['👏', '😂', '😮', '🔥', '❤️'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function TimerBar({ total, left }) {
  const pct = total ? (left / total) * 100 : 100;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
      <div className={`h-full transition-all duration-300 ${pct < 25 ? 'bg-red-400' : 'bg-white'}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ResultBanner({ result, memes, onNext, last, auto }) {
  const { t } = useTranslation('play');
  if (!result) return null;
  const st = result.status;
  const neutral = result.hidden || st === 'ungraded' || st === 'skipped' && result.timeUp === undefined;
  const ok = st === 'correct';
  const partial = st === 'partial';
  const color = result.hidden || st === 'ungraded' ? 'bg-blue-600' : ok ? 'bg-emerald-600' : partial ? 'bg-amber-500' : 'bg-red-600';
  const label = t(result.hidden ? 'game.banner.submitted' : st === 'ungraded' ? 'game.banner.recorded' : ok ? 'common:result.correct' : partial ? 'game.banner.partial' : st === 'skipped' ? (result.timeUp ? 'game.banner.timeUp' : 'common:result.skipped') : 'common:result.incorrect');
  return (
    <div className={`fixed inset-x-0 bottom-0 z-30 ${color} px-4 py-3 text-white shadow-2xl animate-rise`}>
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20">{ok ? <Check className="h-5 w-5" /> : result.hidden || st === 'ungraded' ? <Send className="h-4 w-4" /> : <X className="h-5 w-5" />}</span>
        <div className="flex-1">
          <div className="font-game text-xl font-bold">{label}{result.score > 0 && <span className="ml-3 text-yellow-200">+{result.score}</span>}</div>
          {memes && !neutral && !result.hidden && <div className="text-sm text-white/90">{ok ? pick(t('game.memesOk', { returnObjects: true })) : partial ? t('game.banner.almost') : pick(t('game.memesBad', { returnObjects: true }))}</div>}
          {result.explanation && <div className="mt-1 text-sm text-white/90">💡 {result.explanation}</div>}
        </div>
        {onNext && <button onClick={onNext} className="flex items-center gap-1 rounded-xl bg-white px-5 py-2.5 font-game font-bold text-slate-800">{last ? t('game.finish') : t('game.next')}<ChevronRight className="h-5 w-5" />{auto && <span className="text-xs text-slate-400">{auto}</span>}</button>}
      </div>
    </div>
  );
}

export default function Game() {
  const { t } = useTranslation('play');
  const { token } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [state, setState] = useState(null);
  const [queue, setQueue] = useState([]); // student-paced remaining question ids
  const [result, setResult] = useState(null);
  const [myResults, setMyResults] = useState({}); // qid -> result
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [rank, setRank] = useState(null);
  const [finished, setFinished] = useState(false);
  const [left, setLeft] = useState(null);
  const [kicked, setKicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hall, setHall] = useState(false); // assignment waiting hall before the first question
  const qStart = useRef(Date.now());
  const sent = useRef(new Set());
  const offset = useRef(0);

  const load = useCallback(async () => {
    try {
      const d = await api(`/play/${token}`);
      setData(d); setState(d.state);
      setScore(d.participant.score); setStreak(d.participant.streak); setRank(d.rank);
      const done = new Set(d.answered.map((a) => a.question_id));
      done.forEach((id) => sent.current.add(id));
      setQueue(d.questions.map((q) => q.id).filter((id) => !done.has(id)));
      setFinished(d.participant.finished);
      setHall(d.session.kind === 'homework' && d.session.status === 'running' && !d.answered.length && !d.participant.finished);
      setHall(d.session.kind === 'homework' && d.session.status === 'running' && !d.answered.length && !d.participant.finished);
      offset.current = new Date(d.state.serverNow).getTime() - Date.now();
      sfx.enabled = localStorage.getItem('wg_sound') !== '0';
    } catch (e) {
      if (e.data?.kicked) setKicked(e.data.disconnected ? 'disconnected' : true); else setErr(e.message);
    }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const sock = useSocket('player:watch', { token }, {
    'session:state': (st) => {
      if (!st) return;
      setState((prev) => {
        if (prev && prev.status === 'lobby' && st.status === 'running') { sfx.start(); setTimeout(load, 50); }
        if (prev && st.pace === 'teacher' && st.currentIndex !== prev.currentIndex) { setResult(null); qStart.current = Date.now(); }
        return st;
      });
      if (st.serverNow) offset.current = new Date(st.serverNow).getTime() - Date.now();
    },
    kicked: (d) => setKicked(d?.disconnected ? 'disconnected' : true),
  });

  const session = data?.session;
  const isTeacher = session?.pace === 'teacher';
  const qById = useMemo(() => new Map((data?.questions || []).map((q) => [q.id, q])), [data]);
  const current = isTeacher ? state?.question : qById.get(queue[0]);
  const timerOn = session?.settings?.timer;
  const total = session?.total || 0;
  const answeredCount = isTeacher ? (state?.currentIndex ?? 0) + 1 : total - queue.length + 1;

  // reset timer whenever a new question shows
  useEffect(() => { qStart.current = Date.now(); setResult(null); }, [current?.id]);

  const submit = useCallback(async (answer, timeUp = false) => {
    if (!current || sent.current.has(current.id)) return;
    sent.current.add(current.id);
    setBusy(true);
    try {
      const r = await api(`/play/${token}/answer`, { method: 'POST', body: { questionId: current.id, answer, timeMs: Date.now() - qStart.current } });
      const res = { ...r, timeUp, answer };
      setMyResults((m) => ({ ...m, [current.id]: res }));
      setScore(r.totalScore); setStreak(r.streak); setRank(r.rank);
      if (!isTeacher) setResult(res);
      if (!UNGRADED.includes(current.type) && !r.hidden) (r.status === 'correct' ? sfx.correct() : r.status !== 'partial' && sfx.wrong());
    } catch (e) {
      setResult({ status: 'skipped', error: e.message });
    } finally { setBusy(false); }
  }, [current, token, isTeacher]);

  // countdown
  useEffect(() => {
    if (!current || hall || !(timerOn || isTeacher)) { setLeft(null); return undefined; }
    const tick = () => {
      const started = isTeacher && state?.questionStartedAt ? new Date(state.questionStartedAt).getTime() - offset.current : qStart.current;
      const l = Math.max(0, current.time_limit - (Date.now() - started) / 1000);
      setLeft(l);
      if (l <= 0 && !sent.current.has(current.id) && !isTeacher) submit(null, true);
    };
    tick();
    const iv = setInterval(tick, 200);
    return () => clearInterval(iv);
  }, [current, hall, timerOn, isTeacher, state?.questionStartedAt, submit]);

  const next = useCallback(async () => {
    setResult(null);
    const rest = queue.slice(1);
    setQueue(rest);
    if (!rest.length) {
      await api(`/play/${token}/finish`, { method: 'POST', body: {} }).catch(() => {});
      setFinished(true);
    }
  }, [queue, token]);

  const skip = () => setQueue((q) => [...q.slice(1), q[0]]);

  if (kicked) return <Center>{kicked === 'disconnected' ? t('game.disconnected') : t('game.removed')}<button onClick={() => nav('/join')} className="mt-4 rounded-xl bg-white px-5 py-2 font-bold text-slate-800">{t('game.joinAnother')}</button></Center>;
  if (err) return <Center>{err}<button onClick={() => nav('/join')} className="mt-4 rounded-xl bg-white px-5 py-2 font-bold text-slate-800">{t('common:actions.back')}</button></Center>;
  if (!data || !state) return <Center><Spinner className="h-10 w-10" /></Center>;

  const ended = state.status === 'ended';
  if (finished || (ended && !isTeacher) || (ended && isTeacher)) {
    return <Summary token={token} onAgain={(tk) => nav(`/play/${tk}`, { replace: true })} />;
  }

  const serious = session.settings.serious;
  const topBar = (
    <header className="flex items-center gap-2 px-3 py-2 sm:px-5">
      <LogoMark className="h-6 w-6" color="#fff" />
      {!serious && session.settings.leaderboard && rank && <span className="flex items-center gap-1 rounded-lg bg-black/30 px-2.5 py-1 font-game text-sm font-bold text-white"><Trophy className="h-4 w-4 text-yellow-300" />{t('game.rank', { count: rank, ordinal: true })}</span>}
      {!serious && <span className="flex items-center gap-1 rounded-lg bg-black/30 px-2.5 py-1 font-game text-sm font-bold text-white"><Flame className={`h-4 w-4 ${streak >= 2 ? 'text-orange-400' : 'text-white/50'}`} />{streak}</span>}
      {!serious && session.gameType !== 'test' && <span className="rounded-lg bg-black/30 px-2.5 py-1 font-game text-sm font-bold text-white">{t('game.pts', { score, count: score })}</span>}
      <LanguageSwitcher dark className="ml-auto" />
      <span className="rounded-lg bg-black/30 px-3 py-1 font-game text-sm font-bold text-white">{session.code.replace(/(\d{3})(\d{3})/, '$1 $2')}</span>
      <button onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())} title={t('game.fullscreen')} className="rounded-lg bg-black/30 p-1.5 text-white"><Maximize className="h-4 w-4" /></button>
    </header>
  );

  // ----- lobby
  if (state.status === 'lobby') {
    return (
      <div className="flex min-h-full flex-col game-bg">
        {topBar}
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="font-game text-lg font-bold text-white">{t('game.waitingHost')}</div>
          <div className="relative flex flex-col items-center">
            <div className="animate-float"><Avatar avatar={data.participant.avatar} name={data.participant.name} size={120} /></div>
            <div className="-mt-2 h-10 w-56 rounded-[50%] bg-gradient-to-b from-pink-400 to-pink-700 shadow-2xl" />
            <div className="mt-2 font-game text-2xl font-bold text-white">{data.participant.name}</div>
          </div>
          <div className="text-sm text-white/70">{session.title} · {t('common:count.questions', { count: total })}</div>
          <div className="mt-6 flex gap-2">
            {REACTIONS.map((e) => <button key={e} onClick={() => sock.current?.emit('player:reaction', { emoji: e })} className="rounded-xl bg-white/10 px-3 py-2 text-2xl transition hover:scale-110 hover:bg-white/20">{e}</button>)}
          </div>
        </div>
      </div>
    );
  }

  // ----- teacher led
  if (isTeacher) {
    const my = state.question ? myResults[state.question.id] : null;
    const reveal = state.phase === 'reveal' || state.phase === 'leaderboard';
    if (state.phase === 'leaderboard' && state.leaderboard) {
      return (
        <div className="flex min-h-full flex-col game-bg">
          {topBar}
          <div className="mx-auto w-full max-w-md flex-1 px-4 pt-6">
            <div className="mb-4 text-center font-game text-2xl font-bold text-white"><Trophy className="mr-1 inline h-6 w-6 text-yellow-300" />{t('game.leaderboard')}</div>
            {state.leaderboard.map((p, i) => (
              <div key={p.id} className={`mb-2 flex items-center gap-3 rounded-xl px-4 py-2.5 text-white ${p.id === data.participant.id ? 'bg-white/30 ring-2 ring-white' : 'bg-white/10'}`}>
                <span className="w-6 font-game font-bold">{i + 1}</span><Avatar avatar={p.avatar} name={p.name} size={30} /><span className="flex-1 font-game font-bold">{p.name}</span><span className="font-game font-bold text-yellow-300">{p.score}</span>
              </div>
            ))}
            <div className="mt-6 text-center text-white/70">{t('game.waitingNext')}</div>
          </div>
        </div>
      );
    }
    if (!state.question) return <div className="min-h-full game-bg">{topBar}<Center>{t('game.getReady')}</Center></div>;
    const timeUp = left !== null && left <= 0 && !my;
    return (
      <div className="flex min-h-full flex-col game-bg pb-24">
        {topBar}
        <div className="mx-auto w-full max-w-6xl px-4"><TimerBar total={state.question.time_limit} left={reveal ? 0 : left ?? 0} /></div>
        <div className="mt-1 text-center font-game text-sm font-bold text-white/80">{state.currentIndex + 1}/{state.total}</div>
        {my && !reveal ? (
          <Center>
            <div className="animate-pop text-5xl">⏳</div>
            <div className="font-game text-2xl font-bold">{t('game.answerSubmitted')}</div>
            <div className="text-white/70">{t('game.waitingEveryone')}</div>
          </Center>
        ) : (
          <QuestionPlayer
            key={state.question.id} question={state.question} token={token} onSubmit={(a) => submit(a)}
            result={reveal ? { ...(my || { status: 'skipped' }), reveal: state.reveal } : null}
            locked={timeUp || reveal || busy}
          />
        )}
        {reveal && <ResultBanner result={{ ...(my || { status: 'skipped', timeUp: true }), explanation: state.explanation }} memes={session.settings.memes && !serious} />}
        {timeUp && !reveal && <div className="fixed inset-x-0 bottom-0 bg-red-600 py-3 text-center font-game text-xl font-bold text-white">{t('game.timeUp')}</div>}
      </div>
    );
  }

  // ----- assignment hall: wait for the student to press Start
  if (hall) {
    return (
      <div className="flex min-h-full flex-col game-bg">
        {topBar}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 pb-6">
          <div className="text-center font-game text-xl font-bold text-white">{session.title}</div>
          <div className="text-sm text-white/70">{t('common:count.questions', { count: total })}{session.settings.attempts ? ` · ${t('game.attemptsAllowed', { count: session.settings.attempts })}` : ''}</div>
          <div className="relative mt-6 flex flex-col items-center">
            <div className="absolute -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="relative animate-float"><Avatar avatar={data.participant.avatar} name={data.participant.name} size={130} /></div>
            <div className="relative -mt-3 flex h-14 w-72 items-center justify-center rounded-[50%] bg-gradient-to-b from-pink-400 to-pink-700 font-game text-lg font-bold tracking-widest text-white/90 shadow-2xl">{data.participant.name}</div>
          </div>
        </div>
        <div className="mx-auto mb-8 flex flex-col items-center gap-2">
          <button onClick={() => { qStart.current = Date.now(); setHall(false); sfx.start(); }} className="game-btn bg-fuchsia-500 px-12 py-3.5 text-2xl text-white shadow-[0_5px_0_#86198f] hover:brightness-110">{t('game.startGame')}</button>
          {session.deadline && <div className="font-game text-sm font-bold text-white/80">{t('game.deadline', { date: fmtDate(session.deadline, { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' }) })}</div>}
        </div>
      </div>
    );
  }

  // ----- student paced
  if (!current) return <Center><Spinner className="h-10 w-10" /></Center>;
  const autoNext = result && !result.error;
  return (
    <div className="flex min-h-full flex-col game-bg pb-24">
      {topBar}
      {timerOn && <div className="mx-auto w-full max-w-6xl px-4"><TimerBar total={current.time_limit} left={left ?? current.time_limit} /></div>}
      <div className="mt-1 flex items-center justify-center gap-3 font-game text-sm font-bold text-white/80">
        <span className="rounded-full bg-black/30 px-3 py-0.5">{Math.min(total, answeredCount)}/{total}</span>
        {timerOn && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{Math.ceil(left ?? current.time_limit)}s</span>}
        {session.settings.skipQuestions && !result && queue.length > 1 && <button onClick={skip} className="flex items-center gap-1 rounded-full bg-black/30 px-3 py-0.5 hover:bg-black/50"><SkipForward className="h-4 w-4" />{t('game.skip')}</button>}
      </div>
      <QuestionPlayer
        key={current.id} question={current} token={token} onSubmit={(a) => submit(a)} locked={busy}
        result={result && !result.hidden && !result.validateOnly ? result : null}
        myResponseId={null}
      />
      {result?.error && <div className="mx-auto mt-2 rounded-lg bg-red-500 px-4 py-2 text-white">{result.error}</div>}
      {autoNext && <ResultBanner result={result} memes={session.settings.memes && !serious} onNext={next} last={queue.length <= 1} />}
    </div>
  );
}

function Center({ children }) {
  return <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-2 px-4 text-center font-game text-xl font-bold text-white game-bg">{children}</div>;
}

export { Center };
