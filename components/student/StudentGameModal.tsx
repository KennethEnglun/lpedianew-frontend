import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { authService } from '../../services/authService';
import type { Subject } from '../../types';
import TowerDefenseGame from '../TowerDefenseGame';
import { RangerTdGame } from '../RangerTdGame';
import { MathGame } from '../MathGame';
import { MazeGame } from '../MazeGame';
import { MatchingGamePreview } from '../MatchingGamePreview';

type GameResultPayload = {
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  timeSpent: number;
  details?: any;
};

const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function StudentGameModal(props: {
  open: boolean;
  gameId: string | null;
  onClose: () => void;
  onFinished?: () => void;
}) {
  const { open, gameId, onClose, onFinished } = props;
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [game, setGame] = useState<any | null>(null);
  const [completed, setCompleted] = useState(false);
  const [result, setResult] = useState<GameResultPayload | null>(null);
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setError('');
    setGame(null);
    setCompleted(false);
    setResult(null);
    setStartedAtMs(null);
  }, [open, gameId]);

  useEffect(() => {
    if (!open) return;
    if (!gameId) return;
    setLoading(true);
    setError('');
    authService
      .getGameForStudent(String(gameId))
      .then((resp) => {
        setGame(resp?.game || null);
      })
      .catch((e: any) => {
        setError(e?.message || '載入遊戲失敗，請稍後再試');
      })
      .finally(() => setLoading(false));
  }, [open, gameId]);

  const title = String(game?.title || '遊戲');
  const gameType = String(game?.gameType || '');

  const mazeQuestions = useMemo(() => {
    if (gameType !== 'maze') return [];
    const qs = Array.isArray(game?.questions) ? game.questions : [];
    return qs.map((q: any, i: number) => {
      const allOptions = [q?.answer, ...(q?.wrongOptions || [])].filter(Boolean).map((x) => String(x));
      const options = shuffle(allOptions).slice(0, 4);
      const correctIndex = options.indexOf(String(q?.answer ?? ''));
      return {
        id: `mz-${String(game?.id || gameId)}-${i}`,
        text: String(q?.question || ''),
        options: options.length === 4 ? options : [...options, ...new Array(Math.max(0, 4 - options.length)).fill('')].slice(0, 4),
        correctIndex: correctIndex >= 0 ? correctIndex : 0
      };
    });
  }, [game?.id, game?.questions, gameId, gameType]);

  const matchingPairs = useMemo(() => {
    if (gameType !== 'matching') return [];
    const qs = Array.isArray(game?.questions) ? game.questions : [];
    return qs
      .map((q: any) => ({ question: String(q?.question || ''), answer: String(q?.answer || '') }))
      .filter((p: any) => p.question && p.answer);
  }, [game?.questions, gameType]);

  const submitScore = async (payload: GameResultPayload) => {
    if (!gameId) return;
    setSubmitting(true);
    setError('');
    try {
      await authService.submitGameScore(String(gameId), {
        score: payload.score,
        correctAnswers: payload.correctAnswers,
        totalQuestions: payload.totalQuestions,
        timeSpent: payload.timeSpent,
        ...(payload.details ? { details: payload.details } : null)
      });
      setCompleted(true);
      setResult(payload);
      onFinished?.();
    } catch (e: any) {
      setError(e?.message || '提交成績失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  };

  const renderBody = () => {
    if (loading) {
      return <div className="text-white font-bold">載入中...</div>;
    }
    if (!game) {
      return <div className="text-white font-bold">{error || '找不到遊戲資料'}</div>;
    }

    if (gameType === 'tower-defense') {
      return (
        <TowerDefenseGame
          gameId={String(gameId)}
          questions={Array.isArray(game.questions) ? game.questions : []}
          subject={String(game.subject || '科學') as Subject}
          difficulty={(game.difficulty || 'medium') as any}
          durationSeconds={Number(game.timeLimitSeconds) || 60}
          livesLimit={game.livesLimit ?? null}
          onExit={onClose}
          onStart={() => setStartedAtMs(Date.now())}
          onComplete={(r: any) => {
            const score = Math.round(Number(r?.score) || 0);
            const correctAnswers = Math.round(Number(r?.correctAnswers) || 0);
            const totalQuestions = Math.round(Number(r?.totalQuestions) || 0);
            const timeSpent = Math.round(Number(r?.timeSpent) || 0);
            void submitScore({
              score,
              correctAnswers,
              totalQuestions,
              timeSpent,
              details: { ...(r?.wavesSurvived !== undefined ? { wavesSurvived: r.wavesSurvived } : null), type: 'tower-defense' }
            });
          }}
        />
      );
    }

    if (gameType === 'ranger-td') {
      return (
        <RangerTdGame
          game={game}
          gameId={String(gameId)}
          onExit={onClose}
          onStart={() => setStartedAtMs(Date.now())}
          onComplete={(r) => {
            void submitScore({
              score: Math.round(Number(r.score) || 0),
              correctAnswers: Math.round(Number(r.correctAnswers) || 0),
              totalQuestions: Math.round(Number(r.totalQuestions) || 0),
              timeSpent: Math.round(Number(r.timeSpent) || 0),
              ...(r.details ? { details: r.details } : null)
            });
          }}
        />
      );
    }

    if (gameType === 'math') {
      return (
        <MathGame
          game={game}
          gameId={String(gameId)}
          onExit={onClose}
          onStart={() => setStartedAtMs(Date.now())}
          onComplete={(r) => {
            void submitScore({
              score: Math.round(Number(r.score) || 0),
              correctAnswers: Math.round(Number(r.correctAnswers) || 0),
              totalQuestions: Math.round(Number(r.totalQuestions) || 0),
              timeSpent: Math.round(Number(r.timeSpent) || 0),
              ...(r.details ? { details: r.details } : null)
            });
          }}
        />
      );
    }

    if (gameType === 'maze') {
      return (
        <MazeGame
          questions={mazeQuestions as any}
          onExit={onClose}
          onComplete={(score) => {
            const timeSpent = startedAtMs ? Math.round((Date.now() - startedAtMs) / 1000) : 0;
            void submitScore({
              score: Math.round(Number(score) || 0),
              correctAnswers: 0,
              totalQuestions: mazeQuestions.length,
              timeSpent,
              details: { type: 'maze' }
            });
          }}
        />
      );
    }

    if (gameType === 'matching') {
      return (
        <MatchingGamePreview
          questions={matchingPairs}
          onExit={onClose}
          onComplete={(r) => {
            void submitScore({
              score: Math.round(Number(r.score) || 0),
              correctAnswers: Math.round(Number(r.correctAnswers) || 0),
              totalQuestions: Math.round(Number(r.totalQuestions) || 0),
              timeSpent: Math.round(Number(r.timeSpent) || 0),
              details: { type: 'matching' }
            });
          }}
        />
      );
    }

    return <div className="text-white font-bold">此遊戲類型暫未支援：{gameType || 'unknown'}</div>;
  };

  if (!open || !gameId) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#2D2D2D] border-4 border-[#4A4A4A] rounded-3xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
        <div className="bg-[#1A1A1A] p-4 flex justify-between items-center border-b-2 border-[#4A4A4A]">
          <div className="min-w-0">
            <h2 className="text-2xl font-black text-white tracking-widest truncate">{title}</h2>
            <p className="text-gray-400 text-sm truncate">{gameType || 'game'}</p>
          </div>
          <div className="flex items-center gap-3">
            {submitting && <div className="bg-[#333] px-3 py-1 rounded text-yellow-300 font-mono">提交中...</div>}
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-[#333] hover:bg-[#444] text-white flex items-center justify-center transition-colors"
              aria-label="關閉"
            >
              <X />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-[#222] p-6 overflow-y-auto relative">
          {error && (
            <div className="mb-4 bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-red-800 font-bold">
              {error}
            </div>
          )}
          {renderBody()}

          {completed && result && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-6">
              <div className="bg-white rounded-3xl border-4 border-brand-brown shadow-comic p-6 w-full max-w-md text-center">
                <div className="text-3xl font-black text-brand-brown mb-2">完成！</div>
                <div className="text-lg font-bold text-gray-700 mb-4">分數：{Math.round(result.score)}</div>
                <div className="flex gap-3 justify-center">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2 rounded-2xl bg-[#FDEEAD] border-2 border-brand-brown text-brand-brown font-black hover:bg-[#FCE690]"
                  >
                    返回任務
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

