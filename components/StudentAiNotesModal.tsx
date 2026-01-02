import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Download, Hand, Maximize2, LocateFixed, RefreshCw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { MindmapTree, type MindmapGraph } from './student/MindmapTree';
import { compareStudentsByStudentId } from '../utils/studentSort';

type AiNoteRecord = {
  id: string;
  studentId: string;
  title: string;
  folderId: string | null;
  folderSnapshot: any | null;
  sourceText?: string;
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

const markdownToPlainText = (markdown: string) => {
  const s = String(markdown || '');
  return s
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```[^\n]*\n?/, '').replace(/```$/, ''))
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
};

const buildExportText = (note: AiNoteRecord) => {
  const parts: string[] = [];
  parts.push('AI筆記（學生）');
  if (note.topic) parts.push(`主題：${String(note.topic || '').trim()}`);
  parts.push('');

  const src = String(note.sourceText || '').trim();
  if (src) {
    parts.push('一、輸入內容');
    parts.push(src);
    parts.push('');
  }

  parts.push('二、需要修正 / 需要核對');
  const corrections = Array.isArray(note.corrections) ? note.corrections : [];
  if (corrections.length === 0) {
    parts.push('（暫時未見明顯錯誤）');
  } else {
    corrections.slice(0, 20).forEach((c, idx) => {
      const flag = c.needsVerification ? '需要查證' : '建議更正';
      parts.push(`${idx + 1}.（${flag}）${String(c.claim || '').trim()}`);
      if (c.issue) parts.push(`   問題：${String(c.issue || '').trim()}`);
      if (c.correction) parts.push(`   更清楚/正確：${String(c.correction || '').trim()}`);
    });
  }
  parts.push('');

  parts.push('三、整理筆記');
  const notesPlain = markdownToPlainText(note.notesMarkdown || '');
  parts.push(notesPlain.trim() || '（暫無）');
  parts.push('');

  parts.push('四、知識增潤');
  const enrich = Array.isArray(note.enrichment) ? note.enrichment.map((s) => String(s || '').trim()).filter(Boolean) : [];
  if (enrich.length === 0) parts.push('（暫無）');
  else enrich.slice(0, 10).forEach((e) => parts.push(`• ${e}`));
  parts.push('');

  parts.push('五、自我檢查題');
  const qs = Array.isArray(note.selfCheck) ? note.selfCheck : [];
  const cleaned = qs
    .map((q) => ({ question: String(q?.question || '').trim(), answer: String(q?.answer || '').trim() }))
    .filter((q) => q.question && q.answer)
    .slice(0, 10);
  if (cleaned.length === 0) {
    parts.push('（暫無）');
  } else {
    cleaned.forEach((q, idx) => {
      parts.push(`${idx + 1}. ${q.question}`);
      parts.push(`   參考答案：${q.answer}`);
    });
  }
  parts.push('');

  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('PNG 匯出失敗'));
      else resolve(blob);
    }, 'image/png');
  });

const downloadBlob = (blob: Blob, filename: string) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

const wrapLineByChars = (ctx: CanvasRenderingContext2D, line: string, maxWidth: number) => {
  const out: string[] = [];
  let cur = '';
  for (const ch of Array.from(line)) {
    const next = cur + ch;
    if (cur && ctx.measureText(next).width > maxWidth) {
      out.push(cur);
      cur = ch;
    } else {
      cur = next;
    }
  }
  if (cur) out.push(cur);
  return out;
};

const downloadTextAsPngPages = async (opts: { title: string; text: string; filenamePrefix: string }) => {
  const scale = 2;
  const pageW = 1200;
  const pageH = 1700;
  const pad = 64;
  const headerH = 120;
  const footerH = 64;
  const contentW = pageW - pad * 2;
  const contentH = pageH - pad * 2 - headerH - footerH;

  const canvas = document.createElement('canvas');
  canvas.width = pageW * scale;
  canvas.height = pageH * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 不支援');
  ctx.scale(scale, scale);
  ctx.font = '20px system-ui, -apple-system, Segoe UI, Roboto, Arial';

  const rawLines = String(opts.text || '').split('\n');
  const wrapped: string[] = [];
  for (const line of rawLines) {
    const l = line.trimEnd();
    if (!l.trim()) {
      wrapped.push('');
      continue;
    }
    wrapped.push(...wrapLineByChars(ctx, l, contentW));
  }

  const lineH = 30;
  const linesPerPage = Math.max(1, Math.floor(contentH / lineH));
  const totalPages = Math.max(1, Math.ceil(wrapped.length / linesPerPage));
  const now = Date.now();

  for (let page = 0; page < totalPages; page++) {
    const start = page * linesPerPage;
    const lines = wrapped.slice(start, start + linesPerPage);

    const c = document.createElement('canvas');
    c.width = pageW * scale;
    c.height = pageH * scale;
    const g = c.getContext('2d');
    if (!g) throw new Error('Canvas 不支援');
    g.scale(scale, scale);

    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, pageW, pageH);

    g.strokeStyle = '#E6D2B5';
    g.lineWidth = 4;
    g.strokeRect(10, 10, pageW - 20, pageH - 20);

    g.fillStyle = '#5E4C40';
    g.font = '28px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    g.fillText(opts.title, pad, pad + 34);
    g.strokeStyle = '#E6D2B5';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(pad, pad + headerH - 24);
    g.lineTo(pageW - pad, pad + headerH - 24);
    g.stroke();

    g.fillStyle = '#111827';
    g.font = '20px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    let y = pad + headerH;
    for (const ln of lines) {
      if (ln) g.fillText(ln, pad, y);
      y += lineH;
    }

    g.fillStyle = '#6B7280';
    g.font = '16px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    const footer = totalPages > 1 ? `第 ${page + 1} / ${totalPages} 頁` : '';
    if (footer) g.fillText(footer, pad, pageH - pad);

    const blob = await canvasToBlob(c);
    const suffix = totalPages > 1 ? `-${page + 1}` : '';
    downloadBlob(blob, `${opts.filenamePrefix}-${now}${suffix}.png`);
  }
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
  const [className, setClassName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<AiNoteRecord[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const exportSvgRef = useRef<SVGSVGElement | null>(null);
  const [mindmapFullscreen, setMindmapFullscreen] = useState(false);
  const normalViewportRef = useRef<HTMLDivElement | null>(null);
  const fullscreenViewportRef = useRef<HTMLDivElement | null>(null);
  const [mindmapScale, setMindmapScale] = useState(1);
  const [mindmapOffset, setMindmapOffset] = useState({ x: 0, y: 0 });
  const [mindmapDragging, setMindmapDragging] = useState(false);
  const mindmapDragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const selectedNote = useMemo(
    () => notes.find((n) => String(n.id) === String(selectedNoteId || '')) || null,
    [notes, selectedNoteId]
  );

  const classes = useMemo(() => {
    const set = new Set<string>();
    (students || []).forEach((s: any) => {
      const c = String(s?.profile?.class || '').trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  }, [students]);

  const studentsInClass = useMemo(() => {
    if (!className) return [];
    return (students || []).filter((s: any) => String(s?.profile?.class || '').trim() === String(className || '').trim());
  }, [students, className]);

  const getFolderPathText = (snapshot: any | null) => {
    const path = Array.isArray(snapshot?.path) ? snapshot.path : [];
    const names = path.map((p: any) => String(p?.name || '').trim()).filter(Boolean);
    return names.join(' / ');
  };

  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

  const fitMindmap = () => {
    const viewport = (mindmapFullscreen ? fullscreenViewportRef.current : normalViewportRef.current) as HTMLDivElement | null;
    const svg = exportSvgRef.current;
    if (!viewport || !svg) return;
    const vpRect = viewport.getBoundingClientRect();
    const vb = svg.viewBox?.baseVal;
    const svgW = (vb && vb.width) ? vb.width : Number(svg.getAttribute('width')) || 1200;
    const svgH = (vb && vb.height) ? vb.height : Number(svg.getAttribute('height')) || 620;

    const scale = clamp(Math.min(vpRect.width / svgW, vpRect.height / svgH) * 0.95, 0.25, 2.5);
    const x = (vpRect.width - svgW * scale) / 2;
    const y = (vpRect.height - svgH * scale) / 2;
    setMindmapScale(scale);
    setMindmapOffset({ x, y });
  };

  const zoomBy = (factor: number) => {
    const viewport = (mindmapFullscreen ? fullscreenViewportRef.current : normalViewportRef.current) as HTMLDivElement | null;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const nextScale = clamp(mindmapScale * factor, 0.25, 3.5);
    if (Math.abs(nextScale - mindmapScale) < 1e-6) return;

    const contentX = (cx - mindmapOffset.x) / mindmapScale;
    const contentY = (cy - mindmapOffset.y) / mindmapScale;
    const nextOffsetX = cx - contentX * nextScale;
    const nextOffsetY = cy - contentY * nextScale;

    setMindmapScale(nextScale);
    setMindmapOffset({ x: nextOffsetX, y: nextOffsetY });
  };

  useEffect(() => {
    if (!open) return;
    if (!selectedNote?.mindmap) return;
    setMindmapScale(1);
    setMindmapOffset({ x: 0, y: 0 });
    const t = window.setTimeout(() => fitMindmap(), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedNoteId]);

  useEffect(() => {
    if (!mindmapFullscreen) return;
    const t = window.setTimeout(() => fitMindmap(), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mindmapFullscreen]);

  const loadRoster = async () => {
    try {
      const resp = await authService.getStudentRoster({ limit: 2000 });
      const list = (resp?.users || []).filter((u: any) => u && u.role === 'student').sort(compareStudentsByStudentId);
      setStudents(list);
      if (!className && list.length > 0) {
        const firstClass = String(list[0]?.profile?.class || '').trim();
        setClassName(firstClass);
      }
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
    setClassName('');
    setStudentId('');
    setNotes([]);
    setSelectedNoteId(null);
    setError('');
    setLoading(false);
    setMindmapFullscreen(false);
    void loadRoster();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!className) return;
    const list = (students || []).filter((s: any) => String(s?.profile?.class || '').trim() === String(className || '').trim());
    if (list.length > 0) setStudentId(String(list[0].id));
    else setStudentId('');
  }, [open, className, students]);

  useEffect(() => {
    if (!open) return;
    if (!studentId) return;
    void loadNotes(studentId);
  }, [open, studentId]);

  const folderTree = useMemo(() => {
    const getNameAt = (snapshot: any, idx: number) => {
      const path = Array.isArray(snapshot?.path) ? snapshot.path : [];
      return String(path[idx]?.name || '').trim();
    };

    const stageMap = new Map<string, any>();
    const stageOrder: string[] = [];

    const ensureStage = (name: string) => {
      if (!stageMap.has(name)) {
        stageMap.set(name, { name, topicMap: new Map<string, any>(), topicOrder: [] as string[] });
        stageOrder.push(name);
      }
      return stageMap.get(name);
    };
    const ensureTopic = (stage: any, name: string) => {
      if (!stage.topicMap.has(name)) {
        stage.topicMap.set(name, { name, subMap: new Map<string, any>(), subOrder: [] as string[], notes: [] as AiNoteRecord[] });
        stage.topicOrder.push(name);
      }
      return stage.topicMap.get(name);
    };
    const ensureSub = (topic: any, name: string) => {
      if (!topic.subMap.has(name)) {
        topic.subMap.set(name, { name, notes: [] as AiNoteRecord[] });
        topic.subOrder.push(name);
      }
      return topic.subMap.get(name);
    };

    for (const n of notes) {
      const stageName = getNameAt(n.folderSnapshot, 0) || '未分類';
      const topicName = getNameAt(n.folderSnapshot, 1) || (stageName === '未分類' ? '未分類' : '（未分類）');
      const subName = getNameAt(n.folderSnapshot, 2) || '';

      const stage = ensureStage(stageName);
      const topic = ensureTopic(stage, topicName);

      if (!subName) {
        topic.notes.push(n);
      } else {
        const sub = ensureSub(topic, subName);
        sub.notes.push(n);
      }
    }

    const out = stageOrder.map((s) => {
      const stage = stageMap.get(s);
      const topics = stage.topicOrder.map((t) => {
        const topic = stage.topicMap.get(t);
        const subs = topic.subOrder.map((subName: string) => ({ name: subName, notes: topic.subMap.get(subName).notes as AiNoteRecord[] }));
        return { name: t, notes: topic.notes as AiNoteRecord[], subs };
      });
      return { name: s, topics };
    });
    return out;
  }, [notes]);

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
                <div className="font-black text-brand-brown">選擇班別</div>
                <select
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
                >
                  {classes.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <div className="font-black text-brand-brown">選擇學生</div>
                <select
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
                >
                  {studentsInClass.map((s: any) => (
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
              <div className="font-black text-brand-brown mb-2">筆記列表（按資料夾）</div>
              {loading ? (
                <div className="text-gray-600 font-bold">載入中...</div>
              ) : notes.length === 0 ? (
                <div className="text-gray-600 font-bold">此學生暫無 AI筆記。</div>
              ) : (
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {folderTree.map((stage) => (
                    <div key={stage.name}>
                      <div className="text-sm font-black text-[#5E4C40]">{stage.name}</div>
                      <div className="mt-2 space-y-2">
                        {stage.topics.map((topic) => (
                          <div key={`${stage.name}::${topic.name}`} className="pl-2">
                            <div className="text-sm font-bold text-[#2F2A26]">{topic.name}</div>
                            <div className="mt-2 space-y-2">
                              {topic.notes.map((n) => {
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
                                      {n.createdAt ? new Date(n.createdAt).toLocaleString('zh-HK') : ''}
                                    </div>
                                  </button>
                                );
                              })}
                              {topic.subs.map((sub) => (
                                <div key={`${stage.name}::${topic.name}::${sub.name}`} className="pl-2">
                                  <div className="text-xs font-black text-[#8D6E63]">{sub.name}</div>
                                  <div className="mt-2 space-y-2">
                                    {sub.notes.map((n) => {
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
                                            {n.createdAt ? new Date(n.createdAt).toLocaleString('zh-HK') : ''}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              {selectedNote ? (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-black text-brand-brown text-lg">{selectedNote.topic}</div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const text = buildExportText(selectedNote);
                            void downloadTextAsPngPages({ title: `AI筆記：${String(selectedNote.title || selectedNote.topic || 'AI筆記').trim()}`, text, filenamePrefix: 'student-ai-notes' });
                          }}
                          className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          下載筆記圖片
                        </button>
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
                    </div>
                    <div className="text-sm text-gray-600 font-bold mt-2">
                      {getFolderPathText(selectedNote.folderSnapshot) || '未分類'}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                    <div className="font-black text-brand-brown text-lg mb-3">輸入內容</div>
                    <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 whitespace-pre-wrap text-gray-700 font-bold">
                      {String(selectedNote.sourceText || '').trim() || '（未保存）'}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                    <div className="font-black text-brand-brown text-lg mb-3">需要修正 / 需要核對</div>
                    {Array.isArray(selectedNote.corrections) && selectedNote.corrections.length > 0 ? (
                      <div className="space-y-3">
                        {selectedNote.corrections.slice(0, 20).map((c, idx) => (
                          <div key={idx} className="bg-brand-cream rounded-2xl p-4 border-2 border-[#E6D2B5]">
                            <div className="text-sm font-black text-[#5E4C40] mb-1">
                              {c.needsVerification ? '（需要查證）' : '（建議更正）'} {c.claim}
                            </div>
                            {c.issue ? <div className="text-sm text-gray-700"><span className="font-black">問題：</span>{c.issue}</div> : null}
                            {c.correction ? <div className="text-sm text-gray-700 mt-1"><span className="font-black">更清楚/正確：</span>{c.correction}</div> : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-600 font-bold">暫時未見明顯錯誤。</div>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                    <div className="font-black text-brand-brown text-lg mb-3">整理筆記</div>
                    <div className="bg-white rounded-2xl border-2 border-gray-100 p-4">
                      <div dangerouslySetInnerHTML={{ __html: markdownToSafeHtml(selectedNote.notesMarkdown) }} />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                    <div className="font-black text-brand-brown text-lg mb-3">知識增潤</div>
                    {Array.isArray(selectedNote.enrichment) && selectedNote.enrichment.length > 0 ? (
                      <ul className="list-disc pl-6 space-y-2 text-gray-700 font-bold">
                        {selectedNote.enrichment.slice(0, 10).map((e, idx) => (
                          <li key={idx}>{e}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-gray-600 font-bold">暫無增潤內容。</div>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                    <div className="font-black text-brand-brown text-lg mb-3">自我檢查題</div>
                    {Array.isArray(selectedNote.selfCheck) && selectedNote.selfCheck.length > 0 ? (
                      <div className="space-y-3">
                        {selectedNote.selfCheck.slice(0, 10).map((q, idx) => (
                          <div key={idx} className="bg-brand-cream rounded-2xl p-4 border-2 border-[#E6D2B5]">
                            <div className="font-black text-[#2F2A26]">{idx + 1}. {q.question}</div>
                            <div className="text-sm text-gray-700 mt-2">
                              <span className="font-black">參考答案：</span>{q.answer}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-600 font-bold">暫無自我檢查題。</div>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                    <div className="font-black text-brand-brown text-lg mb-3">思維圖（樹狀）</div>
                    <div className="bg-white rounded-2xl border-2 border-gray-100 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="text-sm text-gray-600 font-bold inline-flex items-center gap-2">
                          <Hand className="w-4 h-4" />
                          拖曳移動｜{Math.round(mindmapScale * 100)}%
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => zoomBy(1 / 1.2)}
                            className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                          >
                            <ZoomOut className="w-4 h-4" />
                            縮小
                          </button>
                          <button
                            type="button"
                            onClick={() => zoomBy(1.2)}
                            className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                          >
                            <ZoomIn className="w-4 h-4" />
                            放大
                          </button>
                          <button
                            type="button"
                            onClick={() => fitMindmap()}
                            className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                          >
                            <LocateFixed className="w-4 h-4" />
                            置中
                          </button>
                          <button
                            type="button"
                            onClick={() => setMindmapFullscreen(true)}
                            className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                          >
                            <Maximize2 className="w-4 h-4" />
                            全螢幕
                          </button>
                        </div>
                      </div>

                      <div
                        ref={normalViewportRef}
                        className={`relative w-full h-[420px] overflow-hidden rounded-2xl border-2 border-[#E6D2B5] bg-white ${mindmapDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                        style={{ touchAction: 'none' }}
                        onPointerDown={(e) => {
                          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                          setMindmapDragging(true);
                          mindmapDragStartRef.current = { x: e.clientX, y: e.clientY, ox: mindmapOffset.x, oy: mindmapOffset.y };
                        }}
                        onPointerMove={(e) => {
                          const start = mindmapDragStartRef.current;
                          if (!start) return;
                          const dx = e.clientX - start.x;
                          const dy = e.clientY - start.y;
                          setMindmapOffset({ x: start.ox + dx, y: start.oy + dy });
                        }}
                        onPointerUp={() => {
                          setMindmapDragging(false);
                          mindmapDragStartRef.current = null;
                        }}
                        onPointerCancel={() => {
                          setMindmapDragging(false);
                          mindmapDragStartRef.current = null;
                        }}
                      >
                        <div
                          className="absolute left-0 top-0 will-change-transform"
                          style={{ transform: `translate(${mindmapOffset.x}px, ${mindmapOffset.y}px) scale(${mindmapScale})`, transformOrigin: '0 0' }}
                        >
                          <MindmapTree mindmap={selectedNote.mindmap} dataAttr="teacher-ai-notes" />
                        </div>
                      </div>

                      <div className="hidden">
                        <MindmapTree mindmap={selectedNote.mindmap} svgRef={exportSvgRef} dataAttr="teacher-ai-notes-export" />
                      </div>
                    </div>
                  </div>

                  {mindmapFullscreen ? (
                    <div className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-4">
                      <div className="bg-white rounded-3xl w-full h-full max-w-[98vw] max-h-[96vh] overflow-hidden shadow-comic-xl border-4 border-brand-brown">
                        <div className="bg-brand-brown text-white p-4 flex items-center justify-between">
                          <div className="font-black">{selectedNote.topic}</div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (!exportSvgRef.current) return;
                                void downloadSvgAsPng(exportSvgRef.current, 'student-ai-mindmap');
                              }}
                              className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded-xl font-bold inline-flex items-center gap-2"
                            >
                              <Download className="w-4 h-4" />
                              下載思維圖
                            </button>
                            <button
                              type="button"
                              onClick={() => setMindmapFullscreen(false)}
                              className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-all"
                              aria-label="關閉"
                            >
                              <X className="w-6 h-6" />
                            </button>
                          </div>
                        </div>
                        <div className="p-4 bg-white h-[calc(96vh-70px)] flex flex-col gap-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm text-gray-600 font-bold inline-flex items-center gap-2">
                              <Hand className="w-4 h-4" />
                              拖曳移動｜{Math.round(mindmapScale * 100)}%
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => zoomBy(1 / 1.2)}
                                className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                              >
                                <ZoomOut className="w-4 h-4" />
                                縮小
                              </button>
                              <button
                                type="button"
                                onClick={() => zoomBy(1.2)}
                                className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                              >
                                <ZoomIn className="w-4 h-4" />
                                放大
                              </button>
                              <button
                                type="button"
                                onClick={() => fitMindmap()}
                                className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                              >
                                <LocateFixed className="w-4 h-4" />
                                置中
                              </button>
                            </div>
                          </div>

                          <div
                            ref={fullscreenViewportRef}
                            className={`relative w-full flex-1 overflow-hidden rounded-2xl border-2 border-[#E6D2B5] bg-white ${mindmapDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                            style={{ touchAction: 'none' }}
                            onPointerDown={(e) => {
                              (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                              setMindmapDragging(true);
                              mindmapDragStartRef.current = { x: e.clientX, y: e.clientY, ox: mindmapOffset.x, oy: mindmapOffset.y };
                            }}
                            onPointerMove={(e) => {
                              const start = mindmapDragStartRef.current;
                              if (!start) return;
                              const dx = e.clientX - start.x;
                              const dy = e.clientY - start.y;
                              setMindmapOffset({ x: start.ox + dx, y: start.oy + dy });
                            }}
                            onPointerUp={() => {
                              setMindmapDragging(false);
                              mindmapDragStartRef.current = null;
                            }}
                            onPointerCancel={() => {
                              setMindmapDragging(false);
                              mindmapDragStartRef.current = null;
                            }}
                          >
                            <div
                              className="absolute left-0 top-0 will-change-transform"
                              style={{ transform: `translate(${mindmapOffset.x}px, ${mindmapOffset.y}px) scale(${mindmapScale})`, transformOrigin: '0 0' }}
                            >
                              <MindmapTree mindmap={selectedNote.mindmap} dataAttr="teacher-ai-notes-fullscreen" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
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
