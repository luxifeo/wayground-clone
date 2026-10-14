import { Router } from 'express';
import crypto from 'node:crypto';
import { one, many, query } from '../db.js';
import { requireAuth } from '../auth.js';
import { loadQuiz } from './quizzes.js';
import { grade, computeScore, sanitizeQuestion, revealFor, shuffle, UNGRADED_TYPES, SCORING_MODES } from '../grading.js';
import {
  broadcast, hostState, playerState, loadSession, leaderboard, setQuestionTimer, clearQuestionTimer, dropPlayer, getIO, anonymize,
} from '../realtime.js';

export const sessionRouter = Router();

export const DEFAULT_SETTINGS = {
  attempts: 0,              // 0 = unlimited
  timer: false,             // student-paced: use per-question timers
  shuffleQuestions: true,
  shuffleAnswers: true,
  showAnswers: 'on',        // after each question: on | validate | off
  showAnswersAfter: 'on',   // in summary: on | questions | off
  leaderboard: true,
  memes: true,
  music: false,
  skipQuestions: false,
  anonymize: false,
  serious: false,
  redemption: false,
  scoring: 'classic',       // classic (speed + streak bonus) | perQuestion (1 point per correct question)
};

async function uniqueCode() {
  for (let i = 0; i < 50; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const used = await one("SELECT 1 FROM sessions WHERE code=$1 AND status<>'ended'", [code]);
    if (!used) return code;
  }
  throw new Error('Could not allocate a game code');
}

async function ownSession(req, res) {
  const s = await loadSession(req.params.id);
  if (!s) { res.status(404).json({ error: 'Session not found' }); return null; }
  if (s.host_id !== req.user.id) { res.status(403).json({ error: 'Not your session' }); return null; }
  return s;
}

const isExpired = (s) => s.deadline && new Date(s.deadline) < new Date();

// ---------------------------------------------------------------- host side
sessionRouter.post('/sessions', requireAuth, async (req, res) => {
  const b = req.body || {};
  const quiz = await loadQuiz(b.quizId);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  if (quiz.owner_id !== req.user.id && !(quiz.status === 'published' && quiz.visibility === 'public')) {
    return res.status(403).json({ error: 'This quiz is private' });
  }
  if (!quiz.questions.length) return res.status(400).json({ error: 'This quiz has no questions' });
  const kind = ['live', 'homework', 'preview'].includes(b.kind) ? b.kind : 'live';
  const pace = kind === 'live' && b.pace === 'teacher' ? 'teacher' : 'student';
  const gameType = b.gameType === 'test' ? 'test' : 'classic';
  const settings = { ...DEFAULT_SETTINGS, ...(b.settings || {}) };
  if (!SCORING_MODES.includes(settings.scoring)) settings.scoring = 'classic';
  if (gameType === 'test') { settings.leaderboard = false; settings.memes = false; settings.showAnswers = settings.showAnswers === 'on' ? 'off' : settings.showAnswers; }
  if (kind === 'preview') { settings.shuffleQuestions = false; }
  const snapshot = {
    title: quiz.title, subject: quiz.subject, grade: quiz.grade, cover_image: quiz.cover_image,
    questions: quiz.questions.map((q) => ({
      id: q.id, type: q.type, text: q.text, image: q.image, options: q.options, answer: q.answer,
      points: q.points, time_limit: q.time_limit, explanation: q.explanation, extra: q.extra,
    })),
  };
  const autoRun = kind !== 'live';
  const s = await one(
    `INSERT INTO sessions(quiz_id,host_id,code,title,kind,pace,game_type,settings,quiz_snapshot,status,started_at,deadline)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id, code`,
    [quiz.id, req.user.id, await uniqueCode(), b.title || quiz.title, kind, pace, gameType, JSON.stringify(settings),
      JSON.stringify(snapshot), autoRun ? 'running' : 'lobby', autoRun ? new Date() : null, b.deadline || null],
  );
  if (kind !== 'preview') await query('UPDATE quizzes SET plays=plays+1 WHERE id=$1', [quiz.id]);
  res.json({ session: s });
});

sessionRouter.get('/sessions', requireAuth, async (req, res) => {
  const params = [req.user.id];
  let where = "s.host_id=$1 AND s.kind<>'preview'";
  if (req.query.status === 'running') where += " AND s.status<>'ended'";
  if (req.query.status === 'completed') where += " AND s.status='ended'";
  if (req.query.kind) { params.push(req.query.kind); where += ` AND s.kind=$${params.length}`; }
  if (req.query.q) { params.push(`%${req.query.q}%`); where += ` AND coalesce(s.title,'') ILIKE $${params.length}`; }
  if (req.query.quizId) { params.push(+req.query.quizId); where += ` AND s.quiz_id=$${params.length}`; }
  const rows = await many(
    `SELECT s.id, s.quiz_id, s.code, s.title, s.kind, s.pace, s.game_type, s.status, s.deadline, s.created_at, s.started_at, s.ended_at,
       (SELECT count(*)::int FROM participants p WHERE p.session_id=s.id AND NOT p.kicked) AS participants,
       (SELECT round(avg(r.fraction)*100)::int FROM responses r WHERE r.session_id=s.id AND r.status NOT IN ('ungraded')) AS accuracy,
       jsonb_array_length(s.quiz_snapshot->'questions') AS question_count
     FROM sessions s WHERE ${where} ORDER BY s.created_at DESC LIMIT 200`, params);
  res.json({ sessions: rows });
});

sessionRouter.get('/sessions/:id', requireAuth, async (req, res) => {
  const s = await ownSession(req, res); if (!s) return;
  res.json(await hostState(s.id));
});

sessionRouter.patch('/sessions/:id', requireAuth, async (req, res) => {
  const s = await ownSession(req, res); if (!s) return;
  if ('title' in req.body) await query('UPDATE sessions SET title=$2 WHERE id=$1', [s.id, req.body.title]);
  if ('deadline' in req.body) await query('UPDATE sessions SET deadline=$2 WHERE id=$1', [s.id, req.body.deadline]);
  if (req.body.settings) {
    // scoring is fixed once the session exists: past scores cannot be recomputed (streaks are not stored)
    const { scoring: _locked, ...settings } = req.body.settings;
    await query('UPDATE sessions SET settings=settings || $2::jsonb WHERE id=$1', [s.id, JSON.stringify(settings)]);
  }
  broadcast(s.id, { players: true });
  res.json(await hostState(s.id));
});

sessionRouter.delete('/sessions/:id', requireAuth, async (req, res) => {
  const s = await ownSession(req, res); if (!s) return;
  await query('DELETE FROM sessions WHERE id=$1', [s.id]);
  res.json({ ok: true });
});

async function showQuestion(s, index) {
  const total = s.quiz_snapshot.questions.length;
  if (index >= total) return endSession(s.id);
  await query("UPDATE sessions SET current_index=$2, phase='question', question_started=now() WHERE id=$1", [s.id, index]);
  const q = s.quiz_snapshot.questions[index];
  setQuestionTimer(s.id, (q.time_limit + 1) * 1000, () => revealQuestion(s.id));
  broadcast(s.id, { players: true });
}

async function revealQuestion(sessionId) {
  clearQuestionTimer(sessionId);
  const s = await loadSession(sessionId);
  if (!s || s.status !== 'running' || s.phase !== 'question') return;
  await query("UPDATE sessions SET phase='reveal' WHERE id=$1", [sessionId]);
  broadcast(sessionId, { players: true });
}

async function endSession(sessionId) {
  clearQuestionTimer(sessionId);
  await query("UPDATE sessions SET status='ended', phase='idle', ended_at=now() WHERE id=$1 AND status<>'ended'", [sessionId]);
  await query('UPDATE participants SET finished_at=coalesce(finished_at, now()) WHERE session_id=$1', [sessionId]);
  broadcast(sessionId, { players: true });
}

sessionRouter.post('/sessions/:id/start', requireAuth, async (req, res) => {
  const s = await ownSession(req, res); if (!s) return;
  if (s.status === 'lobby') {
    await query("UPDATE sessions SET status='running', started_at=now() WHERE id=$1", [s.id]);
    if (s.pace === 'teacher') await showQuestion({ ...s, status: 'running' }, 0);
  }
  broadcast(s.id, { players: true });
  res.json(await hostState(s.id));
});

sessionRouter.post('/sessions/:id/reveal', requireAuth, async (req, res) => {
  const s = await ownSession(req, res); if (!s) return;
  await revealQuestion(s.id);
  res.json(await hostState(s.id));
});

sessionRouter.post('/sessions/:id/leaderboard', requireAuth, async (req, res) => {
  const s = await ownSession(req, res); if (!s) return;
  clearQuestionTimer(s.id);
  await query("UPDATE sessions SET phase='leaderboard' WHERE id=$1", [s.id]);
  broadcast(s.id, { players: true });
  res.json(await hostState(s.id));
});

sessionRouter.post('/sessions/:id/next', requireAuth, async (req, res) => {
  const s = await ownSession(req, res); if (!s) return;
  if (s.status !== 'running' || s.pace !== 'teacher') return res.status(400).json({ error: 'Not a running teacher-led session' });
  await showQuestion(s, s.current_index + 1);
  res.json(await hostState(s.id));
});

sessionRouter.post('/sessions/:id/end', requireAuth, async (req, res) => {
  const s = await ownSession(req, res); if (!s) return;
  await endSession(s.id);
  res.json(await hostState(s.id));
});

sessionRouter.post('/sessions/:id/reopen', requireAuth, async (req, res) => {
  const s = await ownSession(req, res); if (!s) return;
  const used = await one("SELECT 1 FROM sessions WHERE code=$1 AND status<>'ended' AND id<>$2", [s.code, s.id]);
  const code = used ? await uniqueCode() : s.code;
  await query("UPDATE sessions SET status='running', ended_at=NULL, code=$2, deadline=$3 WHERE id=$1",
    [s.id, code, req.body.deadline || null]);
  res.json(await hostState(s.id));
});

sessionRouter.post('/sessions/:id/kick', requireAuth, async (req, res) => {
  const s = await ownSession(req, res); if (!s) return;
  const r = await query('UPDATE participants SET kicked=true WHERE id=$1 AND session_id=$2', [req.body.participantId, s.id]);
  if (r.rowCount) dropPlayer(req.body.participantId);
  broadcast(s.id);
  res.json(await hostState(s.id));
});

/** Cut a player off: they cannot keep playing, their results stay in the report. */
sessionRouter.post('/sessions/:id/participants/:pid/disconnect', requireAuth, async (req, res) => {
  const s = await ownSession(req, res); if (!s) return;
  const p = await one(
    'UPDATE participants SET disconnected=true, finished_at=coalesce(finished_at, now()) WHERE id=$1 AND session_id=$2 RETURNING id',
    [req.params.pid, s.id]);
  if (!p) return res.status(404).json({ error: 'Participant not found' });
  dropPlayer(p.id, { disconnected: true });
  broadcast(s.id, { players: true });
  res.json(await hostState(s.id));
});

/** Remove a player and all their answers from the session. */
sessionRouter.delete('/sessions/:id/participants/:pid', requireAuth, async (req, res) => {
  const s = await ownSession(req, res); if (!s) return;
  const p = await one('DELETE FROM participants WHERE id=$1 AND session_id=$2 RETURNING id', [req.params.pid, s.id]);
  if (!p) return res.status(404).json({ error: 'Participant not found' });
  dropPlayer(p.id);
  broadcast(s.id, { players: true });
  res.json(await hostState(s.id));
});

// ---------------------------------------------------------------- reports
sessionRouter.get('/sessions/:id/report', requireAuth, async (req, res) => {
  const s = await ownSession(req, res); if (!s) return;
  const state = await hostState(s.id);
  const responses = await many(
    `SELECT r.*, p.name FROM responses r JOIN participants p ON p.id=r.participant_id
     WHERE r.session_id=$1 AND NOT p.kicked ORDER BY r.created_at`, [s.id]);
  const questions = state.questions.map((q) => {
    const rs = responses.filter((r) => r.question_id === q.id);
    const graded = rs.filter((r) => r.status !== 'ungraded');
    return {
      ...q,
      attempts: rs.length,
      accuracy: graded.length ? Math.round((graded.reduce((a, r) => a + r.fraction, 0) / graded.length) * 100) : null,
      avgTime: rs.length ? Math.round(rs.reduce((a, r) => a + r.time_ms, 0) / rs.length / 1000) : null,
      responses: rs.map((r) => ({ id: r.id, participant_id: r.participant_id, name: r.name, answer: r.answer, status: r.status, fraction: r.fraction, score: r.score, time_ms: r.time_ms, feedback: r.feedback })),
    };
  });
  res.json({ ...state, questions });
});

/** Manual grading of a response (open ended, overrides). */
sessionRouter.patch('/responses/:rid', requireAuth, async (req, res) => {
  const r = await one(
    `SELECT r.*, s.host_id, s.quiz_snapshot, s.game_type, s.settings FROM responses r JOIN sessions s ON s.id=r.session_id WHERE r.id=$1`, [req.params.rid]);
  if (!r) return res.status(404).json({ error: 'Response not found' });
  if (r.host_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  const fraction = Math.max(0, Math.min(1, Number(req.body.fraction)));
  const q = r.quiz_snapshot.questions.find((x) => x.id === r.question_id) || { points: 1 };
  const status = fraction >= 1 ? 'correct' : fraction > 0 ? 'partial' : 'incorrect';
  const score = computeScore({ q, fraction, timeMs: 0, timerOn: false, streak: 0, gameType: r.game_type, scoring: r.settings?.scoring });
  await applyGrade(r, { status, fraction, score, feedback: req.body.feedback ?? r.feedback });
  broadcast(r.session_id);
  res.json({ ok: true, status, fraction, score });
});

export async function applyGrade(r, { status, fraction, score, feedback }) {
  await query('UPDATE responses SET status=$2, fraction=$3, score=$4, feedback=$5 WHERE id=$1', [r.id, status, fraction, score, feedback || null]);
  await query('UPDATE participants SET score=score+$2 WHERE id=$1', [r.participant_id, score - r.score]);
}

// ---------------------------------------------------------------- player side
const sessionPublic = (s) => ({
  id: s.id, code: s.code, title: s.title || s.quiz_snapshot.title, kind: s.kind, pace: s.pace, gameType: s.game_type,
  status: s.status, deadline: s.deadline, total: s.quiz_snapshot.questions.length,
  cover: s.quiz_snapshot.cover_image, subject: s.quiz_snapshot.subject,
  settings: {
    timer: s.pace === 'teacher' ? true : !!s.settings.timer, leaderboard: !!s.settings.leaderboard, memes: !!s.settings.memes,
    showAnswers: s.settings.showAnswers, showAnswersAfter: s.settings.showAnswersAfter, skipQuestions: !!s.settings.skipQuestions,
    serious: !!s.settings.serious, music: !!s.settings.music, attempts: s.settings.attempts || 0,
    scoring: s.settings.scoring || 'classic',
  },
});

sessionRouter.get('/join/:code', async (req, res) => {
  const s = await one("SELECT * FROM sessions WHERE code=$1 ORDER BY (status<>'ended') DESC, created_at DESC LIMIT 1", [req.params.code]);
  if (!s) return res.status(404).json({ error: 'Game not found. Check the code and try again.' });
  if (s.status === 'ended') return res.status(410).json({ error: 'This game has ended' });
  if (isExpired(s)) return res.status(410).json({ error: 'The deadline for this assignment has passed' });
  res.json({ session: sessionPublic(s) });
});

sessionRouter.post('/join/:code', async (req, res) => {
  const s = await one("SELECT * FROM sessions WHERE code=$1 AND status<>'ended' ORDER BY created_at DESC LIMIT 1", [req.params.code]);
  if (!s) return res.status(404).json({ error: 'Game not found. Check the code and try again.' });
  if (isExpired(s)) return res.status(410).json({ error: 'The deadline for this assignment has passed' });
  let name = String(req.body.name || '').trim().slice(0, 40);
  if (!name) return res.status(400).json({ error: 'Please enter your name' });
  const taken = await one('SELECT count(*)::int AS n FROM participants WHERE session_id=$1 AND lower(name)=lower($2)', [s.id, name]);
  if (taken.n > 0) name = `${name} ${taken.n + 1}`;
  const p = await createParticipant(s, { name, avatar: req.body.avatar, attempt: 1 });
  broadcast(s.id);
  res.json({ token: p.token, participant: { id: p.id, name: p.name, avatar: p.avatar }, session: sessionPublic(s) });
});

async function createParticipant(s, { name, avatar, attempt }) {
  const ids = s.quiz_snapshot.questions.map((q) => q.id);
  const order = s.settings.shuffleQuestions ? shuffle(ids) : ids;
  return one(
    `INSERT INTO participants(session_id,token,name,avatar,attempt,order_map) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
    [s.id, crypto.randomBytes(18).toString('hex'), name, avatar || null, attempt, JSON.stringify(order)],
  );
}

async function loadPlayer(req, res) {
  const p = await one('SELECT * FROM participants WHERE token=$1', [req.params.token]);
  if (!p) { res.status(404).json({ error: 'Player not found' }); return null; }
  if (p.kicked) { res.status(403).json({ error: 'You were removed from this game', kicked: true }); return null; }
  if (p.disconnected) { res.status(403).json({ error: 'The host disconnected you from this game', kicked: true, disconnected: true }); return null; }
  const s = await loadSession(p.session_id);
  return { p, s };
}

sessionRouter.get('/play/:token', async (req, res) => {
  const ctx = await loadPlayer(req, res); if (!ctx) return;
  const { p, s } = ctx;
  const answered = await many('SELECT question_id, status, score, fraction FROM responses WHERE participant_id=$1', [p.id]);
  const byId = new Map(s.quiz_snapshot.questions.map((q) => [q.id, q]));
  const shuffleAnswers = !!s.settings.shuffleAnswers;
  const questions = s.pace === 'student' && s.status === 'running'
    ? (p.order_map || []).map((id) => byId.get(id)).filter(Boolean).map((q) => sanitizeQuestion(q, { shuffleAnswers, seed: p.id }))
    : [];
  const ranks = await leaderboard(s.id);
  res.json({
    session: sessionPublic(s),
    participant: { id: p.id, name: p.name, avatar: p.avatar, score: p.score, streak: p.streak, attempt: p.attempt, finished: !!p.finished_at },
    rank: ranks.find((r) => r.id === p.id)?.rank || null,
    players: ranks.length,
    questions,
    answered,
    state: await playerState(s.id),
  });
});

sessionRouter.post('/play/:token/answer', async (req, res) => {
  const ctx = await loadPlayer(req, res); if (!ctx) return;
  const { p, s } = ctx;
  if (s.status !== 'running') return res.status(400).json({ error: s.status === 'ended' ? 'This game has ended' : 'The game has not started yet' });
  if (isExpired(s)) return res.status(410).json({ error: 'The deadline for this assignment has passed' });
  const q = s.quiz_snapshot.questions.find((x) => x.id === Number(req.body.questionId));
  if (!q) return res.status(404).json({ error: 'Question not found' });
  if (s.pace === 'teacher' && (s.phase !== 'question' || s.quiz_snapshot.questions[s.current_index]?.id !== q.id)) {
    return res.status(400).json({ error: 'Time is up for this question' });
  }
  const prev = await one('SELECT id FROM responses WHERE participant_id=$1 AND question_id=$2', [p.id, q.id]);
  if (prev) return res.status(409).json({ error: 'Already answered' });

  let timeMs = Math.max(0, parseInt(req.body.timeMs, 10) || 0);
  if (s.pace === 'teacher' && s.question_started) timeMs = Date.now() - new Date(s.question_started).getTime();
  const timerOn = s.pace === 'teacher' || !!s.settings.timer;
  if (timerOn) timeMs = Math.min(timeMs, q.time_limit * 1000);

  const { status, fraction } = grade(q, req.body.answer);
  const ungraded = UNGRADED_TYPES.includes(q.type);
  const streak = ungraded ? p.streak : status === 'correct' ? p.streak + 1 : 0;
  const score = computeScore({ q, fraction, timeMs, timerOn, streak, gameType: s.game_type, scoring: s.settings.scoring });
  try {
    await query(
      `INSERT INTO responses(session_id,participant_id,question_id,answer,status,fraction,score,time_ms) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [s.id, p.id, q.id, JSON.stringify(req.body.answer ?? null), status, fraction, score, timeMs]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Already answered' });
    throw e;
  }
  const upd = await one(
    'UPDATE participants SET score=score+$2, streak=$3, max_streak=greatest(max_streak,$3) WHERE id=$1 RETURNING score, streak',
    [p.id, score, streak]);

  const count = await one('SELECT count(*)::int AS n FROM responses WHERE participant_id=$1', [p.id]);
  if (s.pace === 'student' && count.n >= s.quiz_snapshot.questions.length) {
    await query('UPDATE participants SET finished_at=now() WHERE id=$1', [p.id]);
  }
  // teacher-led: reveal automatically once everyone answered
  if (s.pace === 'teacher') {
    const all = await one(
      `SELECT (SELECT count(*) FROM participants WHERE session_id=$1 AND NOT kicked AND NOT disconnected)::int AS players,
              (SELECT count(*) FROM responses WHERE session_id=$1 AND question_id=$2)::int AS answered`, [s.id, q.id]);
    if (all.answered >= all.players) setQuestionTimer(s.id, 800, () => revealQuestion(s.id));
  }
  broadcast(s.id);

  const show = s.pace === 'student' ? s.settings.showAnswers : 'on';
  const ranks = await leaderboard(s.id);
  res.json({
    status, fraction, score, totalScore: upd.score, streak: upd.streak,
    rank: ranks.find((r) => r.id === p.id)?.rank || null, players: ranks.length,
    reveal: show === 'on' ? revealFor(q) : undefined,
    explanation: show === 'on' ? q.explanation : undefined,
    validateOnly: show === 'validate',
    hidden: show === 'off',
  });
});

/** Shared board for discussion / word cloud questions. */
sessionRouter.get('/play/:token/board/:qid', async (req, res) => {
  const ctx = await loadPlayer(req, res); if (!ctx) return;
  const { s } = ctx;
  const q = s.quiz_snapshot.questions.find((x) => x.id === Number(req.params.qid));
  if (!q || !['discussion', 'wordcloud'].includes(q.type)) return res.status(404).json({ error: 'No board for this question' });
  const rows = await many(
    `SELECT r.id, r.answer, r.created_at, p.name, p.avatar FROM responses r JOIN participants p ON p.id=r.participant_id
     WHERE r.session_id=$1 AND r.question_id=$2 AND NOT p.kicked ORDER BY r.created_at DESC LIMIT 200`, [s.id, q.id]);
  res.json({
    posts: rows.map((r) => ({
      id: r.id, text: typeof r.answer === 'string' ? r.answer : '',
      name: s.settings.anonymize ? 'Anonymous' : r.name, avatar: r.avatar, at: r.created_at,
    })),
  });
});

sessionRouter.post('/play/:token/finish', async (req, res) => {
  const ctx = await loadPlayer(req, res); if (!ctx) return;
  await query('UPDATE participants SET finished_at=coalesce(finished_at, now()) WHERE id=$1', [ctx.p.id]);
  broadcast(ctx.s.id);
  res.json({ ok: true });
});

sessionRouter.post('/play/:token/again', async (req, res) => {
  const ctx = await loadPlayer(req, res); if (!ctx) return;
  const { p, s } = ctx;
  if (s.status !== 'running' || s.pace !== 'student') return res.status(400).json({ error: 'This game can no longer be played' });
  if (isExpired(s)) return res.status(410).json({ error: 'The deadline for this assignment has passed' });
  const max = s.settings.attempts || 0;
  if (max && p.attempt >= max) return res.status(400).json({ error: `Only ${max} attempt(s) allowed` });
  const np = await createParticipant(s, { name: p.name, avatar: p.avatar, attempt: p.attempt + 1 });
  await query('UPDATE participants SET finished_at=coalesce(finished_at, now()) WHERE id=$1', [p.id]);
  broadcast(s.id);
  res.json({ token: np.token });
});

sessionRouter.get('/play/:token/summary', async (req, res) => {
  const ctx = await loadPlayer(req, res); if (!ctx) return;
  const { p, s } = ctx;
  const rs = await many('SELECT * FROM responses WHERE participant_id=$1', [p.id]);
  const ranks = await leaderboard(s.id);
  const graded = rs.filter((r) => r.status !== 'ungraded');
  const showAfter = s.settings.showAnswersAfter || 'on';
  const order = s.pace === 'teacher' || !p.order_map ? s.quiz_snapshot.questions.map((q) => q.id) : p.order_map;
  const byId = new Map(s.quiz_snapshot.questions.map((q) => [q.id, q]));
  const review = showAfter === 'off' ? [] : order.map((id) => byId.get(id)).filter(Boolean).map((q) => {
    const r = rs.find((x) => x.question_id === q.id);
    return {
      question: showAfter === 'on' ? q : sanitizeQuestion(q, { seed: p.id }),
      revealed: showAfter === 'on',
      answer: r ? r.answer : null, status: r ? r.status : 'skipped', score: r ? r.score : 0, feedback: r?.feedback,
    };
  });
  res.json({
    session: sessionPublic(s),
    participant: { id: p.id, name: p.name, avatar: p.avatar, score: p.score, attempt: p.attempt, maxStreak: p.max_streak },
    rank: ranks.find((r) => r.id === p.id)?.rank || null,
    players: ranks.length,
    leaderboard: s.settings.leaderboard ? anonymize(ranks.slice(0, 10), s.settings.anonymize, p.id) : [],
    stats: {
      correct: rs.filter((r) => r.status === 'correct').length,
      incorrect: rs.filter((r) => r.status === 'incorrect').length,
      partial: rs.filter((r) => r.status === 'partial').length,
      ungraded: rs.filter((r) => r.status === 'ungraded').length,
      skipped: rs.filter((r) => r.status === 'skipped').length,
      accuracy: graded.length ? Math.round((graded.reduce((a, r) => a + r.fraction, 0) / graded.length) * 100) : null,
      avgTime: rs.length ? Math.round(rs.reduce((a, r) => a + r.time_ms, 0) / rs.length / 1000) : 0,
    },
    canPlayAgain: s.pace === 'student' && s.status === 'running' && !isExpired(s) && (!(s.settings.attempts) || p.attempt < s.settings.attempts),
    review,
  });
});

export { getIO };
