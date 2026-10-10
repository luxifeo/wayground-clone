import { useRef, useState } from 'react';
import {
  Trash2, Image as ImageIcon, Check, Plus, ArrowUp, ArrowDown, X, ArrowRight, Info, Upload,
} from 'lucide-react';
import { uploadFile } from '../../lib/api.js';
import { rid, splitBlanks } from '../../lib/constants.js';
import { Toggle, useToast, Spinner } from '../ui.jsx';
import Graph from '../Graph.jsx';

export function useUpload() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const pick = (accept = 'image/*') => new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = accept;
    input.onchange = async () => {
      const f = input.files[0];
      if (!f) return resolve(null);
      setBusy(true);
      try { resolve(await uploadFile(f)); } catch (e) { toast(e.message, 'error'); resolve(null); } finally { setBusy(false); }
    };
    input.click();
  });
  return { pick, busy };
}

const Info2 = ({ children }) => (
  <div className="flex items-start gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs text-white/80"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{children}</div>
);

const darkInput = 'w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:border-white/50';
const addBtn = 'inline-flex items-center gap-1 rounded-lg border border-dashed border-white/40 px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/10';

// ------------------------------------------------------------ choice (mcq/msq/poll/tf)
export function ChoiceBody({ q, set }) {
  const { pick } = useUpload();
  const isTF = q.type === 'tf';
  const graded = q.type !== 'poll';
  const multi = q.type === 'msq';
  const setOpt = (i, patch) => set({ options: q.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const toggleCorrect = (id) => {
    if (!graded) return;
    if (multi) set({ answer: q.answer.includes(id) ? q.answer.filter((a) => a !== id) : [...q.answer, id] });
    else set({ answer: [id] });
  };
  return (
    <div>
      <div className="flex gap-2">
        <div className={`grid flex-1 gap-2 ${isTF ? 'grid-cols-2' : q.options.length >= 5 ? 'grid-cols-5' : q.options.length === 4 ? 'grid-cols-4' : q.options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {q.options.map((o, i) => {
            const correct = (q.answer || []).includes(o.id);
            return (
              <div key={o.id} className={`edit-${isTF ? (i === 0 ? 0 : 3) : i} relative flex min-h-[170px] flex-col rounded-lg p-2 ${correct ? 'ring-4 ring-emerald-400' : ''}`}>
                <div className="flex items-center gap-1">
                  {!isTF && q.options.length > 2 && (
                    <button title="Delete option" onClick={() => set({ options: q.options.filter((_, j) => j !== i), answer: (q.answer || []).filter((a) => a !== o.id) })} className="rounded bg-white/20 p-1 text-white hover:bg-white/30"><Trash2 className="h-3.5 w-3.5" /></button>
                  )}
                  {!isTF && (
                    <button title="Add image" onClick={async () => { const url = await pick(); if (url) setOpt(i, { image: url }); }} className="rounded bg-white/20 p-1 text-white hover:bg-white/30"><ImageIcon className="h-3.5 w-3.5" /></button>
                  )}
                  {graded && (
                    <button
                      title="Mark as correct" onClick={() => toggleCorrect(o.id)}
                      className={`ml-auto grid h-6 w-6 place-items-center rounded-full border-2 ${correct ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-white/70 text-white/70 hover:bg-white/20'}`}
                    ><Check className="h-3.5 w-3.5" /></button>
                  )}
                </div>
                {o.image && (
                  <div className="relative mx-auto mt-1">
                    <img src={o.image} alt="" className="max-h-20 rounded" />
                    <button onClick={() => setOpt(i, { image: null })} className="absolute -right-2 -top-2 rounded-full bg-black/60 p-0.5 text-white"><X className="h-3 w-3" /></button>
                  </div>
                )}
                {isTF ? (
                  <button onClick={() => toggleCorrect(o.id)} className="flex flex-1 items-center justify-center text-2xl font-bold text-white">{o.text}</button>
                ) : (
                  <textarea
                    value={o.text} onChange={(e) => setOpt(i, { text: e.target.value })}
                    placeholder="Type answer option here"
                    className="mt-1 flex-1 resize-none bg-transparent text-center text-lg text-white placeholder-white/60 outline-none"
                  />
                )}
              </div>
            );
          })}
        </div>
        {!isTF && q.options.length < 5 && (
          <button title="Add option" onClick={() => set({ options: [...q.options, { id: rid(), text: '' }] })} className="self-center rounded-lg bg-white/15 p-2 text-white hover:bg-white/25"><Plus className="h-4 w-4" /></button>
        )}
      </div>
      {(q.type === 'mcq' || q.type === 'msq') && (
        <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-white">
          Multiple correct answers:
          <Toggle checked={multi} onChange={(v) => set({ type: v ? 'msq' : 'mcq', answer: v ? q.answer : (q.answer || []).slice(0, 1) })} />
        </div>
      )}
      {q.type === 'poll' && <div className="mt-3"><Info2>Polls are not graded. Students see how the class voted.</Info2></div>}
    </div>
  );
}

// ------------------------------------------------------------ fill / math
export function FillBody({ q, set }) {
  const acc = q.answer?.accepted?.length ? q.answer.accepted : [''];
  const setAcc = (list) => set({ answer: { ...q.answer, accepted: list } });
  const isMath = q.type === 'math';
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-white">{isMath ? 'Correct expression(s)' : 'Correct answer(s)'}</div>
      <div className="flex flex-wrap gap-2">
        {acc.map((a, i) => (
          <div key={i} className="flex items-center gap-1 rounded-lg bg-emerald-600 p-1.5">
            <input
              value={a} onChange={(e) => setAcc(acc.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={isMath ? 'e.g. 2x+6' : i === 0 ? 'Type the answer' : 'Alternative answer'}
              className={`w-52 rounded bg-white/15 px-2 py-1.5 text-white placeholder-white/60 outline-none ${isMath ? 'font-mono' : ''}`}
            />
            {acc.length > 1 && <button onClick={() => setAcc(acc.filter((_, j) => j !== i))} className="p-1 text-white/80"><X className="h-4 w-4" /></button>}
          </div>
        ))}
        <button onClick={() => setAcc([...acc, ''])} className={addBtn}><Plus className="h-3.5 w-3.5" />Add {isMath ? 'another form' : 'alternative'}</button>
      </div>
      {isMath ? (
        <div className="flex items-center gap-2 text-sm text-white">
          <Toggle checked={!q.extra?.exact} onChange={(v) => set({ extra: { ...q.extra, exact: !v } })} />
          Accept mathematically equivalent answers (e.g. <code className="rounded bg-black/30 px-1">2(x+3)</code> = <code className="rounded bg-black/30 px-1">2x+6</code>)
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-white">
          <Toggle checked={!!q.extra?.caseSensitive} onChange={(v) => set({ extra: { ...q.extra, caseSensitive: v } })} />Case sensitive
        </div>
      )}
      {isMath && <Info2>Students type with an on-screen math keypad. Supports + − × ÷ ^ √, parentheses, variables and π.</Info2>}
    </div>
  );
}

// ------------------------------------------------------------ open & media types
export function OpenBody({ q, set }) {
  const notes = {
    open: 'Students type a free response. Grade it in the report — manually or with AI using the sample answer.',
    draw: 'Students get a drawing canvas (with your question image as background if you add one).',
    video: 'Students record a short video with their camera. Review it in the report.',
    audio: 'Students record a spoken answer with their microphone. Review it in the report.',
    wordcloud: 'Students submit short words or phrases. Responses build a live word cloud.',
    discussion: 'Students post ideas to a shared board and can read each other’s posts in real time.',
  };
  return (
    <div className="space-y-3">
      <Info2>{notes[q.type]}</Info2>
      {q.type === 'open' && (
        <div>
          <div className="mb-1 text-sm font-semibold text-white">Sample answer (optional, used for AI grading)</div>
          <textarea value={q.answer?.sample || ''} onChange={(e) => set({ answer: { sample: e.target.value } })} className={`${darkInput} min-h-[90px]`} placeholder="A model answer…" />
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------ reorder
export function ReorderBody({ q, set }) {
  const move = (i, d) => {
    const o = [...q.options]; const j = i + d;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]]; set({ options: o });
  };
  return (
    <div className="space-y-2">
      <Info2>Enter the items in the correct order. Students will see them shuffled.</Info2>
      {q.options.map((o, i) => (
        <div key={o.id} className={`edit-${i % 5} flex items-center gap-2 rounded-lg p-2`}>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-white/25 text-sm font-bold text-white">{i + 1}</span>
          <input value={o.text} onChange={(e) => set({ options: q.options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} placeholder="Type an item" className="flex-1 bg-transparent text-white placeholder-white/60 outline-none" />
          <button onClick={() => move(i, -1)} className="p-1 text-white/80 hover:text-white"><ArrowUp className="h-4 w-4" /></button>
          <button onClick={() => move(i, 1)} className="p-1 text-white/80 hover:text-white"><ArrowDown className="h-4 w-4" /></button>
          {q.options.length > 2 && <button onClick={() => set({ options: q.options.filter((_, j) => j !== i) })} className="p-1 text-white/80 hover:text-white"><Trash2 className="h-4 w-4" /></button>}
        </div>
      ))}
      {q.options.length < 8 && <button onClick={() => set({ options: [...q.options, { id: rid(), text: '' }] })} className={addBtn}><Plus className="h-3.5 w-3.5" />Add item</button>}
    </div>
  );
}

// ------------------------------------------------------------ match
export function MatchBody({ q, set }) {
  const setP = (i, patch) => set({ options: q.options.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="space-y-2">
      <Info2>Each row is a correct pair. Students see the right column shuffled.</Info2>
      {q.options.map((p, i) => (
        <div key={p.id} className="flex items-center gap-2">
          <input value={p.left} onChange={(e) => setP(i, { left: e.target.value })} placeholder="Item" className="edit-0 flex-1 rounded-lg px-3 py-3 text-white placeholder-white/60 outline-none" />
          <ArrowRight className="h-5 w-5 shrink-0 text-white/70" />
          <input value={p.right} onChange={(e) => setP(i, { right: e.target.value })} placeholder="Matching item" className="edit-2 flex-1 rounded-lg px-3 py-3 text-white placeholder-white/70 outline-none" />
          {q.options.length > 2 && <button onClick={() => set({ options: q.options.filter((_, j) => j !== i) })} className="p-1 text-white/80"><Trash2 className="h-4 w-4" /></button>}
        </div>
      ))}
      {q.options.length < 8 && <button onClick={() => set({ options: [...q.options, { id: rid(), left: '', right: '' }] })} className={addBtn}><Plus className="h-3.5 w-3.5" />Add pair</button>}
    </div>
  );
}

// ------------------------------------------------------------ blanks (dropdown / dragdrop)
function nextBlankId(text) {
  const used = new Set(splitBlanks(text).filter((p) => p.t === 'blank').map((p) => p.id));
  let n = 1; while (used.has(`b${n}`)) n++;
  return `b${n}`;
}

export function BlankText({ q, set, textRef }) {
  const insert = () => {
    const id = nextBlankId(q.text);
    const el = textRef.current;
    const pos = el ? el.selectionStart : q.text.length;
    const text = `${q.text.slice(0, pos)}[[${id}]]${q.text.slice(pos)}`;
    const opt = q.type === 'dropdown' ? { id, choices: [{ id: rid(), text: '' }, { id: rid(), text: '' }], correct: null } : { id, answer: '' };
    set({ text, options: [...q.options, opt] });
  };
  return (
    <div className="mt-2 flex items-center justify-between gap-2">
      <span className="text-xs text-white/60">Blanks appear as <code className="rounded bg-black/30 px-1">[[b1]]</code> in the text.</span>
      <button onClick={insert} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-50"><Plus className="mr-1 inline h-3.5 w-3.5" />Insert blank</button>
    </div>
  );
}

export function DropdownBody({ q, set }) {
  const ids = splitBlanks(q.text).filter((p) => p.t === 'blank').map((p) => p.id);
  const byId = new Map(q.options.map((b) => [b.id, b]));
  const blanks = ids.map((id) => byId.get(id) || { id, choices: [{ id: rid(), text: '' }], correct: null });
  const setB = (id, patch) => set({ options: blanks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  if (!blanks.length) return <Info2>Insert at least one blank into the question text.</Info2>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {blanks.map((b, k) => (
        <div key={b.id} className="rounded-lg bg-black/20 p-3">
          <div className="mb-2 text-xs font-bold uppercase text-white/70">Blank {k + 1} <code className="ml-1 normal-case text-white/50">[[{b.id}]]</code></div>
          {b.choices.map((c, i) => (
            <div key={c.id} className="mb-1.5 flex items-center gap-2">
              <button title="Correct" onClick={() => setB(b.id, { correct: c.id })} className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${b.correct === c.id ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-white/50 text-transparent'}`}><Check className="h-3.5 w-3.5" /></button>
              <input value={c.text} onChange={(e) => setB(b.id, { choices: b.choices.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} placeholder={`Option ${i + 1}`} className={darkInput} />
              {b.choices.length > 1 && <button onClick={() => setB(b.id, { choices: b.choices.filter((_, j) => j !== i) })} className="text-white/70"><X className="h-4 w-4" /></button>}
            </div>
          ))}
          <button onClick={() => setB(b.id, { choices: [...b.choices, { id: rid(), text: '' }] })} className={addBtn}><Plus className="h-3.5 w-3.5" />Add option</button>
        </div>
      ))}
    </div>
  );
}

export function ChipsInput({ values, onChange, placeholder }) {
  const [v, setV] = useState('');
  const add = () => { const t = v.trim(); if (t) { onChange([...(values || []), t]); setV(''); } };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/15 bg-black/25 p-1.5">
      {(values || []).map((x, i) => (
        <span key={i} className="flex items-center gap-1 rounded bg-white/90 px-2 py-0.5 text-sm font-semibold text-slate-700">
          {x}<button onClick={() => onChange(values.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
        </span>
      ))}
      <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} onBlur={add} placeholder={placeholder} className="min-w-[140px] flex-1 bg-transparent px-1 text-sm text-white placeholder-white/40 outline-none" />
    </div>
  );
}

export function DragDropBody({ q, set }) {
  const ids = splitBlanks(q.text).filter((p) => p.t === 'blank').map((p) => p.id);
  const byId = new Map(q.options.map((b) => [b.id, b]));
  const blanks = ids.map((id) => byId.get(id) || { id, answer: '' });
  return (
    <div className="space-y-3">
      {!blanks.length && <Info2>Insert at least one blank into the question text.</Info2>}
      <div className="grid gap-2 md:grid-cols-3">
        {blanks.map((b, k) => (
          <div key={b.id} className="rounded-lg bg-emerald-700/60 p-2">
            <div className="mb-1 text-[11px] font-bold uppercase text-white/70">Blank {k + 1}</div>
            <input value={b.answer} onChange={(e) => set({ options: blanks.map((x) => (x.id === b.id ? { ...x, answer: e.target.value } : x)) })} placeholder="Correct item" className={darkInput} />
          </div>
        ))}
      </div>
      <div>
        <div className="mb-1 text-sm font-semibold text-white">Distractors (extra wrong items)</div>
        <ChipsInput values={q.extra?.distractors || []} onChange={(d) => set({ extra: { ...q.extra, distractors: d } })} placeholder="Type and press Enter" />
      </div>
    </div>
  );
}

// ------------------------------------------------------------ categorize
export function CategorizeBody({ q, set }) {
  const cats = q.extra?.categories || [];
  const setCats = (c) => set({ extra: { ...q.extra, categories: c } });
  const setItem = (id, patch) => set({ options: q.options.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  return (
    <div>
      <div className={`grid gap-3 ${cats.length >= 4 ? 'md:grid-cols-4' : cats.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        {cats.map((c, ci) => (
          <div key={c.id} className="flex flex-col rounded-lg bg-black/20 p-2">
            <div className={`edit-${ci % 5} mb-2 flex items-center gap-1 rounded-md px-2 py-1.5`}>
              <input value={c.name} onChange={(e) => setCats(cats.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))} placeholder={`Group ${ci + 1}`} className="flex-1 bg-transparent font-bold text-white placeholder-white/70 outline-none" />
              {cats.length > 2 && <button onClick={() => { setCats(cats.filter((x) => x.id !== c.id)); set({ options: q.options.filter((i) => i.cat !== c.id) }); }} className="text-white/80"><Trash2 className="h-4 w-4" /></button>}
            </div>
            {q.options.filter((i) => i.cat === c.id).map((it) => (
              <div key={it.id} className="mb-1.5 flex items-center gap-1">
                <input value={it.text} onChange={(e) => setItem(it.id, { text: e.target.value })} placeholder="Item" className={darkInput} />
                <button onClick={() => set({ options: q.options.filter((x) => x.id !== it.id) })} className="text-white/70"><X className="h-4 w-4" /></button>
              </div>
            ))}
            <button onClick={() => set({ options: [...q.options, { id: rid(), text: '', cat: c.id }] })} className={`${addBtn} mt-auto justify-center`}><Plus className="h-3.5 w-3.5" />Add item</button>
          </div>
        ))}
      </div>
      {cats.length < 5 && <button onClick={() => setCats([...cats, { id: rid(), name: '' }])} className={`${addBtn} mt-3`}><Plus className="h-3.5 w-3.5" />Add group</button>}
    </div>
  );
}

// ------------------------------------------------------------ hot text
export function tokenizeHot(source, unit) {
  const s = String(source || '').trim();
  if (!s) return [];
  const parts = unit === 'sentence' ? s.split(/(?<=[.!?])\s+/) : s.split(/\s+/);
  return parts.filter(Boolean).map((t, i) => ({ id: `u${i}`, text: t }));
}

export function HotTextBody({ q, set }) {
  const unit = q.extra?.unit || 'word';
  const units = q.options || [];
  const update = (source, u = unit) => {
    const nu = tokenizeHot(source, u);
    const keep = new Set(nu.map((x) => x.id));
    set({ extra: { ...q.extra, source, unit: u }, options: nu, answer: u === unit ? (q.answer || []).filter((a) => keep.has(a)) : [] });
  };
  const toggle = (id) => set({ answer: q.answer.includes(id) ? q.answer.filter((a) => a !== id) : [...q.answer, id] });
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex items-center justify-between text-sm font-semibold text-white">
          Text
          <span className="flex gap-1 rounded-lg bg-black/30 p-0.5 text-xs">
            {['word', 'sentence'].map((u) => <button key={u} onClick={() => update(q.extra?.source || '', u)} className={`rounded-md px-2 py-1 capitalize ${unit === u ? 'bg-white text-violet-700' : 'text-white/80'}`}>{u}s</button>)}
          </span>
        </div>
        <textarea value={q.extra?.source || ''} onChange={(e) => update(e.target.value)} className={`${darkInput} min-h-[90px]`} placeholder="Paste or type the passage students will highlight in…" />
      </div>
      {units.length > 0 && (
        <div>
          <div className="mb-1 text-sm font-semibold text-white">Click the correct {unit}s</div>
          <div className="rounded-lg bg-white p-3 leading-8 text-slate-800">
            {units.map((u) => (
              <span key={u.id}>
                <button onClick={() => toggle(u.id)} className={`rounded px-0.5 ${q.answer.includes(u.id) ? 'bg-emerald-300' : 'hover:bg-yellow-100'}`}>{u.text}</button>{' '}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------ match table grid
export function MatchGridBody({ q, set }) {
  const cols = q.extra?.columns || [];
  const multi = !!q.extra?.multi;
  const ans = q.answer || {};
  const setCols = (c) => set({ extra: { ...q.extra, columns: c } });
  const toggle = (rowId, colId) => {
    const cur = ans[rowId] || [];
    const next = multi ? (cur.includes(colId) ? cur.filter((c) => c !== colId) : [...cur, colId]) : [colId];
    set({ answer: { ...ans, [rowId]: next } });
  };
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="w-48 p-2" />
              {cols.map((c, i) => (
                <th key={c.id} className="p-1.5">
                  <div className="flex items-center gap-1">
                    <input value={c.text} onChange={(e) => setCols(cols.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))} placeholder={`Column ${i + 1}`} className="input py-1 text-center" />
                    {cols.length > 2 && <button onClick={() => setCols(cols.filter((x) => x.id !== c.id))} className="text-slate-400"><X className="h-4 w-4" /></button>}
                  </div>
                </th>
              ))}
              <th className="w-10 p-1">{cols.length < 6 && <button onClick={() => setCols([...cols, { id: rid(), text: '' }])} className="rounded bg-violet-100 p-1 text-violet-700"><Plus className="h-4 w-4" /></button>}</th>
            </tr>
          </thead>
          <tbody>
            {q.options.map((r, ri) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="p-1.5"><input value={r.text} onChange={(e) => set({ options: q.options.map((x) => (x.id === r.id ? { ...x, text: e.target.value } : x)) })} placeholder={`Row ${ri + 1}`} className="input py-1" /></td>
                {cols.map((c) => {
                  const on = (ans[r.id] || []).includes(c.id);
                  return (
                    <td key={c.id} className="p-1.5 text-center">
                      <button onClick={() => toggle(r.id, c.id)} className={`mx-auto grid h-6 w-6 place-items-center border-2 ${multi ? 'rounded' : 'rounded-full'} ${on ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-transparent'}`}><Check className="h-3.5 w-3.5" /></button>
                    </td>
                  );
                })}
                <td className="p-1 text-center">{q.options.length > 1 && <button onClick={() => set({ options: q.options.filter((x) => x.id !== r.id) })} className="text-slate-400"><Trash2 className="h-4 w-4" /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-4">
        <button onClick={() => set({ options: [...q.options, { id: rid(), text: '' }] })} className={addBtn}><Plus className="h-3.5 w-3.5" />Add row</button>
        <label className="flex items-center gap-2 text-sm text-white"><Toggle checked={multi} onChange={(v) => set({ extra: { ...q.extra, multi: v } })} />Allow multiple columns per row</label>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ table fill in
export function TableFillBody({ q, set }) {
  const t = q.extra?.table || { cols: ['', ''], rows: [] };
  const setT = (nt) => set({ extra: { ...q.extra, table: nt } });
  const setCell = (ri, ci, cell) => setT({ ...t, rows: t.rows.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? cell : c)) : r)) });
  return (
    <div className="space-y-3">
      <Info2>Type values in the cells. Click <b>⬚</b> to turn a cell into a blank students must fill. Separate alternative answers with <code>|</code>.</Info2>
      <div className="overflow-x-auto rounded-lg bg-white p-1">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {t.cols.map((c, ci) => (
                <th key={ci} className="p-1">
                  <div className="flex items-center gap-1">
                    <input value={c} onChange={(e) => setT({ ...t, cols: t.cols.map((x, j) => (j === ci ? e.target.value : x)) })} placeholder={`Header ${ci + 1}`} className="input bg-slate-100 py-1 font-bold" />
                    {t.cols.length > 1 && <button onClick={() => setT({ cols: t.cols.filter((_, j) => j !== ci), rows: t.rows.map((r) => r.filter((_, j) => j !== ci)) })} className="text-slate-400"><X className="h-4 w-4" /></button>}
                  </div>
                </th>
              ))}
              <th className="w-10">{t.cols.length < 6 && <button onClick={() => setT({ cols: [...t.cols, ''], rows: t.rows.map((r) => [...r, { t: 'text', v: '' }]) })} className="rounded bg-violet-100 p-1 text-violet-700"><Plus className="h-4 w-4" /></button>}</th>
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => (
                  <td key={ci} className="p-1">
                    <div className={`flex items-center gap-1 rounded-lg ${c.t === 'blank' ? 'bg-emerald-50 ring-1 ring-emerald-400' : ''}`}>
                      <input
                        value={c.t === 'blank' ? (c.accepted || []).join(' | ') : c.v}
                        onChange={(e) => setCell(ri, ci, c.t === 'blank' ? { ...c, accepted: e.target.value.split('|').map((s) => s.trimStart()) } : { ...c, v: e.target.value })}
                        placeholder={c.t === 'blank' ? 'Correct answer' : 'Text'}
                        className={`w-full rounded-lg bg-transparent px-2 py-1.5 outline-none ${c.t === 'blank' ? 'font-semibold text-emerald-700' : ''}`}
                      />
                      <button
                        title={c.t === 'blank' ? 'Make it a text cell' : 'Make it a blank'}
                        onClick={() => setCell(ri, ci, c.t === 'blank' ? { t: 'text', v: (c.accepted || [])[0] || '' } : { t: 'blank', id: rid(), accepted: [c.v || ''] })}
                        className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-bold ${c.t === 'blank' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}
                      >⬚</button>
                    </div>
                  </td>
                ))}
                <td className="text-center">{t.rows.length > 1 && <button onClick={() => setT({ ...t, rows: t.rows.filter((_, i) => i !== ri) })} className="text-slate-400"><Trash2 className="h-4 w-4" /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={() => setT({ ...t, rows: [...t.rows, t.cols.map(() => ({ t: 'text', v: '' }))] })} className={addBtn}><Plus className="h-3.5 w-3.5" />Add row</button>
    </div>
  );
}

// ------------------------------------------------------------ image based (labeling / hotspot)
function ImageRequired({ set }) {
  const { pick, busy } = useUpload();
  return (
    <button onClick={async () => { const url = await pick(); if (url) set({ image: url }); }} className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-white/40 py-10 text-white hover:bg-white/10">
      {busy ? <Spinner /> : <Upload className="h-7 w-7" />}
      <span className="font-semibold">Upload an image</span>
      <span className="text-xs text-white/60">A diagram, map, photo or chart</span>
    </button>
  );
}

export function LabelingBody({ q, set }) {
  if (!q.image) return <ImageRequired q={q} set={set} />;
  const add = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10;
    const y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
    set({ options: [...q.options, { id: rid(), text: '', x, y }] });
  };
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_260px]">
      <div>
        <div className="relative inline-block w-full cursor-crosshair overflow-hidden rounded-lg bg-white" onClick={add}>
          <img src={q.image} alt="" className="w-full select-none" draggable={false} />
          {q.options.map((t, i) => (
            <span key={t.id} className="absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-violet-600 text-xs font-bold text-white shadow" style={{ left: `${t.x}%`, top: `${t.y}%` }}>{i + 1}</span>
          ))}
        </div>
        <p className="mt-1 text-xs text-white/70">Click on the image to add a label position.</p>
      </div>
      <div className="space-y-2">
        {q.options.map((t, i) => (
          <div key={t.id} className="flex items-center gap-1.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-violet-600 text-xs font-bold text-white">{i + 1}</span>
            <input value={t.text} onChange={(e) => set({ options: q.options.map((x) => (x.id === t.id ? { ...x, text: e.target.value } : x)) })} placeholder="Label" className={darkInput} />
            <button onClick={() => set({ options: q.options.filter((x) => x.id !== t.id) })} className="text-white/70"><X className="h-4 w-4" /></button>
          </div>
        ))}
        <div className="pt-2 text-xs font-semibold text-white">Distractor labels</div>
        <ChipsInput values={q.extra?.distractors || []} onChange={(d) => set({ extra: { ...q.extra, distractors: d } })} placeholder="Wrong label + Enter" />
        <button onClick={() => set({ image: null, options: [] })} className="text-xs text-white/60 underline">Change image</button>
      </div>
    </div>
  );
}

export function HotspotBody({ q, set }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(null);
  if (!q.image) return <ImageRequired q={q} set={set} />;
  const pos = (e) => {
    const r = ref.current.getBoundingClientRect();
    return { x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)), y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)) };
  };
  const finish = () => {
    if (!drag) return;
    const x = Math.min(drag.x0, drag.x1); const y = Math.min(drag.y0, drag.y1);
    const w = Math.abs(drag.x1 - drag.x0); const h = Math.abs(drag.y1 - drag.y0);
    setDrag(null);
    if (w < 2 || h < 2) return;
    const id = rid();
    set({ options: [...q.options, { id, x: +x.toFixed(1), y: +y.toFixed(1), w: +w.toFixed(1), h: +h.toFixed(1) }], answer: [...(q.answer || []), id] });
  };
  const toggle = (id) => set({ answer: q.answer.includes(id) ? q.answer.filter((a) => a !== id) : [...q.answer, id] });
  return (
    <div>
      <div
        ref={ref} className="relative w-full cursor-crosshair select-none overflow-hidden rounded-lg bg-white"
        onMouseDown={(e) => { if (e.target.dataset.region) return; const p = pos(e); setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y }); }}
        onMouseMove={(e) => drag && setDrag({ ...drag, ...(({ x, y }) => ({ x1: x, y1: y }))(pos(e)) })}
        onMouseUp={finish} onMouseLeave={finish}
      >
        <img src={q.image} alt="" className="w-full" draggable={false} />
        {q.options.map((r, i) => {
          const ok = q.answer.includes(r.id);
          return (
            <div
              key={r.id} data-region="1" onClick={() => toggle(r.id)}
              className={`absolute cursor-pointer rounded-md border-2 border-dashed ${ok ? 'border-emerald-500 bg-emerald-400/30' : 'border-slate-500 bg-slate-400/20'}`}
              style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}
            >
              <span data-region="1" className="absolute -left-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-slate-800 text-[10px] font-bold text-white">{i + 1}</span>
              <button data-region="1" onClick={(e) => { e.stopPropagation(); set({ options: q.options.filter((x) => x.id !== r.id), answer: q.answer.filter((a) => a !== r.id) }); }} className="absolute -right-2 -top-2 rounded-full bg-red-500 p-0.5 text-white"><X data-region="1" className="h-3 w-3" /></button>
            </div>
          );
        })}
        {drag && (
          <div className="absolute border-2 border-violet-600 bg-violet-400/20" style={{ left: `${Math.min(drag.x0, drag.x1)}%`, top: `${Math.min(drag.y0, drag.y1)}%`, width: `${Math.abs(drag.x1 - drag.x0)}%`, height: `${Math.abs(drag.y1 - drag.y0)}%` }} />
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-white/70">
        <span>Drag on the image to draw a clickable area. Click an area to toggle correct (<span className="font-bold text-emerald-300">green</span>) or distractor (gray).</span>
        <button onClick={() => set({ image: null, options: [], answer: [] })} className="underline">Change image</button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ graphing
export function GraphingBody({ q, set }) {
  const ex = q.extra || {};
  const pts = q.answer?.points || [];
  const toggle = (x, y) => {
    const exists = pts.some((p) => p[0] === x && p[1] === y);
    let next = exists ? pts.filter((p) => !(p[0] === x && p[1] === y)) : [...pts, [x, y]];
    if (ex.mode === 'line' && next.length > 2) next = next.slice(-2);
    set({ answer: { points: next } });
  };
  const setEx = (patch) => set({ extra: { ...ex, ...patch } });
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_220px]">
      <div className="rounded-lg bg-white p-2"><Graph {...ex} points={pts} onToggle={toggle} size={420} /></div>
      <div className="space-y-3 text-sm text-white">
        <div>
          <div className="mb-1 font-semibold">Students must plot</div>
          <div className="flex gap-1 rounded-lg bg-black/30 p-0.5 text-xs">
            {[['points', 'Points'], ['line', 'A line']].map(([m, l]) => <button key={m} onClick={() => { setEx({ mode: m }); if (m === 'line') set({ extra: { ...ex, mode: m }, answer: { points: pts.slice(-2) } }); }} className={`flex-1 rounded-md px-2 py-1.5 ${ex.mode === m ? 'bg-white text-violet-700' : ''}`}>{l}</button>)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[['xmin', 'X min'], ['xmax', 'X max'], ['ymin', 'Y min'], ['ymax', 'Y max']].map(([k, l]) => (
            <label key={k} className="text-xs">{l}<input type="number" value={ex[k]} onChange={(e) => setEx({ [k]: Number(e.target.value) })} className={darkInput} /></label>
          ))}
        </div>
        <Info2>Click the grid to place the correct {ex.mode === 'line' ? 'two points of the line' : 'points'}. Correct answer: {pts.map((p) => `(${p[0]}, ${p[1]})`).join(', ') || 'none yet'}</Info2>
      </div>
    </div>
  );
}
