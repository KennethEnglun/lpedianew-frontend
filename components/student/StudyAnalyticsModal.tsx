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
    const svgEl = (document.querySelector('svg[data-mindmap-svg="fullscreen"]') || document.querySelector('svg[data-mindmap-svg="normal"]')) as SVGSVGElement | null;
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
    const sections = sectionsRaw
      .map((s) => ({
        title: String(s?.title || '').trim(),
        bullets: Array.isArray(s?.bullets) ? s.bullets.map((b) => String(b || '').trim()).filter(Boolean) : []
      }))
      .filter((s) => s.title)
      .slice(0, 8);
    if (sections.length === 0) return null;

    const W = 1200;
    const H = 620;
    const cx = W / 2;
    const cy = H / 2;

    const centerLabel = String(analytics?.revisionNotes?.title || '').trim() || `${analytics?.subject || '溫習'}重點`;
    const centerW = 220;
    const centerH = 64;

    const mainW = 170;
    const mainH = 60;
    const subW = 150;
    const subH = 42;

    const leftX = 240;
    const rightX = W - 240;
    const mainDx = 80;
    const subDx = 160;

    const palette = [
      { stroke: '#7C3AED', fill: '#F3E8FF' }, // purple
      { stroke: '#EF4444', fill: '#FEE2E2' }, // red
      { stroke: '#10B981', fill: '#D1FAE5' }, // green
      { stroke: '#F59E0B', fill: '#FEF3C7' }, // amber
      { stroke: '#3B82F6', fill: '#DBEAFE' }, // blue
      { stroke: '#EC4899', fill: '#FCE7F3' }  // pink
    ];

    const left = sections.filter((_, i) => i % 2 === 0);
    const right = sections.filter((_, i) => i % 2 === 1);

    const positions = (items: any[], side: 'left' | 'right') => {
      const n = items.length;
      if (n === 0) return [];
      const top = 150;
      const bottom = H - 150;
      const gap = n === 1 ? 0 : (bottom - top) / (n - 1);
      return items.map((_, i) => ({
        x: side === 'left' ? leftX : rightX,
        y: n === 1 ? cy : top + i * gap
      }));
    };

    const leftPos = positions(left, 'left');
    const rightPos = positions(right, 'right');

    const centerBox = { x: cx - centerW / 2, y: cy - centerH / 2, w: centerW, h: centerH };
    const mainBoxAt = (p: { x: number; y: number }) => ({ x: p.x - mainW / 2, y: p.y - mainH / 2, w: mainW, h: mainH });

    const cubicPath = (from: { x: number; y: number }, to: { x: number; y: number }, bend: number) => {
      const dx = to.x - from.x;
      const c1 = { x: from.x + dx * bend, y: from.y };
      const c2 = { x: to.x - dx * bend, y: to.y };
      return `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`;
    };

    const svg = (variant: 'normal' | 'fullscreen') => (
      <svg data-mindmap-svg={variant} width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
            <defs>
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.18" />
              </filter>
            </defs>

            {/* Center */}
            <g filter="url(#shadow)">
              <rect
                x={centerBox.x}
                y={centerBox.y}
                width={centerBox.w}
                height={centerBox.h}
                rx={22}
                fill="#111827"
                stroke="#111827"
                strokeWidth="3"
              />
              <text x={cx} y={cy + 6} textAnchor="middle" fontSize="18" fontWeight="700" fill="#FFFFFF">
                {centerLabel}
              </text>
            </g>

            {/* Left side branches */}
            {left.map((node, i) => {
              const p = leftPos[i];
              const box = mainBoxAt(p);
              const color = palette[i % palette.length];

              const from = { x: centerBox.x, y: cy };
              const to = { x: box.x + box.w, y: p.y };
              const path = cubicPath(from, to, 0.45);

              const bullets = node.bullets.slice(0, 2);
              const subGap = bullets.length <= 1 ? 0 : 70;
              const subStartY = p.y - (subGap * (bullets.length - 1)) / 2;

              return (
                <g key={`L-${i}`}>
                  <path d={path} fill="none" stroke={color.stroke} strokeWidth="4" strokeLinecap="round" />

                  <g filter="url(#shadow)">
                    <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={18} fill="#FFFFFF" stroke={color.stroke} strokeWidth="3" />
                    <text x={p.x} y={p.y + 6} textAnchor="middle" fontSize="14" fontWeight="700" fill="#111827">
                      {ellipsis(node.title, 16)}
                    </text>
                  </g>

                  {bullets.map((b: string, j: number) => {
                    const sy = subStartY + j * subGap;
                    const sx = box.x - subDx;
                    const subBox = { x: sx - subW / 2, y: sy - subH / 2, w: subW, h: subH };
                    const lineFrom = { x: box.x, y: sy };
                    const lineTo = { x: subBox.x + subBox.w, y: sy };
                    const subPath = cubicPath(lineFrom, lineTo, 0.25);
                    return (
                      <g key={`L-${i}-S-${j}`}>
                        <path d={subPath} fill="none" stroke={color.stroke} strokeWidth="3" strokeLinecap="round" opacity="0.9" />
                        <g filter="url(#shadow)">
                          <rect x={subBox.x} y={subBox.y} width={subBox.w} height={subBox.h} rx={14} fill={color.fill} stroke={color.stroke} strokeWidth="2" />
                          <text x={sx} y={sy + 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#111827">
                            {ellipsis(b, 14)}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {/* Right side branches */}
            {right.map((node, i) => {
              const p = rightPos[i];
              const box = mainBoxAt(p);
              const color = palette[(i + 1) % palette.length];

              const from = { x: centerBox.x + centerBox.w, y: cy };
              const to = { x: box.x, y: p.y };
              const path = cubicPath(from, to, 0.45);

              const bullets = node.bullets.slice(0, 2);
              const subGap = bullets.length <= 1 ? 0 : 70;
              const subStartY = p.y - (subGap * (bullets.length - 1)) / 2;

              return (
                <g key={`R-${i}`}>
                  <path d={path} fill="none" stroke={color.stroke} strokeWidth="4" strokeLinecap="round" />

                  <g filter="url(#shadow)">
                    <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={18} fill="#FFFFFF" stroke={color.stroke} strokeWidth="3" />
                    <text x={p.x} y={p.y + 6} textAnchor="middle" fontSize="14" fontWeight="700" fill="#111827">
                      {ellipsis(node.title, 16)}
                    </text>
                  </g>

                  {bullets.map((b: string, j: number) => {
                    const sy = subStartY + j * subGap;
                    const sx = box.x + box.w + subDx;
                    const subBox = { x: sx - subW / 2, y: sy - subH / 2, w: subW, h: subH };
                    const lineFrom = { x: box.x + box.w, y: sy };
                    const lineTo = { x: subBox.x, y: sy };
                    const subPath = cubicPath(lineFrom, lineTo, 0.25);
                    return (
                      <g key={`R-${i}-S-${j}`}>
                        <path d={subPath} fill="none" stroke={color.stroke} strokeWidth="3" strokeLinecap="round" opacity="0.9" />
                        <g filter="url(#shadow)">
                          <rect x={subBox.x} y={subBox.y} width={subBox.w} height={subBox.h} rx={14} fill={color.fill} stroke={color.stroke} strokeWidth="2" />
                          <text x={sx} y={sy + 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#111827">
                            {ellipsis(b, 14)}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </g>
              );
            })}
      </svg>
    );

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
                <div className="min-w-[1200px]">
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
