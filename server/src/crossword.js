// Crossword layout: builds a fresh grid from a list of (word, clue) pairs. Pure and deterministic.
// Keep server/src/crossword.js and client/src/lib/crossword.js identical (copy the whole file on change).

/** Grid letters of an answer: upper case, letters (any script, accents kept) and digits only. */
export function cwNormalize(str) {
  return String(str ?? '').normalize('NFC').toUpperCase().replace(/[^\p{L}\p{N}]/gu, '');
}

const DIRS = { across: [0, 1, 1], down: [1, 0, 2] }; // [dr, dc, bit]
const better = (a, b) => { for (let j = 0; j < a.length; j++) if (a[j] !== b[j]) return a[j] < b[j]; return false; };

/**
 * options: [{ id, answer }]. Greedy: longest words first; each next word goes where it crosses the
 * most letters, then where the bounding box stays smallest. A word that crosses nothing is placed
 * across below the grid (one empty row gap). Returns { rows, cols, entries: [{ id, row, col, dir, len, num }], unplaced }.
 */
export function buildLayout(options) {
  const unplaced = [];
  const words = [];
  (options || []).forEach((o, i) => {
    const w = Array.from(cwNormalize(o?.answer));
    if (w.length >= 2) words.push({ id: String(o.id), i, w }); else if (o) unplaced.push(String(o.id));
  });
  words.sort((a, b) => b.w.length - a.w.length || a.i - b.i);

  const cells = new Map(); // "r,c" -> { ch, bits }
  const at = (r, c) => cells.get(`${r},${c}`);
  const box = { r0: 0, r1: -1, c0: 0, c1: -1 };
  const placed = [];

  const put = (wd, row, col, dir) => {
    const [dr, dc, bit] = DIRS[dir];
    wd.w.forEach((ch, k) => {
      const key = `${row + dr * k},${col + dc * k}`;
      const cell = cells.get(key);
      if (cell) cell.bits |= bit; else cells.set(key, { ch, bits: bit });
    });
    const empty = box.r1 < box.r0;
    box.r0 = empty ? row : Math.min(box.r0, row); box.c0 = empty ? col : Math.min(box.c0, col);
    box.r1 = Math.max(empty ? row : box.r1, row + dr * (wd.w.length - 1));
    box.c1 = Math.max(empty ? col : box.c1, col + dc * (wd.w.length - 1));
    placed.push({ id: wd.id, row, col, dir, len: wd.w.length });
  };

  // number of crossings, or -1 when the word does not fit there
  const fits = (w, row, col, dir) => {
    const [dr, dc, bit] = DIRS[dir];
    if (at(row - dr, col - dc) || at(row + dr * w.length, col + dc * w.length)) return -1;
    let crosses = 0;
    for (let k = 0; k < w.length; k++) {
      const r = row + dr * k; const c = col + dc * k;
      const cell = at(r, c);
      if (cell) {
        if (cell.ch !== w[k] || cell.bits & bit) return -1;
        crosses++;
      } else if (at(r + dc, c + dr) || at(r - dc, c - dr)) return -1;
    }
    return crosses;
  };

  const best = (w) => {
    let top = null;
    for (const [key, cell] of cells) {
      const [r, c] = key.split(',').map(Number);
      for (let k = 0; k < w.length; k++) {
        if (w[k] !== cell.ch) continue;
        for (const dir of ['across', 'down']) {
          const [dr, dc] = DIRS[dir];
          const row = r - dr * k; const col = c - dc * k;
          const crosses = fits(w, row, col, dir);
          if (crosses < 1) continue;
          const h = Math.max(box.r1, row + dr * (w.length - 1)) - Math.min(box.r0, row) + 1;
          const wd = Math.max(box.c1, col + dc * (w.length - 1)) - Math.min(box.c0, col) + 1;
          const score = [-crosses, h * wd, Math.abs(h - wd)];
          if (!top || better(score, top.score)) top = { row, col, dir, score };
        }
      }
    }
    return top;
  };

  const rest = [...words];
  if (rest.length) put(rest.shift(), 0, 0, 'across');
  while (rest.length) {
    let done = false;
    for (let i = 0; i < rest.length && !done; i++) {
      const spot = best(rest[i].w);
      if (spot) { put(rest[i], spot.row, spot.col, spot.dir); rest.splice(i, 1); done = true; }
    }
    if (!done) put(rest.shift(), box.r1 + 2, box.c0, 'across'); // crosses nothing: park it below
  }

  // shift to 0,0 and number start cells in reading order (across + down from one cell share a number)
  const starts = [...new Set(placed.map((p) => `${p.row - box.r0},${p.col - box.c0}`))]
    .map((s) => s.split(',').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const nums = new Map(starts.map(([r, c], i) => [`${r},${c}`, i + 1]));
  const entries = placed.map((p) => {
    const row = p.row - box.r0; const col = p.col - box.c0;
    return { id: p.id, row, col, dir: p.dir, len: p.len, num: nums.get(`${row},${col}`) };
  }).sort((a, b) => a.num - b.num || (a.dir === 'across' ? -1 : 1));
  return { rows: placed.length ? box.r1 - box.r0 + 1 : 0, cols: placed.length ? box.c1 - box.c0 + 1 : 0, entries, unplaced };
}
