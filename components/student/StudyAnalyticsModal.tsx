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
  FileText,
  BarChart3,
  Lightbulb,
  RefreshCw,
  Maximize2,
  Download,
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
  onLoadAnalytics?: () => void;
  onRegenerateAnalytics?: () => void;
}

export const StudyAnalyticsModal: React.FC<StudyAnalyticsModalProps> = ({
  isOpen,
  onClose,
  analytics,
  onLoadAnalytics,
  onRegenerateAnalytics
}) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'topics' | 'trends' | 'recommendations' | 'notes'>('overview');
  const hasAutoRegeneratedRef = useRef(false);
  const [autoRegenerateFailed, setAutoRegenerateFailed] = useState(false);
  const [mindMapFullscreen, setMindMapFullscreen] = useState(false);

  const handleLoadAnalytics = async () => {
    if (!onLoadAnalytics) return;
    setLoading(true);
    setAutoRegenerateFailed(false);
    try {
      await onLoadAnalytics();
    } catch {
      setAutoRegenerateFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateAnalytics = async () => {
    if (!onRegenerateAnalytics) return;
    setLoading(true);
    setAutoRegenerateFailed(false);
    try {
      await onRegenerateAnalytics();
    } catch {
      // Avoid unhandled promise rejections; parent components may surface errors separately.
      setAutoRegenerateFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      hasAutoRegeneratedRef.current = false;
      setAutoRegenerateFailed(false);
      setMindMapFullscreen(false);
      return;
    }
    if (analytics) return;
    if (hasAutoRegeneratedRef.current) return;
    hasAutoRegeneratedRef.current = true;
    if (onLoadAnalytics) {
      void handleLoadAnalytics();
      return;
    }
    if (onRegenerateAnalytics) {
      void handleRegenerateAnalytics();
    }
  }, [isOpen, analytics, onLoadAnalytics, onRegenerateAnalytics]);
  const downloadMindMapAsPng = async () => {
    const svgEl = (document.querySelector('svg[data-mindmap-svg="export"]') || document.querySelector('svg[data-mindmap-svg="fullscreen"]') || document.querySelector('svg[data-mindmap-svg="normal"]')) as SVGSVGElement | null;
    if (!svgEl) return;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgEl);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const vb = svgEl.viewBox?.baseVal;
    const width = (vb && vb.width) ? vb.width : Number(svgEl.getAttribute('width')) || 1200;
    const height = (vb && vb.height) ? vb.height : Number(svgEl.getAttribute('height')) || 620;
    const scale = 2;

    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(width * scale);
          canvas.height = Math.floor(height * scale);
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas not supported');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((png) => {
            if (!png) {
              reject(new Error('Failed to export PNG'));
              return;
            }
            const a = document.createElement('a');
            a.href = URL.createObjectURL(png);
            a.download = `mindmap-${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            resolve();
          }, 'image/png');
        } catch (e) {
          reject(e);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG for export'));
      };
      img.src = url;
    });
  };

  const downloadTextReport = () => {
    if (!analytics) return;

    const safeName = (s: string) => String(s || '').trim().replace(/[\\/:*?"<>|]/g, '_');
    const percent = (n: number) => `${(Math.max(0, Math.min(1, n)) * 100).toFixed(1)}%`;
    const masteryLabel = (level: TopicMastery['masteryLevel']) => {
      switch (level) {
        case 'strong': return '優秀';
        case 'average': return '良好';
        case 'weak': return '需加強';
        default: return '未知';
      }
    };

    const lines: string[] = [];
    lines.push('AI學習分析報告');
    lines.push('');
    lines.push(`學生：${analytics.studentName || ''}`);
    lines.push(`科目：${analytics.subject || ''}`);
    lines.push(`分析日期：${analytics.analysisDate ? formatUtils.formatDate(analytics.analysisDate) : ''}`);
    lines.push('');

    lines.push('一、總覽');
    lines.push(`- 練習次數：${analytics.totalSessions} 次`);
    lines.push(`- 總題數：${analytics.totalQuestions} 題`);
    lines.push(`- 總正確率：${percent(analytics.overallAccuracy)}`);
    lines.push(`- 平均分數：${Math.round(analytics.averageScore)} 分`);
    lines.push('');

    lines.push('二、AI智能建議');
    if (Array.isArray(analytics.recommendations) && analytics.recommendations.length > 0) {
      analytics.recommendations.slice(0, 12).forEach((r, idx) => lines.push(`${idx + 1}. ${String(r || '').trim()}`));
    } else {
      lines.push('（暫無）');
    }
    lines.push('');

    lines.push('三、建議加強練習');
    if (Array.isArray(analytics.suggestedTopics) && analytics.suggestedTopics.length > 0) {
      analytics.suggestedTopics.slice(0, 12).forEach((t) => lines.push(`- ${String(t || '').trim()}`));
    } else {
      lines.push('（暫無）');
    }
    if (analytics.estimatedStudyTime) {
      lines.push(`- 預估學習時間：${analytics.estimatedStudyTime} 小時`);
    }
    lines.push('');

    lines.push('四、知識點掌握（詳細）');
    if (Array.isArray(analytics.topicMasteries) && analytics.topicMasteries.length > 0) {
      analytics.topicMasteries.forEach((tm) => {
        lines.push(`- ${tm.topic}：${percent(tm.accuracy)}（${tm.correctAnswers}/${tm.totalQuestions}）｜掌握：${masteryLabel(tm.masteryLevel)}｜平均用時：${formatUtils.formatDuration(Math.round(tm.averageTime || 0))}`);
      });
    } else {
      lines.push('（暫無）');
    }
    lines.push('');

    lines.push('五、強項 / 弱項');
    lines.push(`- 優勢：${(Array.isArray(analytics.strengths) && analytics.strengths.length > 0) ? analytics.strengths.slice(0, 8).join('、') : '（未識別）'}`);
    lines.push(`- 待加強：${(Array.isArray(analytics.weaknesses) && analytics.weaknesses.length > 0) ? analytics.weaknesses.slice(0, 8).join('、') : '（無）'}`);
    lines.push('');

    lines.push('六、趨勢');
    if (Array.isArray(analytics.progressTrend) && analytics.progressTrend.length > 0) {
      lines.push(`- 分數趨勢（最近）：${analytics.progressTrend.slice(-10).map((n) => Math.round(Number(n))).join('、')}`);
    } else {
      lines.push('- 分數趨勢（最近）：（暫無）');
    }
    if (Array.isArray(analytics.accuracyTrend) && analytics.accuracyTrend.length > 0) {
      lines.push(`- 正確率趨勢（最近）：${analytics.accuracyTrend.slice(-10).map((n) => percent(Number(n))).join('、')}`);
    } else {
      lines.push('- 正確率趨勢（最近）：（暫無）');
    }
    lines.push('');

    lines.push('七、溫習筆記');
    const sections = analytics.revisionNotes?.sections || [];
    if (sections.length > 0) {
      const title = String(analytics.revisionNotes?.title || '').trim();
      if (title) lines.push(`標題：${title}`);
      sections.forEach((s) => {
        lines.push('');
        lines.push(`【${String(s?.title || '').trim()}】`);
        const bullets = Array.isArray(s?.bullets) ? s.bullets : [];
        bullets.filter(Boolean).forEach((b) => lines.push(`- ${String(b).trim()}`));
      });
      lines.push('');
    } else {
      lines.push('（暫無）');
      lines.push('');
    }

    const content = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName(`AI學習分析報告-${analytics.studentName || 'student'}-${Date.now()}`)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

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

  const truncateText = (text: string, max = 60) => {
    const s = String(text || '').trim();
    if (s.length <= max) return s;
    return `${s.slice(0, max)}…`;
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

      {/* 洞見摘要（全體/個人都可用） */}
      {analytics?.insights?.summary?.length ? (
        <div className="bg-white rounded-2xl p-5 border-2 border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-5 h-5 text-brand-brown" />
            <div className="text-lg font-black text-brand-brown">洞見摘要</div>
          </div>
          <ul className="space-y-2">
            {analytics.insights.summary.slice(0, 6).map((t, i) => (
              <li key={i} className="text-sm font-bold text-gray-700">• {t}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* 優勢與弱項 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 優勢知識點 */}
        <div className="bg-green-50 rounded-2xl p-6 border-2 border-green-200">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <h3 className="text-lg font-bold text-green-800">優勢知識點</h3>
          </div>
          {(analytics?.insights?.strengths?.length || analytics?.strengths.length) ? (
            <div className="space-y-2">
              {(analytics?.insights?.strengths?.length
                ? analytics.insights.strengths
                : analytics?.strengths?.slice(0, 5).map((t) => ({ topic: t, accuracy: null, totalQuestions: null }))
              )?.slice(0, 5).map((row: any, index: number) => (
                <div key={index} className="bg-white rounded-lg p-3 border border-green-200">
                  <div className="font-medium text-green-800" title={String(row.topic || '')}>
                    {truncateText(String(row.topic || ''), 60)}
                  </div>
                  {(typeof row.accuracy === 'number' && typeof row.totalQuestions === 'number') ? (
                    <div className="text-xs text-green-700 font-bold mt-1">
                      正確率 {formatUtils.formatAccuracy(row.accuracy)} ・ 題數 {row.totalQuestions}
                    </div>
                  ) : null}
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
          {(analytics?.insights?.weaknesses?.length || analytics?.weaknesses.length) ? (
            <div className="space-y-2">
              {(analytics?.insights?.weaknesses?.length
                ? analytics.insights.weaknesses
                : analytics?.weaknesses?.slice(0, 5).map((t) => ({ topic: t, accuracy: null, totalQuestions: null, weakQuestions: [] }))
              )?.slice(0, 5).map((row: any, index: number) => (
                <div key={index} className="bg-white rounded-lg p-3 border border-red-200">
                  <div className="font-medium text-red-800" title={String(row.topic || '')}>
                    {truncateText(String(row.topic || ''), 60)}
                  </div>
                  {(typeof row.accuracy === 'number' && typeof row.totalQuestions === 'number') ? (
                    <div className="text-xs text-red-700 font-bold mt-1">
                      正確率 {formatUtils.formatAccuracy(row.accuracy)} ・ 題數 {row.totalQuestions}
                    </div>
                  ) : null}
                  {Array.isArray(row.weakQuestions) && row.weakQuestions.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {row.weakQuestions.slice(0, 2).map((q: any, i: number) => (
                        <div key={i} className="text-xs text-gray-700 font-bold">
                          易錯題：{String(q?.question || '')}（錯誤率 {formatUtils.formatAccuracy(Number(q?.wrongRate || 0))}）
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-red-600">表現良好，無明顯弱項</p>
          )}
        </div>
      </div>

      {analytics?.insights?.polarizedTopics?.length ? (
        <div className="bg-white rounded-2xl p-5 border-2 border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-5 h-5 text-brand-brown" />
            <div className="text-lg font-black text-brand-brown">差異最大（適合分組教學）</div>
          </div>
          <div className="space-y-2">
            {analytics.insights.polarizedTopics.slice(0, 4).map((t, i) => (
              <div key={i} className="text-sm font-bold text-gray-700" title={String(t.topic || '')}>
                {truncateText(String(t.topic || ''), 60)}：{formatUtils.formatAccuracy(Number(t.minAccuracy || 0))}～{formatUtils.formatAccuracy(Number(t.maxAccuracy || 0))}（{Number(t.studentCount || 0)} 人）
              </div>
            ))}
          </div>
        </div>
      ) : null}
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
                <h3 className="text-lg font-bold text-brand-brown" title={String(mastery.topic || '')}>
                  {truncateText(String(mastery.topic || ''), 60)}
                </h3>
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

  const wrapText = (text: string, maxCharsPerLine = 8) => {
    const s = String(text || '');
    const lines: string[] = [];
    let buf = '';
    for (const ch of s) {
      buf += ch;
      if (buf.length >= maxCharsPerLine) {
        lines.push(buf);
        buf = '';
      }
    }
    if (buf) lines.push(buf);
    return lines.slice(0, 2);
  };

  const ellipsis = (text: string, maxLen: number) => {
    const s = String(text || '').trim();
    if (!s) return '';
    if (s.length <= maxLen) return s;
    return `${s.slice(0, Math.max(0, maxLen - 1))}…`;
  };

  const renderMindMap = () => {
    const sectionsRaw = analytics?.revisionNotes?.sections || [];
    const nodesAll = sectionsRaw
      .map((s) => ({
        title: String(s?.title || '').trim(),
        bullets: Array.isArray(s?.bullets) ? s.bullets.map((b) => String(b || '').trim()).filter(Boolean) : []
      }))
      .filter((s) => s.title);
    if (nodesAll.length === 0) return null;

    const centerLabel = String(analytics?.revisionNotes?.title || '').trim() || `${analytics?.subject || '溫習'}重點`;

    const palette = [
      { stroke: '#7C3AED', fill: '#F3E8FF' }, // purple
      { stroke: '#EF4444', fill: '#FEE2E2' }, // red
      { stroke: '#10B981', fill: '#D1FAE5' }, // green
      { stroke: '#F59E0B', fill: '#FEF3C7' }, // amber
      { stroke: '#3B82F6', fill: '#DBEAFE' }, // blue
      { stroke: '#EC4899', fill: '#FCE7F3' }  // pink
    ];

    const makeLayout = (variant: 'normal' | 'fullscreen' | 'export') => {
      const W = 1600;
      const padX = 60;
      const padY = 80;
      const centerGap = 130;

      const centerW = 260;
      const centerH = 70;

      const mainW = 220;
      const mainH = 66;
      const subW = 230;
      const subH = 54;
      const subDx = 240;
      const subGap = variant === 'normal' ? 70 : 78;
      const blockGap = variant === 'normal' ? 44 : 64;

      const maxMainNodes = variant === 'normal' ? 8 : 10;
      const nodes = nodesAll.slice(0, maxMainNodes);
      const left = nodes.filter((_, i) => i % 2 === 0);
      const right = nodes.filter((_, i) => i % 2 === 1);

      const bulletsFor = (b: string[], sideVariant: typeof variant) => {
        const limit = sideVariant === 'normal' ? 3 : 999;
        return (Array.isArray(b) ? b : []).slice(0, limit);
      };

      const blockHeight = (bulletsCount: number) => {
        const branchSpan = bulletsCount <= 0 ? mainH : Math.max(mainH, (bulletsCount - 1) * subGap + subH);
        return branchSpan + 30;
      };

      const totalHeight = (items: any[]) => {
        if (items.length === 0) return centerH;
        const heights = items.map((it) => blockHeight(bulletsFor(it.bullets, variant).length));
        return heights.reduce((a, b) => a + b, 0) + blockGap * Math.max(0, items.length - 1);
      };

      const contentH = Math.max(centerH, totalHeight(left), totalHeight(right), 560);
      const H = Math.ceil(contentH + padY * 2);
      const cx = W / 2;
      const cy = H / 2;

      const centerBox = { x: cx - centerW / 2, y: cy - centerH / 2, w: centerW, h: centerH };
      const leftXMin = padX + mainW / 2 + subDx + subW / 2;
      const rightXMax = W - leftXMin;
      const leftX = Math.max(leftXMin, centerBox.x - centerGap - mainW / 2);
      const rightX = Math.min(rightXMax, centerBox.x + centerBox.w + centerGap + mainW / 2);

      const placeSide = (items: any[], side: 'left' | 'right') => {
        const pos: Array<{ x: number; y: number }> = [];
        if (items.length === 0) return pos;
        const heights = items.map((it) => blockHeight(bulletsFor(it.bullets, variant).length));
        const total = heights.reduce((a, b) => a + b, 0) + blockGap * Math.max(0, items.length - 1);
        let y = cy - total / 2;
        for (let i = 0; i < items.length; i++) {
          y += heights[i] / 2;
          pos.push({ x: side === 'left' ? leftX : rightX, y });
          y += heights[i] / 2 + blockGap;
        }
        return pos;
      };

      const leftPos = placeSide(left, 'left');
      const rightPos = placeSide(right, 'right');

      const mainBoxAt = (p: { x: number; y: number }) => ({ x: p.x - mainW / 2, y: p.y - mainH / 2, w: mainW, h: mainH });

      const cubicPath = (from: { x: number; y: number }, to: { x: number; y: number }, bend: number) => {
        const dx = to.x - from.x;
        const c1 = { x: from.x + dx * bend, y: from.y };
        const c2 = { x: to.x - dx * bend, y: to.y };
        return `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`;
      };

      const shadowId = `shadow-${variant}`;
      const content = (
        <>
          <defs>
            <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.18" />
            </filter>
          </defs>

          <g filter={`url(#${shadowId})`}>
            <rect
              x={centerBox.x}
              y={centerBox.y}
              width={centerBox.w}
              height={centerBox.h}
              rx={24}
              fill="#111827"
              stroke="#111827"
              strokeWidth="3"
            />
            <text x={cx} y={cy + 7} textAnchor="middle" fontSize="20" fontWeight="700" fill="#FFFFFF">
              {ellipsis(centerLabel, 28)}
            </text>
          </g>

          {left.map((node, i) => {
            const p = leftPos[i];
            const box = mainBoxAt(p);
            const color = palette[i % palette.length];
            const from = { x: centerBox.x, y: cy };
            const to = { x: box.x + box.w, y: p.y };
            const path = cubicPath(from, to, 0.45);

            const bullets = bulletsFor(node.bullets, variant);
            const subStartY = p.y - (subGap * Math.max(0, bullets.length - 1)) / 2;

            return (
              <g key={`L-${variant}-${i}`}>
                <path d={path} fill="none" stroke={color.stroke} strokeWidth="5" strokeLinecap="round" />
                <g filter={`url(#${shadowId})`}>
                  <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={18} fill="#FFFFFF" stroke={color.stroke} strokeWidth="3" />
                  <text x={p.x} y={p.y + 7} textAnchor="middle" fontSize="15" fontWeight="700" fill="#111827">
                    {ellipsis(node.title, 18)}
                  </text>
                </g>

                {bullets.map((b: string, j: number) => {
                  const sy = subStartY + j * subGap;
                  const sx = box.x - subDx;
                  const subBox = { x: sx - subW / 2, y: sy - subH / 2, w: subW, h: subH };
                  const lineFrom = { x: box.x, y: sy };
                  const lineTo = { x: subBox.x + subBox.w, y: sy };
                  const subPath = cubicPath(lineFrom, lineTo, 0.25);
                  const lines = wrapText(b, 12);
                  return (
                    <g key={`L-${variant}-${i}-S-${j}`}>
                      <path d={subPath} fill="none" stroke={color.stroke} strokeWidth="3" strokeLinecap="round" opacity="0.95" />
                      <g filter={`url(#${shadowId})`}>
                        <rect x={subBox.x} y={subBox.y} width={subBox.w} height={subBox.h} rx={14} fill={color.fill} stroke={color.stroke} strokeWidth="2" />
                        <text x={sx} y={sy - (lines.length === 2 ? 6 : 0)} textAnchor="middle" fontSize="12" fontWeight="700" fill="#111827">
                          {lines.map((ln, idx) => (
                            <tspan key={idx} x={sx} dy={idx === 0 ? 0 : 16}>{ellipsis(ln, 14)}</tspan>
                          ))}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {right.map((node, i) => {
            const p = rightPos[i];
            const box = mainBoxAt(p);
            const color = palette[(i + 1) % palette.length];
            const from = { x: centerBox.x + centerBox.w, y: cy };
            const to = { x: box.x, y: p.y };
            const path = cubicPath(from, to, 0.45);

            const bullets = bulletsFor(node.bullets, variant);
            const subStartY = p.y - (subGap * Math.max(0, bullets.length - 1)) / 2;

            return (
              <g key={`R-${variant}-${i}`}>
                <path d={path} fill="none" stroke={color.stroke} strokeWidth="5" strokeLinecap="round" />
                <g filter={`url(#${shadowId})`}>
                  <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={18} fill="#FFFFFF" stroke={color.stroke} strokeWidth="3" />
                  <text x={p.x} y={p.y + 7} textAnchor="middle" fontSize="15" fontWeight="700" fill="#111827">
                    {ellipsis(node.title, 18)}
                  </text>
                </g>

                {bullets.map((b: string, j: number) => {
                  const sy = subStartY + j * subGap;
                  const sx = box.x + box.w + subDx;
                  const subBox = { x: sx - subW / 2, y: sy - subH / 2, w: subW, h: subH };
                  const lineFrom = { x: box.x + box.w, y: sy };
                  const lineTo = { x: subBox.x, y: sy };
                  const subPath = cubicPath(lineFrom, lineTo, 0.25);
                  const lines = wrapText(b, 12);
                  return (
                    <g key={`R-${variant}-${i}-S-${j}`}>
                      <path d={subPath} fill="none" stroke={color.stroke} strokeWidth="3" strokeLinecap="round" opacity="0.95" />
                      <g filter={`url(#${shadowId})`}>
                        <rect x={subBox.x} y={subBox.y} width={subBox.w} height={subBox.h} rx={14} fill={color.fill} stroke={color.stroke} strokeWidth="2" />
                        <text x={sx} y={sy - (lines.length === 2 ? 6 : 0)} textAnchor="middle" fontSize="12" fontWeight="700" fill="#111827">
                          {lines.map((ln, idx) => (
                            <tspan key={idx} x={sx} dy={idx === 0 ? 0 : 16}>{ellipsis(ln, 14)}</tspan>
                          ))}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </>
      );

      return { W, H, content, cx, cy };
    };

    const svg = (variant: 'normal' | 'fullscreen' | 'export') => {
      const layout = makeLayout(variant);
      return (
        <svg data-mindmap-svg={variant} width={layout.W} height={layout.H} viewBox={`0 0 ${layout.W} ${layout.H}`}>
          {layout.content}
        </svg>
      );
    };

    return (
      <div className="bg-white rounded-2xl p-4 border-2 border-gray-100">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="font-bold text-brand-brown flex items-center gap-2">
            <FileText className="w-5 h-5" />
            思維圖
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMindMapFullscreen(true)}
              className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
            >
              <Maximize2 className="w-4 h-4" />
              全螢幕
            </button>
            <button
              type="button"
              onClick={() => void downloadMindMapAsPng()}
              className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              另存圖片
            </button>
          </div>
        </div>
        <div className="w-full overflow-x-auto">
          {svg('normal')}
        </div>
        <div className="hidden">
          {svg('export')}
        </div>

        {mindMapFullscreen ? (
          <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full h-full max-w-[98vw] max-h-[96vh] overflow-hidden shadow-comic-xl border-4 border-brand-brown">
              <div className="bg-brand-brown text-white p-4 flex items-center justify-between">
                <div className="font-bold">{centerLabel}</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void downloadMindMapAsPng()}
                    className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded-xl font-bold inline-flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    另存圖片
                  </button>
                  <button
                    type="button"
                    onClick={() => setMindMapFullscreen(false)}
                    className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-all"
                    aria-label="關閉"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="w-full h-[calc(96vh-70px)] overflow-auto bg-white p-4">
                <div className="min-w-[1600px]">
                  {svg('fullscreen')}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const renderNotesTab = () => {
    const sections = analytics?.revisionNotes?.sections || [];
    if (!sections.length) {
      return (
        <div className="text-center py-8 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>暫無溫習筆記</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="bg-brand-cream rounded-2xl p-6 shadow-comic">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-6 h-6 text-brand-brown" />
            <h3 className="text-lg font-bold text-brand-brown">溫習筆記</h3>
          </div>
          <div className="space-y-5">
            {sections.map((s, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-4 border-2 border-gray-100">
                <div className="font-black text-brand-brown mb-2">{s.title}</div>
                <ul className="list-disc pl-6 space-y-1 text-gray-700">
                  {(Array.isArray(s.bullets) ? s.bullets : []).map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        {renderMindMap()}
      </div>
    );
  };

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
              type="button"
              onClick={downloadTextReport}
              className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded-xl transition-all inline-flex items-center gap-2 font-bold"
              disabled={!analytics || loading}
              title="匯出成文字分析報告"
            >
              <Download className="w-4 h-4" />
              匯出文字
            </button>
            {onRegenerateAnalytics ? (
              <button
                type="button"
                onClick={() => void handleRegenerateAnalytics()}
                className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded-xl transition-all inline-flex items-center gap-2 font-bold"
                disabled={loading}
                title="重新生成（較慢）"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                重新生成
              </button>
            ) : null}
            <button
              onClick={onClose}
              className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {loading || ((onLoadAnalytics || onRegenerateAnalytics) && !analytics && !autoRegenerateFailed) ? (
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
                  { id: 'recommendations', label: '學習建議', icon: Lightbulb },
                  { id: 'notes', label: '溫習筆記', icon: FileText }
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
              {activeTab === 'notes' && renderNotesTab()}
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
