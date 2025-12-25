/**
 * 學習歷史面板組件
 * 顯示學生所有練習記錄和統計資訊
 */

import React, { useState, useEffect } from 'react';
import { Calendar, BookOpen, TrendingUp, Clock, Target, BarChart3 } from 'lucide-react';
import type { StudySession, StudyAnalytics } from '../../types/study';
import { studyStorage, studyAnalytics, formatUtils } from '../../utils/studyUtils';

interface StudyHistoryPanelProps {
  studentId: string;
  studentName: string;
  onViewAnalytics: (analytics: StudyAnalytics) => void;
}

export const StudyHistoryPanel: React.FC<StudyHistoryPanelProps> = ({
  studentId,
  studentName,
  onViewAnalytics
}) => {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // 載入學習記錄
  useEffect(() => {
    const loadSessions = () => {
      const allSessions = studyStorage.getAllSessions(studentId);
      setSessions(allSessions);
      setLoading(false);
    };

    loadSessions();
  }, [studentId]);

  // 篩選會話
  const filteredSessions = selectedSubject === 'all'
    ? sessions
    : sessions.filter(session => session.scope.subject === selectedSubject);

  const completedSessions = filteredSessions.filter(session => session.completed);

  // 獲取所有科目
  const subjects = Array.from(new Set(sessions.map(s => s.scope.subject))).filter(Boolean);

  // 生成分析報告
  const handleGenerateAnalytics = () => {
    const analytics = studyAnalytics.generateStudyAnalytics(
      studentId,
      studentName,
      selectedSubject === 'all' ? undefined : selectedSubject
    );
    onViewAnalytics(analytics);
  };

  // 重新練習
  const handleRetrySession = (session: StudySession) => {
    // 創建新的學習會話，使用相同的學習範圍
    const newSession: StudySession = {
      id: `retry_${Date.now()}`,
      studentId: session.studentId,
      studentName: session.studentName,
      scope: { ...session.scope },
      questions: [],
      answers: [],
      score: 0,
      accuracy: 0,
      totalTimeSpent: 0,
      startTime: new Date().toISOString(),
      endTime: null,
      completed: false,
      createdAt: new Date().toISOString()
    };

    // 這裡可以觸發重新開始練習的邏輯
    console.log('重新練習:', newSession);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-brown"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 頭部統計 */}
      <div className="bg-brand-cream rounded-2xl p-6 shadow-comic">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-brand-brown">
              {completedSessions.length}
            </div>
            <div className="text-sm text-gray-600">完成練習</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-brand-brown">
              {completedSessions.reduce((sum, s) => sum + s.questions.length, 0)}
            </div>
            <div className="text-sm text-gray-600">總題數</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-brand-brown">
              {completedSessions.length > 0
                ? formatUtils.formatAccuracy(
                    completedSessions.reduce((sum, s) => sum + s.accuracy, 0) / completedSessions.length
                  )
                : '0%'
              }
            </div>
            <div className="text-sm text-gray-600">平均正確率</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-brand-brown">
              {Math.round(completedSessions.reduce((sum, s) => sum + s.score, 0) / (completedSessions.length || 1))}
            </div>
            <div className="text-sm text-gray-600">平均分數</div>
          </div>
        </div>

        {/* 生成分析按鈕 */}
        <div className="mt-4 text-center">
          <button
            onClick={handleGenerateAnalytics}
            disabled={completedSessions.length === 0}
            className="bg-brand-green hover:bg-brand-green-dark text-white px-6 py-2 rounded-xl font-medium shadow-comic transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            生成AI分析報告
          </button>
        </div>
      </div>

      {/* 科目篩選 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedSubject('all')}
          className={`px-4 py-2 rounded-xl font-medium transition-all ${
            selectedSubject === 'all'
              ? 'bg-brand-brown text-white shadow-comic'
              : 'bg-white text-brand-brown border-2 border-brand-brown hover:bg-brand-cream'
          }`}
        >
          全部科目
        </button>
        {subjects.map(subject => (
          <button
            key={subject}
            onClick={() => setSelectedSubject(subject)}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              selectedSubject === subject
                ? 'bg-brand-brown text-white shadow-comic'
                : 'bg-white text-brand-brown border-2 border-brand-brown hover:bg-brand-cream'
            }`}
          >
            {subject}
          </button>
        ))}
      </div>

      {/* 學習記錄列表 */}
      <div className="space-y-4">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>還沒有學習記錄</p>
            <p className="text-sm">開始第一次練習吧！</p>
          </div>
        ) : (
          filteredSessions.map(session => (
            <div
              key={session.id}
              className="bg-white rounded-2xl p-6 shadow-comic border-2 border-brand-brown/10"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="w-5 h-5 text-brand-brown" />
                    <span className="font-bold text-brand-brown text-lg">
                      {session.scope.subject}
                    </span>
                    {!session.completed && (
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-lg text-xs font-medium">
                        進行中
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {formatUtils.formatDate(session.createdAt)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      {session.questions.length} 題
                    </div>
                    {session.completed && (
                      <>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          {formatUtils.formatAccuracy(session.accuracy)}
                        </div>
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4" />
                          {formatUtils.formatScore(session.score)}
                        </div>
                      </>
                    )}
                  </div>

                  {/* 學習範圍詳情 */}
                  <div className="mt-3 text-sm">
                    {session.scope.contentSource === 'custom' ? (
                      <div className="bg-brand-cream rounded-lg p-3">
                        <div className="font-medium text-brand-brown mb-1">自定義內容:</div>
                        <div className="text-gray-700 line-clamp-2">
                          {formatUtils.truncateText(session.scope.customContent || '', 100)}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-brand-cream rounded-lg p-3">
                        <div className="font-medium text-brand-brown mb-1">學習範圍:</div>
                        <div className="text-gray-700">
                          章節: {session.scope.chapters?.join('、') || '無'}
                        </div>
                        <div className="text-gray-700">
                          知識點: {session.scope.topics?.join('、') || '無'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 操作按鈕 */}
                <div className="flex flex-col sm:flex-row gap-2">
                  {session.completed && (
                    <button
                      onClick={() => handleRetrySession(session)}
                      className="bg-brand-blue hover:bg-blue-600 text-white px-4 py-2 rounded-xl font-medium transition-all transform hover:scale-105 inline-flex items-center gap-2"
                    >
                      <Clock className="w-4 h-4" />
                      重新練習
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};