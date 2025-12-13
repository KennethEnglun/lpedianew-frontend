import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Check, Copy, Search, X } from 'lucide-react';
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

const bubbleBase = 'max-w-[85%] rounded-2xl px-4 py-3 border-2 break-words';

const escapeHtml = (input: string) =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const inlineToHtml = (escaped: string) => {
  return escaped
    .replace(/`([^`]+)`/g, (_m, code) => `<code class="bg-gray-200 border border-gray-300 rounded px-1 py-0.5 font-mono text-sm">${code}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, (_m, t) => `<strong>${t}</strong>`)
    .replace(/\*([^*]+)\*/g, (_m, t) => `<em>${t}</em>`)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, text, url) => `<a href="${url}" target="_blank" rel="noreferrer" class="underline text-blue-700">${text}</a>`);
};

const splitTableRow = (line: string) => {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((c) => c.trim());
};

const isTableSep = (line: string) => {
  // e.g. | --- | :---: | ---: |
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
};

const markdownToSafeHtml = (markdown: string) => {
  const raw = String(markdown || '');
  const escaped = escapeHtml(raw);

  const codeBlocks: string[] = [];
  const withBlocks = escaped.replace(/```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g, (_m, lang, code) => {
    const idx = codeBlocks.length;
    const language = typeof lang === 'string' && lang ? `language-${lang}` : '';
    codeBlocks.push(
      `<pre class="bg-gray-900 text-gray-100 rounded-2xl p-4 overflow-x-auto border-2 border-gray-700"><code class="${language}">${code}</code></pre>`
    );
    return `@@CODEBLOCK_${idx}@@`;
  });

  const lines = withBlocks.split('\n');
  const out: string[] = [];
  const paragraphBuf: string[] = [];

  const flushParagraph = (buf: string[]) => {
    if (buf.length === 0) return;
    const html = inlineToHtml(buf.join('<br/>'));
    out.push(`<p class="leading-relaxed">${html}</p>`);
    buf.length = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    // blank line
    if (!line.trim()) {
      // paragraph boundary
      flushParagraph(paragraphBuf);
      continue;
    }

    // headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph(paragraphBuf);
      const level = headingMatch[1].length;
      const text = inlineToHtml(headingMatch[2].trim());
      const sizes = ['text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm', 'text-sm'];
      out.push(`<h${level} class="${sizes[level - 1] || 'text-base'} font-black text-gray-900 mt-2">${text}</h${level}>`);
      continue;
    }

    // lists
    const listMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (listMatch) {
      flushParagraph(paragraphBuf);
      const items: string[] = [];
      let j = i;
      for (; j < lines.length; j++) {
        const l = lines[j] ?? '';
        const m = l.match(/^\s*[-*]\s+(.*)$/);
        if (!m) break;
        items.push(`<li class="ml-5 list-disc">${inlineToHtml(m[1].trim())}</li>`);
      }
      out.push(`<ul class="space-y-1">${items.join('')}</ul>`);
      i = j - 1;
      continue;
    }

    // tables
    const next = lines[i + 1] ?? '';
    if (line.includes('|') && isTableSep(next)) {
      flushParagraph(paragraphBuf);
      const headerCells = splitTableRow(line).map((c) => `<th class="text-left px-3 py-2 border border-gray-300 bg-gray-100 font-black">${inlineToHtml(c)}</th>`);

      const bodyRows: string[] = [];
      let j = i + 2;
      for (; j < lines.length; j++) {
        const rowLine = lines[j] ?? '';
        if (!rowLine.trim()) break;
        if (!rowLine.includes('|')) break;
        const cells = splitTableRow(rowLine).map((c) => `<td class="align-top px-3 py-2 border border-gray-300">${inlineToHtml(c)}</td>`);
        bodyRows.push(`<tr>${cells.join('')}</tr>`);
      }

      out.push(
        `<div class="overflow-x-auto"><table class="w-full border-collapse text-sm"><thead><tr>${headerCells.join('')}</tr></thead><tbody>${bodyRows.join('')}</tbody></table></div>`
      );
      i = j - 1;
      continue;
    }

    // default paragraph (keep escaped line; render inline later)
    paragraphBuf.push(line);
  }

  flushParagraph(paragraphBuf);
  const joined = out.join('');
  return joined.replace(/@@CODEBLOCK_(\d+)@@/g, (_m, n) => codeBlocks[Number(n)] || '');
};

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
  const [subject, setSubject] = useState<string>(defaultSubject || String(Subject.CHINESE)); // student: active subject; teacher: optional filter for students tab ('' = all)

  // My chat
  const [myThreadId, setMyThreadId] = useState<string | null>(null);
  const [myThreads, setMyThreads] = useState<any[]>([]);
  const [myThreadSearch, setMyThreadSearch] = useState('');
  const [myMessages, setMyMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [myLoading, setMyLoading] = useState(false);
  const [myError, setMyError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

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
    if (isTeacher) {
      setSubject(''); // teacher: no top subject selector; default show all subjects in student threads
      setTab('students');
    } else {
      const initial = defaultSubject || String(Subject.CHINESE);
      setSubject(String(initial || Subject.CHINESE));
      setTab('my');
    }
  }, [defaultSubject, isTeacher, open, teacherSubjects]);

  const loadMyChat = async (nextSubject: string) => {
    try {
      setMyLoading(true);
      setMyError('');
      setMyMessages([]);
      const threadsResp = isTeacher
        ? await authService.getMyChatThreads()
        : await authService.getMyChatThreads({ subject: nextSubject });
      const threads = Array.isArray(threadsResp.threads) ? threadsResp.threads : [];
      setMyThreads(threads);
      const selected = threads.find((t: any) => t?.id === myThreadId) || threads[0] || null;
      if (!selected?.id) {
        setMyThreadId(null);
        return;
      }
      setMyThreadId(String(selected.id));

      const msg = await authService.getMyChatMessages(String(selected.id), { limit: 200 });
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

  const openMyThread = async (threadId: string) => {
    try {
      abortRef.current?.abort();
      setMyLoading(true);
      setMyError('');
      setMyThreadId(threadId);
      const msg = await authService.getMyChatMessages(threadId, { limit: 200 });
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

  const createNewMyThread = async () => {
    try {
      abortRef.current?.abort();
      setMyLoading(true);
      setMyError('');
      setMyMessages([]);
      const resp = await authService.createMyChatThread({ subject: isTeacher ? undefined : subject });
      const thread = resp?.thread;
      if (thread?.id) {
        const nextId = String(thread.id);
        setMyThreadId(nextId);
        setMyThreads((prev) => [thread, ...prev]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '建立失敗';
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
      const data = await authService.getTeacherChatThreads({ subject: nextSubject || undefined, search: studentSearch || undefined });
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

  const copyToClipboard = async (text: string, messageId: string) => {
    const value = String(text || '');
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedMessageId(messageId);
      window.setTimeout(() => setCopiedMessageId((prev) => (prev === messageId ? null : prev)), 1200);
    } catch (error) {
      console.error('Copy failed', error);
    }
  };

  const send = async () => {
    if (!draft.trim()) return;
    try {
      setSending(true);
      setMyError('');
      const text = draft.trim();
      setDraft('');

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const tempUser: ChatMessage = {
        id: `temp-user-${Date.now()}`,
        sender: 'user',
        content: text,
        createdAt: new Date().toISOString(),
        userRole: user?.role || null
      };
      setMyMessages((prev) => [...prev, tempUser]);

      const tempAssistantId = `temp-assistant-${Date.now()}`;
      setMyMessages((prev) => ([
        ...prev,
        { id: tempAssistantId, sender: 'assistant', content: '', createdAt: new Date().toISOString() }
      ]));

      const streamResp = await authService.sendChatMessageStream(
        { subject: isTeacher ? undefined : subject, threadId: myThreadId, message: text },
        { signal: abortRef.current?.signal }
      );
      if (!streamResp.ok || !streamResp.body) {
        const fallback = await authService.sendChatMessage({ subject: isTeacher ? undefined : subject, threadId: myThreadId, message: text });
        setMyThreadId(fallback.threadId);
        const content = String(fallback.assistantMessage?.content || '');
        setMyMessages((prev) => prev.map((m) => (m.id === tempAssistantId ? { ...m, content } : m)));
        return;
      }

      const reader = streamResp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let assembled = '';

      const applyDelta = (delta: string) => {
        assembled += delta;
        setMyMessages((prev) => prev.map((m) => (m.id === tempAssistantId ? { ...m, content: assembled } : m)));
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';
        for (const chunk of chunks) {
          const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
          const eventLine = lines.find((l) => l.startsWith('event:'));
          const dataLine = lines.find((l) => l.startsWith('data:'));
          const event = eventLine ? eventLine.slice(6).trim() : '';
          const data = dataLine ? dataLine.slice(5).trim() : '';
          if (!data) continue;
          try {
            const payload = JSON.parse(data);
            if (event === 'meta' && payload.threadId) {
              setMyThreadId(String(payload.threadId));
            } else if (event === 'delta' && typeof payload.delta === 'string') {
              applyDelta(payload.delta);
            } else if (event === 'error' && payload.message) {
              setMyError(String(payload.message));
            }
          } catch {
            // ignore
          }
        }
      }

      // Refresh thread list to pick up title + ordering
      try {
        const threadsResp = isTeacher ? await authService.getMyChatThreads() : await authService.getMyChatThreads({ subject });
        const threads = Array.isArray(threadsResp.threads) ? threadsResp.threads : [];
        setMyThreads(threads);
      } catch {
        // ignore
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
          {!isTeacher && (
            <div className="w-full md:w-56">
              <label className="block text-xs font-black text-gray-600 mb-1">科目</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl bg-white"
              >
                {subjectOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

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

              <div className="mb-3">
                <label className="block text-xs font-black text-gray-600 mb-1">科目（可選）</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl bg-white"
                >
                  <option value="">全部</option>
                  {teacherSubjects.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
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
                      <div className="text-[11px] text-gray-600 mt-1 font-bold">
                        科目：{t.subject || '—'}
                      </div>
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
                      <div className="flex justify-end mb-2">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(m.content, m.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-300 bg-white/70 hover:bg-white text-xs font-bold text-gray-700"
                          aria-label="複製"
                          title={copiedMessageId === m.id ? '已複製' : '複製'}
                        >
                          {copiedMessageId === m.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedMessageId === m.id ? '已複製' : '複製'}
                        </button>
                      </div>
                      <div dangerouslySetInnerHTML={{ __html: markdownToSafeHtml(m.content) }} />
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
          <div className="flex-1 min-h-0 flex flex-col md:flex-row bg-gray-50">
            {/* Left Sidebar (My chat) */}
            <aside className="hidden md:flex w-80 border-r-2 border-gray-200 bg-white p-4 overflow-y-auto flex-col">
              <div className="mb-3">
                <label className="block text-xs font-black text-gray-600 mb-1">搜尋</label>
                <input
                  value={myThreadSearch}
                  onChange={(e) => setMyThreadSearch(e.target.value)}
                  placeholder="搜尋對話..."
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl"
                />
              </div>

              <button
                type="button"
                onClick={createNewMyThread}
                className="mb-4 w-full px-4 py-3 rounded-2xl border-2 border-gray-200 bg-gray-50 hover:border-brand-brown font-black text-gray-800 text-left"
              >
                + 新對話
              </button>

              <div className="space-y-2 mb-4">
                <div className="px-3 py-2 rounded-2xl bg-[#FDEEAD] border-2 border-brand-brown font-black text-brand-brown">聊天</div>
                <div className="px-3 py-2 rounded-2xl bg-white border-2 border-gray-200 text-gray-400 font-black">語音（開發中）</div>
                <div className="px-3 py-2 rounded-2xl bg-white border-2 border-gray-200 text-gray-400 font-black">Imagine（開發中）</div>
                <div className="px-3 py-2 rounded-2xl bg-white border-2 border-gray-200 text-gray-400 font-black">專案（開發中）</div>
              </div>

              <div className="text-xs font-black text-gray-600 mb-2">歷史</div>
              <div className="space-y-2">
                {(() => {
                  const q = myThreadSearch.trim().toLowerCase();
                  const filtered = myThreads.filter((t: any) => {
                    const title = String(t?.title || '新對話').toLowerCase();
                    return !q || title.includes(q);
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-10 text-gray-400 font-bold border-4 border-dashed border-gray-200 rounded-2xl">
                        暫無對話
                      </div>
                    );
                  }

                  const groups = new Map<string, any[]>();
                  filtered.forEach((t: any) => {
                    const dt = new Date(t.lastMessageAt || t.updatedAt || t.createdAt || Date.now());
                    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
                    const arr = groups.get(key) || [];
                    arr.push(t);
                    groups.set(key, arr);
                  });

                  const keys = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));
                  return keys.map((key) => {
                    const [y, m] = key.split('-');
                    const label = `${y}年${m}月`;
                    const items = groups.get(key) || [];
                    return (
                      <div key={key}>
                        <div className="text-xs font-black text-gray-500 px-1 mb-1">{label}</div>
                        <div className="space-y-2">
                          {items.map((t: any) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => openMyThread(String(t.id))}
                              className={`w-full text-left px-3 py-3 rounded-2xl border-2 transition-colors ${String(t.id) === String(myThreadId)
                                ? 'bg-[#FDEEAD] border-brand-brown'
                                : 'bg-gray-50 border-gray-200 hover:border-brand-brown'
                                }`}
                            >
                              <div className="font-black text-gray-800 line-clamp-2">{t.title || '新對話'}</div>
                              <div className="text-[11px] text-gray-500 mt-1">
                                {t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleString() : ''}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </aside>

            {/* Right Chat */}
            <div className="flex-1 min-h-0 flex flex-col">
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
                          <div className="flex justify-end mb-2">
                            <button
                              type="button"
                              onClick={() => copyToClipboard(m.content, m.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-300 bg-white/70 hover:bg-white text-xs font-bold text-gray-700"
                              aria-label="複製"
                              title={copiedMessageId === m.id ? '已複製' : '複製'}
                            >
                              {copiedMessageId === m.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              {copiedMessageId === m.id ? '已複製' : '複製'}
                            </button>
                          </div>
                          <div dangerouslySetInnerHTML={{ __html: markdownToSafeHtml(m.content) }} />
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
          </div>
        )}
      </div>
    </div>
  );
};

export default AiChatModal;
