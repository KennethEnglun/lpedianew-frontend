import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Download, RefreshCw, X } from 'lucide-react';
import { MindmapTree, type MindmapGraph } from './student/MindmapTree';

type AiNoteRecord = {
  id: string;
  studentId: string;
  title: string;
  folderId: string | null;
  folderSnapshot: any | null;
  topic: string;
  corrections: Array<{ claim: string; issue: string; correction: string; needsVerification: boolean }>;
  notesMarkdown: string;
  enrichment: string[];
  selfCheck: Array<{ question: string; answer: string }>;
  mindmap: MindmapGraph;
  createdAt: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  authService: any;
};

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

    paragraphBuf.push(line);
  }
  flushParagraph(paragraphBuf);

  let html = out.join('\n');
  for (let i = 0; i < codeBlocks.length; i++) {
    html = html.replace(`@@CODEBLOCK_${i}@@`, codeBlocks[i] || '');
  }
  return html;
};

const downloadSvgAsPng = async (svgEl: SVGSVGElement, filenamePrefix: string) => {
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
        if (!ctx) throw new Error('Canvas 不支援');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((png) => {
          if (!png) {
            reject(new Error('PNG 匯出失敗'));
            return;
          }
          const a = document.createElement('a');
          a.href = URL.createObjectURL(png);
          a.download = `${filenamePrefix}-${Date.now()}.png`;
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
      reject(new Error('SVG 轉換失敗'));
    };
    img.src = url;
  });
};

export const StudentAiNotesModal: React.FC<Props> = ({ open, onClose, authService }) => {
  const [students, setStudents] = useState<any[]>([]);
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<AiNoteRecord[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const exportSvgRef = useRef<SVGSVGElement | null>(null);

  const selectedNote = useMemo(
    () => notes.find((n) => String(n.id) === String(selectedNoteId || '')) || null,
    [notes, selectedNoteId]
  );

  const getFolderPathText = (snapshot: any | null) => {
    const path = Array.isArray(snapshot?.path) ? snapshot.path : [];
    const names = path.map((p: any) => String(p?.name || '').trim()).filter(Boolean);
    return names.join(' / ');
  };

  const loadRoster = async () => {
    try {
      const resp = await authService.getStudentRoster({ limit: 2000 });
      const list = (resp?.users || []).filter((u: any) => u && u.role === 'student');
      setStudents(list);
      if (!studentId && list.length > 0) setStudentId(String(list[0].id));
    } catch (e) {
      setStudents([]);
    }
  };

  const loadNotes = async (sid: string) => {
    if (!sid) return;
    setLoading(true);
    setError('');
    try {
      const resp = await authService.listStudentAiNotes(String(sid));
      const list = Array.isArray(resp?.notes) ? resp.notes : [];
      setNotes(list);
      setSelectedNoteId(list[0]?.id ? String(list[0].id) : null);
    } catch (e) {
      setNotes([]);
      setSelectedNoteId(null);
      setError(e instanceof Error ? e.message : '載入失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setStudents([]);
    setStudentId('');
    setNotes([]);
    setSelectedNoteId(null);
    setError('');
    setLoading(false);
    void loadRoster();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!studentId) return;
    void loadNotes(studentId);
  }, [open, studentId]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-6xl max-h-[92vh] overflow-hidden shadow-comic-xl border-4 border-brand-brown">
        <div className="bg-brand-brown text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-7 h-7" />
            <div className="text-xl font-black">學生 AI筆記</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-all"
            aria-label="關閉"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(92vh-76px)] bg-brand-cream">
          <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="font-black text-brand-brown">選擇學生</div>
                <select
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
                >
                  {students.map((s: any) => (
                    <option key={s.id} value={String(s.id)}>
                      {String(s.profile?.name || s.username || '')}（{String(s.profile?.class || '')}）
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => void loadNotes(studentId)}
                className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                disabled={loading || !studentId}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                重新載入
              </button>
            </div>
            {error ? (
              <div className="mt-3 bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl p-3 font-bold">
                {error}
              </div>
            ) : null}
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1 bg-white rounded-2xl p-4 shadow-comic border-2 border-brand-brown/10">
              <div className="font-black text-brand-brown mb-2">筆記列表</div>
              {loading ? (
                <div className="text-gray-600 font-bold">載入中...</div>
              ) : notes.length === 0 ? (
                <div className="text-gray-600 font-bold">此學生暫無 AI筆記。</div>
              ) : (
                <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                  {notes.slice(0, 300).map((n) => {
                    const selected = String(n.id) === String(selectedNoteId || '');
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => setSelectedNoteId(String(n.id))}
                        className={`w-full text-left rounded-2xl border-2 p-3 transition-all ${
                          selected ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-black text-[#2F2A26]">{n.title || n.topic || 'AI筆記'}</div>
                        <div className="text-xs text-gray-600 font-bold mt-1">
                          {getFolderPathText(n.folderSnapshot) || '未分類'} ｜ {n.createdAt ? new Date(n.createdAt).toLocaleString('zh-HK') : ''}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              {selectedNote ? (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-black text-brand-brown text-lg">{selectedNote.topic}</div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!exportSvgRef.current) return;
                          void downloadSvgAsPng(exportSvgRef.current, 'student-ai-mindmap');
                        }}
                        className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        下載思維圖
                      </button>
                    </div>
                    <div className="text-sm text-gray-600 font-bold mt-2">
                      {getFolderPathText(selectedNote.folderSnapshot) || '未分類'}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                    <div className="font-black text-brand-brown text-lg mb-3">整理筆記</div>
                    <div className="bg-white rounded-2xl border-2 border-gray-100 p-4">
                      <div dangerouslySetInnerHTML={{ __html: markdownToSafeHtml(selectedNote.notesMarkdown) }} />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                    <div className="font-black text-brand-brown text-lg mb-3">思維圖（樹狀）</div>
                    <div className="w-full overflow-x-auto bg-white rounded-2xl border-2 border-gray-100 p-3">
                      <MindmapTree mindmap={selectedNote.mindmap} svgRef={exportSvgRef} dataAttr="teacher-ai-notes" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-6 shadow-comic border-2 border-brand-brown/10 text-gray-600 font-bold">
                  請先從左側選擇一份筆記。
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

