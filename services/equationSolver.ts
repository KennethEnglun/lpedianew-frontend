import type { MathOp, MathToken, Rational } from './mathGame';
import { add, div, mul, normalizeRational, sub } from './mathGame';
import { parseMathExpressionToTokens } from './mathExpressionParser';

type ExprNode =
  | { k: 'num'; r: Rational }
  | { k: 'var' }
  | { k: 'op'; op: MathOp; a: ExprNode; b: ExprNode };

const OP_PRECEDENCE: Record<MathOp, number> = { add: 1, sub: 1, mul: 2, div: 2 };

const hasVar = (node: ExprNode): boolean => {
  if (node.k === 'var') return true;
  if (node.k === 'num') return false;
  return hasVar(node.a) || hasVar(node.b);
};

const countVar = (node: ExprNode): number => {
  if (node.k === 'var') return 1;
  if (node.k === 'num') return 0;
  return countVar(node.a) + countVar(node.b);
};

const evalConst = (node: ExprNode): Rational | null => {
  if (node.k === 'var') return null;
  if (node.k === 'num') return normalizeRational(node.r);
  const a = evalConst(node.a);
  const b = evalConst(node.b);
  if (!a || !b) return null;
  switch (node.op) {
    case 'add': return add(a, b);
    case 'sub': return sub(a, b);
    case 'mul': return mul(a, b);
    case 'div': return div(a, b);
  }
};

const toAst = (tokens: MathToken[]): ExprNode => {
  const output: Array<MathToken> = [];
  const ops: Array<MathToken> = [];

  for (const t of tokens) {
    if (t.t === 'num' || t.t === 'var') {
      output.push(t);
      continue;
    }
    if (t.t === 'op') {
      const p = OP_PRECEDENCE[t.v];
      while (ops.length > 0) {
        const top = ops[ops.length - 1];
        if (top.t !== 'op') break;
        const tp = OP_PRECEDENCE[top.v];
        if (tp >= p) output.push(ops.pop()!);
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
        output.push(top);
      }
      continue;
    }
    throw new Error('Unsupported token');
  }

  while (ops.length > 0) {
    const top = ops.pop()!;
    if (top.t === 'paren') throw new Error('Unbalanced parentheses');
    output.push(top);
  }

  const stack: ExprNode[] = [];
  for (const t of output) {
    if (t.t === 'num') {
      stack.push({ k: 'num', r: normalizeRational({ n: t.n, d: t.d }) });
      continue;
    }
    if (t.t === 'var') {
      stack.push({ k: 'var' });
      continue;
    }
    if (t.t === 'op') {
      const b = stack.pop();
      const a = stack.pop();
      if (!a || !b) throw new Error('Malformed expression');
      stack.push({ k: 'op', op: t.v, a, b });
      continue;
    }
    throw new Error('Unsupported token');
  }
  if (stack.length !== 1) throw new Error('Malformed expression');
  return stack[0];
};

const isolateVar = (node: ExprNode, target: Rational): Rational => {
  if (node.k === 'var') return normalizeRational(target);
  if (node.k === 'num') throw new Error('No variable to isolate');

  const leftHas = hasVar(node.a);
  const rightHas = hasVar(node.b);
  if (leftHas && rightHas) throw new Error('Variable appears on both sides of an operator');

  const knownNode = leftHas ? node.b : node.a;
  const varNode = leftHas ? node.a : node.b;
  const known = evalConst(knownNode);
  if (!known) throw new Error('Non-constant term found');

  const nextTarget = (() => {
    switch (node.op) {
      case 'add':
        return sub(target, known);
      case 'sub':
        return leftHas ? add(target, known) : sub(known, target);
      case 'mul':
        return div(target, known);
      case 'div':
        return leftHas ? mul(target, known) : div(known, target);
    }
  })();

  return isolateVar(varNode, nextTarget);
};

export type ParsedEquation = {
  leftTokens: MathToken[];
  rightTokens: MathToken[];
  answer: Rational;
};

export const parseAndSolveSingleUnknownEquation = (rawEquation: string, options: {
  allowedOps: MathOp[];
  allowParentheses: boolean;
}): { ok: true; value: ParsedEquation } | { ok: false; error: string } => {
  const raw = String(rawEquation || '').trim();
  if (!raw) return { ok: false, error: '請輸入方程式' };

  const parts = raw.split(/[=＝]/);
  if (parts.length !== 2) return { ok: false, error: '方程式需要且只能有一個等號（=）' };

  const leftRaw = parts[0].trim();
  const rightRaw = parts[1].trim();
  if (!leftRaw || !rightRaw) return { ok: false, error: '等號左右兩邊都需要有算式' };

  const leftParsed = parseMathExpressionToTokens(leftRaw, { ...options, allowVariableX: true });
  if ('error' in leftParsed) return { ok: false, error: `等號左邊：${leftParsed.error}` };
  const rightParsed = parseMathExpressionToTokens(rightRaw, { ...options, allowVariableX: true });
  if ('error' in rightParsed) return { ok: false, error: `等號右邊：${rightParsed.error}` };

  let leftAst: ExprNode;
  let rightAst: ExprNode;
  try {
    leftAst = toAst(leftParsed.tokens);
    rightAst = toAst(rightParsed.tokens);
  } catch {
    return { ok: false, error: '方程式格式不正確' };
  }

  const leftCount = countVar(leftAst);
  const rightCount = countVar(rightAst);
  if (leftCount + rightCount !== 1) return { ok: false, error: '只支援只有一個未知數（□）的方程式' };

  const varSide = leftCount === 1 ? leftAst : rightAst;
  const constSide = leftCount === 1 ? rightAst : leftAst;
  const target = evalConst(constSide);
  if (!target) return { ok: false, error: '等號其中一邊必須是純數字算式' };

  try {
    const answer = isolateVar(varSide, target);
    return { ok: true, value: { leftTokens: leftParsed.tokens, rightTokens: rightParsed.tokens, answer } };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || '無法解此方程式') };
  }
};
