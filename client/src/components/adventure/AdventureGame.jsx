import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Map as MapIcon, Gift, Medal, Settings, Volume2, ChevronRight, Check } from 'lucide-react';
import { api } from '../../lib/api.js';
import { sfx } from '../../lib/sound.js';
import { lang } from '../../i18n/index.js';
import { useToast } from '../ui.jsx';
import LanguageSwitcher from '../LanguageSwitcher.jsx';
import {
  AGES, BADGES, CHEST_REWARDS, CHEST_STREAK, COIN_PER_CORRECT, DEFAULT_ADVENTURE, DIFFICULTY, HATS, HEROES, PET, XP_PER_CORRECT,
  buildStages, heroById, levelFor, runnable, worldById,
} from './data.js';
import MapView from './MapView.jsx';
import BossBattle from './BossBattle.jsx';
import Finish from './Finish.jsx';
import Runner from './Runner.jsx';
import { HeroSprite, Hud, speak } from './fx.jsx';
import { AlmostCard, CHOICE, CorrectOverlay, PlayChooser, QuizCard, StepBackCard, optionText } from './QuizCard.jsx';
import { BadgesPanel, ChestOverlay, FlagOverlay, RewardsPanel, SettingsPanel } from './Panels.jsx';

const UNGRADED = ['open', 'poll', 'draw', 'wordcloud', 'audio', 'video', 'discussion'];
const HINTABLE = ['mcq', 'msq', 'tf', 'fill', 'math'];

const fresh = (hearts, hero = null) => ({
  v: 1, hero, started: false, at: 0, cleared: {}, hearts, coins: 0, stars: 0, xp: 0, streak: 0, maxStreak: 0, hints: 0,
  inv: { key: false, keyUsed: false, pet: false, hats: [], hat: null }, chests: 0, runs: 0, monsters: 0, badges: [],
  wrongs: {}, stageWrongs: {}, elapsed: 0, done: false,
});
const load = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } };

/** Text of the right answer for the "step back" card, when we can show it simply. */
function answerText(q, reveal, t) {
  if (!reveal) return null;
  if (CHOICE.includes(q.type) && reveal.correct) return q.options.filter((o) => reveal.correct.includes(o.id)).map((o) => optionText(q, o, t)).join(', ');
  if (reveal.accepted?.length) return reveal.accepted.join(' / ');
  return null;
}

/**
 * The adventure game for one player. data = GET /play/:token (session, participant, questions in play order, answered).
 */
export default function AdventureGame({ token, data, onAgain }) {
  const { t } = useTranslation('adventure');
  const nav = useNavigate();
  const toast = useToast();
  const session = data.session;
  const cfg = { ...DEFAULT_ADVENTURE, ...(session.adventure || {}) };
  const world = worldById(cfg.world);
  const age = AGES[cfg.age] || AGES['6-7'];
  const diff = DIFFICULTY[cfg.difficulty] || DIFFICULTY.easy;
  const questions = data.questions;
  const qById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const stages = useMemo(() => buildStages(questions, { runs: cfg.runs }), [questions, cfg.runs]);
  const name = data.participant.name;
  const storeKey = `wg_adv_${token}`;

  const [st, setSt] = useState(() => ({ ...fresh(diff.hearts), ...(load(storeKey) || {}) }));
  const [screen, setScreen] = useState(() => (st.done ? 'finish' : st.started ? 'welcome' : 'hero'));
  const [ov, setOv] = useState(null);          // overlay on top of the map
  const [play, setPlay] = useState(null);      // the stage being played
  const [busy, setBusy] = useState(false);
  const [walkingFrom, setWalkingFrom] = useState(null);
  const [prefs, setPrefs] = useState(() => ({ sound: localStorage.getItem('wg_sound') !== '0', autoRead: localStorage.getItem('wg_adv_read') === '1' }));
  const recorded = useRef(new Map((data.answered || []).map((a) => [a.question_id, a.status])));
  const revealed = useRef(new Map());
  const elapsed = useRef(st.elapsed || 0);
  const qStart = useRef(Date.now());
  const stRef = useRef(st);
  stRef.current = st;

  const hero = heroById(st.hero || 'fox');
  const hat = HATS.find((h) => h.id === st.inv.hat)?.emoji || null;
  const pet = st.inv.pet ? PET[world.id] : null;
  const worldName = t(`worlds.${world.id}.name`);
  const stage = stages[Math.min(st.at, stages.length - 1)];

  // persistence + play time
  useEffect(() => { save(storeKey, { ...st, elapsed: elapsed.current }); }, [st, storeKey]);
  useEffect(() => {
    if (screen !== 'map' || st.done) return undefined;
    const id = setInterval(() => { elapsed.current += 1000; }, 1000);
    const flush = () => save(storeKey, { ...stRef.current, elapsed: elapsed.current });
    window.addEventListener('beforeunload', flush);
    return () => { clearInterval(id); window.removeEventListener('beforeunload', flush); flush(); };
  }, [screen, st.done, storeKey]);
  useEffect(() => { sfx.enabled = prefs.sound; }, [prefs.sound]);

  const award = useCallback((id) => {
    if (stRef.current.badges.includes(id)) return;
    // remember it right away so several awards in one tick do not toast twice
    stRef.current = { ...stRef.current, badges: [...stRef.current.badges, id] };
    setSt((s) => (s.badges.includes(id) ? s : { ...s, badges: [...s.badges, id] }));
    toast(t('toast.badge', { name: t(`badges.${id}.name`) }), 'success');
  }, [t, toast]);

  // current question of the stage being played
  const q = play ? qById.get(stages[play.stage]?.qids[play.qi]) : null;
  const readAloud = useCallback((qq = q) => {
    if (!qq) return;
    const opts = CHOICE.includes(qq.type) ? qq.options.map((o, i) => `${'ABCDEF'[i]}. ${optionText(qq, o, t)}`).join('. ') : '';
    speak(`${qq.text}. ${opts}`, lang());
  }, [q, t]);
  useEffect(() => {
    if (q && (cfg.age === '4-5' || prefs.autoRead) && play?.mode !== 'run') readAloud(q);
    if (q) qStart.current = Date.now();
  }, [q?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------ flow
  const startStage = () => {
    if (!stage) return;
    const i = stages.indexOf(stage);
    const base = { stage: i, qi: 0, hidden: [], startsWith: null, hintUsed: false, tryKey: 0, effect: null, effectKey: 0, combo: 0 };
    if (stage.kind === 'game') { setPlay({ ...base, mode: 'choose' }); return; }
    if (stage.kind === 'mini' || stage.kind === 'boss') { setPlay({ ...base, mode: 'boss', hp: stage.qids.length }); return; }
    setPlay({ ...base, mode: 'card' });
  };

  const finishGame = useCallback(() => {
    setSt((s) => ({ ...s, done: true }));
    api(`/play/${token}/finish`, { method: 'POST', body: {} }).catch(() => {});
    setPlay(null); setOv(null);
    setScreen('finish');
  }, [token]);

  /** Marks the stage done and walks the hero on (or finishes). */
  const clearStage = useCallback((idx) => {
    const s0 = stRef.current;
    const wrong = s0.stageWrongs[idx] || 0;
    const stars = Math.max(1, 3 - wrong);
    const firstTime = s0.cleared[idx] === undefined;
    const kind = stages[idx].kind;
    if (kind === 'mini') award('bridgeGuard');
    if (kind === 'boss') award('castleHero');
    setPlay(null); setOv(null);
    if (idx >= stages.length - 1) {
      setSt((s) => ({ ...s, cleared: { ...s.cleared, [idx]: stars }, stars: s.stars + (firstTime && !wrong ? 1 : 0) }));
      if (questions.every((qq) => recorded.current.get(qq.id) === 'correct' || UNGRADED.includes(qq.type))) award('perfect');
      finishGame();
      return;
    }
    setWalkingFrom(idx);
    setSt((s) => ({ ...s, cleared: { ...s.cleared, [idx]: stars }, stars: s.stars + (firstTime && !wrong ? 1 : 0), at: idx + 1, coins: s.coins + 4 }));
    setTimeout(() => {
      setWalkingFrom(null);
      if (stages[idx].flag) {
        setSt((s) => ({ ...s, hearts: diff.hearts, hints: s.hints + (s.inv.pet ? 1 : 0) }));
        setOv({ type: 'flag', petHint: !!stRef.current.inv.pet, bossNext: stages[stages.length - 1]?.kind === 'boss' });
      }
    }, 1150);
  }, [stages, questions, award, finishGame, diff.hearts]);

  /** Go back one checkpoint after two wrong answers. */
  const stepBack = useCallback(() => {
    setOv(null); setPlay(null);
    setSt((s) => {
      const at = Math.max(0, s.at - 1);
      const cleared = { ...s.cleared };
      if (s.at > 0) delete cleared[at];
      return { ...s, at, cleared, hearts: diff.hearts, streak: 0, lastChestAt: 0, wrongs: {} };
    });
  }, [diff.hearts]);

  /** A chest every CHEST_STREAK right answers in a row (counted since the last chest), else move on. */
  const afterCorrect = useCallback((idx) => {
    const s0 = stRef.current;
    if (s0.streak - (s0.lastChestAt || 0) >= CHEST_STREAK) {
      const rewards = CHEST_REWARDS[s0.chests] || [{ kind: 'coins', n: 30 }];
      setPlay(null); // close the battle so the chest opens over the map
      setOv({ type: 'chest', rewards, idx });
      return;
    }
    clearStage(idx);
  }, [clearStage]);

  const collectChest = (rewards, idx) => {
    setSt((s) => {
      const inv = { ...s.inv };
      let { coins } = s;
      rewards.forEach((r) => {
        if (r.kind === 'coins') coins += r.n;
        if (r.kind === 'key') inv.key = true;
        if (r.kind === 'pet') inv.pet = true;
        if (r.kind === 'hat' && !inv.hats.includes(r.id)) inv.hats = [...inv.hats, r.id];
      });
      return { ...s, coins, inv, chests: s.chests + 1, lastChestAt: s.streak };
    });
    award('treasureHunter');
    if (rewards.some((r) => r.kind === 'pet')) award('bestFriends');
    sfx.start();
    clearStage(idx);
  };

  // ------------------------------------------------------------ answering
  const submit = useCallback(async (answer) => {
    if (!q || busy) return;
    setBusy(true);
    let r;
    try {
      if (!recorded.current.has(q.id)) {
        try {
          r = await api(`/play/${token}/answer`, { method: 'POST', body: { questionId: q.id, answer, timeMs: Date.now() - qStart.current } });
          recorded.current.set(q.id, r.status);
          revealed.current.set(q.id, { reveal: r.reveal, explanation: r.explanation });
        } catch (e) {
          if (e.status !== 409) throw e;
          recorded.current.set(q.id, 'answered');
        }
      }
      if (!r) {
        r = await api(`/play/${token}/check`, { method: 'POST', body: { questionId: q.id, answer, reveal: true } });
        if (r.reveal) revealed.current.set(q.id, { reveal: r.reveal, explanation: r.explanation });
      }
    } catch (e) {
      toast(e.message, 'error');
      setBusy(false);
      return;
    }
    setBusy(false);
    const ungraded = r.status === 'ungraded' || UNGRADED.includes(q.type);
    const ok = ungraded || r.status === 'correct';
    const idx = play.stage;
    if (ok) {
      sfx.correct();
      const s0 = stRef.current;
      const streak = ungraded ? s0.streak : s0.streak + 1;
      const coins = s0.coins + COIN_PER_CORRECT;
      const xp = s0.xp + XP_PER_CORRECT;
      if (levelFor(xp).id !== levelFor(s0.xp).id) toast(t('toast.levelUp', { level: t(`levels.${levelFor(xp).id}`) }), 'success');
      setSt((s) => ({ ...s, coins, xp, streak, maxStreak: Math.max(s.maxStreak, streak), wrongs: { ...s.wrongs, [q.id]: 0 } }));
      award('firstStep');
      if (streak >= CHEST_STREAK) award('onFire');
      if (coins >= 100) award('coinCollector');
      if (play.mode === 'boss') {
        const hp = play.hp - 1;
        setPlay((p) => ({ ...p, hp, combo: p.combo + 1, effect: hp ? 'hit' : 'win', effectKey: p.effectKey + 1 }));
        if (hp) setTimeout(() => setPlay((p) => p && ({ ...p, qi: p.qi + 1, hidden: [], startsWith: null, hintUsed: false, effect: null, tryKey: p.tryKey + 1 })), 1100);
        return;
      }
      if (play.mode === 'run') { setSt((s) => ({ ...s, runs: s.runs + 1 })); award('speedyRunner'); }
      const picked = CHOICE.includes(q.type) ? q.options.filter((o) => [].concat(answer).includes(o.id)).map((o) => optionText(q, o, t)).join(', ') : null;
      setOv({ type: 'correct', idx, ungraded, recap: picked ? `${q.text.slice(0, 60)} → ${picked}` : null, star: !(stRef.current.stageWrongs[idx] || 0) });
      return;
    }
    // wrong
    sfx.wrong();
    const s0 = stRef.current;
    const tries = (s0.wrongs[q.id] || 0) + 1;
    const hearts = Math.max(0, s0.hearts - 1);
    setSt((s) => ({ ...s, hearts, streak: 0, lastChestAt: 0, wrongs: { ...s.wrongs, [q.id]: tries }, stageWrongs: { ...s.stageWrongs, [idx]: (s.stageWrongs[idx] || 0) + 1 } }));
    const pickedIds = CHOICE.includes(q.type) ? [].concat(answer) : [];
    if (tries >= 2 || hearts <= 0) {
      const rv = revealed.current.get(q.id);
      setOv({ type: 'stepback', answer: answerText(q, rv?.reveal, t), explanation: rv?.explanation });
      if (play.mode === 'boss') setPlay((p) => ({ ...p, effect: 'miss', effectKey: p.effectKey + 1, combo: 0 }));
      return;
    }
    if (play.mode === 'boss') {
      setPlay((p) => ({ ...p, hidden: [...p.hidden, ...pickedIds], effect: 'miss', effectKey: p.effectKey + 1, combo: 0, tryKey: p.tryKey + 1 }));
      setTimeout(() => setPlay((p) => p && ({ ...p, effect: null })), 1100);
      return;
    }
    setPlay((p) => ({ ...p, hidden: [...p.hidden, ...pickedIds], tryKey: p.tryKey + 1 }));
    const pickedText = q.options?.filter((o) => pickedIds.includes(o.id)).map((o) => optionText(q, o, t)).join(', ');
    setOv({ type: 'almost', picked: pickedText, lastHeart: hearts === 1 });
  }, [q, busy, token, play, toast, t, award]);

  // hints: free on easy, after a wrong answer on medium, otherwise a token
  const hintState = (() => {
    if (!q || !HINTABLE.includes(q.type) || play?.hintUsed) return { show: !!q && HINTABLE.includes(q.type), enabled: false, tokens: st.hints };
    const free = diff.freeHints || (st.wrongs[q.id] || 0) > 0;
    return { show: true, enabled: free || st.hints > 0, tokens: free ? 0 : st.hints, free };
  })();
  const askHint = async () => {
    if (!hintState.enabled) return;
    try {
      const r = await api(`/play/${token}/hint`, { method: 'POST', body: { questionId: q.id, hidden: play.hidden } });
      if (!hintState.free) setSt((s) => ({ ...s, hints: Math.max(0, s.hints - 1) }));
      setPlay((p) => ({ ...p, hintUsed: true, hidden: r.remove ? [...p.hidden, r.remove] : p.hidden, startsWith: r.startsWith || null }));
    } catch (e) { toast(e.message, 'error'); }
  };

  // shop / rewards
  const buy = (it) => {
    setSt((s) => {
      if (s.coins < it.price) return s;
      const n = { ...s, coins: s.coins - it.price };
      if (it.id === 'heart') n.hearts = Math.min(diff.hearts, s.hearts + 1);
      else if (it.id === 'hint') n.hints = s.hints + 1;
      else n.inv = { ...s.inv, hats: [...s.inv.hats, it.id], hat: it.id };
      return n;
    });
    toast(t('toast.bought', { name: t(`shop.${it.id}.name`) }), 'success');
  };
  const openRoom = () => {
    setSt((s) => ({ ...s, coins: s.coins + 80, inv: { ...s.inv, keyUsed: true, hats: s.inv.hats.includes('crown') ? s.inv.hats : [...s.inv.hats, 'crown'] } }));
    toast(t('rewards.roomOpened'), 'success');
  };
  const again = async () => {
    try { const r = await api(`/play/${token}/again`, { method: 'POST', body: {} }); onAgain(r.token); } catch (e) { toast(e.message, 'error'); }
  };

  // ------------------------------------------------------------ screens
  if (!stages.length) return <div className="grid h-full place-items-center bg-sky-100 font-adv text-xl">…</div>;

  if (screen === 'finish') {
    return <Finish token={token} session={session} world={world} worldName={worldName} hero={hero.emoji} hat={hat} name={name} st={st} stats={{ total: questions.filter((qq) => !UNGRADED.includes(qq.type)).length || questions.length, firstTry: [...recorded.current.values()].filter((s) => s === 'correct').length, elapsed: elapsed.current }} onAgain={again} />;
  }

  if (screen === 'hero') {
    return (
      <div className="fixed inset-0 overflow-auto bg-gradient-to-b from-sky-100 to-white">
        <div className="absolute right-4 top-4"><LanguageSwitcher /></div>
        <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-10">
          <span className="font-adv text-sm font-bold text-violet-600">{session.title}</span>
          <h1 className="mt-2 text-center font-adv text-4xl font-bold text-slate-900 sm:text-5xl">{t('hero.title')}</h1>
          <div className="mt-3 rounded-2xl bg-white px-8 py-3 font-adv text-3xl font-bold text-slate-800 shadow ring-2 ring-violet-100">{name}</div>
          <div className="mt-6 grid w-full gap-4 sm:grid-cols-[1fr_1.4fr]">
            <div className="flex flex-col items-center justify-center rounded-3xl bg-gradient-to-b from-amber-100 to-white p-6 text-center shadow-lg">
              <HeroSprite emoji={hero.emoji} hat={hat} size={120} pose="cheer" />
              <div className="mt-4 font-adv text-2xl font-bold text-slate-900">{t('hero.yourHero')}</div>
              <div className="text-slate-600">{t('hero.ready', { name, hero: t(`heroes.${hero.id}`) })}</div>
            </div>
            <div className="rounded-3xl bg-white p-4 shadow-lg">
              <div className="mb-3 font-adv text-xl font-bold text-slate-900">{t('hero.pick')}</div>
              <div className="grid grid-cols-3 gap-3">
                {HEROES.map((h) => (
                  <button key={h.id} type="button" onClick={() => setSt((s) => ({ ...s, hero: h.id }))} className={`relative flex flex-col items-center rounded-2xl p-3 transition ${st.hero === h.id || (!st.hero && h.id === 'fox') ? 'bg-violet-100 ring-4 ring-violet-500' : 'bg-violet-50/60 hover:bg-violet-100'}`}>
                    {(st.hero === h.id || (!st.hero && h.id === 'fox')) && <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-violet-600 text-white"><Check className="h-4 w-4" /></span>}
                    <span className="text-5xl">{h.emoji}</span>
                    <span className="mt-1 font-adv font-bold text-slate-800">{t(`heroes.${h.id}`)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-500">{t(`ages.${cfg.age}.rules`, { returnObjects: true })?.[cfg.age === '4-5' ? 2 : 1]}</p>
          <button type="button" onClick={() => { setSt((s) => ({ ...s, hero: s.hero || 'fox' })); setScreen('building'); sfx.start(); }} className="adv-btn-green mt-5 flex items-center gap-2 px-10 py-4 text-2xl">▶ {t('hero.go', { name })}</button>
        </div>
      </div>
    );
  }

  if (screen === 'building') return <Building t={t} name={name} title={session.title} count={questions.length} boss={t(`worlds.${world.id}.boss`)} hero={hero.emoji} code={session.code} onGo={() => { setSt((s) => ({ ...s, started: true })); setScreen('map'); }} />;

  if (screen === 'welcome') {
    return (
      <div className="fixed inset-0 grid place-items-center bg-gradient-to-b from-sky-100 to-white p-4">
        <div className="absolute right-4 top-4"><LanguageSwitcher /></div>
        <div className="flex max-w-lg flex-col items-center text-center">
          <span className="font-adv text-sm font-bold text-violet-600">{session.title}</span>
          <HeroSprite emoji={hero.emoji} hat={hat} size={110} pose="cheer" className="mt-4" />
          <h1 className="mt-4 font-adv text-4xl font-bold text-slate-900">{t('welcome.title', { name })}</h1>
          <p className="mt-2 text-lg text-slate-600">{t('welcome.desc', { n: Math.min(st.at + 1, stages.length), total: stages.length })}</p>
          <button type="button" onClick={() => setScreen('map')} className="adv-btn-green mt-6 w-full max-w-xs py-4 text-xl">▶ {t('welcome.continue')}</button>
          <button type="button" onClick={() => { setSt(fresh(diff.hearts, st.hero)); setScreen('hero'); }} className="adv-btn-white mt-3 w-full max-w-xs py-3">{t('welcome.startOver')}</button>
          <p className="mt-2 text-xs text-slate-400">{t('welcome.startOverNote')}</p>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------ map + overlays
  const bossName = (k) => t(`worlds.${world.id}.${k === 'boss' ? 'boss' : 'mini'}`);
  const mission = (() => {
    if (!stage) return t('map.missionDone');
    const n = st.at + 1;
    if (stage.kind === 'boss') return t('map.missionBoss', { boss: bossName('boss') });
    if (stage.kind === 'mini') return t('map.missionMini', { boss: bossName('mini'), count: stage.qids.length });
    if (stage.kind === 'game') return t('map.missionGame', { n });
    if (st.streak === CHEST_STREAK - 1) return t('map.missionChest');
    return t('map.missionQ', { n });
  })();
  const label = play ? t('quiz.checkpoint', { n: play.stage + 1, total: stages.length }) : '';
  const progress = (
    <div className="rounded-2xl bg-white/90 px-4 py-2 text-center shadow-md">
      <div className="font-adv text-sm font-bold text-slate-700">{worldName} <span className="text-slate-400">{Object.keys(st.cleared).length} / {stages.length}</span></div>
      <div className="mt-1 flex gap-1">{stages.map((s, i) => <span key={i} className={`h-2 w-5 rounded-full ${st.cleared[i] !== undefined ? 'bg-emerald-600' : i === st.at ? 'bg-amber-400' : 'bg-slate-200'}`} />)}<span className="ml-1 text-xs">👑</span></div>
    </div>
  );

  return (
    <div className="fixed inset-0 overflow-hidden bg-sky-200 font-sans">
      <MapView world={world} stages={stages} current={st.at} cleared={st.cleared} hero={hero.emoji} hat={hat} pet={pet} name={name} walkingFrom={walkingFrom} onPlay={startStage} bossEmoji={world.boss} />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-amber-50/95 py-1.5 pl-1.5 pr-4 shadow-lg ring-2 ring-amber-200">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-b from-emerald-100 to-emerald-300 text-3xl">{hero.emoji}</span>
          <div className="leading-tight"><div className="max-w-[40vw] truncate font-adv text-lg font-bold text-slate-900">{session.title}</div><div className="text-xs font-semibold text-slate-600">⭐ {t('map.adventureOf', { name })}</div></div>
        </div>
        <div className="pointer-events-auto"><Hud hearts={st.hearts} maxHearts={diff.hearts} coins={st.coins} stars={st.stars} xp={st.xp} /></div>
      </div>

      {/* mission + dock */}
      {!play && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex flex-wrap items-end justify-between gap-2 p-3">
          <div className="flex max-w-md items-center gap-3 rounded-2xl bg-white/95 p-3 shadow-xl">
            <div className="flex-1"><div className="font-adv font-bold text-indigo-800">{t('map.mission')}</div><div className="text-sm text-slate-700">{mission}</div></div>
            <button type="button" onClick={() => speak(mission, lang())} className="adv-btn-white grid h-11 w-11 place-items-center"><Volume2 className="h-5 w-5" /></button>
            {stage && <button type="button" onClick={startStage} disabled={walkingFrom !== null} className="adv-btn-green flex items-center gap-1 px-5 py-3 text-lg disabled:opacity-60">{t('map.play')}<ChevronRight className="h-5 w-5" /></button>}
          </div>
          <div className="flex gap-1 rounded-2xl bg-white/95 p-1.5 shadow-xl">
            {[['map', MapIcon, null], ['rewards', Gift, 'rewards'], ['badges', Medal, 'badges'], ['settings', Settings, 'settings']].map(([k, I, o]) => (
              <button key={k} type="button" onClick={() => setOv(o ? { type: o } : null)} className={`flex w-16 flex-col items-center rounded-xl py-1.5 text-[11px] font-bold sm:w-20 ${(!ov && k === 'map') || ov?.type === o ? 'bg-sky-100 text-sky-800' : 'text-slate-600 hover:bg-slate-50'}`}>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-b from-amber-100 to-amber-200"><I className="h-4 w-4" /></span>{t(`map.dock.${k}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* stage play */}
      {play?.mode === 'choose' && q && (
        <PlayChooser label={label} hero={hero.emoji} canRun={runnable(q)} onCard={() => setPlay((p) => ({ ...p, mode: 'card' }))} onRun={() => setPlay((p) => ({ ...p, mode: 'run' }))} />
      )}
      {play?.mode === 'card' && q && !ov && (
        <QuizCard q={q} label={label} hidden={play.hidden} busy={busy} onAnswer={submit} onHint={askHint} hintState={hintState} onRead={() => readAloud()} startsWith={play.startsWith} tryKey={play.tryKey} token={token} />
      )}
      {play?.mode === 'run' && q && (
        <div className="fixed inset-0 z-30 bg-sky-200">
          <Runner
            world={world} hero={hero.emoji} hat={hat} age={cfg.age} question={{ text: q.text, options: q.options.map((o) => ({ id: o.id, text: optionText(q, o, t) })) }}
            disabledOptionIds={play.hidden} seed={q.id * 31 + play.stage} locked={busy || !!ov}
            onCoin={() => setSt((s) => ({ ...s, coins: s.coins + 1 }))}
            onBop={() => { setSt((s) => ({ ...s, monsters: s.monsters + 1 })); if (stRef.current.monsters + 1 >= 3) award('monsterBopper'); }}
            onAnswer={(id) => submit([id])}
            onExit={() => setPlay((p) => ({ ...p, mode: 'card' }))}
          />
          <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex flex-col items-center gap-2">
            {progress}
            <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-white/95 px-4 py-2 shadow-lg">
              <span className="text-xs font-bold uppercase text-violet-600">{worldName}</span>
              <span className="max-w-[60vw] truncate font-adv text-xl font-bold text-slate-900">{q.text}</span>
              <button type="button" onClick={() => readAloud()} className="adv-btn-white grid h-9 w-9 place-items-center"><Volume2 className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="absolute right-3 top-3 z-10"><Hud hearts={st.hearts} maxHearts={diff.hearts} coins={st.coins} stars={st.stars} xp={st.xp} /></div>
        </div>
      )}
      {play?.mode === 'boss' && q && (
        <>
          <BossBattle
            world={world} kind={stages[play.stage].kind} bossEmoji={stages[play.stage].kind === 'boss' ? world.boss : world.mini} bossName={bossName(stages[play.stage].kind)}
            hero={hero.emoji} hat={hat} heroName={name} q={q} qNum={play.qi + 1} hp={play.hp} total={stages[play.stage].qids.length} combo={play.combo}
            effect={play.effect} effectKey={play.effectKey} hidden={play.hidden} busy={busy} onPick={submit} onHint={askHint} hintState={hintState}
            onRead={() => readAloud()} onWinContinue={() => afterCorrect(play.stage)} progress={progress} token={token} tryKey={play.tryKey}
          />
          <div className="fixed right-3 top-3 z-40"><Hud hearts={st.hearts} maxHearts={diff.hearts} coins={st.coins} stars={st.stars} xp={st.xp} /></div>
        </>
      )}

      {/* feedback */}
      {ov?.type === 'correct' && (
        <CorrectOverlay hero={hero.emoji} hat={hat} recap={ov.recap} coins={COIN_PER_CORRECT} star={ov.star} xp={XP_PER_CORRECT} streak={st.streak} ungraded={ov.ungraded} auto={age.autoAdvance} onNext={() => { const i = ov.idx; setOv(null); afterCorrect(i); }} />
      )}
      {ov?.type === 'almost' && <AlmostCard picked={ov.picked} lastHeart={ov.lastHeart} onRetry={() => setOv(null)} />}
      {ov?.type === 'stepback' && <StepBackCard answer={ov.answer} explanation={ov.explanation} onBack={stepBack} />}
      {ov?.type === 'chest' && <ChestOverlay rewards={ov.rewards} pet={PET[world.id]} onCollect={() => collectChest(ov.rewards, ov.idx)} />}
      {ov?.type === 'flag' && <FlagOverlay done={Object.keys(st.cleared).length} total={stages.length} petHint={ov.petHint} bossNext={ov.bossNext} onContinue={() => setOv(null)} />}
      {ov?.type === 'rewards' && <RewardsPanel st={{ ...st, heroEmoji: hero.emoji }} maxHearts={diff.hearts} pet={PET[world.id]} onBuy={buy} onWear={(id) => setSt((s) => ({ ...s, inv: { ...s.inv, hat: id } }))} onOpenRoom={openRoom} onClose={() => setOv(null)} />}
      {ov?.type === 'badges' && <BadgesPanel owned={st.badges.filter((b) => BADGES.includes(b))} onClose={() => setOv(null)} />}
      {ov?.type === 'settings' && (
        <SettingsPanel
          sound={prefs.sound} autoRead={prefs.autoRead}
          onSound={(v) => { setPrefs((p) => ({ ...p, sound: v })); localStorage.setItem('wg_sound', v ? '1' : '0'); }}
          onAutoRead={(v) => { setPrefs((p) => ({ ...p, autoRead: v })); localStorage.setItem('wg_adv_read', v ? '1' : '0'); }}
          onLeave={() => nav('/join')} onClose={() => setOv(null)}
        />
      )}
    </div>
  );
}

/** "Building your adventure…" loading screen with a bridge being laid. */
function Building({ t, name, title, count, boss, hero, code, onGo }) {
  const [n, setN] = useState(0);
  const steps = t('building.steps', { returnObjects: true, boss });
  useEffect(() => {
    if (n >= 8) return undefined;
    const id = setTimeout(() => setN((x) => x + 1), 280);
    return () => clearTimeout(id);
  }, [n]);
  const done = n >= 8;
  return (
    <div className="fixed inset-0 overflow-auto bg-gradient-to-b from-sky-200 via-sky-100 to-amber-50">
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-12">
        <h1 className="text-center font-adv text-4xl font-bold text-slate-900">{t('building.title', { name })}</h1>
        <p className="mt-1 text-slate-600">{t('building.sub', { title, count })}</p>
        <div className="relative mt-6 h-36 w-full overflow-hidden rounded-3xl bg-gradient-to-b from-sky-200 to-sky-50 shadow-inner ring-8 ring-white">
          <div className="absolute bottom-6 left-6 right-6 flex gap-2">
            {Array.from({ length: 8 }, (_, i) => <span key={i} className={`h-5 flex-1 rounded-lg border-2 border-slate-800 bg-amber-100 transition-all duration-300 ${i < n ? 'translate-y-0 opacity-100' : '-translate-y-8 opacity-0'}`} />)}
          </div>
          <span className="absolute bottom-10 transition-all duration-300" style={{ left: `calc(${Math.min(n, 7) * 12 + 4}% )` }}><HeroSprite emoji={hero} size={52} pose={done ? 'cheer' : 'walk'} /></span>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-amber-400 transition-all duration-300" style={{ width: `${(n / 8) * 100}%` }} /></div>
        <div className="mt-5 grid w-full gap-3 sm:grid-cols-2">
          {steps.map((s, i) => (
            <div key={i} className={`flex items-center gap-3 rounded-2xl bg-white px-4 py-3 font-adv font-bold text-slate-800 shadow transition ${n >= (i + 1) * 2 ? 'opacity-100' : 'opacity-40'}`}>
              <span className={`grid h-7 w-7 place-items-center rounded-full text-white ${n >= (i + 1) * 2 ? 'bg-emerald-600' : 'bg-slate-300'}`}><Check className="h-4 w-4" /></span>{s}
            </div>
          ))}
        </div>
        <div className="mt-6 flex w-full flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-slate-600">#{code}</span>
          <button type="button" disabled={!done} onClick={onGo} className="adv-btn-green flex items-center gap-2 px-8 py-3 text-xl disabled:opacity-50">▶ {t('building.go')}</button>
        </div>
      </div>
    </div>
  );
}
