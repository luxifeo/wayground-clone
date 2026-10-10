import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft, Save, Clock, Check, Image as ImageIcon, Lightbulb, Sparkles, FileText, X, Eye, ChevronDown,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { QTYPES, TIME_OPTIONS, fmtTime, blankQuestion, CHOICE_TYPES, splitBlanks } from '../../lib/constants.js';
import { Menu, MenuItem, Spinner, useToast } from '../ui.jsx';
import {
  ChoiceBody, FillBody, OpenBody, ReorderBody, MatchBody, DropdownBody, DragDropBody, BlankText, CategorizeBody,
  HotTextBody, MatchGridBody, TableFillBody, LabelingBody, HotspotBody, GraphingBody, useUpload,
} from './bodies.jsx';
import QuestionPlayer from '../play/QuestionPlayer.jsx';

const BODIES = {
  mcq: ChoiceBody, msq: ChoiceBody, tf: ChoiceBody, poll: ChoiceBody,
  fill: FillBody, math: FillBody,
  open: OpenBody, draw: OpenBody, video: OpenBody, audio: OpenBody, wordcloud: OpenBody, discussion: OpenBody,
  reorder: ReorderBody, match: MatchBody, dropdown: DropdownBody, dragdrop: DragDropBody, categorize: CategorizeBody,
  hottext: HotTextBody, matchgrid: MatchGridBody, tablefill: TableFillBody, labeling: LabelingBody, hotspot: HotspotBody,
  graphing: GraphingBody,
};

const PLACEHOLDER = {
  dropdown: 'Type your sentence and insert blanks, e.g. “The sky is [[b1]].”',
  dragdrop: 'Type your sentence and insert blanks, e.g. “23 × 2 = [[b1]]”',
  hottext: 'Instructions, e.g. “Select the main idea”',
  tablefill: 'Instructions, e.g. “Complete the table”',
  labeling: 'Instructions, e.g. “Label the parts of the plant”',
  hotspot: 'e.g. “Click on the capital city”',
  graphing: 'e.g. “Plot the line y = 2x + 1”',
};

/** Client-side check mirroring the server's publish rules. */
export function draftProblems(q) {
  const p = [];
  const plain = String(q.text || '').replace(/\[\[[^\]]+\]\]/g, '').trim();
  if (!plain && !q.image && !['hottext', 'tablefill'].includes(q.type)) p.push('Type the question');
  const o = q.options || [];
  if (['mcq', 'msq', 'poll'].includes(q.type) && o.filter((x) => x.text.trim() || x.image).length < 2) p.push('Add at least 2 answer options');
  if (['mcq', 'msq', 'poll'].includes(q.type) && o.some((x) => !x.text.trim() && !x.image)) p.push('Fill in or delete the empty options');
  if (['mcq', 'msq'].includes(q.type) && !(q.answer || []).length) p.push('Mark the correct answer');
  if (['fill', 'math'].includes(q.type) && !(q.answer?.accepted || []).some((a) => a.trim())) p.push('Add the correct answer');
  if (q.type === 'reorder' && o.filter((x) => x.text.trim()).length < 2) p.push('Add at least 2 items');
  if (q.type === 'match' && o.some((x) => !x.left.trim() || !x.right.trim())) p.push('Complete or delete the empty pairs');
  if (q.type === 'dropdown') {
    if (!o.length) p.push('Insert at least one blank');
    if (o.some((b) => !b.correct || b.choices.some((c) => !c.text.trim()))) p.push('Every dropdown needs filled options and a correct one');
  }
  if (q.type === 'dragdrop' && (!o.length || o.some((b) => !b.answer.trim()))) p.push('Every blank needs a correct item');
  if (q.type === 'categorize' && ((q.extra?.categories || []).some((c) => !c.name.trim()) || o.filter((i) => i.text.trim()).length < 2)) p.push('Name every group and add at least 2 items');
  if (q.type === 'hottext' && !(q.answer || []).length) p.push('Select the correct parts of the text');
  if (q.type === 'matchgrid' && o.some((r) => !(q.answer?.[r.id] || []).length)) p.push('Mark the correct column for every row');
  if (q.type === 'tablefill' && !(q.extra?.table?.rows || []).flat().some((c) => c.t === 'blank' && (c.accepted || []).some((a) => a.trim()))) p.push('Make at least one cell a blank with an answer');
  if (['labeling', 'hotspot'].includes(q.type) && !q.image) p.push('Upload an image');
  if (q.type === 'labeling' && (o.length < 2 || o.some((t) => !t.text.trim()))) p.push('Add at least 2 named labels');
  if (q.type === 'hotspot' && !(q.answer || []).length) p.push('Draw at least one correct area');
  if (q.type === 'graphing' && !(q.answer?.points || []).length) p.push('Plot the correct answer');
  return p;
}

function cleanForSave(q) {
  const out = { ...q };
  if (['mcq', 'msq', 'poll', 'reorder'].includes(q.type)) out.options = q.options.filter((o) => o.text.trim() || o.image);
  if (q.type === 'match') out.options = q.options.filter((o) => o.left.trim() || o.right.trim());
  if (['fill', 'math'].includes(q.type)) out.answer = { accepted: (q.answer?.accepted || []).map((a) => a.trim()).filter(Boolean) };
  if (q.type === 'categorize') out.options = q.options.filter((i) => i.text.trim());
  if (q.type === 'tablefill') {
    out.extra = { ...q.extra, table: { ...q.extra.table, rows: q.extra.table.rows.map((r) => r.map((c) => (c.t === 'blank' ? { ...c, accepted: (c.accepted || []).map((a) => a.trim()).filter(Boolean) } : c))) } };
  }
  return out;
}

function convertType(q, type) {
  if (CHOICE_TYPES.includes(q.type) && CHOICE_TYPES.includes(type) && q.type !== 'tf' && type !== 'tf') {
    return { ...q, type, answer: type === 'poll' ? null : type === 'mcq' ? (q.answer || []).slice(0, 1) : q.answer || [] };
  }
  const b = blankQuestion(type);
  const keepText = !['dropdown', 'dragdrop'].includes(type) && !['dropdown', 'dragdrop'].includes(q.type);
  return { ...b, id: q.id, text: keepText ? q.text : b.text, image: q.image, points: q.points, extra: { ...b.extra, ...(q.extra?.passage !== undefined ? { passage: q.extra.passage } : {}) } };
}

export default function QuestionEditor({ quizId, question, position, onClose, onSaved }) {
  const toast = useToast();
  const [q, setQ] = useState(() => JSON.parse(JSON.stringify(question)));
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [showExpl, setShowExpl] = useState(!!question.explanation);
  const [preview, setPreview] = useState(false);
  const textRef = useRef(null);
  const { pick, busy: uploading } = useUpload();
  const set = (patch) => setQ((cur) => ({ ...cur, ...patch }));
  const T = QTYPES[q.type];
  const Body = BODIES[q.type];
  const problems = draftProblems(q);

  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  // keep dropdown / dragdrop options in sync with blanks in text
  useEffect(() => {
    if (!['dropdown', 'dragdrop'].includes(q.type)) return;
    const ids = splitBlanks(q.text).filter((p) => p.t === 'blank').map((p) => p.id);
    const cur = q.options.map((o) => o.id);
    if (ids.join() === cur.join()) return;
    const byId = new Map(q.options.map((o) => [o.id, o]));
    set({ options: ids.map((id) => byId.get(id) || (q.type === 'dropdown' ? { id, choices: [{ id: Math.random().toString(36).slice(2, 8), text: '' }], correct: null } : { id, answer: '' })) });
  }, [q.text, q.type]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (problems.length) { toast(problems[0], 'error'); return; }
    setSaving(true);
    try {
      const body = cleanForSave(q);
      const d = q.id
        ? await api(`/questions/${q.id}`, { method: 'PUT', body })
        : await api(`/quizzes/${quizId}/questions`, { method: 'POST', body: { ...body, position } });
      toast('Question saved', 'success');
      onSaved(d.question);
    } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
  }

  const enhance = async (action) => {
    setAiBusy(true);
    try {
      const d = await api(`/ai/questions/${q.id || 'new'}/enhance`, { method: 'POST', body: { action, question: q, quizId } });
      setQ((cur) => ({ ...cur, ...d.question, id: cur.id, extra: { ...cur.extra, ...(d.question.extra || {}) } }));
      if (d.question.explanation) setShowExpl(true);
      toast('Question updated by AI — review and save', 'success');
    } catch (e) { toast(e.message, 'error'); } finally { setAiBusy(false); }
  };

  const hasPassage = q.extra?.passage !== undefined;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-200/80 backdrop-blur-sm">
      {/* top bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <button onClick={onClose} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50" title="Back"><ChevronLeft className="h-4 w-4" /></button>
        <Menu
          align="left"
          trigger={(
            <button className="flex w-56 items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-semibold hover:bg-slate-50">
              <span className={`grid h-6 w-6 place-items-center rounded ${T.bg}`}><T.icon className={`h-3.5 w-3.5 ${T.color}`} /></span>{T.label}<ChevronDown className="ml-auto h-4 w-4" />
            </button>
          )}
        >
          <div className="max-h-[60vh] overflow-auto">
            {Object.entries(QTYPES).filter(([, t]) => !t.virtual).map(([k, t]) => <MenuItem key={k} icon={t.icon} onClick={() => setQ(convertType(q, k))}>{t.label}</MenuItem>)}
          </div>
        </Menu>
        <div className="ml-auto flex items-center gap-2">
          <Menu trigger={<button className="btn-outline btn-sm"><Check className="h-3.5 w-3.5" />{q.points} point{q.points > 1 ? 's' : ''}<ChevronDown className="h-3.5 w-3.5" /></button>}>
            <div className="max-h-72 overflow-auto">
              {Array.from({ length: 20 }, (_, i) => i + 1).map((p) => <MenuItem key={p} onClick={() => set({ points: p })}>{p} point{p > 1 ? 's' : ''}</MenuItem>)}
            </div>
          </Menu>
          <Menu trigger={<button className="btn-outline btn-sm"><Clock className="h-3.5 w-3.5" />{fmtTime(q.time_limit)}<ChevronDown className="h-3.5 w-3.5" /></button>}>
            <div className="max-h-72 overflow-auto">
              {TIME_OPTIONS.map((t) => <MenuItem key={t} onClick={() => set({ time_limit: t })}>{fmtTime(t)}</MenuItem>)}
            </div>
          </Menu>
          <button onClick={save} disabled={saving} className="btn-violet btn-sm">{saving ? <Spinner className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}Save question</button>
        </div>
      </div>
      {/* second bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 text-sm">
        <Menu
          align="left"
          trigger={<button className="btn-ghost btn-sm text-violet-700" disabled={aiBusy}>{aiBusy ? <Spinner className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}Enhance with AI<ChevronDown className="h-3.5 w-3.5" /></button>}
        >
          <MenuItem onClick={() => enhance('rephrase')}>Rephrase</MenuItem>
          <MenuItem onClick={() => enhance('fix')}>Fix grammar &amp; facts</MenuItem>
          <MenuItem onClick={() => enhance('easier')}>Make it easier</MenuItem>
          <MenuItem onClick={() => enhance('harder')}>Make it harder</MenuItem>
          {CHOICE_TYPES.includes(q.type) && <MenuItem onClick={() => enhance('distractors')}>Improve wrong options</MenuItem>}
          <MenuItem onClick={() => enhance('explanation')}>Write explanation</MenuItem>
        </Menu>
        <button className={`btn-ghost btn-sm ${hasPassage ? 'text-violet-700' : ''}`} onClick={() => set({ extra: hasPassage ? Object.fromEntries(Object.entries(q.extra).filter(([k]) => k !== 'passage')) : { ...q.extra, passage: '' } })}>
          <FileText className="h-3.5 w-3.5" />{hasPassage ? 'Remove passage' : 'Add passage'}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button className="btn-ghost btn-sm" onClick={() => setPreview(true)}><Eye className="h-3.5 w-3.5" />Preview question</button>
          <button className="btn-ghost btn-sm" onClick={() => setShowExpl((v) => !v)}><Lightbulb className="h-3.5 w-3.5" />{showExpl ? 'Hide' : 'Add'} answer explanation</button>
        </div>
      </div>

      {/* canvas */}
      <div className="flex-1 overflow-auto p-4 scrollbar-thin md:p-8">
        <div className={`mx-auto ${hasPassage ? 'max-w-6xl' : 'max-w-4xl'}`}>
          <div className={`grid gap-3 ${hasPassage ? 'md:grid-cols-[1fr_1.4fr]' : ''}`}>
            {hasPassage && (
              <div className="rounded-xl bg-white p-4 shadow-card">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"><FileText className="h-4 w-4" />Passage</div>
                <textarea value={q.extra.passage} onChange={(e) => set({ extra: { ...q.extra, passage: e.target.value } })} placeholder="Paste the reading passage here…" className="h-[420px] w-full resize-none rounded-lg border border-slate-200 p-3 text-sm leading-relaxed outline-none focus:border-violet-400" />
              </div>
            )}
            <div className="rounded-2xl bg-[#461a42] p-3 shadow-xl">
              <div className="relative rounded-xl border border-white/10 bg-[#2b0f28] p-3">
                <div className="flex gap-1.5">
                  <button title="Add image" onClick={async () => { const url = await pick(); if (url) set({ image: url }); }} className="rounded bg-white/10 p-1.5 text-white hover:bg-white/20">{uploading ? <Spinner className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}</button>
                </div>
                <div className={`flex gap-3 ${q.image && !['labeling', 'hotspot', 'draw'].includes(q.type) ? 'flex-row items-center' : 'flex-col'}`}>
                  {q.image && !['labeling', 'hotspot'].includes(q.type) && (
                    <div className="relative mx-auto my-2 shrink-0">
                      <img src={q.image} alt="" className="max-h-44 rounded-lg" />
                      <button onClick={() => set({ image: null })} className="absolute -right-2 -top-2 rounded-full bg-black/70 p-1 text-white"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                  <textarea
                    ref={textRef} value={q.text} onChange={(e) => set({ text: e.target.value })}
                    placeholder={PLACEHOLDER[q.type] || 'Type question here'} autoFocus
                    className="min-h-[120px] w-full flex-1 resize-none bg-transparent py-6 text-center text-xl text-white placeholder-white/50 outline-none"
                  />
                </div>
                {['dropdown', 'dragdrop'].includes(q.type) && <BlankText q={q} set={set} textRef={textRef} />}
              </div>
              <div className="mt-3">{Body && <Body q={q} set={set} />}</div>
            </div>
          </div>
          {showExpl && (
            <div className="mt-4 rounded-xl bg-white p-4 shadow-card">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold"><Lightbulb className="h-4 w-4 text-amber-500" />Answer explanation</div>
              <textarea value={q.explanation || ''} onChange={(e) => set({ explanation: e.target.value })} placeholder="Explain why the answer is correct. Students see this after answering." className="input min-h-[80px]" />
            </div>
          )}
          {problems.length > 0 && <div className="mt-3 text-center text-xs text-slate-500">To save: {problems.join(' · ')}</div>}
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col game-bg">
          <div className="flex justify-between p-3">
            <span className="rounded-lg bg-black/30 px-3 py-1.5 font-game text-sm font-bold text-white">Student preview</span>
            <button onClick={() => setPreview(false)} className="rounded-lg bg-black/30 p-2 text-white"><X className="h-5 w-5" /></button>
          </div>
          <div className="flex-1 overflow-auto">
            <QuestionPlayer key={JSON.stringify(q)} preview question={previewSanitize(q)} fullQuestion={q} onSubmit={() => {}} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Local equivalent of the server's sanitize, for the in-editor preview. */
function previewSanitize(q) {
  const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);
  const base = { id: q.id || 0, type: q.type, text: q.text, image: q.image, points: q.points, time_limit: q.time_limit, passage: q.extra?.passage || null };
  const o = q.options || [];
  switch (q.type) {
    case 'mcq': case 'msq': case 'tf': case 'poll': return { ...base, options: o, multi: q.type === 'msq', correctCount: (q.answer || []).length };
    case 'reorder': return { ...base, options: shuffle(o) };
    case 'match': return { ...base, lefts: o.map((p) => ({ id: p.id, text: p.left })), rights: shuffle(o).map((p) => ({ id: p.id, text: p.right })) };
    case 'dropdown': return { ...base, blanks: o.map((b) => ({ id: b.id, choices: b.choices })) };
    case 'dragdrop': return { ...base, blanks: o.map((b) => ({ id: b.id })), chips: shuffle([...o.map((b) => b.answer), ...(q.extra?.distractors || [])].filter(Boolean)) };
    case 'categorize': return { ...base, categories: q.extra?.categories || [], items: shuffle(o) };
    case 'hottext': return { ...base, units: o, unit: q.extra?.unit, selectCount: (q.answer || []).length };
    case 'matchgrid': return { ...base, rows: o, columns: q.extra?.columns || [], multi: !!q.extra?.multi };
    case 'tablefill': return { ...base, table: { cols: q.extra?.table?.cols || [], rows: (q.extra?.table?.rows || []).map((r) => r.map((c) => (c.t === 'blank' ? { t: 'blank', id: c.id } : c))) } };
    case 'labeling': return { ...base, targets: o.map((t) => ({ id: t.id, x: t.x, y: t.y })), labels: shuffle([...o.map((t) => t.text), ...(q.extra?.distractors || [])].filter(Boolean)) };
    case 'hotspot': return { ...base, regions: o, selectCount: (q.answer || []).length };
    case 'graphing': return { ...base, graph: { ...q.extra }, expected: q.extra?.mode === 'line' ? 2 : (q.answer?.points || []).length };
    default: return base;
  }
}
