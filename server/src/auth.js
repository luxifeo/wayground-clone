import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { one } from './db.js';
import { log } from './log.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret';

export function sign(user) {
  return jwt.sign({ id: user.id, name: user.name, email: user.email }, SECRET, { expiresIn: '30d' });
}

export function verify(token) {
  try { return jwt.verify(token, SECRET); } catch { return null; }
}

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  const user = token && verify(token);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = user;
  next();
}

export function optionalAuth(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  req.user = (token && verify(token)) || null;
  next();
}

export const authRouter = Router();

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role });

authRouter.post('/signup', async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) return res.status(400).json({ error: 'Name, email and password are required' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const exists = await one('SELECT id FROM users WHERE lower(email)=lower($1)', [email]);
  if (exists) return res.status(409).json({ error: 'An account with this email already exists' });
  const hash = await bcrypt.hash(password, 10);
  const user = await one(
    'INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING *',
    [String(email).trim(), hash, String(name).trim()],
  );
  log.info('auth.signup', { user: user.id, email: user.email }, req);
  res.json({ token: sign(user), user: publicUser(user) });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await one('SELECT * FROM users WHERE lower(email)=lower($1)', [email || '']);
  if (!user || !(await bcrypt.compare(password || '', user.password_hash))) {
    log.warn('auth.login.failed', { email: String(email || '').slice(0, 120) }, req);
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  log.info('auth.login', { user: user.id }, req);
  res.json({ token: sign(user), user: publicUser(user) });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await one('SELECT * FROM users WHERE id=$1', [req.user.id]);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ user: publicUser(user) });
});
