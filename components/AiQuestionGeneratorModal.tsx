import React, { useEffect, useState } from 'react';
import Input from './Input';
import { X } from 'lucide-react';
import { authService } from '../services/authService';

type Grade = '小一' | '小二' | '小三' | '小四' | '小五' | '小六';
type Mode = 'mcq' | 'pairs';
type ImportMode = 'replace' | 'append';

interface Props {
  open: boolean;
  mode: Mode;
  subject: string;
  title: string;
  onClose: () => void;
  importModes?: ImportMode[];
  onImport: (
    payload: { mcq?: Array<{ question: string; options: string[]; correctIndex: number }>; pairs?: Array<{ question: string; answer: string }> },
    mode: ImportMode
  ) => void;
}

export const AiQuestionGeneratorModal: React.FC<Props> = ({ open, mode, subject, title, onClose, importModes = ['replace'], onImport }) => {
  const [count, setCount] = useState(10);
  const [topic, setTopic] = useState('');
  const [grade, setGrade] = useState<Grade>('小三');
  const [useScope, setUseScope] = useState(false);
  const [scopeText, setScopeText] = useState('');
  const [advancedOnly, setAdvancedOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [previewMcq, setPreviewMcq] = useState<Array<{ question: string; options: string[]; correctIndex: number }>>([]);
  const [previewPairs, setPreviewPairs] = useState<Array<{ question: string; answer: string }>>([]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCount(10);
    setTopic('');
    setGrade('小三');
    setUseScope(false);
    setScopeText('');
    setAdvancedOnly(false);
    setPreviewMcq([]);
    setPreviewPairs([]);
  }, [open]);

  const run = async () => {
    setError(null);
    setPreviewMcq([]);
    setPreviewPairs([]);

    const effectiveScope = useScope ? scopeText.slice(0, 5000) : '';
    if (advancedOnly && !effectiveScope.trim()) {
      setError('進階輸入模式需要提供範圍輸入內容');
      return;
    }

    try {
      setLoading(true);
      const safeCount = Math.max(1, Math.min(50, Math.floor(count || 10)));

      if (mode === 'pairs') {
        const result = await authService.generateMatchingPairs({
          subject,
          grade,
          topic: topic.trim(),
          count: safeCount,
          scopeText: effectiveScope,
          advancedOnly
        });
        setPreviewPairs(result.pairs || []);
      } else {
        const result = await authService.generateQuizQuestions({
          subject,
          grade,
          topic: topic.trim(),
          count: safeCount,
          scopeText: effectiveScope,
          advancedOnly
        });
        setPreviewMcq(result.questions || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 生成失敗');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const hasPreview = mode === 'pairs' ? previewPairs.length > 0 : previewMcq.length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-comic-xl">
        <div className="p-6 border-b-4 border-brand-brown bg-[#E0F2FE]">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-black text-brand-brown">{title}</h2>
              <p className="text-sm text-gray-600 mt-1">
                科目：<span className="font-bold">{subject}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
            >
              <X className="w-6 h-6 text-brand-brown" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-red-700 font-bold">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-brand-brown mb-2">{mode === 'pairs' ? '配對數量' : '題目數量'}</label>
              <input
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-brand-brown bg-white font-bold text-brand-brown"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-brand-brown mb-2">對象年級</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value as Grade)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-brand-brown bg-white font-bold text-brand-brown"
              >
                <option value="小一">小一</option>
                <option value="小二">小二</option>
                <option value="小三">小三</option>
                <option value="小四">小四</option>
                <option value="小五">小五</option>
                <option value="小六">小六</option>
              </select>
            </div>
            <Input
              label="題目主題（可選）"
              placeholder="例如：分數加減 / 文言文 / 乘法 / 詞性..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>

          <div className="bg-[#F8FAFC] border-2 border-gray-200 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <label className="flex items-center gap-2 font-bold text-brand-brown">
                <input
                  type="checkbox"
                  checked={useScope}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setUseScope(next);
                    if (!next) {
                      setScopeText('');
                      setAdvancedOnly(false);
                    }
                  }}
                />
                範圍輸入（最多 5000 字）
              </label>
              <label className="flex items-center gap-2 font-bold text-brand-brown ml-auto">
                <input
                  type="checkbox"
                  checked={advancedOnly}
                  disabled={!useScope}
                  onChange={(e) => setAdvancedOnly(e.target.checked)}
                />
                進階輸入：只按範圍出題
              </label>
            </div>
            {useScope && (
              <>
                <textarea
                  value={scopeText}
                  onChange={(e) => setScopeText(e.target.value.slice(0, 5000))}
                  placeholder="貼上課文/筆記/教材內容..."
                  className="w-full h-40 px-4 py-3 rounded-2xl border-2 border-gray-300 focus:border-brand-brown font-medium text-gray-800"
                />
                <div className="mt-2 text-xs text-gray-500 text-right">
                  {scopeText.length}/5000
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={run}
              disabled={loading}
              className={`px-6 py-3 rounded-2xl border-2 border-brand-brown font-black ${loading ? 'bg-gray-300 text-gray-600 cursor-wait' : 'bg-[#FDEEAD] text-brand-brown hover:bg-[#FCE690]'}`}
            >
              {loading ? '生成中...' : '開始生成'}
            </button>
            <button
              type="button"
              onClick={() => { setPreviewMcq([]); setPreviewPairs([]); setError(null); }}
              className="px-6 py-3 rounded-2xl border-2 border-gray-300 font-black text-gray-700 bg-gray-100 hover:bg-gray-200"
            >
              清除預覽
            </button>
            {hasPreview && (
              <div className="ml-auto flex gap-3">
                {importModes.includes('replace') && (
                  <button
                    type="button"
                    onClick={() => onImport({ mcq: previewMcq, pairs: previewPairs }, 'replace')}
                    className="px-6 py-3 rounded-2xl border-2 border-brand-brown font-black bg-emerald-500 text-white hover:bg-emerald-600"
                  >
                    匯入（取代）
                  </button>
                )}
                {importModes.includes('append') && (
                  <button
                    type="button"
                    onClick={() => onImport({ mcq: previewMcq, pairs: previewPairs }, 'append')}
                    className="px-6 py-3 rounded-2xl border-2 border-brand-brown font-black bg-blue-500 text-white hover:bg-blue-600"
                  >
                    匯入（追加）
                  </button>
                )}
              </div>
            )}
          </div>

          {mode === 'mcq' && previewMcq.length > 0 && (
            <div className="border-t-2 border-gray-200 pt-6 space-y-4">
              <h3 className="text-xl font-black text-brand-brown">預覽（{previewMcq.length} 題）</h3>
              <div className="space-y-4">
                {previewMcq.map((q, idx) => (
                  <div key={idx} className="bg-white border-2 border-gray-200 rounded-2xl p-4">
                    <div className="font-black text-brand-brown mb-2">題目 {idx + 1}：<span className="whitespace-pre-wrap">{q.question}</span></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {q.options.map((opt, oi) => (
                        <div key={oi} className={`px-3 py-2 rounded-xl border ${q.correctIndex === oi ? 'bg-emerald-50 border-emerald-300 font-bold' : 'bg-gray-50 border-gray-200'}`}>
                          {String.fromCharCode(65 + oi)}. {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mode === 'pairs' && previewPairs.length > 0 && (
            <div className="border-t-2 border-gray-200 pt-6 space-y-4">
              <h3 className="text-xl font-black text-brand-brown">預覽（{previewPairs.length} 組）</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {previewPairs.map((p, idx) => (
                  <div key={idx} className="bg-white border-2 border-gray-200 rounded-2xl p-4">
                    <div className="text-sm font-black text-brand-brown mb-2">配對 {idx + 1}</div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 font-bold text-gray-800 mb-2 whitespace-pre-wrap">
                      {p.question}
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 font-bold text-gray-800">
                      {p.answer}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiQuestionGeneratorModal;
