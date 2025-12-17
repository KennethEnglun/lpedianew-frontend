export type MathOp = 'add' | 'sub' | 'mul' | 'div';

export type MathNumDisplay =
  | { kind: 'frac'; n: number; d: number }
  | { kind: 'mixed'; w: number; n: number; d: number }
  | { kind: 'dec'; raw: string };

export type MathToken =
  | { t: 'num'; n: number; d: number; display?: MathNumDisplay }
  | { t: 'var'; name: 'x' }
  | { t: 'op'; v: MathOp }
  | { t: 'paren'; v: '(' | ')' };

export type Rational = { n: number; d: number };

const gcd = (a: number, b: number) => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
};

export const normalizeRational = (r: Rational): Rational => {
  const n = Number(r?.n);
  const d = Number(r?.d);
  if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0) throw new Error('Invalid rational');
  const sign = d < 0 ? -1 : 1;
  const nn = n * sign;
  const dd = Math.abs(d);
  const g = gcd(nn, dd);
  return { n: nn / g, d: dd / g };
};

export const rationalKey = (r: Rational) => {
  const x = normalizeRational(r);
  return `${x.n}/${x.d}`;
};

export const add = (a: Rational, b: Rational): Rational => {
  const x = normalizeRational(a);
  const y = normalizeRational(b);
  return normalizeRational({ n: x.n * y.d + y.n * x.d, d: x.d * y.d });
};

export const sub = (a: Rational, b: Rational): Rational => {
  const x = normalizeRational(a);
  const y = normalizeRational(b);
  return normalizeRational({ n: x.n * y.d - y.n * x.d, d: x.d * y.d });
};

export const mul = (a: Rational, b: Rational): Rational => {
  const x = normalizeRational(a);
  const y = normalizeRational(b);
  return normalizeRational({ n: x.n * y.n, d: x.d * y.d });
};

export const div = (a: Rational, b: Rational): Rational => {
  const x = normalizeRational(a);
  const y = normalizeRational(b);
  if (y.n === 0) throw new Error('Division by zero');
  return normalizeRational({ n: x.n * y.d, d: x.d * y.n });
};

const OP_PRECEDENCE: Record<MathOp, number> = { add: 1, sub: 1, mul: 2, div: 2 };

export const validateTokens = (tokens: MathToken[], allowedOps: MathOp[], allowParentheses: boolean) => {
  if (!Array.isArray(tokens) || tokens.length === 0) return { ok: false as const, error: '算式不能為空' };
  const opsAllowed = new Set(allowedOps);

  let balance = 0;
  let prev: 'num' | 'op' | '(' | ')' | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.t === 'num') {
      try {
        normalizeRational({ n: t.n, d: t.d });
      } catch {
        return { ok: false as const, error: `第 ${i + 1} 個數字格式不正確` };
      }
      if (prev === 'num' || prev === ')') return { ok: false as const, error: `第 ${i + 1} 個位置缺少運算符` };
      prev = 'num';
      continue;
    }
    if (t.t === 'var') {
      if (t.name !== 'x') return { ok: false as const, error: `第 ${i + 1} 個未知數不支援` };
      if (prev === 'num' || prev === ')') return { ok: false as const, error: `第 ${i + 1} 個位置缺少運算符` };
      prev = 'num';
      continue;
    }
    if (t.t === 'op') {
      if (!opsAllowed.has(t.v)) return { ok: false as const, error: `使用了未允許的運算：${t.v}` };
      if (prev !== 'num' && prev !== ')') return { ok: false as const, error: `第 ${i + 1} 個運算符位置不正確` };
      prev = 'op';
      continue;
    }
    if (t.t === 'paren') {
      if (!allowParentheses) return { ok: false as const, error: '不允許使用括號' };
      if (t.v === '(') {
        if (prev === 'num' || prev === ')') return { ok: false as const, error: `第 ${i + 1} 個位置缺少運算符` };
        balance += 1;
        prev = '(';
      } else {
        if (prev !== 'num' && prev !== ')') return { ok: false as const, error: `第 ${i + 1} 個右括號位置不正確` };
        balance -= 1;
        if (balance < 0) return { ok: false as const, error: '括號不平衡' };
        prev = ')';
      }
      continue;
    }
    return { ok: false as const, error: `第 ${i + 1} 個 token 不支援` };
  }

  if (balance !== 0) return { ok: false as const, error: '括號不平衡' };
  if (prev === 'op' || prev === '(') return { ok: false as const, error: '算式結尾不完整' };
  return { ok: true as const };
};

export const evaluateTokens = (tokens: MathToken[]): Rational => {
  const output: Array<{ t: 'num'; r: Rational } | { t: 'op'; v: MathOp }> = [];
  const ops: MathToken[] = [];

  for (const t of tokens) {
    if (t.t === 'num') {
      output.push({ t: 'num', r: normalizeRational({ n: t.n, d: t.d }) });
      continue;
    }
    if (t.t === 'var') {
      throw new Error('Expression contains variable');
    }
    if (t.t === 'op') {
      const p = OP_PRECEDENCE[t.v];
      while (ops.length > 0) {
        const top = ops[ops.length - 1];
        if (top.t !== 'op') break;
        const tp = OP_PRECEDENCE[top.v];
        if (tp >= p) output.push({ t: 'op', v: (ops.pop() as any).v });
        else break;
      }
      ops.push(t);
      continue;
    }
    if (t.t === 'paren' && t.v === '(') {
      ops.push(t);
      continue;
    }
    if (t.t === 'paren' && t.v === ')') {
      while (ops.length > 0) {
        const top = ops.pop()!;
        if (top.t === 'paren' && top.v === '(') break;
        if (top.t === 'op') output.push({ t: 'op', v: top.v });
      }
      continue;
    }
    throw new Error('Unsupported token');
  }

  while (ops.length > 0) {
    const top = ops.pop()!;
    if (top.t === 'paren') throw new Error('Unbalanced parentheses');
    output.push({ t: 'op', v: top.v });
  }

  const stack: Rational[] = [];
  for (const node of output) {
    if (node.t === 'num') {
      stack.push(node.r);
      continue;
    }
    const b = stack.pop();
    const a = stack.pop();
    if (!a || !b) throw new Error('Malformed expression');
    const r = (() => {
      switch (node.v) {
        case 'add': return add(a, b);
        case 'sub': return sub(a, b);
        case 'mul': return mul(a, b);
        case 'div': return div(a, b);
      }
    })();
    stack.push(r);
  }

  if (stack.length !== 1) throw new Error('Malformed expression');
  return normalizeRational(stack[0]);
};

const shuffleInPlace = <T,>(arr: T[]) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export const generateMcqChoices = (answer: Rational) => {
  const correct = normalizeRational(answer);
  const seen = new Set([rationalKey(correct)]);
  const choices: Rational[] = [correct];

  const isInt = correct.d === 1;
  const baseN = correct.n;
  const baseD = correct.d;
  const candidates: Rational[] = [];

  if (isInt) {
    for (const delta of [1, 2, 3, -1, -2, -3]) candidates.push({ n: baseN + delta, d: 1 });
    candidates.push({ n: baseN * 2, d: 1 });
    candidates.push({ n: baseN === 0 ? 1 : Math.trunc(baseN / 2), d: 1 });
  } else {
    for (const delta of [1, 2, -1, -2]) {
      candidates.push({ n: baseN + delta, d: baseD });
      candidates.push({ n: baseN, d: Math.max(1, baseD + delta) });
    }
    candidates.push({ n: baseN + baseD, d: baseD });
    candidates.push({ n: baseN - baseD, d: baseD });
  }

  for (const c of candidates) {
    if (choices.length >= 4) break;
    try {
      const normalized = normalizeRational(c);
      const key = rationalKey(normalized);
      if (seen.has(key)) continue;
      seen.add(key);
      choices.push(normalized);
    } catch {
      // ignore
    }
  }

  let safety = 0;
  while (choices.length < 4 && safety < 200) {
    safety += 1;
    try {
      const guess = isInt
        ? { n: baseN + (Math.floor(Math.random() * 19) - 9 || 1), d: 1 }
        : { n: baseN + (Math.floor(Math.random() * 7) - 3 || 1), d: Math.max(1, baseD + (Math.floor(Math.random() * 5) - 2)) };
      const normalized = normalizeRational(guess);
      const key = rationalKey(normalized);
      if (seen.has(key)) continue;
      seen.add(key);
      choices.push(normalized);
    } catch {
      // ignore
    }
  }

  shuffleInPlace(choices);
  const correctIndex = choices.findIndex(c => rationalKey(c) === rationalKey(correct));
  return { choices, correctIndex: correctIndex >= 0 ? correctIndex : 0 };
};

export const parseRationalInput = (numeratorRaw: string, denominatorRaw: string): Rational | null => {
  const n = Number.parseInt(String(numeratorRaw || '').trim(), 10);
  if (!Number.isFinite(n)) return null;
  const dText = String(denominatorRaw || '').trim();
  if (!dText) return normalizeRational({ n, d: 1 });
  const d = Number.parseInt(dText, 10);
  if (!Number.isFinite(d) || d === 0) return null;
  return normalizeRational({ n, d });
};
