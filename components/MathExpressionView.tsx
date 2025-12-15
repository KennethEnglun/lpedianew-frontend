import React from 'react';
import type { MathToken, Rational } from '../services/mathGame';

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

export const FractionView: React.FC<{ value: Rational; className?: string }> = ({ value, className }) => {
  const isInt = value.d === 1;
  if (isInt) {
    return <span className={className}>{formatInt(value.n)}</span>;
  }
  const numerator = formatInt(value.n);
  const denominator = String(value.d);
  return (
    <span className={`inline-flex flex-col items-center leading-none align-middle ${className || ''}`}>
      <span className="px-0.5">{numerator}</span>
      <span className="w-full border-t border-current my-0.5" />
      <span className="px-0.5">{denominator}</span>
    </span>
  );
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
          const inner = <FractionView value={val} />;
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

