import React, { useEffect, useMemo, useState } from 'react';
import { X, Send, MessageSquare, Users } from 'lucide-react';
import { authService } from '../../services/authService';

type Props = {
  open: boolean;
  discussionId: string | null;
  onClose: () => void;
  onSubmitted?: () => void;
};

type DiscussionContent = { type: 'text' | 'image' | 'link' | 'html'; value: string };

const renderContent = (content: DiscussionContent[]) => {
  const blocks = Array.isArray(content) ? content : [];
  return (
    <div className="space-y-3">
      {blocks.map((b, idx) => {
        if (!b) return null;
        if (b.type === 'image') {
          return (
            <div key={idx} className="bg-white rounded-2xl border-2 border-brand-brown/20 p-3">
              <img src={String(b.value || '')} alt="內容圖片" className="max-h-80 rounded-xl mx-auto" />
            </div>
          );
        }
        if (b.type === 'link') {
          const href = String(b.value || '');
          return (
            <a
              key={idx}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="block bg-white rounded-2xl border-2 border-brand-brown/20 p-3 font-bold text-blue-700 underline break-all"
            >
              {href}
            </a>
          );
        }
        if (b.type === 'html') {
          return (
            <div
              key={idx}
              className="bg-white rounded-2xl border-2 border-brand-brown/20 p-3 prose max-w-none"
              dangerouslySetInnerHTML={{ __html: String(b.value || '') }}
            />
          );
        }
        return (
          <div key={idx} className="bg-white rounded-2xl border-2 border-brand-brown/20 p-3 font-bold text-gray-800 whitespace-pre-wrap">
            {String(b.value || '')}
          </div>
        );
      })}
    </div>
  );
};

export function StudentDiscussionModal({ open, discussionId, onClose, onSubmitted }: Props) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [discussion, setDiscussion] = useState<any | null>(null);
  const [hasResponded, setHasResponded] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [responses, setResponses] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !discussionId) return;
    setLoading(true);
    setSubmitting(false);
    setError('');
    setDiscussion(null);
    setHasResponded(false);
    setResponseText('');
    setResponses([]);

    (async () => {
      try {
        const [detail, status, all] = await Promise.all([
          authService.getDiscussionDetails(discussionId),
          authService.checkStudentResponse(discussionId).catch(() => ({ hasResponded: false })),
          authService.getAllResponsesForStudents(discussionId).catch(() => ({ responses: [] }))
        ]);
        setDiscussion(detail?.discussion || null);
        setHasResponded(!!status?.hasResponded);
        setResponses(Array.isArray(all?.responses) ? all.responses : []);
      } catch (e: any) {
        setError(e?.message || '載入討論串失敗');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, discussionId]);

  const content = useMemo(() => {
    const c = discussion?.content;
    return Array.isArray(c) ? c : [];
  }, [discussion]);

  const submit = async () => {
    if (!discussionId) return;
    const safe = String(responseText || '').trim();
    if (!safe) return;
    setSubmitting(true);
    setError('');
    try {
      await authService.submitStudentResponse(discussionId, safe);
      setHasResponded(true);
      setResponseText('');
      const all = await authService.getAllResponsesForStudents(discussionId).catch(() => ({ responses: [] }));
      setResponses(Array.isArray(all?.responses) ? all.responses : []);
      onSubmitted?.();
    } catch (e: any) {
      setError(e?.message || '提交回應失敗');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !discussionId) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4">
      <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-hidden shadow-comic flex flex-col">
        <div className="p-5 border-b-4 border-brand-brown bg-[#D2EFFF] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-2xl font-black text-brand-brown truncate">{discussion?.title || '討論串'}</div>
            <div className="text-sm text-gray-700 font-bold mt-1">
              {discussion?.teacherName ? `教師：${discussion.teacherName}` : ''}{discussion?.subject ? ` • ${discussion.subject}` : ''}
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
          {loading && <div className="text-center py-10 font-bold text-gray-700">載入中...</div>}
          {!loading && error && (
            <div className="mb-4 bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-red-800 font-bold">
              {error}
            </div>
          )}
          {!loading && (
            <div className="space-y-5">
              <div className="bg-white border-4 border-brand-brown rounded-3xl p-4 shadow-comic">
                <div className="flex items-center gap-2 mb-3 text-brand-brown font-black">
                  <MessageSquare className="w-5 h-5" />
                  內容
                </div>
                {renderContent(content)}
              </div>

              <div className="bg-white border-4 border-brand-brown rounded-3xl p-4 shadow-comic">
                <div className="flex items-center gap-2 mb-3 text-brand-brown font-black">
                  <Users className="w-5 h-5" />
                  全體回應
                </div>
                {responses.length === 0 ? (
                  <div className="text-gray-600 font-bold">暫時沒有回應</div>
                ) : (
                  <div className="space-y-3">
                    {responses.map((r, idx) => (
                      <div key={r.id ?? idx} className="bg-brand-cream rounded-2xl p-3 border-2 border-brand-brown/10">
                        <div className="text-sm font-black text-brand-brown">
                          {(r.studentName || r.studentUsername || '學生')}{r.studentClass ? `（${r.studentClass}）` : ''}
                        </div>
                        <div className="mt-1 text-gray-800 font-bold whitespace-pre-wrap">{String(r.content || '')}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t-4 border-brand-brown bg-white">
          <div className="flex items-center gap-2 mb-2 text-sm font-bold text-gray-700">
            {hasResponded ? '你已提交過回應（可再次提交更新）' : '提交你的回應'}
          </div>
          <div className="flex gap-2">
            <textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder="輸入你的回應..."
              className="flex-1 min-h-[44px] max-h-32 px-3 py-2 rounded-2xl border-2 border-brand-brown/30 font-bold outline-none focus:border-brand-brown"
            />
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !String(responseText || '').trim()}
              className={[
                'px-4 py-2 rounded-2xl border-4 border-brand-brown font-black shadow-comic active:translate-y-1 active:shadow-none inline-flex items-center gap-2',
                submitting || !String(responseText || '').trim() ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-[#93C47D] text-brand-brown hover:bg-[#86b572]'
              ].join(' ')}
            >
              <Send className="w-4 h-4" />
              {submitting ? '提交中...' : '提交'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

