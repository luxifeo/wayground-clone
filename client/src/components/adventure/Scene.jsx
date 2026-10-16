import { useMemo } from 'react';

// Deterministic pseudo random so a world always looks the same.
function rand(seed) {
  let t = seed >>> 0;
  return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

/** Smooth hill line across the width; returns an SVG path closed at the bottom. */
function hills(width, base, amp, step, r, bottom = 900) {
  const pts = [];
  for (let x = -step; x <= width + step; x += step) pts.push([x, base - r() * amp]);
  let d = `M ${pts[0][0]} ${bottom} L ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1]; const [x, y] = pts[i];
    d += ` Q ${px + step / 2} ${py} ${(px + x) / 2} ${(py + y) / 2} T ${x} ${y}`;
  }
  return `${d} L ${pts[pts.length - 1][0]} ${bottom} Z`;
}

function mountains(width, base, r) {
  let d = `M -100 ${base}`;
  for (let x = -100; x < width + 200;) {
    const w = 160 + r() * 220; const h = 120 + r() * 200;
    d += ` L ${x + w / 2} ${base - h} L ${x + w} ${base}`;
    x += w * (0.55 + r() * 0.3);
  }
  return `${d} L ${width + 200} 900 L -100 900 Z`;
}

/**
 * Layered vector landscape for a world.
 * width: viewBox width (900 tall). props: show emoji decorations. className positions it.
 */
export default function Scene({ world, width = 1600, props = true, className = 'absolute inset-0 h-full w-full', seed = 7 }) {
  const id = `${world.id}-${width}`;
  const art = useMemo(() => {
    const r = rand(seed + world.id.length * 97);
    const clouds = Array.from({ length: Math.ceil(width / 380) }, (_, i) => ({ x: i * 380 + r() * 200, y: 70 + r() * 150, s: 0.7 + r() * 0.7, d: 40 + r() * 40 }));
    const stars = world.night ? Array.from({ length: Math.ceil(width / 12) }, () => ({ x: r() * width, y: r() * 420, s: 0.6 + r() * 1.8 })) : [];
    const deco = props ? Array.from({ length: Math.ceil(width / 260) }, (_, i) => ({
      x: i * 260 + 60 + r() * 120, y: 640 + r() * 220, e: world.props[Math.floor(r() * world.props.length)], s: 46 + r() * 40,
    })) : [];
    const far = Array.from({ length: Math.ceil(width / 500) }, (_, i) => ({ x: i * 500 + 120 + r() * 220, y: 455 + r() * 40, e: world.props[(i + 1) % world.props.length], s: 36 + r() * 20 }));
    return {
      clouds, stars, deco, far,
      mountains: mountains(width, 520, r),
      mid: hills(width, 560, 70, 320, r),
      near: hills(width, 660, 60, 260, r),
    };
  }, [world, width, props, seed]);

  return (
    <svg className={className} viewBox={`0 0 ${width} 900`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={world.sky[0]} />
          <stop offset="1" stopColor={world.sky[1]} />
        </linearGradient>
        <radialGradient id={`sun-${id}`}>
          <stop offset="0" stopColor={world.sun} stopOpacity="1" />
          <stop offset="1" stopColor={world.sun} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`ground-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={world.near} />
          <stop offset="1" stopColor={world.near} stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <rect width={width} height="900" fill={`url(#sky-${id})`} />
      {art.stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#fff" opacity={0.5 + (i % 5) / 10} className="adv-twinkle" style={{ animationDelay: `${(i % 7) * 0.4}s` }} />)}
      <circle cx={width * 0.78} cy="150" r="190" fill={`url(#sun-${id})`} />
      <circle cx={width * 0.78} cy="150" r={world.night ? 46 : 58} fill={world.sun} opacity="0.95" />
      {art.clouds.map((c, i) => (
        <g key={i} className="adv-cloud" style={{ animationDuration: `${c.d}s` }} opacity={world.night ? 0.25 : 0.9}>
          <g transform={`translate(${c.x} ${c.y}) scale(${c.s})`}>
            <ellipse cx="0" cy="0" rx="70" ry="26" fill="#fff" />
            <ellipse cx="-36" cy="-14" rx="36" ry="26" fill="#fff" />
            <ellipse cx="30" cy="-20" rx="44" ry="32" fill="#fff" />
          </g>
        </g>
      ))}
      <path d={art.mountains} fill={world.far} opacity="0.75" />
      {world.sea && <rect x="0" y="520" width={width} height="120" fill="#38bdf8" opacity="0.85" />}
      <path d={art.mid} fill={world.mid} />
      {art.far.map((d, i) => <text key={i} x={d.x} y={d.y} fontSize={d.s} textAnchor="middle" opacity="0.9">{d.e}</text>)}
      <path d={art.near} fill={`url(#ground-${id})`} />
      {art.deco.map((d, i) => <text key={i} x={d.x} y={d.y} fontSize={d.s} textAnchor="middle">{d.e}</text>)}
    </svg>
  );
}
