import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, Crown, Flag, Gamepad2, Lock, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Scene from './Scene.jsx';
import { CoinIcon, HeroSprite } from './fx.jsx';

const GAP = 250; // px between checkpoints
const LEFT = 200;

/** Checkpoint positions along a gentle wave, in px of the map box. */
function layout(n, h) {
  return Array.from({ length: n }, (_, i) => ({ x: LEFT + i * GAP, y: h * (0.66 + 0.07 * Math.sin(i * 1.15 + 0.4)) }));
}

function pathD(pts) {
  if (!pts.length) return '';
  let d = `M ${pts[0].x - 170} ${pts[0].y + 20} Q ${pts[0].x - 80} ${pts[0].y + 30} ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]; const b = pts[i];
    d += ` C ${a.x + GAP * 0.45} ${a.y} ${b.x - GAP * 0.45} ${b.y} ${b.x} ${b.y}`;
  }
  const last = pts[pts.length - 1];
  return `${d} Q ${last.x + 120} ${last.y - 10} ${last.x + 220} ${last.y - 70}`;
}

function Pin({ kind, state }) {
  const base = 'grid h-11 w-11 place-items-center rounded-full border-4 border-white shadow-lg';
  if (state === 'done') return <span className={`${base} bg-emerald-600 text-white`}><Check className="h-6 w-6" strokeWidth={3} /></span>;
  if (state === 'locked') return <span className={`${base} bg-slate-300/90 text-white`}><Lock className="h-5 w-5" /></span>;
  const icon = { q: <BookOpen className="h-5 w-5" />, game: <Gamepad2 className="h-5 w-5" />, mini: <Star className="h-5 w-5 fill-white" />, boss: <Crown className="h-5 w-5 fill-white" /> }[kind];
  const bg = { q: 'bg-violet-600', game: 'bg-orange-500', mini: 'bg-rose-500', boss: 'bg-red-600' }[kind];
  return <span className={`${base} ${bg} text-white`}>{icon}</span>;
}

/**
 * The world map: a scrolling landscape with a path of checkpoints.
 * cleared: { [stageIndex]: stars(1-3) }; current: index of the playable stage.
 */
export default function MapView({ world, stages, current, cleared, hero, hat, pet, name, walkingFrom, onPlay, bossEmoji }) {
  const { t } = useTranslation('adventure');
  const boxRef = useRef(null);
  const scrollRef = useRef(null);
  const [h, setH] = useState(600);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setH(el.clientHeight));
    ro.observe(el);
    setH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const pts = useMemo(() => layout(stages.length, h), [stages.length, h]);
  const width = Math.max(LEFT + (stages.length - 1) * GAP + 520, 900);
  const at = Math.min(current, stages.length - 1);
  const heroPos = pts[at] || { x: LEFT, y: h * 0.66 };

  // keep the hero in view
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    sc.scrollTo({ left: Math.max(0, heroPos.x - sc.clientWidth * 0.4), behavior: walkingFrom === null ? 'auto' : 'smooth' });
  }, [heroPos.x, walkingFrom]);

  const coins = [];
  pts.forEach((p, i) => {
    const nx = pts[i + 1];
    if (!nx) return;
    for (let k = 1; k <= 2; k++) {
      const f = k / 3;
      coins.push({ x: p.x + (nx.x - p.x) * f, y: p.y + (nx.y - p.y) * f - 6, taken: i < at });
    }
  });

  const boss = stages[stages.length - 1]?.kind === 'boss' ? pts[pts.length - 1] : null;

  return (
    <div ref={boxRef} className="absolute inset-0">
      <div ref={scrollRef} className="absolute inset-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="relative h-full" style={{ width }}>
          <Scene world={world} width={Math.round((width * 900) / Math.max(h, 1))} className="absolute inset-0 h-full w-full" />
          <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${width} ${h}`} preserveAspectRatio="none" aria-hidden="true">
            <path d={pathD(pts)} fill="none" stroke="rgba(120,80,40,.25)" strokeWidth="64" strokeLinecap="round" transform="translate(0 6)" />
            <path d={pathD(pts)} fill="none" stroke={world.ground} strokeWidth="56" strokeLinecap="round" />
            <path d={pathD(pts)} fill="none" stroke="rgba(150,110,60,.35)" strokeWidth="3" strokeDasharray="2 18" strokeLinecap="round" />
          </svg>
          <span className="absolute font-adv text-lg font-bold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,.5)]" style={{ left: (pts[0]?.x || LEFT) - 150, top: (pts[0]?.y || 0) - 70 }}>{t('map.start')}</span>

          {coins.map((c, i) => !c.taken && (
            <span key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: c.x, top: c.y }}><CoinIcon size={22} spin /></span>
          ))}

          {boss && (
            <div className="absolute -translate-x-1/2" style={{ left: boss.x + 150, top: boss.y - 170 }}>
              <span className="adv-bob inline-block text-[96px] leading-none drop-shadow-[0_8px_8px_rgba(0,0,0,.3)]">{bossEmoji}</span>
            </div>
          )}

          {stages.map((s, i) => {
            const p = pts[i];
            const state = cleared[i] !== undefined ? 'done' : i === current ? 'current' : i > current ? 'locked' : 'open';
            const isBoss = s.kind === 'boss';
            return (
              <div key={i} className="absolute" style={{ left: p.x, top: p.y }}>
                <div className="absolute left-1/2 -translate-x-1/2" style={{ top: -118 }}><Pin kind={s.kind} state={state} /></div>
                {s.flag && cleared[i] !== undefined && <Flag className="absolute h-10 w-10 fill-emerald-500 text-emerald-700" style={{ left: 18, top: -86 }} />}
                <button
                  type="button" disabled={i !== current} onClick={onPlay}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 font-adv font-bold transition ${isBoss
                    ? `rounded-2xl border-4 border-white bg-red-600 px-6 py-2 text-3xl text-white shadow-[0_6px_0_#7f1d1d] ${i === current ? 'adv-pulse hover:scale-105' : ''}`
                    : `grid h-[74px] w-[74px] place-items-center rounded-full border-4 text-3xl ${state === 'done' ? 'border-amber-200 bg-gradient-to-b from-amber-300 to-amber-500 text-white shadow-[0_6px_0_#b45309]'
                      : state === 'current' ? 'adv-pulse border-white bg-gradient-to-b from-yellow-300 to-amber-500 text-white shadow-[0_6px_0_#b45309] hover:scale-105'
                        : 'border-white/80 bg-gradient-to-b from-slate-200 to-slate-400 text-white shadow-[0_6px_0_#64748b]'}`}`}
                >{isBoss ? t('map.boss') : i + 1}</button>
                {cleared[i] !== undefined && !isBoss && (
                  <span className="absolute left-1/2 flex -translate-x-1/2" style={{ top: 30 }}>
                    {[1, 2, 3].map((k) => <Star key={k} className={`h-5 w-5 ${k <= cleared[i] ? 'fill-amber-400 text-amber-500' : 'fill-white text-slate-300'}`} />)}
                  </span>
                )}
              </div>
            );
          })}

          {/* hero (+ pet) standing on the current checkpoint */}
          <div className="absolute z-10 transition-[left,top] duration-[1100ms] ease-in-out" style={{ left: heroPos.x - 118, top: heroPos.y - 96 }}>
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-2xl bg-white px-4 py-2 font-adv text-lg font-bold text-slate-800 shadow-lg after:absolute after:-bottom-2 after:left-1/2 after:h-4 after:w-4 after:-translate-x-1/2 after:rotate-45 after:bg-white">
              {t('map.go', { name })}
            </div>
            <HeroSprite emoji={hero} hat={hat} size={64} pose={walkingFrom !== null ? 'walk' : 'idle'} />
            {pet && <span className="adv-bob absolute -left-12 top-8 text-4xl" style={{ animationDelay: '.3s' }}>{pet}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
