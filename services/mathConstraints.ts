import type { MathToken, Rational } from './mathGame';
import { isPowerOfTen, normalizeRational } from './mathGame';

export type NumberMode = 'fraction' | 'decimal';
export type EquationAnswerType = 'any' | 'int' | 'properFraction' | 'decimal';

export type MathConstraints = {
  numberMode: NumberMode;
  allowNegative: boolean;
  minValue: number;
  maxValue: number;
  maxDen: number;
  maxDecimalPlaces: number;
  equationSteps: 1 | 2;
  equationAnswerType: EquationAnswerType;
};

export const compareRational = (a: Rational, b: Rational) => {
  const x = normalizeRational(a);
  const y = normalizeRational(b);
  const left = x.n * y.d;
  const right = y.n * x.d;
  if (left === right) return 0;
  return left < right ? -1 : 1;
};

export const rationalAbs = (r: Rational): Rational => {
  const x = normalizeRational(r);
  return { n: Math.abs(x.n), d: x.d };
};

export const isDecimalRational = (r: Rational, maxPlaces: number) => {
  const x = normalizeRational(r);
  if (x.d === 1) return true;
  if (!isPowerOfTen(x.d)) return false;
  const places = String(x.d).length - 1;
  return places <= Math.max(0, Math.min(6, maxPlaces));
};

export const validateRationalAgainstConstraints = (value: Rational, constraints: MathConstraints, label: string) => {
  const errors: string[] = [];
  const v = normalizeRational(value);

  if (!constraints.allowNegative && v.n < 0) errors.push(`${label} 不可為負數`);

  const min = { n: constraints.minValue, d: 1 };
  const max = { n: constraints.maxValue, d: 1 };
  if (compareRational(v, min) < 0 || compareRational(v, max) > 0) {
    errors.push(`${label} 超出範圍（${constraints.minValue}～${constraints.maxValue}）`);
  }

  if (constraints.numberMode === 'decimal') {
    if (!isDecimalRational(v, constraints.maxDecimalPlaces)) {
      errors.push(`${label} 必須是小數（最多 ${constraints.maxDecimalPlaces} 位）`);
    }
  } else {
    if (v.d !== 1 && v.d > constraints.maxDen) {
      errors.push(`${label} 分母不可大於 ${constraints.maxDen}`);
    }
  }

  return errors;
};

export const validateTokensNumberModeOnly = (tokens: MathToken[], numberMode: NumberMode) => {
  for (const t of tokens) {
    if (t.t !== 'num') continue;
    if (numberMode === 'decimal') {
      if (t.display?.kind === 'frac' || t.display?.kind === 'mixed') {
        return '小數模式不接受分數（請用小數，例如 1.25）';
      }
      if (t.d !== 1 && !isPowerOfTen(Number(t.d))) return '小數模式只接受小數（分母需為 10/100/1000...）';
    } else {
      if (t.display?.kind === 'dec') return '分數模式不接受小數（請用分數，例如 2/5 或 3^1/2）';
    }
  }
  return null;
};

export const validateTokensAgainstConstraints = (tokens: MathToken[], constraints: MathConstraints, labelPrefix = '數字') => {
  const errors: string[] = [];
  const modeErr = validateTokensNumberModeOnly(tokens, constraints.numberMode);
  if (modeErr) errors.push(modeErr);

  for (const t of tokens) {
    if (t.t !== 'num') continue;
    const errs = validateRationalAgainstConstraints({ n: t.n, d: t.d }, constraints, labelPrefix);
    errors.push(...errs);
  }
  return errors;
};

export const validateEquationSteps = (varSideTokens: MathToken[], constraints: MathConstraints) => {
  const ops = varSideTokens.filter((t) => t.t === 'op').length;
  const parens = varSideTokens.filter((t) => t.t === 'paren').length;
  if (constraints.equationSteps === 1) {
    if (parens > 0) return '一步方程式不建議使用括號（請改為兩步）';
    if (ops !== 1) return '一步方程式應該只包含 1 個運算';
  } else {
    if (ops < 2) return '兩步方程式應該至少包含 2 個運算';
  }
  return null;
};

export const validateEquationAnswerType = (answer: Rational, constraints: MathConstraints) => {
  const x = normalizeRational(answer);
  const t = constraints.equationAnswerType;
  if (t === 'any') return null;
  if (t === 'int') return x.d === 1 ? null : '答案必須是整數';
  if (t === 'properFraction') {
    return x.d > 1 && Math.abs(x.n) < x.d ? null : '答案必須是真分數';
  }
  if (t === 'decimal') {
    return isDecimalRational(x, constraints.maxDecimalPlaces) ? null : `答案必須是小數（最多 ${constraints.maxDecimalPlaces} 位）`;
  }
  return null;
};

