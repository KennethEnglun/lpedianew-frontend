import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Search, X } from 'lucide-react';
import Button from './Button';
import Input from './Input';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { Subject } from '../types';

type ChatMessage = {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: string;
  userRole?: string | null;
};

const subjectOptions = Object.values(Subject);

const bubbleBase = 'max-w-[85%] rounded-2xl px-4 py-3 border-2 whitespace-pre-wrap break-words';

const AiChatModal: React.FC<{
  open: boolean;
  onClose: () => void;
  defaultSubject?: string;
}> = ({ open, onClose, defaultSubject }) => {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

  const teacherSubjects = useMemo(() => {
    const profile: any = user?.profile || {};
    const arr = Array.isArray(profile.subjectsTaught) ? profile.subjectsTaught.filter((s: any) => typeof s === 'string') : [];
    return arr.length > 0 ? arr : subjectOptions;
  }, [user?.profile]);

  const [tab, setTab] = useState<'my' | 'students'>('my');
  const [subject, setSubject] = useState<string>(defaultSubject || String(Subject.CHINESE));

  // My chat
  const [myThreadId, setMyThreadId] = useState<string | null>(null);
  const [myMessages, setMyMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [myLoading, setMyLoading] = useState(false);
  const [myError, setMyError] = useState('');

  // Teacher view
  const [studentSearch, setStudentSearch] = useState('');
  const [studentThreads, setStudentThreads] = useState<any[]>([]);
  const [studentLoading, setStudentLoading] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedStudentInfo, setSelectedStudentInfo] = useState<any>(null);
  const [studentMessages, setStudentMessages] = useState<ChatMessage[]>([]);
  const [studentError, setStudentError] = useState('');

  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [open, myMessages.length, studentMessages.length, tab]);

  useEffect(() => {
    if (!open) return;
    const initial = defaultSubject || (isTeacher ? teacherSubjects[0] : String(Subject.CHINESE));
    setSubject(String(initial || Subject.CHINESE));
    setTab(isTeacher ? 'students' : 'my');
  }, [defaultSubject, isTeacher, open, teacherSubjects]);

  const loadMyChat = async (nextSubject: string) => {
    try {
      setMyLoading(true);
      setMyError('');
      setMyThreadId(null);
      setMyMessages([]);
      const threads = await authService.getMyChatThreads({ subject: nextSubject });
      const t = Array.isArray(threads.threads) ? threads.threads[0] : null;
      if (!t?.id) return;
      setMyThreadId(t.id);
      const msg = await authService.getMyChatMessages(t.id, { limit: 200 });
      const arr = Array.isArray(msg.messages) ? msg.messages : [];
      setMyMessages(arr.map((m: any) => ({
        id: String(m.id),
        sender: m.sender,
        content: String(m.content || ''),
        createdAt: m.createdAt,
        userRole: m.userRole
      })));
    } catch (error) {
      const message = error instanceof Error ? error.message : '載入失敗';
      setMyError(message);
    } finally {
      setMyLoading(false);
    }
  };

  const loadTeacherThreads = async (nextSubject: string) => {
    if (!isTeacher) return;
    try {
      setStudentLoading(true);
      setStudentError('');
      setStudentThreads([]);
      setSelectedThreadId(null);
      setSelectedStudentInfo(null);
      setStudentMessages([]);
      const data = await authService.getTeacherChatThreads({ subject: nextSubject, search: studentSearch || undefined });
      setStudentThreads(Array.isArray(data.threads) ? data.threads : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : '載入失敗';
      setStudentError(message);
    } finally {
      setStudentLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (tab === 'my') loadMyChat(subject);
    else loadTeacherThreads(subject);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, subject, tab]);

  const openTeacherThread = async (threadId: string) => {
    try {
      setStudentLoading(true);
      setStudentError('');
      setSelectedThreadId(threadId);
      setSelectedStudentInfo(null);
      setStudentMessages([]);
      const data = await authService.getTeacherChatMessages(threadId, { limit: 200 });
      setSelectedStudentInfo(data.student || null);
      const arr = Array.isArray(data.messages) ? data.messages : [];
      setStudentMessages(arr.map((m: any) => ({
        id: String(m.id),
        sender: m.sender,
        content: String(m.content || ''),
        createdAt: m.createdAt,
        userRole: m.userRole
      })));
    } catch (error) {
      const message = error instanceof Error ? error.message : '載入失敗';
      setStudentError(message);
    } finally {
      setStudentLoading(false);
    }
  };

  const send = async () => {
    if (!draft.trim()) return;
    try {
      setSending(true);
      setMyError('');
      const text = draft.trim();
      setDraft('');

      const tempUser: ChatMessage = {
        id: `temp-user-${Date.now()}`,
        sender: 'user',
        content: text,
        createdAt: new Date().toISOString(),
        userRole: user?.role || null
      };
      setMyMessages((prev) => [...prev, tempUser]);

      const res = await authService.sendChatMessage({ subject, threadId: myThreadId, message: text });
      setMyThreadId(res.threadId);
      if (res.assistantMessage) {
        const assistant: ChatMessage = {
          id: String(res.assistantMessage.id || `assistant-${Date.now()}`),
          sender: 'assistant',
          content: String(res.assistantMessage.content || ''),
          createdAt: res.assistantMessage.createdAt
        };
        setMyMessages((prev) => [...prev, assistant]);
      } else {
        await loadMyChat(subject);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '發送失敗';
      setMyError(message);
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-3xl border-4 border-brand-brown shadow-comic-xl flex flex-col">
        <div className="p-5 border-b-4 border-brand-brown bg-[#D2EFFF] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown flex items-center justify-center">
              <Bot className="w-6 h-6 text-brand-brown" />
            </div>
            <div>
              <div className="text-2xl font-black text-brand-brown">AI對話</div>
              <div className="text-xs text-gray-600 font-bold">通用 Bot（將來可擴展派發 Bot 任務）</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
            aria-label="關閉"
          >
            <X className="w-6 h-6 text-brand-brown" />
          </button>
        </div>

        <div className="p-4 border-b-2 border-gray-200 bg-gray-50 flex flex-col md:flex-row items-start md:items-center gap-3">
          <div className="w-full md:w-56">
            <label className="block text-xs font-black text-gray-600 mb-1">科目</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl bg-white"
            >
              {(isTeacher ? teacherSubjects : subjectOptions).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {isTeacher && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTab('students')}
                className={`px-4 py-2 rounded-2xl border-2 font-black ${tab === 'students'
                  ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown'
                  : 'bg-white border-gray-300 text-gray-600 hover:border-brand-brown'
                  }`}
              >
                學生對話
              </button>
              <button
                type="button"
                onClick={() => setTab('my')}
                className={`px-4 py-2 rounded-2xl border-2 font-black ${tab === 'my'
                  ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown'
                  : 'bg-white border-gray-300 text-gray-600 hover:border-brand-brown'
                  }`}
              >
                我的對話
              </button>
            </div>
          )}
        </div>

        {tab === 'students' && isTeacher ? (
          <div className="flex-1 min-h-0 flex flex-col md:flex-row">
            <div className="w-full md:w-80 border-r-0 md:border-r-2 border-gray-200 bg-white p-4 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1">
                  <Input
                    label="搜尋學生"
                    placeholder="姓名 / 帳號"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => loadTeacherThreads(subject)}
                  className="mt-6 w-10 h-10 rounded-xl bg-white border-2 border-gray-300 hover:border-brand-brown flex items-center justify-center"
                  title="搜尋"
                >
                  <Search className="w-5 h-5 text-gray-700" />
                </button>
              </div>

              {studentError && (
                <div className="mb-3 text-sm font-bold text-red-700 bg-red-50 border-2 border-red-200 rounded-2xl p-3">
                  {studentError}
                </div>
              )}

              {studentLoading ? (
                <div className="text-center py-8 text-brand-brown font-bold">載入中...</div>
              ) : studentThreads.length > 0 ? (
                <div className="space-y-2">
                  {studentThreads.map((t) => (
                    <button
                      key={t.threadId}
                      onClick={() => openTeacherThread(t.threadId)}
                      className={`w-full text-left px-3 py-3 rounded-2xl border-2 transition-colors ${selectedThreadId === t.threadId
                        ? 'bg-[#FDEEAD] border-brand-brown'
                        : 'bg-gray-50 border-gray-200 hover:border-brand-brown'
                        }`}
                    >
                      <div className="font-black text-gray-800">{t.student?.name || '未知學生'}</div>
                      <div className="text-xs text-gray-600 font-bold">{t.student?.class || ''} • {t.student?.username || ''}</div>
                      <div className="text-[11px] text-gray-500 mt-1">
                        {t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleString() : ''}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-gray-400 font-bold border-4 border-dashed border-gray-200 rounded-2xl">
                  暫無學生對話
                </div>
              )}
            </div>

            <div className="flex-1 min-h-0 flex flex-col bg-gray-50">
              <div className="p-4 border-b-2 border-gray-200 bg-white">
                <div className="text-lg font-black text-brand-brown">對話紀錄</div>
                <div className="text-xs text-gray-600 font-bold">
                  {selectedStudentInfo ? `${selectedStudentInfo.name}（${selectedStudentInfo.class}）` : '請從左側選擇學生'}
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                {studentMessages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`${bubbleBase} ${m.sender === 'user'
                        ? 'bg-white border-brand-brown text-gray-800'
                        : 'bg-[#E0D2F8] border-purple-300 text-gray-800'
                        }`}
                    >
                      {m.content}
                      {m.createdAt && (
                        <div className="text-[10px] text-gray-500 mt-2">
                          {new Date(m.createdAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col bg-gray-50">
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
              {myError && (
                <div className="text-sm font-bold text-red-700 bg-red-50 border-2 border-red-200 rounded-2xl p-3">
                  {myError}
                </div>
              )}
              {myLoading ? (
                <div className="text-center py-10 text-brand-brown font-bold">載入中...</div>
              ) : (
                <>
                  {myMessages.length === 0 && (
                    <div className="text-center py-10 text-gray-400 font-bold border-4 border-dashed border-gray-200 rounded-2xl">
                      開始跟 AI 對話吧
                    </div>
                  )}
                  {myMessages.map((m) => (
                    <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`${bubbleBase} ${m.sender === 'user'
                          ? 'bg-white border-brand-brown text-gray-800'
                          : 'bg-[#E0D2F8] border-purple-300 text-gray-800'
                          }`}
                      >
                        {m.content}
                        {m.createdAt && (
                          <div className="text-[10px] text-gray-500 mt-2">
                            {new Date(m.createdAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
              <div ref={endRef} />
            </div>

            <div className="p-4 border-t-2 border-gray-200 bg-white">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-black text-gray-600 mb-1">輸入訊息</label>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="w-full min-h-[44px] max-h-40 px-3 py-2 border-2 border-gray-300 rounded-2xl focus:outline-none focus:border-brand-brown"
                    placeholder="輸入你的問題..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!sending) send();
                      }
                    }}
                  />
                </div>
                <Button
                  className={`border-brand-brown ${sending ? 'bg-gray-300 text-gray-600 cursor-wait' : 'bg-[#FDEEAD] text-brand-brown hover:bg-[#FCE690]'}`}
                  onClick={send}
                  disabled={sending}
                >
                  {sending ? '發送中...' : '送出'}
                </Button>
              </div>
              <div className="text-[11px] text-gray-500 mt-2">
                提示：Enter 送出、Shift+Enter 換行。
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiChatModal;

