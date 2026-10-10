// Tiny math expression parser/evaluator used to check "Math response" answers for equivalence.
// Supports + - * / ^, parentheses, implicit multiplication (2x, 2(x+1), (a)(b)), variables,
// constants pi/e and functions sqrt, sin, cos, tan, log, ln, abs, exp.

const FUNCS = {
  sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log10, ln: Math.log, abs: Math.abs, exp: Math.exp,
};

function tokenize(src) {
  const s = String(src).replace(/\s+/g, '').replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
    .replace(/√/g, 'sqrt').replace(/π/g, 'pi').replace(/\*\*/g, '^').replace(/,/g, '.');
  const out = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/[0-9.]/.test(ch)) {
      let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++;
      out.push({ t: 'num', v: parseFloat(s.slice(i, j)) }); i = j;
    } else if (/[a-zA-Z]/.test(ch)) {
      const fn = Object.keys(FUNCS).find((f) => s.startsWith(f, i));
      if (fn) { out.push({ t: 'fn', v: fn }); i += fn.length; } else if (s.startsWith('pi', i)) { out.push({ t: 'num', v: Math.PI }); i += 2; } else { out.push({ t: 'var', v: ch }); i++; }
    } else if ('+-*/^()'.includes(ch)) { out.push({ t: 'op', v: ch }); i++; } else throw new Error(`Unexpected "${ch}"`);
  }
  // insert implicit multiplication
  const res = [];
  for (let k = 0; k < out.length; k++) {
    const a = res[res.length - 1]; const b = out[k];
    const aEnds = a && (a.t === 'num' || a.t === 'var' || (a.t === 'op' && a.v === ')'));
    const bStarts = b.t === 'num' || b.t === 'var' || b.t === 'fn' || (b.t === 'op' && b.v === '(');
    if (aEnds && bStarts) res.push({ t: 'op', v: '*' });
    res.push(b);
  }
  return res;
}

function parse(tokens) {
  let p = 0;
  const peek = () => tokens[p];
  const eat = (v) => { const t = tokens[p]; if (!t || (v && t.v !== v)) throw new Error('Syntax error'); p++; return t; };
  function expr() {
    let n = term();
    while (peek() && (peek().v === '+' || peek().v === '-')) { const op = eat().v; const r = term(); const l = n; n = op === '+' ? (s) => l(s) + r(s) : (s) => l(s) - r(s); }
    return n;
  }
  function term() {
    let n = unary();
    while (peek() && (peek().v === '*' || peek().v === '/')) { const op = eat().v; const r = unary(); const l = n; n = op === '*' ? (s) => l(s) * r(s) : (s) => l(s) / r(s); }
    return n;
  }
  function unary() {
    if (peek() && peek().v === '-') { eat(); const u = unary(); return (s) => -u(s); }
    if (peek() && peek().v === '+') { eat(); return unary(); }
    return power();
  }
  function power() {
    const b = atom();
    if (peek() && peek().v === '^') { eat(); const e = unary(); return (s) => b(s) ** e(s); }
    return b;
  }
  function atom() {
    const t = peek();
    if (!t) throw new Error('Unexpected end');
    if (t.t === 'num') { eat(); return () => t.v; }
    if (t.t === 'var') { eat(); return t.v === 'e' ? () => Math.E : (s) => s[t.v] ?? NaN; }
    if (t.t === 'fn') { eat(); const f = FUNCS[t.v]; const a = atom(); return (s) => f(a(s)); }
    if (t.v === '(') { eat('('); const e = expr(); eat(')'); return e; }
    throw new Error('Syntax error');
  }
  const fn = expr();
  if (p !== tokens.length) throw new Error('Syntax error');
  return fn;
}

export function compile(src) {
  let s = String(src || '').trim();
  // "y = 2x+1" -> "2x+1" when the left side is a single variable
  const m = s.match(/^([a-zA-Z])\s*=\s*(.+)$/);
  if (m) s = m[2];
  const tokens = tokenize(s);
  const vars = [...new Set(tokens.filter((t) => t.t === 'var' && t.v !== 'e').map((t) => t.v))];
  return { fn: parse(tokens), vars };
}

/** True when both expressions evaluate to the same value at several random points. */
export function equivalent(a, b) {
  try {
    const A = compile(a); const B = compile(b);
    const vars = [...new Set([...A.vars, ...B.vars])];
    for (let i = 0; i < 6; i++) {
      const scope = Object.fromEntries(vars.map((v) => [v, 0.5 + Math.random() * 3 + i]));
      const x = A.fn(scope); const y = B.fn(scope);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      if (Math.abs(x - y) > 1e-6 * Math.max(1, Math.abs(x), Math.abs(y))) return false;
    }
    return true;
  } catch { return false; }
}
