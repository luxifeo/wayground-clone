import { useCallback, useEffect, useState } from 'react';
import { Flag, Lightbulb, Send, Volume2, RotateCcw, ChevronRight, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  TextAnswer, ReorderAnswer, MatchAnswer, DropdownAnswer, DragDropAnswer, CategorizeAnswer, HotTextAnswer,
  MatchGridAnswer, TableFillAnswer, LabelingAnswer, HotspotAnswer, GraphingAnswer, DrawAnswer, RecordAnswer, CrosswordAnswer,
} from '../play/answers.jsx';
import { Spinner } from '../ui.jsx';
import { ZoomImage } from '../Passage.jsx';
import { CHEST_STREAK } from './data.js';
import { Chip, CoinIcon, Confetti, HeroSprite, Sunburst } from './fx.jsx';

// Choice questions get the big pastel cards; every other type reuses the player widgets on a dark panel.
const WIDGETS = {
  fill: TextAnswer, math: TextAnswer, open: TextAnswer, wordcloud: TextAnswer, discussion: TextAnswer,
  reorder: ReorderAnswer, match: MatchAnswer, dropdown: DropdownAnswer, dragdrop: DragDropAnswer, categorize: CategorizeAnswer,
  hottext: HotTextAnswer, matchgrid: MatchGridAnswer, tablefill: TableFillAnswer, labeling: LabelingAnswer, hotspot: HotspotAnswer,
  graphing: GraphingAnswer, draw: DrawAnswer, audio: RecordAnswer, video: RecordAnswer, crossword: CrosswordAnswer,
};
export const CHOICE = ['mcq', 'msq', 'tf', 'poll'];
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const CARD = [
  'bg-sky-100 hover:bg-sky-200 [&_b]:bg-sky-600', 'bg-emerald-100 hover:bg-emerald-200 [&_b]:bg-emerald-600',
  'bg-orange-100 hover:bg-orange-200 [&_b]:bg-orange-600', 'bg-violet-100 hover:bg-violet-200 [&_b]:bg-violet-600',
  'bg-pink-100 hover:bg-pink-200 [&_b]:bg-pink-600', 'bg-teal-100 hover:bg-teal-200 [&_b]:bg-teal-600',
];

export const optionText = (q, o, t) => (q.type === 'tf' && o.text === { true: 'True', false: 'False' }[o.id] ? t(`common:tf.${o.id}`) : o.text);

/** A–D answer cards. Hidden ids are greyed (hint / wrong pick). */
export function ChoiceGrid({ q, hidden = [], onPick, busy, compact = false }) {
  const { t } = useTranslation('adventure');
  const [sel, setSel] = useState([]);
  const multi = q.type === 'msq';
  useEffect(() => setSel([]), [q.id, hidden.length]);
  const click = (id) => {
    if (busy || hidden.includes(id)) return;
    if (multi) setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    else onPick([id]);
  };
  return (
    <div>
      <div className={`grid gap-3 ${compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {q.options.map((o, i) => {
          const off = hidden.includes(o.id);
          return (
            <button
              key={o.id} type="button" onClick={() => click(o.id)} disabled={off || busy}
              className={`${CARD[i % CARD.length]} flex min-h-[64px] items-center gap-3 rounded-2xl px-3 py-2.5 text-left font-adv text-xl font-bold text-slate-800 shadow-[0_4px_0_rgba(15,23,42,.12)] transition active:translate-y-0.5
                ${off ? 'pointer-events-none opacity-35 grayscale' : ''} ${multi && sel.includes(o.id) ? 'ring-4 ring-violet-500' : ''}`}
            >
              <b className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-base text-white">{LETTERS[i]}</b>
              {o.image && <img src={o.image} alt="" className="max-h-16 rounded-lg" />}
              <span className="break-words">{optionText(q, o, t)}</span>
            </button>
          );
        })}
      </div>
      {multi && (
        <div className="mt-3 flex justify-center">
          <button type="button" disabled={!sel.length || busy} onClick={() => onPick(sel)} className="adv-btn-violet flex items-center gap-2 px-6 py-2.5 disabled:opacity-40">
            {busy ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}{t('quiz.submit')}
          </button>
        </div>
      )}
    </div>
  );
}

/** The question card shown over the dimmed map. */
export function QuizCard({ q, label, hidden, busy, onAnswer, onHint, hintState, onRead, startsWith, tryKey, token }) {
  const { t } = useTranslation('adventure');
  const Widget = WIDGETS[q.type];
  const uploadBlob = useCallback(async (blob, name) => {
    const form = new FormData();
    form.append('file', blob, name);
    const r = await fetch(`/api/play/${token}/upload`, { method: 'POST', body: form });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    return d.url;
  }, [token]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/35 p-3 backdrop-blur-[2px]">
      <div className="adv-card relative max-h-[94vh] w-full max-w-2xl overflow-auto p-5 pt-8 animate-pop sm:p-7 sm:pt-9">
        <span className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1.5 rounded-xl bg-amber-400 px-3 py-1 font-adv text-sm font-bold text-slate-900 shadow-[0_3px_0_#b45309]"><Flag className="h-4 w-4" />{label}</span>
        {(q.passage || q.passageTitle || q.passageImage) && (
          <div className="mb-3 mt-3 max-h-[45vh] overflow-auto rounded-2xl bg-amber-50 p-4 text-left text-slate-700 scrollbar-thin">
            {q.passageTitle && <div className="mb-2 break-words font-adv text-lg font-bold leading-snug text-violet-700">{q.passageTitle}</div>}
            {q.passageImage && <ZoomImage src={q.passageImage} wrapClassName="mx-auto mb-2" className="max-h-56 max-w-full rounded-xl object-contain" />}
            {q.passage && <div className="whitespace-pre-wrap break-words">{q.passage}</div>}
          </div>
        )}
        <h2 className="mt-3 whitespace-pre-wrap break-words text-center font-adv text-2xl font-bold text-slate-900 sm:text-3xl">{q.text.replace(/\[\[[^\]]+\]\]/g, '____')}</h2>
        {q.image && !['labeling', 'hotspot', 'draw'].includes(q.type) && <img src={q.image} alt="" className="mx-auto mt-3 max-h-48 rounded-2xl" />}
        {startsWith && <p className="mt-2 text-center font-adv font-bold text-amber-700">💡 {startsWith}…</p>}
        <div className="mt-5">
          {CHOICE.includes(q.type)
            ? <ChoiceGrid q={q} hidden={hidden} busy={busy} onPick={onAnswer} />
            : Widget && (
              <div key={tryKey} className="rounded-2xl bg-gradient-to-b from-violet-700 to-indigo-800 p-3 sm:p-4">
                <Widget q={q} onSubmit={onAnswer} locked={busy} uploadBlob={uploadBlob} />
              </div>
            )}
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={onRead} className="adv-btn-white flex items-center gap-2 px-4 py-2 text-sm"><Volume2 className="h-4 w-4" />{t('quiz.readToMe')}</button>
          {hintState.show && (
            <button type="button" onClick={onHint} disabled={!hintState.enabled || busy} title={hintState.enabled ? '' : t('quiz.noHints')} className="adv-btn-white flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-40">
              <Lightbulb className="h-4 w-4 text-amber-500" />{hintState.tokens ? t('quiz.hintTokens', { count: hintState.tokens }) : t('quiz.hint')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** "Correct!" burst with rewards and the streak bar. */
export function CorrectOverlay({ hero, hat, recap, coins, star, xp, streak, onNext, ungraded, auto }) {
  const { t } = useTranslation('adventure');
  useEffect(() => {
    if (!auto) return undefined;
    const id = setTimeout(onNext, 2600);
    return () => clearTimeout(id);
  }, [auto, onNext]);
  const step = streak % CHEST_STREAK || (streak ? CHEST_STREAK : 0);
  const msg = ungraded ? t('quiz.recordedDesc') : streak && streak % CHEST_STREAK === 0 ? t('quiz.streakChest', { n: streak })
    : streak >= 2 ? t('quiz.streakN', { n: streak, left: CHEST_STREAK - step }) : t('quiz.streak');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-3">
      <Confetti />
      <div className="relative flex flex-col items-center">
        <Sunburst size={560} className="absolute -top-36 left-1/2 -translate-x-1/2" />
        <span className="relative z-10 rounded-2xl bg-emerald-600 px-6 py-2 font-adv text-3xl font-bold text-white shadow-[0_5px_0_#166534] animate-pop">{ungraded ? t('quiz.recorded') : t('quiz.correct')}</span>
        <div className="relative z-10 mt-4"><HeroSprite emoji={hero} hat={hat} size={86} pose="cheer" /></div>
        {recap && <span className="relative z-10 mt-4 max-w-md truncate rounded-2xl bg-white px-4 py-2 font-adv text-lg font-bold text-slate-800 shadow-lg">{recap}</span>}
        <div className="relative z-10 mt-3 flex flex-wrap justify-center gap-2">
          <Chip><CoinIcon size={16} />{t('quiz.coins', { n: coins })}</Chip>
          {star && <Chip>⭐ {t('quiz.star')}</Chip>}
          <Chip tone="violet">⚡ {t('quiz.xp', { n: xp })}</Chip>
        </div>
        <div className="relative z-10 mt-4 flex w-[min(92vw,560px)] items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-xl">
          <span className="text-xl">🔥</span>
          <span className="flex-1 font-adv font-bold text-slate-800">{msg}</span>
          <span className="hidden gap-1 sm:flex">{Array.from({ length: CHEST_STREAK }, (_, i) => <span key={i} className={`h-2 w-7 rounded-full ${i < step ? 'bg-orange-400' : 'bg-slate-200'}`} />)}</span>
          <button type="button" onClick={onNext} className="adv-btn-violet flex items-center gap-1 px-4 py-2">{t('quiz.keepGoing')}<ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}

/** First wrong answer: encouragement and another try. */
export function AlmostCard({ picked, lastHeart, onRetry }) {
  const { t } = useTranslation('adventure');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-3">
      <div className="adv-card w-full max-w-md bg-orange-50 p-6 animate-shake">
        <h3 className="font-adv text-3xl font-bold text-slate-900">{t('quiz.almost')} 🤏</h3>
        {picked && <p className="mt-2 text-slate-700">{t('quiz.youPicked', { answer: picked })}</p>}
        <button type="button" onClick={onRetry} className="adv-btn-violet mt-5 flex items-center gap-2 px-5 py-2.5"><RotateCcw className="h-4 w-4" />{t('quiz.tryAgain')}</button>
        {lastHeart && <p className="mt-3 text-sm text-slate-600">❤️ {t('quiz.lastHeart')}</p>}
      </div>
    </div>
  );
}

/** Second wrong answer: show the right answer, then step back one checkpoint. */
export function StepBackCard({ answer, explanation, onBack }) {
  const { t } = useTranslation('adventure');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3">
      <div className="adv-card w-full max-w-md p-6 animate-pop">
        <h3 className="font-adv text-2xl font-bold text-slate-900">{t('quiz.notQuite')} 🌧️</h3>
        {answer ? (
          <div className="mt-3 rounded-2xl bg-emerald-50 p-4">
            <div className="text-sm font-semibold text-emerald-700">{t('quiz.rightAnswer')}</div>
            <div className="mt-1 font-adv text-xl font-bold text-emerald-900">{answer}</div>
          </div>
        ) : !explanation && <p className="mt-2 text-slate-600">{t('quiz.noReveal')}</p>}
        {explanation && <p className="mt-3 rounded-2xl bg-sky-50 p-3 text-slate-700">💡 {explanation}</p>}
        <p className="mt-3 text-slate-600">{t('quiz.stepBack')}</p>
        <button type="button" onClick={onBack} className="adv-btn-violet mt-4 flex items-center gap-2 px-5 py-2.5"><Undo2 className="h-4 w-4" />{t('quiz.stepBackBtn')}</button>
      </div>
    </div>
  );
}

/** Game station: quiz card or adventure run. */
export function PlayChooser({ label, hero, canRun, onCard, onRun }) {
  const { t } = useTranslation('adventure');
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/35 p-3">
      <div className="adv-card relative w-full max-w-3xl p-6 pt-10 animate-pop">
        <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-amber-400 px-5 py-2 font-adv text-lg font-bold text-slate-900 shadow-[0_4px_0_#b45309]">{label}</span>
        <h2 className="text-center font-adv text-3xl font-bold text-slate-900 sm:text-4xl">{t('quiz.howPlay')}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <button type="button" onClick={onCard} className="flex flex-col items-center rounded-3xl bg-violet-100 p-6 text-center shadow-[0_5px_0_#c4b5fd] transition hover:-translate-y-1">
            <span className="text-6xl">🃏<span className="text-5xl">{hero}</span></span>
            <span className="mt-3 font-adv text-2xl font-bold text-slate-900">{t('quiz.card')}</span>
            <span className="mt-1 text-slate-600">{t('quiz.cardDesc')}</span>
          </button>
          <button type="button" disabled={!canRun} onClick={onRun} className="flex flex-col items-center rounded-3xl bg-emerald-100 p-6 text-center shadow-[0_5px_0_#86efac] transition hover:-translate-y-1 disabled:opacity-40">
            <span className="text-6xl"><span className="text-5xl">{hero}</span>🏃🟨</span>
            <span className="mt-3 font-adv text-2xl font-bold text-slate-900">{t('quiz.run')}</span>
            <span className="mt-1 text-slate-600">{t('quiz.runDesc')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
