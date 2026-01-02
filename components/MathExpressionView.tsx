import React from 'react';
import type { MathNumDisplay, MathToken, Rational } from '../services/mathGame';

const opLabel = (op: string) => {
  switch (op) {
    case 'add': return '+';
    case 'sub': return '−';
    case 'mul': return '×';
    case 'div': return '÷';
    default: return op;
  }
};

const formatInt = (n: number) => String(n).replace(/^-/, '−');

const isPowerOfTen = (n: number) => {
  if (!Number.isInteger(n) || n <= 0) return false;
  let x = n;
  while (x % 10 === 0) x = Math.trunc(x / 10);
  return x === 1;
};

const formatDecimalFromRational = (value: Rational) => {
  const d = Number(value.d);
  const n = Number(value.n);
  if (!Number.isInteger(d) || d <= 0) return null;
  if (!Number.isInteger(n)) return null;
  if (!isPowerOfTen(d)) return null;
  const sign = n < 0 ? '−' : '';
  const absN = Math.abs(n);
  const k = String(d).length - 1;
  const intPart = Math.trunc(absN / d);
  const fracPart = absN % d;
  const fracTextRaw = String(fracPart).padStart(k, '0');
  const fracText = fracTextRaw.replace(/0+$/, '');
  if (!fracText) return `${sign}${intPart}`;
  return `${sign}${intPart}.${fracText}`;
};

const FractionLayout: React.FC<{ n: number; d: number; className?: string }> = ({ n, d, className }) => {
  const numerator = formatInt(n);
  const denominator = String(d);
  return (
    <span className={`inline-flex flex-col items-center leading-none align-middle ${className || ''}`}>
      <span className="px-0.5">{numerator}</span>
      <span className="w-full border-t border-current my-0.5" />
      <span className="px-0.5">{denominator}</span>
    </span>
  );
};

const MixedFractionView: React.FC<{ w: number; n: number; d: number; className?: string }> = ({ w, n, d, className }) => {
  const wholeText = formatInt(w);
  return (
    <span className={`inline-flex items-center gap-1 ${className || ''}`}>
      <span>{wholeText}</span>
      <FractionLayout n={n} d={d} />
    </span>
  );
};

const formatDisplay = (display: MathNumDisplay | undefined, fallback: Rational) => {
  if (!display) return null;
  if (display.kind === 'dec') return display.raw.replace(/^-/, '−');
  if (display.kind === 'frac') return <FractionLayout n={display.n} d={display.d} />;
  if (display.kind === 'mixed') return <MixedFractionView w={display.w} n={display.n} d={display.d} />;
  return null;
};

export const FractionView: React.FC<{ value: Rational; className?: string; display?: MathNumDisplay; format?: 'auto' | 'fraction' | 'decimal' }> = ({ value, className, display, format = 'auto' }) => {
  const custom = formatDisplay(display, value);
  if (typeof custom === 'string') return <span className={className}>{custom}</span>;
  if (custom) return <span className={className}>{custom}</span>;

  const isInt = value.d === 1;
  if (isInt) return <span className={className}>{formatInt(value.n)}</span>;
  if (format === 'decimal' || format === 'auto') {
    const dec = formatDecimalFromRational(value);
    if (dec) return <span className={className}>{dec}</span>;
  }
  return <FractionLayout n={value.n} d={value.d} className={className} />;
};

export const MathExpressionView: React.FC<{
  tokens: MathToken[];
  className?: string;
  onNumberClick?: (index: number) => void;
}> = ({ tokens, className, onNumberClick }) => {
  if (!tokens || tokens.length === 0) {
    return <span className={`text-gray-400 ${className || ''}`}>（未設定算式）</span>;
  }

  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 ${className || ''}`}>
      {tokens.map((t, idx) => {
        if (t.t === 'num') {
          const val: Rational = { n: t.n, d: t.d };
          const clickable = typeof onNumberClick === 'function';
          const inner = <FractionView value={val} display={t.display} />;
          return (
            <span key={`t-${idx}`} className="inline-flex items-center">
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onNumberClick(idx)}
                  className="px-1 py-0.5 rounded hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-[#A1D9AE]"
                >
                  {inner}
                </button>
              ) : (
                <span className="px-0.5">{inner}</span>
              )}
            </span>
          );
        }
        if (t.t === 'var') {
          const clickable = typeof onNumberClick === 'function';
          const inner = (
            <span className="px-0.5 font-black text-[#2F2A4A]">
              □
            </span>
          );
          return (
            <span key={`t-${idx}`} className="inline-flex items-center">
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onNumberClick(idx)}
                  className="px-1 py-0.5 rounded hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-[#A1D9AE]"
                >
                  {inner}
                </button>
              ) : (
                inner
              )}
            </span>
          );
        }
        if (t.t === 'op') {
          return (
            <span key={`t-${idx}`} className="px-0.5 font-black">
              {opLabel(t.v)}
            </span>
          );
        }
        if (t.t === 'paren') {
          return (
            <span key={`t-${idx}`} className="px-0.5 font-black">
              {t.v}
            </span>
          );
        }
        return null;
      })}
    </span>
  );
};
