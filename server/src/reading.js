// Reading test generator: worksheet photo -> the same exercises as an online test (figures cropped and
// reviewed by the model), ordinary photo -> a passage written about it plus questions.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chatJson, LLMError } from './llm.js';
import { UPLOAD_DIR, pool } from './images.js';

const MAX_SIDE = 1600; // longest side of the copy sent to the model
const READING_SYSTEM = 'You are an expert teacher who turns worksheets and pictures into reading tests. You always answer with valid JSON only, no markdown, no commentary.';
export const MAX_CROP_ROUNDS = 5;
export const CROP_ROUNDS = Math.max(0, Math.min(MAX_CROP_ROUNDS, parseInt(process.env.CROP_REVIEW_ROUNDS ?? '3', 10) || 0));

const dataUrl = (buf, mime = 'image/jpeg') => `data:${mime};base64,${buf.toString('base64')}`;

function saveUpload(buf, ext = '.jpg') {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = `${crypto.randomBytes(10).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return `/uploads/${name}`;
}

/** Original-resolution page (EXIF rotation applied) plus the smaller copy the model sees. */
export async function preparePage(buffer) {
  const { data, info } = await sharp(buffer, { failOn: 'none' }).rotate().jpeg({ quality: 92 }).toBuffer({ resolveWithObject: true });
  const sent = await sharp(data).resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
  return { buf: data, width: info.width, height: info.height, sentUrl: dataUrl(sent.data), sentW: sent.info.width, sentH: sent.info.height };
}

/**
 * Boxes from the model are [x0, y0, x1, y1] normalized to 0-1000 of the image. Some answers come back in pixels of
 * the copy we sent; those are converted. Returns a clamped normalized box or null.
 */
export function normBox(raw, page) {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  let b = raw.map(Number);
  if (b.some((v) => !Number.isFinite(v))) return null;
  if (Math.max(b[0], b[2]) > 1000 || Math.max(b[1], b[3]) > 1000) {
    b = [(b[0] / page.sentW) * 1000, (b[1] / page.sentH) * 1000, (b[2] / page.sentW) * 1000, (b[3] / page.sentH) * 1000];
  }
  let [x0, y0, x1, y1] = b.map((v) => Math.max(0, Math.min(1000, v)));
  if (x1 < x0) [x0, x1] = [x1, x0];
  if (y1 < y0) [y0, y1] = [y1, y0];
  if (x1 - x0 < 15 || y1 - y0 < 15) return null; // too small to be a figure
  return [x0, y0, x1, y1];
}

/** Normalized box -> pixel rectangle in the ORIGINAL resolution. */
export function toPixels(box, page) {
  const left = Math.max(0, Math.floor((box[0] / 1000) * page.width));
  const top = Math.max(0, Math.floor((box[1] / 1000) * page.height));
  const right = Math.min(page.width, Math.ceil((box[2] / 1000) * page.width));
  const bottom = Math.min(page.height, Math.ceil((box[3] / 1000) * page.height));
  return { left, top, width: Math.max(8, right - left), height: Math.max(8, bottom - top) };
}

const cropAt = (page, box) => sharp(page.buf).extract(toPixels(box, page)).jpeg({ quality: 90 }).toBuffer();

/**
 * The area around a box (30% margin each side) with the box drawn in red, so the reviewer can see both sides of
 * every edge. A crop alone cannot show whether the figure continues past its edge.
 */
async function contextView(page, box) {
  const mw = (box[2] - box[0]) * 0.3; const mh = (box[3] - box[1]) * 0.3;
  const outer = [box[0] - mw, box[1] - mh, box[2] + mw, box[3] + mh].map((v) => Math.max(0, Math.min(1000, v)));
  const o = toPixels(outer, page); const b = toPixels(box, page);
  const stroke = Math.max(2, Math.round(Math.max(o.width, o.height) / 250));
  const svg = `<svg width="${o.width}" height="${o.height}"><rect x="${b.left - o.left}" y="${b.top - o.top}" width="${b.width}" height="${b.height}" fill="none" stroke="#ff0000" stroke-width="${stroke}"/></svg>`;
  const img = sharp(page.buf).extract(o).composite([{ input: Buffer.from(svg) }]);
  // keep it legible but small enough for the model
  return img.resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
}

// ------------------------------------------------------------ detect

/** Is the page a worksheet or an ordinary photo, and where are its figures? */
export async function detectPage(page) {
  const out = await chatJson({
    system: 'You analyse images of school material. You always answer with valid JSON only.',
    temperature: 0,
    maxTokens: 1500,
    images: [page.sentUrl],
    prompt: `The image is ${page.width} x ${page.height} pixels in its original resolution.
1. "kind": "worksheet" if it is a worksheet, textbook or exam page, exercise sheet or printed text with tasks to do; "photo" if it is an ordinary picture (a scene, people, animals, objects, a drawing) without exercises; "other" if it is blank or unreadable.
2. For a worksheet, list the figures a student needs to SEE to do an exercise: photos, illustrations, maps, charts, diagrams, pictures of objects. Do NOT list crossword or word-search grids, tables of text, answer lines, plain text, logos, icons, page numbers or decorations.
   Each figure: {"id": "f1", "what": "short description of what it shows", "exercise": "exercise number it belongs to, or null", "bbox": [x0, y0, x1, y1]}
   bbox coordinates are normalized from 0 to 1000 across the image (x0, y0 = top-left corner, x1, y1 = bottom-right corner).
3. The content language, a likely school subject and grade, a short title for the page.
Respond: {"kind": "worksheet|photo|other", "language": "English", "subject": "...", "grade": "...", "title": "...", "summary": "one sentence about what it shows", "figures": [...]}`,
  });
  const kind = ['worksheet', 'photo', 'other'].includes(out.kind) ? out.kind : 'photo';
  const figures = (Array.isArray(out.figures) ? out.figures : []).slice(0, 8)
    .map((f, i) => ({ id: String(f.id || `f${i + 1}`), what: String(f.what || 'figure').slice(0, 160), exercise: f.exercise == null ? null : String(f.exercise), box: normBox(f.bbox, page) }))
    .filter((f) => f.box);
  return { ...out, kind, figures };
}

// ------------------------------------------------------------ crop review

const EDGES = ['top', 'bottom', 'left', 'right'];
const EDGE_VALUES = ['cut', 'extra', 'ok'];

/**
 * Crops a figure and lets the model review the crop up to `rounds` times. The model judges each edge of the crop
 * ("cut" = figure continues past it, "extra" = unrelated content inside, "ok"); locating is hard for the model,
 * describing a crop is easy. Each edge is then moved by a binary search between an inner and an outer limit, so
 * noisy answers cannot make it oscillate. onRound({ round, url, verdict, box }) is called after each round.
 */
export async function cropFigure(page, fig, rounds, onRound = () => {}) {
  const clamp = (v) => Math.max(0, Math.min(1000, v));
  // a little breathing room around the first guess
  let box = [clamp(fig.box[0] - 8), clamp(fig.box[1] - 8), clamp(fig.box[2] + 8), clamp(fig.box[3] + 8)];
  const w0 = box[2] - box[0]; const h0 = box[3] - box[1];
  // per edge: [inner limit, outer limit] in normalized coords (edge index 0 = left, 1 = top, 2 = right, 3 = bottom)
  const span = [0.35 * w0, 0.35 * h0, 0.35 * w0, 0.35 * h0];
  const sign = [-1, -1, 1, 1]; // direction that makes the box bigger
  const limits = box.map((v, i) => [clamp(v - sign[i] * span[i]), clamp(v + sign[i] * span[i])]);
  let best = box;
  for (let r = 1; r <= rounds; r++) {
    const crop = await cropAt(page, box);
    const url = saveUpload(crop);
    const ctx = await contextView(page, box);
    let v;
    try {
      v = await chatJson({
        system: 'You inspect image crops. You always answer with valid JSON only.',
        temperature: 0,
        maxTokens: 400,
        images: [dataUrl(ctx), dataUrl(crop)],
        prompt: `Image 1 shows part of a page with a RED rectangle drawn on it. Image 2 is exactly what is inside the red rectangle.
The red rectangle should enclose exactly: "${fig.what}" — only the picture/drawing area itself. Text lines, headings, captions, exercise text and other pictures or grids are NOT part of it.
For each edge of the red rectangle, compare what is just inside and just outside it in image 1:
- "cut": the picture continues OUTSIDE this red edge (part of the picture is missing)
- "extra": INSIDE the red edge, between the picture and the edge, there is other content (text lines, headings, captions, blank margin, another figure or grid)
- "ok": the red edge runs right along the border of the picture
Also say whether image 2 contains the ${fig.what} at all.
Respond: {"contains": true|false, "top": "cut|extra|ok", "bottom": "cut|extra|ok", "left": "cut|extra|ok", "right": "cut|extra|ok"}`,
      });
    } catch (e) {
      onRound({ round: r, url, verdict: `review failed: ${e.message}` });
      break;
    }
    const sides = Object.fromEntries(EDGES.map((s) => [s, EDGE_VALUES.includes(v[s]) ? v[s] : 'ok']));
    const verdict = v.contains === false ? 'figure not in crop' : EDGES.map((s) => `${s} ${sides[s]}`).join(', ');
    onRound({ round: r, url, verdict, box });
    if (v.contains === false) { box = best; break; } // went wrong: keep the last good box
    best = box;
    if (EDGES.every((s) => sides[s] === 'ok')) break;
    // binary search: "cut" -> the true edge is further out, "extra" -> further in
    const next = box.map((v, i) => {
      const verdictForEdge = sides[['left', 'top', 'right', 'bottom'][i]];
      const [inner, outer] = limits[i];
      if (verdictForEdge === 'cut') { limits[i] = [v, outer]; return (v + outer) / 2; }
      if (verdictForEdge === 'extra') { limits[i] = [inner, v]; return (inner + v) / 2; }
      return v;
    }).map(clamp);
    if (next[2] - next[0] < 15 || next[3] - next[1] < 15) break;
    box = next;
  }
  const finalCrop = await cropAt(page, rounds ? box : fig.box);
  return { url: saveUpload(finalCrop), box };
}

// ------------------------------------------------------------ generation

const GAP_RULES = `How to turn exercise types into questions (always solve the exercise yourself and give the CORRECT answers; the page has no answer key):
- A text (email, letter, story, dialogue) with gaps to complete -> ONE "dragdrop" question whose "text" is the WHOLE text with each gap written as [[1]], [[2]] ... in order (keep line breaks as \\n), "blanks" = the correct words in order, "distractors" = 2-4 plausible wrong words. If the exercise gives a word box, use exactly those words.
- A list of separate sentences to complete -> one "fill" question per sentence (the sentence with ____ for the gap, "accepted" = all correct spellings/variants), or "dropdown" when choices are printed.
- Prompts to turn into full sentences/questions/dialogue lines -> one "fill" per prompt with every acceptable full answer in "accepted" (with and without contractions), or "open" with a "sample" when many answers are possible.
- Multiple choice / true-false / matching / ordering tasks -> "mcq", "tf", "match", "reorder".
- A crossword -> ONE "crossword" question: "words" = every answer word with its printed clue (read the Across and Down clue lists; the answer is what the student must write, e.g. clue "Spain" -> answer "SPANISH" when the task asks for nationalities). Do not copy the printed grid; we build a new one.
- A reading text with comprehension questions -> the passage "text" is the full reading text, then the questions about it.`;

/** One passage per exercise of a worksheet page. */
export async function convertWorksheet(page, figures, { language, grade, subject, schema }) {
  const figList = figures.length
    ? figures.map((f) => `- ${f.id}: ${f.what}${f.exercise ? ` (exercise ${f.exercise})` : ''}`).join('\n')
    : '(none)';
  return chatJson({
    system: READING_SYSTEM,
    temperature: 0.2,
    maxTokens: 8192,
    images: [page.sentUrl],
    prompt: `Convert this worksheet page into an online reading test with the SAME exercises, in the same order and the same language as the page (do not translate).
${language ? `Interface language for any text you add: ${language}.` : ''}${grade ? ` Grade: ${grade}.` : ''}${subject ? ` Subject: ${subject}.` : ''}
For each exercise make one passage: {"title": exercise number + instruction exactly as printed, "text": the text to read for that exercise or "" when the questions hold all the text, "figure": id of the figure the exercise uses or null, "questions": [...]}.
Figures cut from the page:
${figList}
${GAP_RULES}
Skip examples that are already completed on the page (e.g. the first gap filled in as an example).
${schema}
Respond: {"title": "short test title", "subject": "...", "grade": "...", "language": "...", "passages": [...]}`,
  });
}

const GENRES = { nonfiction: 'non-fiction informational text', fiction: 'short story', poem: 'poem', dialogue: 'dialogue', news: 'news article', letter: 'letter or email' };

/** A passage written about an ordinary photo, with questions on it. */
export async function writeFromPhoto(page, opts) {
  const { language = 'English', grade, subject, genre = 'nonfiction', paragraphs = 4, questions = 6, types = ['mcq', 'tf', 'fill'], words = [], crossword = false, topic = '', schema } = opts;
  return chatJson({
    system: READING_SYSTEM,
    temperature: 0.5,
    maxTokens: 8192,
    images: [page.sentUrl],
    prompt: `Look carefully at this picture. Write a ${GENRES[genre] || GENRES.nonfiction} of ${paragraphs} paragraphs in ${language}${grade ? ` for ${grade} students` : ''}${subject ? ` (${subject})` : ''} about what the picture shows: who or what is in it, where, what is happening, details a reader can learn from.
${words.length ? `Use all of these words: ${words.join(', ')}.` : ''}${topic ? `\nTeacher's instructions: ${topic}` : ''}
Separate paragraphs with \\n\\n. Then write exactly ${questions} questions about the passage in ${language}, using these types: ${types.join(', ')} (mix them). Every answer must be found in or inferred from the passage, not from outside knowledge.
${crossword ? `Also add ONE "crossword" question with 6-10 important words from the passage, each with a short clue (a definition or a sentence from the passage with the word missing) in ${language}.` : ''}
${schema}
Respond: {"title": "short title", "subject": "...", "passages": [{"title": "passage title", "text": "the passage", "questions": [...]}]}`,
  });
}

const plain = (s) => String(s || '').replace(/\[\[[^\]]*\]\]|_{2,}/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Cleans one generated passage: crossword clues lose printed numbering ("Across 2: Spain" -> "Spain", our grid is
 * renumbered), and the passage text is dropped when a question already shows that same text (gap-fill exercises).
 */
export function tidyPassage(ps) {
  const questions = (Array.isArray(ps.questions) ? ps.questions : []).map((q) => {
    if (q?.type !== 'crossword' || !Array.isArray(q.words)) return q;
    const clue = (c) => String(c || '').replace(/^\s*(?:(?:across|down|ngang|dọc)\s*\d*|\d+\s*(?:across|down|ngang|dọc)?)\s*[:.)-]\s*/i, '').trim();
    return { ...q, words: q.words.map((w) => ({ ...w, clue: clue(w.clue) })) };
  });
  let text = String(ps.text || '').trim();
  const p = plain(text);
  if (p.length > 40 && questions.some((q) => { const t = plain(q?.text); return t && (t.includes(p.slice(0, 60)) || p.includes(t.slice(0, 60))) && t.length > p.length * 0.6; })) text = '';
  return { ...ps, text, questions };
}

// ------------------------------------------------------------ jobs

const jobs = new Map();
const JOB_TTL = 60 * 60 * 1000;

export function createJob(userId, lang, mode) {
  for (const [k, j] of jobs) if (Date.now() - j.created > JOB_TTL) jobs.delete(k);
  const keys = ['upload', 'detect', 'crop', 'write', 'questions', 'save'];
  const job = {
    id: crypto.randomBytes(8).toString('hex'), userId, lang, created: Date.now(), status: 'running', kind: mode === 'auto' ? null : mode,
    steps: keys.map((key) => ({ key, status: 'pending', detail: '' })), figures: [], error: null, result: null,
  };
  jobs.set(job.id, job);
  return job;
}
export const getJob = (id) => jobs.get(id);
export function step(job, key, status, detail) {
  const s = job.steps.find((x) => x.key === key);
  if (!s) return;
  s.status = status;
  if (detail !== undefined) s.detail = detail;
}

export { pool, LLMError, saveUpload };
