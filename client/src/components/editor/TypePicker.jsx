import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Hand as HandIcon } from 'lucide-react';
import { QTYPES, QTYPE_GROUPS } from '../../lib/constants.js';
import { qgroupLabel } from '../../i18n/index.js';

const CW_NUMS = { 0: 1, 2: 2, 12: 3 }; // clue numbers of the crossword illustration (CAT across, TOP down, PEN across)

/** Tiny illustrations shown in the hover preview. */
function Illustration({ type }) {
  const { t } = useTranslation('editor');
  const tile = 'rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-bold text-slate-700';
  switch (type) {
    case 'mcq': case 'msq': case 'poll':
      return <div className="grid w-full grid-cols-4 gap-1">{[0, 1, 2, 3].map((i) => <div key={i} className={`edit-${i} h-12 rounded ${type === 'msq' && i % 2 === 0 ? 'ring-2 ring-white' : ''}`} />)}</div>;
    case 'tf':
      return <div className="grid w-full grid-cols-2 gap-1"><div className="edit-0 grid h-12 place-items-center rounded text-xs font-bold text-white">{t('common:tf.true')}</div><div className="edit-3 grid h-12 place-items-center rounded text-xs font-bold text-white">{t('common:tf.false')}</div></div>;
    case 'fill': case 'math':
      return <div className="flex items-center gap-1 text-xs font-bold text-white">{type === 'math' ? '2(x+3) =' : t('picker.demo.capital')}<span className="rounded border-b-2 border-white px-3">{type === 'math' ? '2x+6' : t('picker.demo.paris')}</span></div>;
    case 'dropdown':
      return <div className="flex items-center gap-1 text-[10px] font-bold text-white">23 × 2 = <span className="rounded bg-white px-1.5 py-0.5 text-slate-600">{t('picker.demo.select')} ▾</span></div>;
    case 'dragdrop':
      return <div className="flex flex-col items-center gap-2 text-[10px] font-bold text-white"><span>23 × 2 = <span className="rounded bg-emerald-400 px-2 py-0.5">46</span></span><span className="flex gap-1"><span className={tile}>⋮ 64</span><span className={tile}>⋮ 32</span></span></div>;
    case 'categorize':
      return <div className="grid w-full grid-cols-3 gap-1"><div className="space-y-1">{['3²', '2+5', 'x=6'].map((t) => <div key={t} className={tile}>{t}</div>)}</div><div className="h-16 rounded bg-blue-500/70 p-1 text-center text-[9px] font-bold text-white">= 9</div><div className="h-16 rounded bg-orange-500/70 p-1 text-center text-[9px] font-bold text-white">≠ 9</div></div>;
    case 'reorder':
      return <div className="grid w-full grid-cols-4 gap-1">{['1/2', '7/10', '1', '3/4'].map((t, i) => <div key={t} className={`edit-${i} grid h-10 place-items-center rounded text-[10px] font-bold text-white`}>{t}</div>)}</div>;
    case 'match': case 'matchgrid':
      return <div className="grid w-full grid-cols-2 gap-1">{[t('picker.demo.rightAngle'), '∟', t('picker.demo.acute'), '∠'].map((t, i) => <div key={i} className={`edit-${i % 2 ? 2 : 0} grid h-8 place-items-center rounded text-[10px] font-bold text-white`}>{t}</div>)}</div>;
    case 'crossword':
      return <div className="grid grid-cols-5 gap-px">{[...'CAT    O    PEN'].map((ch, i) => (ch === ' ' ? <span key={i} className="h-5 w-5" /> : <span key={i} className="relative grid h-5 w-5 place-items-center bg-white text-[10px] font-bold text-slate-700 ring-1 ring-slate-400">{CW_NUMS[i] && <span className="absolute left-px top-0 text-[6px] leading-none text-slate-400">{CW_NUMS[i]}</span>}{ch}</span>))}</div>;
    case 'hottext':
      return <div className="rounded bg-white/90 p-1.5 text-[9px] leading-tight text-slate-700"><Trans ns="editor" i18nKey="picker.demo.hottext" components={{ m: <mark className="bg-yellow-300" /> }} /></div>;
    case 'tablefill':
      return <div className="w-full overflow-hidden rounded bg-white/90 text-[8px] text-slate-700">{[[t('picker.demo.material'), t('picker.demo.light')], [t('picker.demo.glass'), t('picker.demo.yes')], [t('picker.demo.wood'), '____']].map((r, i) => <div key={i} className="grid grid-cols-2 border-b border-slate-200">{r.map((c, j) => <div key={j} className={`px-1 py-0.5 ${i === 0 ? 'font-bold' : ''}`}>{c}</div>)}</div>)}</div>;
    case 'labeling':
      return <div className="relative h-16 w-full rounded bg-white/90"><div className="absolute left-2 top-2 h-1 w-16 bg-slate-400" /><span className="absolute right-2 top-1 rounded border border-dashed border-slate-500 px-1 text-[8px]">{t('picker.demo.yAxis')}</span><span className="absolute bottom-1 left-6 rounded border border-dashed border-slate-500 px-1 text-[8px]">{t('picker.demo.xAxis')}</span></div>;
    case 'hotspot':
      return <div className="flex h-16 w-full items-center justify-center gap-3 rounded bg-white/90">{[-1, 0, 1, 2].map((n) => <span key={n} className="grid h-6 w-6 place-items-center rounded-full border-2 border-dashed border-violet-500 text-[9px] font-bold">{n}</span>)}</div>;
    case 'graphing':
      return <svg viewBox="0 0 100 60" className="h-16 w-full rounded bg-white/90"><line x1="50" y1="0" x2="50" y2="60" stroke="#94a3b8" /><line x1="0" y1="30" x2="100" y2="30" stroke="#94a3b8" /><line x1="15" y1="55" x2="85" y2="5" stroke="#2563eb" strokeWidth="2" /><circle cx="40" cy="37" r="3" fill="#2563eb" /><circle cx="60" cy="23" r="3" fill="#2563eb" /></svg>;
    case 'draw':
      return <svg viewBox="0 0 100 60" className="h-16 w-full rounded bg-white"><path d="M10 40 Q30 5 50 35 T90 20" stroke="#7c3aed" strokeWidth="3" fill="none" /></svg>;
    case 'video': case 'audio':
      return <div className="flex flex-col items-center gap-1"><div className="grid h-10 w-14 place-items-center rounded bg-black/40 text-white">{type === 'video' ? '🎥' : '🎙️'}</div><span className="rounded bg-violet-500 px-2 py-0.5 text-[9px] font-bold text-white">{t('picker.demo.record')}</span></div>;
    case 'wordcloud':
      return <div className="flex flex-wrap items-center justify-center gap-1 font-bold text-white"><span className="text-base">{t('picker.demo.green')}</span><span className="text-xl">{t('picker.demo.red')}</span><span className="text-xs">{t('picker.demo.blue')}</span><span className="text-sm">{t('picker.demo.pink')}</span></div>;
    case 'discussion':
      return <div className="grid w-full grid-cols-3 gap-1">{[0, 1, 2].map((i) => <div key={i} className="h-10 rounded bg-yellow-200 p-1 text-[8px] text-slate-600">{t('picker.demo.idea', { n: i + 1 })}</div>)}</div>;
    case 'passage':
      return <div className="grid w-full grid-cols-2 gap-1"><div className="h-14 rounded bg-white/90 p-1 text-[7px] leading-tight text-slate-500">{t('picker.demo.story')}</div><div className="grid grid-cols-2 gap-0.5">{[0, 1, 2, 3].map((i) => <div key={i} className={`edit-${i} rounded`} />)}</div></div>;
    default:
      return <div className="h-12 w-full rounded bg-white/30" />;
  }
}

export default function TypePicker({ onPick, columns = 3 }) {
  const { t } = useTranslation('editor');
  const [hover, setHover] = useState(null);
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="font-semibold">{t('picker.title')}</span>
        <span className="flex items-center gap-1 text-sm text-slate-500"><HandIcon className="h-3.5 w-3.5" />{t('picker.hover')}</span>
      </div>
      {QTYPE_GROUPS.map((g) => (
        <div key={g} className="mb-4">
          <div className="mb-1.5 text-sm text-slate-500">{qgroupLabel(g)}</div>
          <div className={`grid gap-x-4 gap-y-0.5 ${columns === 3 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2'}`}>
            {Object.entries(QTYPES).filter(([, x]) => x.group === g).map(([k, x]) => (
              <div key={k} className="relative" onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)}>
                <button onClick={() => onPick(k)} className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm font-semibold ${hover === k ? 'bg-slate-100' : ''}`}>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${x.bg}`}><x.icon className={`h-4 w-4 ${x.color}`} /></span>
                  {x.label}
                  {x.isNew && <span className="rounded border border-brand-200 px-1 text-[9px] font-bold text-brand-500">{t('picker.new')}</span>}
                </button>
                {hover === k && (
                  <div className="pointer-events-none absolute left-0 top-full z-30 mt-1 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl animate-rise">
                    <div className="flex h-28 items-center justify-center bg-gradient-to-br from-[#5b1a63] to-[#3d0f45] p-3"><Illustration type={k} /></div>
                    <div className="space-y-1.5 p-3">
                      <span className="inline-block rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-blue-700">{x.graded}</span>
                      <p className="text-xs text-slate-600">{x.desc}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
