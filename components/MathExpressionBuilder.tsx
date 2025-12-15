import React, { useMemo, useState } from 'react';
import type { MathOp, MathToken, Rational } from '../services/mathGame';
import { evaluateTokens, generateMcqChoices, normalizeRational, validateTokens } from '../services/mathGame';
import { FractionView, MathExpressionView } from './MathExpressionView';

type NumberDraft = { mode: 'int' | 'frac'; n: string; d: string };

const parseIntStrict = (raw: string) => {
  const n = Number.parseInt(String(raw || '').trim(), 10);
  if (!Number.isFinite(n)) return null;
  if (!Number.isInteger(n)) return null;
  return n;
};

const clampPositiveInt = (raw: string) => {
  const n = parseIntStrict(raw);
  if (n === null || n <= 0) return null;
  return n;
};

export const MathExpressionBuilder: React.FC<{
  tokens: MathToken[];
  onChange: (next: MathToken[]) => void;
  allowedOps: MathOp[];
  allowParentheses: boolean;
  showAnswerPreview?: boolean;
  className?: string;
}> = ({ tokens, onChange, allowedOps, allowParentheses, showAnswerPreview = true, className }) => {
  const [numberModalOpen, setNumberModalOpen] = useState(false);
  const [numberEditIndex, setNumberEditIndex] = useState<number | null>(null);
  const [numberDraft, setNumberDraft] = useState<NumberDraft>({ mode: 'int', n: '', d: '' });

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

  const pushToken = (t: MathToken) => onChange([...(tokens || []), t]);
  const popToken = () => onChange((tokens || []).slice(0, -1));
  const clearTokens = () => onChange([]);

  const openNewNumber = () => {
    setNumberEditIndex(null);
    setNumberDraft({ mode: 'int', n: '', d: '' });
    setNumberModalOpen(true);
  };

  const openEditNumber = (idx: number) => {
    const t = tokens[idx];
    if (!t || t.t !== 'num') return;
    setNumberEditIndex(idx);
    setNumberDraft({
      mode: t.d === 1 ? 'int' : 'frac',
      n: String(t.n),
      d: t.d === 1 ? '' : String(t.d)
    });
    setNumberModalOpen(true);
  };

  const confirmNumber = () => {
    const n = parseIntStrict(numberDraft.n);
    if (n === null) return alert('請輸入有效的分子/整數（可為負數）');
    const token: MathToken = (() => {
      if (numberDraft.mode === 'int') return { t: 'num', n, d: 1 };
      const d = clampPositiveInt(numberDraft.d);
      if (d === null) {
        alert('請輸入有效的分母（正整數，且不可為 0）');
        return null as any;
      }
      return { t: 'num', n, d };
    })();
    if (!token) return;

    if (numberEditIndex === null) {
      pushToken(token);
    } else {
      const next = [...tokens];
      next[numberEditIndex] = token;
      onChange(next);
    }
    setNumberModalOpen(false);
  };

  const opButtons: Array<{ op: MathOp; label: string }> = [
    { op: 'add', label: '+' },
    { op: 'sub', label: '−' },
    { op: 'mul', label: '×' },
    { op: 'div', label: '÷' }
  ];

  const disabledOp = (op: MathOp) => !allowedOps.includes(op);

  return (
    <div className={className}>
      <div className="bg-white border-2 border-gray-300 rounded-2xl p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold text-gray-500 mb-2">算式預覽（點擊數字可編輯）</div>
            <div className="text-xl font-black text-gray-900 break-words">
              <MathExpressionView tokens={tokens} onNumberClick={openEditNumber} />
            </div>
            {!validation.ok && (
              <div className="mt-2 text-xs font-bold text-red-600">{validation.error}</div>
            )}
            {validation.ok && answerPreview && (
              <div className="mt-2 text-sm text-gray-700">
                <span className="font-bold">答案：</span>
                <FractionView value={answerPreview as Rational} className="font-black" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <button
              type="button"
              onClick={openNewNumber}
              className="px-3 py-2 rounded-xl bg-[#E8F5E9] border-2 border-[#5E8B66] text-[#2F5E3A] font-black hover:bg-[#D7F0DD]"
            >
              ＋數字/分數
            </button>
            <button
              type="button"
              onClick={popToken}
              className="px-3 py-2 rounded-xl bg-white border-2 border-gray-300 font-bold hover:bg-gray-50"
              disabled={!tokens || tokens.length === 0}
            >
              退格
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

        <div className="mt-3 flex flex-wrap gap-2">
          {opButtons.map(({ op, label }) => (
            <button
              key={op}
              type="button"
              onClick={() => pushToken({ t: 'op', v: op })}
              disabled={disabledOp(op)}
              className={`px-3 py-2 rounded-xl border-2 font-black ${disabledOp(op)
                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-[#FDEEAD] border-[#7A5B3A] text-brand-brown hover:bg-[#F9E08F]'
                }`}
            >
              {label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => pushToken({ t: 'paren', v: '(' })}
            disabled={!allowParentheses}
            className={`px-3 py-2 rounded-xl border-2 font-black ${allowParentheses
              ? 'bg-white border-gray-300 hover:bg-gray-50'
              : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
              }`}
          >
            (
          </button>
          <button
            type="button"
            onClick={() => pushToken({ t: 'paren', v: ')' })}
            disabled={!allowParentheses}
            className={`px-3 py-2 rounded-xl border-2 font-black ${allowParentheses
              ? 'bg-white border-gray-300 hover:bg-gray-50'
              : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
              }`}
          >
            )
          </button>
        </div>
      </div>

      {numberModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl border-4 border-brand-brown shadow-comic p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xl font-black text-brand-brown">{numberEditIndex === null ? '新增數字/分數' : '編輯數字/分數'}</div>
              <button
                type="button"
                onClick={() => setNumberModalOpen(false)}
                className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setNumberDraft((p) => ({ ...p, mode: 'int', d: '' }))}
                className={`flex-1 px-3 py-2 rounded-2xl border-2 font-black ${numberDraft.mode === 'int'
                  ? 'bg-[#A1D9AE] border-[#5E8B66] text-white'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
              >
                整數
              </button>
              <button
                type="button"
                onClick={() => setNumberDraft((p) => ({ ...p, mode: 'frac' }))}
                className={`flex-1 px-3 py-2 rounded-2xl border-2 font-black ${numberDraft.mode === 'frac'
                  ? 'bg-[#A1D9AE] border-[#5E8B66] text-white'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
              >
                分數
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">{numberDraft.mode === 'int' ? '整數' : '分子'}</label>
                <input
                  value={numberDraft.n}
                  onChange={(e) => setNumberDraft((p) => ({ ...p, n: e.target.value }))}
                  placeholder="例如：3 或 -2"
                  className="w-full px-4 py-2 rounded-2xl border-2 border-gray-300 focus:outline-none focus:border-[#A1D9AE]"
                  inputMode="numeric"
                />
              </div>

              {numberDraft.mode === 'frac' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">分母</label>
                  <input
                    value={numberDraft.d}
                    onChange={(e) => setNumberDraft((p) => ({ ...p, d: e.target.value }))}
                    placeholder="例如：4（不可為 0）"
                    className="w-full px-4 py-2 rounded-2xl border-2 border-gray-300 focus:outline-none focus:border-[#A1D9AE]"
                    inputMode="numeric"
                  />
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-sm text-gray-600">
                {numberDraft.mode === 'frac' ? (
                  <span className="inline-flex items-center gap-2">
                    預覽：
                    <span className="text-lg font-black">
                      <FractionView value={{ n: parseIntStrict(numberDraft.n) ?? 0, d: clampPositiveInt(numberDraft.d) ?? 1 }} />
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    預覽：
                    <span className="text-lg font-black">{String(parseIntStrict(numberDraft.n) ?? 0).replace(/^-/, '−')}</span>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={confirmNumber}
                className="px-5 py-2 rounded-2xl bg-[#FDEEAD] border-2 border-brand-brown text-brand-brown font-black hover:bg-[#F9E08F]"
              >
                確定
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
}) => {
  return drafts.map((d, idx) => {
    const tokens = Array.isArray(d.tokens) ? d.tokens : [];
    const v = validateTokens(tokens, config.allowedOps, config.allowParentheses);
    if (!v.ok) throw new Error(`第 ${idx + 1} 題：${v.error}`);
    const answer = evaluateTokens(tokens);
    if (config.answerMode === 'mcq') {
      const { choices, correctIndex } = generateMcqChoices(answer);
      return { tokens, answer, choices, correctIndex };
    }
    return { tokens, answer };
  });
};

