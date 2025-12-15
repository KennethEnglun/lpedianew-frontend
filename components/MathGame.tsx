import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MathToken, Rational } from '../services/mathGame';
import { normalizeRational, parseRationalInput, rationalKey } from '../services/mathGame';
import { FractionView, MathExpressionView } from './MathExpressionView';

type MathQuestionMcq = { tokens: MathToken[]; answer: Rational; choices: Rational[]; correctIndex: number };
type MathQuestionInput = { tokens: MathToken[]; answer: Rational };

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

  const [inputN, setInputN] = useState('');
  const [inputD, setInputD] = useState('');

  const startedRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const completedRef = useRef(false);

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

  const clearInput = () => {
    setInputN('');
    setInputD('');
  };

  const proceed = (wasCorrect: boolean, correctAnswer: Rational) => {
    if (locked) return;
    setLocked(true);
    setFeedback({ ok: wasCorrect, correctAnswer });

    window.setTimeout(() => {
      setFeedback(null);
      setLocked(false);
      clearInput();

      const nextIndex = index + 1;
      if (nextIndex >= totalQuestions) {
        if (completedRef.current) return;
        completedRef.current = true;
        const timeSpent = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : 0;
        const score = totalQuestions > 0 ? Math.round((correct + (wasCorrect ? 1 : 0)) / totalQuestions * 100) : 0;
        onComplete({ success: true, score, correctAnswers: correct + (wasCorrect ? 1 : 0), totalQuestions, timeSpent });
        return;
      }
      setIndex(nextIndex);
    }, 900);
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

  const checkAndProceed = (userAnswer: Rational) => {
    if (!answer) return;
    const ok = rationalKey(userAnswer) === rationalKey(answer);
    if (ok) setCorrect((c) => c + 1);
    else {
      const ended = handleWrongWithLives();
      if (ended) return;
    }
    proceed(ok, answer);
  };

  const onSelectMcq = (choice: Rational, choiceIndex: number) => {
    if (locked || !answer) return;
    const ok = choiceIndex === Number((current as MathQuestionMcq).correctIndex);
    if (ok) setCorrect((c) => c + 1);
    else {
      const ended = handleWrongWithLives();
      if (ended) return;
    }
    proceed(ok, answer);
  };

  const onSubmitInput = () => {
    if (locked || !answer) return;
    const parsed = parseRationalInput(inputN, inputD);
    if (!parsed) return alert('請輸入有效答案（分母不可為 0）');
    checkAndProceed(parsed);
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
      <div className="w-full max-w-3xl bg-[#111] border-4 border-[#4A4A4A] rounded-3xl p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-white font-black">
            第 {index + 1} / {totalQuestions} 題
          </div>
          <div className="flex items-center gap-3">
            {remaining !== null && (
              <div className="bg-[#222] px-3 py-1 rounded-xl text-yellow-200 font-mono border border-[#444]">
                剩餘 {remaining}s
              </div>
            )}
            {lives !== null && (
              <div className="bg-[#222] px-3 py-1 rounded-xl text-red-200 font-mono border border-[#444]">
                生命 {lives}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (confirm('確定要退出遊戲嗎？')) onExit();
              }}
              className="px-3 py-1 rounded-xl bg-[#333] hover:bg-[#444] text-white font-bold border border-[#555]"
            >
              離開
            </button>
          </div>
        </div>

        <div className="mt-5 bg-white rounded-2xl border-2 border-gray-200 p-5">
          <div className="text-sm font-bold text-gray-500 mb-2">請計算：</div>
          <div className="text-3xl font-black text-gray-900">
            <MathExpressionView tokens={current.tokens} />
          </div>
        </div>

        {feedback && (
          <div className={`mt-4 p-3 rounded-2xl border-2 font-bold ${feedback.ok ? 'bg-[#E8F5E9] border-[#5E8B66] text-[#2F5E3A]' : 'bg-[#FFE8E8] border-[#D46A6A] text-[#7A1F1F]'}`}>
            {feedback.ok ? '答對了！' : (
              <span className="inline-flex items-center gap-2">
                答錯了，正確答案：
                <FractionView value={feedback.correctAnswer} className="text-lg font-black" />
              </span>
            )}
          </div>
        )}

        <div className="mt-4">
          {effectiveMode === 'mcq' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(current as MathQuestionMcq).choices?.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={locked || feedback !== null}
                  onClick={() => onSelectMcq(c, i)}
                  className="p-4 rounded-2xl bg-[#222] border-2 border-[#444] hover:border-[#A1D9AE] hover:bg-[#262626] text-white font-black text-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FractionView value={normalizeRational(c)} className="text-2xl" />
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-[#222] border-2 border-[#444] rounded-2xl p-4">
              <div className="text-sm text-gray-300 font-bold mb-2">輸入答案（分數請上下輸入）</div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="inline-flex flex-col items-stretch">
                  <input
                    value={inputN}
                    onChange={(e) => setInputN(e.target.value)}
                    placeholder="分子/整數"
                    className="w-40 px-3 py-2 rounded-t-xl border-2 border-[#555] bg-[#111] text-white focus:outline-none focus:border-[#A1D9AE]"
                    inputMode="numeric"
                    disabled={locked || feedback !== null}
                  />
                  <div className="h-[2px] bg-[#777]" />
                  <input
                    value={inputD}
                    onChange={(e) => setInputD(e.target.value)}
                    placeholder="分母（可留空）"
                    className="w-40 px-3 py-2 rounded-b-xl border-2 border-t-0 border-[#555] bg-[#111] text-white focus:outline-none focus:border-[#A1D9AE]"
                    inputMode="numeric"
                    disabled={locked || feedback !== null}
                  />
                </div>
                <button
                  type="button"
                  onClick={onSubmitInput}
                  disabled={locked || feedback !== null}
                  className="px-6 py-3 rounded-2xl bg-[#A1D9AE] text-brand-brown font-black text-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  提交
                </button>
                <button
                  type="button"
                  onClick={clearInput}
                  disabled={locked || feedback !== null}
                  className="px-4 py-3 rounded-2xl bg-[#333] hover:bg-[#444] text-white font-bold border border-[#555] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  清除
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
