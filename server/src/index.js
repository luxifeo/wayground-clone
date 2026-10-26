import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import { migrate, one } from './db.js';
import { authRouter, requireAuth } from './auth.js';
import { quizRouter } from './routes/quizzes.js';
import { sessionRouter } from './routes/sessions.js';
import { aiRouter } from './routes/ai.js';
import { imageRouter } from './routes/images.js';
import { readingRouter } from './routes/reading.js';
import { initRealtime } from './realtime.js';
import { i18nErrors } from './i18n.js';
import { keepContext, log, logDir, redact, requestLogger } from './log.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
// Tailscale Funnel proxies from 127.0.0.1: take the client IP from X-Forwarded-For only then
app.set('trust proxy', 'loopback');
app.use(requestLogger);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '15mb' }));
app.use('/api', i18nErrors);

// async error safety for express 4
for (const r of [authRouter, quizRouter, sessionRouter, aiRouter, imageRouter, readingRouter]) {
  r.stack.forEach((layer) => layer.route?.stack.forEach((s) => {
    const h = s.handle;
    if (h.length <= 3) s.handle = (req, res, next) => Promise.resolve(h(req, res, next)).catch(next);
  }));
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api', quizRouter);
app.use('/api', sessionRouter);
app.use('/api', aiRouter);
app.use('/api', imageRouter);
app.use('/api', readingRouter);

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `${crypto.randomBytes(10).toString('hex')}${path.extname(file.originalname).toLowerCase() || '.png'}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^(image|audio|video)\//.test(file.mimetype)),
});
const playerUpload = multer({
  storage: imageUpload.storage,
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^(image|audio|video)\//.test(file.mimetype)),
});
const logUpload = (req) => log.info('upload', {
  file: req.file.filename, type: req.file.mimetype, size: req.file.size, name: req.file.originalname.slice(0, 120),
  ...(req.player && { session: req.player.session_id }),
}, req);
app.post('/api/uploads', requireAuth, keepContext(imageUpload.single('file')), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Only image, audio or video files are allowed' });
  logUpload(req);
  res.json({ url: `/uploads/${req.file.filename}` });
});
// students upload drawings / recordings with their player token
app.post('/api/play/:token/upload', async (req, res, next) => {
  const p = await one('SELECT id, session_id FROM participants WHERE token=$1 AND NOT kicked AND NOT disconnected', [req.params.token]);
  if (!p) return res.status(404).json({ error: 'Player not found' });
  req.player = p;
  next();
}, keepContext(playerUpload.single('file')), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Only image, audio or video files are allowed' });
  logUpload(req);
  res.json({ url: `/uploads/${req.file.filename}` });
});
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

// serve the built client in production
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^\/(?!api|uploads|socket\.io).*/, (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

app.use((err, req, res, _next) => {
  const status = err.status || 500;
  // client errors (bad JSON, too large...) need no stack
  (status >= 500 ? log.error : log.warn)('http.failed', { url: redact(req.originalUrl), status, err: status >= 500 ? err : err.message }, req);
  res.status(status).json({ error: err.message || 'Server error' });
});

// keep Node's default (exit on an uncaught error), but write the reason to the log first
for (const ev of ['uncaughtException', 'unhandledRejection']) {
  process.on(ev, (err) => { log.error('process.crash', { reason: ev, err }); process.exit(1); });
}

const server = http.createServer(app);
initRealtime(server, process.env.CLIENT_ORIGIN);

const PORT = parseInt(process.env.PORT || '4000', 10);
await migrate();
server.listen(PORT, () => {
  console.log(`Wayground clone API on http://localhost:${PORT}`);
  log.info('server.start', { port: PORT, pid: process.pid, node: process.version, logDir: logDir() });
});
