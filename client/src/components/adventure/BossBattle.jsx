import { useCallback, useMemo } from 'react';
import { Lightbulb, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Scene from './Scene.jsx';
import { HeroSprite, Confetti } from './fx.jsx';
import { CHOICE, ChoiceGrid } from './QuizCard.jsx';
import {
  TextAnswer, ReorderAnswer, MatchAnswer, DropdownAnswer, DragDropAnswer, CategorizeAnswer, HotTextAnswer,
  MatchGridAnswer, TableFillAnswer, LabelingAnswer, HotspotAnswer, GraphingAnswer, DrawAnswer, RecordAnswer,
} from '../play/answers.jsx';

const WIDGETS = {
  fill: TextAnswer, math: TextAnswer, open: TextAnswer, wordcloud: TextAnswer, discussion: TextAnswer,
  reorder: ReorderAnswer, match: MatchAnswer, dropdown: DropdownAnswer, dragdrop: DragDropAnswer, categorize: CategorizeAnswer,
  hottext: HotTextAnswer, matchgrid: MatchGridAnswer, tablefill: TableFillAnswer, labeling: LabelingAnswer, hotspot: HotspotAnswer,
  graphing: GraphingAnswer, draw: DrawAnswer, audio: RecordAnswer, video: RecordAnswer,
};
const pick = (a, seed) => a[Math.abs(seed) % a.length];

/**
 * Hero vs boss. The parent grades answers; this only draws the fight.
 * effect: null | 'hit' | 'miss' | 'win'. hp: answers still needed, total: boss size.
 */
export default function BossBattle({
  world, kind, bossEmoji, bossName, hero, hat, heroName, q, qNum, hp, total, combo, effect, effectKey,
  hidden, busy, onPick, onHint, hintState, onRead, onWinContinue, progress, token, tryKey,
}) {
  const { t } = useTranslation('adventure');
  const Widget = WIDGETS[q?.type];
  const hits = useMemo(() => t('boss.hit', { returnObjects: true }), [t]);
  const cheers = useMemo(() => t('boss.cheer', { returnObjects: true }), [t]);
  const uploadBlob = useCallback(async (blob, name) => {
    const form = new FormData();
    form.append('file', blob, name);
    const r = await fetch(`/api/play/${token}/upload`, { method: 'POST', body: form });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    return d.url;
  }, [token]);

  const caption = effect === 'hit' ? pick(cheers, effectKey) : effect === 'miss' ? t('boss.breathe') : effect === 'win' ? t('boss.friend') : t('boss.magic');
  const bubble = effect === 'hit' ? pick(hits, effectKey) : effect === 'miss' ? t('boss.miss') : effect === 'win' ? t('boss.win') : null;

  return (
    <div className="fixed inset-0 z-30 overflow-hidden">
      <Scene world={world} width={1600} />
      <div className="absolute inset-0 bg-white/35 backdrop-blur-[3px]" />
      {effect === 'win' && <Confetti />}

      <div className="relative flex h-full flex-col items-center px-3 pt-20 sm:pt-24">
        {progress}
        <span className="mt-3 rounded-full bg-white/80 px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-500">{kind === 'boss' ? t('boss.final') : t('boss.mini')}</span>
        <h2 className="font-adv text-3xl font-bold text-slate-800 drop-shadow-sm sm:text-4xl">{bossName}</h2>

        {/* the stage */}
        <div className="relative mt-2 flex w-full max-w-3xl flex-1 items-center justify-between px-4 sm:px-12">
          <div className="absolute bottom-[12%] left-1/2 h-24 w-[110%] -translate-x-1/2 rounded-[50%] bg-white/50 ring-1 ring-white" />
          <div className="relative flex flex-col items-center">
            <div key={`h${effectKey}`} className={effect === 'miss' ? 'adv-knock' : effect === 'hit' || effect === 'win' ? 'adv-cheer' : ''}>
              <HeroSprite emoji={hero} hat={hat} size={110} pose={effect ? 'none' : 'idle'} />
            </div>
            <span className="mt-2 rounded-xl bg-white px-3 py-1 text-sm font-bold text-slate-700 shadow"><span className="mr-1 text-emerald-500">●</span>{heroName} <span className="font-normal text-slate-400">{t('boss.yourHero')}</span></span>
          </div>

          <div className="relative z-10 flex flex-col items-center">
            <span className="grid h-14 w-14 place-items-center rounded-full border-4 border-white bg-amber-400 font-adv text-xl font-bold text-slate-900 shadow-lg">{t('boss.vs')}</span>
            <span className="mt-2 max-w-[200px] rounded-xl bg-white px-3 py-1 text-center text-sm font-semibold text-slate-700 shadow">{caption}</span>
          </div>

          <div className="relative flex flex-col items-center">
            {bubble && <span key={`b${effectKey}`} className="absolute -top-10 z-10 whitespace-nowrap rounded-2xl bg-white px-4 py-1.5 font-adv text-xl font-bold text-violet-700 shadow-lg animate-pop">{bubble}</span>}
            <span key={`x${effectKey}`} className={`inline-block text-[120px] leading-none drop-shadow-[0_10px_10px_rgba(0,0,0,.25)] ${effect === 'hit' ? 'adv-wobble' : effect === 'miss' ? 'adv-lunge' : effect === 'win' ? 'adv-cheer' : 'adv-bob'}`}>{bossEmoji}</span>
            <div className={`mt-3 w-44 rounded-xl bg-white px-3 py-2 shadow transition ${effect === 'hit' ? 'rotate-3' : ''}`}>
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">{t('boss.answersLeft')}<span className="rounded-full bg-violet-100 px-2 text-violet-700">{hp} / {total}</span></div>
              <div className="mt-1.5 flex gap-1">{Array.from({ length: total }, (_, i) => <span key={i} className={`h-2 flex-1 rounded-full transition-colors ${i < hp ? (kind === 'boss' ? 'bg-violet-500' : 'bg-pink-400') : 'bg-slate-200'}`} />)}</div>
            </div>
          </div>
        </div>

        {/* question panel */}
        {q && effect !== 'win' && (
          <div className="relative z-10 mb-4 w-full max-w-3xl rounded-3xl bg-white p-4 shadow-2xl sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="text-xs font-bold uppercase tracking-wide text-violet-600">{kind === 'boss' ? t('boss.question', { n: qNum, total }) : t('boss.more', { count: hp })}</div>
                <div className="mt-1 whitespace-pre-wrap break-words font-adv text-xl font-bold text-slate-900 sm:text-2xl">{q.text.replace(/\[\[[^\]]+\]\]/g, '____')}</div>
              </div>
              <button type="button" onClick={onRead} title={t('quiz.readToMe')} className="adv-btn-white grid h-10 w-10 place-items-center"><Volume2 className="h-5 w-5" /></button>
              {hintState.show && <button type="button" onClick={onHint} disabled={!hintState.enabled || busy} title={t('quiz.hint')} className="adv-btn-white grid h-10 w-10 place-items-center disabled:opacity-40"><Lightbulb className="h-5 w-5 text-amber-500" /></button>}
              {combo > 1 && <span className="rounded-full bg-orange-50 px-3 py-1.5 text-sm font-bold text-orange-600 ring-1 ring-orange-200">🔥 {t('boss.combo', { n: combo })}</span>}
            </div>
            {q.image && <img src={q.image} alt="" className="mx-auto mt-2 max-h-32 rounded-xl" />}
            <div className="mt-3">
              {CHOICE.includes(q.type)
                ? <ChoiceGrid q={q} hidden={hidden} busy={busy || !!effect} onPick={onPick} compact />
                : Widget && <div key={tryKey} className="rounded-2xl bg-gradient-to-b from-violet-700 to-indigo-800 p-3"><Widget q={q} onSubmit={onPick} locked={busy} uploadBlob={uploadBlob} /></div>}
            </div>
          </div>
        )}
        {effect === 'win' && (
          <div className="relative z-10 mb-10 rounded-3xl bg-white px-10 py-6 text-center shadow-2xl ring-4 ring-amber-200 animate-pop">
            <div className="font-adv text-3xl font-bold text-emerald-700">{t('boss.win')}</div>
            <div className="mt-1 text-slate-600">{t('boss.friend')}</div>
            <button type="button" onClick={onWinContinue} className="adv-btn-violet mt-4 px-8 py-2.5">{t('boss.continue')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
