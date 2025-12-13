import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Check, Copy, X } from 'lucide-react';
import { authService } from '../services/authService';

type ChatMessage = {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: string;
};

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

    if (!line.trim()) {
      flushParagraph(paragraphBuf);
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph(paragraphBuf);
      const level = headingMatch[1].length;
      const text = inlineToHtml(headingMatch[2].trim());
      const sizes = ['text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm', 'text-sm'];
      out.push(`<h${level} class="${sizes[level - 1] || 'text-base'} font-black text-gray-900 mt-2">${text}</h${level}>`);
      continue;
    }

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

    paragraphBuf.push(line);
  }

  flushParagraph(paragraphBuf);
  const joined = out.join('');
  return joined.replace(/@@CODEBLOCK_(\d+)@@/g, (_m, n) => codeBlocks[Number(n)] || '');
};

export default function BotTaskChatModal(props: { open: boolean; taskId: string | null; onClose: () => void }) {
  const { open, taskId, onClose } = props;
  const [taskInfo, setTaskInfo] = useState<any>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const title = useMemo(() => {
    if (!taskInfo) return 'BOT 任務';
    const botName = String(taskInfo.botName || 'BOT');
    const subject = String(taskInfo.subject || '');
    return subject ? `${botName}（${subject}）` : botName;
  }, [taskInfo]);

  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [open, messages.length]);

  useEffect(() => {
    if (!open || !taskId) return;
    (async () => {
      try {
        setLoading(true);
        setError('');
        abortRef.current?.abort();
        const data = await authService.getBotTaskMyThread(String(taskId));
        setTaskInfo(data.task || null);
        setThreadId(data.thread?.id ? String(data.thread.id) : null);
        const arr = Array.isArray(data.messages) ? data.messages : [];
        setMessages(arr.map((m: any) => ({
          id: String(m.id),
          sender: m.sender,
          content: String(m.content || ''),
          createdAt: m.createdAt
        })));
      } catch (e) {
        const message = e instanceof Error ? e.message : '載入失敗';
        setError(message);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, taskId]);

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
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  const send = async () => {
    if (!taskId) return;
    if (!draft.trim()) return;
    try {
      setSending(true);
      setError('');
      const text = draft.trim();
      setDraft('');

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const tempUser: ChatMessage = { id: `temp-user-${Date.now()}`, sender: 'user', content: text, createdAt: new Date().toISOString() };
      const tempAssistantId = `temp-assistant-${Date.now()}`;
      setMessages((prev) => [...prev, tempUser, { id: tempAssistantId, sender: 'assistant', content: '', createdAt: new Date().toISOString() }]);

      const resp = await authService.sendChatMessageStream(
        { taskId: String(taskId), threadId, subject: taskInfo?.subject, message: text },
        { signal: abortRef.current?.signal }
      );

      if (!resp.ok || !resp.body) {
        const fallback = await authService.sendChatMessage({ taskId: String(taskId), threadId, subject: taskInfo?.subject, message: text });
        setThreadId(String(fallback.threadId));
        const content = String(fallback.assistantMessage?.content || '');
        setMessages((prev) => prev.map((m) => (m.id === tempAssistantId ? { ...m, content } : m)));
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let assembled = '';

      const applyDelta = (delta: string) => {
        assembled += delta;
        setMessages((prev) => prev.map((m) => (m.id === tempAssistantId ? { ...m, content: assembled } : m)));
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
              setThreadId(String(payload.threadId));
            } else if (event === 'delta' && typeof payload.delta === 'string') {
              applyDelta(payload.delta);
            } else if (event === 'error' && payload.message) {
              setError(String(payload.message));
            }
          } catch {
            // ignore
          }
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '發送失敗';
      setError(message);
    } finally {
      setSending(false);
    }
  };

  if (!open || !taskId) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl border-4 border-brand-brown shadow-comic-xl flex flex-col">
        <div className="p-5 border-b-4 border-brand-brown bg-[#D2EFFF] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown flex items-center justify-center">
              <Bot className="w-6 h-6 text-brand-brown" />
            </div>
            <div>
              <div className="text-2xl font-black text-brand-brown">BOT 任務</div>
              <div className="text-xs text-gray-600 font-bold">{title}</div>
            </div>
          </div>
          <button
            onClick={() => { abortRef.current?.abort(); onClose(); }}
            className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
            aria-label="關閉"
          >
            <X className="w-6 h-6 text-brand-brown" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col bg-gray-50">
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {loading ? (
              <div className="text-center py-10 text-brand-brown font-bold">載入中...</div>
            ) : error ? (
              <div className="text-center py-10 text-red-600 font-bold">{error}</div>
            ) : (
              <div className="space-y-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
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
            )}
          </div>

          <div className="p-4 border-t-2 border-gray-200 bg-white">
            <div className="flex gap-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="輸入你的問題..."
                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-2xl min-h-[52px] max-h-[140px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!sending) send();
                  }
                }}
              />
              <button
                type="button"
                onClick={send}
                disabled={sending}
                className="px-6 py-3 rounded-2xl border-2 border-brand-brown bg-[#FDEEAD] hover:bg-[#FCE690] font-black text-brand-brown disabled:opacity-60"
              >
                {sending ? '送出中…' : '送出'}
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-500 font-bold">提示：Enter 送出、Shift+Enter 換行。</div>
          </div>
        </div>
      </div>
    </div>
  );
}

