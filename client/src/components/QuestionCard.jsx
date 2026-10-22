import { useTranslation } from 'react-i18next';
import { CheckCircle2, Circle, Square, SquareCheck, ArrowRight, FileText } from 'lucide-react';
import { splitBlanks } from '../lib/constants.js';
import Graph from './Graph.jsx';
import { buildLayout, cwNormalize } from '../lib/crossword.js';

/** Small read-only crossword grid: numbered squares, with letters where `words` ({ entryId: letters }) has them. */
export function CrosswordMini({ layout, words = {}, size = 18 }) {
  const cells = new Map();
  (layout?.entries || []).forEach((e) => {
    const w = Array.from(words[e.id] || '');
    for (let k = 0; k < e.len; k++) {
      const key = `${e.row + (e.dir === 'down' ? k : 0)},${e.col + (e.dir === 'across' ? k : 0)}`;
      const cell = cells.get(key) || {};
      cells.set(key, { ch: cell.ch || w[k] || '', num: cell.num || (k === 0 ? e.num : null) });
    }
  });
  if (!cells.size) return null;
  const { rows, cols } = layout;
  return (
    <div className="grid w-max gap-px p-px" style={{ gridTemplateColumns: `repeat(${cols}, ${size}px)`, gridAutoRows: `${size}px` }}>
      {Array.from({ length: rows * cols }, (_, i) => {
        const cell = cells.get(`${Math.floor(i / cols)},${i % cols}`);
        return cell ? (
          <div key={i} className="relative grid place-items-center bg-white font-bold leading-none text-slate-800 ring-1 ring-slate-400" style={{ fontSize: Math.round(size * 0.55) }}>
            {cell.num && <span className="absolute left-px top-px leading-none text-slate-500" style={{ fontSize: Math.max(6, Math.round(size * 0.32)) }}>{cell.num}</span>}
            {cell.ch}
          </div>
        ) : <div key={i} />;
      })}
    </div>
  );
}

/**
 * Read-only rendering of a full question (with answers) for teacher views.
 * showPassage: false when the caller already shows the passage once for its whole group.
 */
export function QuestionBody({ q, showAnswers = true, compact = false, showPassage = true }) {
  const { t } = useTranslation('editor');
  const o = q.options || [];
  const ex = q.extra || {};
  const Mark = ({ ok, multi }) => (showAnswers && ok
    ? (multi ? <SquareCheck className="h-4 w-4 shrink-0 text-emerald-600" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />)
    : (multi ? <Square className="h-4 w-4 shrink-0 text-slate-300" /> : <Circle className="h-4 w-4 shrink-0 text-slate-300" />));
  const textWithBlanks = (render) => splitBlanks(q.text).map((p, i) => (p.t === 'text' ? <span key={i}>{p.v}</span> : <span key={i}>{render(p.id)}</span>));
  const pill = (t, ok = true) => <span className={`mx-0.5 rounded px-1.5 py-0.5 text-xs font-semibold ${ok && showAnswers ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{t}</span>;

  let body = null;
  switch (q.type) {
    case 'mcq': case 'msq': case 'tf': case 'poll':
      body = (
        <div className={`grid gap-x-8 gap-y-1.5 ${compact ? '' : 'sm:grid-cols-2'}`}>
          {o.map((x) => (
            <div key={x.id} className="flex items-center gap-2 text-sm">
              <Mark ok={(q.answer || []).includes(x.id)} multi={q.type === 'msq'} />
              {x.image && <img src={x.image} alt="" className="h-8 rounded" />}{q.type === 'tf' && ['true', 'false'].includes(x.id) ? t(`common:tf.${x.id}`) : x.text}
            </div>
          ))}
        </div>
      );
      break;
    case 'fill': case 'math':
      body = showAnswers && <div className="text-sm"><span className="font-semibold text-emerald-700">✓ {(q.answer?.accepted || [])[0]}</span>{(q.answer?.accepted || []).length > 1 && <span className="text-slate-500"> · {t('card.alternatives', { list: (q.answer.accepted || []).slice(1).join(', ') })}</span>}</div>;
      break;
    case 'open':
      body = showAnswers && q.answer?.sample ? <div className="text-sm text-slate-500">{t('card.sampleAnswer', { text: q.answer.sample })}</div> : null;
      break;
    case 'reorder':
      body = <ol className="list-decimal space-y-0.5 pl-5 text-sm">{o.map((x) => <li key={x.id}>{x.text}</li>)}</ol>;
      break;
    case 'match':
      body = <div className="space-y-1 text-sm">{o.map((p) => <div key={p.id} className="flex items-center gap-2"><span className="rounded bg-slate-100 px-2 py-0.5">{p.left}</span><ArrowRight className="h-3.5 w-3.5 text-slate-400" /><span className="rounded bg-slate-100 px-2 py-0.5">{showAnswers ? p.right : '?'}</span></div>)}</div>;
      break;
    case 'dropdown':
      body = <div className="text-sm leading-7">{textWithBlanks((id) => { const b = o.find((x) => x.id === id); return pill(b ? (showAnswers ? b.choices.find((c) => c.id === b.correct)?.text || '?' : b.choices.map((c) => c.text).join(' / ')) : '?'); })}</div>;
      break;
    case 'dragdrop':
      body = (
        <div className="text-sm leading-7">
          {textWithBlanks((id) => pill(showAnswers ? o.find((x) => x.id === id)?.answer : '_____'))}
          {(ex.distractors || []).length > 0 && <div className="text-xs text-slate-500">{t('card.distractors', { list: ex.distractors.join(', ') })}</div>}
        </div>
      );
      break;
    case 'categorize':
      body = (
        <div className="flex flex-wrap gap-3 text-sm">
          {(ex.categories || []).map((c) => (
            <div key={c.id} className="min-w-[120px] rounded-lg border border-slate-200 p-2">
              <div className="mb-1 font-semibold">{c.name}</div>
              {showAnswers && o.filter((i) => i.cat === c.id).map((i) => <div key={i.id} className="text-slate-600">• {i.text}</div>)}
            </div>
          ))}
          {!showAnswers && <div className="text-slate-500">{t('card.items', { list: o.map((i) => i.text).join(', ') })}</div>}
        </div>
      );
      break;
    case 'hottext':
      body = <div className="text-sm leading-6">{o.map((u) => <span key={u.id} className={showAnswers && (q.answer || []).includes(u.id) ? 'rounded bg-emerald-200' : ''}>{u.text} </span>)}</div>;
      break;
    case 'matchgrid':
      body = (
        <table className="text-sm">
          <thead><tr><th />{(ex.columns || []).map((c) => <th key={c.id} className="px-2 font-semibold">{c.text}</th>)}</tr></thead>
          <tbody>{o.map((r) => <tr key={r.id}><td className="pr-3">{r.text}</td>{(ex.columns || []).map((c) => <td key={c.id} className="px-2 text-center">{showAnswers && (q.answer?.[r.id] || []).includes(c.id) ? '✓' : '·'}</td>)}</tr>)}</tbody>
        </table>
      );
      break;
    case 'tablefill':
      body = (
        <table className="border border-slate-200 text-sm">
          <thead><tr className="bg-slate-50">{(ex.table?.cols || []).map((c, i) => <th key={i} className="border border-slate-200 px-2 py-1">{c}</th>)}</tr></thead>
          <tbody>{(ex.table?.rows || []).map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} className="border border-slate-200 px-2 py-1">{c.t === 'blank' ? pill(showAnswers ? (c.accepted || [])[0] : '_____') : c.v}</td>)}</tr>)}</tbody>
        </table>
      );
      break;
    case 'labeling': case 'hotspot':
      body = q.image && (
        <div className="relative inline-block max-w-sm">
          <img src={q.image} alt="" className="rounded-lg" />
          {q.type === 'labeling' && o.map((lb) => <span key={lb.id} className="absolute -translate-x-1/2 -translate-y-1/2 rounded bg-violet-600 px-1.5 text-[10px] font-bold text-white" style={{ left: `${lb.x}%`, top: `${lb.y}%` }}>{showAnswers ? lb.text : '?'}</span>)}
          {q.type === 'hotspot' && o.map((r) => <span key={r.id} className={`absolute rounded border-2 border-dashed ${showAnswers && (q.answer || []).includes(r.id) ? 'border-emerald-500 bg-emerald-300/30' : 'border-slate-400'}`} style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }} />)}
        </div>
      );
      break;
    case 'graphing':
      body = <div className="w-56"><Graph {...ex} points={showAnswers ? q.answer?.points || [] : []} size={220} /></div>;
      break;
    case 'crossword': {
      const lay = Array.isArray(ex.layout?.entries) ? ex.layout : buildLayout(o);
      const byId = new Map(o.map((w) => [w.id, w]));
      body = (
        <div className="flex flex-wrap items-start gap-4">
          <div className="max-w-full overflow-x-auto"><CrosswordMini layout={lay} words={showAnswers ? Object.fromEntries(o.map((w) => [w.id, cwNormalize(w.answer)])) : {}} size={compact ? 14 : 18} /></div>
          <div className="min-w-[200px] flex-1 space-y-2 text-sm">
            {['across', 'down'].map((d) => lay.entries.some((e) => e.dir === d) && (
              <div key={d}>
                <div className="text-xs font-bold uppercase text-slate-500">{t(`bodies.crossword.${d}`)}</div>
                {lay.entries.filter((e) => e.dir === d).map((e) => (
                  <div key={e.id} className="flex gap-1.5">
                    <span className="w-5 shrink-0 text-right font-semibold text-slate-500">{e.num}.</span>
                    <span>{byId.get(e.id)?.clue}{showAnswers && <span className="ml-1.5 rounded bg-emerald-100 px-1.5 text-xs font-semibold text-emerald-700">{byId.get(e.id)?.answer}</span>}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      );
      break;
    }
    default:
      body = null;
  }

  return (
    <div className="space-y-2">
      {showPassage && (ex.passage || ex.passageTitle || ex.passageImage) && (
        <div className="flex gap-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
          <FileText className="h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1 space-y-1">
            {ex.passageTitle && <div className="font-semibold text-violet-700">{ex.passageTitle}</div>}
            {ex.passageImage && <img src={ex.passageImage} alt="" className="h-16 max-w-full rounded border border-slate-200 bg-white object-contain" />}
            {ex.passage && <div className="line-clamp-3 whitespace-pre-line">{ex.passage}</div>}
          </div>
        </div>
      )}
      <div className="flex items-start gap-3">
        {q.image && !['labeling', 'hotspot'].includes(q.type) && <img src={q.image} alt="" title={q.extra?.imageCredit ? `${q.extra.imageCredit.title || ''} · ${q.extra.imageCredit.license || ''}` : undefined} className="h-16 w-20 shrink-0 rounded-lg border border-slate-200 object-cover" />}
        <div className="whitespace-pre-wrap text-[15px] font-semibold text-slate-800">{['dropdown', 'dragdrop'].includes(q.type) ? '' : q.text}</div>
      </div>
      {body}
      {showAnswers && q.explanation && !compact && <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">💡 {q.explanation}</div>}
    </div>
  );
}
