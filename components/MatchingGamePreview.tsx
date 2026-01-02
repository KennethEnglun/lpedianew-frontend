import React, { useEffect, useMemo, useState } from 'react';

type Card = {
  id: string;
  content: string;
  type: 'question' | 'answer';
  pairId: number;
  isFlipped: boolean;
  isMatched: boolean;
};

const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const MatchingGamePreview: React.FC<{
  questions: Array<{ question: string; answer: string }>;
  onExit: () => void;
  onComplete: (result: { success: boolean; score: number; correctAnswers: number; totalQuestions: number; timeSpent: number }) => void;
}> = ({ questions, onExit, onComplete }) => {
  const totalPairs = Array.isArray(questions) ? questions.length : 0;

  const cards = useMemo(() => {
    const list: Card[] = [];
    questions.forEach((q, idx) => {
      list.push({ id: `q-${idx}`, content: String(q.question || ''), type: 'question', pairId: idx, isFlipped: false, isMatched: false });
      list.push({ id: `a-${idx}`, content: String(q.answer || ''), type: 'answer', pairId: idx, isFlipped: false, isMatched: false });
    });
    return shuffle(list);
  }, [questions]);

  const [state, setState] = useState<Card[]>(cards);
  const [selected, setSelected] = useState<number[]>([]);
  const [startAt] = useState<number>(() => Date.now());
  const [done, setDone] = useState(false);

  useEffect(() => {
    setState(cards);
    setSelected([]);
    setDone(false);
  }, [cards]);

  useEffect(() => {
    if (done) return;
    if (state.length > 0 && state.every((c) => c.isMatched)) {
      setDone(true);
      const timeSpent = Math.round((Date.now() - startAt) / 1000);
      onComplete({ success: true, score: 100, correctAnswers: totalPairs, totalQuestions: totalPairs, timeSpent });
    }
  }, [done, onComplete, startAt, state, totalPairs]);

  const flip = (idx: number) => {
    if (done) return;
    if (selected.length >= 2) return;
    const c = state[idx];
    if (!c || c.isMatched || c.isFlipped) return;

    const next = [...state];
    next[idx] = { ...c, isFlipped: true };
    const nextSelected = [...selected, idx];
    setState(next);
    setSelected(nextSelected);

    if (nextSelected.length === 2) {
      const a = next[nextSelected[0]];
      const b = next[nextSelected[1]];
      const isMatch = a.pairId === b.pairId && a.type !== b.type;
      window.setTimeout(() => {
        setState((prev) => {
          const copy = [...prev];
          if (isMatch) {
            copy[nextSelected[0]] = { ...copy[nextSelected[0]], isMatched: true };
            copy[nextSelected[1]] = { ...copy[nextSelected[1]], isMatched: true };
          } else {
            copy[nextSelected[0]] = { ...copy[nextSelected[0]], isFlipped: false };
            copy[nextSelected[1]] = { ...copy[nextSelected[1]], isFlipped: false };
          }
          return copy;
        });
        setSelected([]);
      }, 650);
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-white font-black">翻牌記憶（預覽）</div>
        <button
          type="button"
          onClick={onExit}
          className="px-3 py-1 rounded-xl bg-[#333] hover:bg-[#444] text-white font-bold border border-[#555]"
        >
          離開
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {state.map((c, idx) => (
          <button
            key={c.id}
            type="button"
            onClick={() => flip(idx)}
            className={[
              'h-24 sm:h-28 rounded-2xl border-4 font-black text-sm sm:text-base transition',
              c.isMatched ? 'bg-[#A1D9AE] border-[#5E8B66] text-brand-brown' : c.isFlipped ? 'bg-white border-[#FDEEAD] text-brand-brown' : 'bg-[#222] border-[#444] text-white hover:bg-[#262626]'
            ].join(' ')}
          >
            {c.isFlipped || c.isMatched ? c.content : '？'}
          </button>
        ))}
      </div>
    </div>
  );
};

