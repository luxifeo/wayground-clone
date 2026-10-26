// Search the server logs (logs/server-YYYY-MM-DD.log, one JSON object per line): npm run logs -- [options]
//   --llm             search the LLM call log (logs/llm-YYYY-MM-DD.log: full prompts and replies) instead
//   --days N          the last N days, today included (default 1)
//   --since DATE      from this day (YYYY-MM-DD); --until DATE: up to this day
//   --event PATTERN   event names (with --llm: purposes), * as wildcard, comma separated: "image.*,upload"
//   --user ID         lines of this teacher;  --player ID: lines of this player
//   --level LEVEL     minimum level: debug | info | warn | error
//   --grep TEXT       lines containing TEXT anywhere (case-insensitive)
//   --last N          only the last N matches (default 200, 0 = all)
//   --json            print the raw JSON lines (untruncated; long texts are cut to 300 characters otherwise)
//   --dir PATH        log folder (default: LOG_DIR or <repo>/logs)
// Example: the full prompt and reply of one LLM call from the server log line "llm.chat llm=1a2b3c4d5e ...":
//   npm run logs -- --llm --days 30 --grep 1a2b3c4d5e --json
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const opts = { days: '1', last: '200' };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const m = argv[i].match(/^--([a-z]+)$/);
  if (!m) { console.error(`Unknown argument: ${argv[i]} (see the top of scripts/logs.mjs)`); process.exit(2); }
  opts[m[1]] = ['json', 'llm'].includes(m[1]) ? true : argv[++i];
}
const kind = opts.llm ? 'llm' : 'server';

const pad = (n) => String(n).padStart(2, '0');
const day = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const until = opts.until || day(new Date());
const since = opts.since || day(new Date(Date.now() - (parseInt(opts.days, 10) - 1) * 864e5));
const dir = path.resolve(opts.dir || process.env.LOG_DIR || path.join(ROOT, 'logs'));
const eventRe = opts.event && new RegExp(`^(${opts.event.split(',').map((p) => p.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')).join('|')})$`);
const grep = opts.grep?.toLowerCase();
const minLevel = LEVELS[opts.level] || 0;

const files = (fs.existsSync(dir) ? fs.readdirSync(dir) : [])
  .map((f) => f.match(new RegExp(`^${kind}-(\\d{4}-\\d{2}-\\d{2})\\.log$`))).filter((m) => m && m[1] >= since && m[1] <= until)
  .map((m) => path.join(dir, m[0])).sort();
if (!files.length) { console.error(`No log files in ${dir} from ${since} to ${until}`); process.exit(1); }

const keep = parseInt(opts.last, 10) || 0;
const hits = [];
for (const file of files) {
  for await (const text of readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity })) {
    if (!text || (grep && !text.toLowerCase().includes(grep))) continue;
    let rec;
    try { rec = JSON.parse(text); } catch { continue; }
    if (eventRe && !eventRe.test(rec.event ?? rec.purpose)) continue; // llm records: match their purpose
    if (opts.user && String(rec.user) !== opts.user) continue;
    if (opts.player && String(rec.player) !== opts.player) continue;
    if ((LEVELS[rec.level] || 0) < minLevel) continue;
    hits.push(opts.json ? text : rec);
    if (keep && hits.length > keep) hits.shift();
  }
}

const cut = (s) => (s.length > 300 ? `${s.slice(0, 300)}…` : s);
const show = (v) => (typeof v === 'string' ? (/[\s"=]/.test(v) ? JSON.stringify(cut(v)) : cut(v)) : cut(JSON.stringify(v)));
for (const h of hits) {
  if (opts.json) { console.log(h); continue; }
  // llm records have no level / event: show their purpose instead
  const { time, level = 'info', event = h.purpose || 'llm', ...rest } = h;
  const fields = Object.entries(rest).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `${k}=${show(v)}`);
  console.log(`${String(time).slice(0, 19).replace('T', ' ')} ${String(level).toUpperCase().padEnd(5)} ${event} ${fields.join(' ')}`);
}
console.error(`${hits.length} line(s)${keep && hits.length === keep ? ` (last ${keep}, use --last 0 for all)` : ''} · ${since} → ${until} · ${dir}`);
