// Manage the portable PostgreSQL in ./database: node scripts/db.mjs <start|stop|status|ensure>
//   ensure = init the cluster if needed, start it, create the "wayground" database
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'database', 'App', 'PgSQL', 'bin');
const DATA = path.join(ROOT, 'database', 'Data', 'data');
const LOG = path.join(ROOT, 'database', 'Data', 'log.txt');
const PORT = process.env.PGPORT_WG || '5433';
const DB = 'wayground';
const exe = (n) => path.join(BIN, `${n}.exe`);
const env = { ...process.env, PGLOCALEDIR: path.join(ROOT, 'database', 'App', 'PgSQL', 'share') };

function run(name, args, opts = {}) {
  return spawnSync(exe(name), args, { env, encoding: 'utf8', ...opts });
}

function isRunning() {
  if (!fs.existsSync(path.join(DATA, 'PG_VERSION'))) return false;
  return run('pg_ctl', ['-D', DATA, 'status']).status === 0;
}

function init() {
  if (fs.existsSync(path.join(DATA, 'PG_VERSION'))) return;
  console.log('Initialising PostgreSQL cluster in database/Data/data …');
  fs.mkdirSync(path.dirname(DATA), { recursive: true });
  const r = run('initdb', ['-D', DATA, '-U', 'postgres', '-A', 'trust', '-E', 'utf8', '--locale=C'], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('initdb failed');
}

async function start() {
  init();
  if (isRunning()) { console.log(`PostgreSQL already running on port ${PORT}`); return; }
  // detached so the server keeps running after this script exits
  const child = spawn(exe('pg_ctl'), ['-D', DATA, '-l', LOG, '-o', `-p ${PORT}`, 'start'], { env, detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (run('pg_isready', ['-h', '127.0.0.1', '-p', PORT]).status === 0) { console.log(`PostgreSQL started on port ${PORT}`); return; }
  }
  throw new Error(`PostgreSQL did not start, see ${LOG}`);
}

function stop() {
  if (!isRunning()) { console.log('PostgreSQL is not running'); return; }
  run('pg_ctl', ['-D', DATA, 'stop', '-m', 'fast'], { stdio: 'inherit' });
}

function ensureDb() {
  const r = run('psql', ['-h', '127.0.0.1', '-p', PORT, '-U', 'postgres', '-tAc', `SELECT 1 FROM pg_database WHERE datname='${DB}'`]);
  if (r.stdout.trim() === '1') { console.log(`Database "${DB}" exists`); return; }
  const c = run('createdb', ['-h', '127.0.0.1', '-p', PORT, '-U', 'postgres', DB], { stdio: 'inherit' });
  if (c.status !== 0) throw new Error('createdb failed');
  console.log(`Database "${DB}" created`);
}

const cmd = process.argv[2] || 'ensure';
try {
  if (cmd === 'start') await start();
  else if (cmd === 'stop') stop();
  else if (cmd === 'status') console.log(isRunning() ? `running (port ${PORT})` : 'stopped');
  else if (cmd === 'ensure') { await start(); ensureDb(); }
  else throw new Error(`Unknown command ${cmd}`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
