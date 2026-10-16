import { useEffect, useRef, useState } from 'react';
import { Check, X, ArrowUp, ArrowDown, GripVertical, Eraser, Trash2, Mic, Video, Square, RotateCcw, Send, Delete } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { splitBlanks } from '../../lib/constants.js';
import Graph from '../Graph.jsx';
import { Avatar, Spinner } from '../ui.jsx';

export function SubmitBar({ onClick, disabled, label, busy }) {
  const { t } = useTranslation('play');
  return (
    <div className="mt-4 flex justify-center">
      <button onClick={onClick} disabled={disabled || busy} className="game-btn flex items-center gap-2 bg-white px-10 py-3 text-lg text-violet-800 disabled:opacity-40">
        {busy ? <Spinner className="h-5 w-5" /> : <Send className="h-5 w-5" />}{label ?? t('answers.submit')}
      </button>
    </div>
  );
}

const chip = 'game-btn bg-white px-3 py-2 text-sm text-slate-800 shadow-[0_3px_0_rgba(0,0,0,.25)]';
const okRing = 'ring-4 ring-emerald-400';
const badRing = 'ring-4 ring-red-500';

// ------------------------------------------------------------ choices
export function ChoiceAnswer({ q, onSubmit, result, locked }) {
  const { t } = useTranslation('play');
  const [sel, setSel] = useState([]);
  const multi = q.type === 'msq';
  const correct = result?.reveal?.correct;
  const pick = (id) => {
    if (locked) return;
    if (multi) setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    else { setSel([id]); onSubmit([id]); }
  };
  const n = q.options.length;
  return (
    <div>
      {multi && <div className="mb-2 text-center font-game text-sm font-bold text-white/80">{q.correctCount ? t('answers.choice.selectN', { count: q.correctCount }) : t('answers.choice.selectAll')}</div>}
      <div className={`grid gap-2 sm:gap-3 ${n <= 2 ? 'grid-cols-2' : n === 3 ? 'grid-cols-1 sm:grid-cols-3' : n === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-5'}`}>
        {q.options.map((o, i) => {
          const chosen = (sel.length ? sel : [].concat(result?.answer || [])).includes(o.id);
          const isOk = correct?.includes(o.id);
          const dim = result && !result.hidden && correct && !isOk && !chosen;
          const color = q.type === 'tf' ? (o.id === 'true' ? 'opt-1' : 'opt-4') : `opt-${i % 5}`;
          return (
            <button
              key={o.id} onClick={() => pick(o.id)} disabled={locked && !multi}
              className={`${color} relative flex min-h-[110px] flex-col items-center justify-center gap-2 rounded-2xl p-4 font-game text-xl font-bold text-white shadow-lg transition sm:min-h-[220px] sm:text-2xl
                ${!locked ? 'hover:-translate-y-1 hover:brightness-110' : ''} ${chosen && multi && !result ? 'ring-4 ring-white' : ''}
                ${result && correct && isOk ? okRing : ''} ${result && correct && chosen && !isOk ? `${badRing} animate-shake` : ''} ${dim ? 'opacity-30' : ''}`}
            >
              <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md bg-black/20 text-sm">{multi ? (chosen ? <Check className="h-4 w-4" /> : '') : i + 1}</span>
              {o.image && <img src={o.image} alt="" className="max-h-28 rounded-lg" />}
              <span className="break-words">{q.type === 'tf' && o.text === { true: 'True', false: 'False' }[o.id] ? t(`common:tf.${o.id}`) : o.text}</span>
            </button>
          );
        })}
      </div>
      {multi && !result && <SubmitBar onClick={() => onSubmit(sel)} disabled={!sel.length || locked} />}
    </div>
  );
}

// ------------------------------------------------------------ text-like
const KEYS = ['7', '8', '9', '÷', '(', ')', '4', '5', '6', '×', 'x', 'y', '1', '2', '3', '−', '^', '√', '0', '.', 'π', '+', '/', '='];

export function TextAnswer({ q, onSubmit, result, locked }) {
  const { t } = useTranslation('play');
  const [v, setV] = useState('');
  const ref = useRef(null);
  const long = ['open', 'discussion'].includes(q.type);
  const insert = (k) => {
    const map = { '÷': '/', '×': '*', '−': '-', '√': 'sqrt(' };
    const ins = map[k] ?? k;
    const el = ref.current; const pos = el?.selectionStart ?? v.length;
    setV(v.slice(0, pos) + ins + v.slice(pos));
    setTimeout(() => { el?.focus(); el?.setSelectionRange(pos + ins.length, pos + ins.length); }, 0);
  };
  const accepted = result?.reveal?.accepted;
  return (
    <div className="mx-auto max-w-2xl">
      {long ? (
        <textarea ref={ref} value={v} onChange={(e) => setV(e.target.value)} disabled={locked} maxLength={2000} placeholder={t('answers.text.placeholder')} className="min-h-[160px] w-full rounded-2xl bg-white p-4 font-game text-lg text-slate-800 outline-none" />
      ) : (
        <input
          ref={ref} value={v} onChange={(e) => setV(e.target.value)} disabled={locked} autoFocus
          maxLength={q.type === 'wordcloud' ? 40 : 200}
          onKeyDown={(e) => e.key === 'Enter' && v.trim() && !locked && onSubmit(v.trim())}
          placeholder={t(q.type === 'math' ? 'answers.text.mathPlaceholder' : q.type === 'wordcloud' ? 'answers.text.wordcloudPlaceholder' : 'answers.text.placeholder')}
          className={`w-full rounded-2xl bg-white px-5 py-4 text-center font-game text-2xl font-bold text-slate-800 outline-none ${q.type === 'math' ? 'font-mono' : ''} ${result && result.status === 'correct' ? okRing : ''} ${result && result.status === 'incorrect' ? badRing : ''}`}
        />
      )}
      {q.type === 'math' && !locked && (
        <div className="mx-auto mt-3 grid max-w-md grid-cols-6 gap-1.5">
          {KEYS.map((k) => <button key={k} onClick={() => insert(k)} className="rounded-lg bg-white/15 py-2 font-mono text-lg font-bold text-white hover:bg-white/25">{k}</button>)}
          <button onClick={() => setV(v.slice(0, -1))} className="col-span-2 flex items-center justify-center rounded-lg bg-white/25 py-2 text-white"><Delete className="h-5 w-5" /></button>
          <button onClick={() => setV('')} className="col-span-4 rounded-lg bg-white/10 py-2 text-sm font-bold text-white">{t('answers.text.clear')}</button>
        </div>
      )}
      {accepted && result.status !== 'correct' && (
        <div className="mt-3 rounded-xl bg-emerald-500 px-4 py-2 text-center font-game font-bold text-white">{t('answers.text.correctAnswer', { answer: accepted.join(' / ') })}</div>
      )}
      {!result && <SubmitBar onClick={() => onSubmit(v.trim())} disabled={!v.trim() || locked} />}
    </div>
  );
}

// ------------------------------------------------------------ reorder
export function ReorderAnswer({ q, onSubmit, result, locked }) {
  const [items, setItems] = useState(q.options);
  const [dragI, setDragI] = useState(null);
  const order = result?.reveal?.order;
  const move = (i, j) => {
    if (locked || j < 0 || j >= items.length) return;
    const a = [...items]; const [x] = a.splice(i, 1); a.splice(j, 0, x); setItems(a);
  };
  return (
    <div className="mx-auto max-w-xl space-y-2">
      {items.map((o, i) => {
        const ok = order && order[i] === o.id;
        return (
          <div
            key={o.id} draggable={!locked}
            onDragStart={() => setDragI(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { move(dragI, i); setDragI(null); }}
            className={`opt-${i % 5} flex items-center gap-3 rounded-xl px-3 py-3 font-game text-lg font-bold text-white shadow ${order ? (ok ? okRing : badRing) : ''} ${!locked ? 'cursor-grab' : ''}`}
          >
            <GripVertical className="h-5 w-5 opacity-70" />
            <span className="grid h-7 w-7 place-items-center rounded-full bg-black/25 text-sm">{i + 1}</span>
            <span className="flex-1">{o.text}</span>
            {order && !ok && <span className="rounded bg-black/30 px-2 text-xs">→ #{order.indexOf(o.id) + 1}</span>}
            {!locked && (
              <span className="flex gap-1">
                <button onClick={() => move(i, i - 1)} className="rounded bg-black/20 p-1"><ArrowUp className="h-4 w-4" /></button>
                <button onClick={() => move(i, i + 1)} className="rounded bg-black/20 p-1"><ArrowDown className="h-4 w-4" /></button>
              </span>
            )}
          </div>
        );
      })}
      {!result && <SubmitBar onClick={() => onSubmit(items.map((o) => o.id))} disabled={locked} />}
    </div>
  );
}

// ------------------------------------------------------------ match
const PAIR_COLORS = ['#f59e0b', '#06b6d4', '#a855f7', '#22c55e', '#ef4444', '#3b82f6', '#ec4899', '#84cc16'];

export function MatchAnswer({ q, onSubmit, result, locked }) {
  const { t } = useTranslation('play');
  const [pairs, setPairs] = useState({});
  const [active, setActive] = useState(null);
  const reveal = result?.reveal?.pairs;
  const pickLeft = (id) => { if (!locked) setActive(id); };
  const pickRight = (rid) => {
    if (locked || !active) return;
    const next = Object.fromEntries(Object.entries(pairs).filter(([, v]) => v !== rid));
    next[active] = rid; setPairs(next); setActive(null);
  };
  const colorOfLeft = (id) => PAIR_COLORS[q.lefts.findIndex((l) => l.id === id) % PAIR_COLORS.length];
  // a pair is right when the picked item has the same content as the key (duplicates are interchangeable)
  const rightKey = (o) => o && `${String(o.text ?? o.right ?? '').trim()}|${o.image ?? o.rightImage ?? ''}`;
  const isOk = (lid) => {
    const key = reveal?.find((p) => p.id === lid);
    const got = q.rights.find((r) => r.id === pairs[lid]);
    return !!key && !!got && rightKey(got) === rightKey(key);
  };

  // connector lines: measure the paired buttons and draw an SVG line between them
  const wrapRef = useRef(null);
  const btnRefs = useRef({});
  const [lines, setLines] = useState([]);
  useEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const w = wrap.getBoundingClientRect();
      const next = [];
      for (const [lid, rid] of Object.entries(pairs)) {
        const a = btnRefs.current['l' + lid]?.getBoundingClientRect();
        const b = btnRefs.current['r' + rid]?.getBoundingClientRect();
        if (!a || !b) continue;
        next.push({
          lid, x1: a.right - w.left, y1: a.top + a.height / 2 - w.top,
          x2: b.left - w.left, y2: b.top + b.height / 2 - w.top,
        });
      }
      setLines(next);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [pairs, q, result]);

  return (
    <div className="mx-auto max-w-3xl">
      <div ref={wrapRef} className="relative grid grid-cols-2 gap-x-16 gap-y-2">
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          {lines.map((ln) => {
            const color = reveal ? (isOk(ln.lid) ? '#34d399' : '#ef4444') : colorOfLeft(ln.lid);
            return (
              <g key={ln.lid}>
                <line x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2} stroke={color} strokeWidth="5" strokeLinecap="round" />
                <circle cx={ln.x1} cy={ln.y1} r="7" fill={color} stroke="#fff" strokeWidth="2" />
                <circle cx={ln.x2} cy={ln.y2} r="7" fill={color} stroke="#fff" strokeWidth="2" />
              </g>
            );
          })}
        </svg>
        <div className="space-y-2">
          {q.lefts.map((l) => {
            const ok = reveal && isOk(l.id);
            return (
              <button
                key={l.id} ref={(el) => { btnRefs.current['l' + l.id] = el; }} onClick={() => pickLeft(l.id)}
                className={`w-full rounded-xl border-4 border-transparent bg-white px-3 py-3 text-left font-game font-bold text-slate-800 ${active === l.id ? 'ring-4 ring-yellow-300' : ''} ${reveal ? (ok ? okRing : badRing) : ''}`}
              >
                {l.text}
                {reveal && !ok && <div className="mt-1 text-xs text-emerald-600">✓ {reveal.find((p) => p.id === l.id)?.right}</div>}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {q.rights.map((r) => (
            <button
              key={r.id} ref={(el) => { btnRefs.current['r' + r.id] = el; }} onClick={() => pickRight(r.id)}
              className={`w-full rounded-xl border-4 border-transparent px-3 py-3 text-left font-game font-bold text-white opt-2 ${active ? 'hover:brightness-110' : ''}`}
            >{r.text}</button>
          ))}
        </div>
      </div>
      {!result && <p className="mt-3 text-center text-sm text-white/70">{t('answers.match.hint')}</p>}
      {!result && <SubmitBar onClick={() => onSubmit(pairs)} disabled={locked || Object.keys(pairs).length < q.lefts.length} />}
    </div>
  );
}

// ------------------------------------------------------------ dropdown & drag-drop (inline blanks)
export function DropdownAnswer({ q, onSubmit, result, locked }) {
  const { t } = useTranslation('play');
  const [ans, setAns] = useState({});
  const rv = result?.reveal;
  const byId = new Map(q.blanks.map((b) => [b.id, b]));
  return (
    <div className="mx-auto max-w-3xl">
      <div className="game-panel p-6 text-center font-game text-2xl font-bold leading-[3rem] text-white">
        {splitBlanks(q.text).map((p, i) => {
          if (p.t === 'text') return <span key={i}>{p.v}</span>;
          const b = byId.get(p.id); if (!b) return null;
          const ok = rv && ans[p.id] === rv.blanks?.[p.id];
          return (
            <span key={i} className="mx-1 inline-flex flex-col items-center align-middle">
              <select
                value={ans[p.id] || ''} disabled={locked} onChange={(e) => setAns({ ...ans, [p.id]: e.target.value })}
                className={`rounded-lg bg-white px-2 py-1 text-lg text-slate-800 outline-none ${rv ? (ok ? okRing : badRing) : ''}`}
              >
                <option value="">{t('answers.dropdown.select')}</option>
                {b.choices.map((c) => <option key={c.id} value={c.id}>{c.text}</option>)}
              </select>
              {rv && !ok && <span className="text-sm leading-5 text-emerald-300">{rv.text?.[p.id]}</span>}
            </span>
          );
        })}
      </div>
      {!result && <SubmitBar onClick={() => onSubmit(ans)} disabled={locked || q.blanks.some((b) => !ans[b.id])} />}
    </div>
  );
}

export function DragDropAnswer({ q, onSubmit, result, locked }) {
  const { t } = useTranslation('play');
  const [ans, setAns] = useState({});
  const [held, setHeld] = useState(null); // chip index
  const rv = result?.reveal?.blanks;
  const usedIdx = new Set(Object.values(ans).map((a) => a.idx));
  const place = (blankId, idx) => {
    if (locked || idx === null || idx === undefined) return;
    const next = Object.fromEntries(Object.entries(ans).filter(([, v]) => v.idx !== idx));
    next[blankId] = { idx, text: q.chips[idx] };
    setAns(next); setHeld(null);
  };
  return (
    <div className="mx-auto max-w-3xl">
      <div className="game-panel p-6 text-center font-game text-2xl font-bold leading-[3.2rem] text-white">
        {splitBlanks(q.text).map((p, i) => {
          if (p.t === 'text') return <span key={i}>{p.v}</span>;
          const a = ans[p.id];
          const ok = rv && a && a.text.trim().toLowerCase() === String(rv[p.id]).trim().toLowerCase();
          return (
            <span key={i} className="mx-1 inline-flex flex-col items-center align-middle">
              <button
                onClick={() => (held !== null ? place(p.id, held) : a && !locked && setAns(Object.fromEntries(Object.entries(ans).filter(([k]) => k !== p.id))))}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => place(p.id, Number(e.dataTransfer.getData('text/plain')))}
                className={`min-w-[96px] rounded-lg border-2 border-dashed px-3 py-0.5 text-lg ${a ? 'border-transparent bg-emerald-400 text-white' : 'border-white/60 bg-white/10 text-white/50'} ${rv ? (ok ? okRing : badRing) : ''}`}
              >{a ? a.text : t('answers.dragdrop.dropHere')}</button>
              {rv && !ok && <span className="text-sm leading-5 text-emerald-300">{rv[p.id]}</span>}
            </span>
          );
        })}
      </div>
      {!locked && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {q.chips.map((c, i) => (usedIdx.has(i) ? null : (
            <button
              key={i} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', String(i))}
              onClick={() => setHeld(held === i ? null : i)} className={`${chip} ${held === i ? 'ring-4 ring-yellow-300' : ''}`}
            ><GripVertical className="mr-1 inline h-4 w-4 opacity-50" />{c}</button>
          )))}
        </div>
      )}
      {!result && <SubmitBar onClick={() => onSubmit(Object.fromEntries(Object.entries(ans).map(([k, v]) => [k, v.text])))} disabled={locked || q.blanks.some((b) => !ans[b.id])} />}
    </div>
  );
}

// ------------------------------------------------------------ categorize
export function CategorizeAnswer({ q, onSubmit, result, locked }) {
  const [ans, setAns] = useState({});
  const [held, setHeld] = useState(null);
  const rv = result?.reveal?.items;
  const drop = (catId, itemId) => { if (!locked && itemId) { setAns({ ...ans, [itemId]: catId }); setHeld(null); } };
  const pool = q.items.filter((i) => !ans[i.id]);
  const Item = ({ it }) => {
    const ok = rv && rv[it.id] === ans[it.id];
    return (
      <button
        draggable={!locked} onDragStart={(e) => e.dataTransfer.setData('text/plain', it.id)}
        onClick={() => (locked ? null : ans[it.id] ? setAns(Object.fromEntries(Object.entries(ans).filter(([k]) => k !== it.id))) : setHeld(held === it.id ? null : it.id))}
        className={`${chip} w-full ${held === it.id ? 'ring-4 ring-yellow-300' : ''} ${rv ? (ok ? okRing : badRing) : ''}`}
      >
        {it.image && <img src={it.image} alt="" className="mx-auto mb-1 max-h-12" />}{it.text}
        {rv && !ok && <div className="text-[11px] text-emerald-600">→ {q.categories.find((c) => c.id === rv[it.id])?.name}</div>}
      </button>
    );
  };
  return (
    <div className="mx-auto max-w-5xl">
      {pool.length > 0 && !locked && (
        <div className="mb-4 flex flex-wrap justify-center gap-2">{pool.map((it) => <div key={it.id} className="w-36"><Item it={it} /></div>)}</div>
      )}
      <div className={`grid gap-3 ${q.categories.length >= 4 ? 'grid-cols-2 md:grid-cols-4' : q.categories.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {q.categories.map((c, ci) => (
          <div
            key={c.id} onClick={() => held && drop(c.id, held)}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(c.id, e.dataTransfer.getData('text/plain'))}
            className={`min-h-[180px] rounded-2xl bg-black/25 p-2 ${held ? 'cursor-pointer ring-2 ring-white/40' : ''}`}
          >
            <div className={`opt-${ci % 5} mb-2 rounded-xl py-2 text-center font-game font-bold text-white`}>{c.name}</div>
            <div className="space-y-1.5">{q.items.filter((it) => ans[it.id] === c.id).map((it) => <Item key={it.id} it={it} />)}</div>
          </div>
        ))}
      </div>
      {!result && <SubmitBar onClick={() => onSubmit(ans)} disabled={locked || pool.length > 0} />}
    </div>
  );
}

// ------------------------------------------------------------ hot text
export function HotTextAnswer({ q, onSubmit, result, locked }) {
  const { t } = useTranslation('play');
  const [sel, setSel] = useState([]);
  const correct = result?.reveal?.correct;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 text-center font-game text-sm font-bold text-white/80">{q.selectCount ? t(q.unit === 'sentence' ? 'answers.hottext.sentences' : 'answers.hottext.words', { count: q.selectCount }) : t('answers.hottext.parts')}</div>
      <div className="rounded-2xl bg-white p-5 text-lg leading-9 text-slate-800">
        {q.units.map((u) => {
          const on = sel.includes(u.id);
          const ok = correct?.includes(u.id);
          return (
            <span key={u.id}>
              <button
                disabled={locked} onClick={() => setSel(on ? sel.filter((x) => x !== u.id) : [...sel, u.id])}
                className={`rounded px-0.5 transition ${on ? 'bg-yellow-300' : 'hover:bg-yellow-100'} ${correct && ok ? 'bg-emerald-300 underline decoration-emerald-600 decoration-2' : ''} ${correct && on && !ok ? 'bg-red-300 line-through' : ''}`}
              >{u.text}</button>{' '}
            </span>
          );
        })}
      </div>
      {!result && <SubmitBar onClick={() => onSubmit(sel)} disabled={locked || !sel.length} />}
    </div>
  );
}

// ------------------------------------------------------------ match table grid
export function MatchGridAnswer({ q, onSubmit, result, locked }) {
  const [ans, setAns] = useState({});
  const grid = result?.reveal?.grid;
  const toggle = (r, c) => {
    if (locked) return;
    const cur = ans[r] || [];
    setAns({ ...ans, [r]: q.multi ? (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]) : [c] });
  };
  return (
    <div className="mx-auto max-w-4xl overflow-x-auto rounded-2xl bg-white p-2">
      <table className="w-full font-game text-slate-800">
        <thead><tr className="bg-violet-100"><th className="p-2" />{q.columns.map((c) => <th key={c.id} className="p-2 text-sm">{c.text}</th>)}</tr></thead>
        <tbody>
          {q.rows.map((r) => (
            <tr key={r.id} className="border-t border-slate-100">
              <td className="p-2 font-bold">{r.text}</td>
              {q.columns.map((c) => {
                const on = (ans[r.id] || []).includes(c.id);
                const should = grid && (grid[r.id] || []).includes(c.id);
                return (
                  <td key={c.id} className="p-2 text-center">
                    <button onClick={() => toggle(r.id, c.id)} className={`mx-auto grid h-8 w-8 place-items-center border-2 ${q.multi ? 'rounded-md' : 'rounded-full'} ${on ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300'} ${grid && should ? 'ring-4 ring-emerald-400' : ''} ${grid && on && !should ? 'bg-red-500' : ''}`}>{on && <Check className="h-4 w-4" />}</button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {!result && <SubmitBar onClick={() => onSubmit(ans)} disabled={locked || q.rows.some((r) => !(ans[r.id] || []).length)} />}
    </div>
  );
}

// ------------------------------------------------------------ table fill in
export function TableFillAnswer({ q, onSubmit, result, locked }) {
  const [ans, setAns] = useState({});
  const cells = result?.reveal?.cells;
  const blanks = q.table.rows.flat().filter((c) => c.t === 'blank');
  return (
    <div className="mx-auto max-w-4xl">
      <div className="overflow-x-auto rounded-2xl bg-white p-2">
        <table className="w-full font-game text-slate-800">
          <thead><tr className="bg-violet-100">{q.table.cols.map((c, i) => <th key={i} className="p-2 text-sm">{c}</th>)}</tr></thead>
          <tbody>
            {q.table.rows.map((r, ri) => (
              <tr key={ri} className="border-t border-slate-100">
                {r.map((c, ci) => (
                  <td key={ci} className="p-1.5">
                    {c.t === 'blank' ? (
                      <div>
                        <input value={ans[c.id] || ''} disabled={locked} onChange={(e) => setAns({ ...ans, [c.id]: e.target.value })} className={`w-full rounded-lg border-2 border-dashed border-violet-400 bg-violet-50 px-2 py-1.5 font-bold outline-none ${cells ? ([].concat(cells[c.id] || []).map((x) => String(x).trim().toLowerCase()).includes(String(ans[c.id] || '').trim().toLowerCase()) ? okRing : badRing) : ''}`} />
                        {cells && <div className="text-xs text-emerald-600">✓ {[].concat(cells[c.id] || []).join(' / ')}</div>}
                      </div>
                    ) : <span className="px-2">{c.v}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!result && <SubmitBar onClick={() => onSubmit(ans)} disabled={locked || blanks.some((b) => !String(ans[b.id] || '').trim())} />}
    </div>
  );
}

// ------------------------------------------------------------ labeling
export function LabelingAnswer({ q, onSubmit, result, locked }) {
  const [ans, setAns] = useState({}); // targetId -> {idx,text}
  const [held, setHeld] = useState(null);
  const rv = result?.reveal?.targets;
  const used = new Set(Object.values(ans).map((a) => a.idx));
  const place = (tid, idx) => {
    if (locked || idx === null || Number.isNaN(idx)) return;
    const next = Object.fromEntries(Object.entries(ans).filter(([, v]) => v.idx !== idx));
    next[tid] = { idx, text: q.labels[idx] }; setAns(next); setHeld(null);
  };
  return (
    <div className="mx-auto max-w-4xl">
      <div className="relative overflow-hidden rounded-2xl bg-white">
        <img src={q.image} alt="" className="w-full" draggable={false} />
        {q.targets.map((t, i) => {
          const a = ans[t.id];
          const ok = rv && a && a.text.trim().toLowerCase() === String(rv[t.id]).trim().toLowerCase();
          return (
            <button
              key={t.id} style={{ left: `${t.x}%`, top: `${t.y}%` }}
              onClick={() => (held !== null ? place(t.id, held) : a && !locked && setAns(Object.fromEntries(Object.entries(ans).filter(([k]) => k !== t.id))))}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => place(t.id, Number(e.dataTransfer.getData('text/plain')))}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 px-2 py-1 font-game text-sm font-bold shadow ${a ? 'border-violet-600 bg-violet-600 text-white' : 'border-dashed border-violet-600 bg-white/90 text-violet-700'} ${rv ? (ok ? okRing : badRing) : ''}`}
            >
              {a ? a.text : i + 1}
              {rv && !ok && <span className="block text-[10px] text-emerald-300">{rv[t.id]}</span>}
            </button>
          );
        })}
      </div>
      {!locked && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {q.labels.map((l, i) => (used.has(i) ? null : (
            <button key={i} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', String(i))} onClick={() => setHeld(held === i ? null : i)} className={`${chip} ${held === i ? 'ring-4 ring-yellow-300' : ''}`}>{l}</button>
          )))}
        </div>
      )}
      {!result && <SubmitBar onClick={() => onSubmit(Object.fromEntries(Object.entries(ans).map(([k, v]) => [k, v.text])))} disabled={locked || q.targets.some((t) => !ans[t.id])} />}
    </div>
  );
}

// ------------------------------------------------------------ hotspot
export function HotspotAnswer({ q, onSubmit, result, locked }) {
  const { t } = useTranslation('play');
  const [sel, setSel] = useState([]);
  const correct = result?.reveal?.correct;
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-2 text-center font-game text-sm font-bold text-white/80">{q.selectCount > 1 ? t('answers.hotspot.tapN', { n: q.selectCount }) : t('answers.hotspot.tapOne')}</div>
      <div className="relative overflow-hidden rounded-2xl bg-white">
        <img src={q.image} alt="" className="w-full" draggable={false} />
        {q.regions.map((r) => {
          const on = sel.includes(r.id);
          const ok = correct?.includes(r.id);
          return (
            <button
              key={r.id} disabled={locked} onClick={() => setSel(on ? sel.filter((x) => x !== r.id) : [...sel, r.id])}
              style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}
              className={`absolute rounded-lg border-2 border-dashed transition ${on ? 'border-violet-600 bg-violet-500/40' : 'border-violet-400/70 hover:bg-violet-300/20'} ${correct && ok ? '!border-solid !border-emerald-500 bg-emerald-400/40' : ''} ${correct && on && !ok ? '!border-red-500 bg-red-400/40' : ''}`}
            />
          );
        })}
      </div>
      {!result && <SubmitBar onClick={() => onSubmit(sel)} disabled={locked || !sel.length} />}
    </div>
  );
}

// ------------------------------------------------------------ graphing
export function GraphingAnswer({ q, onSubmit, result, locked }) {
  const { t } = useTranslation('play');
  const [pts, setPts] = useState([]);
  const g = q.graph;
  const toggle = (x, y) => {
    if (locked) return;
    const exists = pts.some((p) => p[0] === x && p[1] === y);
    let next = exists ? pts.filter((p) => !(p[0] === x && p[1] === y)) : [...pts, [x, y]];
    if (g.mode === 'line' && next.length > 2) next = next.slice(-2);
    setPts(next);
  };
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-2 text-center font-game text-sm font-bold text-white/80">{g.mode === 'line' ? t('answers.graphing.line') : q.expected ? t('answers.graphing.plotN', { count: q.expected }) : t('answers.graphing.plot')}</div>
      <div className="rounded-2xl bg-white p-2"><Graph {...g} points={pts} onToggle={locked ? undefined : toggle} correct={result?.reveal?.points} size={460} /></div>
      {!result && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPts([])} disabled={locked} className="mt-4 rounded-xl bg-white/15 px-4 py-3 font-game font-bold text-white"><RotateCcw className="inline h-4 w-4" /> {t('answers.graphing.reset')}</button>
          <SubmitBar onClick={() => onSubmit({ points: pts })} disabled={locked || !pts.length || (g.mode === 'line' && pts.length < 2)} />
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------ draw
const PENS = ['#111827', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7'];

export function DrawAnswer({ q, onSubmit, result, locked, uploadBlob }) {
  const { t } = useTranslation('play');
  const ref = useRef(null);
  const [color, setColor] = useState(PENS[0]);
  const [erase, setErase] = useState(false);
  const [busy, setBusy] = useState(false);
  const drawing = useRef(false);
  useEffect(() => {
    const c = ref.current; const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    if (q.image) {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => { const s = Math.min(c.width / img.width, c.height / img.height); ctx.drawImage(img, (c.width - img.width * s) / 2, (c.height - img.height * s) / 2, img.width * s, img.height * s); };
      img.src = q.image;
    }
  }, [q.image]);
  const pos = (e) => { const r = ref.current.getBoundingClientRect(); const t = e.touches?.[0] || e; return [((t.clientX - r.left) / r.width) * ref.current.width, ((t.clientY - r.top) / r.height) * ref.current.height]; };
  const start = (e) => { if (locked) return; drawing.current = true; const ctx = ref.current.getContext('2d'); const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); };
  const move = (e) => {
    if (!drawing.current) return; e.preventDefault();
    const ctx = ref.current.getContext('2d'); const [x, y] = pos(e);
    ctx.lineTo(x, y); ctx.strokeStyle = erase ? '#fff' : color; ctx.lineWidth = erase ? 24 : 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  };
  const submit = async () => {
    setBusy(true);
    try {
      const blob = await new Promise((r) => ref.current.toBlob(r, 'image/png'));
      const url = uploadBlob ? await uploadBlob(blob, 'drawing.png') : ref.current.toDataURL('image/png');
      onSubmit({ url });
    } finally { setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-3xl">
      {!locked && (
        <div className="mb-2 flex items-center justify-center gap-2">
          {PENS.map((p) => <button key={p} onClick={() => { setColor(p); setErase(false); }} className={`h-8 w-8 rounded-full border-4 ${color === p && !erase ? 'border-white' : 'border-transparent'}`} style={{ background: p }} />)}
          <button onClick={() => setErase(true)} title={t('answers.draw.eraser')} className={`rounded-lg p-2 text-white ${erase ? 'bg-white/30' : 'bg-white/10'}`}><Eraser className="h-5 w-5" /></button>
          <button onClick={() => { const c = ref.current; const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }} title={t('answers.draw.clear')} className="rounded-lg bg-white/10 p-2 text-white"><Trash2 className="h-5 w-5" /></button>
        </div>
      )}
      <canvas
        ref={ref} width={900} height={500}
        onMouseDown={start} onMouseMove={move} onMouseUp={() => { drawing.current = false; }} onMouseLeave={() => { drawing.current = false; }}
        onTouchStart={start} onTouchMove={move} onTouchEnd={() => { drawing.current = false; }}
        className="w-full touch-none rounded-2xl bg-white"
      />
      {!result && <SubmitBar onClick={submit} disabled={locked} busy={busy} />}
    </div>
  );
}

// ------------------------------------------------------------ audio / video recording
export function RecordAnswer({ q, onSubmit, result, locked, uploadBlob }) {
  const { t } = useTranslation('play');
  const video = q.type === 'video';
  const [stream, setStream] = useState(null);
  const [rec, setRec] = useState(null);
  const [blob, setBlob] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [secs, setSecs] = useState(0);
  const live = useRef(null);
  useEffect(() => () => stream?.getTracks().forEach((tr) => tr.stop()), [stream]);
  useEffect(() => { if (live.current && stream) live.current.srcObject = stream; }, [stream]);
  useEffect(() => {
    if (!rec) return undefined;
    const iv = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [rec]);
  const start = async () => {
    setErr(''); setBlob(null); setSecs(0);
    try {
      const s = await navigator.mediaDevices.getUserMedia(video ? { video: true, audio: true } : { audio: true });
      setStream(s);
      const chunks = [];
      const r = new MediaRecorder(s);
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = () => { setBlob(new Blob(chunks, { type: r.mimeType || (video ? 'video/webm' : 'audio/webm') })); s.getTracks().forEach((tr) => tr.stop()); setStream(null); };
      r.start(); setRec(r);
    } catch (e) { setErr(t(video ? 'answers.record.cameraError' : 'answers.record.micError', { msg: e.message })); }
  };
  const stop = () => { rec?.stop(); setRec(null); };
  const submit = async () => {
    setBusy(true);
    try { const url = await uploadBlob(blob, video ? 'answer.webm' : 'answer.webm'); onSubmit({ url, mime: blob.type }); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const blobUrl = blob ? URL.createObjectURL(blob) : null;
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-3">
      <div className="grid aspect-video w-full place-items-center overflow-hidden rounded-2xl bg-black/40">
        {video && stream ? <video ref={live} autoPlay muted playsInline className="h-full w-full object-cover" />
          : blobUrl ? (video ? <video src={blobUrl} controls className="h-full w-full" /> : <audio src={blobUrl} controls />)
            : (video ? <Video className="h-16 w-16 text-white/50" /> : <Mic className="h-16 w-16 text-white/50" />)}
      </div>
      {err && <div className="rounded-lg bg-red-500/80 px-3 py-2 text-sm text-white">{err}</div>}
      {!locked && !result && (
        rec ? (
          <button onClick={stop} className="game-btn flex items-center gap-2 bg-red-500 px-6 py-3 text-white"><Square className="h-5 w-5" />{t('answers.record.stop', { secs })}</button>
        ) : (
          <button onClick={start} className="game-btn flex items-center gap-2 bg-violet-500 px-6 py-3 text-white">{video ? <Video className="h-5 w-5" /> : <Mic className="h-5 w-5" />}{blob ? t('answers.record.again') : t('answers.record.record')}</button>
        )
      )}
      {!result && blob && <SubmitBar onClick={submit} disabled={locked} busy={busy} />}
    </div>
  );
}

// ------------------------------------------------------------ discussion board / word cloud
export function Board({ fetchBoard, type, myId }) {
  const { t } = useTranslation('play');
  const [posts, setPosts] = useState([]);
  useEffect(() => {
    let alive = true;
    const load = () => fetchBoard().then((d) => alive && setPosts(d.posts)).catch(() => {});
    load();
    const iv = setInterval(load, 3000);
    return () => { alive = false; clearInterval(iv); };
  }, [fetchBoard]);
  if (type === 'wordcloud') return <WordCloud words={posts.map((p) => p.text)} />;
  return (
    <div className="mx-auto mt-4 grid max-w-5xl gap-3 sm:grid-cols-2 md:grid-cols-3">
      {posts.map((p, i) => (
        <div key={p.id} className={`rounded-xl p-3 text-slate-800 shadow-lg animate-pop ${['bg-yellow-200', 'bg-pink-200', 'bg-sky-200', 'bg-lime-200', 'bg-orange-200'][i % 5]} ${p.id === myId ? 'ring-4 ring-white' : ''}`}>
          <div className="mb-1 flex items-center gap-2 text-xs font-bold"><Avatar avatar={p.avatar} name={p.name} size={22} />{p.name}</div>
          <div className="whitespace-pre-wrap font-game font-semibold">{p.text}</div>
        </div>
      ))}
      {!posts.length && <div className="col-span-full text-center text-white/60">{t('answers.board.noPosts')}</div>}
    </div>
  );
}

export function WordCloud({ words, dark = true }) {
  const { t } = useTranslation('play');
  const counts = {};
  words.forEach((w) => { const k = String(w || '').trim().toLowerCase(); if (k) counts[k] = (counts[k] || 0) + 1; });
  const list = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 60);
  const max = list[0]?.[1] || 1;
  const colors = dark ? ['#fde047', '#f9a8d4', '#93c5fd', '#86efac', '#fdba74', '#c4b5fd', '#ffffff'] : ['#7c3aed', '#db2777', '#2563eb', '#059669', '#ea580c', '#0891b2'];
  return (
    <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-1 p-4">
      {list.map(([w, n], i) => (
        <span key={w} className="font-game font-bold animate-pop" style={{ fontSize: `${16 + (n / max) * 40}px`, color: colors[i % colors.length] }} title={`${n}`}>{w}</span>
      ))}
      {!list.length && <span className={dark ? 'text-white/60' : 'text-slate-400'}>{t('answers.board.noResponses')}</span>}
    </div>
  );
}

export const ResultIcon = ({ ok }) => (ok ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />);
