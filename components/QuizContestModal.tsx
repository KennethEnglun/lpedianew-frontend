import React, { useEffect, useMemo, useState } from 'react';
import { X, Trophy } from 'lucide-react';
import { authService } from '../services/authService';

type ContestSummary = {
  id: string;
  title: string;
  topic?: string;
  subject: string;
  grade: string;
  questionCount: number;
  timeLimitSeconds?: number | null;
  attempts?: number;
  bestScore?: number | null;
};

type AttemptQuestion = { id: number; question: string; options: string[] };

export function QuizContestModal(props: {
  open: boolean;
  contest: ContestSummary | null;
  onClose: () => void;
  onFinished?: () => void;
}) {
  const { open, contest, onClose, onFinished } = props;
  const [phase, setPhase] = useState<'idle' | 'playing' | 'result' | 'leaderboard'>('idle');
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<AttemptQuestion[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);

  const [result, setResult] = useState<{ score: number; correctAnswers: number; totalQuestions: number; submittedAt?: string } | null>(null);

  const [leaderboards, setLeaderboards] = useState<any | null>(null);
  const [leaderboardTab, setLeaderboardTab] = useState<'best' | 'total' | 'avg'>('best');
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPhase('idle');
    setStarting(false);
    setSubmitting(false);
    setError('');
    setAttemptId(null);
    setQuestions([]);
    setAnswers([]);
    setStartAt(null);
    setTimeLimitSeconds(null);
    setQuestionIndex(0);
    setResult(null);
    setLeaderboards(null);
    setLeaderboardTab('best');
    setLeaderboardLoading(false);
  }, [open, contest?.id]);

  const timeLeft = useMemo(() => {
    if (!startAt || !timeLimitSeconds) return null;
    const elapsed = Math.floor((nowMs - startAt) / 1000);
    return Math.max(0, timeLimitSeconds - elapsed);
  }, [nowMs, startAt, timeLimitSeconds]);

  useEffect(() => {
    if (phase !== 'playing') return;
    if (!timeLimitSeconds) return;
    const t = window.setInterval(() => {
      setNowMs(Date.now());
    }, 500);
    return () => window.clearInterval(t);
  }, [phase, timeLimitSeconds]);

  const canSubmit = answers.length > 0 && answers.every((a) => a >= 0);

  const start = async () => {
    if (!contest) return;
    setError('');
    setStarting(true);
    try {
      const data = await authService.startContest(contest.id);
      setAttemptId(data.attempt.id);
      setQuestions(Array.isArray(data.attempt.questions) ? data.attempt.questions : []);
      setAnswers(new Array((data.attempt.questions || []).length).fill(-1));
      setQuestionIndex(0);
      setStartAt(Date.now());
      setNowMs(Date.now());
      setTimeLimitSeconds(data.attempt.timeLimitSeconds ?? null);
      setPhase('playing');
    } catch (e: any) {
      setError(e?.message || '開始比賽失敗，請稍後再試');
    } finally {
      setStarting(false);
    }
  };

  const submit = async () => {
    if (!attemptId) return;
    if (!canSubmit) return;
    setError('');
    setSubmitting(true);
    try {
      const elapsed = startAt ? Math.floor((Date.now() - startAt) / 1000) : null;
      const resp = await authService.submitContestAttempt(attemptId, { answers, timeSpentSeconds: elapsed });
      const r = resp?.result || {};
      setResult({
        score: Number(r.score) || 0,
        correctAnswers: Number(r.correctAnswers) || 0,
        totalQuestions: Number(r.totalQuestions) || answers.length,
        submittedAt: r.submittedAt
      });
      setPhase('result');
      onFinished?.();
    } catch (e: any) {
      setError(e?.message || '提交失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  };

  const loadLeaderboard = async () => {
    if (!contest) return;
    setLeaderboardLoading(true);
    setError('');
    try {
      const data = await authService.getContestLeaderboard(contest.id);
      setLeaderboards(data.leaderboards || null);
    } catch (e: any) {
      setError(e?.message || '載入排行榜失敗');
    } finally {
      setLeaderboardLoading(false);
    }
  };

  useEffect(() => {
    if (phase !== 'leaderboard') return;
    if (leaderboards) return;
    loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (!open || !contest) return null;

  const current = questions[questionIndex];
  const total = questions.length || contest.questionCount || 0;

  const leaderboardRows = (() => {
    const lb = leaderboards || {};
    const arr = leaderboardTab === 'best' ? lb.best : leaderboardTab === 'total' ? lb.total : lb.avg;
    return Array.isArray(arr) ? arr : [];
  })();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-hidden shadow-comic flex flex-col">
        <div className="p-6 border-b-4 border-brand-brown bg-[#D2EFFF]">
          <div className="flex justify-between items-center gap-4">
            <div className="min-w-0">
              <h2 className="text-3xl font-black text-brand-brown truncate">🏁 {contest.title}</h2>
              <p className="text-sm text-gray-600 mt-1">
                {contest.subject} • {contest.grade} • 共 {contest.questionCount} 題
                {contest.timeLimitSeconds ? ` • ${contest.timeLimitSeconds} 秒限時` : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center flex-shrink-0"
              aria-label="關閉"
            >
              <X className="w-6 h-6 text-brand-brown" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-brand-cream">
          {error && (
            <div className="mb-5 bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-red-800 font-bold">
              {error}
            </div>
          )}

          {phase === 'idle' && (
            <div className="bg-white border-4 border-brand-brown rounded-3xl p-6 shadow-comic">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-2xl font-black text-brand-brown mb-2">比賽設定</div>
                  <div className="text-gray-700 font-bold">
                    題目：{contest.questionCount} 題
                    {contest.timeLimitSeconds ? ` • 限時：${contest.timeLimitSeconds} 秒` : ' • 不限時'}
                  </div>
                  {(contest.attempts ?? 0) > 0 && (
                    <div className="mt-2 text-sm text-gray-600 font-bold">
                      你已參加 {contest.attempts} 次{typeof contest.bestScore === 'number' ? ` • 最佳：${Math.round(contest.bestScore)}%` : ''}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPhase('leaderboard')}
                  className="px-4 py-2 rounded-2xl bg-[#FDEEAD] border-4 border-brand-brown text-brand-brown font-black hover:bg-[#FCE690] shadow-comic active:translate-y-1 active:shadow-none"
                >
                  <span className="inline-flex items-center gap-2">
                    <Trophy className="w-5 h-5" />
                    排行榜
                  </span>
                </button>
              </div>

              <div className="mt-6 flex gap-4">
                <button
                  type="button"
                  onClick={start}
                  disabled={starting}
                  className={`flex-1 py-3 rounded-2xl border-4 border-brand-brown font-black text-xl shadow-comic active:translate-y-1 active:shadow-none ${starting ? 'bg-gray-300 text-gray-600 cursor-wait' : 'bg-[#93C47D] text-brand-brown hover:bg-[#86b572]'}`}
                >
                  {starting ? '準備中...' : '開始比賽'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 rounded-2xl border-4 border-brand-brown font-black text-xl bg-white text-brand-brown hover:bg-gray-50 shadow-comic active:translate-y-1 active:shadow-none"
                >
                  返回
                </button>
              </div>
            </div>
          )}

          {phase === 'leaderboard' && (
            <div className="bg-white border-4 border-brand-brown rounded-3xl p-6 shadow-comic">
              <div className="flex items-center justify-between gap-3">
                <div className="text-2xl font-black text-brand-brown">🏆 排行榜</div>
                <button
                  type="button"
                  onClick={() => setPhase('idle')}
                  className="px-4 py-2 rounded-2xl bg-gray-100 border-2 border-gray-300 text-gray-700 font-black hover:bg-gray-200"
                >
                  返回
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setLeaderboardTab('best')}
                  className={`px-4 py-2 rounded-2xl border-2 font-black ${leaderboardTab === 'best' ? 'bg-[#D2EFFF] border-brand-brown text-brand-brown' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                >
                  最佳分
                </button>
                <button
                  type="button"
                  onClick={() => setLeaderboardTab('total')}
                  className={`px-4 py-2 rounded-2xl border-2 font-black ${leaderboardTab === 'total' ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                >
                  總分（多次）
                </button>
                <button
                  type="button"
                  onClick={() => setLeaderboardTab('avg')}
                  className={`px-4 py-2 rounded-2xl border-2 font-black ${leaderboardTab === 'avg' ? 'bg-[#E0D2F8] border-brand-brown text-brand-brown' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                >
                  平均分（多次）
                </button>
                <button
                  type="button"
                  onClick={loadLeaderboard}
                  className="ml-auto px-4 py-2 rounded-2xl border-2 border-gray-300 bg-white text-gray-700 font-black hover:bg-gray-50"
                  disabled={leaderboardLoading}
                >
                  {leaderboardLoading ? '載入中...' : '重新載入'}
                </button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left border-2 border-gray-200 rounded-2xl overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr className="text-sm text-gray-600">
                      <th className="px-3 py-2 font-black">#</th>
                      <th className="px-3 py-2 font-black">姓名</th>
                      <th className="px-3 py-2 font-black">班別</th>
                      <th className="px-3 py-2 font-black">次數</th>
                      <th className="px-3 py-2 font-black">
                        {leaderboardTab === 'best' ? '最佳分' : leaderboardTab === 'total' ? '總分' : '平均分'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardRows.length === 0 ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-gray-400 font-bold" colSpan={5}>
                          {leaderboardLoading ? '載入中...' : '暫時沒有紀錄'}
                        </td>
                      </tr>
                    ) : (
                      leaderboardRows.map((r: any, idx: number) => (
                        <tr key={`${r.studentId}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2 font-black text-brand-brown">{idx + 1}</td>
                          <td className="px-3 py-2 font-bold text-gray-800">{r.name || r.username || '—'}</td>
                          <td className="px-3 py-2 font-bold text-gray-600">{r.className || '—'}</td>
                          <td className="px-3 py-2 font-bold text-gray-700">{r.attempts || 0}</td>
                          <td className="px-3 py-2 font-black text-gray-900">
                            {leaderboardTab === 'best'
                              ? `${Math.round(Number(r.bestScore) || 0)}%`
                              : leaderboardTab === 'total'
                                ? `${Number(r.totalScore) || 0}`
                                : `${Math.round(Number(r.averageScore) || 0)}%`}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {phase === 'playing' && (
            <div className="space-y-4">
              <div className="bg-white border-4 border-brand-brown rounded-3xl p-4 shadow-comic flex items-center justify-between">
                <div className="font-black text-brand-brown">
                  第 {questionIndex + 1} / {total} 題
                </div>
                {timeLimitSeconds ? (
                  <div className={`px-3 py-1 rounded-2xl border-2 font-black ${timeLeft !== null && timeLeft <= 10 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                    剩餘：{timeLeft ?? 0}s
                  </div>
                ) : (
                  <div className="px-3 py-1 rounded-2xl border-2 bg-gray-50 border-gray-200 text-gray-600 font-black">不限時</div>
                )}
              </div>

              <div className="bg-white border-4 border-brand-brown rounded-3xl p-6 shadow-comic">
                <div className="text-sm font-black text-gray-600 mb-2">請選出正確答案：</div>
                <div className="text-2xl font-black text-brand-brown leading-snug">{current?.question || '—'}</div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(current?.options || []).map((opt, i) => {
                    const selected = answers[questionIndex] === i;
                    return (
                      <button
                        key={`${questionIndex}-${i}`}
                        type="button"
                        onClick={() => {
                          setAnswers((prev) => {
                            const next = [...prev];
                            next[questionIndex] = i;
                            return next;
                          });
                        }}
                        className={`p-4 rounded-2xl border-4 text-left font-bold shadow-comic active:translate-y-1 active:shadow-none transition-colors ${selected ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown' : 'bg-white border-gray-300 text-gray-700 hover:border-brand-brown hover:bg-yellow-50'}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 font-black ${selected ? 'border-brand-brown bg-brand-brown text-white' : 'border-gray-400 text-gray-600'}`}>
                            {String.fromCharCode(65 + i)}
                          </div>
                          <div className="flex-1">{opt}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setQuestionIndex((v) => Math.max(0, v - 1))}
                    disabled={questionIndex === 0}
                    className={`px-5 py-3 rounded-2xl border-4 font-black shadow-comic active:translate-y-1 active:shadow-none ${questionIndex === 0 ? 'bg-gray-200 border-gray-300 text-gray-500 cursor-not-allowed' : 'bg-white border-brand-brown text-brand-brown hover:bg-gray-50'}`}
                  >
                    上一題
                  </button>

                  <div className="flex-1 flex justify-center gap-1 flex-wrap">
                    {answers.map((a, idx) => (
                      <button
                        key={`dot-${idx}`}
                        type="button"
                        onClick={() => setQuestionIndex(idx)}
                        className={`w-7 h-7 rounded-full border-2 font-black text-xs ${idx === questionIndex ? 'bg-brand-brown text-white border-brand-brown' : a >= 0 ? 'bg-[#93C47D] text-brand-brown border-brand-brown' : 'bg-white text-gray-500 border-gray-300'}`}
                        title={`第 ${idx + 1} 題`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>

                  {questionIndex < total - 1 ? (
                    <button
                      type="button"
                      onClick={() => setQuestionIndex((v) => Math.min(total - 1, v + 1))}
                      className="px-5 py-3 rounded-2xl border-4 border-brand-brown bg-[#D2EFFF] text-brand-brown font-black hover:bg-[#BCE0FF] shadow-comic active:translate-y-1 active:shadow-none"
                    >
                      下一題
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={submit}
                      disabled={!canSubmit || submitting}
                      className={`px-5 py-3 rounded-2xl border-4 font-black shadow-comic active:translate-y-1 active:shadow-none ${!canSubmit ? 'bg-gray-200 border-gray-300 text-gray-500 cursor-not-allowed' : submitting ? 'bg-yellow-300 border-yellow-500 text-yellow-900 cursor-wait' : 'bg-[#F8C5C5] border-brand-brown text-brand-brown hover:bg-[#F0B5B5]'}`}
                    >
                      {submitting ? '提交中...' : '提交'}
                    </button>
                  )}
                </div>

                {!canSubmit && (
                  <div className="mt-4 text-center text-sm font-bold text-gray-600">
                    還有 {answers.filter((a) => a < 0).length} 題未作答
                  </div>
                )}
              </div>
            </div>
          )}

          {phase === 'result' && result && (
            <div className="bg-white border-4 border-brand-brown rounded-3xl p-6 shadow-comic">
              <div className="text-3xl font-black text-brand-brown mb-2">完成！</div>
              <div className="text-lg font-bold text-gray-700">
                得分：<span className="text-2xl font-black text-brand-brown">{Math.round(result.score)}%</span> • 正確：{result.correctAnswers}/{result.totalQuestions}
              </div>

              <div className="mt-6 flex flex-col md:flex-row gap-4">
                <button
                  type="button"
                  onClick={() => { setPhase('idle'); setLeaderboards(null); }}
                  className="flex-1 py-3 rounded-2xl border-4 border-brand-brown bg-[#93C47D] text-brand-brown font-black hover:bg-[#86b572] shadow-comic active:translate-y-1 active:shadow-none"
                >
                  再玩一次
                </button>
                <button
                  type="button"
                  onClick={() => setPhase('leaderboard')}
                  className="flex-1 py-3 rounded-2xl border-4 border-brand-brown bg-[#FDEEAD] text-brand-brown font-black hover:bg-[#FCE690] shadow-comic active:translate-y-1 active:shadow-none"
                >
                  查看排行榜
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black hover:bg-gray-50 shadow-comic active:translate-y-1 active:shadow-none"
                >
                  關閉
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
