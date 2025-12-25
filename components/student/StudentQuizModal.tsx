import React, { useEffect, useMemo, useState } from 'react';
import { X, CheckCircle2, XCircle, Clock, BarChart3 } from 'lucide-react';
import { authService } from '../../services/authService';
import { AiReportModal } from '../AiReportModal';

type Props = {
  open: boolean;
  quizId: string | null;
  onClose: () => void;
  onFinished?: () => void;
};

type QuizQuestion = {
  id?: string | number;
  question: string;
  image?: string | null;
  options: string[];
  correctAnswer?: number;
};

export function StudentQuizModal({ open, quizId, onClose, onFinished }: Props) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'take' | 'review'>('take');
  const [quiz, setQuiz] = useState<any | null>(null);
  const [studentResult, setStudentResult] = useState<any | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [submitResult, setSubmitResult] = useState<any | null>(null);
  const [showAiReport, setShowAiReport] = useState(false);
  const [aiReportLoading, setAiReportLoading] = useState(false);
  const [aiReportError, setAiReportError] = useState('');
  const [aiReport, setAiReport] = useState<any | null>(null);

  useEffect(() => {
    if (!open || !quizId) return;
    setLoading(true);
    setSubmitting(false);
    setError('');
    setQuiz(null);
    setStudentResult(null);
    setSubmitResult(null);
    setAnswers([]);
    setStartAt(Date.now());
    (async () => {
      try {
        const resp = await authService.getQuizForStudent(quizId);
        setMode(resp?.mode === 'review' ? 'review' : 'take');
        setQuiz(resp?.quiz || null);
        setStudentResult(resp?.studentResult || null);
        const qs = Array.isArray(resp?.quiz?.questions) ? resp.quiz.questions : [];
        if (resp?.mode === 'review' && resp?.studentResult?.answers && Array.isArray(resp.studentResult.answers)) {
          setAnswers(resp.studentResult.answers.map((x: any) => (Number.isInteger(Number(x)) ? Number(x) : -1)));
        } else {
          setAnswers(new Array(qs.length).fill(-1));
        }
      } catch (e: any) {
        setError(e?.message || '載入小測驗失敗');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, quizId]);

  const questions: QuizQuestion[] = useMemo(() => {
    const qs = Array.isArray(quiz?.questions) ? quiz.questions : [];
    return qs;
  }, [quiz]);

  const canSubmit = mode === 'take' && answers.length > 0 && answers.every((a) => Number.isInteger(a) && a >= 0);

  const submit = async () => {
    if (!quizId) return;
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const timeSpent = startAt ? Math.floor((Date.now() - startAt) / 1000) : undefined;
      const resp = await authService.submitQuizAnswer(quizId, answers, timeSpent);
      setSubmitResult(resp?.result || null);
      onFinished?.();
      // 轉為複習模式：重新載入含正確答案與作答記錄
      const detail = await authService.getQuizForStudent(quizId);
      setMode(detail?.mode === 'review' ? 'review' : 'take');
      setQuiz(detail?.quiz || null);
      setStudentResult(detail?.studentResult || null);
    } catch (e: any) {
      setError(e?.message || '提交失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const loadAiReport = async (refresh?: boolean) => {
    if (!quizId) return;
    setAiReportLoading(true);
    setAiReportError('');
    try {
      const resp = await authService.getQuizAiReport(quizId, { refresh: !!refresh });
      setAiReport(resp?.report || null);
      setShowAiReport(true);
    } catch (e: any) {
      setAiReportError(e?.message || '載入 AI 報告失敗');
      setShowAiReport(true);
    } finally {
      setAiReportLoading(false);
    }
  };

  if (!open || !quizId) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4">
        <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-hidden shadow-comic flex flex-col">
          <div className="p-5 border-b-4 border-brand-brown bg-[#D2EFFF] flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-2xl font-black text-brand-brown truncate">{quiz?.title || '小測驗'}</div>
              <div className="text-sm text-gray-700 font-bold mt-1">
                {mode === 'review' ? '複習模式' : '作答模式'} • {questions.length} 題
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center flex-shrink-0"
              aria-label="關閉"
            >
              <X className="w-6 h-6 text-brand-brown" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 bg-brand-cream">
            {loading && (
              <div className="text-center py-10 font-bold text-gray-700">載入中...</div>
            )}
            {!loading && error && (
              <div className="mb-4 bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-red-800 font-bold">
                {error}
              </div>
            )}
            {!loading && submitResult && (
              <div className="mb-4 bg-green-50 border-2 border-green-200 rounded-2xl p-4 text-green-900 font-bold flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                已提交：{Math.round(Number(submitResult.score) || 0)} 分
              </div>
            )}

            {!loading && questions.length === 0 && (
              <div className="text-center py-10 text-gray-600 font-bold">此小測驗沒有題目</div>
            )}

            {!loading && questions.length > 0 && (
              <div className="space-y-5">
                {questions.map((q, idx) => {
                  const selected = Number.isInteger(answers[idx]) ? answers[idx] : -1;
                  const correct = Number.isInteger(q.correctAnswer) ? Number(q.correctAnswer) : null;
                  const showCorrect = mode === 'review' && correct !== null;
                  return (
                    <div key={q.id ?? idx} className="bg-white border-4 border-brand-brown rounded-3xl p-4 shadow-comic">
                      <div className="font-black text-brand-brown mb-3">
                        第 {idx + 1} 題：{String(q.question || '')}
                      </div>
                      {q.image && (
                        <div className="mb-3">
                          <img src={q.image} alt="題目圖片" className="max-h-60 rounded-2xl border-2 border-brand-brown/30" />
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(Array.isArray(q.options) ? q.options : []).map((opt, optIdx) => {
                          const isSelected = selected === optIdx;
                          const isCorrect = showCorrect && correct === optIdx;
                          const isWrongSelected = showCorrect && isSelected && correct !== optIdx;
                          return (
                            <button
                              key={optIdx}
                              type="button"
                              disabled={mode === 'review'}
                              onClick={() => {
                                if (mode !== 'take') return;
                                setAnswers(prev => {
                                  const next = [...prev];
                                  next[idx] = optIdx;
                                  return next;
                                });
                              }}
                              className={[
                                'text-left px-4 py-3 rounded-2xl border-4 font-bold shadow-comic active:translate-y-1 active:shadow-none transition-all',
                                mode === 'review' ? 'cursor-default' : 'hover:-translate-y-1',
                                isCorrect ? 'bg-green-100 border-green-600 text-green-900' : '',
                                isWrongSelected ? 'bg-red-100 border-red-600 text-red-900' : '',
                                !isCorrect && !isWrongSelected && isSelected ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown' : 'bg-white border-brand-brown text-gray-800'
                              ].filter(Boolean).join(' ')}
                            >
                              <div className="flex items-center gap-2">
                                {isCorrect && <CheckCircle2 className="w-5 h-5" />}
                                {isWrongSelected && <XCircle className="w-5 h-5" />}
                                <span>{opt}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-4 border-t-4 border-brand-brown bg-white flex items-center justify-between gap-3">
            <div className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {mode === 'review'
                ? `分數：${Math.round(Number(studentResult?.score) || 0)}`
                : `已作答：${answers.filter((a) => Number.isInteger(a) && a >= 0).length} / ${answers.length}`}
            </div>
            <div className="flex gap-2">
              {mode === 'review' && (
                <button
                  type="button"
                  onClick={() => loadAiReport(false)}
                  className="px-4 py-2 rounded-2xl bg-[#D2EFFF] border-4 border-brand-brown text-brand-brown font-black hover:bg-white shadow-comic active:translate-y-1 active:shadow-none"
                >
                  AI 報告
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-2xl bg-white border-4 border-brand-brown text-brand-brown font-black hover:bg-gray-100 shadow-comic active:translate-y-1 active:shadow-none"
              >
                關閉
              </button>
              {mode === 'take' && (
                <button
                  type="button"
                  onClick={submit}
                  disabled={!canSubmit || submitting}
                  className={[
                    'px-4 py-2 rounded-2xl border-4 border-brand-brown font-black shadow-comic active:translate-y-1 active:shadow-none',
                    submitting || !canSubmit ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-[#93C47D] text-brand-brown hover:bg-[#86b572]'
                  ].join(' ')}
                >
                  {submitting ? '提交中...' : '提交'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <AiReportModal
        open={showAiReport}
        title="小測驗 AI 報告"
        loading={aiReportLoading}
        error={aiReportError}
        report={aiReport}
        onClose={() => setShowAiReport(false)}
        onRegenerate={mode === 'review' ? () => loadAiReport(true) : undefined}
      />
    </>
  );
}
