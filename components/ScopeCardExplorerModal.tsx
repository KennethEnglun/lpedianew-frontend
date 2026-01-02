import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, X, Users, User } from 'lucide-react';
import { authService } from '../services/authService';
import type { StudyAnalytics } from '../types/study';
import { StudyAnalyticsModal } from './student/StudyAnalyticsModal';

type ScopeCard = {
  cardId: string;
  subject: string;
  className: string;
  folderSnapshot?: any;
  folderPathLabel?: string;
  scopeText?: string;
  counts?: { quizzes?: number; contests?: number };
  lastTaskAt?: string | null;
};

type StudentLite = {
  id: string;
  username: string;
  profile?: { name?: string; class?: string };
};

interface ScopeCardExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ScopeCardExplorerModal: React.FC<ScopeCardExplorerModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scopeCards, setScopeCards] = useState<ScopeCard[]>([]);

  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<StudyAnalytics | null>(null);
  const [activeFetch, setActiveFetch] = useState<{ cardId: string; scope: 'overall' | 'student'; studentId?: string } | null>(null);

  const [pickStudentOpen, setPickStudentOpen] = useState(false);
  const [pickStudentCard, setPickStudentCard] = useState<ScopeCard | null>(null);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setLoading(true);
    authService
      .getScopeCards()
      .then((data) => {
        setScopeCards(Array.isArray(data.scopeCards) ? data.scopeCards : []);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : '載入失敗');
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  const closeAll = () => {
    setPickStudentOpen(false);
    setPickStudentCard(null);
    setSelectedStudentId('');
  };

  const handleClose = () => {
    closeAll();
    onClose();
  };

  const openReport = (params: { cardId: string; scope: 'overall' | 'student'; studentId?: string }) => {
    setAnalyticsData(null);
    setActiveFetch(params);
    setError('');
    setAnalyticsOpen(true);
  };

  const loadReport = async () => {
    if (!activeFetch) return;
    const { cardId, scope, studentId } = activeFetch;
    const res = await authService.getScopeCardAiReport(cardId, { scope, studentId });
    setAnalyticsData(res.report as StudyAnalytics);
  };

  const regenerateReport = async () => {
    if (!activeFetch) return;
    const { cardId, scope, studentId } = activeFetch;
    const res = await authService.regenerateScopeCardAiReport(cardId, { scope, studentId });
    setAnalyticsData(res.report as StudyAnalytics);
  };

  const openPickStudent = async (card: ScopeCard) => {
    setPickStudentCard(card);
    setSelectedStudentId('');
    setPickStudentOpen(true);
    setStudents([]);
    setStudentsLoading(true);
    try {
      const roster = await authService.getStudentRoster({ class: card.className, limit: 2000 });
      setStudents((roster.users || []).filter((u: any) => u?.role === 'student') as any);
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入學生名單失敗');
    } finally {
      setStudentsLoading(false);
    }
  };

  const canOpenStudentReport = useMemo(() => !!pickStudentCard && !!selectedStudentId, [pickStudentCard, selectedStudentId]);

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={handleClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border-4 border-brand-brown shadow-comic w-full max-w-5xl max-h-[90vh] overflow-hidden">
          <div className="bg-brand-brown text-white p-6 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-6 h-6" />
              <div>
                <h2 className="text-2xl font-bold">學生學習分析</h2>
                <p className="text-sm opacity-90">同一範圍（folder + 範圍文字）聚合多份小測驗/問答比賽</p>
              </div>
            </div>
            <button onClick={handleClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            {error ? (
              <div className="mb-4 p-3 rounded-2xl border-2 border-red-200 bg-red-50 text-red-700 font-bold">{error}</div>
            ) : null}

            {loading ? (
              <div className="text-center py-10 text-gray-600 font-bold">載入中…</div>
            ) : scopeCards.length === 0 ? (
              <div className="text-center py-10 text-gray-600 font-bold">暫無範圍卡</div>
            ) : (
              <div className="space-y-4">
                {scopeCards.map((card) => (
                  <div key={card.cardId} className="bg-white rounded-2xl p-5 shadow-comic border-2 border-gray-100">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-bold text-brand-brown text-lg truncate">
                          {card.subject} - {card.className} {card.folderPathLabel ? `（${card.folderPathLabel}）` : ''}
                        </div>
                        <div className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-2">
                          {String(card.scopeText || '').trim() || '（未填寫範圍文字）'}
                        </div>
                        <div className="mt-2 text-sm text-gray-600 flex flex-wrap gap-4">
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            小測驗：{Number(card.counts?.quizzes || 0)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            問答比賽：{Number(card.counts?.contests || 0)}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-3 flex-shrink-0">
                        <button
                          className="px-4 py-2 rounded-2xl border-2 border-brand-brown bg-brand-cream font-bold hover:bg-brand-yellow/30 transition-colors"
                          onClick={() => openReport({ cardId: card.cardId, scope: 'overall' })}
                        >
                          全體分析
                        </button>
                        <button
                          className="px-4 py-2 rounded-2xl border-2 border-brand-brown bg-white font-bold hover:bg-gray-50 transition-colors flex items-center gap-2"
                          onClick={() => openPickStudent(card)}
                        >
                          <User className="w-4 h-4" />
                          單一學生
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pick student dialog */}
      {pickStudentOpen && pickStudentCard ? (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-40 z-[60]" onClick={closeAll} />
          <div className="fixed inset-0 z-[61] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border-4 border-brand-brown shadow-comic w-full max-w-xl overflow-hidden">
              <div className="bg-brand-brown text-white p-5 flex justify-between items-center">
                <div className="font-bold text-lg">選擇學生（{pickStudentCard.className}）</div>
                <button onClick={closeAll} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                {studentsLoading ? (
                  <div className="text-center py-6 text-gray-600 font-bold">載入學生名單…</div>
                ) : (
                  <select
                    className="w-full px-4 py-2 border-4 border-brand-brown rounded-2xl bg-white font-bold"
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                  >
                    <option value="">請選擇學生</option>
                    {students.map((s) => (
                      <option key={String((s as any).id)} value={String((s as any).id)}>
                        {String((s as any).profile?.name || (s as any).username || '學生')}
                      </option>
                    ))}
                  </select>
                )}

                <div className="flex justify-end gap-3">
                  <button
                    className="px-4 py-2 rounded-2xl border-2 border-brand-brown bg-white font-bold hover:bg-gray-50 transition-colors"
                    onClick={closeAll}
                  >
                    取消
                  </button>
                  <button
                    className={`px-4 py-2 rounded-2xl border-2 border-brand-brown font-bold transition-colors flex items-center gap-2 ${
                      canOpenStudentReport ? 'bg-brand-cream hover:bg-brand-yellow/30' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={!canOpenStudentReport}
                    onClick={() => {
                      if (!pickStudentCard) return;
                      const sid = selectedStudentId;
                      closeAll();
                      openReport({ cardId: pickStudentCard.cardId, scope: 'student', studentId: sid });
                    }}
                  >
                    <BarChart3 className="w-4 h-4" />
                    查看分析
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      <StudyAnalyticsModal
        isOpen={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
        analytics={analyticsData}
        onLoadAnalytics={activeFetch ? loadReport : undefined}
        onRegenerateAnalytics={activeFetch ? regenerateReport : undefined}
      />
    </>,
    document.body
  );
};
