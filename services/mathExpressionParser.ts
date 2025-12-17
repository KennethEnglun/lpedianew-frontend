import type { MathOp, MathToken } from './mathGame';
import { validateTokens } from './mathGame';

type ParseResult = { ok: true; tokens: MathToken[] } | { ok: false; error: string };

const isDigit = (ch: string) => ch >= '0' && ch <= '9';

const isPowerOfTen = (n: number) => {
  if (!Number.isInteger(n) || n <= 0) return false;
  let x = n;
  while (x % 10 === 0) x = Math.trunc(x / 10);
  return x === 1;
};

const decimalToRational = (sign: number, rawText: string) => {
  const s = String(rawText || '').trim();
  const m = s.match(/^(\d*)\.(\d+)$/);
  if (!m) return null;
  const intPart = m[1] || '0';
  const fracPart = m[2] || '';
  const k = fracPart.length;
  const d = 10 ** k;
  if (!Number.isFinite(d) || !isPowerOfTen(d)) return null;
  const nInt = Number.parseInt(intPart || '0', 10);
  const nFrac = Number.parseInt(fracPart || '0', 10);
  if (!Number.isFinite(nInt) || !Number.isFinite(nFrac)) return null;
  const n = sign * (nInt * d + nFrac);
  return { n, d };
};

const formatSignedDecimalRaw = (sign: number, rawText: string) => {
  const s = String(rawText || '').trim();
  if (!s) return '';
  return sign < 0 ? `-${s}` : s;
};

const opFromChar = (ch: string): MathOp | null => {
  if (ch === '+') return 'add';
  if (ch === '-') return 'sub';
  if (ch === 'x' || ch === 'X' || ch === '*' || ch === '×') return 'mul';
  if (ch === '÷' || ch === ':') return 'div';
  if (ch === '/') return 'div';
  return null;
};

export const parseMathExpressionToTokens = (input: string, options: {
  allowedOps: MathOp[];
  allowParentheses: boolean;
  allowVariableX?: boolean;
}): ParseResult => {
  const raw = String(input || '').trim();
  if (!raw) return { ok: false, error: '請輸入算式' };

  const tokens: MathToken[] = [];
  let i = 0;

  const prevKind = () => {
    const last = tokens[tokens.length - 1];
    if (!last) return null;
    if (last.t === 'num') return 'num';
    if (last.t === 'var') return 'num';
    if (last.t === 'op') return 'op';
    if (last.t === 'paren') return last.v;
    return null;
  };

  const pushImplicitMulIfNeeded = (nextIs: 'num' | '(') => {
    const prev = prevKind();
    if (prev === 'num' || prev === ')') {
      // 2(3+4), )(, )2
      tokens.push({ t: 'op', v: 'mul' });
    }
    if (nextIs === 'num' && prev === 'num') {
      // Avoid "23" split; shouldn't happen because we parse multi-digit numbers.
      return;
    }
  };

  while (i < raw.length) {
    const ch = raw[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (ch === '(' || ch === ')') {
      if (ch === '(') pushImplicitMulIfNeeded('(');
      tokens.push({ t: 'paren', v: ch });
      i += 1;
      continue;
    }

    // unary +/-
    if (ch === '+' || ch === '-') {
      const prev = prevKind();
      const isUnary = prev === null || prev === 'op' || prev === '(';
      const next = raw[i + 1] || '';

      if (isUnary && next === '(' && ch === '-') {
        // -(...) => 0 - (...)
        tokens.push({ t: 'num', n: 0, d: 1 });
        tokens.push({ t: 'op', v: 'sub' });
        i += 1;
        continue;
      }

      if (isUnary && options.allowVariableX && next === '□') {
        if (ch === '+') {
          i += 1;
          continue;
        }
        // -□ => 0 - □
        tokens.push({ t: 'num', n: 0, d: 1 });
        tokens.push({ t: 'op', v: 'sub' });
        i += 1;
        continue;
      }

      if (isUnary && (isDigit(next) || next === '.')) {
        // signed number or signed fraction / decimal / mixed
        const sign = ch === '-' ? -1 : 1;
        i += 1; // consume sign

        const start = i;
        while (i < raw.length && isDigit(raw[i])) i += 1;
        const intText = raw.slice(start, i);

        // leading-dot decimal like "-.5"
        if (!intText && raw[i] === '.' && isDigit(raw[i + 1] || '')) {
          i += 1; // consume '.'
          const fracStart = i;
          while (i < raw.length && isDigit(raw[i])) i += 1;
          const fracText = raw.slice(fracStart, i);
          const rat = decimalToRational(sign, `0.${fracText}`);
          if (!rat) return { ok: false, error: '小數格式不正確' };
          pushImplicitMulIfNeeded('num');
          tokens.push({ t: 'num', n: rat.n, d: rat.d, display: { kind: 'dec', raw: formatSignedDecimalRaw(sign, `0.${fracText}`) } });
          continue;
        }

        if (!intText) return { ok: false, error: '數字格式不正確' };
        const baseInt = Number.parseInt(intText, 10);
        if (!Number.isFinite(baseInt)) return { ok: false, error: '數字格式不正確' };

        // mixed fraction: "3^1/2"
        if (raw[i] === '^') {
          i += 1; // consume '^'
          const nStart = i;
          while (i < raw.length && isDigit(raw[i])) i += 1;
          const nText = raw.slice(nStart, i);
          if (!nText) return { ok: false, error: '帶分數格式不正確（缺少分子）' };
          if (raw[i] !== '/' || !isDigit(raw[i + 1] || '')) return { ok: false, error: '帶分數格式不正確（需要 / 分母）' };
          i += 1; // consume '/'
          const dStart = i;
          while (i < raw.length && isDigit(raw[i])) i += 1;
          const dText = raw.slice(dStart, i);
          const nPart = Number.parseInt(nText, 10);
          const dPart = Number.parseInt(dText, 10);
          if (!Number.isFinite(nPart) || !Number.isFinite(dPart) || dPart === 0) return { ok: false, error: '分母不可為 0' };
          const n0 = sign * (baseInt * dPart + nPart);
          pushImplicitMulIfNeeded('num');
          tokens.push({ t: 'num', n: n0, d: dPart, display: { kind: 'mixed', w: sign * baseInt, n: nPart, d: dPart } });
          continue;
        }

        // decimal: "12.34"
        if (raw[i] === '.' && isDigit(raw[i + 1] || '')) {
          i += 1; // consume '.'
          const fracStart = i;
          while (i < raw.length && isDigit(raw[i])) i += 1;
          const fracText = raw.slice(fracStart, i);
          const rat = decimalToRational(sign, `${baseInt}.${fracText}`);
          if (!rat) return { ok: false, error: '小數格式不正確' };
          pushImplicitMulIfNeeded('num');
          tokens.push({ t: 'num', n: rat.n, d: rat.d, display: { kind: 'dec', raw: formatSignedDecimalRaw(sign, `${baseInt}.${fracText}`) } });
          continue;
        }

        const n0 = sign * baseInt;
        // fraction literal only when "/" has NO surrounding whitespace
        if (raw[i] === '/' && isDigit(raw[i + 1] || '') && raw[i - 1] !== ' ') {
          const slashIndex = i;
          const afterSlash = raw[slashIndex + 1];
          if (afterSlash === ' ') {
            tokens.push({ t: 'num', n: n0, d: 1 });
            continue;
          }
          i += 1; // consume /
          const dStart = i;
          while (i < raw.length && isDigit(raw[i])) i += 1;
          const dText = raw.slice(dStart, i);
          const d0 = Number.parseInt(dText, 10);
          if (!Number.isFinite(d0) || d0 === 0) return { ok: false, error: '分母不可為 0' };
          pushImplicitMulIfNeeded('num');
          tokens.push({ t: 'num', n: n0, d: d0, display: { kind: 'frac', n: n0, d: d0 } });
          continue;
        }
        pushImplicitMulIfNeeded('num');
        tokens.push({ t: 'num', n: n0, d: 1 });
        continue;
      }

      // binary op
      const op = opFromChar(ch);
      if (!op) return { ok: false, error: `不支援的符號：${ch}` };
      tokens.push({ t: 'op', v: op });
      i += 1;
      continue;
    }

    if (isDigit(ch)) {
      pushImplicitMulIfNeeded('num');
      const start = i;
      while (i < raw.length && isDigit(raw[i])) i += 1;
      const intText = raw.slice(start, i);
      const n0 = Number.parseInt(intText, 10);

      // mixed fraction: "3^1/2"
      if (raw[i] === '^') {
        i += 1; // consume '^'
        const nStart = i;
        while (i < raw.length && isDigit(raw[i])) i += 1;
        const nText = raw.slice(nStart, i);
        if (!nText) return { ok: false, error: '帶分數格式不正確（缺少分子）' };
        if (raw[i] !== '/' || !isDigit(raw[i + 1] || '')) return { ok: false, error: '帶分數格式不正確（需要 / 分母）' };
        i += 1; // consume '/'
        const dStart = i;
        while (i < raw.length && isDigit(raw[i])) i += 1;
        const dText = raw.slice(dStart, i);
        const nPart = Number.parseInt(nText, 10);
        const dPart = Number.parseInt(dText, 10);
        if (!Number.isFinite(nPart) || !Number.isFinite(dPart) || dPart === 0) return { ok: false, error: '分母不可為 0' };
        tokens.push({ t: 'num', n: n0 * dPart + nPart, d: dPart, display: { kind: 'mixed', w: n0, n: nPart, d: dPart } });
        continue;
      }

      // decimal: "12.34"
      if (raw[i] === '.' && isDigit(raw[i + 1] || '')) {
        i += 1; // consume '.'
        const fracStart = i;
        while (i < raw.length && isDigit(raw[i])) i += 1;
        const fracText = raw.slice(fracStart, i);
        const rat = decimalToRational(1, `${n0}.${fracText}`);
        if (!rat) return { ok: false, error: '小數格式不正確' };
        tokens.push({ t: 'num', n: rat.n, d: rat.d, display: { kind: 'dec', raw: `${n0}.${fracText}` } });
        continue;
      }

      // fraction literal only when "/" has NO surrounding whitespace (e.g. "2/5")
      if (raw[i] === '/' && isDigit(raw[i + 1] || '') && raw[i - 1] !== ' ' && raw[i + 1] !== ' ') {
        i += 1; // consume /
        const dStart = i;
        while (i < raw.length && isDigit(raw[i])) i += 1;
        const dText = raw.slice(dStart, i);
        const d0 = Number.parseInt(dText, 10);
        if (!Number.isFinite(d0) || d0 === 0) return { ok: false, error: '分母不可為 0' };
        tokens.push({ t: 'num', n: n0, d: d0, display: { kind: 'frac', n: n0, d: d0 } });
        continue;
      }

      tokens.push({ t: 'num', n: n0, d: 1 });
      continue;
    }

    if (options.allowVariableX && ch === '□') {
      pushImplicitMulIfNeeded('num');
      tokens.push({ t: 'var', name: 'x' });
      i += 1;
      continue;
    }

    // leading-dot decimal like ".5"
    if (ch === '.' && isDigit(raw[i + 1] || '')) {
      pushImplicitMulIfNeeded('num');
      i += 1; // consume '.'
      const fracStart = i;
      while (i < raw.length && isDigit(raw[i])) i += 1;
      const fracText = raw.slice(fracStart, i);
      const rat = decimalToRational(1, `0.${fracText}`);
      if (!rat) return { ok: false, error: '小數格式不正確' };
      tokens.push({ t: 'num', n: rat.n, d: rat.d, display: { kind: 'dec', raw: `0.${fracText}` } });
      continue;
    }

    const op = opFromChar(ch);
    if (op) {
      // division using "/" is allowed as operator when spaced, otherwise it's parsed as fraction above
      tokens.push({ t: 'op', v: op });
      i += 1;
      continue;
    }

    return { ok: false, error: `不支援的字元：${ch}` };
  }

  const v = validateTokens(tokens, options.allowedOps, options.allowParentheses);
  if (!v.ok) return { ok: false, error: v.error };
  return { ok: true, tokens };
};
