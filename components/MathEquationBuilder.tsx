import React, { useMemo, useRef, useState } from 'react';
import type { MathOp, Rational } from '../services/mathGame';
import { generateMcqChoices, normalizeRational } from '../services/mathGame';
import { parseAndSolveSingleUnknownEquation } from '../services/equationSolver';
import { FractionView, MathExpressionView } from './MathExpressionView';

export type MathEquationDraft = { equation: string };

export const finalizeMathEquationQuestions = (drafts: MathEquationDraft[], config: {
  answerMode: 'mcq' | 'input';
  allowedOps: MathOp[];
  allowParentheses: boolean;
}) => {
  return drafts.map((d, idx) => {
    const parsed = parseAndSolveSingleUnknownEquation(d.equation, {
      allowedOps: config.allowedOps,
      allowParentheses: config.allowParentheses
    });
    if (!parsed.ok) throw new Error(`第 ${idx + 1} 題：${parsed.error}`);
    const { leftTokens, rightTokens, answer } = parsed.value;
    if (config.answerMode === 'mcq') {
      const { choices, correctIndex } = generateMcqChoices(answer);
      return { equation: { leftTokens, rightTokens }, answer, choices, correctIndex };
    }
    return { equation: { leftTokens, rightTokens }, answer };
  });
};

export const MathEquationBuilder: React.FC<{
  equation: string;
  onChange: (next: string) => void;
  allowedOps: MathOp[];
  allowParentheses: boolean;
  showAnswerPreview?: boolean;
  className?: string;
}> = ({ equation, onChange, allowedOps, allowParentheses, showAnswerPreview = true, className }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rawText, setRawText] = useState('');
  const [dialogError, setDialogError] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const parsed = useMemo(() => {
    if (!equation) return null;
    return parseAndSolveSingleUnknownEquation(equation, { allowedOps, allowParentheses });
  }, [equation, allowedOps, allowParentheses]);

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

  const openDialog = () => {
    setDialogError('');
    setRawText(equation || '');
    setDialogOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const confirmDialog = () => {
    const result = parseAndSolveSingleUnknownEquation(rawText, { allowedOps, allowParentheses });
    if (!result.ok) {
      setDialogError(result.error);
      return;
    }
    onChange(rawText);
    setDialogOpen(false);
  };

  const answerPreview: Rational | null = (() => {
    if (!showAnswerPreview) return null;
    if (!parsed?.ok) return null;
    return normalizeRational(parsed.value.answer);
  })();

  return (
    <div className={className}>
      <div className="bg-white border-2 border-gray-300 rounded-2xl p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold text-gray-500 mb-2">方程式預覽</div>
            {parsed?.ok ? (
              <div className="text-xl font-black text-gray-900 break-words flex flex-wrap items-center gap-x-2 gap-y-1">
                <MathExpressionView tokens={parsed.value.leftTokens} />
                <span className="px-0.5 font-black">=</span>
                <MathExpressionView tokens={parsed.value.rightTokens} />
              </div>
            ) : (
              <div className="text-xl font-black text-gray-400 break-words">（未設定）</div>
            )}
            {equation && parsed && !parsed.ok && (
              <div className="mt-2 text-xs font-bold text-red-600">{parsed.error}</div>
            )}
            {answerPreview && (
              <div className="mt-2 text-sm text-gray-700">
                <span className="font-bold">答案：</span>
                <FractionView value={answerPreview} className="font-black" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <button
              type="button"
              onClick={openDialog}
              className="px-3 py-2 rounded-xl bg-[#E8F5E9] border-2 border-[#5E8B66] text-[#2F5E3A] font-black hover:bg-[#D7F0DD]"
            >
              輸入方程式
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="px-3 py-2 rounded-xl bg-white border-2 border-gray-300 font-bold hover:bg-gray-50"
              disabled={!equation}
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
              <div className="text-xl font-black text-brand-brown">輸入方程式（只有一個未知數）</div>
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
                <label className="block text-sm font-bold text-gray-700 mb-1">方程式</label>
                <input
                  ref={inputRef}
                  value={rawText}
                  onChange={(e) => { setRawText(e.target.value); setDialogError(''); }}
                  placeholder="例如：□+3=5 或 (□−1)×2=10"
                  className="w-full px-4 py-2 rounded-2xl border-2 border-gray-300 focus:outline-none focus:border-[#A1D9AE] font-bold"
                />

                <div className="mt-2 grid grid-cols-6 gap-2">
                  {[
                    { label: '+', v: '+' },
                    { label: '−', v: '-' },
                    { label: '×', v: '×' },
                    { label: '÷', v: '÷' },
                    { label: '(', v: '(' },
                    { label: ')', v: ')' },
                    { label: '□', v: '□' },
                    { label: '=', v: '=' }
                  ].map((b) => (
                    <button
                      key={`${b.label}-${b.v}`}
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
                  <div>未知數請用 `□`（只可出現一次）</div>
                  <div>可用：`+ - × ÷ ( ) =`</div>
                  <div>分數：`2/5`（不要空格）</div>
                  <div>帶分數：`3^1/2`</div>
                  <div>小數：`1.25`</div>
                </div>
              </div>

              {dialogError && (
                <div className="text-sm font-bold text-red-600">{dialogError}</div>
              )}

              <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-3">
                <div className="text-xs font-bold text-gray-500 mb-1">預覽</div>
                {(() => {
                  const result = parseAndSolveSingleUnknownEquation(rawText, { allowedOps, allowParentheses });
                  if (!result.ok) return <div className="text-gray-500 text-sm">（輸入後會顯示）</div>;
                  return (
                    <div className="text-lg font-black text-gray-900 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <MathExpressionView tokens={result.value.leftTokens} />
                      <span className="px-0.5 font-black">=</span>
                      <MathExpressionView tokens={result.value.rightTokens} />
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

