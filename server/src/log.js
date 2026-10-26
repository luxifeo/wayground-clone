// Structured server logs: one JSON object per line in logs/server-YYYY-MM-DD.log (local date),
// and the full record of every LLM call in logs/llm-YYYY-MM-DD.log (+ the images sent, in logs/llm-images/<day>/).
// Never log passwords, JWTs, API keys or player tokens: tokens in URLs are replaced by a short hash (tokenTag).
// Env: LOG_DIR (default <repo>/logs), LOG_RETENTION_DAYS (default 90, 0 = keep all),
// LOG_LLM_CONTENT (off = no llm-*.log / images), LOG_LLM_RETENTION_DAYS (default 30),
// LOG_CONSOLE (minimum level also printed to stdout: debug | info | warn | error | off, default warn).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { fileURLToPath } from 'node:url';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, off: 99 };
const MAX_STRING = 4000;
const IMAGE_DIR = 'llm-images';

// read lazily: .env is loaded by db.js, which may be imported after this module
let conf = null;
const config = () => conf ||= {
  dir: path.resolve(process.env.LOG_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'logs')),
  retentionDays: parseInt(process.env.LOG_RETENTION_DAYS || '90', 10),
  llmContent: process.env.LOG_LLM_CONTENT !== 'off',
  llmRetentionDays: parseInt(process.env.LOG_LLM_RETENTION_DAYS || '30', 10),
  console: LEVELS[process.env.LOG_CONSOLE] ?? LEVELS.warn,
};
export const logDir = () => config().dir;

const pad = (n, w = 2) => String(n).padStart(w, '0');
/** Local time with offset, e.g. 2026-10-23T09:15:02.123+07:00 */
function stamp(d = new Date()) {
  const off = -d.getTimezoneOffset();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    + `.${pad(d.getMilliseconds(), 3)}${off >= 0 ? '+' : '-'}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}

// daily files: kind -> days to keep
const KINDS = { server: () => config().retentionDays, llm: () => config().llmRetentionDays };
const fileFor = (kind, day) => path.join(config().dir, `${kind}-${day}.log`);

/** Delete daily files (and for llm, the image folders) older than the retention period. */
function prune(kind) {
  const days = KINDS[kind]();
  if (!(days > 0)) return;
  const { dir } = config();
  const cutoff = stamp(new Date(Date.now() - days * 864e5)).slice(0, 10);
  try {
    for (const f of fs.readdirSync(dir)) {
      const m = f.match(/^([a-z]+)-(\d{4}-\d{2}-\d{2})\.log$/);
      if (m && m[1] === kind && m[2] < cutoff) fs.rmSync(path.join(dir, f), { force: true });
    }
    const images = path.join(dir, IMAGE_DIR);
    if (kind === 'llm' && fs.existsSync(images)) {
      for (const d of fs.readdirSync(images)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d < cutoff) fs.rmSync(path.join(images, d), { recursive: true, force: true });
      }
    }
  } catch (e) { console.error('log prune failed:', e.message); }
}

// Synchronous appends: cheap at this app's traffic, keeps lines in order and loses nothing when the process crashes
const open = new Map(); // kind -> { day, fd } for today's file
function fdFor(kind, day) {
  const cur = open.get(kind);
  if (cur?.day === day) return cur.fd;
  if (cur) try { fs.closeSync(cur.fd); } catch { /* already closed */ }
  fs.mkdirSync(config().dir, { recursive: true });
  const fd = fs.openSync(fileFor(kind, day), 'a');
  open.set(kind, { day, fd });
  prune(kind);
  return fd;
}

function replacer(_k, v) {
  if (v instanceof Error) return { message: v.message, ...(v.code && { code: v.code }), ...(v.status && { status: v.status }), stack: v.stack };
  if (typeof v === 'string' && v.length > MAX_STRING) return `${v.slice(0, MAX_STRING)}…`;
  return v;
}

// the request being handled, so lines written deep inside (LLM calls, image search, reading jobs) still name who asked
const context = new AsyncLocalStorage();

/** Multer reads files in stream callbacks that lose the request context: run the rest of the chain inside it again. */
export const keepContext = (mw) => (req, res, next) => mw(req, res, (err) => context.run(req, () => next(err)));

/** Who made the request: request id, teacher id and/or player. */
const reqFields = (req) => ({ req: req.id, ...(req.user?.id && { user: req.user.id }), ...(req.player?.id && { player: req.player.id }) });

function line(level, event, fields, req) {
  const rec = { time: stamp(), level, event, ...(req && reqFields(req)), ...fields };
  try { return { rec, text: JSON.stringify(rec, replacer) }; } catch (e) {
    return { rec, text: JSON.stringify({ time: rec.time, level, event, logError: e.message }) };
  }
}

function toConsole(level, text) {
  if (LEVELS[level] < config().console) return;
  const { time, level: _l, event, ...rest } = JSON.parse(text);
  const msg = `${time.slice(0, 19).replace('T', ' ')} ${level.toUpperCase()} ${event} ${JSON.stringify(rest)}`;
  (LEVELS[level] >= LEVELS.warn ? console.error : console.log)(msg);
}

function write(level, event, fields = {}, req = null) {
  const { rec, text } = line(level, event, fields, req || context.getStore());
  // logging must never break a request
  try { fs.writeSync(fdFor('server', rec.time.slice(0, 10)), `${text}\n`); } catch (e) { console.error('log write failed:', e.message); }
  toConsole(level, text);
}

/**
 * log.info('image.search', { q, results }, req) - event names are "<area>.<action>[.failed]".
 * Lines are tagged with the request id and the signed-in teacher / player of the current request.
 */
export const log = {
  debug: (event, fields, req) => write('debug', event, fields, req),
  info: (event, fields, req) => write('info', event, fields, req),
  warn: (event, fields, req) => write('warn', event, fields, req),
  error: (event, fields, req) => write('error', event, fields, req),
};

const IMAGE_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

/** Store a data: URL image as llm-images/<day>/<sha256>.<ext>; the same picture is written once a day. */
function saveImage(day, url) {
  const s = String(url);
  const comma = s.indexOf(',');
  const type = comma > 0 && s.slice(0, comma).match(/^data:([^;]+);base64$/)?.[1];
  if (!type) return { url: s.slice(0, 500) };
  const buf = Buffer.from(s.slice(comma + 1), 'base64');
  const rel = `${IMAGE_DIR}/${day}/${crypto.createHash('sha256').update(buf).digest('hex').slice(0, 20)}.${IMAGE_EXT[type] || 'bin'}`;
  const abs = path.join(config().dir, rel);
  if (!fs.existsSync(abs)) {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.promises.writeFile(abs, buf).catch((e) => console.error('llm image write failed:', e.message));
  }
  return { file: rel, type, bytes: buf.length };
}

/**
 * Full record of one LLM call (system, prompt, reply, usage) in logs/llm-YYYY-MM-DD.log, untruncated;
 * images go to files next to it. Joined to the llm.chat line of the server log by the "llm" id.
 */
export function logLlmCall(fields) {
  if (!config().llmContent) return;
  const time = stamp(); const day = time.slice(0, 10);
  const req = context.getStore();
  try {
    const rec = { time, ...(req && reqFields(req)), ...fields, images: (fields.images || []).map((u) => saveImage(day, u)) };
    fs.writeSync(fdFor('llm', day), `${JSON.stringify(rec, (_k, v) => (v instanceof Error ? { message: v.message, stack: v.stack } : v))}\n`);
  } catch (e) { console.error('llm log write failed:', e.message); }
}

/** Stable short id for a player token, so log lines can be joined without storing the token. */
export const tokenTag = (token) => crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 10);

/** Replace player tokens in a URL path with their tag: /api/play/<token>/answer -> /api/play/~1a2b3c4d5e/answer */
export const redact = (url) => String(url || '').replace(/\/play\/([0-9a-f]{20,})/gi, (_m, t) => `/play/~${tokenTag(t)}`).slice(0, 500);

/** Path of the page that loaded a resource (origin dropped, tokens redacted). */
function refPath(ref) {
  if (!ref) return undefined;
  try { const u = new URL(ref); return redact(u.pathname + u.search); } catch { return undefined; }
}

/** Access log for /api and /uploads; also gives every request an id (X-Request-Id) and the log context. */
export function requestLogger(req, res, next) {
  req.id = crypto.randomBytes(4).toString('hex');
  res.setHeader('X-Request-Id', req.id);
  if (!/^\/(api|uploads)\//.test(req.path) || req.path === '/api/health') return next();
  // decide now: mounted middleware (express.static on /uploads) rewrites req.url before 'close'
  const isUpload = req.path.startsWith('/uploads/');
  const start = process.hrtime.bigint();
  res.on('close', () => {
    const status = res.statusCode;
    write(status >= 500 ? 'warn' : 'info', 'http', {
      method: req.method, url: redact(req.originalUrl), status, ms: Number((process.hrtime.bigint() - start) / 1000000n),
      bytes: Number(res.getHeader('content-length')) || undefined,
      ...(!res.writableFinished && { aborted: true }),
      ip: req.ip, ua: String(req.headers['user-agent'] || '').slice(0, 160) || undefined,
      // for images: which page showed them (a student's game, the editor, ...)
      ref: isUpload ? refPath(req.headers.referer) : undefined,
    }, req);
  });
  context.run(req, next);
}
