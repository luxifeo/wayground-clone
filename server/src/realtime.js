import { Server } from 'socket.io';
import { one, many } from './db.js';
import { verify } from './auth.js';
import { sanitizeQuestion, revealFor } from './grading.js';
import { suspectFlags } from './identity.js';
import { log } from './log.js';

let io = null;
const pending = new Map(); // sessionId -> timeout (debounce)
const questionTimers = new Map(); // sessionId -> timeout (teacher-led auto reveal)

export function initRealtime(httpServer, corsOrigin) {
  io = new Server(httpServer, { cors: { origin: corsOrigin || true, credentials: true } });

  io.on('connection', (socket) => {
    socket.on('host:watch', async ({ sessionId, token }) => {
      const user = verify(token);
      if (!user) return socket.emit('error:auth', 'Unauthorized');
      const s = await one('SELECT host_id FROM sessions WHERE id=$1', [sessionId]);
      if (!s || s.host_id !== user.id) return socket.emit('error:auth', 'Not your session');
      socket.join(`host:${sessionId}`);
      socket.emit('session:host', await hostState(sessionId));
    });

    socket.on('player:watch', async ({ token }) => {
      const p = await one('SELECT id, session_id, kicked, disconnected FROM participants WHERE token=$1', [token]);
      if (!p) return socket.emit('error:auth', 'Unknown player');
      if (p.kicked || p.disconnected) return socket.emit('kicked', { disconnected: p.disconnected });
      socket.join(`play:${p.session_id}`);
      socket.join(`player:${p.id}`);
      socket.data.participantId = p.id;
      socket.data.sessionId = p.session_id;
      socket.emit('session:state', await playerState(p.session_id));
    });

    socket.on('player:reaction', ({ emoji }) => {
      if (!socket.data.sessionId) return;
      io.to(`host:${socket.data.sessionId}`).emit('reaction', { participantId: socket.data.participantId, emoji: String(emoji).slice(0, 4) });
    });
  });
  return io;
}

export function getIO() { return io; }

export async function loadSession(sessionId) {
  return one('SELECT * FROM sessions WHERE id=$1', [sessionId]);
}

export function snapshotQuestion(session, index) {
  const qs = session.quiz_snapshot?.questions || [];
  return qs[index] || null;
}

export async function leaderboard(sessionId) {
  return many(
    `SELECT p.id, p.name, p.avatar, p.score, p.attempt, p.finished_at,
            rank() OVER (ORDER BY p.score DESC)::int AS rank
     FROM participants p WHERE p.session_id=$1 AND NOT p.kicked ORDER BY p.score DESC, p.joined_at`, [sessionId]);
}

/** Everything the host dashboard needs. */
export async function hostState(sessionId) {
  const session = await loadSession(sessionId);
  if (!session) return null;
  const questions = session.quiz_snapshot.questions || [];
  const participants = await many(
    'SELECT id,name,avatar,score,streak,attempt,joined_at,finished_at,disconnected,device_id FROM participants WHERE session_id=$1 AND NOT kicked ORDER BY score DESC, joined_at',
    [sessionId]);
  const responses = await many(
    'SELECT participant_id, question_id, status, fraction, score, time_ms, answer FROM responses WHERE session_id=$1', [sessionId]);
  const byP = new Map();
  responses.forEach((r) => {
    if (!byP.has(r.participant_id)) byP.set(r.participant_id, []);
    byP.get(r.participant_id).push(r);
  });
  // possible retakes under another name; device ids themselves never leave the server
  const flags = suspectFlags(participants);
  let graded = 0, correctSum = 0;
  const players = participants.map((p, i) => {
    const rs = byP.get(p.id) || [];
    const statuses = questions.map((q) => {
      const r = rs.find((x) => x.question_id === q.id);
      return r ? r.status : null;
    });
    const g = rs.filter((r) => !['ungraded'].includes(r.status));
    const acc = g.length ? g.reduce((a, r) => a + r.fraction, 0) / g.length : null;
    graded += g.length; correctSum += g.reduce((a, r) => a + r.fraction, 0);
    return {
      ...p, device_id: undefined, suspect: flags.get(p.id) || null, rank: i + 1, answered: rs.length, statuses,
      correct: rs.filter((r) => r.status === 'correct').length,
      incorrect: rs.filter((r) => r.status === 'incorrect').length,
      accuracy: acc === null ? null : Math.round(acc * 100),
    };
  });
  // current question distribution (teacher-led)
  let current = null;
  if (session.pace === 'teacher' && session.current_index >= 0) {
    const q = questions[session.current_index];
    if (q) {
      const rs = responses.filter((r) => r.question_id === q.id);
      const dist = {};
      rs.forEach((r) => {
        const a = Array.isArray(r.answer) ? r.answer : [r.answer];
        a.forEach((v) => { if (typeof v === 'string') dist[v] = (dist[v] || 0) + 1; });
      });
      current = {
        index: session.current_index, question: q, answeredCount: rs.length,
        correctCount: rs.filter((r) => r.status === 'correct').length, distribution: dist,
        responses: ['open', 'fill', 'draw', 'math', 'wordcloud', 'discussion', 'audio', 'video'].includes(q.type)
          ? rs.map((r) => ({ participant: participants.find((p) => p.id === r.participant_id)?.name, answer: r.answer, status: r.status }))
          : undefined,
      };
    }
  }
  return {
    session: { ...session, quiz_snapshot: undefined, title: session.title || session.quiz_snapshot.title },
    questions,
    players,
    accuracy: graded ? Math.round((correctSum / graded) * 100) : null,
    current,
  };
}

/** Shared state for every player of a session (teacher-led phases, status). */
export async function playerState(sessionId) {
  const s = await loadSession(sessionId);
  if (!s) return null;
  const st = {
    status: s.status, pace: s.pace, phase: s.phase, currentIndex: s.current_index,
    total: (s.quiz_snapshot.questions || []).length, questionStartedAt: s.question_started,
    serverNow: new Date().toISOString(),
  };
  if (s.pace === 'teacher' && s.current_index >= 0 && s.status === 'running') {
    const q = snapshotQuestion(s, s.current_index);
    if (q) {
      st.question = sanitizeQuestion(q, { shuffleAnswers: !!s.settings.shuffleAnswers, seed: s.id });
      if (s.phase === 'reveal' || s.phase === 'leaderboard') {
        st.reveal = revealFor(q);
        st.explanation = q.explanation;
      }
    }
  }
  if (s.phase === 'leaderboard' || s.status === 'ended') {
    st.leaderboard = anonymize((await leaderboard(sessionId)).slice(0, 10), s.settings.anonymize);
  }
  return st;
}

/** Debounced push of fresh state to host + players. */
export function broadcast(sessionId, { players = false } = {}) {
  if (!io) return;
  const key = `${sessionId}:${players ? 'p' : 'h'}`;
  if (pending.has(key)) return;
  pending.set(key, setTimeout(async () => {
    pending.delete(key);
    try {
      io.to(`host:${sessionId}`).emit('session:host', await hostState(sessionId));
      if (players) io.to(`play:${sessionId}`).emit('session:state', await playerState(sessionId));
    } catch (e) { log.error('realtime.broadcast.failed', { session: sessionId, err: e }); }
  }, players ? 30 : 250));
}

export function setQuestionTimer(sessionId, ms, fn) {
  clearQuestionTimer(sessionId);
  questionTimers.set(sessionId, setTimeout(() => { questionTimers.delete(sessionId); fn(); }, ms));
}

export function clearQuestionTimer(sessionId) {
  const t = questionTimers.get(sessionId);
  if (t) clearTimeout(t);
  questionTimers.delete(sessionId);
}

export function emitToPlayer(participantId, event, data) {
  if (io) io.to(`player:${participantId}`).emit(event, data);
}

/** Tell the player they were removed, then close their sockets. */
export function dropPlayer(participantId, data = {}) {
  if (!io) return;
  io.to(`player:${participantId}`).emit('kicked', data);
  // give the event time to reach the client before closing
  setTimeout(() => io.in(`player:${participantId}`).disconnectSockets(), 500);
}

const ANON_A = ['Happy', 'Brave', 'Clever', 'Swift', 'Sunny', 'Cosmic', 'Lucky', 'Mighty', 'Jolly', 'Witty', 'Bold', 'Calm'];
const ANON_N = ['Panda', 'Fox', 'Otter', 'Comet', 'Tiger', 'Koala', 'Falcon', 'Dolphin', 'Rocket', 'Wizard', 'Owl', 'Lynx'];
/** Replace player names with stable fun names when the session hides real names. */
export function anonymize(rows, on, keepId = null) {
  if (!on) return rows;
  return rows.map((r) => (r.id === keepId ? r : { ...r, name: `${ANON_A[r.id % ANON_A.length]} ${ANON_N[Math.floor(r.id / ANON_A.length) % ANON_N.length]}` }));
}
