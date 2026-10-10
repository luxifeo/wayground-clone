/** Coordinate plane with integer snapping. Used by the graphing question editor, player and reveal. */
export default function Graph({
  xmin = -10, xmax = 10, ymin = -10, ymax = 10, mode = 'points', points = [], correct = null, onToggle, size = 360, dark = false,
}) {
  const W = size; const H = size * ((ymax - ymin) / (xmax - xmin)) || size;
  const sx = (x) => ((x - xmin) / (xmax - xmin)) * W;
  const sy = (y) => H - ((y - ymin) / (ymax - ymin)) * H;
  const grid = dark ? 'rgba(255,255,255,.12)' : '#e2e8f0';
  const axis = dark ? 'rgba(255,255,255,.7)' : '#475569';
  const label = dark ? 'rgba(255,255,255,.75)' : '#64748b';

  const click = (e) => {
    if (!onToggle) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const py = ((e.clientY - r.top) / r.height) * H;
    const x = Math.round(xmin + (px / W) * (xmax - xmin));
    const y = Math.round(ymin + ((H - py) / H) * (ymax - ymin));
    if (x < xmin || x > xmax || y < ymin || y > ymax) return;
    onToggle(x, y);
  };

  const lineFor = (pts, color, dash) => {
    if (mode !== 'line' || !pts || pts.length < 2) return null;
    const [[x1, y1], [x2, y2]] = pts;
    if (x1 === x2 && y1 === y2) return null;
    if (x1 === x2) return <line x1={sx(x1)} y1={0} x2={sx(x1)} y2={H} stroke={color} strokeWidth="2.5" strokeDasharray={dash} />;
    const m = (y2 - y1) / (x2 - x1);
    const f = (x) => y1 + m * (x - x1);
    return <line x1={sx(xmin)} y1={sy(f(xmin))} x2={sx(xmax)} y2={sy(f(xmax))} stroke={color} strokeWidth="2.5" strokeDasharray={dash} />;
  };

  const xs = []; for (let x = Math.ceil(xmin); x <= xmax; x++) xs.push(x);
  const ys = []; for (let y = Math.ceil(ymin); y <= ymax; y++) ys.push(y);
  const step = Math.max(1, Math.round((xmax - xmin) / 10));

  return (
    <svg viewBox={`-14 -6 ${W + 20} ${H + 22}`} className={`w-full max-w-full select-none ${onToggle ? 'cursor-crosshair' : ''}`} style={{ maxWidth: size + 20 }}>
      <g onClick={click}>
        <rect x={0} y={0} width={W} height={H} fill={dark ? 'rgba(0,0,0,.25)' : '#fff'} />
        {xs.map((x) => <line key={`x${x}`} x1={sx(x)} y1={0} x2={sx(x)} y2={H} stroke={grid} />)}
        {ys.map((y) => <line key={`y${y}`} x1={0} y1={sy(y)} x2={W} y2={sy(y)} stroke={grid} />)}
        {xmin <= 0 && xmax >= 0 && <line x1={sx(0)} y1={0} x2={sx(0)} y2={H} stroke={axis} strokeWidth="1.5" />}
        {ymin <= 0 && ymax >= 0 && <line x1={0} y1={sy(0)} x2={W} y2={sy(0)} stroke={axis} strokeWidth="1.5" />}
        {xs.filter((x) => x % step === 0 && x !== 0).map((x) => <text key={`tx${x}`} x={sx(x)} y={Math.min(H + 12, Math.max(10, sy(0) + 12))} fontSize="9" textAnchor="middle" fill={label}>{x}</text>)}
        {ys.filter((y) => y % step === 0 && y !== 0).map((y) => <text key={`ty${y}`} x={Math.max(-2, Math.min(W - 4, sx(0) - 4))} y={sy(y) + 3} fontSize="9" textAnchor="end" fill={label}>{y}</text>)}
        {correct && lineFor(correct, '#22c55e', '6 4')}
        {correct && correct.map(([x, y]) => <circle key={`c${x},${y}`} cx={sx(x)} cy={sy(y)} r="8" fill="none" stroke="#22c55e" strokeWidth="2.5" />)}
        {lineFor(points, '#7c3aed')}
        {points.map(([x, y]) => (
          <g key={`${x},${y}`}>
            <circle cx={sx(x)} cy={sy(y)} r="5.5" fill="#7c3aed" stroke="#fff" strokeWidth="1.5" />
            <text x={sx(x) + 7} y={sy(y) - 7} fontSize="9" fontWeight="700" fill={dark ? '#fff' : '#4c1d95'}>({x}, {y})</text>
          </g>
        ))}
      </g>
    </svg>
  );
}
