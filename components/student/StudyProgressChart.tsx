/**
 * 學習進度圖表組件
 * 顯示學習趨勢和統計圖表
 */

import React from 'react';
import { TrendingUp, TrendingDown, BarChart3, Target } from 'lucide-react';
import type { StudyAnalytics } from '../../types/study';
import { formatUtils } from '../../utils/studyUtils';

interface StudyProgressChartProps {
  analytics: StudyAnalytics;
}

export const StudyProgressChart: React.FC<StudyProgressChartProps> = ({ analytics }) => {
  const { progressTrend, topicMasteries } = analytics;

  // 計算趨勢
  const getScoreTrend = () => {
    if (progressTrend.length < 2) return 'stable';
    const recent = progressTrend.slice(-3);
    const avg = recent.reduce((sum, score) => sum + score, 0) / recent.length;
    const earlier = progressTrend.slice(0, progressTrend.length - 3);
    const earlierAvg = earlier.length > 0 ? earlier.reduce((sum, score) => sum + score, 0) / earlier.length : avg;

    if (avg > earlierAvg + 5) return 'up';
    if (avg < earlierAvg - 5) return 'down';
    return 'stable';
  };

  const getAccuracyTrend = () => {
    if (analytics.accuracyTrend.length < 2) return 'stable';
    const recent = analytics.accuracyTrend.slice(-3);
    const avg = recent.reduce((sum, acc) => sum + acc, 0) / recent.length;
    const earlier = analytics.accuracyTrend.slice(0, analytics.accuracyTrend.length - 3);
    const earlierAvg = earlier.length > 0 ? earlier.reduce((sum, acc) => sum + acc, 0) / earlier.length : avg;

    if (avg > earlierAvg + 0.05) return 'up';
    if (avg < earlierAvg - 0.05) return 'down';
    return 'stable';
  };

  const scoreTrend = getScoreTrend();
  const accuracyTrendState = getAccuracyTrend();

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-5 h-5 text-red-500" />;
      default:
        return <BarChart3 className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTrendText = (trend: string) => {
    switch (trend) {
      case 'up': return '進步中';
      case 'down': return '需注意';
      default: return '穩定';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // 簡易圖表組件
  const SimpleChart: React.FC<{ data: number[]; label: string; color: string; isPercentage?: boolean }> = ({
    data,
    label,
    color,
    isPercentage = false
  }) => {
    if (data.length === 0) return null;

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    return (
      <div className="space-y-3">
        <h4 className="font-medium text-gray-700">{label}</h4>
        <div className="flex items-end gap-1 h-24 bg-gray-50 rounded-lg p-2">
          {data.map((value, index) => {
            const height = range > 0 ? ((value - min) / range) * 80 : 20;
            return (
              <div
                key={index}
                className="flex-1 flex flex-col items-center"
                style={{ minHeight: '20px' }}
              >
                <div
                  className={`w-full ${color} rounded-sm transition-all duration-300 relative group`}
                  style={{ height: `${Math.max(height, 4)}px` }}
                >
                  {/* 工具提示 */}
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {isPercentage ? formatUtils.formatAccuracy(value) : Math.round(value)}
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {index + 1}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>{isPercentage ? formatUtils.formatAccuracy(min) : Math.round(min)}</span>
          <span>{isPercentage ? formatUtils.formatAccuracy(max) : Math.round(max)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 趨勢總結卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-comic border-2 border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-brand-brown">分數趨勢</h3>
            <div className="flex items-center gap-2">
              {getTrendIcon(scoreTrend)}
              <span className={`text-sm font-medium ${getTrendColor(scoreTrend)}`}>
                {getTrendText(scoreTrend)}
              </span>
            </div>
          </div>
          <div className="text-2xl font-bold text-brand-brown">
            {progressTrend.length > 0 ? Math.round(progressTrend[progressTrend.length - 1]) : 0}分
          </div>
          <div className="text-sm text-gray-500">最近一次練習</div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-comic border-2 border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-brand-brown">正確率趨勢</h3>
            <div className="flex items-center gap-2">
              {getTrendIcon(accuracyTrendState)}
              <span className={`text-sm font-medium ${getTrendColor(accuracyTrendState)}`}>
                {getTrendText(accuracyTrendState)}
              </span>
            </div>
          </div>
          <div className="text-2xl font-bold text-brand-brown">
            {analytics.accuracyTrend.length > 0
              ? formatUtils.formatAccuracy(analytics.accuracyTrend[analytics.accuracyTrend.length - 1])
              : '0%'
            }
          </div>
          <div className="text-sm text-gray-500">最近一次練習</div>
        </div>
      </div>

      {/* 進度圖表 */}
      <div className="bg-white rounded-2xl p-6 shadow-comic border-2 border-gray-100">
        <h3 className="text-lg font-bold text-brand-brown mb-6">練習進度圖表</h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <SimpleChart
            data={progressTrend}
            label="分數變化 (最近10次)"
            color="bg-blue-500"
          />
          <SimpleChart
            data={analytics.accuracyTrend}
            label="正確率變化 (最近10次)"
            color="bg-green-500"
            isPercentage={true}
          />
        </div>

        {progressTrend.length > 0 && (
          <div className="mt-6 text-sm text-gray-500">
            <p>📊 圖表顯示最近 {progressTrend.length} 次練習的表現趨勢</p>
            <p>💡 將鼠標懸停在柱狀圖上查看具體數值</p>
          </div>
        )}
      </div>

      {/* 知識點掌握度分佈 */}
      <div className="bg-white rounded-2xl p-6 shadow-comic border-2 border-gray-100">
        <h3 className="text-lg font-bold text-brand-brown mb-6">知識點掌握度分佈</h3>

        {topicMasteries.length > 0 ? (
          <div className="space-y-4">
            {/* 掌握度統計 */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <div className="text-2xl font-bold text-green-600">
                  {topicMasteries.filter(t => t.masteryLevel === 'strong').length}
                </div>
                <div className="text-sm text-green-600">優秀</div>
              </div>
              <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                <div className="text-2xl font-bold text-yellow-600">
                  {topicMasteries.filter(t => t.masteryLevel === 'average').length}
                </div>
                <div className="text-sm text-yellow-600">良好</div>
              </div>
              <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                <div className="text-2xl font-bold text-red-600">
                  {topicMasteries.filter(t => t.masteryLevel === 'weak').length}
                </div>
                <div className="text-sm text-red-600">需加強</div>
              </div>
            </div>

            {/* 掌握度進度條 */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-700">各知識點掌握情況</h4>
              {topicMasteries.slice(0, 8).map((mastery, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">
                      {formatUtils.truncateText(mastery.topic, 25)}
                    </span>
                    <span className="text-brand-brown">
                      {formatUtils.formatAccuracy(mastery.accuracy)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        mastery.masteryLevel === 'strong' ? 'bg-green-500' :
                        mastery.masteryLevel === 'average' ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(mastery.accuracy * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>需要更多練習記錄來分析知識點掌握度</p>
          </div>
        )}
      </div>
    </div>
  );
};