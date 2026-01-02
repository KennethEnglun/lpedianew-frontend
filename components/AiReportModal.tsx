import React, { useMemo } from 'react';
import { X, BarChart3, RefreshCw } from 'lucide-react';

type Props = {
  open: boolean;
  title: string;
  loading: boolean;
  error?: string;
  report: any | null;
  onClose: () => void;
  onRegenerate?: () => void;
};

export function AiReportModal({ open, title, loading, error, report, onClose, onRegenerate }: Props) {
  const weakQuestions = useMemo(() => {
    const qs = report?.focus?.weakQuestions;
    return Array.isArray(qs) ? qs : [];
  }, [report]);

  const recommendations = useMemo(() => {
    const arr = report?.analysis?.recommendations;
    return Array.isArray(arr) ? arr : [];
  }, [report]);

  const strengths = useMemo(() => {
    const arr = report?.analysis?.strengths;
    return Array.isArray(arr) ? arr : [];
  }, [report]);

  const weaknesses = useMemo(() => {
    const arr = report?.analysis?.weaknesses;
    return Array.isArray(arr) ? arr : [];
  }, [report]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[130] flex items-center justify-center p-4">
      <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-hidden shadow-comic flex flex-col">
        <div className="p-5 border-b-4 border-brand-brown bg-[#D2EFFF] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-2xl font-black text-brand-brown truncate inline-flex items-center gap-2">
              <BarChart3 className="w-6 h-6" />
              {title}
            </div>
            {report?.scope && (
              <div className="text-sm text-gray-700 font-bold mt-1">
                {report.scope === 'overall' ? '全體分析' : '個人分析'} • {report.toolType}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                disabled={loading}
                className={`px-4 py-2 rounded-2xl border-4 border-brand-brown font-black shadow-comic active:translate-y-1 active:shadow-none ${loading ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-[#FDEEAD] text-brand-brown hover:bg-[#FCE690]'}`}
              >
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                  重新生成
                </span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center flex-shrink-0"
              aria-label="關閉"
            >
              <X className="w-6 h-6 text-brand-brown" />
            </button>
          </div>
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
          {!loading && report && (
            <div className="space-y-5">
              <div className="bg-white border-4 border-brand-brown rounded-3xl p-5 shadow-comic">
                <div className="text-lg font-black text-brand-brown mb-2">摘要</div>
                <div className="text-gray-800 font-bold whitespace-pre-wrap">
                  {String(report?.analysis?.summary || '') || '—'}
                </div>
              </div>

              <div className="bg-white border-4 border-brand-brown rounded-3xl p-5 shadow-comic">
                <div className="text-lg font-black text-brand-brown mb-3">統計</div>
                <pre className="text-xs bg-brand-cream rounded-2xl p-4 overflow-auto border-2 border-brand-brown/10">
                  {JSON.stringify(report?.stats || {}, null, 2)}
                </pre>
              </div>

              {weakQuestions.length > 0 && (
                <div className="bg-white border-4 border-brand-brown rounded-3xl p-5 shadow-comic">
                  <div className="text-lg font-black text-brand-brown mb-3">易錯題</div>
                  <div className="space-y-3">
                    {weakQuestions.map((q: any, idx: number) => (
                      <div key={idx} className="bg-brand-cream rounded-2xl p-4 border-2 border-brand-brown/10">
                        <div className="font-black text-brand-brown">
                          第 {Number(q.index) + 1} 題 • 正確率 {Math.round((Number(q.correctRate) || 0) * 100)}%
                        </div>
                        <div className="mt-1 text-gray-800 font-bold whitespace-pre-wrap">{String(q.question || '')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {recommendations.length > 0 && (
                <div className="bg-white border-4 border-brand-brown rounded-3xl p-5 shadow-comic">
                  <div className="text-lg font-black text-brand-brown mb-3">建議</div>
                  <ul className="list-disc pl-6 space-y-2">
                    {recommendations.map((r: any, idx: number) => (
                      <li key={idx} className="text-gray-800 font-bold">{String(r)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(strengths.length > 0 || weaknesses.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white border-4 border-brand-brown rounded-3xl p-5 shadow-comic">
                    <div className="text-lg font-black text-brand-brown mb-3">強項</div>
                    {strengths.length === 0 ? (
                      <div className="text-gray-600 font-bold">—</div>
                    ) : (
                      <ul className="list-disc pl-6 space-y-2">
                        {strengths.map((s: any, idx: number) => (
                          <li key={idx} className="text-gray-800 font-bold">{String(s)}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="bg-white border-4 border-brand-brown rounded-3xl p-5 shadow-comic">
                    <div className="text-lg font-black text-brand-brown mb-3">弱項</div>
                    {weaknesses.length === 0 ? (
                      <div className="text-gray-600 font-bold">—</div>
                    ) : (
                      <ul className="list-disc pl-6 space-y-2">
                        {weaknesses.map((w: any, idx: number) => (
                          <li key={idx} className="text-gray-800 font-bold">{String(w)}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

