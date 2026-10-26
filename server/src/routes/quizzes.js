import { Router } from 'express';
import { one, many, query, tx } from '../db.js';
import { requireAuth, optionalAuth } from '../auth.js';
import { normalizeQuestion, questionProblems } from '../grading.js';
import { log } from '../log.js';

export const quizRouter = Router();

const QUIZ_LIST_SQL = `
  SELECT q.*, u.name AS owner_name,
    (SELECT count(*)::int FROM questions x WHERE x.quiz_id=q.id) AS question_count,
    (SELECT coalesce(sum(points),0)::int FROM questions x WHERE x.quiz_id=q.id) AS total_points,
    (SELECT x.image FROM questions x WHERE x.quiz_id=q.id AND x.image IS NOT NULL ORDER BY position LIMIT 1) AS first_image
  FROM quizzes q JOIN users u ON u.id=q.owner_id`;

export async function loadQuiz(id) {
  const quiz = await one(`${QUIZ_LIST_SQL} WHERE q.id=$1`, [id]);
  if (!quiz) return null;
  quiz.questions = await many('SELECT * FROM questions WHERE quiz_id=$1 ORDER BY position, id', [id]);
  return quiz;
}

async function ownQuiz(req, res) {
  const quiz = await one('SELECT * FROM quizzes WHERE id=$1', [req.params.id]);
  if (!quiz) { res.status(404).json({ error: 'Quiz not found' }); return null; }
  if (quiz.owner_id !== req.user.id) { res.status(403).json({ error: 'Not your quiz' }); return null; }
  return quiz;
}

async function ownQuestion(req, res) {
  const q = await one('SELECT x.*, q.owner_id FROM questions x JOIN quizzes q ON q.id=x.quiz_id WHERE x.id=$1', [req.params.qid]);
  if (!q) { res.status(404).json({ error: 'Question not found' }); return null; }
  if (q.owner_id !== req.user.id) { res.status(403).json({ error: 'Not your question' }); return null; }
  return q;
}

const touch = (quizId) => query('UPDATE quizzes SET updated_at=now() WHERE id=$1', [quizId]);

/** Folder id sent by the client: null for the library root, false when it is not one of the user's folders. */
export async function folderTarget(userId, raw) {
  if (raw === null || raw === undefined || raw === '' || raw === 'root') return null;
  const f = await one('SELECT id FROM folders WHERE id=$1 AND owner_id=$2', [parseInt(raw, 10) || 0, userId]);
  return f ? f.id : false;
}

const folderName = (s) => String(s ?? '').trim().slice(0, 80);

export async function insertQuestions(client, quizId, questions, startPos = null) {
  let pos = startPos;
  if (pos === null) {
    const r = await client.query('SELECT coalesce(max(position),-1)+1 AS p FROM questions WHERE quiz_id=$1', [quizId]);
    pos = r.rows[0].p;
  }
  const out = [];
  for (const raw of questions) {
    const q = normalizeQuestion(raw);
    const r = await client.query(
      `INSERT INTO questions(quiz_id,position,type,text,image,options,answer,points,time_limit,explanation,extra)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [quizId, pos++, q.type, q.text, q.image, JSON.stringify(q.options), JSON.stringify(q.answer),
        q.points, q.time_limit, q.explanation, JSON.stringify(q.extra)],
    );
    out.push(r.rows[0]);
  }
  return out;
}

// ---------- lists ----------
quizRouter.get('/quizzes', requireAuth, async (req, res) => {
  const status = req.query.status;
  const params = [req.user.id];
  // folder=root: top level only, folder=<id>: that folder, none: the whole library (Home, search)
  let inFolder = 'true';
  if (req.query.folder === 'root') inFolder = 'q.folder_id IS NULL';
  else if (req.query.folder) { params.push(parseInt(req.query.folder, 10) || 0); inFolder = `q.folder_id=$${params.length}`; }
  const counts = await one(
    `SELECT count(*) FILTER (WHERE ${inFolder} AND status='published')::int AS published,
            count(*) FILTER (WHERE ${inFolder} AND status='draft')::int AS draft,
            count(*) FILTER (WHERE ${inFolder} AND status='archived')::int AS archived,
            count(*) FILTER (WHERE status<>'archived')::int AS total
     FROM quizzes q WHERE owner_id=$1`, [...params]);
  let where = `q.owner_id=$1 AND ${inFolder}`;
  if (status) { params.push(status); where += ` AND q.status=$${params.length}`; } else where += " AND q.status<>'archived'";
  if (req.query.q) { params.push(`%${req.query.q}%`); where += ` AND q.title ILIKE $${params.length}`; }
  const rows = await many(`${QUIZ_LIST_SQL} WHERE ${where} ORDER BY q.updated_at DESC`, params);
  res.json({ quizzes: rows, counts });
});

quizRouter.get('/quizzes/recent', requireAuth, async (req, res) => {
  const rows = await many(
    `${QUIZ_LIST_SQL} WHERE q.id IN (SELECT DISTINCT quiz_id FROM sessions WHERE host_id=$1 AND kind<>'preview')
     ORDER BY q.updated_at DESC LIMIT 30`, [req.user.id]);
  res.json({ quizzes: rows });
});

quizRouter.get('/explore', optionalAuth, async (req, res) => {
  const params = [];
  let where = "q.status='published' AND q.visibility='public'";
  if (req.query.q) {
    params.push(`%${req.query.q}%`);
    where += ` AND (q.title ILIKE $1 OR q.subject ILIKE $1 OR EXISTS (SELECT 1 FROM questions x WHERE x.quiz_id=q.id AND x.text ILIKE $1))`;
  }
  if (req.query.subject) { params.push(req.query.subject); where += ` AND q.subject=$${params.length}`; }
  if (req.query.grade) { params.push(req.query.grade); where += ` AND q.grade=$${params.length}`; }
  const rows = await many(`${QUIZ_LIST_SQL} WHERE ${where} ORDER BY q.plays DESC, q.updated_at DESC LIMIT 60`, params);
  res.json({ quizzes: rows });
});

quizRouter.get('/questions/search', requireAuth, async (req, res) => {
  const qtext = `%${req.query.q || ''}%`;
  const rows = await many(
    `SELECT x.*, q.title AS quiz_title FROM questions x JOIN quizzes q ON q.id=x.quiz_id
     WHERE ((q.status='published' AND q.visibility='public') OR q.owner_id=$2)
       AND (x.text ILIKE $1 OR q.title ILIKE $1)
       AND ($3::int IS NULL OR q.id<>$3)
     ORDER BY q.plays DESC, x.id DESC LIMIT 40`,
    [qtext, req.user.id, req.query.exclude ? parseInt(req.query.exclude, 10) : null]);
  res.json({ questions: rows });
});

// ---------- folders ----------
quizRouter.get('/folders', requireAuth, async (req, res) => {
  const folders = await many(
    `SELECT f.*, (SELECT count(*)::int FROM quizzes q WHERE q.folder_id=f.id) AS quiz_count
     FROM folders f WHERE f.owner_id=$1 ORDER BY lower(f.name), f.id`, [req.user.id]);
  res.json({ folders });
});

quizRouter.post('/folders', requireAuth, async (req, res) => {
  const name = folderName(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Enter a folder name' });
  const parent = await folderTarget(req.user.id, req.body.parent_id);
  if (parent === false) return res.status(404).json({ error: 'Folder not found' });
  const folder = await one('INSERT INTO folders(owner_id,parent_id,name) VALUES($1,$2,$3) RETURNING *', [req.user.id, parent, name]);
  log.info('folder.create', { folder: folder.id, name, parent }, req);
  res.json({ folder });
});

quizRouter.patch('/folders/:id', requireAuth, async (req, res) => {
  const name = folderName(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Enter a folder name' });
  const folder = await one('UPDATE folders SET name=$3 WHERE id=$1 AND owner_id=$2 RETURNING *', [req.params.id, req.user.id, name]);
  if (!folder) return res.status(404).json({ error: 'Folder not found' });
  log.info('folder.rename', { folder: folder.id, name }, req);
  res.json({ folder });
});

quizRouter.delete('/folders/:id', requireAuth, async (req, res) => {
  const folder = await one('SELECT * FROM folders WHERE id=$1 AND owner_id=$2', [req.params.id, req.user.id]);
  if (!folder) return res.status(404).json({ error: 'Folder not found' });
  // nothing inside is deleted: subfolders and activities move up one level
  await tx(async (c) => {
    await c.query('UPDATE folders SET parent_id=$2 WHERE parent_id=$1', [folder.id, folder.parent_id]);
    await c.query('UPDATE quizzes SET folder_id=$2 WHERE folder_id=$1', [folder.id, folder.parent_id]);
    await c.query('DELETE FROM folders WHERE id=$1', [folder.id]);
  });
  log.info('folder.delete', { folder: folder.id, name: folder.name }, req);
  res.json({ ok: true });
});

/** Move activities and folders into a folder (to: null = library root). */
quizRouter.post('/library/move', requireAuth, async (req, res) => {
  const b = req.body || {};
  const ids = (list) => (Array.isArray(list) ? list.map(Number).filter(Number.isInteger) : []);
  const quizIds = ids(b.quizzes);
  const folderIds = ids(b.folders);
  const to = await folderTarget(req.user.id, b.to);
  if (to === false) return res.status(404).json({ error: 'Folder not found' });
  if (to !== null && folderIds.length) {
    // a folder cannot go inside itself or one of its own subfolders
    const loop = await one(
      `WITH RECURSIVE up AS (
         SELECT id, parent_id FROM folders WHERE id=$1
         UNION SELECT f.id, f.parent_id FROM folders f JOIN up ON f.id=up.parent_id)
       SELECT 1 FROM up WHERE id = ANY($2::int[]) LIMIT 1`, [to, folderIds]);
    if (loop) return res.status(400).json({ error: 'A folder cannot be moved into itself' });
  }
  const moved = await tx(async (c) => {
    const q = await c.query('UPDATE quizzes SET folder_id=$3 WHERE owner_id=$1 AND id = ANY($2::int[])', [req.user.id, quizIds, to]);
    const f = await c.query('UPDATE folders SET parent_id=$3 WHERE owner_id=$1 AND id = ANY($2::int[])', [req.user.id, folderIds, to]);
    return { quizzes: q.rowCount, folders: f.rowCount };
  });
  log.info('library.move', { to, quizzes: quizIds, folders: folderIds }, req);
  res.json(moved);
});

// ---------- quiz CRUD ----------
quizRouter.post('/quizzes', requireAuth, async (req, res) => {
  const b = req.body || {};
  const folderId = (await folderTarget(req.user.id, b.folder_id)) || null;
  const quiz = await tx(async (c) => {
    const r = await c.query(
      `INSERT INTO quizzes(owner_id,title,subject,grade,language,source,folder_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.id, b.title || 'Untitled Quiz', b.subject || null, b.grade || null, b.language || 'English', b.source || 'scratch', folderId],
    );
    const qz = r.rows[0];
    if (Array.isArray(b.questions) && b.questions.length) await insertQuestions(c, qz.id, b.questions, 0);
    return qz;
  });
  res.json({ quiz: await loadQuiz(quiz.id) });
});

quizRouter.get('/quizzes/:id', optionalAuth, async (req, res) => {
  const quiz = await loadQuiz(req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  const isOwner = req.user && req.user.id === quiz.owner_id;
  if (!isOwner && !(quiz.status === 'published' && quiz.visibility === 'public')) {
    return res.status(403).json({ error: 'This quiz is private' });
  }
  res.json({ quiz, isOwner });
});

quizRouter.patch('/quizzes/:id', requireAuth, async (req, res) => {
  const quiz = await ownQuiz(req, res); if (!quiz) return;
  const fields = ['title', 'subject', 'grade', 'language', 'visibility', 'cover_image', 'teaching_goal', 'status'];
  const sets = []; const params = [];
  for (const f of fields) {
    if (f in (req.body || {})) { params.push(req.body[f]); sets.push(`${f}=$${params.length}`); }
  }
  if (sets.length) {
    params.push(quiz.id);
    await query(`UPDATE quizzes SET ${sets.join(',')}, updated_at=now() WHERE id=$${params.length}`, params);
    const changes = Object.fromEntries(fields.filter((f) => f in req.body && req.body[f] !== quiz[f]).map((f) => [f, req.body[f]]));
    if (Object.keys(changes).length) log.info('quiz.update', { quiz: quiz.id, changes }, req);
  }
  res.json({ quiz: await loadQuiz(quiz.id) });
});

quizRouter.post('/quizzes/:id/publish', requireAuth, async (req, res) => {
  const quiz = await ownQuiz(req, res); if (!quiz) return;
  const full = await loadQuiz(quiz.id);
  const problems = [];
  if (!full.questions.length) problems.push('Add at least one question');
  if (!full.title || full.title === 'Untitled Quiz') problems.push('Give your quiz a name');
  if (!full.subject) problems.push('Select a subject');
  if (!full.grade) problems.push('Select a grade');
  full.questions.forEach((q, i) => questionProblems(q).forEach((m) => problems.push(`Question ${i + 1} ${m}`)));
  if (problems.length) return res.status(400).json({ error: problems[0], problems });
  await query("UPDATE quizzes SET status='published', updated_at=now() WHERE id=$1", [quiz.id]);
  log.info('quiz.publish', { quiz: quiz.id, title: full.title }, req);
  res.json({ quiz: await loadQuiz(quiz.id) });
});

quizRouter.post('/quizzes/:id/duplicate', requireAuth, async (req, res) => {
  const src = await loadQuiz(req.params.id);
  if (!src) return res.status(404).json({ error: 'Quiz not found' });
  if (src.owner_id !== req.user.id && !(src.status === 'published' && src.visibility === 'public')) {
    return res.status(403).json({ error: 'This quiz is private' });
  }
  const copy = await tx(async (c) => {
    const r = await c.query(
      `INSERT INTO quizzes(owner_id,title,subject,grade,language,visibility,cover_image,teaching_goal,source,status,folder_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,'copy','draft',$9) RETURNING *`,
      [req.user.id, src.owner_id === req.user.id ? `${src.title} (copy)` : src.title, src.subject, src.grade,
        src.language, src.visibility, src.cover_image, src.teaching_goal, src.owner_id === req.user.id ? src.folder_id : null],
    );
    await insertQuestions(c, r.rows[0].id, src.questions, 0);
    return r.rows[0];
  });
  res.json({ quiz: await loadQuiz(copy.id) });
});

quizRouter.delete('/quizzes/:id', requireAuth, async (req, res) => {
  const quiz = await ownQuiz(req, res); if (!quiz) return;
  await query('DELETE FROM quizzes WHERE id=$1', [quiz.id]);
  log.info('quiz.delete', { quiz: quiz.id, title: quiz.title }, req);
  res.json({ ok: true });
});

// ---------- questions ----------
quizRouter.post('/quizzes/:id/questions', requireAuth, async (req, res) => {
  const quiz = await ownQuiz(req, res); if (!quiz) return;
  const list = Array.isArray(req.body.questions) ? req.body.questions : [req.body];
  const created = await tx(async (c) => {
    let pos = null;
    if (Number.isInteger(req.body.position)) {
      pos = req.body.position;
      await c.query('UPDATE questions SET position=position+$3 WHERE quiz_id=$1 AND position>=$2', [quiz.id, pos, list.length]);
    }
    return insertQuestions(c, quiz.id, list, pos);
  });
  for (const x of created.filter((q) => q.image)) {
    log.info('question.image', { quiz: quiz.id, question: x.id, from: null, to: x.image, credit: x.extra?.imageCredit }, req);
  }
  await touch(quiz.id);
  res.json({ questions: created, question: created[0] });
});

quizRouter.put('/questions/:qid', requireAuth, async (req, res) => {
  const cur = await ownQuestion(req, res); if (!cur) return;
  const q = normalizeQuestion({ ...cur, ...req.body });
  const row = await one(
    `UPDATE questions SET type=$2,text=$3,image=$4,options=$5,answer=$6,points=$7,time_limit=$8,explanation=$9,extra=$10
     WHERE id=$1 RETURNING *`,
    [cur.id, q.type, q.text, q.image, JSON.stringify(q.options), JSON.stringify(q.answer), q.points, q.time_limit,
      q.explanation, JSON.stringify(q.extra)],
  );
  if ((cur.image || null) !== (row.image || null)) {
    log.info('question.image', { quiz: cur.quiz_id, question: cur.id, from: cur.image, to: row.image, credit: row.extra?.imageCredit }, req);
  }
  await touch(cur.quiz_id);
  res.json({ question: row });
});

quizRouter.patch('/quizzes/:id/questions-bulk', requireAuth, async (req, res) => {
  // bulk update points / time_limit for every question
  const quiz = await ownQuiz(req, res); if (!quiz) return;
  if (req.body.points) await query('UPDATE questions SET points=$2 WHERE quiz_id=$1', [quiz.id, Math.max(1, Math.min(20, +req.body.points))]);
  if (req.body.time_limit) await query('UPDATE questions SET time_limit=$2 WHERE quiz_id=$1', [quiz.id, Math.max(5, Math.min(900, +req.body.time_limit))]);
  await touch(quiz.id);
  res.json({ quiz: await loadQuiz(quiz.id) });
});

quizRouter.delete('/questions/:qid', requireAuth, async (req, res) => {
  const cur = await ownQuestion(req, res); if (!cur) return;
  await query('DELETE FROM questions WHERE id=$1', [cur.id]);
  log.info('question.delete', { quiz: cur.quiz_id, question: cur.id, image: cur.image || undefined }, req);
  await touch(cur.quiz_id);
  res.json({ ok: true });
});

quizRouter.post('/questions/:qid/duplicate', requireAuth, async (req, res) => {
  const cur = await ownQuestion(req, res); if (!cur) return;
  const created = await tx(async (c) => {
    await c.query('UPDATE questions SET position=position+1 WHERE quiz_id=$1 AND position>$2', [cur.quiz_id, cur.position]);
    return insertQuestions(c, cur.quiz_id, [cur], cur.position + 1);
  });
  await touch(cur.quiz_id);
  res.json({ question: created[0] });
});

quizRouter.post('/quizzes/:id/reorder', requireAuth, async (req, res) => {
  const quiz = await ownQuiz(req, res); if (!quiz) return;
  const ids = (req.body.ids || []).map(Number);
  await tx(async (c) => {
    for (let i = 0; i < ids.length; i++) {
      await c.query('UPDATE questions SET position=$1 WHERE id=$2 AND quiz_id=$3', [i, ids[i], quiz.id]);
    }
  });
  await touch(quiz.id);
  res.json({ quiz: await loadQuiz(quiz.id) });
});
