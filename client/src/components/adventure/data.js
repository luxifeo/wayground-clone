// Adventure mode: worlds, heroes, rewards and how a quiz becomes a path of checkpoints.
// Visuals are drawn with SVG + emoji (see Scene.jsx), names and texts live in i18n "adventure".

export const WORLDS = [
  {
    id: 'dino', cat: 'animals', boss: '🦖', mini: '🥚', props: ['🌴', '🦕', '🌋', '🌿'],
    sky: ['#9fd8ff', '#e6f7ff'], far: '#8fb8a8', mid: '#6fbf73', near: '#4caf50', ground: '#f3e3c3', accent: '#16a34a', sun: '#fff3b0',
  },
  {
    id: 'bakery', cat: 'sweets', boss: '🎂', mini: '🍩', props: ['🧁', '🍰', '🐱', '🥐'],
    sky: ['#ffd6e7', '#fff4f8'], far: '#f4b6c2', mid: '#f9c5d1', near: '#f48fb1', ground: '#fff1dc', accent: '#db2777', sun: '#fff7c2',
  },
  {
    id: 'space', cat: 'fantasy', boss: '👾', mini: '🛸', props: ['🪐', '⭐', '🚀', '☄️'],
    sky: ['#1e1b4b', '#5b3d99'], far: '#3b2f7a', mid: '#4c3d93', near: '#6d5bb5', ground: '#cbbcf6', accent: '#7c3aed', sun: '#f5f3ff', night: true,
  },
  {
    id: 'pirate', cat: 'outdoors', boss: '🐙', mini: '🦀', props: ['🏝️', '⚓', '🦜', '🐚'],
    sky: ['#7dd3fc', '#e0f7ff'], far: '#38bdf8', mid: '#facc6b', near: '#eab84c', ground: '#fde9b8', accent: '#0284c7', sun: '#fff1a8', sea: true,
  },
  {
    id: 'unicorn', cat: 'fantasy', boss: '⛈️', mini: '🌧️', props: ['🌈', '🦄', '☁️', '✨'],
    sky: ['#e9d5ff', '#fdf4ff'], far: '#d8b4fe', mid: '#c4b5fd', near: '#a5b4fc', ground: '#fae8ff', accent: '#9333ea', sun: '#fff7d6',
  },
  {
    id: 'panda', cat: 'animals', boss: '🤖', mini: '🐒', props: ['🎋', '🐼', '⛩️', '🌸'],
    sky: ['#c7f0d8', '#f2fff6'], far: '#86c49b', mid: '#5fae7a', near: '#3f9461', ground: '#eaf3d6', accent: '#15803d', sun: '#fffbd1',
  },
  {
    id: 'fire', cat: 'outdoors', boss: '🔥', mini: '💨', props: ['🚒', '🧯', '🏠', '🌳'],
    sky: ['#ffd8b8', '#fff5ec'], far: '#f6a07a', mid: '#9ccc65', near: '#7cb342', ground: '#f6e7cf', accent: '#dc2626', sun: '#fff0b3',
  },
  {
    id: 'candy', cat: 'sweets', boss: '🧸', mini: '🍬', props: ['🍭', '🍬', '🍫', '🎈'],
    sky: ['#ffd1f0', '#fff0fb'], far: '#ff9ed8', mid: '#9be7d8', near: '#6dd3c0', ground: '#ffe9f6', accent: '#e11d74', sun: '#fffad1',
  },
  {
    id: 'camping', cat: 'outdoors', boss: '🦝', mini: '🦉', props: ['⛺', '🌲', '🔥', '🦌'],
    sky: ['#ffcf9e', '#ffeedd'], far: '#c08a6a', mid: '#5f8f5a', near: '#43733f', ground: '#efe0c6', accent: '#c2410c', sun: '#ffe08a',
  },
  {
    id: 'dessert', cat: 'sweets', boss: '🍨', mini: '🍪', props: ['🍦', '🍪', '🍮', '🍓'],
    sky: ['#ffe0b2', '#fff8ec'], far: '#f7b267', mid: '#f4d6a0', near: '#e9b872', ground: '#fff3dd', accent: '#ea580c', sun: '#fff3c4',
  },
];
export const WORLD_CATS = ['all', 'animals', 'sweets', 'fantasy', 'outdoors'];
export const worldById = (id) => WORLDS.find((w) => w.id === id) || WORLDS[0];

export const HEROES = [
  { id: 'fox', emoji: '🦊' }, { id: 'bunny', emoji: '🐰' }, { id: 'panda', emoji: '🐼' },
  { id: 'dino', emoji: '🦖' }, { id: 'kitty', emoji: '🐱' }, { id: 'bear', emoji: '🐻' },
];
export const heroById = (id) => HEROES.find((h) => h.id === id) || HEROES[0];

/** Rules per age group (shown to teachers and applied in the game). */
export const AGES = {
  '4-5': { autoRead: true, autoAdvance: true, runSpeed: 0.8, spiky: false },
  '6-7': { autoRead: false, autoAdvance: false, runSpeed: 1, spiky: true },
  '8-10': { autoRead: false, autoAdvance: false, runSpeed: 1.25, spiky: true },
};
export const DIFFICULTY = {
  easy: { hearts: 3, freeHints: true },
  medium: { hearts: 3, freeHints: false },
  hard: { hearts: 2, freeHints: false },
};

export const DEFAULT_ADVENTURE = { world: 'dino', age: '6-7', difficulty: 'easy', runs: null, count: 0 };

export const BADGES = ['firstStep', 'onFire', 'speedyRunner', 'monsterBopper', 'coinCollector', 'treasureHunter', 'bestFriends', 'bridgeGuard', 'castleHero', 'perfect'];
export const BADGE_ICON = {
  firstStep: '👣', onFire: '🔥', speedyRunner: '🏃', monsterBopper: '🥊', coinCollector: '🪙',
  treasureHunter: '🗝️', bestFriends: '🐾', bridgeGuard: '🌉', castleHero: '🏰', perfect: '💯',
};

/** XP levels shown as "My badge" in the HUD. */
export const LEVELS = [
  { id: 'explorer', xp: 0 }, { id: 'adventurer', xp: 75 }, { id: 'hero', xp: 180 }, { id: 'legend', xp: 320 },
];
export const levelFor = (xp) => [...LEVELS].reverse().find((l) => xp >= l.xp) || LEVELS[0];

export const HATS = [
  { id: 'party', emoji: '🥳', price: 40 }, { id: 'shades', emoji: '🕶️', price: 40 },
  { id: 'flower', emoji: '🌸', price: 50 }, { id: 'pirate', emoji: '🏴‍☠️', price: 60 },
  { id: 'wizard', emoji: '🧙', price: 70 }, { id: 'crown', emoji: '👑', price: null }, // crown only from chests / key
];
export const SHOP = [
  { id: 'heart', emoji: '❤️', price: 15 }, { id: 'hint', emoji: '💡', price: 20 },
  ...HATS.filter((h) => h.price).map((h) => ({ ...h, hat: true })),
];

/** Chest rewards in order: first gives the golden key, second a pet, third the crown. */
export const CHEST_REWARDS = [
  [{ kind: 'coins', n: 50 }, { kind: 'key' }],
  [{ kind: 'coins', n: 40 }, { kind: 'pet' }],
  [{ kind: 'coins', n: 40 }, { kind: 'hat', id: 'crown' }],
];
export const CHEST_STREAK = 4;
export const COIN_PER_CORRECT = 10;
export const XP_PER_CORRECT = 15;
export const PET = { dino: '🦕', bakery: '🐈', space: '👽', pirate: '🦜', unicorn: '🦄', panda: '🐼', fire: '🐶', candy: '🐻', camping: '🦊', dessert: '🐹' };

/** Questions that can be answered by jumping into A–D blocks in an adventure run. */
export const runnable = (q) => ['mcq', 'tf', 'poll'].includes(q.type) && q.options?.length >= 2 && q.options.length <= 4
  && q.options.every((o) => !o.image && String(o.text || '').length <= 18);

/**
 * Turns the ordered question list into map stages.
 * Stage kinds: 'q' (one question), 'game' (one question, may be played as an adventure run),
 * 'mini' (mini boss, 2 questions), 'boss' (final boss, up to 3 questions).
 * A stage with flag:true is a save point that refills hearts.
 */
export function buildStages(questions, { runs = null } = {}) {
  const ids = questions.map((q) => q.id);
  const n = ids.length;
  if (!n) return [];
  const bossN = n >= 6 ? 3 : n >= 3 ? 2 : n === 2 ? 1 : 0;
  const miniN = n >= 9 ? 2 : 0;
  const singles = ids.slice(0, n - bossN);
  const stages = [];
  const miniAt = miniN ? Math.max(2, Math.round((singles.length - miniN) * 0.6)) : -1;
  for (let i = 0; i < singles.length;) {
    if (i === miniAt) {
      stages.push({ kind: 'mini', qids: singles.slice(i, i + miniN), flag: true });
      i += miniN;
    } else {
      stages.push({ kind: 'q', qids: [singles[i]] });
      i += 1;
    }
  }
  if (bossN) stages.push({ kind: 'boss', qids: ids.slice(n - bossN) });
  // adventure-run stations: 1 every 5 questions unless set, never the first stage
  const byId = new Map(questions.map((q) => [q.id, q]));
  const want = runs === null || runs === undefined || runs === '' ? Math.floor(n / 5) : Math.max(0, Number(runs) || 0);
  const candidates = stages.map((s, i) => i).filter((i) => i > 0 && stages[i].kind === 'q' && runnable(byId.get(stages[i].qids[0])));
  for (let k = 0; k < Math.min(want, candidates.length); k++) {
    // spread the stations evenly over the candidates
    const idx = candidates[Math.min(candidates.length - 1, Math.floor(((k + 0.5) * candidates.length) / Math.min(want, candidates.length)))];
    if (stages[idx]) stages[idx].kind = 'game';
  }
  // without a mini boss, put a save flag about every 4 stages
  if (!miniN) stages.forEach((s, i) => { if (i > 0 && i % 4 === 3 && s.kind !== 'boss') s.flag = true; });
  return stages.map((s, i) => ({ ...s, index: i }));
}
