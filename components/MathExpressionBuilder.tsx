import React, { useMemo, useRef, useState } from 'react';
import type { MathOp, MathToken, Rational } from '../services/mathGame';
import { evaluateTokens, generateMcqChoices, isPowerOfTen, normalizeRational, validateTokens } from '../services/mathGame';
import { parseMathExpressionToTokens } from '../services/mathExpressionParser';
import { FractionView, MathExpressionView } from './MathExpressionView';

const validateTokensNumberMode = (tokens: MathToken[], numberMode?: 'fraction' | 'decimal') => {
  if (!numberMode) return null;
  if (numberMode === 'decimal') {
    for (const t of tokens) {
      if (t.t !== 'num') continue;
      if (t.display?.kind === 'frac' || t.display?.kind === 'mixed') return '小數模式不接受分數（請用小數，例如 1.25）';
      if (t.d !== 1 && !isPowerOfTen(Number(t.d))) return '小數模式只接受小數（分母需為 10/100/1000...）';
    }
  } else {
    for (const t of tokens) {
      if (t.t !== 'num') continue;
      if (t.display?.kind === 'dec') return '分數模式不接受小數（請用分數，例如 2/5 或 3^1/2）';
    }
  }
  return null;
};

export const MathExpressionBuilder: React.FC<{
  tokens: MathToken[];
  onChange: (next: MathToken[]) => void;
  allowedOps: MathOp[];
  allowParentheses: boolean;
  numberMode?: 'fraction' | 'decimal';
  showAnswerPreview?: boolean;
  className?: string;
}> = ({ tokens, onChange, allowedOps, allowParentheses, numberMode, showAnswerPreview = true, className }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rawText, setRawText] = useState('');
  const [dialogError, setDialogError] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const validation = useMemo(() => validateTokens(tokens, allowedOps, allowParentheses), [tokens, allowedOps, allowParentheses]);
  const answerPreview = useMemo(() => {
    if (!showAnswerPreview) return null;
    if (!validation.ok) return null;
    try {
      return normalizeRational(evaluateTokens(tokens));
    } catch {
      return null;
    }
  }, [tokens, validation.ok, showAnswerPreview]);

  const clearTokens = () => onChange([]);

  const openDialog = () => {
    setDialogError('');
    setRawText('');
    setDialogOpen(true);
  };

  const insertIntoInput = (text: string) => {
    const el = inputRef.current;
    if (!el) {
      setRawText((s) => s + text);
      return;
    }
    const start = el.selectionStart ?? rawText.length;
    const end = el.selectionEnd ?? rawText.length;
    const next = rawText.slice(0, start) + text + rawText.slice(end);
    const nextPos = start + text.length;
    setRawText(next);
    window.setTimeout(() => {
      el.focus();
      try {
        el.setSelectionRange(nextPos, nextPos);
      } catch {
        // ignore
      }
    }, 0);
  };

  const backspaceInInput = () => {
    const el = inputRef.current;
    if (!el) {
      setRawText((s) => s.slice(0, -1));
      return;
    }
    const start = el.selectionStart ?? rawText.length;
    const end = el.selectionEnd ?? rawText.length;
    if (start !== end) {
      const next = rawText.slice(0, start) + rawText.slice(end);
      setRawText(next);
      window.setTimeout(() => {
        el.focus();
        try {
          el.setSelectionRange(start, start);
        } catch {
          // ignore
        }
      }, 0);
      return;
    }
    if (start <= 0) return;
    const next = rawText.slice(0, start - 1) + rawText.slice(end);
    const nextPos = start - 1;
    setRawText(next);
    window.setTimeout(() => {
      el.focus();
      try {
        el.setSelectionRange(nextPos, nextPos);
      } catch {
        // ignore
      }
    }, 0);
  };

  const confirmDialog = () => {
    const result = parseMathExpressionToTokens(rawText, { allowedOps, allowParentheses });
    if (!result.ok) {
      setDialogError(result.error);
      return;
    }
    const modeErr = validateTokensNumberMode(result.tokens, numberMode);
    if (modeErr) {
      setDialogError(modeErr);
      return;
    }
    onChange(result.tokens);
    setDialogOpen(false);
  };

  return (
    <div className={className}>
      <div className="bg-white border-2 border-gray-300 rounded-2xl p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold text-gray-500 mb-2">算式預覽</div>
            <div className="text-xl font-black text-gray-900 break-words">
              <MathExpressionView tokens={tokens} />
            </div>
            {!validation.ok && (
              <div className="mt-2 text-xs font-bold text-red-600">{validation.error}</div>
            )}
            {validation.ok && answerPreview && (
              <div className="mt-2 text-sm text-gray-700">
                <span className="font-bold">答案：</span>
                <FractionView value={answerPreview as Rational} className="font-black" format={numberMode === 'decimal' ? 'decimal' : numberMode === 'fraction' ? 'fraction' : 'auto'} />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <button
              type="button"
              onClick={openDialog}
              className="px-3 py-2 rounded-xl bg-[#E8F5E9] border-2 border-[#5E8B66] text-[#2F5E3A] font-black hover:bg-[#D7F0DD]"
            >
              輸入算式
            </button>
            <button
              type="button"
              onClick={clearTokens}
              className="px-3 py-2 rounded-xl bg-white border-2 border-gray-300 font-bold hover:bg-gray-50"
              disabled={!tokens || tokens.length === 0}
            >
              清空
            </button>
          </div>
        </div>
      </div>

      {dialogOpen && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl border-4 border-brand-brown shadow-comic p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xl font-black text-brand-brown">輸入整條算式</div>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">算式</label>
                <input
                  ref={inputRef}
                  value={rawText}
                  onChange={(e) => { setRawText(e.target.value); setDialogError(''); }}
                  placeholder="例如：(1+3)x3^1/2 或 1.25+2"
                  className="w-full px-4 py-2 rounded-2xl border-2 border-gray-300 focus:outline-none focus:border-[#A1D9AE] font-bold"
                />

                <div className="mt-2 grid grid-cols-6 gap-2">
                  {[
                    { label: '+', v: '+' },
                    { label: '−', v: '-' },
                    { label: '×', v: '×' },
                    { label: '÷', v: '÷' },
                    { label: '(', v: '(' },
                    { label: ')', v: ')' }
                  ].map((b) => (
                    <button
                      key={b.label}
                      type="button"
                      onClick={() => insertIntoInput(b.v)}
                      className="h-10 rounded-2xl bg-white border-2 border-gray-300 font-black text-[#2F2A4A] hover:bg-gray-50"
                    >
                      {b.label}
                    </button>
                  ))}
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => { setRawText(''); setDialogError(''); window.setTimeout(() => inputRef.current?.focus(), 0); }}
                    className="px-3 py-2 rounded-2xl bg-white border-2 border-gray-300 font-bold hover:bg-gray-50"
                  >
                    清空
                  </button>
                  <button
                    type="button"
                    onClick={backspaceInInput}
                    className="px-3 py-2 rounded-2xl bg-white border-2 border-gray-300 font-bold hover:bg-gray-50"
                  >
                    ⌫
                  </button>
                </div>

                <div className="text-xs text-gray-600 mt-2 space-y-1">
                  <div>支援：`+ - x * × ÷ / ( )`</div>
                  <div>分數：`2/5`（不要空格，會顯示上下分數）</div>
                  <div>帶分數：`3^1/2`（整數 ^ 分子/分母）</div>
                  <div>小數：`1.25`</div>
                  <div>除法：`2 / 5`（有空格）或用 `÷`</div>
                </div>
              </div>

              {dialogError && (
                <div className="text-sm font-bold text-red-600">{dialogError}</div>
              )}

              <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-3">
                <div className="text-xs font-bold text-gray-500 mb-1">預覽</div>
                {(() => {
                  const parsed = parseMathExpressionToTokens(rawText, { allowedOps, allowParentheses });
                  if (!parsed.ok) {
                    return <div className="text-gray-500 text-sm">（輸入後會顯示）</div>;
                  }
                  const modeErr = validateTokensNumberMode(parsed.tokens, numberMode);
                  if (modeErr) {
                    return <div className="text-red-600 text-sm font-bold">{modeErr}</div>;
                  }
                  return (
                    <div className="text-lg font-black text-gray-900">
                      <MathExpressionView tokens={parsed.tokens} />
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="px-4 py-2 rounded-2xl bg-white border-2 border-gray-300 text-gray-700 font-bold hover:bg-gray-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmDialog}
                className="px-5 py-2 rounded-2xl bg-[#FDEEAD] border-2 border-brand-brown text-brand-brown font-black hover:bg-[#F9E08F]"
              >
                套用
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const finalizeMathQuestions = (drafts: Array<{ tokens: MathToken[] }>, config: {
  answerMode: 'mcq' | 'input';
  allowedOps: MathOp[];
  allowParentheses: boolean;
  numberMode?: 'decimal' | 'fraction';
}) => {
  return drafts.map((d, idx) => {
    const tokens = Array.isArray(d.tokens) ? d.tokens : [];
    const v = validateTokens(tokens, config.allowedOps, config.allowParentheses);
    if (!v.ok) throw new Error(`第 ${idx + 1} 題：${v.error}`);
    const modeErr = validateTokensNumberMode(tokens, config.numberMode);
    if (modeErr) throw new Error(`第 ${idx + 1} 題：${modeErr}`);
    const answer = evaluateTokens(tokens);
    if (config.numberMode === 'decimal' && answer.d !== 1 && !isPowerOfTen(Number(answer.d))) {
      throw new Error(`第 ${idx + 1} 題：小數模式的答案必須是小數（分母需為 10/100/1000...）`);
    }
    if (config.answerMode === 'mcq') {
      const { choices, correctIndex } = generateMcqChoices(answer, { numberMode: config.numberMode || 'any' });
      return { tokens, answer, choices, correctIndex };
    }
    return { tokens, answer };
  });
};
