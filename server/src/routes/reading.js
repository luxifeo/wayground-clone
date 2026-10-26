import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { one, tx } from '../db.js';
import { requireAuth } from '../auth.js';
import { translate } from '../i18n.js';
import { keepContext, log } from '../log.js';
import { insertQuestions, loadQuiz } from './quizzes.js';
import { BASE_SCHEMA, fromAI, valid } from './ai.js';
import {
  CROP_ROUNDS, MAX_CROP_ROUNDS, convertWorksheet, tidyPassage, createJob, cropFigure, detectPage, getJob, pool, preparePage, saveUpload, step, writeFromPhoto,
} from '../reading.js';

export const readingRouter = Router();
const MAX_FILES = 6;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: MAX_FILES },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif|bmp|tiff)$/.test(file.mimetype)),
});
const TYPES = ['mcq', 'msq', 'tf', 'fill', 'dropdown', 'dragdrop', 'reorder', 'match', 'open'];
const int = (v, d, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : d));

// quiz settings use these exact values (client/src/lib/constants.js)
const SUBJECTS = ['Mathematics', 'English', 'Science', 'Social Studies', 'History', 'Geography', 'Computers', 'World Languages', 'Physics', 'Chemistry', 'Biology', 'Arts', 'Physical Ed', 'Other'];
const SUBJECT_HINTS = [[/math|toán/i, 'Mathematics'], [/english|esl|tiếng anh/i, 'English'], [/physic|vật lý/i, 'Physics'], [/chemi|hoá|hóa/i, 'Chemistry'],
  [/biolog|sinh học/i, 'Biology'], [/history|lịch sử/i, 'History'], [/geograph|địa/i, 'Geography'], [/science|khoa học/i, 'Science'], [/comput|tin học/i, 'Computers'],
  [/art|mỹ thuật|âm nhạc|music/i, 'Arts'], [/social|xã hội/i, 'Social Studies'], [/language|tiếng|ngữ văn|văn|reading/i, 'World Languages']];
const subjectOf = (s) => (!s ? null : SUBJECTS.find((x) => x.toLowerCase() === String(s).toLowerCase()) || SUBJECT_HINTS.find(([re]) => re.test(s))?.[1] || null);
const ordinal = (n) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'} Grade`;
function gradeOf(g) {
  if (!g) return null;
  if (/^(\d{1,2}(st|nd|rd|th) Grade|Kindergarten|University|Professional Development)$/.test(g)) return g;
  if (/kinder|mẫu giáo|preschool/i.test(g)) return 'Kindergarten';
  if (/univers|college|đại học/i.test(g)) return 'University';
  const n = parseInt(String(g).match(/\d{1,2}/)?.[0], 10); // "6th-8th Grade" -> 6th, "Lớp 4" -> 4th
  return n >= 1 && n <= 12 ? ordinal(n) : null;
}

readingRouter.get('/ai/reading/config', requireAuth, (_req, res) => {
  res.json({ cropRounds: CROP_ROUNDS, maxCropRounds: MAX_CROP_ROUNDS, maxFiles: MAX_FILES });
});

readingRouter.post('/ai/reading', requireAuth, keepContext(upload.array('files', MAX_FILES)), async (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: 'Upload at least one image' });
  const b = req.body || {};
  if (b.quizId) {
    const quiz = await one('SELECT owner_id FROM quizzes WHERE id=$1', [b.quizId]);
    if (!quiz || quiz.owner_id !== req.user.id) return res.status(404).json({ error: 'Quiz not found' });
  }
  const types = String(b.types || 'mcq,tf,fill').split(',').map((s) => s.trim()).filter((s) => TYPES.includes(s));
  const opts = {
    mode: ['worksheet', 'photo'].includes(b.mode) ? b.mode : 'auto',
    language: String(b.language || '').slice(0, 40) || null,
    grade: String(b.grade || '').slice(0, 40) || null,
    subject: String(b.subject || '').slice(0, 40) || null,
    genre: String(b.genre || 'nonfiction'),
    paragraphs: int(b.paragraphs, 4, 2, 8),
    questions: int(b.questions, 6, 2, 15),
    types: types.length ? types : ['mcq', 'tf', 'fill'],
    words: String(b.words || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20),
    crossword: b.crossword === 'true' || b.crossword === true,
    topic: String(b.topic || '').slice(0, 500),
    cropRounds: int(b.cropRounds, CROP_ROUNDS, 0, MAX_CROP_ROUNDS),
    quizId: b.quizId ? Number(b.quizId) : null,
  };
  const lang = /^vi\b/i.test(String(req.headers['accept-language'] || '')) ? 'vi' : 'en';
  const job = createJob(req.user.id, lang, opts.mode);
  const t0 = Date.now();
  log.info('ai.reading.start', {
    job: job.id, mode: opts.mode, quiz: opts.quizId, files: files.map((f) => ({ name: f.originalname.slice(0, 120), type: f.mimetype, size: f.size })),
  }, req);
  run(job, files.map((f) => f.buffer), opts, req.user.id).then(() => {
    log.info('ai.reading.done', { job: job.id, kind: job.kind, ...job.result, figures: job.figures.map((f) => f.url), ms: Date.now() - t0 }, req);
  }, (e) => {
    log.error('ai.reading.failed', { job: job.id, ms: Date.now() - t0, err: e }, req);
    job.status = 'error';
    job.error = e.message || 'AI request failed';
    job.steps.forEach((s) => { if (s.status === 'running') s.status = 'error'; });
  });
  res.json({ jobId: job.id });
});

readingRouter.get('/ai/jobs/:id', requireAuth, (req, res) => {
  const job = getJob(req.params.id);
  if (!job || job.userId !== req.user.id) return res.status(404).json({ error: 'Job not found' });
  const { userId: _u, created: _c, lang: _l, ...pub } = job;
  res.json({ ...pub, error: job.error && translate(job.error, job.lang) });
});

/** Short progress texts written by the server, in the teacher's language. */
const say = (job, en, vi) => (job.lang === 'vi' ? vi : en);

async function run(job, buffers, opts, userId) {
  // 1. pages at their original resolution
  step(job, 'upload', 'running');
  const pages = await Promise.all(buffers.map((b) => preparePage(b)));
  step(job, 'upload', 'done', pages.map((p, i) => `${say(job, 'Image', 'Ảnh')} ${i + 1}: ${p.width}×${p.height}px`).join(' · '));

  // 2. worksheet or photo?
  step(job, 'detect', 'running', say(job, 'Looking at the images…', 'Đang xem các ảnh…'));
  const detected = await pool(pages, 3, async (p) => (opts.mode === 'photo' ? { kind: 'photo', figures: [] } : detectPage(p)));
  pages.forEach((p, i) => {
    const d = detected[i] || { kind: 'photo', figures: [] };
    p.kind = opts.mode === 'worksheet' ? 'worksheet' : d.kind === 'worksheet' ? 'worksheet' : 'photo';
    p.figures = p.kind === 'worksheet' ? d.figures || [] : [];
    p.meta = d;
  });
  job.kind = pages.every((p) => p.kind === 'worksheet') ? 'worksheet' : pages.every((p) => p.kind === 'photo') ? 'photo' : 'mixed';
  step(job, 'detect', 'done', pages.map((p, i) => `${say(job, 'Image', 'Ảnh')} ${i + 1}: ${p.kind === 'worksheet'
    ? say(job, `worksheet, ${p.figures.length} figure(s)`, `phiếu bài tập, ${p.figures.length} hình`)
    : say(job, 'photo', 'ảnh thường')}`).join(' · '));

  // 3. crop + review every figure
  const allFigs = pages.flatMap((p, pi) => p.figures.map((f) => ({ page: p, pi, f })));
  if (!allFigs.length) step(job, 'crop', 'skipped');
  else {
    step(job, 'crop', 'running', say(job, `Cropping ${allFigs.length} figure(s)…`, `Đang cắt ${allFigs.length} hình…`));
    await pool(allFigs, 3, async ({ page, pi, f }) => {
      const view = { id: `${pi + 1}-${f.id}`, page: pi + 1, what: f.what, url: null, rounds: [] };
      job.figures.push(view);
      const out = await cropFigure(page, f, opts.cropRounds, (r) => view.rounds.push({ url: r.url, verdict: r.verdict }));
      f.url = out.url;
      view.url = out.url;
    });
    const reviewed = job.figures.reduce((a, f) => a + f.rounds.length, 0);
    step(job, 'crop', 'done', say(job, `${allFigs.length} figure(s), ${reviewed} review round(s)`, `${allFigs.length} hình, ${reviewed} lượt soát`));
  }

  // 4. write passages for photos / convert worksheets
  const photos = pages.filter((p) => p.kind === 'photo');
  if (!photos.length) step(job, 'write', 'skipped');
  step(job, 'questions', 'running');
  const schema = BASE_SCHEMA;
  const results = await pool(pages, 2, async (p) => {
    const n = pages.indexOf(p) + 1;
    if (p.kind === 'worksheet') {
      step(job, 'questions', 'running', say(job, `Converting the exercises on image ${n}…`, `Đang chuyển các bài tập ở ảnh ${n}…`));
      return convertWorksheet(p, p.figures, { ...opts, schema });
    }
    step(job, 'write', 'running', say(job, `Writing a passage about image ${n}…`, `Đang viết bài đọc cho ảnh ${n}…`));
    // the photo itself illustrates its passage
    const small = await sharp(p.buf).resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    p.photoUrl = saveUpload(small);
    return writeFromPhoto(p, { ...opts, language: opts.language || 'English', schema });
  });
  if (photos.length) step(job, 'write', 'done', say(job, `${photos.length} passage(s) written`, `Đã viết ${photos.length} bài đọc`));

  // 5. flatten passages -> questions with passage fields
  const list = [];
  let title = null; let subject = opts.subject; let grade = opts.grade; let language = opts.language;
  let pid = 0;
  pages.forEach((p, i) => {
    const r = results[i];
    if (!r) return;
    title ||= r.title || p.meta?.title;
    subject ||= r.subject || p.meta?.subject || null;
    grade ||= r.grade || p.meta?.grade || null;
    language ||= r.language || p.meta?.language || null;
    for (const ps of (Array.isArray(r.passages) ? r.passages : []).map(tidyPassage)) {
      pid += 1;
      const fig = p.figures.find((f) => f.id === ps.figure) || null;
      const extra = {
        passageId: `p${pid}`, passageTitle: String(ps.title || '').slice(0, 300) || null,
        passage: String(ps.text || '').trim(), passageImage: fig?.url || (p.kind === 'photo' ? p.photoUrl : null) || null,
      };
      for (const raw of Array.isArray(ps.questions) ? ps.questions : []) {
        const q = fromAI(raw);
        q.extra = { ...(q.extra || {}), ...extra };
        if (valid(q)) list.push(q);
      }
    }
  });
  const failed = results.filter((r) => !r).length;
  if (!list.length) throw new Error('The AI did not return any usable questions. Try again.');
  step(job, 'questions', 'done', say(job, `${list.length} question(s) in ${pid} passage(s)`, `${list.length} câu hỏi trong ${pid} bài đọc`)
    + (failed ? say(job, ` · ${failed} image(s) failed`, ` · ${failed} ảnh bị lỗi`) : ''));

  // 6. save
  step(job, 'save', 'running');
  let quizId = opts.quizId;
  await tx(async (c) => {
    if (!quizId) {
      const r = await c.query(
        'INSERT INTO quizzes(owner_id,title,subject,grade,language,source) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
        [userId, String(title || say(job, 'Reading test', 'Bài thi đọc')).slice(0, 64), subjectOf(subject), gradeOf(grade), language || 'English', 'ai-reading']);
      quizId = r.rows[0].id;
      await insertQuestions(c, quizId, list, 0);
    } else await insertQuestions(c, quizId, list);
  });
  const quiz = await loadQuiz(quizId);
  job.result = { quizId, added: list.length, title: quiz?.title };
  step(job, 'save', 'done', say(job, `${list.length} question(s) saved`, `Đã lưu ${list.length} câu hỏi`));
  job.status = 'done';
}
