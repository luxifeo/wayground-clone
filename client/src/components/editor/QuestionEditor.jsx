import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft, Save, Clock, Check, Image as ImageIcon, Lightbulb, Sparkles, FileText, X, Eye, ChevronDown, ImagePlus as ImageSearchIcon,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import i18n from '../../i18n/index.js';
import { QTYPES, TIME_OPTIONS, fmtTime, blankQuestion, CHOICE_TYPES, splitBlanks } from '../../lib/constants.js';
import { Menu, MenuItem, Spinner, useToast } from '../ui.jsx';
import {
  ChoiceBody, FillBody, OpenBody, ReorderBody, MatchBody, DropdownBody, DragDropBody, BlankText, CategorizeBody,
  HotTextBody, MatchGridBody, TableFillBody, LabelingBody, HotspotBody, GraphingBody, CrosswordBody, useUpload,
} from './bodies.jsx';
import { buildLayout, cwNormalize } from '../../lib/crossword.js';
import QuestionPlayer from '../play/QuestionPlayer.jsx';
import ImageSearchModal, { ImageCredit } from '../ImageSearchModal.jsx';

const BODIES = {
  mcq: ChoiceBody, msq: ChoiceBody, tf: ChoiceBody, poll: ChoiceBody,
  fill: FillBody, math: FillBody,
  open: OpenBody, draw: OpenBody, video: OpenBody, audio: OpenBody, wordcloud: OpenBody, discussion: OpenBody,
  reorder: ReorderBody, match: MatchBody, dropdown: DropdownBody, dragdrop: DragDropBody, categorize: CategorizeBody,
  hottext: HotTextBody, matchgrid: MatchGridBody, tablefill: TableFillBody, labeling: LabelingBody, hotspot: HotspotBody,
  graphing: GraphingBody, crossword: CrosswordBody,
};

// types with a specific question-text placeholder (editor:question.placeholders.<type>)
const PLACEHOLDER_TYPES = ['dropdown', 'dragdrop', 'hottext', 'tablefill', 'labeling', 'hotspot', 'graphing'];

/** Client-side check mirroring the server's publish rules. */
export function draftProblems(q) {
  const t = (k) => i18n.t(`question.problems.${k}`, { ns: 'editor' });
  const p = [];
  const plain = String(q.text || '').replace(/\[\[[^\]]+\]\]/g, '').trim();
  if (!plain && !q.image && !['hottext', 'tablefill'].includes(q.type)) p.push(t('text'));
  const o = q.options || [];
  if (['mcq', 'msq', 'poll'].includes(q.type) && o.filter((x) => x.text.trim() || x.image).length < 2) p.push(t('minOptions'));
  if (['mcq', 'msq', 'poll'].includes(q.type) && o.some((x) => !x.text.trim() && !x.image)) p.push(t('emptyOptions'));
  if (['mcq', 'msq'].includes(q.type) && !(q.answer || []).length) p.push(t('markCorrect'));
  if (['fill', 'math'].includes(q.type) && !(q.answer?.accepted || []).some((a) => a.trim())) p.push(t('addAnswer'));
  if (q.type === 'reorder' && o.filter((x) => x.text.trim()).length < 2) p.push(t('minItems'));
  if (q.type === 'match' && o.some((x) => !x.left.trim() || !x.right.trim())) p.push(t('emptyPairs'));
  if (q.type === 'dropdown') {
    if (!o.length) p.push(t('insertBlank'));
    if (o.some((b) => !b.correct || b.choices.some((c) => !c.text.trim()))) p.push(t('dropdownChoices'));
  }
  if (q.type === 'dragdrop' && (!o.length || o.some((b) => !b.answer.trim()))) p.push(t('dragdropItems'));
  if (q.type === 'categorize' && ((q.extra?.categories || []).some((c) => !c.name.trim()) || o.filter((i) => i.text.trim()).length < 2)) p.push(t('categorize'));
  if (q.type === 'hottext' && !(q.answer || []).length) p.push(t('hottext'));
  if (q.type === 'matchgrid' && o.some((r) => !(q.answer?.[r.id] || []).length)) p.push(t('matchgrid'));
  if (q.type === 'tablefill' && !(q.extra?.table?.rows || []).flat().some((c) => c.t === 'blank' && (c.accepted || []).some((a) => a.trim()))) p.push(t('tablefill'));
  if (['labeling', 'hotspot'].includes(q.type) && !q.image) p.push(t('image'));
  if (q.type === 'labeling' && (o.length < 2 || o.some((t) => !t.text.trim()))) p.push(t('labels'));
  if (q.type === 'hotspot' && !(q.answer || []).length) p.push(t('hotspot'));
  if (q.type === 'graphing' && !(q.answer?.points || []).length) p.push(t('graphing'));
  if (q.type === 'crossword') {
    const len = (w) => Array.from(cwNormalize(w.answer)).length;
    if (o.filter((w) => len(w) >= 2).length < 2) p.push(t('crosswordWords'));
    if (o.some((w) => len(w) >= 2 && !String(w.clue || '').trim())) p.push(t('crosswordClues'));
    if (o.some((w) => len(w) < 2 && String(w.clue || '').trim())) p.push(t('crosswordEmpty'));
  }
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

// Reading passage fields in extra. passageId groups the questions of one passage and is never edited here.
const PASSAGE_FIELDS = ['passage', 'passageTitle', 'passageImage'];
const PASSAGE_KEYS = [...PASSAGE_FIELDS, 'passageId'];
const pickPassage = (extra) => Object.fromEntries(PASSAGE_KEYS.filter((k) => extra?.[k] !== undefined).map((k) => [k, extra[k]]));

function convertType(q, type) {
  if (CHOICE_TYPES.includes(q.type) && CHOICE_TYPES.includes(type) && q.type !== 'tf' && type !== 'tf') {
    return { ...q, type, answer: type === 'poll' ? null : type === 'mcq' ? (q.answer || []).slice(0, 1) : q.answer || [] };
  }
  const b = blankQuestion(type);
  const keepText = !['dropdown', 'dragdrop'].includes(type) && !['dropdown', 'dragdrop'].includes(q.type);
  return { ...b, id: q.id, text: keepText ? q.text : b.text, image: q.image, points: q.points, extra: { ...b.extra, ...pickPassage(q.extra) } };
}

/** group: the other questions sharing this question's passageId; passage edits are copied to them on save. */
export default function QuestionEditor({ quizId, question, position, onClose, onSaved, group = [] }) {
  const { t } = useTranslation('editor');
  const toast = useToast();
  const [q, setQ] = useState(() => JSON.parse(JSON.stringify(question)));
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [showExpl, setShowExpl] = useState(!!question.explanation);
  const [preview, setPreview] = useState(false);
  const [imgSearch, setImgSearch] = useState(false);
  const textRef = useRef(null);
  const { pick, busy: uploading } = useUpload();
  const passageUpload = useUpload();
  const set = (patch) => setQ((cur) => ({ ...cur, ...patch }));
  const setPassage = (k, v) => setQ((cur) => {
    const extra = { ...(cur.extra || {}) };
    if (v === null) delete extra[k]; else extra[k] = v;
    return { ...cur, extra };
  });
  const uploadPassageImage = async () => { const url = await passageUpload.pick(); if (url) setPassage('passageImage', url); };
  const setImage = (url, credit) => setQ((cur) => {
    const extra = { ...(cur.extra || {}) };
    if (credit) extra.imageCredit = credit; else delete extra.imageCredit;
    return { ...cur, image: url, extra };
  });
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
      // one reading passage is shared by its whole group: copy passage edits to the other questions
      const pid = q.extra?.passageId;
      const changed = PASSAGE_FIELDS.some((k) => (q.extra?.[k] || null) !== (question.extra?.[k] || null));
      const others = pid && pid === question.extra?.passageId && changed ? group.filter((g) => g.id !== q.id) : [];
      await Promise.all(others.map((g) => {
        const extra = { ...(g.extra || {}) };
        PASSAGE_FIELDS.forEach((k) => { if (q.extra[k]) extra[k] = q.extra[k]; else delete extra[k]; });
        return api(`/questions/${g.id}`, { method: 'PUT', body: { extra } });
      }));
      toast(others.length ? t('question.savedShared', { count: others.length }) : t('question.saved'), 'success');
      onSaved(d.question);
    } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
  }

  const enhance = async (action) => {
    setAiBusy(true);
    try {
      const d = await api(`/ai/questions/${q.id || 'new'}/enhance`, { method: 'POST', body: { action, question: q, quizId } });
      setQ((cur) => ({ ...cur, ...d.question, id: cur.id, extra: { ...cur.extra, ...(d.question.extra || {}) } }));
      if (d.question.explanation) setShowExpl(true);
      toast(t('question.aiUpdated'), 'success');
    } catch (e) { toast(e.message, 'error'); } finally { setAiBusy(false); }
  };

  const hasPassage = q.extra?.passage !== undefined || !!q.extra?.passageTitle || !!q.extra?.passageImage;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-200/80 backdrop-blur-sm">
      {/* top bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <button onClick={onClose} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50" title={t('common:actions.back')}><ChevronLeft className="h-4 w-4" /></button>
        <Menu
          align="left"
          trigger={(
            <button className="flex w-56 items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-semibold hover:bg-slate-50">
              <span className={`grid h-6 w-6 place-items-center rounded ${T.bg}`}><T.icon className={`h-3.5 w-3.5 ${T.color}`} /></span>{T.label}<ChevronDown className="ml-auto h-4 w-4" />
            </button>
          )}
        >
          <div className="max-h-[60vh] overflow-auto">
            {Object.entries(QTYPES).filter(([, x]) => !x.virtual).map(([k, x]) => <MenuItem key={k} icon={x.icon} onClick={() => setQ(convertType(q, k))}>{x.label}</MenuItem>)}
          </div>
        </Menu>
        <div className="ml-auto flex items-center gap-2">
          <Menu trigger={<button className="btn-outline btn-sm"><Check className="h-3.5 w-3.5" />{t('common:count.points', { count: q.points })}<ChevronDown className="h-3.5 w-3.5" /></button>}>
            <div className="max-h-72 overflow-auto">
              {Array.from({ length: 20 }, (_, i) => i + 1).map((p) => <MenuItem key={p} onClick={() => set({ points: p })}>{t('common:count.points', { count: p })}</MenuItem>)}
            </div>
          </Menu>
          <Menu trigger={<button className="btn-outline btn-sm"><Clock className="h-3.5 w-3.5" />{fmtTime(q.time_limit)}<ChevronDown className="h-3.5 w-3.5" /></button>}>
            <div className="max-h-72 overflow-auto">
              {TIME_OPTIONS.map((s) => <MenuItem key={s} onClick={() => set({ time_limit: s })}>{fmtTime(s)}</MenuItem>)}
            </div>
          </Menu>
          <button onClick={save} disabled={saving} className="btn-violet btn-sm">{saving ? <Spinner className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}{t('question.saveQuestion')}</button>
        </div>
      </div>
      {/* second bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 text-sm">
        <Menu
          align="left"
          trigger={<button className="btn-ghost btn-sm text-violet-700" disabled={aiBusy}>{aiBusy ? <Spinner className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}{t('question.enhance')}<ChevronDown className="h-3.5 w-3.5" /></button>}
        >
          <MenuItem onClick={() => enhance('rephrase')}>{t('question.ai.rephrase')}</MenuItem>
          <MenuItem onClick={() => enhance('fix')}>{t('question.ai.fix')}</MenuItem>
          <MenuItem onClick={() => enhance('easier')}>{t('question.ai.easier')}</MenuItem>
          <MenuItem onClick={() => enhance('harder')}>{t('question.ai.harder')}</MenuItem>
          {CHOICE_TYPES.includes(q.type) && <MenuItem onClick={() => enhance('distractors')}>{t('question.ai.distractors')}</MenuItem>}
          <MenuItem onClick={() => enhance('explanation')}>{t('question.ai.explanation')}</MenuItem>
        </Menu>
        <button className={`btn-ghost btn-sm ${hasPassage ? 'text-violet-700' : ''}`} onClick={() => set({ extra: hasPassage ? Object.fromEntries(Object.entries(q.extra).filter(([k]) => !PASSAGE_KEYS.includes(k))) : { ...q.extra, passage: '' } })}>
          <FileText className="h-3.5 w-3.5" />{hasPassage ? t('question.removePassage') : t('question.addPassage')}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button className="btn-ghost btn-sm" onClick={() => setPreview(true)}><Eye className="h-3.5 w-3.5" />{t('question.previewQuestion')}</button>
          <button className="btn-ghost btn-sm" onClick={() => setShowExpl((v) => !v)}><Lightbulb className="h-3.5 w-3.5" />{showExpl ? t('question.hideExplanation') : t('question.addExplanation')}</button>
        </div>
      </div>

      {/* canvas */}
      <div className="flex-1 overflow-auto p-4 scrollbar-thin md:p-8">
        <div className={`mx-auto ${hasPassage ? 'max-w-6xl' : 'max-w-4xl'}`}>
          <div className={`grid gap-3 ${hasPassage ? 'md:grid-cols-[1fr_1.4fr]' : ''}`}>
            {hasPassage && (
              <div className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-card">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-700"><FileText className="h-4 w-4" />{t('question.passage')}</div>
                <input value={q.extra.passageTitle || ''} onChange={(e) => setPassage('passageTitle', e.target.value)} placeholder={t('question.passageTitlePlaceholder')} aria-label={t('question.passageTitle')} className="input font-semibold" />
                {q.extra.passageImage ? (
                  <div className="relative self-start">
                    <img src={q.extra.passageImage} alt="" className="max-h-48 max-w-full rounded-lg border border-slate-200 object-contain" />
                    <div className="absolute right-1.5 top-1.5 flex gap-1">
                      <button title={t('question.replacePassageImage')} onClick={uploadPassageImage} disabled={passageUpload.busy} className="rounded-full bg-black/70 p-1 text-white hover:bg-black/85">{passageUpload.busy ? <Spinner className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}</button>
                      <button title={t('question.removePassageImage')} onClick={() => setPassage('passageImage', null)} className="rounded-full bg-black/70 p-1 text-white hover:bg-black/85"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ) : (
                  <button onClick={uploadPassageImage} disabled={passageUpload.busy} className="btn-outline btn-sm self-start">{passageUpload.busy ? <Spinner className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}{t('question.addPassageImage')}</button>
                )}
                <textarea value={q.extra.passage ?? ''} onChange={(e) => setPassage('passage', e.target.value)} placeholder={t('question.passagePlaceholder')} className={`${q.extra.passageImage ? 'h-[300px]' : 'h-[380px]'} w-full resize-none rounded-lg border border-slate-200 p-3 text-sm leading-relaxed outline-none focus:border-violet-400`} />
                {q.extra.passageId && group.length > 0 && <div className="rounded-lg bg-violet-50 px-2.5 py-2 text-xs text-violet-800">{t('question.passageShared', { count: group.length })}</div>}
              </div>
            )}
            <div className="rounded-2xl bg-[#461a42] p-3 shadow-xl">
              <div className="relative rounded-xl border border-white/10 bg-[#2b0f28] p-3">
                <div className="flex gap-1.5">
                  <button title={t('question.uploadImage')} onClick={async () => { const url = await pick(); if (url) setImage(url, null); }} className="rounded bg-white/10 p-1.5 text-white hover:bg-white/20">{uploading ? <Spinner className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}</button>
                  <button title={t('question.searchFreeImages')} onClick={() => setImgSearch(true)} className="flex items-center gap-1 rounded bg-white/10 px-2 py-1.5 text-xs font-semibold text-white hover:bg-white/20"><ImageSearchIcon className="h-4 w-4" />{t('question.searchImages')}</button>
                </div>
                <div className={`flex gap-3 ${q.image && !['labeling', 'hotspot', 'draw'].includes(q.type) ? 'flex-row items-center' : 'flex-col'}`}>
                  {q.image && !['labeling', 'hotspot'].includes(q.type) && (
                    <div className="relative mx-auto my-2 shrink-0">
                      <img src={q.image} alt="" className="max-h-44 rounded-lg" />
                      <ImageCredit credit={q.extra?.imageCredit} dark className="mt-1 max-w-[16rem]" />
                      <button onClick={() => setImage(null, null)} className="absolute -right-2 -top-2 rounded-full bg-black/70 p-1 text-white"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                  <textarea
                    ref={textRef} value={q.text} onChange={(e) => set({ text: e.target.value })}
                    placeholder={PLACEHOLDER_TYPES.includes(q.type) ? t(`question.placeholders.${q.type}`) : t('question.textPlaceholder')} autoFocus
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
              <div className="mb-2 flex items-center gap-2 text-sm font-bold"><Lightbulb className="h-4 w-4 text-amber-500" />{t('question.explanation')}</div>
              <textarea value={q.explanation || ''} onChange={(e) => set({ explanation: e.target.value })} placeholder={t('question.explanationPlaceholder')} className="input min-h-[80px]" />
            </div>
          )}
          {problems.length > 0 && <div className="mt-3 text-center text-xs text-slate-500">{t('question.toSave', { list: problems.join(' · ') })}</div>}
        </div>
      </div>

      <ImageSearchModal
        open={imgSearch} onClose={() => setImgSearch(false)}
        initialQuery={q.text.replace(/\[\[[^\]]+\]\]/g, ' ').replace(/[?.!,:;"“”]/g, ' ').trim().split(/\s+/).slice(0, 6).join(' ')}
        onPick={({ url, credit }) => setImage(url, credit)}
      />
      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col game-bg">
          <div className="flex justify-between p-3">
            <span className="rounded-lg bg-black/30 px-3 py-1.5 font-game text-sm font-bold text-white">{t('question.studentPreview')}</span>
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
  const base = { id: q.id || 0, type: q.type, text: q.text, image: q.image, points: q.points, time_limit: q.time_limit, passage: q.extra?.passage || null, passageTitle: q.extra?.passageTitle || null, passageImage: q.extra?.passageImage || null, passageId: q.extra?.passageId || null, imageCredit: q.extra?.imageCredit || null };
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
    case 'crossword': {
      const words = o.filter((w) => Array.from(cwNormalize(w.answer)).length >= 2);
      const { rows, cols, entries } = buildLayout(words);
      return { ...base, layout: { rows, cols, entries }, clues: words.map((w) => ({ id: w.id, clue: w.clue })) };
    }
    default: return base;
  }
}
