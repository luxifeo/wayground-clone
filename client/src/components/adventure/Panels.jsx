import { useState } from 'react';
import { X, KeyRound, Lightbulb, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../LanguageSwitcher.jsx';
import { Toggle } from '../ui.jsx';
import { BADGES, BADGE_ICON, HATS, SHOP } from './data.js';
import { CoinIcon, Confetti, HeroSprite, Sunburst } from './fx.jsx';

function Sheet({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`adv-card flex max-h-[90vh] w-full ${wide ? 'max-w-xl' : 'max-w-md'} flex-col bg-amber-50/95 animate-pop`}>
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h3 className="font-adv text-2xl font-bold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="adv-btn-white grid h-10 w-10 place-items-center"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-auto px-4 pb-5 scrollbar-thin">{children}</div>
      </div>
    </div>
  );
}

const Row = ({ icon, title, desc, action, dim }) => (
  <div className={`flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_3px_0_rgba(0,0,0,.06)] ${dim ? 'opacity-70' : ''}`}>
    <span className="grid h-11 w-11 shrink-0 place-items-center text-3xl">{icon}</span>
    <div className="flex-1"><div className="font-adv text-lg font-bold text-slate-900">{title}</div><div className="text-sm text-slate-600">{desc}</div></div>
    {action}
  </div>
);

/** Rewards & Shop: what you own, and spending coins. */
export function RewardsPanel({ st, maxHearts, onBuy, onWear, onOpenRoom, onClose, pet }) {
  const { t } = useTranslation('adventure');
  const [tab, setTab] = useState('mine');
  const ownedHats = HATS.filter((h) => st.inv.hats.includes(h.id));
  return (
    <Sheet title={t('rewards.title')} onClose={onClose} wide>
      <div className="mb-3 grid grid-cols-2 rounded-2xl bg-violet-100 p-1">
        {['mine', 'shop'].map((k) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`flex items-center justify-center gap-2 rounded-xl py-2 font-adv font-bold ${tab === k ? 'bg-white text-slate-900 shadow' : 'text-slate-600'}`}>
            {t(`rewards.${k}`)}{k === 'shop' && <span className="flex items-center gap-1 text-sm"><CoinIcon size={16} />{st.coins}</span>}
          </button>
        ))}
      </div>
      {tab === 'mine' ? (
        <div className="space-y-3">
          <Row icon={<CoinIcon size={34} />} title={t('rewards.coins', { n: st.coins })} desc={t('rewards.coinsDesc')} action={<button type="button" onClick={() => setTab('shop')} className="adv-btn-yellow px-3 py-2 text-sm">{t('rewards.goShop')}</button>} />
          <Row icon={<Lightbulb className="h-8 w-8 text-amber-500" />} title={t('rewards.hints', { n: st.hints })} desc={t('rewards.hintsDesc')} />
          <Row
            icon={<KeyRound className={`h-8 w-8 ${st.inv.key ? 'text-amber-500' : 'text-slate-300'}`} />} dim={!st.inv.key}
            title={st.inv.key ? t('rewards.key') : t('rewards.keyNot')} desc={st.inv.keyUsed ? t('rewards.roomOpened') : t('rewards.keyDesc')}
            action={st.inv.key && !st.inv.keyUsed && <button type="button" onClick={onOpenRoom} className="adv-btn-yellow px-3 py-2 text-sm">{t('rewards.openRoom')}</button>}
          />
          <Row icon={st.inv.pet ? pet : '🥚'} dim={!st.inv.pet} title={st.inv.pet ? t('rewards.pet') : t('rewards.petNot')} desc={t('rewards.petDesc')} />
          <div className="rounded-2xl bg-white p-4">
            <div className="font-adv text-lg font-bold text-slate-900">{t('rewards.hats')}</div>
            {ownedHats.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {ownedHats.map((h) => (
                  <button key={h.id} type="button" onClick={() => onWear(st.inv.hat === h.id ? null : h.id)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${st.inv.hat === h.id ? 'bg-violet-600 text-white' : 'bg-violet-50 text-violet-800'}`}>
                    <span className="text-2xl">{h.emoji}</span>{st.inv.hat === h.id ? t('rewards.takeOff') : t('rewards.wear')}
                  </button>
                ))}
              </div>
            ) : <p className="mt-1 text-sm text-slate-600">{t('rewards.noHats')}</p>}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SHOP.map((it) => {
            const owned = it.hat && st.inv.hats.includes(it.id);
            const full = it.id === 'heart' && st.hearts >= maxHearts;
            const poor = st.coins < it.price;
            return (
              <div key={it.id} className="flex flex-col items-center rounded-2xl bg-white p-3 text-center shadow-[0_3px_0_rgba(0,0,0,.06)]">
                <span className="text-4xl">{it.hat ? <HeroSprite emoji={st.heroEmoji} hat={it.emoji} size={38} pose="none" /> : it.emoji}</span>
                <span className="mt-2 font-adv font-bold text-slate-900">{t(`shop.${it.id}.name`)}</span>
                <span className="mt-0.5 flex-1 text-xs text-slate-500">{t(`shop.${it.id}.desc`)}</span>
                <button
                  type="button" disabled={owned || full || poor} onClick={() => onBuy(it)}
                  title={poor ? t('rewards.notEnough') : ''}
                  className="adv-btn-yellow mt-2 flex w-full items-center justify-center gap-1 py-1.5 text-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
                >{owned ? t('rewards.owned') : full ? t('rewards.heartsFull') : <><CoinIcon size={16} />{it.price}</>}</button>
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

export function BadgesPanel({ owned, onClose }) {
  const { t } = useTranslation('adventure');
  return (
    <Sheet title={t('badgesTitle', { n: owned.length, total: BADGES.length })} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {BADGES.map((b) => {
          const on = owned.includes(b);
          return (
            <div key={b} className="flex flex-col items-center rounded-2xl bg-white p-3 text-center shadow-[0_3px_0_rgba(0,0,0,.06)]">
              <span className={`grid h-14 w-14 place-items-center rounded-full text-3xl ${on ? 'bg-gradient-to-b from-amber-200 to-amber-400 ring-4 ring-amber-100' : 'bg-slate-100 grayscale opacity-50'}`}>{BADGE_ICON[b]}</span>
              <span className="mt-2 font-adv font-bold text-slate-900">{t(`badges.${b}.name`)}</span>
              <span className="text-xs text-slate-500">{t(`badges.${b}.desc`)}</span>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

export function SettingsPanel({ sound, autoRead, onSound, onAutoRead, onLeave, onClose }) {
  const { t } = useTranslation('adventure');
  return (
    <Sheet title={t('settings.title')} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-2xl bg-white p-4"><span className="font-adv font-bold">{t('settings.sound')}</span><Toggle checked={sound} onChange={onSound} /></div>
        <div className="flex items-center justify-between rounded-2xl bg-white p-4"><span className="font-adv font-bold">{t('settings.autoRead')}</span><Toggle checked={autoRead} onChange={onAutoRead} /></div>
        <div className="flex items-center justify-between rounded-2xl bg-white p-4"><span className="font-adv font-bold">{t('settings.language')}</span><LanguageSwitcher /></div>
        <button type="button" onClick={onLeave} className="adv-btn-white flex w-full items-center justify-center gap-2 py-3 text-rose-600"><LogOut className="h-4 w-4" />{t('settings.leave')}</button>
      </div>
    </Sheet>
  );
}

/** Treasure chest opening with its reward cards. */
export function ChestOverlay({ rewards, pet, onCollect }) {
  const { t } = useTranslation('adventure');
  const card = (r, i) => {
    if (r.kind === 'coins') return { icon: <CoinIcon size={44} />, title: t('chest.coins', { n: r.n }), desc: t('chest.coinsDesc'), key: i };
    if (r.kind === 'key') return { icon: <KeyRound className="h-11 w-11 text-amber-500" />, title: t('chest.key'), desc: t('chest.keyDesc'), rare: true, key: i };
    if (r.kind === 'pet') return { icon: <span className="text-5xl">{pet}</span>, title: t('chest.pet'), desc: t('chest.petDesc'), rare: true, key: i };
    return { icon: <span className="text-5xl">👑</span>, title: t('chest.hat'), desc: t('chest.hatDesc'), rare: true, key: i };
  };
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/30 p-3">
      <Confetti />
      <h2 className="relative z-10 font-adv text-4xl font-bold text-white drop-shadow-[0_3px_3px_rgba(0,0,0,.4)] sm:text-5xl">{t('chest.title')}</h2>
      <div className="relative mt-2 grid place-items-center">
        <Sunburst size={420} className="absolute" />
        <svg viewBox="0 0 200 160" width="210" className="relative" aria-hidden="true">
          <rect x="25" y="70" width="150" height="80" rx="14" fill="#c97a3d" stroke="#3b2414" strokeWidth="6" />
          <rect x="85" y="88" width="30" height="34" rx="6" fill="#facc15" stroke="#3b2414" strokeWidth="5" />
          <circle cx="70" cy="72" r="12" fill="#fde047" /><circle cx="100" cy="66" r="13" fill="#facc15" /><circle cx="130" cy="72" r="12" fill="#fde047" />
          <g className="adv-lid"><rect x="20" y="30" width="160" height="46" rx="14" fill="#e08b47" stroke="#3b2414" strokeWidth="6" /></g>
        </svg>
      </div>
      <div className="relative z-10 mt-2 flex flex-wrap justify-center gap-3">
        {rewards.map(card).map((c) => (
          <div key={c.key} className={`flex w-44 flex-col items-center rounded-2xl bg-white p-4 text-center shadow-xl animate-pop ${c.rare ? 'ring-4 ring-violet-400' : ''}`}>
            {c.icon}
            {c.rare && <span className="mt-1 rounded-full bg-violet-600 px-2 text-[10px] font-bold uppercase text-white">{t('chest.rare')}</span>}
            <span className="mt-1 font-adv text-lg font-bold text-slate-900">{c.title}</span>
            <span className="text-xs text-slate-500">{c.desc}</span>
          </div>
        ))}
      </div>
      <p className="relative z-10 mt-3 rounded-full bg-white px-4 py-1 text-sm text-slate-700">{t('chest.later')}</p>
      <button type="button" onClick={onCollect} className="adv-btn-yellow relative z-10 mt-4 px-8 py-3 text-xl">{t('chest.collect')}</button>
    </div>
  );
}

/** Save flag: progress ring, hearts refilled. */
export function FlagOverlay({ done, total, petHint, bossNext, onContinue }) {
  const { t } = useTranslation('adventure');
  const pct = total ? done / total : 0;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/30 p-3">
      <span className="mb-6 flex items-center gap-2 rounded-2xl bg-amber-400 px-6 py-2 font-adv text-2xl font-bold text-slate-900 shadow-[0_5px_0_#b45309] animate-pop">🚩 {t('flag.title')}</span>
      <div className="adv-card w-full max-w-md p-5 animate-pop">
        <div className="flex items-center gap-4">
          <svg viewBox="0 0 100 100" width="96" height="96" className="shrink-0 -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#ede9fe" strokeWidth="11" />
            <circle cx="50" cy="50" r="40" fill="none" stroke="#16a34a" strokeWidth="11" strokeLinecap="round" strokeDasharray={`${pct * 251} 251`} />
            <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" transform="rotate(90 50 50)" className="fill-slate-800 font-adv text-[20px] font-bold">{done}/{total}</text>
          </svg>
          <div>
            <div className="font-adv text-xl font-bold text-slate-900">{t('flag.saved')}</div>
            <div className="text-sm text-slate-600">{t('flag.savedDesc')}</div>
          </div>
        </div>
        <div className="mt-3 rounded-2xl bg-rose-50 px-4 py-2 font-semibold text-slate-700">❤️❤️❤️ {t('flag.hearts')}</div>
        {petHint && <div className="mt-2 rounded-2xl bg-amber-50 px-4 py-2 font-semibold text-slate-700">💡 {t('flag.petHint')}</div>}
        <div className="mt-2 rounded-2xl bg-violet-50 px-4 py-2 text-slate-700"><b>{t('flag.next')}</b> {bossNext ? t('flag.nextBoss') : t('flag.nextMore')}</div>
        <button type="button" onClick={onContinue} className="adv-btn-violet mt-4 w-full py-3">{t('flag.continue')}</button>
      </div>
    </div>
  );
}
