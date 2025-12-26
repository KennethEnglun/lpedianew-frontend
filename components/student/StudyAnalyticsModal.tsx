/**
 * AI分析報告模態框組件
 * 顯示學生學習分析報告和個性化建議
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Brain,
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  Award,
  BookOpen,
  BarChart3,
  Lightbulb,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import type { StudyAnalytics, TopicMastery } from '../../types/study';
import { formatUtils } from '../../utils/studyUtils';
import { StudyProgressChart } from './StudyProgressChart';

interface StudyAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  analytics: StudyAnalytics | null;
  onRegenerateAnalytics?: () => void;
}

export const StudyAnalyticsModal: React.FC<StudyAnalyticsModalProps> = ({
  isOpen,
  onClose,
  analytics,
  onRegenerateAnalytics
}) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'topics' | 'trends' | 'recommendations'>('overview');
  const hasAutoRegeneratedRef = useRef(false);

  const handleRegenerateAnalytics = async () => {
    if (!onRegenerateAnalytics) return;
    setLoading(true);
    try {
      await onRegenerateAnalytics();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      hasAutoRegeneratedRef.current = false;
      return;
    }
    if (!onRegenerateAnalytics) return;
    if (hasAutoRegeneratedRef.current) return;
    hasAutoRegeneratedRef.current = true;
    void handleRegenerateAnalytics();
  }, [isOpen, onRegenerateAnalytics]);

  if (!isOpen) return null;

  const getMasteryLevelText = (level: 'weak' | 'average' | 'strong') => {
    switch (level) {
      case 'weak': return '需加強';
      case 'average': return '良好';
      case 'strong': return '優秀';
      default: return '未知';
    }
  };

  const getMasteryIcon = (level: 'weak' | 'average' | 'strong') => {
    switch (level) {
      case 'weak': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'average': return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'strong': return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* 總體統計卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-brand-blue/10 rounded-2xl p-4 text-center">
          <BookOpen className="w-8 h-8 mx-auto mb-2 text-brand-brown" />
          <div className="text-2xl font-bold text-brand-brown">{analytics?.totalSessions}</div>
          <div className="text-sm text-gray-600">練習次數</div>
        </div>
        <div className="bg-brand-green/10 rounded-2xl p-4 text-center">
          <Target className="w-8 h-8 mx-auto mb-2 text-brand-brown" />
          <div className="text-2xl font-bold text-brand-brown">{analytics?.totalQuestions}</div>
          <div className="text-sm text-gray-600">總題數</div>
        </div>
        <div className="bg-brand-yellow/10 rounded-2xl p-4 text-center">
          <TrendingUp className="w-8 h-8 mx-auto mb-2 text-brand-brown" />
          <div className="text-2xl font-bold text-brand-brown">
            {analytics ? formatUtils.formatAccuracy(analytics.overallAccuracy) : '0%'}
          </div>
          <div className="text-sm text-gray-600">總正確率</div>
        </div>
        <div className="bg-brand-pink/10 rounded-2xl p-4 text-center">
          <Award className="w-8 h-8 mx-auto mb-2 text-brand-brown" />
          <div className="text-2xl font-bold text-brand-brown">
            {analytics ? Math.round(analytics.averageScore) : 0}
          </div>
          <div className="text-sm text-gray-600">平均分數</div>
        </div>
      </div>

      {/* 優勢與弱項 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 優勢知識點 */}
        <div className="bg-green-50 rounded-2xl p-6 border-2 border-green-200">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <h3 className="text-lg font-bold text-green-800">優勢知識點</h3>
          </div>
          {analytics?.strengths.length ? (
            <div className="space-y-2">
              {analytics.strengths.slice(0, 5).map((topic, index) => (
                <div key={index} className="bg-white rounded-lg p-3 border border-green-200">
                  <div className="font-medium text-green-800">{topic}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-green-600">需要更多練習來識別優勢</p>
          )}
        </div>

        {/* 待加強知識點 */}
        <div className="bg-red-50 rounded-2xl p-6 border-2 border-red-200">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <h3 className="text-lg font-bold text-red-800">待加強知識點</h3>
          </div>
          {analytics?.weaknesses.length ? (
            <div className="space-y-2">
              {analytics.weaknesses.slice(0, 5).map((topic, index) => (
                <div key={index} className="bg-white rounded-lg p-3 border border-red-200">
                  <div className="font-medium text-red-800">{topic}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-red-600">表現良好，無明顯弱項</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderTopicsTab = () => (
    <div className="space-y-4">
      {analytics?.topicMasteries.length ? (
        analytics.topicMasteries.map((mastery: TopicMastery, index: number) => (
          <div key={index} className="bg-white rounded-2xl p-6 shadow-comic border-2 border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {getMasteryIcon(mastery.masteryLevel)}
                <h3 className="text-lg font-bold text-brand-brown">{mastery.topic}</h3>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${formatUtils.getMasteryColor(mastery.masteryLevel)}`}>
                {getMasteryLevelText(mastery.masteryLevel)}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-500">練習題數</div>
                <div className="font-bold text-brand-brown">{mastery.totalQuestions} 題</div>
              </div>
              <div>
                <div className="text-gray-500">正確率</div>
                <div className="font-bold text-brand-brown">{formatUtils.formatAccuracy(mastery.accuracy)}</div>
              </div>
              <div>
                <div className="text-gray-500">平均用時</div>
                <div className="font-bold text-brand-brown">{formatUtils.formatDuration(mastery.averageTime)}</div>
              </div>
              <div>
                <div className="text-gray-500">最後練習</div>
                <div className="font-bold text-brand-brown">{formatUtils.formatDate(mastery.lastPracticed)}</div>
              </div>
            </div>

            {/* 進度條 */}
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-500 mb-2">
                <span>掌握程度</span>
                <span>{formatUtils.formatAccuracy(mastery.accuracy)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-300 ${
                    mastery.masteryLevel === 'strong' ? 'bg-green-500' :
                    mastery.masteryLevel === 'average' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(mastery.accuracy * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-8 text-gray-500">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>暫無知識點分析數據</p>
        </div>
      )}
    </div>
  );

  const renderTrendsTab = () => (
    <div className="space-y-6">
      {analytics && analytics.progressTrend.length > 0 ? (
        <StudyProgressChart analytics={analytics} />
      ) : (
        <div className="text-center py-8 text-gray-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>需要更多練習記錄來顯示趨勢分析</p>
        </div>
      )}
    </div>
  );

  const renderRecommendationsTab = () => (
    <div className="space-y-6">
      {/* AI建議 */}
      <div className="bg-brand-cream rounded-2xl p-6 shadow-comic">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-6 h-6 text-brand-brown" />
          <h3 className="text-lg font-bold text-brand-brown">AI智能建議</h3>
        </div>
        <div className="space-y-3">
          {analytics?.recommendations.map((recommendation, index) => (
            <div key={index} className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
              <p className="text-gray-700">{recommendation}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 推薦練習 */}
      {analytics?.suggestedTopics.length ? (
        <div className="bg-blue-50 rounded-2xl p-6 border-2 border-blue-200">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-bold text-blue-800">建議加強練習</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analytics.suggestedTopics.map((topic, index) => (
              <div key={index} className="bg-white rounded-lg p-3 border border-blue-200">
                <div className="font-medium text-blue-800">{topic}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* 學習建議 */}
      <div className="bg-yellow-50 rounded-2xl p-6 border-2 border-yellow-200">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-6 h-6 text-yellow-600" />
          <h3 className="text-lg font-bold text-yellow-800">學習建議</h3>
        </div>
        <div className="space-y-3 text-yellow-800">
          <p>📅 建議每天練習 15-30 分鐘，保持學習連續性</p>
          <p>🎯 重點關注正確率低於 70% 的知識點</p>
          <p>🔄 定期回顧之前的錯誤題目，鞏固記憶</p>
          {analytics?.estimatedStudyTime ? (
            <p>⏰ 預估需要 {analytics.estimatedStudyTime} 小時來提升弱項知識點</p>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-comic-xl">
        {/* 標題欄 */}
        <div className="bg-brand-brown text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">AI學習分析報告</h2>
              <p className="text-brand-cream/80">
                {analytics?.studentName} - {analytics?.subject}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-brown"></div>
            <span className="ml-4 text-brand-brown">正在生成分析報告...</span>
          </div>
        ) : analytics ? (
          <>
            {/* 選項卡 */}
            <div className="border-b border-gray-200">
              <div className="flex overflow-x-auto">
                {[
                  { id: 'overview', label: '總覽', icon: BarChart3 },
                  { id: 'topics', label: '知識點分析', icon: BookOpen },
                  { id: 'trends', label: '進度趨勢', icon: TrendingUp },
                  { id: 'recommendations', label: '學習建議', icon: Lightbulb }
                ].map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 px-6 py-4 font-medium transition-all whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'text-brand-brown border-b-2 border-brand-brown bg-brand-cream/30'
                          : 'text-gray-600 hover:text-brand-brown hover:bg-brand-cream/20'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 內容區域 */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {activeTab === 'overview' && renderOverviewTab()}
              {activeTab === 'topics' && renderTopicsTab()}
              {activeTab === 'trends' && renderTrendsTab()}
              {activeTab === 'recommendations' && renderRecommendationsTab()}
            </div>

            {/* 底部信息 */}
            <div className="bg-gray-50 px-6 py-4 text-center text-sm text-gray-500">
              分析報告生成時間: {analytics?.analysisDate ? formatUtils.formatDate(analytics.analysisDate) : ''}
            </div>
          </>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>無法載入分析數據</p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
