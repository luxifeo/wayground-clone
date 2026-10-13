import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  Copy, Users, Maximize, Volume2, VolumeX, Trophy, ChevronRight, Eye, BarChart3, Clock, ChartPie, Check,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { getToken } from '../../lib/api.js';
import { useSocket } from '../../lib/socket.js';
import { sfx } from '../../lib/sound.js';
import { CHOICE_TYPES, QTYPES } from '../../lib/constants.js';
import { Avatar, Logo, Spinner, useToast } from '../../components/ui.jsx';
import { QuestionBody } from '../../components/QuestionCard.jsx';
import { WordCloud } from '../../components/play/answers.jsx';
import ParticipantActions from '../../components/ParticipantActions.jsx';

const STATUS_COLOR = { correct: 'bg-emerald-500', incorrect: 'bg-red-500', partial: 'bg-amber-400', ungraded: 'bg-blue-500', skipped: 'bg-slate-400' };

export function AccuracyBar({ value, dark = true }) {
  const v = value ?? 0;
  return (
    <div className="w-full">
      <div className={`relative h-10 rounded-full ${dark ? 'bg-white/10' : 'bg-slate-100'} p-1`}>
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all" style={{ width: `${Math.max(4, v)}%` }} />
        <span className="absolute top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border-4 border-slate-800 bg-white text-sm font-bold text-slate-800" style={{ left: `calc(${Math.min(96, Math.max(0, v))}% - 24px)` }}>{value === null || value === undefined ? '–' : `${v}%`}</span>
      </div>
      <div className={`mt-1 flex justify-between px-1 text-[10px] ${dark ? 'text-white/50' : 'text-slate-400'}`}>{[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((n) => <span key={n}>{n}%</span>)}</div>
    </div>
  );
}

function useCountdown(startedAt, limit, offset) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  if (!startedAt) return limit;
  return Math.max(0, Math.ceil(limit - (now + offset - new Date(startedAt).getTime()) / 1000));
}

function Podium({ players, title }) {
  const top = players.slice(0, 3);
  const order = [top[1], top[0], top[2]];
  const heights = ['h-40', 'h-56', 'h-32'];
  const labels = ['2nd', '1st', '3rd'];
  return (
    <div className="flex flex-1 flex-col items-center justify-end">
      <div className="mb-auto mt-6 text-center text-white"><Logo dark small /><div className="mt-1 font-semibold">{title}</div></div>
      <div className="flex items-end gap-4">
        {order.map((p, i) => (
          <div key={i} className="flex w-44 flex-col items-center">
            {p && (
              <div className="mb-2 flex flex-col items-center animate-rise" style={{ animationDelay: `${(2 - i) * 300}ms` }}>
                <Avatar avatar={p.avatar} name={p.name} size={i === 1 ? 72 : 56} />
                <div className="mt-1 max-w-[160px] truncate font-game text-lg font-bold text-white">{p.name}</div>
                <div className="text-sm font-bold text-yellow-300">{p.score}</div>
              </div>
            )}
            <div className={`${heights[i]} w-full rounded-t-2xl bg-gradient-to-b from-slate-800 to-black`}>
              <div className={`pt-6 text-center font-game text-4xl font-extrabold italic ${i === 1 ? 'text-yellow-400' : i === 0 ? 'text-slate-200' : 'text-amber-600'}`}>{labels[i]}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OverviewTable({ data, onPlayer, onChange }) {
  const [showTime, setShowTime] = useState(false);
  return (
    <div className="rounded-2xl bg-black/30 p-4 text-white">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
        {[['bg-emerald-500', 'Correct'], ['bg-red-500', 'Incorrect'], ['bg-amber-400', 'Partially correct'], ['bg-blue-500', 'Ungraded'], ['bg-slate-400', 'Unattempted']].map(([c, l]) => <span key={l} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${c}`} />{l}</span>)}
        <label className="ml-auto flex items-center gap-2"><input type="checkbox" checked={showTime} onChange={(e) => setShowTime(e.target.checked)} />Show time taken</label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-white/70">
              <th className="p-2">#</th><th className="p-2">Names</th><th className="p-2">Score</th><th className="p-2">Accuracy</th>
              {data.questions.map((q, i) => <th key={q.id} className="p-1 text-center text-xs">Q{i + 1}</th>)}
              {onChange && <th className="w-10 p-1" />}
            </tr>
          </thead>
          <tbody>
            {data.players.map((p) => (
              <tr key={p.id} className="cursor-pointer border-t border-white/10 hover:bg-white/5" onClick={() => onPlayer?.(p)}>
                <td className="p-2">{p.rank}</td>
                <td className="p-2"><span className="flex items-center gap-2"><Avatar avatar={p.avatar} name={p.name} size={24} />{p.name}{p.attempt > 1 && <span className="text-xs text-white/50">(attempt {p.attempt})</span>}{p.disconnected && <span className="rounded bg-white/10 px-1.5 text-[10px] font-bold text-white/60">DISCONNECTED</span>}</span></td>
                <td className="p-2 font-bold">{p.score}</td>
                <td className="p-2">{p.accuracy === null ? '–' : `${p.accuracy}%`}</td>
                {p.statuses.map((st, i) => (
                  <td key={i} className="p-1 text-center"><span className={`mx-auto block h-6 w-6 rounded ${st ? STATUS_COLOR[st] : 'bg-white/10'}`} title={st || 'not attempted'} /></td>
                ))}
                {onChange && <td className="p-1"><ParticipantActions dark sessionId={data.session.id} player={p} onChange={onChange} /></td>}
              </tr>
            ))}
          </tbody>
        </table>
        {!data.players.length && <div className="py-6 text-center text-white/50">No participants yet</div>}
      </div>
      {showTime && null}
    </div>
  );
}

export { OverviewTable, STATUS_COLOR };

function HostQuestion({ cur, phase, total, remaining }) {
  const q = cur.question;
  const reveal = phase !== 'question';
  const counts = cur.distribution || {};
  const maxCount = Math.max(1, ...Object.values(counts));
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-6 pb-6">
      <div className="flex items-center justify-between text-white">
        <span className="rounded-full bg-black/30 px-4 py-1.5 font-game font-bold">{cur.index + 1}/{total}</span>
        {phase === 'question' && <span className={`grid h-16 w-16 place-items-center rounded-full border-4 font-game text-2xl font-bold ${remaining <= 5 ? 'border-red-400 text-red-300' : 'border-white/60'}`}>{remaining}</span>}
        <span className="rounded-full bg-black/30 px-4 py-1.5 font-game font-bold"><Users className="mr-1 inline h-4 w-4" />{cur.answeredCount} answered</span>
      </div>
      <div className="game-panel flex flex-col items-center gap-4 p-6 md:flex-row">
        {q.image && !['labeling', 'hotspot'].includes(q.type) && <img src={q.image} alt="" className="max-h-56 rounded-xl" />}
        <div className="flex-1 whitespace-pre-wrap text-center font-game text-3xl font-bold text-white">{q.text.replace(/\[\[[^\]]+\]\]/g, '_____')}</div>
      </div>
      {CHOICE_TYPES.includes(q.type) ? (
        <div className={`grid flex-1 gap-3 ${q.options.length <= 2 ? 'grid-cols-2' : q.options.length === 3 ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
          {q.options.map((o, i) => {
            const ok = (q.answer || []).includes(o.id);
            const n = counts[o.id] || 0;
            return (
              <div key={o.id} className={`${q.type === 'tf' ? (o.id === 'true' ? 'opt-1' : 'opt-4') : `opt-${i % 5}`} relative flex min-h-[160px] flex-col items-center justify-center rounded-2xl p-4 text-center font-game text-2xl font-bold text-white transition ${reveal && q.type !== 'poll' && !ok ? 'opacity-30' : ''} ${reveal && ok ? 'ring-8 ring-emerald-400' : ''}`}>
                {o.image && <img src={o.image} alt="" className="mb-2 max-h-24 rounded" />}
                {o.text}
                {reveal && (
                  <div className="absolute inset-x-3 bottom-3">
                    <div className="h-2 overflow-hidden rounded-full bg-black/30"><div className="h-full bg-white" style={{ width: `${(n / maxCount) * 100}%` }} /></div>
                    <div className="mt-1 text-sm">{n} {reveal && ok && q.type !== 'poll' && <Check className="inline h-4 w-4" />}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1">
          {!reveal ? (
            <div className="grid h-full place-items-center rounded-2xl bg-black/20 p-10 text-center font-game text-xl text-white/80">
              {(() => { const T = QTYPES[q.type]; return <span className="flex flex-col items-center gap-3"><T.icon className="h-12 w-12" />{T.label} — students are answering on their devices</span>; })()}
            </div>
          ) : ['wordcloud'].includes(q.type) ? (
            <div className="rounded-2xl bg-black/20 p-4"><WordCloud words={(cur.responses || []).map((r) => r.answer)} /></div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-white p-5"><div className="mb-2 text-xs font-bold uppercase text-emerald-600">Correct answer</div><QuestionBody q={q} /></div>
              {cur.responses && (
                <div className="max-h-[50vh] space-y-2 overflow-auto rounded-2xl bg-black/20 p-4 scrollbar-thin">
                  {cur.responses.map((r, i) => (
                    <div key={i} className="rounded-xl bg-white/90 px-3 py-2 text-sm text-slate-800">
                      <b>{r.participant}:</b>{' '}
                      {typeof r.answer === 'string' ? r.answer : r.answer?.url ? (r.answer.mime?.startsWith('audio') ? <audio src={r.answer.url} controls className="mt-1 h-8" /> : r.answer.mime?.startsWith('video') ? <video src={r.answer.url} controls className="mt-1 max-h-40" /> : <img src={r.answer.url} alt="" className="mt-1 max-h-40 rounded" />) : JSON.stringify(r.answer)}
                      <span className={`ml-2 rounded px-1.5 text-xs font-bold text-white ${STATUS_COLOR[r.status]}`}>{r.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {reveal && q.explanation && <div className="rounded-xl bg-amber-100 px-4 py-2 text-amber-900">💡 {q.explanation}</div>}
    </div>
  );
}

export default function HostSession() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [muted, setMuted] = useState(false);
  const [reactions, setReactions] = useState([]);
  const [podium, setPodium] = useState(true);
  const [offset, setOffset] = useState(0);
  const prevCount = useMemo(() => ({ n: 0 }), []);

  useEffect(() => {
    api(`/sessions/${id}`).then(setData).catch((e) => toast(e.message, 'error'));
  }, [id, toast]);

  useSocket('host:watch', { sessionId: Number(id), token: getToken() }, {
    'session:host': (d) => { if (d) setData(d); },
    reaction: (r) => {
      const key = Math.random();
      setReactions((x) => [...x.slice(-12), { ...r, key, left: 10 + Math.random() * 80 }]);
      setTimeout(() => setReactions((x) => x.filter((y) => y.key !== key)), 3000);
    },
  });

  useEffect(() => {
    if (!data) return;
    if (data.players.length > prevCount.n && !muted) sfx.join();
    prevCount.n = data.players.length;
  }, [data, muted, prevCount]);
  useEffect(() => { sfx.enabled = !muted; }, [muted]);
  useEffect(() => { setOffset(0); }, []);

  const act = async (path) => {
    try { setData(await api(`/sessions/${id}/${path}`, { method: 'POST', body: {} })); } catch (e) { toast(e.message, 'error'); }
  };

  const s = data?.session;
  const cur = data?.current;
  const remaining = useCountdown(s?.question_started, cur?.question?.time_limit || 0, offset);

  if (!data) return <div className="grid h-full place-items-center game-bg"><Spinner className="h-10 w-10 text-white" /></div>;
  if (s.settings?.anonymize) {
    // projected screen shows fun names; real names stay in the report
    const A = ['Happy', 'Brave', 'Clever', 'Swift', 'Sunny', 'Cosmic', 'Lucky', 'Mighty', 'Jolly', 'Witty', 'Bold', 'Calm'];
    const N = ['Panda', 'Fox', 'Otter', 'Comet', 'Tiger', 'Koala', 'Falcon', 'Dolphin', 'Rocket', 'Wizard', 'Owl', 'Lynx'];
    data.players = data.players.map((p) => ({ ...p, name: `${A[p.id % A.length]} ${N[Math.floor(p.id / A.length) % N.length]}` }));
  }

  const joinUrl = `${window.location.host}/join`;
  const copy = (t) => { navigator.clipboard.writeText(t); toast('Copied', 'success'); };
  const total = data.questions.length;
  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());

  const topBar = (
    <header className="flex items-center gap-2 px-5 py-3">
      <Logo dark small />
      {s.status !== 'lobby' && (
        <button onClick={() => copy(s.code)} className="ml-4 rounded-lg bg-black/30 px-3 py-1.5 font-game font-bold tracking-widest text-white">{s.code.replace(/(\d{3})(\d{3})/, '$1 $2')}</button>
      )}
      <div className="ml-auto flex items-center gap-2">
        <button onClick={() => setMuted(!muted)} className="rounded-lg bg-black/30 p-2 text-white">{muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</button>
        <button onClick={fullscreen} className="rounded-lg bg-black/30 p-2 text-white"><Maximize className="h-5 w-5" /></button>
        {s.status === 'ended'
          ? <button onClick={() => nav(`/admin/reports/${s.id}`)} className="rounded-lg bg-brand-500 px-5 py-2 font-bold text-white">Exit</button>
          : <button onClick={() => { if (confirm('End this session for everyone?')) act('end'); }} className="rounded-lg bg-red-500 px-5 py-2 font-bold text-white">End</button>}
      </div>
    </header>
  );

  const floating = reactions.map((r) => <span key={r.key} className="pointer-events-none fixed bottom-10 z-50 animate-[rise_3s_ease-out_forwards] text-4xl" style={{ left: `${r.left}%` }}>{r.emoji}</span>);

  // ---------------- lobby
  if (s.status === 'lobby') {
    return (
      <div className="flex min-h-full flex-col game-bg">
        {topBar}
        <div className="mx-auto mt-2 flex w-full max-w-3xl gap-3 px-4">
          <div className="flex-1 rounded-2xl bg-black/50 p-5 text-white">
            <div className="flex items-center gap-4 border-b border-white/10 pb-4">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 font-bold">1</span>
              <span className="text-sm text-white/80">Join using<br />any device</span>
              <span className="flex-1 font-game text-3xl font-bold">{joinUrl}</span>
              <button onClick={() => copy(`${window.location.origin}/join/${s.code}`)} className="rounded-lg bg-white/15 p-2"><Copy className="h-5 w-5" /></button>
            </div>
            <div className="flex items-center gap-4 pt-4">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 font-bold">2</span>
              <span className="text-sm text-white/80">Enter the<br />join code</span>
              <span className="flex-1 font-game text-6xl font-bold tracking-[0.15em]">{s.code}</span>
              <button onClick={() => copy(s.code)} className="rounded-lg bg-white/15 p-2"><Copy className="h-5 w-5" /></button>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/50 p-4 text-white">
            <div className="rounded-lg bg-white p-2"><QRCodeSVG value={`${window.location.origin}/join/${s.code}`} size={110} /></div>
            <span className="text-sm">Scan to join</span>
          </div>
        </div>
        <div className="mx-auto mt-3 flex items-center gap-3 rounded-2xl bg-black/50 p-3">
          <button onClick={() => { sfx.start(); act('start'); }} disabled={!data.players.length} className="game-btn w-72 bg-brand-500 py-3 text-xl text-white disabled:opacity-50">START</button>
          <span className="flex items-center gap-2 rounded-xl bg-black/40 px-4 py-3 font-game text-xl font-bold text-white"><Users className="h-6 w-6" />{data.players.length}</span>
        </div>
        <div className="mx-auto mt-2 text-sm text-white/60">{s.pace === 'teacher' ? 'Teacher led' : s.game_type === 'test' ? 'Test mode' : 'Classic'} · {total} questions</div>
        <div className="mx-auto mt-8 flex max-w-5xl flex-wrap justify-center gap-4 px-6 pb-10">
          {data.players.length === 0 && <div className="mt-10 animate-pulse font-game text-xl text-white/70">Waiting for participants to join…</div>}
          {data.players.map((p) => (
            <button key={p.id} title="Click to remove" onClick={() => { if (confirm(`Remove ${p.name}?`)) api(`/sessions/${id}/kick`, { method: 'POST', body: { participantId: p.id } }).then(setData); }} className="group flex flex-col items-center gap-1 animate-pop">
              <span className="rounded bg-black/40 px-2 text-xs font-bold text-white group-hover:bg-red-500">{p.name}</span>
              <span className="animate-float"><Avatar avatar={p.avatar} name={p.name} size={56} /></span>
            </button>
          ))}
        </div>
        {floating}
      </div>
    );
  }

  // ---------------- ended
  if (s.status === 'ended') {
    if (podium && data.players.length && s.game_type !== 'test') {
      return (
        <div className="flex min-h-full flex-col game-bg">
          <header className="flex justify-end gap-2 p-4"><button onClick={() => setPodium(false)} className="rounded-lg bg-white/15 px-5 py-2 font-bold text-white">Next</button></header>
          <Podium players={data.players} title={s.title} />
        </div>
      );
    }
    return (
      <div className="min-h-full game-bg pb-10">
        {topBar}
        <div className="mx-auto max-w-5xl px-4">
          <div className="rounded-2xl bg-black/40 p-6 text-center text-white">
            <div className="mb-3 text-xs text-white/70">Class Accuracy</div>
            <div className="mx-auto max-w-md"><AccuracyBar value={data.accuracy} /></div>
            <div className="mt-4 text-xl font-bold">{(data.accuracy ?? 0) >= 80 ? 'Outstanding work, class! 🎉' : (data.accuracy ?? 0) >= 50 ? 'Good effort! Review the tricky questions together.' : 'Just getting warmed up? Practice makes perfect!'}</div>
            <div className="mt-4 flex justify-center gap-2">
              <button onClick={() => nav(`/admin/quiz/${s.quiz_id}/start?pace=${s.pace}`)} className="rounded-lg bg-white/15 px-5 py-2.5 font-semibold">Replay</button>
              <button onClick={() => nav(`/admin/quiz/${s.quiz_id}/start?kind=homework`)} className="rounded-lg bg-white px-5 py-2.5 font-semibold text-slate-800">Assign Practice</button>
              <button onClick={() => nav(`/admin/reports/${s.id}?tab=questions`)} className="rounded-lg bg-white/15 px-5 py-2.5 font-semibold">Review Questions</button>
            </div>
          </div>
          <div className="mt-6"><OverviewTable data={data} onPlayer={() => nav(`/admin/reports/${s.id}`)} /></div>
        </div>
      </div>
    );
  }

  // ---------------- running, teacher led
  if (s.pace === 'teacher' && cur) {
    const last = cur.index >= total - 1;
    return (
      <div className="flex min-h-full flex-col game-bg">
        {topBar}
        {s.phase === 'leaderboard' ? (
          <div className="mx-auto w-full max-w-2xl flex-1 px-4">
            <div className="mb-4 flex items-center justify-center gap-2 font-game text-3xl font-bold text-white"><Trophy className="h-8 w-8 text-yellow-300" />Leaderboard</div>
            <div className="space-y-2">
              {data.players.slice(0, 10).map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 text-white animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
                  <span className="w-8 font-game text-xl font-bold">{i + 1}</span><Avatar avatar={p.avatar} name={p.name} size={36} />
                  <span className="flex-1 font-game text-lg font-bold">{p.name}</span><span className="font-game text-xl font-bold text-yellow-300">{p.score}</span>
                </div>
              ))}
            </div>
          </div>
        ) : <HostQuestion cur={cur} phase={s.phase} total={total} remaining={remaining} />}
        <div className="sticky bottom-0 flex justify-end gap-2 bg-black/30 px-6 py-3 backdrop-blur">
          {s.phase === 'question' && <button onClick={() => act('reveal')} className="flex items-center gap-2 rounded-lg bg-white/15 px-5 py-2.5 font-bold text-white"><Eye className="h-4 w-4" />Reveal answer</button>}
          {s.phase === 'reveal' && <button onClick={() => act('leaderboard')} className="flex items-center gap-2 rounded-lg bg-white/15 px-5 py-2.5 font-bold text-white"><BarChart3 className="h-4 w-4" />Leaderboard</button>}
          {s.phase !== 'question' && <button onClick={() => act(last ? 'end' : 'next')} className="flex items-center gap-2 rounded-lg bg-brand-500 px-6 py-2.5 font-bold text-white">{last ? 'Finish' : 'Next question'}<ChevronRight className="h-4 w-4" /></button>}
        </div>
        {floating}
      </div>
    );
  }

  // ---------------- running, student paced dashboard
  const finished = data.players.filter((p) => p.finished_at).length;
  return (
    <div className="min-h-full game-bg pb-10">
      {topBar}
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="rounded-2xl bg-black/40 p-5 text-white">
            <div className="mb-3 text-xs text-white/70">Class Accuracy</div>
            <AccuracyBar value={data.accuracy} />
          </div>
          <div className="flex gap-3">
            {[[Users, data.players.length, 'Participants'], [Check, finished, 'Finished'], [Clock, total, 'Questions']].map(([I, n, l]) => (
              <div key={l} className="flex w-32 flex-col items-center justify-center rounded-2xl bg-black/40 text-white"><I className="h-5 w-5 text-white/70" /><span className="font-game text-3xl font-bold">{n}</span><span className="text-xs text-white/60">{l}</span></div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-black/30 px-5 py-3 text-white">
          <span>Students can still join at <b>{joinUrl}</b> with code <b className="font-game tracking-widest">{s.code}</b></span>
          <button onClick={() => nav(`/admin/reports/${s.id}`)} className="flex items-center gap-1 text-sm font-semibold text-white/80 hover:text-white"><ChartPie className="h-4 w-4" />Detailed report</button>
        </div>
        <div className="mt-4"><OverviewTable data={data} onChange={setData} /></div>
      </div>
      {floating}
    </div>
  );
}
