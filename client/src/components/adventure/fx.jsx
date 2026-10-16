import { useMemo } from 'react';
import { Heart, Star, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { levelFor } from './data.js';

/** Rotating light rays behind a reward. */
export function Sunburst({ size = 520, color = '#fde68a', className = '' }) {
  const rays = 12;
  return (
    <svg viewBox="-100 -100 200 200" width={size} height={size} className={`pointer-events-none ${className}`} aria-hidden="true">
      <g className="adv-rays" style={{ transformOrigin: 'center', transformBox: 'fill-box' }}>
        {Array.from({ length: rays }, (_, i) => (
          <polygon key={i} points="0,0 -9,-100 9,-100" fill={color} opacity="0.75" transform={`rotate(${(360 / rays) * i})`} />
        ))}
      </g>
      <circle r="42" fill="#fffbeb" />
    </svg>
  );
}

const CONFETTI = ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];

/** Falling confetti; mount it for a burst. */
export function Confetti({ n = 70 }) {
  const bits = useMemo(() => Array.from({ length: n }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.8, dur: 2.4 + Math.random() * 2, w: 6 + Math.random() * 6,
    color: CONFETTI[i % CONFETTI.length], round: Math.random() > 0.6,
  })), [n]);
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden="true">
      {bits.map((b, i) => (
        <span
          key={i} className="adv-fall absolute top-0 block"
          style={{ left: `${b.left}%`, width: b.w, height: b.round ? b.w : b.w * 1.8, background: b.color, borderRadius: b.round ? '50%' : 2, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s` }}
        />
      ))}
    </div>
  );
}

/** The player's hero emoji with an optional hat; `pose` picks an animation. */
export function HeroSprite({ emoji, hat, size = 64, pose = 'idle', flip = false, className = '' }) {
  const anim = { idle: 'adv-bob', walk: 'adv-walk', jump: 'adv-jump', cheer: 'adv-cheer', knock: 'adv-knock', none: '' }[pose] || '';
  return (
    <span className={`relative inline-block select-none leading-none ${anim} ${className}`} style={{ fontSize: size }} aria-hidden="true">
      <span className="inline-block drop-shadow-[0_6px_6px_rgba(0,0,0,.25)]" style={{ transform: flip ? 'scaleX(-1)' : undefined }}>{emoji}</span>
      {hat && <span className="absolute left-1/2 -translate-x-1/2" style={{ top: -size * 0.42, fontSize: size * 0.55 }}>{hat}</span>}
    </span>
  );
}

export function CoinIcon({ size = 20, spin = false }) {
  return (
    <span className={`inline-grid shrink-0 place-items-center rounded-full border-2 border-amber-500 bg-gradient-to-b from-yellow-300 to-amber-400 font-black text-amber-700 ${spin ? 'adv-coin' : ''}`} style={{ width: size, height: size, fontSize: size * 0.5 }}>●</span>
  );
}

export function Hearts({ n, max }) {
  return (
    <span className="adv-pill flex items-center gap-0.5 px-2.5 py-1.5">
      {Array.from({ length: max }, (_, i) => (
        <Heart key={i} className={`h-5 w-5 ${i < n ? 'fill-rose-500 text-rose-500' : 'fill-rose-100 text-rose-200'}`} />
      ))}
    </span>
  );
}

/** Top-right status pills: hearts, coins, stars, level badge. */
export function Hud({ hearts, maxHearts, coins, stars, xp }) {
  const { t } = useTranslation('adventure');
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <Hearts n={hearts} max={maxHearts} />
      <span className="adv-pill flex items-center gap-1.5 px-2.5 py-1.5"><CoinIcon size={20} />{coins}</span>
      <span className="adv-pill flex items-center gap-1 px-2.5 py-1.5"><Star className="h-5 w-5 fill-amber-400 text-amber-400" />{stars}</span>
      <span className="adv-pill hidden items-center gap-1.5 px-2.5 py-1 sm:flex">
        <Trophy className="h-4 w-4 text-amber-500" />
        <span className="flex flex-col leading-none"><span className="text-[9px] text-slate-400">{t('map.myBadge')}</span><span className="rounded-full bg-indigo-500 px-1.5 text-[11px] text-white">{t(`levels.${levelFor(xp).id}`)}</span></span>
      </span>
    </div>
  );
}

/** Read a text aloud in the UI language (Web Speech API, silently ignored when missing). */
export function speak(text, lang) {
  try {
    const synth = window.speechSynthesis;
    if (!synth || !text) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(String(text).replace(/\[\[[^\]]+\]\]/g, '…'));
    u.lang = lang === 'vi' ? 'vi-VN' : 'en-US';
    u.rate = 0.92;
    synth.speak(u);
  } catch { /* no speech */ }
}

/** Small celebratory chip, e.g. "+10 coins". */
export function Chip({ children, tone = 'amber' }) {
  const tones = { amber: 'bg-amber-50 text-amber-800 ring-amber-200', violet: 'bg-violet-50 text-violet-800 ring-violet-200', green: 'bg-emerald-50 text-emerald-800 ring-emerald-200' };
  return <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-adv text-sm font-bold ring-2 ${tones[tone]}`}>{children}</span>;
}
