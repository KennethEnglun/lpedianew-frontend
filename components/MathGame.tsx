import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MathToken, Rational } from '../services/mathGame';
import { normalizeRational, rationalKey } from '../services/mathGame';
import { FractionView, MathExpressionView } from './MathExpressionView';

type MathQuestionMcq = { tokens: MathToken[]; answer: Rational; choices: Rational[]; correctIndex: number };
type MathQuestionInput = { tokens: MathToken[]; answer: Rational };

type InputMode = 'int' | 'frac' | 'mixed';
type InputFocus = 'whole' | 'num' | 'den';

const clampDigits = (s: string, maxLen = 6) => String(s || '').replace(/[^\d]/g, '').slice(0, maxLen);

const parseSafeInt = (s: string) => {
  const v = Number.parseInt(String(s || '').trim(), 10);
  if (!Number.isFinite(v)) return null;
  return v;
};

const buildRationalFromUi = (state: {
  sign: 1 | -1;
  mode: InputMode;
  whole: string;
  num: string;
  den: string;
}): { ok: true; value: Rational } | { ok: false; error: string } => {
  const sign = state.sign === -1 ? -1 : 1;
  const mode = state.mode;

  const wholeAbs = parseSafeInt(state.whole);
  const whole = wholeAbs === null ? 0 : Math.abs(wholeAbs);
  const numAbs = parseSafeInt(state.num);
  const num = numAbs === null ? 0 : Math.abs(numAbs);
  const denAbs = parseSafeInt(state.den);
  const den = denAbs === null ? 0 : Math.abs(denAbs);

  if (mode === 'int') {
    const w = parseSafeInt(state.whole);
    if (w === null) return { ok: false, error: '請輸入整數答案' };
    return { ok: true, value: normalizeRational({ n: sign * Math.abs(w), d: 1 }) };
  }

  if (mode === 'frac') {
    const nRaw = parseSafeInt(state.num);
    if (nRaw === null) return { ok: false, error: '請輸入分子/整數' };
    if (!state.den.trim()) {
      return { ok: true, value: normalizeRational({ n: sign * Math.abs(nRaw), d: 1 }) };
    }
    if (den === 0) return { ok: false, error: '分母不可為 0' };
    return { ok: true, value: normalizeRational({ n: sign * Math.abs(nRaw), d: den }) };
  }

  // mixed
  if (!state.den.trim() && !state.num.trim()) {
    const w = parseSafeInt(state.whole);
    if (w === null) return { ok: false, error: '請輸入帶分數或切換成整數模式' };
    return { ok: true, value: normalizeRational({ n: sign * Math.abs(w), d: 1 }) };
  }

  if (den === 0) return { ok: false, error: '分母不可為 0' };
  if (num === 0 && whole === 0) return { ok: false, error: '請輸入答案' };
  if (num >= den && den > 0) {
    // Allow improper, but hint user.
    // Still accept because equality is rational-based.
  }

  const n = (whole * den + num) * sign;
  return { ok: true, value: normalizeRational({ n, d: den || 1 }) };
};

const KeypadButton: React.FC<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}> = ({ label, onClick, disabled, className }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={[
      'h-11 rounded-xl border-2 font-black text-lg shadow-sm',
      disabled
        ? 'bg-black/10 border-white/20 text-black/30 cursor-not-allowed'
        : 'bg-white/70 border-white/70 text-[#2F2A4A] hover:bg-white hover:-translate-y-[1px] active:translate-y-0 transition',
      className || ''
    ].join(' ')}
  >
    {label}
  </button>
);

export const MathGame: React.FC<{
  game: any;
  onExit: () => void;
  onStart: () => void;
  onComplete: (result: { success: boolean; score: number; correctAnswers: number; totalQuestions: number; timeSpent: number }) => void;
}> = ({ game, onExit, onStart, onComplete }) => {
  const answerMode: 'mcq' | 'input' = String(game?.math?.answerMode || game?.answerMode || 'mcq') === 'input' ? 'input' : 'mcq';
  const questions = useMemo(() => (Array.isArray(game?.questions) ? game.questions : []), [game?.id]);

  const totalQuestions = questions.length;
  const timeLimitSeconds: number | null = game?.timeLimitSeconds ?? null;
  const livesLimit: number | null = game?.livesLimit ?? null;

  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [lives, setLives] = useState<number | null>(livesLimit ?? null);
  const [remaining, setRemaining] = useState<number | null>(typeof timeLimitSeconds === 'number' ? timeLimitSeconds : null);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; correctAnswer: Rational } | null>(null);

  const [inputMode, setInputMode] = useState<InputMode>('int');
  const [inputSign, setInputSign] = useState<1 | -1>(1);
  const [inputWhole, setInputWhole] = useState('');
  const [inputNum, setInputNum] = useState('');
  const [inputDen, setInputDen] = useState('');
  const [inputFocus, setInputFocus] = useState<InputFocus>('whole');

  const startedRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const [pendingResult, setPendingResult] = useState<{
    shouldEnd: boolean;
    success: boolean;
    correctDelta: number;
  } | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startTimeRef.current = Date.now();
    onStart();
  }, [onStart]);

  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 0) return;
    const id = window.setInterval(() => setRemaining((s) => (s === null ? null : Math.max(0, s - 1))), 1000);
    return () => window.clearInterval(id);
  }, [remaining]);

  useEffect(() => {
    if (completedRef.current) return;
    if (remaining !== null && remaining <= 0) {
      completedRef.current = true;
      const timeSpent = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : 0;
      const score = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;
      onComplete({ success: false, score, correctAnswers: correct, totalQuestions, timeSpent });
    }
  }, [remaining, correct, totalQuestions, onComplete]);

  const current = questions[index] as any;
  const answer: Rational | null = current?.answer ? normalizeRational(current.answer) : null;
  const effectiveMode: 'mcq' | 'input' = (() => {
    if (answerMode === 'input') return 'input';
    if (Array.isArray(current?.choices) && current.choices.length > 0) return 'mcq';
    return 'input';
  })();

  const clearAllInput = () => {
    setInputWhole('');
    setInputNum('');
    setInputDen('');
    setInputSign(1);
    setInputFocus(inputMode === 'frac' ? 'num' : 'whole');
  };

  const lockWithFeedback = (wasCorrect: boolean, correctAnswer: Rational, correctDelta: number, shouldEnd: boolean, success: boolean) => {
    if (locked) return;
    setLocked(true);
    setFeedback({ ok: wasCorrect, correctAnswer });
    setPendingResult({ shouldEnd, success, correctDelta });
  };

  const handleWrongWithLives = () => {
    if (lives === null) return false;
    const nextLives = Math.max(0, lives - 1);
    setLives(nextLives);
    if (nextLives <= 0 && !completedRef.current) {
      completedRef.current = true;
      const timeSpent = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : 0;
      const score = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;
      onComplete({ success: false, score, correctAnswers: correct, totalQuestions, timeSpent });
      return true;
    }
    return false;
  };

  const checkAndLock = (userAnswer: Rational) => {
    if (!answer) return;
    const ok = rationalKey(userAnswer) === rationalKey(answer);
    const ended = ok ? false : handleWrongWithLives();
    const correctDelta = ok ? 1 : 0;
    if (ok) setCorrect((c) => c + 1);

    const nextIndex = index + 1;
    const reachedEnd = nextIndex >= totalQuestions;
    const shouldEnd = ended || reachedEnd;
    const success = ended ? false : true;
    lockWithFeedback(ok, answer, correctDelta, shouldEnd, success);
  };

  const onSelectMcq = (choice: Rational, choiceIndex: number) => {
    if (locked || !answer) return;
    const ok = choiceIndex === Number((current as MathQuestionMcq).correctIndex);
    const ended = ok ? false : handleWrongWithLives();
    const correctDelta = ok ? 1 : 0;
    if (ok) setCorrect((c) => c + 1);

    const nextIndex = index + 1;
    const reachedEnd = nextIndex >= totalQuestions;
    const shouldEnd = ended || reachedEnd;
    const success = ended ? false : true;
    lockWithFeedback(ok, answer, correctDelta, shouldEnd, success);
  };

  const onSubmitInput = () => {
    if (locked || !answer) return;
    const built = buildRationalFromUi({ sign: inputSign, mode: inputMode, whole: inputWhole, num: inputNum, den: inputDen });
    if (!built.ok) return alert(built.error);
    checkAndLock(built.value);
  };

  const goNextOrFinish = () => {
    if (!pendingResult) return;
    const nextIndex = index + 1;
    const timeSpent = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : 0;

    if (pendingResult.shouldEnd) {
      if (completedRef.current) return;
      completedRef.current = true;
      const score = totalQuestions > 0 ? Math.round((correct + pendingResult.correctDelta) / totalQuestions * 100) : 0;
      onComplete({ success: pendingResult.success, score, correctAnswers: correct + pendingResult.correctDelta, totalQuestions, timeSpent });
      return;
    }

    setFeedback(null);
    setPendingResult(null);
    setLocked(false);
    clearAllInput();
    setIndex(nextIndex);
  };

  const applyKey = (key: string) => {
    if (locked || feedback) return;
    const setTarget = (setter: (v: string) => void, currentValue: string) => {
      if (key === '⌫' || key === '<') return setter(currentValue.slice(0, -1));
      if (key === '清除') return setter('');
      if (isNaN(Number(key))) return;
      setter(clampDigits(currentValue + key));
    };

    if (key === '+') {
      setInputSign(1);
      return;
    }
    if (key === '−' || key === '-') {
      setInputSign(-1);
      return;
    }

    if (inputMode === 'int') {
      setTarget(setInputWhole, inputWhole);
      return;
    }

    if (inputMode === 'frac') {
      const focus: InputFocus = inputFocus === 'whole' ? 'num' : inputFocus;
      if (focus === 'num') setTarget(setInputNum, inputNum);
      if (focus === 'den') setTarget(setInputDen, inputDen);
      return;
    }

    // mixed
    if (inputFocus === 'whole') setTarget(setInputWhole, inputWhole);
    if (inputFocus === 'num') setTarget(setInputNum, inputNum);
    if (inputFocus === 'den') setTarget(setInputDen, inputDen);
  };

  if (!current || !Array.isArray(current.tokens)) {
    return (
      <div className="text-white">
        <div className="text-2xl font-black mb-2">題目資料不完整</div>
        <button onClick={onExit} className="px-4 py-2 rounded-xl bg-[#A1D9AE] text-brand-brown font-black">返回</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-3xl rounded-[2rem] border-4 border-white/60 bg-gradient-to-br from-[#FFE6F1] via-[#FFF6D6] to-[#DFF6FF] shadow-[0_20px_60px_rgba(0,0,0,0.35)] p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[#2F2A4A] font-black">
            第 {index + 1} / {totalQuestions} 題
          </div>
          <div className="flex items-center gap-3">
            {remaining !== null && (
              <div className="px-3 py-1 rounded-full bg-white/70 border-2 border-white/80 text-[#2F2A4A] font-black">
                ⏳ {remaining}s
              </div>
            )}
            {lives !== null && (
              <div className="px-3 py-1 rounded-full bg-white/70 border-2 border-white/80 text-[#2F2A4A] font-black">
                ❤️ {lives}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (confirm('確定要退出遊戲嗎？')) onExit();
              }}
              className="px-3 py-1 rounded-full bg-white/70 hover:bg-white text-[#2F2A4A] font-black border-2 border-white/80"
            >
              離開
            </button>
          </div>
        </div>

        <div className="mt-3 bg-white rounded-3xl border-4 border-white/80 p-4 shadow-sm">
          <div className="text-sm font-black text-[#2F2A4A]/70 mb-1">請計算：</div>
          <div className="text-3xl font-black text-[#2F2A4A]">
            <MathExpressionView tokens={current.tokens} />
          </div>
        </div>

        {feedback && (
          <div className={`mt-3 p-3 rounded-3xl border-4 font-black shadow-sm ${feedback.ok ? 'bg-[#E8FFF0] border-[#7AD8A1] text-[#2F5E3A]' : 'bg-[#FFE8F0] border-[#FF9BB8] text-[#7A1F1F]'}`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                {feedback.ok ? '答對了！' : (
                  <span className="inline-flex items-center gap-2">
                    答錯了，正確答案：
                    <FractionView value={feedback.correctAnswer} className="text-lg font-black" />
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={goNextOrFinish}
                className="px-4 py-2 rounded-2xl bg-white border-2 border-black/10 text-[#2F2A4A] font-black hover:bg-[#FFF6D6]"
              >
                {pendingResult?.shouldEnd ? '完成' : '下一題'}
              </button>
            </div>
          </div>
        )}

        <div className="mt-3">
          {effectiveMode === 'mcq' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(current as MathQuestionMcq).choices?.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={locked || feedback !== null}
                  onClick={() => onSelectMcq(c, i)}
                  className="p-3 rounded-3xl bg-white/80 border-4 border-white/80 hover:bg-white text-[#2F2A4A] font-black text-xl disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <FractionView value={normalizeRational(c)} className="text-2xl" />
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-white/60 border-4 border-white/70 rounded-3xl p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm text-[#2F2A4A]/80 font-black">輸入答案（點選格子後用鍵盤輸入）</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setInputMode('int'); setInputFocus('whole'); }}
                    disabled={locked || feedback !== null}
                    className={`px-3 py-1 rounded-full border-2 font-black ${inputMode === 'int' ? 'bg-[#B5F8CE] border-[#4FBF7A] text-[#2F2A4A]' : 'bg-white/70 border-white/70 text-[#2F2A4A]/70 hover:bg-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    整數
                  </button>
                  <button
                    type="button"
                    onClick={() => { setInputMode('frac'); setInputFocus('num'); }}
                    disabled={locked || feedback !== null}
                    className={`px-3 py-1 rounded-full border-2 font-black ${inputMode === 'frac' ? 'bg-[#B5D8F8] border-[#4B9FE6] text-[#2F2A4A]' : 'bg-white/70 border-white/70 text-[#2F2A4A]/70 hover:bg-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    分數
                  </button>
                  <button
                    type="button"
                    onClick={() => { setInputMode('mixed'); setInputFocus('whole'); }}
                    disabled={locked || feedback !== null}
                    className={`px-3 py-1 rounded-full border-2 font-black ${inputMode === 'mixed' ? 'bg-[#F8B5E0] border-[#E35DB3] text-[#2F2A4A]' : 'bg-white/70 border-white/70 text-[#2F2A4A]/70 hover:bg-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    帶分數
                  </button>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="h-10 px-3 rounded-2xl bg-white/80 border-2 border-white/80 text-[#2F2A4A] font-black flex items-center">
                    符號：{inputSign === 1 ? '+' : '−'}
                  </div>

                  {/* Answer display */}
                  <div className="flex items-center gap-3">
                    {inputMode === 'int' && (
                      <button
                        type="button"
                        onClick={() => setInputFocus('whole')}
                        disabled={locked || feedback !== null}
                        className={`min-w-[140px] h-10 px-4 rounded-2xl border-2 text-left font-black text-[#2F2A4A] bg-white/80 ${inputFocus === 'whole' ? 'border-[#4B9FE6]' : 'border-white/80'} disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {inputWhole ? inputWhole : '輸入整數'}
                      </button>
                    )}

                    {inputMode === 'frac' && (
                      <div className="inline-flex items-center gap-3">
                        <div className="inline-flex flex-col items-stretch">
                          <button
                            type="button"
                            onClick={() => setInputFocus('num')}
                            disabled={locked || feedback !== null}
                            className={`w-44 h-10 px-4 rounded-t-2xl border-2 font-black text-[#2F2A4A] bg-white/80 text-left ${inputFocus === 'num' ? 'border-[#E35DB3]' : 'border-white/80'} disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {inputNum ? inputNum : '分子/整數'}
                          </button>
                          <div className="h-[2px] bg-[#777]" />
                          <button
                            type="button"
                            onClick={() => setInputFocus('den')}
                            disabled={locked || feedback !== null}
                            className={`w-44 h-10 px-4 rounded-b-2xl border-2 border-t-0 font-black text-[#2F2A4A] bg-white/80 text-left ${inputFocus === 'den' ? 'border-[#E35DB3]' : 'border-white/80'} disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {inputDen ? inputDen : '分母（可留空）'}
                          </button>
                        </div>
                      </div>
                    )}

                    {inputMode === 'mixed' && (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setInputFocus('whole')}
                          disabled={locked || feedback !== null}
                          className={`min-w-[120px] h-10 px-4 rounded-2xl border-2 text-left font-black text-[#2F2A4A] bg-white/80 ${inputFocus === 'whole' ? 'border-[#4FBF7A]' : 'border-white/80'} disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {inputWhole ? inputWhole : '整數部分'}
                        </button>
                        <div className="inline-flex flex-col items-stretch">
                          <button
                            type="button"
                            onClick={() => setInputFocus('num')}
                            disabled={locked || feedback !== null}
                            className={`w-40 h-10 px-4 rounded-t-2xl border-2 font-black text-[#2F2A4A] bg-white/80 text-left ${inputFocus === 'num' ? 'border-[#4FBF7A]' : 'border-white/80'} disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {inputNum ? inputNum : '分子'}
                          </button>
                          <div className="h-[2px] bg-[#777]" />
                          <button
                            type="button"
                            onClick={() => setInputFocus('den')}
                            disabled={locked || feedback !== null}
                            className={`w-40 h-10 px-4 rounded-b-2xl border-2 border-t-0 font-black text-[#2F2A4A] bg-white/80 text-left ${inputFocus === 'den' ? 'border-[#4FBF7A]' : 'border-white/80'} disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {inputDen ? inputDen : '分母'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (locked || feedback) return;
                      if (inputFocus === 'whole') setInputWhole('');
                      if (inputFocus === 'num') setInputNum('');
                      if (inputFocus === 'den') setInputDen('');
                    }}
                    disabled={locked || feedback !== null}
                    className="px-4 py-2 rounded-2xl bg-white/80 hover:bg-white text-[#2F2A4A] font-black border-2 border-white/80 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    清除
                  </button>
                  <button
                    type="button"
                    onClick={onSubmitInput}
                    disabled={locked || feedback !== null}
                    className="px-6 py-2 rounded-2xl bg-[#FFD4B5] text-[#2F2A4A] font-black text-lg border-2 border-white/80 hover:bg-[#FFF6D6] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    提交
                  </button>
                </div>
              </div>

              {/* On-screen keypad */}
              <div className="mt-3 grid grid-cols-4 gap-2">
                {[
                  '1', '2', '3', '',
                  '4', '5', '6', '',
                  '7', '8', '9', '',
                  '+', '−', '0', '<'
                ].map((k, idx) => {
                  if (!k) return <div key={`sp-${idx}`} />;
                  const colorClass = (() => {
                    if (k === '<') return 'bg-[#FFE8F0] text-[#7A1F1F]';
                    if (k === '+' || k === '−') return 'bg-[#E8FFF0] text-[#2F5E3A]';
                    return 'bg-white/80';
                  })();
                  return (
                    <KeypadButton
                      key={`${k}-${idx}`}
                      label={k}
                      onClick={() => applyKey(k)}
                      disabled={locked || feedback !== null}
                      className={colorClass}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
