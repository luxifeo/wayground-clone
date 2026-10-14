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
import { initRealtime } from './realtime.js';
import { i18nErrors } from './i18n.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '15mb' }));
app.use('/api', i18nErrors);

// async error safety for express 4
for (const r of [authRouter, quizRouter, sessionRouter, aiRouter, imageRouter]) {
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
app.post('/api/uploads', requireAuth, imageUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Only image, audio or video files are allowed' });
  res.json({ url: `/uploads/${req.file.filename}` });
});
// students upload drawings / recordings with their player token
app.post('/api/play/:token/upload', async (req, res, next) => {
  const p = await one('SELECT id FROM participants WHERE token=$1 AND NOT kicked AND NOT disconnected', [req.params.token]);
  if (!p) return res.status(404).json({ error: 'Player not found' });
  next();
}, playerUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Only image, audio or video files are allowed' });
  res.json({ url: `/uploads/${req.file.filename}` });
});
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

// serve the built client in production
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^\/(?!api|uploads|socket\.io).*/, (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const server = http.createServer(app);
initRealtime(server, process.env.CLIENT_ORIGIN);

const PORT = parseInt(process.env.PORT || '4000', 10);
await migrate();
server.listen(PORT, () => console.log(`Wayground clone API on http://localhost:${PORT}`));
