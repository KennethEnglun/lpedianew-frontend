import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Check, Copy, Folder, FolderPlus, Image as ImageIcon, Pencil, Search, Trash2, X } from 'lucide-react';
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
  const [mySidebarView, setMySidebarView] = useState<'chat' | 'bot' | 'image'>('chat');
  const [myChatBotId, setMyChatBotId] = useState<string>('global'); // teacher-only: 'global' = 自由聊天
  const [myBots, setMyBots] = useState<any[]>([]);
  const [myThreadId, setMyThreadId] = useState<string | null>(null);
  const [myThreads, setMyThreads] = useState<any[]>([]);
  const [myThreadSearch, setMyThreadSearch] = useState('');
  const [myFolders, setMyFolders] = useState<any[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all'); // 'all' | 'filed' | 'unfiled' | folderId
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingThreadTitle, setEditingThreadTitle] = useState('');
  const [myMessages, setMyMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [myLoading, setMyLoading] = useState(false);
  const [myError, setMyError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [creatingBot, setCreatingBot] = useState(false);
  const [newBotName, setNewBotName] = useState('');
  const [newBotPrompt, setNewBotPrompt] = useState('');
  const [editingBotId, setEditingBotId] = useState<string | null>(null);
  const [editingBotName, setEditingBotName] = useState('');
  const [editingBotPrompt, setEditingBotPrompt] = useState('');

  // Image generation
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageSize, setImageSize] = useState<'256x256' | '512x512' | '1024x1024'>('1024x1024');
  const [imageCount, setImageCount] = useState<1 | 2 | 3 | 4>(1);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState('');

  // Teacher view
  const [studentSearch, setStudentSearch] = useState('');
  const [studentThreads, setStudentThreads] = useState<any[]>([]);
  const [studentLoading, setStudentLoading] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedStudentInfo, setSelectedStudentInfo] = useState<any>(null);
  const [studentMessages, setStudentMessages] = useState<ChatMessage[]>([]);
  const [studentError, setStudentError] = useState('');

  // myChatBotId is used for teacher's "Pedia聊天" context; UI stays in Pedia tab.
  const effectiveTeacherBotId = isTeacher ? (mySidebarView === 'bot' ? myChatBotId : 'global') : 'global';

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
      setMySidebarView('chat');
      setMyChatBotId('global');
    } else {
      const initial = defaultSubject || String(Subject.CHINESE);
      setSubject(String(initial || Subject.CHINESE));
      setTab('my');
      setMySidebarView('chat');
      setMyChatBotId('global');
    }
  }, [defaultSubject, isTeacher, open, teacherSubjects]);

  const loadMyChat = async (nextSubject: string, nextBotId: string) => {
    try {
      setMyLoading(true);
      setMyError('');
      setMyMessages([]);
      const foldersResp = await authService.getMyChatFolders();
      setMyFolders(Array.isArray(foldersResp.folders) ? foldersResp.folders : []);

      if (isTeacher) {
        try {
          const botsResp = await authService.getMyChatBots();
          setMyBots(Array.isArray(botsResp.bots) ? botsResp.bots : []);
        } catch {
          setMyBots([]);
        }
      } else {
        setMyBots([]);
      }

      const threadsResp = isTeacher
        ? await authService.getMyChatThreads(mySidebarView === 'chat' ? { botId: 'all' } : (nextBotId === 'global' ? undefined : { botId: nextBotId }))
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

  const openMyThread = async (threadId: string, thread?: any) => {
    try {
      abortRef.current?.abort();
      setMyLoading(true);
      setMyError('');

      if (isTeacher) {
        const t = thread || myThreads.find((x: any) => String(x?.id) === String(threadId));
        const nextBot = String(t?.botId || 'global');
        if (nextBot && nextBot !== 'global') {
          setMyChatBotId(nextBot);
          setSelectedFolderId('all');
          setMySidebarView('bot');
        } else {
          setMySidebarView('chat');
        }
      }

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
      const resp = await authService.createMyChatThread({
        subject: isTeacher ? undefined : subject,
        ...(isTeacher && effectiveTeacherBotId !== 'global' ? { botId: effectiveTeacherBotId } : null)
      });
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
    if (tab === 'my') loadMyChat(subject, effectiveTeacherBotId);
    else loadTeacherThreads(subject);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, subject, tab, effectiveTeacherBotId]);

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

  const generateImage = async () => {
    const prompt = String(imagePrompt || '').trim();
    if (!prompt) {
      setImageError('請輸入圖片描述');
      return;
    }
    try {
      setImageLoading(true);
      setImageError('');
      setImageUrls([]);
      const resp = await authService.generateImage({ prompt, n: imageCount, size: imageSize });
      setImageUrls(Array.isArray(resp.images) ? resp.images : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : '圖片生成失敗';
      setImageError(message);
    } finally {
      setImageLoading(false);
    }
  };

  const renameThread = async (threadId: string, title: string) => {
    const nextTitle = String(title || '').trim();
    if (!nextTitle) return;
    const resp = await authService.updateMyChatThread(threadId, { title: nextTitle });
    const updated = resp.thread;
    setMyThreads((prev) => prev.map((t) => (String(t.id) === String(threadId) ? updated : t)));
    setEditingThreadId(null);
    setEditingThreadTitle('');
  };

  const deleteThread = async (threadId: string) => {
    if (!confirm('確定要刪除這個對話嗎？此操作無法復原。')) return;
    await authService.deleteMyChatThread(threadId);
    setMyThreads((prev) => prev.filter((t) => String(t.id) !== String(threadId)));
    if (String(myThreadId) === String(threadId)) {
      setMyThreadId(null);
      setMyMessages([]);
    }
  };

  const moveThreadToFolder = async (threadId: string, folderId: string | null) => {
    const resp = await authService.updateMyChatThread(threadId, { folderId: folderId || null });
    const updated = resp.thread;
    setMyThreads((prev) => prev.map((t) => (String(t.id) === String(threadId) ? updated : t)));
  };

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    const resp = await authService.createMyChatFolder({ name });
    setMyFolders((prev) => [...prev, resp.folder].sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-Hant')));
    setCreatingFolder(false);
    setNewFolderName('');
  };

  const renameFolder = async (folderId: string, name: string) => {
    const next = name.trim();
    if (!next) return;
    const resp = await authService.updateMyChatFolder(folderId, { name: next });
    setMyFolders((prev) => prev.map((f) => (String(f.id) === String(folderId) ? resp.folder : f)).sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-Hant')));
    setEditingFolderId(null);
    setEditingFolderName('');
  };

  const deleteFolder = async (folderId: string) => {
    if (!confirm('確定要刪除此資料夾嗎？資料夾內的對話會移到「未分類」。')) return;
    await authService.deleteMyChatFolder(folderId);
    setMyFolders((prev) => prev.filter((f) => String(f.id) !== String(folderId)));
    setMyThreads((prev) => prev.map((t) => (t.folderId === folderId ? { ...t, folderId: null } : t)));
    if (selectedFolderId === folderId) setSelectedFolderId('all');
  };

  const createBot = async () => {
    const name = String(newBotName || '').trim();
    const prompt = String(newBotPrompt || '').trim();
    if (!name) return;
    const resp = await authService.createMyChatBot({ name, prompt });
    setMyBots((prev) => [resp.bot, ...prev]);
    setCreatingBot(false);
    setNewBotName('');
    setNewBotPrompt('');
  };

  const startEditBot = (bot: any) => {
    setEditingBotId(String(bot?.id));
    setEditingBotName(String(bot?.name || ''));
    setEditingBotPrompt(String(bot?.prompt || ''));
  };

  const saveBot = async (botId: string) => {
    const name = String(editingBotName || '').trim();
    const prompt = String(editingBotPrompt || '').trim();
    if (!name) return;
    const resp = await authService.updateMyChatBot(botId, { name, prompt });
    setMyBots((prev) => prev.map((b) => (String(b?.id) === String(botId) ? resp.bot : b)));
    setEditingBotId(null);
    setEditingBotName('');
    setEditingBotPrompt('');
  };

  const removeBot = async (botId: string) => {
    if (!confirm('確定要刪除這個 Pedia 嗎？（不會刪除已存在的對話記錄）')) return;
    await authService.deleteMyChatBot(botId);
    setMyBots((prev) => prev.filter((b) => String(b?.id) !== String(botId)));
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
        {
          subject: isTeacher ? undefined : subject,
          threadId: myThreadId,
          ...(isTeacher && effectiveTeacherBotId !== 'global' ? { botId: effectiveTeacherBotId } : null),
          message: text
        },
        { signal: abortRef.current?.signal }
      );
      if (!streamResp.ok || !streamResp.body) {
        const fallback = await authService.sendChatMessage({
          subject: isTeacher ? undefined : subject,
          threadId: myThreadId,
          ...(isTeacher && effectiveTeacherBotId !== 'global' ? { botId: effectiveTeacherBotId } : null),
          message: text
        });
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
        const threadsResp = isTeacher
          ? await authService.getMyChatThreads(mySidebarView === 'chat' ? { botId: 'all' } : (effectiveTeacherBotId === 'global' ? undefined : { botId: effectiveTeacherBotId }))
          : await authService.getMyChatThreads({ subject });
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
		              {mySidebarView !== 'image' && (
		                <>
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
		                </>
		              )}

	              <div className="space-y-2 mb-4">
	                <button
	                  type="button"
	                  onClick={() => {
	                    setMyThreadId(null);
	                    setMyMessages([]);
	                    setMyThreadSearch('');
	                    setSelectedFolderId('all');
	                    setMySidebarView('chat');
	                  }}
	                  className={`w-full px-3 py-2 rounded-2xl border-2 font-black text-left ${mySidebarView === 'chat'
	                    ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown'
	                    : 'bg-white border-gray-200 text-gray-700 hover:border-brand-brown'
	                    }`}
		                >
		                  自由聊天
		                </button>
		                <button
		                  type="button"
		                  onClick={() => {
		                    abortRef.current?.abort();
		                    setImageError('');
		                    setMyError('');
		                    setMyThreadSearch('');
		                    setSelectedFolderId('all');
		                    setMySidebarView('image');
		                  }}
		                  className={`w-full px-3 py-2 rounded-2xl border-2 font-black text-left ${mySidebarView === 'image'
		                    ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown'
		                    : 'bg-white border-gray-200 text-gray-700 hover:border-brand-brown'
		                    }`}
		                >
		                  圖片生成
		                </button>
		                {isTeacher ? (
		                  <button
		                    type="button"
		                    onClick={() => { setSelectedFolderId('all'); setMySidebarView('bot'); }}
	                    className={`w-full px-3 py-2 rounded-2xl border-2 font-black text-left ${mySidebarView === 'bot'
	                      ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown'
	                      : 'bg-white border-gray-200 text-gray-700 hover:border-brand-brown'
	                      }`}
	                  >
	                    Pedia
	                  </button>
	                ) : (
	                  <div className="px-3 py-2 rounded-2xl bg-white border-2 border-gray-200 text-gray-400 font-black">Pedia（教師專用）</div>
	                )}
	              </div>

	              {isTeacher && mySidebarView === 'bot' && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
	                    <div className="text-xs font-black text-gray-600">我的 Pedia</div>
	                    <button
	                      type="button"
	                      onClick={() => setCreatingBot((v) => !v)}
	                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 bg-white hover:border-brand-brown text-xs font-black text-gray-700"
	                      title="新增 Pedia"
	                    >
	                      <Bot className="w-4 h-4" />
	                      新增
	                    </button>
	                  </div>

                  {creatingBot && (
                    <div className="space-y-2 mb-2">
	                      <input
	                        value={newBotName}
	                        onChange={(e) => setNewBotName(e.target.value)}
	                        placeholder="Pedia 名稱"
	                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl"
	                      />
	                      <textarea
	                        value={newBotPrompt}
	                        onChange={(e) => setNewBotPrompt(e.target.value)}
	                        placeholder="Pedia 指令（可選）"
	                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl min-h-[110px]"
	                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={createBot}
                          className="flex-1 px-3 py-2 rounded-xl border-2 border-brand-brown bg-[#FDEEAD] font-black text-brand-brown"
                        >
                          建立
                        </button>
                        <button
                          type="button"
                          onClick={() => { setCreatingBot(false); setNewBotName(''); setNewBotPrompt(''); }}
                          className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white font-black text-gray-700"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {myBots.map((b: any) => (
                      <div
                        key={b.id}
                        className={`w-full px-3 py-2 rounded-2xl border-2 bg-white border-gray-200 group ${editingBotId === String(b.id) ? '' : 'cursor-pointer hover:border-brand-brown'}`}
                        role="button"
                        tabIndex={0}
	                        onClick={() => {
	                          if (editingBotId === String(b.id)) return;
	                          setMyChatBotId(String(b.id));
	                          setMyThreadId(null);
	                          setMyMessages([]);
	                          setMyThreadSearch('');
	                          setSelectedFolderId('all');
	                        }}
	                        onKeyDown={(e) => {
	                          if (editingBotId === String(b.id)) return;
	                          if (e.key === 'Enter' || e.key === ' ') {
	                            e.preventDefault();
	                            setMyChatBotId(String(b.id));
	                            setMyThreadId(null);
	                            setMyMessages([]);
	                            setMyThreadSearch('');
	                            setSelectedFolderId('all');
	                          }
	                        }}
	                        aria-label={`使用 Pedia 聊天：${String(b?.name || '')}`}
	                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 flex items-start gap-2 text-left font-black text-gray-800">
                            <Bot className="w-4 h-4 mt-0.5" />
                            {editingBotId === String(b.id) ? (
                              <div className="flex-1 space-y-2">
	                                <input
	                                  value={editingBotName}
	                                  onChange={(e) => setEditingBotName(e.target.value)}
	                                  onClick={(e) => e.stopPropagation()}
	                                  className="w-full px-2 py-1 border border-gray-300 rounded"
	                                  placeholder="Pedia 名稱"
	                                />
	                                <textarea
	                                  value={editingBotPrompt}
	                                  onChange={(e) => setEditingBotPrompt(e.target.value)}
	                                  onClick={(e) => e.stopPropagation()}
	                                  className="w-full px-2 py-1 border border-gray-300 rounded min-h-[90px]"
	                                  placeholder="Pedia 指令（可選）"
	                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); saveBot(String(b.id)); }}
                                    className="flex-1 px-2 py-1 rounded-lg border border-brand-brown bg-[#FDEEAD] text-brand-brown font-black text-xs"
                                  >
                                    儲存
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setEditingBotId(null); setEditingBotName(''); setEditingBotPrompt(''); }}
                                    className="px-2 py-1 rounded-lg border border-gray-300 bg-white text-gray-700 font-black text-xs"
                                  >
                                    取消
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <span className="flex-1">{b.name}</span>
                            )}
                          </div>

                          {editingBotId !== String(b.id) && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); startEditBot(b); }}
                                className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 rounded hover:bg-gray-100"
                                title="編輯"
                              >
                                <Pencil className="w-4 h-4 text-gray-700" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); removeBot(String(b.id)); }}
                                className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 rounded hover:bg-gray-100"
                                title="刪除"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {myBots.length === 0 && (
                      <div className="text-sm text-gray-500 font-bold px-3 py-2">
	                        目前未建立任何 Pedia
	                      </div>
	                    )}
                  </div>
                </div>
              )}

	              {mySidebarView === 'chat' && (
	              <div className="mb-4">
	                <div className="flex items-center justify-between mb-2">
	                  <div className="text-xs font-black text-gray-600">資料夾</div>
                  <button
                    type="button"
                    onClick={() => setCreatingFolder((v) => !v)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 bg-white hover:border-brand-brown text-xs font-black text-gray-700"
                    title="新增資料夾"
                  >
                    <FolderPlus className="w-4 h-4" />
                    新增
                  </button>
                </div>

                {creatingFolder && (
                  <div className="flex gap-2 mb-2">
                    <input
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="資料夾名稱"
                      className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={createFolder}
                      className="px-3 py-2 rounded-xl border-2 border-brand-brown bg-[#FDEEAD] font-black text-brand-brown"
                    >
                      建立
                    </button>
                  </div>
                )}

	                <div className="space-y-2">
	                  <button
	                    type="button"
	                    onClick={() => setSelectedFolderId('all')}
	                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-2xl border-2 font-black ${selectedFolderId === 'all'
	                      ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown'
	                      : 'bg-white border-gray-200 text-gray-700 hover:border-brand-brown'
	                      }`}
	                  >
	                    <Folder className="w-4 h-4" />
	                    全部
	                  </button>
	                  <button
	                    type="button"
	                    onClick={() => setSelectedFolderId('filed')}
	                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-2xl border-2 font-black ${selectedFolderId === 'filed'
	                      ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown'
	                      : 'bg-white border-gray-200 text-gray-700 hover:border-brand-brown'
	                      }`}
	                  >
	                    <Folder className="w-4 h-4" />
	                    已分類
	                  </button>
	                  <button
	                    type="button"
	                    onClick={() => setSelectedFolderId('unfiled')}
	                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-2xl border-2 font-black ${selectedFolderId === 'unfiled'
	                      ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown'
	                      : 'bg-white border-gray-200 text-gray-700 hover:border-brand-brown'
                      }`}
                  >
                    <Folder className="w-4 h-4" />
                    未分類
                  </button>
                  {myFolders.map((f: any) => (
                    <div key={f.id} className={`w-full px-3 py-2 rounded-2xl border-2 ${selectedFolderId === f.id ? 'bg-[#FDEEAD] border-brand-brown' : 'bg-white border-gray-200'} group`}>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedFolderId(String(f.id))}
                          className={`flex-1 flex items-center gap-2 text-left font-black ${selectedFolderId === f.id ? 'text-brand-brown' : 'text-gray-800'}`}
                        >
                          <Folder className="w-4 h-4" />
                          {editingFolderId === f.id ? (
                            <input
                              value={editingFolderName}
                              onChange={(e) => setEditingFolderName(e.target.value)}
                              className="flex-1 px-2 py-1 border border-gray-300 rounded"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') renameFolder(String(f.id), editingFolderName);
                                if (e.key === 'Escape') { setEditingFolderId(null); setEditingFolderName(''); }
                              }}
                              autoFocus
                            />
                          ) : (
                            <span className="flex-1">{f.name}</span>
                          )}
                        </button>
                        {editingFolderId !== f.id && (
                          <>
                            <button
                              type="button"
                              onClick={() => { setEditingFolderId(String(f.id)); setEditingFolderName(String(f.name || '')); }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100"
                              title="改名"
                            >
                              <Pencil className="w-4 h-4 text-gray-700" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteFolder(String(f.id))}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100"
                              title="刪除"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </>
                        )}
                        {editingFolderId === f.id && (
                          <button
                            type="button"
                            onClick={() => renameFolder(String(f.id), editingFolderName)}
                            className="p-1 rounded hover:bg-gray-100"
                            title="儲存"
                          >
                            <Check className="w-4 h-4 text-green-700" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )}

	              {mySidebarView !== 'image' && (
	                <>
	                  <div className="text-xs font-black text-gray-600 mb-2">歷史</div>
	                  <div className="space-y-2">
		                {(() => {
		                  const q = myThreadSearch.trim().toLowerCase();
		                  const filtered = myThreads.filter((t: any) => {
		                    const title = String(t?.title || '新對話').toLowerCase();
	                    const folderOk = (() => {
	                      if (selectedFolderId === 'all') return true;
	                      if (selectedFolderId === 'filed') return !!t.folderId;
	                      if (selectedFolderId === 'unfiled') return !t.folderId;
	                      return String(t.folderId || '') === String(selectedFolderId);
	                    })();
	                    return folderOk && (!q || title.includes(q));
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
	                              onClick={() => openMyThread(String(t.id), t)}
	                              className={`w-full text-left px-3 py-3 rounded-2xl border-2 transition-colors ${String(t.id) === String(myThreadId)
	                                ? 'bg-[#FDEEAD] border-brand-brown'
	                                : 'bg-gray-50 border-gray-200 hover:border-brand-brown'
	                                }`}
	                            >
                              <div className="flex items-start gap-2 group">
                                {editingThreadId === String(t.id) ? (
                                  <input
                                    value={editingThreadTitle}
                                    onChange={(e) => setEditingThreadTitle(e.target.value)}
                                    className="flex-1 px-2 py-1 border border-gray-300 rounded"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') renameThread(String(t.id), editingThreadTitle);
                                      if (e.key === 'Escape') { setEditingThreadId(null); setEditingThreadTitle(''); }
                                    }}
                                    autoFocus
                                  />
                                ) : (
                                  <div className="flex-1 font-black text-gray-800 line-clamp-2">{t.title || '新對話'}</div>
                                )}
                                {editingThreadId !== String(t.id) && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setEditingThreadId(String(t.id)); setEditingThreadTitle(String(t.title || '新對話')); }}
                                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white"
                                      title="改名"
                                    >
                                      <Pencil className="w-4 h-4 text-gray-700" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); deleteThread(String(t.id)); }}
                                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white"
                                      title="刪除"
                                    >
                                      <Trash2 className="w-4 h-4 text-red-600" />
                                    </button>
                                  </>
                                )}
                                {editingThreadId === String(t.id) && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); renameThread(String(t.id), editingThreadTitle); }}
                                    className="p-1 rounded hover:bg-white"
                                    title="儲存"
                                  >
                                    <Check className="w-4 h-4 text-green-700" />
                                  </button>
                                )}
                              </div>
                              <div className="text-[11px] text-gray-500 mt-1">
                                {t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleString() : ''}
                              </div>
                              {String(t.id) === String(myThreadId) && (
                                <div className="mt-2">
                                  <label className="block text-[11px] font-black text-gray-600 mb-1">放入資料夾</label>
                                  <select
                                    value={t.folderId || ''}
                                    onChange={(e) => moveThreadToFolder(String(t.id), e.target.value ? e.target.value : null)}
                                    className="w-full px-2 py-2 border-2 border-gray-300 rounded-xl bg-white text-sm"
                                  >
                                    <option value="">未分類</option>
                                    {myFolders.map((f: any) => (
                                      <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
	                  });
	                })()}
	                  </div>
	                </>
	              )}
            </aside>

	            {/* Right Chat */}
	            <div className="flex-1 min-h-0 flex flex-col">
	              {mySidebarView === 'image' ? (
	                <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
	                  <div className="flex items-center gap-2">
	                    <ImageIcon className="w-5 h-5 text-brand-brown" />
	                    <div className="text-xl font-black text-brand-brown">圖片生成</div>
	                  </div>

	                  <div>
	                    <label className="block text-xs font-black text-gray-600 mb-1">描述</label>
	                    <textarea
	                      value={imagePrompt}
	                      onChange={(e) => setImagePrompt(e.target.value)}
	                      className="w-full min-h-[80px] max-h-56 px-3 py-2 border-2 border-gray-300 rounded-2xl focus:outline-none focus:border-brand-brown"
	                      placeholder="例如：一隻可愛的貓咪在教室裡寫作業，卡通風格，色彩明亮"
	                    />
	                  </div>

	                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
	                    <div>
	                      <label className="block text-xs font-black text-gray-600 mb-1">尺寸</label>
	                      <select
	                        value={imageSize}
	                        onChange={(e) => setImageSize(e.target.value as any)}
	                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-2xl bg-white"
	                      >
	                        <option value="256x256">256×256</option>
	                        <option value="512x512">512×512</option>
	                        <option value="1024x1024">1024×1024</option>
	                      </select>
	                    </div>
	                    <div>
	                      <label className="block text-xs font-black text-gray-600 mb-1">張數</label>
	                      <select
	                        value={String(imageCount)}
	                        onChange={(e) => setImageCount(Number(e.target.value) as any)}
	                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-2xl bg-white"
	                      >
	                        <option value="1">1</option>
	                        <option value="2">2</option>
	                        <option value="3">3</option>
	                        <option value="4">4</option>
	                      </select>
	                    </div>
	                    <div className="flex items-end">
	                      <Button
	                        className={`w-full border-brand-brown ${imageLoading ? 'bg-gray-300 text-gray-600 cursor-wait' : 'bg-[#FDEEAD] text-brand-brown hover:bg-[#FCE690]'}`}
	                        onClick={generateImage}
	                        disabled={imageLoading}
	                      >
	                        {imageLoading ? '生成中...' : '生成'}
	                      </Button>
	                    </div>
	                  </div>

	                  {imageError && (
	                    <div className="text-sm font-bold text-red-700 bg-red-50 border-2 border-red-200 rounded-2xl p-3">
	                      {imageError}
	                    </div>
	                  )}

	                  {imageUrls.length > 0 && (
	                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
	                      {imageUrls.map((src, idx) => (
	                        <div key={`${idx}-${src.slice(0, 24)}`} className="bg-white border-2 border-gray-200 rounded-2xl p-3">
	                          <img src={src} alt={`generated-${idx + 1}`} className="w-full h-auto rounded-xl border border-gray-200" />
	                          <div className="mt-3 flex justify-end">
	                            <a
	                              href={src}
	                              download={`pedia-image-${idx + 1}.png`}
	                              target="_blank"
	                              rel="noreferrer"
	                              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border-2 border-brand-brown bg-white text-brand-brown font-black hover:bg-[#FDEEAD]"
	                            >
	                              下載
	                            </a>
	                          </div>
	                        </div>
	                      ))}
	                    </div>
	                  )}
	                </div>
	              ) : (
	                <>
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
	                </>
	              )}
	            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiChatModal;
