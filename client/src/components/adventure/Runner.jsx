import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpToLine, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, ScrollText } from 'lucide-react';
import Scene from './Scene';
import { AGES } from './data';
import { sfx } from '../../lib/sound';

// Adventure run: a small side-scrolling platformer that ends with A–D answer blocks.
// The game state lives in refs and is drawn on a canvas every frame; React only renders
// the overlays (intro card, pause menu, toasts, touch buttons).

/* ---------------------------------------------------------------- constants */

const H = 900; // logical world height; the canvas is scaled so this always fits
const GROUND_Y = 770;
const MIN_VIEW_W = 720; // narrow screens zoom out so the answer blocks stay readable
const STEP = 1 / 60;

const PHYS = {
  gravity: 2700, maxFall: 1350, jumpV: 1180, jumpCut: 500,
  runMax: 390, accelGround: 2600, accelAir: 1800, decelGround: 3000, decelAir: 700,
  springV: 1750, bopV: 760, bopHighV: 1080, knockVX: 340, knockVY: 430,
  coyote: 0.1, buffer: 0.1, invuln: 1, stun: 0.25,
};

const HERO_W = 40;
const HERO_H = 50;
const HERO_FONT = 56;
const MON_W = 46;
const MON_H = 44;
const BLOCK_W = 172;
const BLOCK_H = 150;
const BLOCK_GAP = 240; // centre to centre
const BLOCK_BOTTOM = GROUND_Y - 145; // a quick tap-jump still reaches the blocks

const OUTLINE = '#3b2a1a';
const CREAM = '#fff3d6';
const DIRT = '#b9773f';
const DIRT_DARK = 'rgba(92, 52, 24, 0.45)';
const BLOCK_COLORS = [
  { fill: '#7dd3fc', dark: '#0369a1' },
  { fill: '#86efac', dark: '#15803d' },
  { fill: '#fdba74', dark: '#c2410c' },
  { fill: '#c4b5fd', dark: '#6d28d9' },
];
const BLOCK_GREY = { fill: '#e2e8f0', dark: '#94a3b8' };
const LETTERS = ['A', 'B', 'C', 'D'];
const PARTY = ['#facc15', '#f472b6', '#60a5fa', '#34d399', '#fb923c', '#a78bfa'];
const COIN_SPARKS = ['#fde047', '#facc15', '#ffffff'];
const BUGS = ['🐞', '🐌'];
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const TEXT_FONT = 'Quicksand, Inter, system-ui, sans-serif';
const NO_INPUT = { left: false, right: false, jump: false };

/* -------------------------------------------------------------------- sound */

let audio;
function tone(freq, start, dur, type = 'sine', gain = 0.1, slideTo = 0) {
  if (!sfx.enabled) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const o = audio.createOscillator();
    const g = audio.createGain();
    const t0 = audio.currentTime + start;
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(audio.destination);
    o.start(t0);
    o.stop(t0 + dur);
  } catch { /* audio not available */ }
}

const SOUNDS = {
  coin: () => { tone(988, 0, 0.07, 'square', 0.04); tone(1319, 0.06, 0.12, 'square', 0.04); },
  jump: () => tone(330, 0, 0.15, 'triangle', 0.07, 640),
  bop: () => { tone(240, 0, 0.08, 'square', 0.06, 480); tone(720, 0.07, 0.1, 'triangle', 0.08); },
  spring: () => tone(180, 0, 0.35, 'triangle', 0.1, 900),
  hurt: () => tone(320, 0, 0.22, 'sawtooth', 0.05, 150),
  bump: () => { tone(523, 0, 0.08, 'triangle', 0.1); tone(784, 0.07, 0.12, 'triangle', 0.1); },
  thud: () => tone(140, 0, 0.1, 'square', 0.05),
  fall: () => tone(620, 0, 0.4, 'sine', 0.07, 160),
};
const playSound = (name) => SOUNDS[name]?.();

/* ------------------------------------------------------------------ helpers */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Same deterministic generator as Scene.jsx (mulberry32).
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, r) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Darken (amount < 0) or lighten a #rrggbb colour. */
function shade(hex, amount) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (v) => Math.round(clamp(v * (1 + amount), 0, 255));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

/** Rounded rectangle path; r is a number or [tl, tr, br, bl]. */
function rr(ctx, x, y, w, h, r) {
  const [tl, tr, br, bl] = Array.isArray(r) ? r : [r, r, r, r];
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.arcTo(x + w, y, x + w, y + h, tr);
  ctx.arcTo(x + w, y + h, x, y + h, br);
  ctx.arcTo(x, y + h, x, y, bl);
  ctx.arcTo(x, y, x + w, y, tl);
  ctx.closePath();
}

// Emoji are pre-rendered once into small canvases; drawImage is much cheaper than fillText.
const sprites = new Map();
const SPRITE = 200;
const SPRITE_FONT = 140;
function emojiSprite(emoji) {
  let c = sprites.get(emoji);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = SPRITE;
  c.height = SPRITE;
  const g = c.getContext('2d');
  g.font = `${SPRITE_FONT}px ${EMOJI_FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  const m = g.measureText(emoji);
  const asc = m.actualBoundingBoxAscent || SPRITE_FONT * 0.8;
  const desc = m.actualBoundingBoxDescent || SPRITE_FONT * 0.1;
  g.fillText(emoji, SPRITE / 2, SPRITE / 2 + (asc - desc) / 2);
  sprites.set(emoji, c);
  return c;
}

/** Draws an emoji centred on (cx, cy) as if it were set in a font of `size`. */
function drawEmoji(ctx, emoji, cx, cy, size) {
  if (!emoji) return;
  const s = size * (SPRITE / SPRITE_FONT);
  ctx.drawImage(emojiSprite(emoji), cx - s / 2, cy - s / 2, s, s);
}

function wrapWords(ctx, text, maxW) {
  const lines = [];
  let cur = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (!cur || ctx.measureText(next).width <= maxW) cur = next;
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Picks the biggest font size that fits the text in two lines of maxW. */
function fitText(ctx, text, maxW) {
  const str = String(text ?? '').trim();
  for (const size of [28, 24, 21, 18]) {
    ctx.font = `700 ${size}px ${TEXT_FONT}`;
    const lines = wrapWords(ctx, str, maxW);
    if (lines.length <= 2 && lines.every((l) => ctx.measureText(l).width <= maxW)) return { size, lines };
  }
  const lines = wrapWords(ctx, str, maxW).slice(0, 2).map((l) => {
    let s = l;
    while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
    return s === l ? l : `${s}…`;
  });
  return { size: 18, lines };
}

/* ------------------------------------------------------------------- level */

/**
 * Builds the static layout for a seed. The run is split into "slots" that each hold one
 * feature (gap, spring, monster, spiky monster, coin line); platforms float above some slots.
 */
function makeLevel({ seed, optionCount, spiky, runSpeed, mini, props }) {
  const r = rng((Number(seed) || 0) * 7919 + 1013);
  const between = (a, b) => a + r() * (b - a);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];

  const slots = [];
  for (let x = 860; x < 4200; x += between(340, 420)) slots.push(Math.round(x));
  const kinds = slots.map(() => null);

  // gaps only on odd slots so two gaps are never next to each other
  const odd = shuffle(slots.map((_, i) => i).filter((i) => i % 2 === 1), r);
  odd.slice(0, r() < 0.4 ? 4 : 3).forEach((i) => { kinds[i] = 'gap'; });
  const free = kinds.filter((k) => !k).length;
  const must = ['spring', 'spring', 'monster', 'monster', ...(spiky ? ['spiky'] : [])];
  const extra = shuffle(['monster', 'coins', 'coins', spiky ? 'spiky' : 'monster', 'coins'], r);
  const bag = shuffle([...must, ...extra].slice(0, free), r);
  kinds.forEach((k, i) => { if (!k) kinds[i] = bag.pop() || 'coins'; });

  const finishX = slots[slots.length - 1] + 440;
  const firstBlock = finishX + 380;
  const n = clamp(optionCount, 0, 4);
  const end = firstBlock + Math.max(0, n - 1) * BLOCK_GAP + 560;

  // ground with holes
  const gapScale = runSpeed < 1 ? 0.85 : 1;
  const holes = [];
  slots.forEach((x, i) => {
    if (kinds[i] !== 'gap') return;
    const w = Math.round(between(115, 165) * gapScale);
    holes.push([x - w / 2, x + w / 2]);
  });
  const segments = [];
  let from = -240;
  for (const [a, b] of holes) { segments.push({ x: from, w: a - from }); from = b; }
  segments.push({ x: from, w: end + 240 - from });
  for (const s of segments) {
    s.ovals = [];
    for (let x = s.x + 30; x < s.x + s.w - 30; x += between(60, 110)) {
      s.ovals.push({ x, y: GROUND_Y + between(52, 118), rx: between(7, 13), ry: between(4, 7) });
    }
  }

  const candidates = shuffle(slots.map((_, i) => i).filter((i) => ['gap', 'coins', 'monster'].includes(kinds[i])), r);
  const platAt = new Set(candidates.slice(0, 2 + Math.floor(r() * 3)));
  const platforms = [];
  const coins = [];
  const springs = [];
  const monsters = [];
  const coinLine = (x0, y, count) => { for (let k = 0; k < count; k++) coins.push({ x: x0 + k * 52, y }); };

  coinLine(400, GROUND_Y - 46, 3);
  let walkers = 0;
  slots.forEach((x, i) => {
    const kind = kinds[i];
    const hasPlat = platAt.has(i);
    if (hasPlat) {
      const w = Math.round(between(200, 270));
      const p = { kind: 'platform', x: Math.round(x - w / 2 + between(-30, 30)), y: Math.round(GROUND_Y - between(190, 225)), w, h: 28 };
      platforms.push(p);
      coinLine(p.x + w / 2 - 52, p.y - 42, 3);
    }
    if (kind === 'gap') {
      if (!hasPlat) {
        for (let k = 0; k < 5; k++) {
          const t = k / 4;
          coins.push({ x: x + (t - 0.5) * 260, y: GROUND_Y - 85 - Math.sin(t * Math.PI) * 130 });
        }
      }
    } else if (kind === 'coins') {
      coinLine(x - 104, GROUND_Y - 46, 5);
    } else if (kind === 'spring') {
      springs.push({ x: x - 32, y: GROUND_Y - 32, w: 64, h: 32 });
      for (let k = 0; k < 4; k++) coins.push({ x, y: GROUND_Y - 270 - k * 80 });
    } else {
      const isSpiky = kind === 'spiky';
      const cactus = isSpiky && r() < 0.5;
      const range = isSpiky ? 70 : between(90, 110);
      let emoji = cactus ? '🌵' : '🦔';
      if (!isSpiky) emoji = walkers++ % 2 === 0 ? mini : pick(BUGS);
      monsters.push({
        x0: x, minX: x - range, maxX: x + range, dir: r() < 0.5 ? -1 : 1,
        speed: cactus ? 0 : (isSpiky ? 45 : 75) * runSpeed, emoji, spiky: isSpiky, phase: r() * 6,
      });
      if (!hasPlat) coinLine(x - 52, GROUND_Y - 200, 3);
    }
  });

  const onGround = (x) => !holes.some(([a, b]) => x > a - 50 && x < b + 50);
  const decorXs = [220, ...slots.slice(1).map((x, i) => (x + slots[i]) / 2), finishX - 200, end - 220];
  const decor = [];
  for (const x of decorXs) {
    if (props.length && onGround(x) && r() < 0.75) decor.push({ x: x + between(-30, 30), e: pick(props), s: Math.round(between(58, 84)) });
  }

  const blocks = Array.from({ length: n }, (_, i) => ({
    kind: 'block', index: i, x: firstBlock + i * BLOCK_GAP - BLOCK_W / 2, y: BLOCK_BOTTOM - BLOCK_H, w: BLOCK_W, h: BLOCK_H,
  }));
  const solids = [
    ...segments.map((s) => ({ kind: 'ground', x: s.x, y: GROUND_Y, w: s.w, h: 2000 })),
    ...springs.map((s, i) => ({ kind: 'spring', index: i, ...s })),
    ...blocks,
  ];

  return { segments, platforms, springs, coins, monsters, blocks, solids, decor, finishX, end, startX: 120 };
}

/** Mutable state for one attempt at a level. */
function makeRun(level) {
  return {
    time: 0,
    hero: {
      x: level.startX, y: GROUND_Y - HERO_H, vx: 0, vy: 0, facing: 1, onGround: true,
      coyote: 0, buffer: 0, canCut: false, invuln: 0, stun: 0, squash: 0, runPhase: 0,
    },
    lastSafe: level.startX,
    camX: 0,
    coins: level.coins.map(() => false),
    monsters: level.monsters.map((m) => ({ x: m.x0, dir: m.dir, dead: 0 })),
    springs: level.springs.map(() => 0),
    blocks: level.blocks.map(() => ({ bump: 0, thud: 0 })),
    particles: [],
    texts: [],
    told: {},
    answerReadyAt: 0,
  };
}

/* ----------------------------------------------------------------- physics */

function tell(run, fx, key) {
  if (run.told[key]) return;
  run.told[key] = true;
  fx.toast(key);
}

function burst(run, x, y, n, colors, speed) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.6);
    const life = 0.45 + Math.random() * 0.3;
    run.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life, max: life, r: 4 + Math.random() * 4, color: colors[k % colors.length] });
  }
}

function steer(h, input, dt) {
  const dir = h.stun > 0 ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir) {
    const accel = h.onGround ? PHYS.accelGround : PHYS.accelAir;
    const turning = h.vx * dir < 0;
    h.vx = clamp(h.vx + dir * accel * (turning ? 2 : 1) * dt, -PHYS.runMax, PHYS.runMax);
    h.facing = dir;
  } else if (h.stun <= 0) {
    const decel = (h.onGround ? PHYS.decelGround : PHYS.decelAir) * dt;
    h.vx = Math.abs(h.vx) <= decel ? 0 : h.vx - Math.sign(h.vx) * decel;
  }
}

function hitBlock(run, block, p, fx) {
  const opt = p.options[block.index];
  const st = run.blocks[block.index];
  if (!opt || !st) return;
  if (p.disabled.has(opt.id)) {
    st.thud = 1;
    fx.sound('thud');
    fx.toast('tried');
    return;
  }
  if (p.locked || run.time < run.answerReadyAt) {
    st.thud = 1;
    fx.sound('thud');
    return;
  }
  st.bump = 1;
  run.answerReadyAt = run.time + 1;
  burst(run, block.x + block.w / 2, block.y, 14, PARTY, 360);
  fx.sound('bump');
  fx.answer(opt.id);
}

/** Moves the hero one axis at a time and resolves collisions with solids and platforms. */
function moveHero(run, level, p, fx, dt) {
  const h = run.hero;
  const prevTop = h.y;
  const prevBottom = h.y + HERO_H;
  const wasOnGround = h.onGround;
  const fallSpeed = h.vy;

  const dx = h.vx * dt;
  h.x = clamp(h.x + dx, 0, level.end - HERO_W);
  for (const s of level.solids) {
    if (s.kind === 'spring') continue; // springs only act from above, kids can walk past them
    if (h.x >= s.x + s.w || h.x + HERO_W <= s.x || h.y >= s.y + s.h || h.y + HERO_H <= s.y + 0.01) continue;
    if (dx > 0) h.x = s.x - HERO_W;
    else if (dx < 0) h.x = s.x + s.w;
    h.vx = 0;
  }

  h.y += h.vy * dt;
  h.onGround = false;
  let land = null;
  let head = null;
  let headOverlap = 0;
  const x0 = h.x;
  const x1 = h.x + HERO_W;
  for (const s of level.solids) {
    const overlap = Math.min(x1, s.x + s.w) - Math.max(x0, s.x);
    if (overlap <= 0) continue;
    if (h.vy >= 0 && prevBottom <= s.y + 0.5 && h.y + HERO_H >= s.y) {
      if (!land || s.y < land.y) land = s;
    } else if (h.vy < 0 && prevTop >= s.y + s.h - 0.5 && h.y < s.y + s.h && overlap > headOverlap) {
      head = s;
      headOverlap = overlap;
    }
  }
  if (h.vy >= 0) {
    for (const pl of level.platforms) {
      if (x1 <= pl.x || x0 >= pl.x + pl.w) continue;
      if (prevBottom <= pl.y + 0.5 && h.y + HERO_H >= pl.y && (!land || pl.y < land.y)) land = pl;
    }
  }

  if (land) {
    h.y = land.y - HERO_H;
    if (land.kind === 'spring') {
      h.vy = -PHYS.springV;
      h.canCut = false;
      run.springs[land.index] = 1;
      fx.sound('spring');
    } else {
      if (!wasOnGround && fallSpeed > 380) h.squash = 1;
      h.vy = 0;
      h.onGround = true;
      // respawn spots keep some run-up away from ledges
      if (land.kind === 'ground' && h.x > land.x + 90 && h.x + HERO_W < land.x + land.w - 90) run.lastSafe = h.x;
    }
  }
  if (head) {
    h.y = head.y + head.h;
    h.vy = 30;
    h.canCut = false;
    if (head.kind === 'block') hitBlock(run, head, p, fx);
  }
}

function respawn(run, fx) {
  Object.assign(run.hero, {
    x: run.lastSafe, y: GROUND_Y - HERO_H, vx: 0, vy: 0, onGround: true,
    buffer: 0, canCut: false, stun: 0, invuln: PHYS.invuln,
  });
  fx.sound('fall');
  fx.toast('fell');
}

function updateMonsters(run, level, dt) {
  level.monsters.forEach((m, i) => {
    const s = run.monsters[i];
    if (s.dead) { s.dead += dt; return; }
    if (!m.speed) return;
    s.x += s.dir * m.speed * dt;
    if (s.x < m.minX) { s.x = m.minX; s.dir = 1; } else if (s.x > m.maxX) { s.x = m.maxX; s.dir = -1; }
  });
}

function hitMonsters(run, level, input, fx, prevBottom, vyBefore) {
  const h = run.hero;
  level.monsters.forEach((m, i) => {
    const s = run.monsters[i];
    if (s.dead) return;
    const mx = s.x - MON_W / 2 + 4;
    const my = GROUND_Y - MON_H + 6;
    if (h.x >= mx + MON_W - 8 || h.x + HERO_W <= mx || h.y >= GROUND_Y || h.y + HERO_H <= my) return;
    const fromAbove = vyBefore > 0 && (prevBottom <= my + 18 || h.y + HERO_H / 2 < my);
    if (fromAbove && !m.spiky) {
      s.dead = 0.001;
      h.y = my - HERO_H;
      h.vy = -(input.jump ? PHYS.bopHighV : PHYS.bopV);
      h.onGround = false;
      h.canCut = false;
      burst(run, s.x, my + 10, 12, PARTY, 340);
      run.particles.push({ ring: true, x: s.x, y: my + 14, life: 0.3, max: 0.3 });
      fx.bop(i);
    } else if (h.invuln <= 0) {
      const away = h.x + HERO_W / 2 < s.x ? -1 : 1;
      Object.assign(h, {
        vx: away * PHYS.knockVX, vy: -PHYS.knockVY, onGround: false, canCut: false,
        invuln: PHYS.invuln, stun: PHYS.stun, buffer: 0,
      });
      fx.sound('hurt');
      tell(run, fx, m.spiky ? 'spiky' : 'side');
    }
  });
}

function grabCoins(run, level, fx) {
  const h = run.hero;
  const cx = h.x + HERO_W / 2;
  const cy = h.y + HERO_H / 2;
  level.coins.forEach((c, i) => {
    if (run.coins[i] || Math.abs(c.x - cx) > 18 + HERO_W / 2 || Math.abs(c.y - cy) > 18 + HERO_H / 2) return;
    run.coins[i] = true;
    burst(run, c.x, c.y, 6, COIN_SPARKS, 200);
    if (fx.coin(i)) run.texts.push({ x: c.x, y: c.y - 16, text: '+1', life: 0.8 });
  });
}

function updateEffects(run, dt) {
  for (let i = 0; i < run.springs.length; i++) run.springs[i] = Math.max(0, run.springs[i] - dt * 3);
  for (const b of run.blocks) { b.bump = Math.max(0, b.bump - dt * 4); b.thud = Math.max(0, b.thud - dt * 5); }
  for (const q of run.particles) {
    q.life -= dt;
    if (q.ring) continue;
    q.vy += 1400 * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
  }
  for (const tx of run.texts) { tx.life -= dt; tx.y -= 70 * dt; }
  if (run.particles.some((q) => q.life <= 0)) run.particles = run.particles.filter((q) => q.life > 0);
  if (run.texts.some((tx) => tx.life <= 0)) run.texts = run.texts.filter((tx) => tx.life > 0);
}

/** One fixed 60 Hz simulation step. */
function stepRun(run, level, input, p, fx, viewW, dt) {
  const h = run.hero;
  run.time += dt;
  h.invuln = Math.max(0, h.invuln - dt);
  h.stun = Math.max(0, h.stun - dt);
  h.squash = Math.max(0, h.squash - dt / 0.15);
  h.coyote = h.onGround ? PHYS.coyote : Math.max(0, h.coyote - dt);

  steer(h, input, dt);

  // buffered jump + coyote time: a press shortly before landing or after leaving a ledge still counts
  if (h.buffer > 0 && h.coyote > 0) {
    h.vy = -PHYS.jumpV;
    h.onGround = false;
    h.coyote = 0;
    h.buffer = 0;
    h.canCut = true;
    fx.sound('jump');
  }
  h.buffer = Math.max(0, h.buffer - dt);
  // variable jump height: letting go early caps the upward speed once
  if (h.canCut && !input.jump && h.vy < -PHYS.jumpCut) { h.vy = -PHYS.jumpCut; h.canCut = false; }
  if (h.vy >= 0) h.canCut = false;
  h.vy = Math.min(PHYS.maxFall, h.vy + PHYS.gravity * dt);

  const prevBottom = h.y + HERO_H;
  const vyBefore = h.vy;
  moveHero(run, level, p, fx, dt);
  if (h.y > H + 140) respawn(run, fx);

  updateMonsters(run, level, dt);
  hitMonsters(run, level, input, fx, prevBottom, vyBefore);
  grabCoins(run, level, fx);
  updateEffects(run, dt);

  if (h.onGround && Math.abs(h.vx) > 30) h.runPhase += dt * Math.abs(h.vx) * 0.045;
  else h.runPhase = 0;
  if (h.x > level.finishX - 60) tell(run, fx, 'finish');

  const target = clamp(h.x + HERO_W / 2 - viewW * 0.4, 0, Math.max(0, level.end - viewW));
  run.camX += (target - run.camX) * Math.min(1, dt * 7);
}

/* ----------------------------------------------------------------- drawing */

function grassBand(ctx, s, depth, color) {
  ctx.fillStyle = color;
  rr(ctx, s.x, GROUND_Y, s.w, depth - 8, [20, 20, 0, 0]);
  ctx.fill();
  ctx.beginPath();
  for (let x = s.x + 12; x + 12 <= s.x + s.w; x += 24) {
    ctx.moveTo(x + 12, GROUND_Y + depth - 10);
    ctx.arc(x, GROUND_Y + depth - 10, 12, 0, Math.PI);
  }
  ctx.fill();
}

function drawGround(ctx, s, grass, rim) {
  const height = H + 60 - GROUND_Y;
  rr(ctx, s.x, GROUND_Y, s.w, height, [20, 20, 0, 0]);
  ctx.fillStyle = DIRT;
  ctx.fill();
  ctx.fillStyle = DIRT_DARK;
  for (const o of s.ovals) {
    ctx.beginPath();
    ctx.ellipse(o.x, o.y, o.rx, o.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  grassBand(ctx, s, 38, rim);
  grassBand(ctx, s, 31, grass);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(s.x + 18, GROUND_Y + 9);
  ctx.lineTo(s.x + s.w - 18, GROUND_Y + 9);
  ctx.stroke();
  rr(ctx, s.x, GROUND_Y, s.w, height, [20, 20, 0, 0]);
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

function drawPlatform(ctx, pl) {
  rr(ctx, pl.x, pl.y + 6, pl.w, pl.h, 14);
  ctx.fillStyle = 'rgba(59, 42, 26, 0.3)';
  ctx.fill();
  rr(ctx, pl.x, pl.y, pl.w, pl.h, 14);
  ctx.fillStyle = CREAM;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  rr(ctx, pl.x + 14, pl.y + 6, pl.w - 28, 5, 2.5);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fill();
}

function drawSpring(ctx, s, squash) {
  // a damped wobble of the pad after a bounce
  const off = squash > 0 ? -Math.sin((1 - squash) * Math.PI * 3) * 12 * squash : 0;
  const padY = s.y + off;
  const coilTop = padY + 12;
  const coilBottom = GROUND_Y - 8;
  ctx.fillStyle = '#475569';
  rr(ctx, s.x + 6, GROUND_Y - 8, s.w - 12, 8, 3);
  ctx.fill();
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(s.x + 16, coilBottom);
  for (let k = 1; k <= 6; k++) ctx.lineTo(k % 2 ? s.x + s.w - 16 : s.x + 16, coilBottom + (coilTop - coilBottom) * (k / 6));
  ctx.stroke();
  rr(ctx, s.x, padY, s.w, 12, 6);
  ctx.fillStyle = '#f472b6';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

function drawCoin(ctx, c, t) {
  const spin = 0.3 + 0.7 * Math.abs(Math.cos(t * 3));
  ctx.save();
  ctx.translate(c.x, c.y + Math.sin(t * 2.4) * 3);
  ctx.scale(spin, 1);
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.fillStyle = '#facc15';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#b45309';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.strokeStyle = '#eab308';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-6, -7, 5, 3, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fill();
  ctx.restore();
}

function drawFlag(ctx, x, color, t) {
  const top = GROUND_Y - 250;
  const wave = Math.sin(t * 4) * 8;
  rr(ctx, x - 5, top, 10, GROUND_Y - top, 5);
  ctx.fillStyle = '#e2e8f0';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 5, top + 14);
  ctx.quadraticCurveTo(x + 50, top + 22 + wave, x + 92, top + 40 + wave * 0.5);
  ctx.quadraticCurveTo(x + 50, top + 58 + wave, x + 5, top + 68);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, top, 11, 0, Math.PI * 2);
  ctx.fillStyle = '#facc15';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = `800 30px ${TEXT_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', x + 38, top + 42 + wave * 0.5);
}

function drawBlock(ctx, b, st, opt, disabled, t) {
  const idle = Math.sin(t * 2 + b.index) * 3;
  const bump = st.bump > 0 ? -Math.sin((1 - st.bump) * Math.PI) * 22 : 0;
  const thud = st.thud > 0 ? -Math.sin((1 - st.thud) * Math.PI) * 6 : 0;
  const x = b.x;
  const y = b.y + idle + bump + thud;
  const cx = x + b.w / 2;
  const c = disabled ? BLOCK_GREY : BLOCK_COLORS[b.index % BLOCK_COLORS.length];

  ctx.save();
  if (disabled) ctx.globalAlpha = 0.75;
  ctx.lineWidth = 4;
  ctx.strokeStyle = OUTLINE;
  rr(ctx, x, y + 8, b.w, b.h, 24);
  ctx.fillStyle = c.dark;
  ctx.fill();
  ctx.stroke();
  rr(ctx, x, y, b.w, b.h, 24);
  ctx.fillStyle = c.fill;
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  for (const [dx, dy] of [[14, 14], [b.w - 14, 14], [14, b.h - 14], [b.w - 14, b.h - 14]]) {
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(cx, y + 44, 28, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = c.dark;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 34px ${TEXT_FONT}`;
  ctx.fillStyle = c.dark;
  ctx.fillText(LETTERS[b.index] || '?', cx, y + 46);

  const { size, lines } = fitText(ctx, opt.text, b.w - 20);
  ctx.font = `700 ${size}px ${TEXT_FONT}`;
  ctx.fillStyle = disabled ? '#64748b' : '#1e293b';
  const lineH = size * 1.1;
  lines.forEach((line, k) => ctx.fillText(line, cx, y + 110 + (k - (lines.length - 1) / 2) * lineH));
  ctx.restore();
}

function drawMonster(ctx, m, s, t) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
  ctx.beginPath();
  ctx.ellipse(s.x, GROUND_Y - 2, 22, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(s.x, GROUND_Y);
  let lift = 0;
  if (s.dead) {
    const k = Math.min(1, s.dead / 0.25);
    ctx.globalAlpha = 1 - k * 0.7;
    ctx.scale(1 + 0.5 * k, 1 - 0.75 * k);
  } else {
    if (m.speed) {
      lift = Math.abs(Math.sin(t * 9 + m.phase)) * 4;
      ctx.rotate(Math.sin(t * 9 + m.phase) * 0.08);
    }
    if (s.dir > 0) ctx.scale(-1, 1); // most animal emoji face left
  }
  drawEmoji(ctx, m.emoji, 0, -MON_H / 2 - 2 - lift, 50);
  ctx.restore();
}

function drawHero(ctx, h, emoji, hat) {
  if (h.invuln > 0 && Math.floor(h.invuln * 10) % 2 === 0) return; // blink while invulnerable
  const cx = h.x + HERO_W / 2;
  const feet = h.y + HERO_H;
  const running = h.onGround && Math.abs(h.vx) > 30;
  const bob = running ? Math.abs(Math.sin(h.runPhase)) * 6 : 0;
  let sx = 1;
  let sy = 1;
  if (h.squash > 0) { sx = 1 + 0.22 * h.squash; sy = 1 - 0.22 * h.squash; } else if (!h.onGround) { sx = 0.94; sy = 1.07; }

  ctx.save();
  if (h.onGround) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.ellipse(cx, feet - 2, 22, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.translate(cx, feet - bob);
  if (running) ctx.rotate(Math.sin(h.runPhase) * 0.07);
  ctx.scale(sx * (h.facing < 0 ? -1 : 1), sy);
  drawEmoji(ctx, emoji, 0, -HERO_FONT / 2 + 3, HERO_FONT);
  if (hat) drawEmoji(ctx, hat, 0, -HERO_FONT + 4, 32);
  ctx.restore();
}

function drawEffects(ctx, run) {
  for (const q of run.particles) {
    const a = clamp(q.life / q.max, 0, 1);
    ctx.globalAlpha = a;
    ctx.beginPath();
    if (q.ring) {
      ctx.arc(q.x, q.y, 10 + (1 - a) * 40, 0, Math.PI * 2);
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    } else {
      ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
      ctx.fillStyle = q.color;
      ctx.fill();
    }
  }
  ctx.font = `800 28px ${TEXT_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const tx of run.texts) {
    ctx.globalAlpha = clamp(tx.life / 0.8, 0, 1);
    ctx.lineWidth = 5;
    ctx.strokeStyle = OUTLINE;
    ctx.strokeText(tx.text, tx.x, tx.y);
    ctx.fillStyle = '#facc15';
    ctx.fillText(tx.text, tx.x, tx.y);
  }
  ctx.globalAlpha = 1;
}

function drawRun(ctx, canvas, run, level, p, view, clock) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!view.w) return;
  const k = view.scale * view.dpr;
  const cam = clamp(run.camX, 0, Math.max(0, level.end - view.w));
  ctx.setTransform(k, 0, 0, k, -cam * k, view.offY * k);
  ctx.imageSmoothingQuality = 'high';
  const left = cam - 240;
  const right = cam + view.w + 240;
  const seen = (x, w) => x + w > left && x < right;
  const { world } = p;

  for (const d of level.decor) if (seen(d.x - d.s, d.s * 2)) drawEmoji(ctx, d.e, d.x, GROUND_Y - d.s * 0.42, d.s);
  if (seen(level.finishX - 20, 140)) drawFlag(ctx, level.finishX, world.accent, clock);
  for (const pl of level.platforms) if (seen(pl.x, pl.w)) drawPlatform(ctx, pl);
  const rim = shade(world.near, -0.28);
  for (const s of level.segments) if (seen(s.x, s.w)) drawGround(ctx, s, world.near, rim);
  level.springs.forEach((s, i) => { if (seen(s.x, s.w)) drawSpring(ctx, s, run.springs[i]); });
  level.coins.forEach((c, i) => { if (!run.coins[i] && seen(c.x - 20, 40)) drawCoin(ctx, c, clock + i * 0.37); });
  level.blocks.forEach((b) => {
    const opt = p.options[b.index];
    if (opt && seen(b.x, b.w)) drawBlock(ctx, b, run.blocks[b.index], opt, p.disabled.has(opt.id), clock);
  });
  level.monsters.forEach((m, i) => {
    const s = run.monsters[i];
    if (s.dead < 0.35 && seen(s.x - 40, 80)) drawMonster(ctx, m, s, run.time);
  });
  drawHero(ctx, run.hero, p.hero, p.hat);
  drawEffects(ctx, run);
}

function keyAction(e) {
  const { code, key } = e;
  if (code === 'ArrowLeft' || code === 'KeyA' || key === 'ArrowLeft' || key === 'Left' || key === 'a' || key === 'A') return 'left';
  if (code === 'ArrowRight' || code === 'KeyD' || key === 'ArrowRight' || key === 'Right' || key === 'd' || key === 'D') return 'right';
  if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW' || key === ' ' || key === 'Spacebar'
    || key === 'ArrowUp' || key === 'Up' || key === 'w' || key === 'W') return 'jump';
  return null;
}

const isTyping = (el) => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/* --------------------------------------------------------------- component */

/**
 * Side-scrolling "adventure run": collect coins, bop monsters, then jump into the A–D block
 * with the right answer. The parent owns hearts/coins/feedback; see props below.
 */
export default function Runner({
  world, hero = '🦊', hat = null, age = '6-7', question, disabledOptionIds = [], seed = 1,
  onCoin, onBop, onAnswer, locked = false, onExit,
}) {
  const { t } = useTranslation('adventureRun');
  const rules = AGES[age] || AGES['6-7'];
  const optionCount = Math.min(4, question?.options?.length || 0);
  const mini = world.mini;
  const propsKey = world.props.join('|');
  const level = useMemo(
    () => makeLevel({ seed, optionCount, spiky: rules.spiky, runSpeed: rules.runSpeed, mini, props: propsKey.split('|') }),
    [seed, optionCount, rules.spiky, rules.runSpeed, mini, propsKey],
  );

  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const bgRef = useRef(null);
  const levelRef = useRef(level);
  const runRef = useRef(null);
  const propsRef = useRef(null);
  const viewRef = useRef({ w: 0, scale: 1, dpr: 1, offY: 0, cssW: 0, cssH: 0, bgW: 0, bgX: null });
  const keysRef = useRef({ left: new Set(), right: new Set(), jump: new Set() });
  const touchRef = useRef({ left: new Set(), right: new Set(), jump: new Set() });
  const rewardsRef = useRef({ coins: new Set(), bops: new Set() });
  const [phase, setPhase] = useState('intro');
  const phaseRef = useRef(phase);
  const [toast, setToast] = useState(null);
  const [coarse, setCoarse] = useState(() => !!window.matchMedia?.('(pointer: coarse)').matches);

  // latest props for the game loop
  useEffect(() => {
    propsRef.current = {
      world, hero, hat, options: question?.options || [], disabled: new Set(disabledOptionIds || []),
      locked: !!locked, onCoin, onBop, onAnswer,
    };
  });

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // a new layout (seed / option count / age / world) starts a fresh run
  useEffect(() => {
    levelRef.current = level;
    runRef.current = makeRun(level);
    rewardsRef.current = { coins: new Set(), bops: new Set() };
  }, [level]);

  // drop a buffered jump whenever the parent locks or unlocks input
  useEffect(() => {
    if (runRef.current) runRef.current.hero.buffer = 0;
  }, [locked]);

  useEffect(() => {
    if (phase === 'play') return;
    const tc = touchRef.current;
    tc.left.clear();
    tc.right.clear();
    tc.jump.clear();
  }, [phase]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const mq = window.matchMedia?.('(pointer: coarse)');
    if (!mq?.addEventListener) return undefined;
    const onChange = () => setCoarse(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const showToast = useCallback((key) => setToast({ key, id: Math.random() }), []);

  const pressJump = useCallback(() => {
    const run = runRef.current;
    if (!run || phaseRef.current !== 'play' || propsRef.current?.locked) return;
    run.hero.buffer = PHYS.buffer;
  }, []);

  const start = useCallback(() => {
    if (phaseRef.current === 'play') return;
    phaseRef.current = 'play';
    setPhase('play');
    sfx.start();
  }, []);

  const restart = () => {
    runRef.current = makeRun(levelRef.current);
    phaseRef.current = 'play';
    setPhase('play');
  };

  // canvas size, device pixel ratio and background width
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const bg = bgRef.current;
    const fit = () => {
      const rect = wrap.getBoundingClientRect();
      const cssW = Math.max(1, rect.width);
      const cssH = Math.max(1, rect.height);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const scale = Math.min(cssH / H, cssW / MIN_VIEW_W);
      const bgW = Math.max(cssH * (3200 / 900), cssW * 1.05);
      Object.assign(viewRef.current, { cssW, cssH, dpr, scale, w: cssW / scale, offY: cssH / scale - H, bgW, bgX: null });
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      bg.style.width = `${bgW}px`;
    };
    fit();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', fit);
      return () => window.removeEventListener('resize', fit);
    }
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // keyboard
  useEffect(() => {
    const keys = keysRef.current;
    const clearKeys = () => { keys.left.clear(); keys.right.clear(); keys.jump.clear(); };
    const onDown = (e) => {
      if (isTyping(e.target)) return;
      const ph = phaseRef.current;
      if (ph === 'intro') {
        const confirm = e.key === 'Enter' || e.code === 'Space' || e.key === ' ';
        if (confirm && !e.target?.closest?.('button, a')) { e.preventDefault(); start(); }
        return;
      }
      if (e.key === 'Escape') {
        if (ph === 'play' || ph === 'paused') setPhase(ph === 'play' ? 'paused' : 'play');
        return;
      }
      if (ph !== 'play') return;
      const action = keyAction(e);
      if (!action) return;
      e.preventDefault();
      if (action === 'jump' && !e.repeat) pressJump();
      keys[action].add(e.code || e.key);
    };
    const onUp = (e) => {
      const action = keyAction(e);
      if (!action) return;
      keys[action].delete(e.code || e.key);
      if (phaseRef.current === 'play') e.preventDefault();
    };
    const onVisibility = () => {
      if (!document.hidden) return;
      clearKeys();
      if (phaseRef.current === 'play') setPhase('paused');
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', clearKeys);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', clearKeys);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [pressJump, start]);

  // game loop: fixed 60 Hz simulation, render every animation frame
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const fx = {
      sound: playSound,
      toast: showToast,
      answer: (id) => propsRef.current?.onAnswer?.(id),
      // coins and bops are reported once per layout, so "Start over" cannot farm rewards
      coin: (i) => {
        playSound('coin');
        const seen = rewardsRef.current.coins;
        if (seen.has(i)) return false;
        seen.add(i);
        propsRef.current?.onCoin?.();
        return true;
      },
      bop: (i) => {
        playSound('bop');
        const seen = rewardsRef.current.bops;
        if (seen.has(i)) return;
        seen.add(i);
        propsRef.current?.onBop?.();
      },
    };
    const readInput = (p) => {
      if (p.locked) return NO_INPUT;
      const k = keysRef.current;
      const tc = touchRef.current;
      return {
        left: k.left.size > 0 || tc.left.size > 0,
        right: k.right.size > 0 || tc.right.size > 0,
        jump: k.jump.size > 0 || tc.jump.size > 0,
      };
    };

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = clamp((now - last) / 1000, 0, 0.1);
      last = now;
      const run = runRef.current;
      const lv = levelRef.current;
      const view = viewRef.current;
      const p = propsRef.current;
      if (!run || !p) return;
      if (phaseRef.current === 'play') {
        acc += dt;
        let steps = 0;
        while (acc >= STEP && steps < 5) {
          stepRun(run, lv, readInput(p), p, fx, view.w, STEP);
          acc -= STEP;
          steps += 1;
        }
        if (steps === 5) acc = 0;
      } else {
        acc = 0;
      }
      drawRun(ctx, canvas, run, lv, p, view, now / 1000);

      // parallax: the background moves at up to 0.3x the camera, never past its own edge
      const bg = bgRef.current;
      if (bg && view.w) {
        const cam = clamp(run.camX, 0, Math.max(0, lv.end - view.w));
        const travel = Math.max(1, (lv.end - view.w) * view.scale);
        const factor = clamp((view.bgW - view.cssW) / travel, 0, 0.3);
        const px = Math.round(-cam * view.scale * factor * 10) / 10;
        if (px !== view.bgX) {
          view.bgX = px;
          bg.style.transform = `translate3d(${px}px, 0, 0)`;
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [showToast]);

  // touch buttons: implicit pointer capture is released so a finger can slide between buttons
  const pad = (action) => {
    const press = (e) => {
      const set = touchRef.current[action];
      if (action === 'jump' && set.size === 0) pressJump();
      set.add(e.pointerId);
      e.currentTarget.dataset.state = 'on';
    };
    const release = (e) => {
      const set = touchRef.current[action];
      set.delete(e.pointerId);
      if (!set.size) e.currentTarget.dataset.state = 'off';
    };
    return {
      onPointerDown: (e) => {
        e.preventDefault();
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        press(e);
      },
      onPointerEnter: (e) => { if (e.pointerType === 'touch' || e.buttons) press(e); },
      onPointerUp: release,
      onPointerLeave: release,
      onPointerCancel: release,
      onContextMenu: (e) => e.preventDefault(),
    };
  };

  const padBase = 'grid touch-none select-none place-items-center rounded-full bg-white/35 text-slate-800 shadow-lg ring-2 ring-white/70 backdrop-blur-sm transition-colors data-[state=on]:bg-white/80';
  const padSize = coarse ? 'h-20 w-20' : 'h-14 w-14 opacity-70 hover:opacity-100';
  const jumpSize = coarse ? 'h-24 w-24' : 'h-16 w-16 opacity-70 hover:opacity-100';
  const iconSize = coarse ? 'h-10 w-10' : 'h-7 w-7';
  const worldName = t(`adventure:worlds.${world.id}.name`, { defaultValue: world.id });
  const menuBtn = 'flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-game text-lg font-bold transition active:translate-y-0.5';

  return (
    <div ref={wrapRef} className="absolute inset-0 select-none overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div ref={bgRef} className="absolute left-0 top-0 h-full will-change-transform">
          <Scene world={world} width={3200} />
        </div>
      </div>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />

      {/* own UI uses z-20 so it stays above a parent HUD layered at z-10 */}
      {phase === 'play' && (
        <>
          <button
            type="button"
            onClick={() => setPhase('paused')}
            aria-label={t('run.pause')}
            title={t('run.pause')}
            className="absolute left-3 top-3 z-20 grid h-12 w-12 place-items-center rounded-full bg-white text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-95"
          >
            <Pause className="h-6 w-6" />
          </button>
          <div className="absolute bottom-4 left-4 z-20 flex gap-3">
            <button type="button" tabIndex={-1} aria-label={t('run.left')} className={`${padBase} ${padSize}`} {...pad('left')}>
              <ChevronLeft className={iconSize} strokeWidth={3} />
            </button>
            <button type="button" tabIndex={-1} aria-label={t('run.right')} className={`${padBase} ${padSize}`} {...pad('right')}>
              <ChevronRight className={iconSize} strokeWidth={3} />
            </button>
          </div>
          <div className="absolute bottom-4 right-4 z-20">
            <button type="button" tabIndex={-1} aria-label={t('run.jump')} className={`${padBase} ${jumpSize}`} {...pad('jump')}>
              <ArrowUpToLine className={iconSize} strokeWidth={3} />
            </button>
          </div>
        </>
      )}

      {toast && (
        <div className="pointer-events-none absolute inset-x-0 top-[18%] z-20 flex justify-center px-4">
          <div key={toast.id} className="animate-pop rounded-2xl bg-white/95 px-5 py-2.5 text-center font-game text-lg font-bold text-slate-800 shadow-lg">
            {t(`run.toast.${toast.key}`)}
          </div>
        </div>
      )}

      {phase === 'intro' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-slate-900/30 p-4">
          <div className="animate-pop w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="text-5xl" aria-hidden="true">{hero}</div>
            <h2 className="mt-2 font-game text-2xl font-bold text-slate-800">{t('run.title', { world: worldName })}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{rules.spiky ? t('run.intro') : t('run.introNoSpiky')}</p>
            {question?.text && (
              <div className="mt-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{t('run.questionLabel')}</div>
                <div className="mt-1 inline-block rounded-3xl bg-violet-50 px-4 py-2 font-game text-lg font-bold text-violet-800 ring-1 ring-violet-200">
                  {question.text}
                </div>
              </div>
            )}
            <p className="mt-4 text-xs font-semibold text-slate-500">{coarse ? t('run.controlsTouch') : t('run.controlsKeys')}</p>
            <button
              type="button"
              autoFocus
              onClick={start}
              className="mt-5 w-full rounded-2xl bg-emerald-600 py-3 font-game text-2xl font-bold text-white shadow-[0_4px_0_#166534] transition hover:bg-emerald-500 active:translate-y-0.5 active:shadow-none"
            >
              {t('run.go')}
            </button>
            <button type="button" onClick={() => onExit?.()} className="mt-4 text-sm font-semibold text-violet-700 underline-offset-2 hover:underline">
              {t('run.quizCard')}
            </button>
          </div>
        </div>
      )}

      {phase === 'paused' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="animate-pop w-full max-w-xs rounded-3xl bg-white p-6 text-center shadow-2xl">
            <h2 className="font-game text-2xl font-bold text-slate-800">{t('run.paused')}</h2>
            <div className="mt-5 space-y-3">
              <button type="button" autoFocus onClick={() => setPhase('play')} className={`${menuBtn} bg-emerald-600 text-white shadow-[0_4px_0_#166534] hover:bg-emerald-500 active:shadow-none`}>
                <Play className="h-5 w-5" /> {t('run.keepPlaying')}
              </button>
              <button type="button" onClick={restart} className={`${menuBtn} bg-white text-slate-700 ring-2 ring-slate-200 shadow-[0_4px_0_#e2e8f0] hover:bg-slate-50 active:shadow-none`}>
                <RotateCcw className="h-5 w-5" /> {t('run.startOver')}
              </button>
              <button type="button" onClick={() => onExit?.()} className={`${menuBtn} text-violet-700 hover:bg-violet-50`}>
                <ScrollText className="h-5 w-5" /> {t('run.quizCard')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
