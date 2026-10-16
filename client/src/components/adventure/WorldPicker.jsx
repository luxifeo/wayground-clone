import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import Scene from './Scene.jsx';
import { WORLDS, WORLD_CATS, worldById } from './data.js';

function PickerBody({ value, onClose, onSelect }) {
  const { t } = useTranslation('adventureCreate');
  const [cat, setCat] = useState('all');
  const [pick, setPick] = useState(worldById(value).id);
  const sel = worldById(pick);
  const list = cat === 'all' ? WORLDS : WORLDS.filter((w) => w.cat === cat);

  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={t('picker.title')} className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-violet-50 via-slate-50 to-white animate-rise">
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto w-full max-w-6xl px-4 pb-8 pt-6 sm:px-6 sm:pt-8">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-game text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{t('picker.title')}</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-600 sm:text-base">{t('picker.subtitle')}</p>
            </div>
            <button type="button" onClick={onClose} aria-label={t('common:actions.close')} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-slate-600 shadow-card ring-1 ring-slate-200 transition hover:bg-slate-100"><X className="h-5 w-5" /></button>
          </div>

          <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-thin sm:mx-0 sm:flex-wrap sm:px-0">
            {WORLD_CATS.map((c) => (
              <button
                key={c} type="button" onClick={() => setCat(c)} aria-pressed={cat === c}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${cat === c ? 'bg-violet-600 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-violet-50 hover:text-violet-700'}`}
              >{t(`adventure:cats.${c}`)}</button>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
            {list.map((w) => {
              const on = w.id === pick;
              return (
                <button
                  key={w.id} type="button" onClick={() => setPick(w.id)} onDoubleClick={() => onSelect(w.id)} aria-pressed={on}
                  className={`rounded-3xl bg-white p-2 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-lg ${on ? 'ring-4 ring-violet-500' : 'ring-1 ring-slate-200'}`}
                >
                  <div className="relative aspect-square overflow-hidden rounded-2xl">
                    <Scene world={w} width={900} />
                    <span className="absolute bottom-[12%] right-[10%] text-4xl drop-shadow-md sm:text-5xl">{w.boss}</span>
                    {on && <span className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-violet-600 text-white shadow-lg ring-2 ring-white animate-pop"><Check className="h-5 w-5" strokeWidth={3} /></span>}
                  </div>
                  <div className="px-1.5 pb-1.5 pt-2.5">
                    <div className="font-game text-base font-bold leading-tight text-slate-900 sm:text-lg">{t(`adventure:worlds.${w.id}.name`)}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500 sm:text-sm">{t('world.boss', { boss: `${w.boss} ${t(`adventure:worlds.${w.id}.boss`)}` })}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white/95 shadow-[0_-8px_24px_-12px_rgba(15,23,42,.18)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
          <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-xl ring-1 ring-slate-200 sm:h-16 sm:w-24"><Scene world={sel} width={900} props={false} /></div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-game text-base font-bold text-slate-900 sm:text-lg">{t(`adventure:worlds.${sel.id}.name`)}</div>
            <div className="hidden truncate text-sm text-slate-500 sm:block">{t(`adventure:worlds.${sel.id}.desc`)}</div>
          </div>
          <button type="button" onClick={() => onSelect(sel.id)} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 sm:px-6 sm:py-3 sm:text-base">
            <Check className="h-4 w-4" strokeWidth={3} />{t('picker.use')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Full-screen world chooser. onSelect(worldId) is called with the chosen world. */
export default function WorldPicker({ open, value, onClose, onSelect }) {
  if (!open) return null;
  return <PickerBody value={value} onClose={onClose} onSelect={onSelect} />;
}
