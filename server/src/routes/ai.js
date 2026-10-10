import { Router } from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { one, many, tx } from '../db.js';
import { requireAuth } from '../auth.js';
import { chatJson, llmStatus, LLMError } from '../llm.js';
import { loadQuiz, insertQuestions } from './quizzes.js';
import { applyGrade } from './sessions.js';
import { computeScore, normalizeQuestion, questionProblems } from '../grading.js';
import { broadcast } from '../realtime.js';

export const aiRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 10 } });

const MAX_TEXT = 30000;

const QUESTION_SCHEMA = `Each question is a JSON object using ONE of these shapes:
{"type":"mcq","text":"question","options":["A","B","C","D"],"correct":[index of the right option],"explanation":"why","time_limit":30}
{"type":"msq","text":"question (more than one answer)","options":["A","B","C","D"],"correct":[indexes of ALL right options],"explanation":"why","time_limit":45}
{"type":"tf","text":"statement","correct":true,"explanation":"why","time_limit":20}
{"type":"fill","text":"sentence with a blank shown as ____","accepted":["answer","alternative spelling"],"explanation":"why","time_limit":45}
{"type":"open","text":"open question","sample":"a model answer","time_limit":120}
{"type":"poll","text":"opinion question","options":["A","B","C"],"time_limit":20}
{"type":"reorder","text":"put these in the right order","items":["first","second","third","fourth"],"explanation":"why","time_limit":60}
{"type":"match","text":"match the pairs","pairs":[{"left":"term","right":"definition"}],"explanation":"why","time_limit":60}
{"type":"dropdown","text":"Sentence where each gap is written as [[1]], [[2]] ...","blanks":[{"options":["right word","wrong","wrong"],"correct":0}],"time_limit":60}
{"type":"dragdrop","text":"Sentence where each gap is written as [[1]], [[2]] ...","blanks":["word for gap 1","word for gap 2"],"distractors":["extra wrong word"],"time_limit":60}
{"type":"categorize","text":"Sort the items into the right group","categories":["Group A","Group B"],"items":[{"text":"item","category":0}],"time_limit":60}
{"type":"math","text":"Simplify 2(x+3)","accepted":["2x+6"],"explanation":"why","time_limit":60}
Indexes in "correct" are 0-based. Options must be short, plausible and only one correct for mcq.`;

const SYSTEM = 'You are an expert teacher who writes high quality assessment questions. You always answer with valid JSON only, no markdown, no commentary.';

const TYPE_NAMES = {
  mcq: 'multiple choice', msq: 'multi-select', tf: 'true/false', fill: 'fill in the blank',
  open: 'open ended', poll: 'poll', reorder: 'reorder', match: 'match',
  dropdown: 'dropdown blanks', dragdrop: 'drag and drop blanks', categorize: 'categorize', math: 'math response',
};

function rid() { return Math.random().toString(36).slice(2, 8); }

/** Convert the compact AI shape into our question format. */
export function fromAI(raw) {
  const type = TYPE_NAMES[raw?.type] ? raw.type : 'mcq';
  const base = {
    type, text: String(raw.text || raw.question || '').trim(), explanation: raw.explanation || null,
    time_limit: parseInt(raw.time_limit, 10) || ({ open: 120, reorder: 60, match: 60, msq: 45, fill: 45, tf: 20, poll: 20 }[type] || 30),
    points: parseInt(raw.points, 10) || 1,
  };
  const toIdx = (c, opts) => {
    if (typeof c === 'number') return c;
    if (typeof c === 'string') {
      if (/^\d+$/.test(c)) return parseInt(c, 10);
      const i = opts.findIndex((o) => String(o).trim().toLowerCase() === c.trim().toLowerCase());
      if (i >= 0) return i;
      if (/^[A-Z]$/i.test(c)) return c.toUpperCase().charCodeAt(0) - 65;
    }
    return -1;
  };
  if (['mcq', 'msq', 'poll'].includes(type)) {
    const opts = (raw.options || []).map((o) => (typeof o === 'object' ? o.text : o)).map(String);
    const options = opts.map((t) => ({ id: rid(), text: t }));
    let correct = Array.isArray(raw.correct) ? raw.correct : raw.correct !== undefined ? [raw.correct] : [];
    correct = correct.map((c) => toIdx(c, opts)).filter((i) => i >= 0 && i < options.length);
    if (type === 'mcq' && correct.length > 1) base.type = 'msq';
    return { ...base, options, answer: type === 'poll' ? null : correct.map((i) => options[i].id) };
  }
  if (type === 'tf') {
    const c = raw.correct;
    const isTrue = Array.isArray(c) ? String(c[0]).toLowerCase() === 'true' || c[0] === 0 : String(c).toLowerCase() === 'true';
    return { ...base, answer: [isTrue ? 'true' : 'false'] };
  }
  if (type === 'dropdown') {
    let i = 0; const ids = [];
    const text = base.text.replace(/\[\[[^\]]*\]\]|_{3,}/g, () => { const id = `b${++i}`; ids.push(id); return `[[${id}]]`; });
    const options = ids.map((id, k) => {
      const b = (raw.blanks || [])[k] || {};
      const choices = (b.options || []).map((t) => ({ id: rid(), text: String(t) }));
      const ci = toIdx(b.correct ?? 0, b.options || []);
      return { id, choices, correct: choices[ci >= 0 ? ci : 0]?.id };
    });
    return { ...base, text, options };
  }
  if (type === 'dragdrop') {
    let i = 0; const ids = [];
    const text = base.text.replace(/\[\[[^\]]*\]\]|_{3,}/g, () => { const id = `b${++i}`; ids.push(id); return `[[${id}]]`; });
    return { ...base, text, options: ids.map((id, k) => ({ id, answer: String((raw.blanks || [])[k] ?? '') })), extra: { distractors: (raw.distractors || []).map(String) } };
  }
  if (type === 'categorize') {
    const cats = (raw.categories || []).map((n) => ({ id: rid(), name: String(n) }));
    const options = (raw.items || []).map((it) => ({ id: rid(), text: String(it.text ?? it), cat: cats[toIdx(it.category ?? 0, (raw.categories || []))]?.id || cats[0]?.id }));
    return { ...base, options, extra: { categories: cats } };
  }
  if (type === 'math') {
    const acc = raw.accepted || raw.correct || [];
    return { ...base, answer: { accepted: (Array.isArray(acc) ? acc : [acc]).map(String) } };
  }
  if (type === 'fill') {
    const acc = raw.accepted || raw.answers || raw.correct || [];
    return { ...base, answer: { accepted: (Array.isArray(acc) ? acc : [acc]).map(String) } };
  }
  if (type === 'open') return { ...base, answer: { sample: raw.sample || null } };
  if (type === 'reorder') return { ...base, options: (raw.items || raw.options || []).map((t) => ({ id: rid(), text: String(t) })) };
  if (type === 'match') {
    return { ...base, options: (raw.pairs || []).map((p) => ({ id: rid(), left: String(p.left ?? ''), right: String(p.right ?? '') })) };
  }
  return base;
}

/** Turn a stored question back into the compact AI shape (for context). */
function toAI(q) {
  const out = { type: q.type, text: q.text };
  if (['mcq', 'msq', 'poll'].includes(q.type)) {
    out.options = q.options.map((o) => o.text);
    if (q.type !== 'poll') out.correct = q.options.map((o, i) => ((q.answer || []).includes(o.id) ? i : -1)).filter((i) => i >= 0);
  }
  if (q.type === 'tf') out.correct = (q.answer || [])[0] === 'true';
  if (q.type === 'fill') out.accepted = q.answer?.accepted || [];
  if (q.type === 'open') out.sample = q.answer?.sample || '';
  if (q.type === 'reorder') out.items = q.options.map((o) => o.text);
  if (q.type === 'match') out.pairs = q.options.map((p) => ({ left: p.left, right: p.right }));
  if (q.type === 'math') out.accepted = q.answer?.accepted || [];
  if (q.type === 'dropdown') out.blanks = q.options.map((b) => ({ options: b.choices.map((c) => c.text), correct: b.choices.findIndex((c) => c.id === b.correct) }));
  if (q.type === 'dragdrop') { out.blanks = q.options.map((b) => b.answer); out.distractors = q.extra?.distractors || []; }
  if (q.type === 'categorize') {
    const cats = q.extra?.categories || [];
    out.categories = cats.map((c) => c.name);
    out.items = q.options.map((i) => ({ text: i.text, category: cats.findIndex((c) => c.id === i.cat) }));
  }
  if (q.extra?.passage) out.passage = q.extra.passage;
  if (q.explanation) out.explanation = q.explanation;
  return out;
}

const valid = (q) => { const n = normalizeQuestion(q); return n.text.trim() && questionProblems(n).length === 0; };

async function extractSources(files = [], url) {
  const texts = []; const images = [];
  for (const f of files) {
    const name = f.originalname.toLowerCase();
    if (f.mimetype.startsWith('image/')) {
      images.push(`data:${f.mimetype};base64,${f.buffer.toString('base64')}`);
    } else if (name.endsWith('.pdf') || f.mimetype === 'application/pdf') {
      const data = await pdf(f.buffer);
      if (!data.text.trim()) throw new LLMError(`"${f.originalname}" looks like a scanned PDF with no text. Upload page images instead.`);
      texts.push(`# ${f.originalname}\n${data.text}`);
    } else if (name.endsWith('.docx')) {
      const r = await mammoth.extractRawText({ buffer: f.buffer });
      texts.push(`# ${f.originalname}\n${r.value}`);
    } else if (/\.(txt|md|csv|json|html?)$/.test(name) || f.mimetype.startsWith('text/')) {
      texts.push(`# ${f.originalname}\n${f.buffer.toString('utf8')}`);
    } else {
      throw new LLMError(`Unsupported file type: ${f.originalname}. Use PDF, DOCX, TXT or images.`);
    }
  }
  if (url) {
    let r;
    try { r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0 WaygroundClone' } }); } catch (e) {
      throw new LLMError(`Could not fetch ${url}: ${e.message}`);
    }
    const html = await r.text();
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    texts.push(`# ${url}\n${text}`);
  }
  return { text: texts.join('\n\n').slice(0, MAX_TEXT), images };
}

function wrap(fn) {
  return async (req, res) => {
    try { await fn(req, res); } catch (e) {
      if (e instanceof LLMError) return res.status(502).json({ error: e.message });
      console.error(e);
      res.status(500).json({ error: e.message || 'AI request failed' });
    }
  };
}

aiRouter.get('/ai/status', requireAuth, async (_req, res) => res.json(await llmStatus()));

/** Generate a brand new quiz (or append to quizId) from a topic, pasted text, files, url. */
aiRouter.post('/ai/generate', requireAuth, upload.array('files', 10), wrap(async (req, res) => {
  const b = req.body || {};
  const count = Math.min(30, Math.max(1, parseInt(b.count, 10) || 10));
  let types = b.types;
  if (typeof types === 'string') types = types.split(',').filter(Boolean);
  if (!Array.isArray(types) || !types.length) types = ['mcq'];
  const language = b.language || 'English';
  const { text, images } = await extractSources(req.files, b.url);
  const topic = String(b.topic || '').trim();
  if (!topic && !text && !images.length) return res.status(400).json({ error: 'Enter a topic, paste text or upload a file' });

  const prompt = [
    `Create an assessment of exactly ${count} questions.`,
    topic && `Topic / instructions: ${topic}`,
    b.grade && `Grade level: ${b.grade}.`,
    b.difficulty && `Difficulty: ${b.difficulty}.`,
    `Write everything in ${language}.`,
    `Use only these question types: ${types.map((t) => `${t} (${TYPE_NAMES[t] || t})`).join(', ')}. Mix them if more than one.`,
    text && `Base the questions strictly on this source material:\n"""\n${text}\n"""`,
    images.length ? 'Base the questions on the attached image(s): read any text, diagrams, charts or worksheet content in them.' : '',
    QUESTION_SCHEMA,
    'Respond with JSON: {"title":"short quiz title","subject":"one of Mathematics, English, Science, Social Studies, History, Geography, Computers, World Languages, Arts, Physics, Chemistry, Biology, Other","grade":"grade if known","questions":[...]}',
  ].filter(Boolean).join('\n\n');

  const out = await chatJson({ system: SYSTEM, prompt, images });
  let list = (Array.isArray(out) ? out : out.questions || []).map(fromAI).filter(valid);
  // keep only the requested types when the model strays (mcq may become msq)
  const wanted = list.filter((q) => types.includes(q.type) || (q.type === 'msq' && types.includes('mcq')));
  if (wanted.length) list = wanted;
  if (!list.length) return res.status(502).json({ error: 'The AI did not return any usable questions. Try again.' });

  if (b.quizId) {
    const quiz = await one('SELECT * FROM quizzes WHERE id=$1 AND owner_id=$2', [b.quizId, req.user.id]);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    await tx((c) => insertQuestions(c, quiz.id, list));
    return res.json({ quiz: await loadQuiz(quiz.id), added: list.length });
  }
  const quizId = await tx(async (c) => {
    const r = await c.query(
      'INSERT INTO quizzes(owner_id,title,subject,grade,language,source) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
      [req.user.id, String(out.title || topic || 'AI generated quiz').slice(0, 64), out.subject || null,
        b.grade || out.grade || null, language, (req.files?.length || b.url) ? 'ai-upload' : 'ai-prompt']);
    await insertQuestions(c, r.rows[0].id, list, 0);
    return r.rows[0].id;
  });
  res.json({ quiz: await loadQuiz(quizId), added: list.length });
}));

async function myQuiz(req, res) {
  const quiz = await loadQuiz(req.params.id);
  if (!quiz || quiz.owner_id !== req.user.id) { res.status(404).json({ error: 'Quiz not found' }); return null; }
  return quiz;
}

/** Add questions similar to the given ones (or to the whole quiz). */
aiRouter.post('/ai/quizzes/:id/similar', requireAuth, wrap(async (req, res) => {
  const quiz = await myQuiz(req, res); if (!quiz) return;
  const ids = (req.body.questionIds || []).map(Number);
  const base = ids.length ? quiz.questions.filter((q) => ids.includes(q.id)) : quiz.questions;
  if (!base.length) return res.status(400).json({ error: 'Add a question first' });
  const count = Math.min(20, Math.max(1, parseInt(req.body.count, 10) || (ids.length ? 2 * base.length : 5)));
  const prompt = [
    `Here are existing questions of the quiz "${quiz.title}" (${quiz.subject || 'general'}, ${quiz.grade || 'any grade'}):`,
    JSON.stringify(base.slice(0, 15).map(toAI)),
    `Write ${count} NEW questions that test the same concepts at the same difficulty, using the same question types and language. Do not repeat the existing questions.`,
    QUESTION_SCHEMA,
    'Respond with JSON: {"questions":[...]}',
  ].join('\n\n');
  const out = await chatJson({ system: SYSTEM, prompt });
  const list = (Array.isArray(out) ? out : out.questions || []).map(fromAI).filter(valid);
  if (!list.length) return res.status(502).json({ error: 'The AI did not return any usable questions. Try again.' });
  let pos = null;
  if (ids.length === 1) {
    pos = base[0].position + 1;
    await many('UPDATE questions SET position=position+$3 WHERE quiz_id=$1 AND position>=$2', [quiz.id, pos, list.length]);
  }
  await tx((c) => insertQuestions(c, quiz.id, list, pos));
  res.json({ quiz: await loadQuiz(quiz.id), added: list.length });
}));

/** Write answer explanations for questions that miss one (or all with overwrite). */
aiRouter.post('/ai/quizzes/:id/explanations', requireAuth, wrap(async (req, res) => {
  const quiz = await myQuiz(req, res); if (!quiz) return;
  const targets = quiz.questions.filter((q) => !['poll', 'open', 'draw'].includes(q.type) && (req.body.overwrite || !q.explanation));
  if (!targets.length) return res.json({ quiz, updated: 0 });
  const prompt = [
    `Write a short, student friendly explanation (1-3 sentences, in ${quiz.language || 'the question language'}) of why the correct answer is right for each question.`,
    JSON.stringify(targets.map((q) => ({ id: q.id, ...toAI(q) }))),
    'Respond with JSON: {"explanations":[{"id":<question id>,"explanation":"..."}]}',
  ].join('\n\n');
  const out = await chatJson({ system: SYSTEM, prompt });
  let n = 0;
  for (const e of out.explanations || []) {
    if (targets.some((q) => q.id === Number(e.id)) && e.explanation) {
      await one('UPDATE questions SET explanation=$2 WHERE id=$1 RETURNING id', [Number(e.id), String(e.explanation)]);
      n++;
    }
  }
  res.json({ quiz: await loadQuiz(quiz.id), updated: n });
}));

/** Translate the quiz into another language as a new copy. */
aiRouter.post('/ai/quizzes/:id/translate', requireAuth, wrap(async (req, res) => {
  const quiz = await myQuiz(req, res); if (!quiz) return;
  const language = String(req.body.language || '').trim();
  if (!language) return res.status(400).json({ error: 'Choose a language' });
  const prompt = [
    `Translate this quiz into ${language}. Keep the same JSON structure, the same number of questions, options and correct indexes. Only translate human readable text (title, text, options, items, pairs, accepted answers, sample, explanation).`,
    JSON.stringify({ title: quiz.title, questions: quiz.questions.map(toAI) }),
    'Respond with JSON: {"title":"...","questions":[...]}',
  ].join('\n\n');
  const out = await chatJson({ system: SYSTEM, prompt });
  const translated = (out.questions || []).map(fromAI);
  // keep media / points / timers from the source
  const list = quiz.questions.map((q, i) => ({ ...(translated[i] || {}), image: q.image, points: q.points, time_limit: q.time_limit }))
    .filter(valid);
  const newId = await tx(async (c) => {
    const r = await c.query(
      `INSERT INTO quizzes(owner_id,title,subject,grade,language,visibility,cover_image,source) VALUES($1,$2,$3,$4,$5,$6,$7,'translate') RETURNING id`,
      [req.user.id, String(out.title || `${quiz.title} (${language})`).slice(0, 64), quiz.subject, quiz.grade, language, quiz.visibility, quiz.cover_image]);
    await insertQuestions(c, r.rows[0].id, list, 0);
    return r.rows[0].id;
  });
  res.json({ quiz: await loadQuiz(newId) });
}));

/** Rewrite a single question (not saved — the editor applies it). */
aiRouter.post('/ai/questions/:qid/enhance', requireAuth, wrap(async (req, res) => {
  const q = req.params.qid === 'new'
    ? await one('SELECT owner_id, language FROM quizzes WHERE id=$1', [req.body.quizId])
    : await one('SELECT x.*, q.owner_id, q.language FROM questions x JOIN quizzes q ON q.id=x.quiz_id WHERE x.id=$1', [req.params.qid]);
  if (!q || q.owner_id !== req.user.id) return res.status(404).json({ error: 'Question not found' });
  const draft = req.body.question || q;
  const actions = {
    easier: 'Make this question easier while testing the same concept.',
    harder: 'Make this question harder while testing the same concept.',
    rephrase: 'Rephrase the question to be clearer and more engaging. Keep the same answers.',
    fix: 'Fix grammar, spelling and any factual mistakes. Keep it otherwise identical.',
    distractors: 'Improve the wrong options so they are plausible distractors. Keep the correct answer.',
    explanation: 'Keep the question identical but add a short explanation of the correct answer.',
  };
  const prompt = [
    actions[req.body.action] || actions.rephrase,
    `Keep the same question type and language (${q.language || 'same as input'}).`,
    JSON.stringify(toAI({ ...q, ...draft })),
    QUESTION_SCHEMA,
    'Respond with JSON: {"question":{...}}',
  ].join('\n\n');
  const out = await chatJson({ system: SYSTEM, prompt });
  const nq = fromAI(out.question || out);
  if (!valid(nq)) return res.status(502).json({ error: 'The AI returned an unusable question. Try again.' });
  res.json({ question: { ...nq, image: draft.image || null, points: draft.points, time_limit: draft.time_limit } });
}));

/** Grade open-ended / fill responses of a session with the model. */
aiRouter.post('/ai/sessions/:id/grade', requireAuth, wrap(async (req, res) => {
  const s = await one('SELECT * FROM sessions WHERE id=$1', [req.params.id]);
  if (!s || s.host_id !== req.user.id) return res.status(404).json({ error: 'Session not found' });
  const qid = req.body.questionId ? Number(req.body.questionId) : null;
  const rows = await many(
    `SELECT * FROM responses WHERE session_id=$1 AND status='ungraded' AND ($2::int IS NULL OR question_id=$2)`, [s.id, qid]);
  const byQ = new Map();
  for (const r of rows) {
    const q = s.quiz_snapshot.questions.find((x) => x.id === r.question_id);
    if (!q || q.type !== 'open') continue;
    if (!byQ.has(q.id)) byQ.set(q.id, { q, rs: [] });
    byQ.get(q.id).rs.push(r);
  }
  let graded = 0;
  for (const { q, rs } of byQ.values()) {
    const prompt = [
      `Grade student answers to this open question. Give each a score from 0 to 1 (0, 0.5 or 1) and one sentence of feedback addressed to the student.`,
      `Question: ${q.text}`,
      q.answer?.sample ? `Model answer: ${q.answer.sample}` : 'There is no model answer; use your expert judgement.',
      JSON.stringify(rs.map((r) => ({ id: r.id, answer: typeof r.answer === 'string' ? r.answer : JSON.stringify(r.answer) }))),
      'Respond with JSON: {"grades":[{"id":<response id>,"score":0..1,"feedback":"..."}]}',
    ].join('\n\n');
    const out = await chatJson({ system: SYSTEM, prompt });
    for (const g of out.grades || []) {
      const r = rs.find((x) => x.id === Number(g.id));
      if (!r) continue;
      const fraction = Math.max(0, Math.min(1, Number(g.score) || 0));
      const status = fraction >= 1 ? 'correct' : fraction > 0 ? 'partial' : 'incorrect';
      const score = computeScore({ q, fraction, timeMs: 0, timerOn: false, streak: 0, gameType: s.game_type });
      await applyGrade(r, { status, fraction, score, feedback: g.feedback });
      graded++;
    }
  }
  broadcast(s.id);
  res.json({ graded });
}));
