import { equivalent } from './mathEval.js';
import { buildLayout, cwNormalize } from './crossword.js';

// Question formats (options / answer / extra are JSONB)
//   mcq        options [{id,text,image}]               answer [id]
//   msq        options [{id,text,image}]               answer [id,...]
//   tf         options true/false                      answer [id]
//   poll       options [{id,text,image}]               answer null                        (ungraded)
//   fill       -                                       answer {accepted:[..]}             extra.caseSensitive
//   math       -                                       answer {accepted:[..]}             extra.exact (else equivalence)
//   open       -                                       answer {sample}                    (ungraded)
//   draw | wordcloud | audio | video | discussion      (ungraded)
//   reorder    options in correct order                player sends [ids]
//   match      options [{id,left,right}]               player sends {leftId: rightId}
//   dropdown   text has [[blankId]] tokens; options [{id, choices:[{id,text}], correct}]  player {blankId: choiceId}
//   dragdrop   text has [[blankId]] tokens; options [{id, answer}]; extra.distractors     player {blankId: text}
//   categorize options items [{id,text,cat}]; extra.categories [{id,name}]               player {itemId: catId}
//   hottext    options units [{id,text}] ; answer [ids]; extra.source, extra.unit         player [ids]
//   matchgrid  options rows [{id,text}]; extra.columns [{id,text}], extra.multi; answer {rowId:[colIds]}  player same
//   tablefill  extra.table {cols:[..], rows:[[{t:'text',v}|{t:'blank',id,accepted}]]}     player {cellId: text}
//   labeling   image + options targets [{id,text,x,y}] (percent); extra.distractors       player {targetId: text}
//   hotspot    image + options regions [{id,x,y,w,h}] ; answer [ids]                     player [ids]
//   graphing   extra {xmin,xmax,ymin,ymax,mode:'points'|'line'}; answer {points:[[x,y]]} player {points}
//   crossword  options words [{id,answer,clue}]; extra.layout {rows,cols,entries:[{id,row,col,dir,len,num}]} (server built)  player {wordId: letters}
// Any question may carry extra.passage (shown next to the question).

export const QUESTION_TYPES = [
  'mcq', 'msq', 'tf', 'fill', 'open', 'poll', 'reorder', 'match', 'draw', 'dropdown', 'dragdrop', 'categorize',
  'hottext', 'matchgrid', 'tablefill', 'labeling', 'hotspot', 'graphing', 'math', 'wordcloud', 'audio', 'video', 'discussion',
  'crossword',
];
export const UNGRADED_TYPES = ['open', 'poll', 'draw', 'wordcloud', 'audio', 'video', 'discussion'];

/** Deterministic PRNG so the same player always sees the same order (mulberry32). */
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, seed = null) {
  const a = [...(arr || [])];
  const rand = seed === null ? Math.random : rng(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const norm = (s, cs) => {
  let v = String(s ?? '').trim().replace(/\s+/g, ' ');
  if (!cs) v = v.toLowerCase();
  return v;
};

const result = (hit, total, wrong = 0) => {
  if (total <= 0) return { status: 'ungraded', fraction: 0 };
  if (hit === total && wrong === 0) return { status: 'correct', fraction: 1 };
  const fraction = Math.max(0, (hit - wrong) / total);
  return { status: fraction > 0 ? 'partial' : 'incorrect', fraction };
};

const setScore = (correctIds, pickedIds) => {
  const correct = new Set(correctIds || []);
  const picked = new Set(pickedIds || []);
  let hit = 0, wrong = 0;
  picked.forEach((p) => (correct.has(p) ? hit++ : wrong++));
  return result(hit, correct.size, wrong);
};

const isEmpty = (a) => a === null || a === undefined || a === '' ||
  (Array.isArray(a) && a.length === 0) || (typeof a === 'object' && !Array.isArray(a) && Object.keys(a).length === 0);

export const blankIds = (text) => [...String(text || '').matchAll(/\[\[([a-z0-9_-]+)\]\]/gi)].map((m) => m[1]);

function graphLine(points) {
  if (!points || points.length < 2) return null;
  const [[x1, y1], [x2, y2]] = points;
  if (x1 === x2 && y1 === y2) return null;
  if (x1 === x2) return { vertical: true, x: x1 };
  const m = (y2 - y1) / (x2 - x1);
  return { m, b: y1 - m * x1 };
}

/** Returns { status, fraction } for an answer. */
export function grade(q, answer) {
  if (UNGRADED_TYPES.includes(q.type)) return isEmpty(answer) ? { status: 'skipped', fraction: 0 } : { status: 'ungraded', fraction: 0 };
  if (isEmpty(answer)) return { status: 'skipped', fraction: 0 };
  const opts = q.options || [];
  switch (q.type) {
    case 'mcq':
    case 'tf': {
      const picked = Array.isArray(answer) ? answer : [answer];
      const ok = picked.length === 1 && (q.answer || []).includes(picked[0]);
      return { status: ok ? 'correct' : 'incorrect', fraction: ok ? 1 : 0 };
    }
    case 'msq':
    case 'hottext':
    case 'hotspot':
      return setScore(q.answer, Array.isArray(answer) ? answer : [answer]);
    case 'fill': {
      const cs = !!q.extra?.caseSensitive;
      const ok = (q.answer?.accepted || []).map((a) => norm(a, cs)).includes(norm(answer, cs));
      return { status: ok ? 'correct' : 'incorrect', fraction: ok ? 1 : 0 };
    }
    case 'math': {
      const acc = q.answer?.accepted || [];
      const ok = q.extra?.exact
        ? acc.map((a) => norm(a).replace(/\s/g, '')).includes(norm(answer).replace(/\s/g, ''))
        : acc.some((a) => norm(a).replace(/\s/g, '') === norm(answer).replace(/\s/g, '') || equivalent(a, answer));
      return { status: ok ? 'correct' : 'incorrect', fraction: ok ? 1 : 0 };
    }
    case 'reorder': {
      // compare by content, so identical items (e.g. two "the") are interchangeable
      const key = (o) => o && `${norm(o.text, true)}|${o.image || ''}`;
      const byId = new Map(opts.map((o) => [o.id, o]));
      const picked = Array.isArray(answer) ? answer : [];
      let hit = 0;
      opts.forEach((o, i) => { if (key(byId.get(picked[i])) === key(o)) hit++; });
      return result(hit, opts.length);
    }
    case 'match': {
      // compare by content, so identical right-hand items are interchangeable
      const rightKey = (o) => o && `${norm(o.right, true)}|${o.rightImage || ''}`;
      const byId = new Map(opts.map((o) => [o.id, o]));
      let hit = 0;
      opts.forEach((p) => { const got = byId.get(answer?.[p.id]); if (got && rightKey(got) === rightKey(p)) hit++; });
      return result(hit, opts.length);
    }
    case 'dropdown': {
      let hit = 0;
      opts.forEach((b) => { if (answer[b.id] && answer[b.id] === b.correct) hit++; });
      return result(hit, opts.length);
    }
    case 'dragdrop': {
      let hit = 0;
      opts.forEach((b) => { if (norm(answer[b.id]) && norm(answer[b.id]) === norm(b.answer)) hit++; });
      return result(hit, opts.length);
    }
    case 'categorize': {
      let hit = 0;
      opts.forEach((it) => { if (answer[it.id] === it.cat) hit++; });
      return result(hit, opts.length);
    }
    case 'labeling': {
      let hit = 0;
      opts.forEach((t) => { if (norm(answer[t.id]) && norm(answer[t.id]) === norm(t.text)) hit++; });
      return result(hit, opts.length);
    }
    case 'matchgrid': {
      const key = q.answer || {};
      let hit = 0;
      opts.forEach((r) => {
        const want = [...(key[r.id] || [])].sort().join('|');
        const got = [...(answer[r.id] || [])].sort().join('|');
        if (want === got) hit++;
      });
      return result(hit, opts.length);
    }
    case 'tablefill': {
      const cs = !!q.extra?.caseSensitive;
      const blanks = (q.extra?.table?.rows || []).flat().filter((c) => c && c.t === 'blank');
      let hit = 0;
      blanks.forEach((c) => { if ((c.accepted || []).map((a) => norm(a, cs)).includes(norm(answer[c.id], cs)) && norm(answer[c.id])) hit++; });
      return result(hit, blanks.length);
    }
    case 'graphing': {
      const want = q.answer?.points || [];
      const got = answer?.points || [];
      if (q.extra?.mode === 'line') {
        const a = graphLine(want); const b = graphLine(got);
        const ok = a && b && (a.vertical ? b.vertical && a.x === b.x : !b.vertical && Math.abs(a.m - b.m) < 1e-9 && Math.abs(a.b - b.b) < 1e-9);
        return { status: ok ? 'correct' : 'incorrect', fraction: ok ? 1 : 0 };
      }
      const key = new Set(want.map((p) => `${p[0]},${p[1]}`));
      return setScore([...key], got.map((p) => `${p[0]},${p[1]}`));
    }
    case 'crossword': {
      const got = typeof answer === 'object' && !Array.isArray(answer) ? answer : {};
      let hit = 0;
      opts.forEach((w) => { const want = cwNormalize(w.answer); if (want && cwNormalize(got[w.id]) === want) hit++; });
      return result(hit, opts.length);
    }
    default:
      return { status: 'ungraded', fraction: 0 };
  }
}

export const SCORING_MODES = ['classic', 'perQuestion'];

/**
 * Points awarded for a graded answer.
 * scoring 'perQuestion': 1 point for a fully correct answer, otherwise 0 (no speed / streak bonus).
 */
export function computeScore({ q, fraction, timeMs, timerOn, streak, gameType, scoring = 'classic' }) {
  if (scoring === 'perQuestion') return fraction >= 1 ? 1 : 0;
  if (fraction <= 0) return 0;
  const pts = q.points || 1;
  if (gameType === 'test') return Math.round(100 * pts * fraction);
  let score = 600 * pts * fraction;
  if (timerOn && q.time_limit > 0) {
    const ratio = Math.max(0, 1 - timeMs / (q.time_limit * 1000));
    score += 400 * pts * fraction * ratio;
  }
  if (fraction === 1 && streak >= 2) score += 50 * Math.min(streak, 6);
  return Math.round(score);
}

/** Data sent to the player: no answers. */
export function sanitizeQuestion(q, { shuffleAnswers = false, seed = 0 } = {}) {
  let salt = 0;
  const sh = (a) => shuffle(a, (seed * 31 + (q.id || 0) * 7919 + (salt += 101)) >>> 0);
  const ex = q.extra || {};
  const base = {
    id: q.id, type: q.type, text: q.text, image: q.image, points: q.points, time_limit: q.time_limit,
    passage: ex.passage || null,
    passageTitle: ex.passageTitle || null, passageImage: ex.passageImage || null, passageId: ex.passageId || null,
    imageCredit: q.image ? ex.imageCredit || null : null,
  };
  const opts = q.options || [];
  switch (q.type) {
    case 'mcq': case 'msq': case 'tf': case 'poll':
      return {
        ...base,
        multi: q.type === 'msq',
        correctCount: q.type === 'msq' ? (q.answer || []).length : undefined,
        options: (shuffleAnswers && q.type !== 'tf' ? sh(opts) : opts).map((o) => ({ id: o.id, text: o.text, image: o.image })),
      };
    case 'reorder': {
      let o = sh(opts);
      if (o.length > 1 && o.every((x, i) => x.text === opts[i].text && x.image === opts[i].image)) o = [...o.slice(1), o[0]];
      return { ...base, options: o.map((x) => ({ id: x.id, text: x.text, image: x.image })) };
    }
    case 'match':
      return {
        ...base,
        lefts: opts.map((p) => ({ id: p.id, text: p.left, image: p.leftImage })),
        rights: sh(opts).map((p) => ({ id: p.id, text: p.right, image: p.rightImage })),
      };
    case 'dropdown':
      return { ...base, blanks: opts.map((b) => ({ id: b.id, choices: sh(b.choices || []).map((c) => ({ id: c.id, text: c.text })) })) };
    case 'dragdrop':
      return { ...base, blanks: opts.map((b) => ({ id: b.id })), chips: sh([...opts.map((b) => b.answer), ...(ex.distractors || [])].filter(Boolean)) };
    case 'categorize':
      return { ...base, categories: ex.categories || [], items: sh(opts).map((i) => ({ id: i.id, text: i.text, image: i.image })) };
    case 'hottext':
      return { ...base, units: opts.map((u) => ({ id: u.id, text: u.text })), unit: ex.unit || 'word', selectCount: (q.answer || []).length };
    case 'matchgrid':
      return { ...base, rows: opts.map((r) => ({ id: r.id, text: r.text })), columns: ex.columns || [], multi: !!ex.multi };
    case 'tablefill':
      return {
        ...base,
        table: {
          cols: ex.table?.cols || [],
          rows: (ex.table?.rows || []).map((row) => row.map((c) => (c?.t === 'blank' ? { t: 'blank', id: c.id } : { t: 'text', v: c?.v ?? '' }))),
        },
      };
    case 'labeling':
      return {
        ...base,
        targets: opts.map((t) => ({ id: t.id, x: t.x, y: t.y })),
        labels: sh([...opts.map((t) => t.text), ...(ex.distractors || [])].filter(Boolean)),
      };
    case 'hotspot':
      return { ...base, regions: opts.map((r) => ({ id: r.id, x: r.x, y: r.y, w: r.w, h: r.h })), selectCount: (q.answer || []).length };
    case 'graphing':
      return {
        ...base,
        graph: { xmin: ex.xmin ?? -10, xmax: ex.xmax ?? 10, ymin: ex.ymin ?? -10, ymax: ex.ymax ?? 10, mode: ex.mode || 'points' },
        expected: ex.mode === 'line' ? 2 : (q.answer?.points || []).length,
      };
    case 'crossword': {
      const lay = Array.isArray(ex.layout?.entries) ? ex.layout : buildLayout(opts);
      return {
        ...base,
        layout: { rows: lay.rows, cols: lay.cols, entries: lay.entries.map(({ id, row, col, dir, len, num }) => ({ id, row, col, dir, len, num })) },
        clues: opts.map((o) => ({ id: o.id, clue: o.clue })),
      };
    }
    default:
      return base;
  }
}

/** What to reveal after answering. */
export function revealFor(q) {
  const opts = q.options || [];
  switch (q.type) {
    case 'mcq': case 'msq': case 'tf': case 'hottext': case 'hotspot': return { correct: q.answer || [] };
    case 'fill': case 'math': return { accepted: q.answer?.accepted || [] };
    case 'reorder': return { order: opts.map((o) => o.id), options: opts };
    case 'match': return { pairs: opts };
    case 'open': return { sample: q.answer?.sample || null };
    case 'dropdown': return { blanks: Object.fromEntries(opts.map((b) => [b.id, b.correct])), text: Object.fromEntries(opts.map((b) => [b.id, (b.choices || []).find((c) => c.id === b.correct)?.text])) };
    case 'dragdrop': return { blanks: Object.fromEntries(opts.map((b) => [b.id, b.answer])) };
    case 'categorize': return { items: Object.fromEntries(opts.map((i) => [i.id, i.cat])) };
    case 'labeling': return { targets: Object.fromEntries(opts.map((t) => [t.id, t.text])) };
    case 'matchgrid': return { grid: q.answer || {} };
    case 'tablefill': return { cells: Object.fromEntries((q.extra?.table?.rows || []).flat().filter((c) => c?.t === 'blank').map((c) => [c.id, c.accepted || []])) };
    case 'graphing': return { points: q.answer?.points || [] };
    case 'crossword': return { entries: Object.fromEntries(opts.map((o) => [o.id, cwNormalize(o.answer)])) };
    default: return {};
  }
}

const rid = () => Math.random().toString(36).slice(2, 8);
const str = (v) => String(v ?? '');
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** Normalise question payload coming from the editor / AI / import. */
export function normalizeQuestion(input) {
  const type = QUESTION_TYPES.includes(input.type) ? input.type : 'mcq';
  let options = Array.isArray(input.options) ? input.options : [];
  let answer = input.answer ?? null;
  const extra = input.extra && typeof input.extra === 'object' && !Array.isArray(input.extra) ? { ...input.extra } : {};
  let text = str(input.text);

  switch (type) {
    case 'mcq': case 'msq': case 'poll': case 'reorder': {
      options = options.map((o) => ({ id: str(o.id || rid()), text: str(o.text), image: o.image || null }));
      if (type === 'mcq' || type === 'msq') {
        const ids = new Set(options.map((o) => o.id));
        answer = (Array.isArray(answer) ? answer : []).map(String).filter((a) => ids.has(a));
        if (type === 'mcq' && answer.length > 1) answer = [answer[0]];
      } else answer = null;
      break;
    }
    case 'tf':
      options = [{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }];
      if (!Array.isArray(answer) || !['true', 'false'].includes(answer[0])) answer = ['true'];
      break;
    case 'match':
      options = options.map((o) => ({ id: str(o.id || rid()), left: str(o.left), right: str(o.right), leftImage: o.leftImage || null, rightImage: o.rightImage || null }));
      answer = null;
      break;
    case 'fill': case 'math': {
      const acc = Array.isArray(answer?.accepted) ? answer.accepted : (typeof answer === 'string' ? [answer] : []);
      answer = { accepted: acc.map(String).map((s) => s.trim()).filter(Boolean) };
      options = [];
      break;
    }
    case 'open':
      answer = { sample: answer?.sample || null }; options = [];
      break;
    case 'dropdown': {
      const ids = blankIds(text);
      const byId = new Map(options.map((b) => [str(b.id), b]));
      options = ids.map((id) => {
        const b = byId.get(id) || { choices: [] };
        const choices = (b.choices || []).map((c) => ({ id: str(c.id || rid()), text: str(c.text) }));
        const correct = choices.some((c) => c.id === b.correct) ? b.correct : choices[0]?.id || null;
        return { id, choices, correct };
      });
      answer = null;
      break;
    }
    case 'dragdrop': {
      const ids = blankIds(text);
      const byId = new Map(options.map((b) => [str(b.id), b]));
      options = ids.map((id) => ({ id, answer: str(byId.get(id)?.answer).trim() }));
      extra.distractors = (extra.distractors || []).map(String).map((s) => s.trim()).filter(Boolean);
      answer = null;
      break;
    }
    case 'categorize': {
      const cats = (extra.categories || []).map((c) => ({ id: str(c.id || rid()), name: str(c.name) }));
      const catIds = new Set(cats.map((c) => c.id));
      extra.categories = cats;
      options = options.map((i) => ({ id: str(i.id || rid()), text: str(i.text), image: i.image || null, cat: catIds.has(i.cat) ? i.cat : cats[0]?.id || null }));
      answer = null;
      break;
    }
    case 'hottext': {
      options = options.map((u) => ({ id: str(u.id || rid()), text: str(u.text) }));
      const ids = new Set(options.map((u) => u.id));
      answer = (Array.isArray(answer) ? answer : []).map(String).filter((a) => ids.has(a));
      extra.unit = extra.unit === 'sentence' ? 'sentence' : 'word';
      break;
    }
    case 'matchgrid': {
      options = options.map((r) => ({ id: str(r.id || rid()), text: str(r.text) }));
      extra.columns = (extra.columns || []).map((c) => ({ id: str(c.id || rid()), text: str(c.text) }));
      extra.multi = !!extra.multi;
      const colIds = new Set(extra.columns.map((c) => c.id));
      const a = answer && typeof answer === 'object' && !Array.isArray(answer) ? answer : {};
      answer = Object.fromEntries(options.map((r) => {
        let v = (Array.isArray(a[r.id]) ? a[r.id] : []).filter((c) => colIds.has(c));
        if (!extra.multi) v = v.slice(0, 1);
        return [r.id, v];
      }));
      break;
    }
    case 'tablefill': {
      const t = extra.table || {};
      const cols = (t.cols || []).map(String);
      const rows = (t.rows || []).map((row) => cols.map((_, ci) => {
        const c = row?.[ci];
        if (c?.t === 'blank') return { t: 'blank', id: str(c.id || rid()), accepted: (c.accepted || []).map(String).map((s) => s.trim()).filter(Boolean) };
        return { t: 'text', v: str(c?.v) };
      }));
      extra.table = { cols, rows };
      options = []; answer = null;
      break;
    }
    case 'labeling':
      options = options.map((t) => ({ id: str(t.id || rid()), text: str(t.text), x: num(t.x, 50), y: num(t.y, 50) }));
      extra.distractors = (extra.distractors || []).map(String).map((s) => s.trim()).filter(Boolean);
      answer = null;
      break;
    case 'hotspot': {
      options = options.map((r) => ({ id: str(r.id || rid()), x: num(r.x, 10), y: num(r.y, 10), w: num(r.w, 20), h: num(r.h, 20) }));
      const ids = new Set(options.map((r) => r.id));
      answer = (Array.isArray(answer) ? answer : []).map(String).filter((a) => ids.has(a));
      break;
    }
    case 'graphing':
      extra.xmin = num(extra.xmin, -10); extra.xmax = num(extra.xmax, 10);
      extra.ymin = num(extra.ymin, -10); extra.ymax = num(extra.ymax, 10);
      extra.mode = extra.mode === 'line' ? 'line' : 'points';
      answer = { points: (answer?.points || []).map((p) => [num(p[0], 0), num(p[1], 0)]) };
      if (extra.mode === 'line') answer.points = answer.points.slice(0, 2);
      options = [];
      break;
    case 'crossword': {
      // layout is always rebuilt here from the words, never taken from the input
      const seen = new Set();
      if (!options.length && Array.isArray(input.words)) options = input.words;
      options = options.filter((o) => o && typeof o === 'object').map((o) => {
        let id = str(o.id || rid());
        if (seen.has(id)) id = rid();
        seen.add(id);
        return { id, answer: str(o.answer ?? o.word).trim(), clue: str(o.clue).trim() };
      }).filter((o) => Array.from(cwNormalize(o.answer)).length >= 2).slice(0, 30);
      const { rows, cols, entries } = buildLayout(options);
      extra.layout = { rows, cols, entries };
      answer = null;
      break;
    }
    default:
      options = []; answer = null;
  }
  if (typeof extra.passage === 'string' && !extra.passage.trim()) delete extra.passage;

  return {
    type, text, image: input.image || null, options, answer,
    points: Math.min(20, Math.max(1, parseInt(input.points, 10) || 1)),
    time_limit: Math.min(900, Math.max(5, parseInt(input.time_limit, 10) || 30)),
    explanation: input.explanation || null,
    extra,
  };
}

/** Problems that block publishing, per question. */
export function questionProblems(q) {
  const p = [];
  const plain = String(q.text || '').replace(/\[\[[^\]]+\]\]/g, '').trim();
  if (!plain && !q.image && !['hottext', 'tablefill'].includes(q.type)) p.push('has no question text');
  const opts = q.options || [];
  switch (q.type) {
    case 'mcq': case 'msq':
      if (opts.length < 2) p.push('needs at least 2 options');
      if (!(q.answer || []).length) p.push('needs a correct answer');
      break;
    case 'poll': case 'reorder': if (opts.length < 2) p.push('needs at least 2 options'); break;
    case 'fill': case 'math': if (!(q.answer?.accepted || []).length) p.push('needs an accepted answer'); break;
    case 'match': case 'categorize': case 'labeling': if (opts.length < 2) p.push('needs at least 2 items'); break;
    case 'dropdown': case 'dragdrop': if (!opts.length) p.push('needs at least one blank'); break;
    case 'hottext': case 'hotspot': if (!(q.answer || []).length) p.push('needs a correct selection'); break;
    case 'tablefill': if (!(q.extra?.table?.rows || []).flat().some((c) => c?.t === 'blank')) p.push('needs at least one blank cell'); break;
    case 'graphing': if (!(q.answer?.points || []).length) p.push('needs the correct points'); break;
    case 'crossword':
      if (opts.length < 2) p.push('needs at least 2 words');
      if (opts.some((o) => !String(o.clue || '').trim())) p.push('needs a clue for every word');
      break;
    default:
  }
  if (['labeling', 'hotspot'].includes(q.type) && !q.image) p.push('needs an image');
  return p;
}
