import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Brain, Download, Hand, LocateFixed, RefreshCw, Send, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';
import Button from '../Button';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import { MindmapTree, type MindmapGraph } from './MindmapTree';

type AiNotesResult = {
  topic: string;
  corrections: Array<{ claim: string; issue: string; correction: string; needsVerification: boolean }>;
  notesMarkdown: string;
  enrichment: string[];
  selfCheck: Array<{ question: string; answer: string }>;
  mindmap: MindmapGraph;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onExportToSelfStudy?: (payload: { content: string; difficulty?: string }) => void;
};

type AiNoteRecord = AiNotesResult & {
  id: string;
  title: string;
  folderId: string | null;
  folderSnapshot: any | null;
  sourceText?: string;
  createdAt: string;
  updatedAt: string;
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
        const cells = splitTableRow(rowLine).map((c) => `<td class="px-3 py-2 border border-gray-300">${inlineToHtml(c)}</td>`);
        bodyRows.push(`<tr>${cells.join('')}</tr>`);
      }

      out.push(
        `<div class="overflow-x-auto"><table class="border-collapse w-full text-sm"><thead><tr>${headerCells.join('')}</tr></thead><tbody>${bodyRows.join('')}</tbody></table></div>`
      );
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

const buildExportText = (result: AiNotesResult, opts?: { includeEnrichment?: boolean; includeSelfCheck?: boolean }) => {
  const includeEnrichment = opts?.includeEnrichment !== false;
  const includeSelfCheck = opts?.includeSelfCheck === true;

  const parts: string[] = [];
  const topic = String(result.topic || '').trim();
  if (topic) parts.push(`主題：${topic}`);

  const notesPlain = markdownToPlainText(result.notesMarkdown || '');
  if (notesPlain.trim()) parts.push(`\n整理筆記：\n${notesPlain.trim()}`);

  if (includeEnrichment) {
    const enrich = Array.isArray(result.enrichment) ? result.enrichment.map((s) => String(s || '').trim()).filter(Boolean) : [];
    if (enrich.length > 0) {
      parts.push('\n知識增潤：');
      for (const e of enrich) parts.push(`• ${e}`);
    }
  }

  if (includeSelfCheck) {
    const qs = Array.isArray(result.selfCheck) ? result.selfCheck : [];
    const cleaned = qs
      .map((q) => ({ question: String(q?.question || '').trim(), answer: String(q?.answer || '').trim() }))
      .filter((q) => q.question && q.answer)
      .slice(0, 5);
    if (cleaned.length > 0) {
      parts.push('\n自我檢查：');
      cleaned.forEach((q, idx) => {
        parts.push(`${idx + 1}. ${q.question}`);
        parts.push(`   參考答案：${q.answer}`);
      });
    }
  }

  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
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

const downloadTextAsPngPages = async (opts: { title: string; text: string; filenamePrefix: string }) => {
  const scale = 2;
  const pageW = 1200;
  const pageH = 1700;
  const pad = 64;
  const headerH = 120;
  const footerH = 64;
  const contentW = pageW - pad * 2;
  const contentH = pageH - pad * 2 - headerH - footerH;

  // Build wrapped lines
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

    // background
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, pageW, pageH);

    // border
    g.strokeStyle = '#E6D2B5';
    g.lineWidth = 4;
    g.strokeRect(10, 10, pageW - 20, pageH - 20);

    // title
    g.fillStyle = '#5E4C40';
    g.font = '28px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    g.fillText(opts.title, pad, pad + 34);
    g.strokeStyle = '#E6D2B5';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(pad, pad + headerH - 24);
    g.lineTo(pageW - pad, pad + headerH - 24);
    g.stroke();

    // text
    g.fillStyle = '#111827';
    g.font = '20px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    let y = pad + headerH;
    for (const ln of lines) {
      if (ln) g.fillText(ln, pad, y);
      y += lineH;
    }

    // footer
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
          downloadBlob(png, `${filenamePrefix}-${Date.now()}.png`);
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

export const AiNotesModal: React.FC<Props> = ({ open, onClose, onExportToSelfStudy }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<'create' | 'library'>('create');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedResult, setGeneratedResult] = useState<AiNotesResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [foldersError, setFoldersError] = useState('');
  const [classFolders, setClassFolders] = useState<any[]>([]);
  const [selectedStageId, setSelectedStageId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [selectedSubfolderId, setSelectedSubfolderId] = useState('');
  const [myNotesLoading, setMyNotesLoading] = useState(false);
  const [myNotesError, setMyNotesError] = useState('');
  const [myNotes, setMyNotes] = useState<AiNoteRecord[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const mindmapViewportRef = useRef<HTMLDivElement | null>(null);
  const mindmapSvgRef = useRef<SVGSVGElement | null>(null);
  const mindmapExportSvgRef = useRef<SVGSVGElement | null>(null);
  const [mindmapScale, setMindmapScale] = useState(1);
  const [mindmapOffset, setMindmapOffset] = useState({ x: 0, y: 0 });
  const [mindmapDragging, setMindmapDragging] = useState(false);
  const mindmapDragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const grade = useMemo(() => {
    const cls = String(user?.profile?.class || '').trim();
    const m = cls.match(/([1-6])/);
    if (!m) return undefined;
    const map = ['小一', '小二', '小三', '小四', '小五', '小六'];
    const idx = Number(m[1]) - 1;
    return map[idx] || undefined;
  }, [user?.profile?.class]);

  useEffect(() => {
    if (!open) {
      setError('');
      setLoading(false);
      setGeneratedResult(null);
      setText('');
      setTab('create');
      setSaving(false);
      setSaveTitle('');
      setFoldersLoading(false);
      setFoldersError('');
      setClassFolders([]);
      setSelectedStageId('');
      setSelectedTopicId('');
      setSelectedSubfolderId('');
      setMyNotesLoading(false);
      setMyNotesError('');
      setMyNotes([]);
      setSelectedNoteId(null);
      setMindmapScale(1);
      setMindmapOffset({ x: 0, y: 0 });
    }
  }, [open]);

  const displayedNote: AiNotesResult | null = useMemo(() => {
    if (tab === 'library') {
      const note = myNotes.find((n) => String(n.id) === String(selectedNoteId || '')) || null;
      return note ? {
        topic: note.topic,
        corrections: note.corrections,
        notesMarkdown: note.notesMarkdown,
        enrichment: note.enrichment,
        selfCheck: note.selfCheck,
        mindmap: note.mindmap
      } : null;
    }
    return generatedResult;
  }, [generatedResult, myNotes, selectedNoteId, tab]);

  const displayedNoteMeta = useMemo(() => {
    if (tab !== 'library') return null;
    return myNotes.find((n) => String(n.id) === String(selectedNoteId || '')) || null;
  }, [myNotes, selectedNoteId, tab]);

  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

  const fitMindmap = () => {
    const viewport = mindmapViewportRef.current;
    const svg = mindmapSvgRef.current;
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

  useEffect(() => {
    if (!open) return;
    if (!displayedNote?.mindmap) return;
    const t = window.setTimeout(() => fitMindmap(), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, displayedNote?.mindmap, selectedNoteId, tab]);

  useEffect(() => {
    if (!open) return;
    if (!displayedNote?.mindmap) return;
    const viewport = mindmapViewportRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      // Keep current view, but if it's still default (0,0,1) then fit.
      if (Math.abs(mindmapScale - 1) < 1e-6 && Math.abs(mindmapOffset.x) < 1e-6 && Math.abs(mindmapOffset.y) < 1e-6) {
        fitMindmap();
      }
    });
    ro.observe(viewport);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, displayedNote?.mindmap, mindmapScale, mindmapOffset.x, mindmapOffset.y]);

  const zoomBy = (factor: number) => {
    const viewport = mindmapViewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const nextScale = clamp(mindmapScale * factor, 0.25, 3.5);
    if (Math.abs(nextScale - mindmapScale) < 1e-6) return;

    // Keep zoom centered around viewport center:
    // screen = scale * content + offset  => content = (screen - offset) / scale
    const contentX = (cx - mindmapOffset.x) / mindmapScale;
    const contentY = (cy - mindmapOffset.y) / mindmapScale;
    const nextOffsetX = cx - contentX * nextScale;
    const nextOffsetY = cy - contentY * nextScale;

    setMindmapScale(nextScale);
    setMindmapOffset({ x: nextOffsetX, y: nextOffsetY });
  };

  const handleGenerate = async () => {
    const input = String(text || '').trim();
    if (!input) {
      setError('請輸入你想整理的內容');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const resp = await authService.generateAiNotes({
        text: input,
        locale: 'zh-HK',
        maxNodes: 18,
        ...(grade ? { grade } : null)
      });
      setGeneratedResult(resp as any);
      setSaveTitle(String((resp as any)?.topic || 'AI筆記').trim());
      window.setTimeout(() => fitMindmap(), 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI筆記生成失敗';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadNotes = async () => {
    if (!displayedNote) return;
    const title = String(displayedNote.topic || 'AI筆記').trim() || 'AI筆記';
    const plain = buildExportText(displayedNote, { includeEnrichment: true, includeSelfCheck: true });
    await downloadTextAsPngPages({
      title: `AI筆記：${title}`,
      text: plain,
      filenamePrefix: 'ai-notes'
    });
  };

  const handleDownloadMindmap = async () => {
    if (!mindmapExportSvgRef.current) return;
    await downloadSvgAsPng(mindmapExportSvgRef.current, 'ai-mindmap');
  };

  const loadFolders = async () => {
    setFoldersLoading(true);
    setFoldersError('');
    try {
      const resp = await authService.getMyClassFolders();
      setClassFolders(Array.isArray(resp?.folders) ? resp.folders : []);
      if (!selectedStageId) {
        const stages = (Array.isArray(resp?.folders) ? resp.folders : []).filter((f: any) => f && Number(f.level) === 1 && !f.archivedAt);
        if (stages.length > 0) setSelectedStageId(String(stages[0].id));
      }
    } catch (e) {
      setClassFolders([]);
      setFoldersError(e instanceof Error ? e.message : '載入資料夾失敗');
    } finally {
      setFoldersLoading(false);
    }
  };

  const loadMyNotes = async (opts?: { folderId?: string | null }) => {
    setMyNotesLoading(true);
    setMyNotesError('');
    try {
      const resp = await authService.listMyAiNotes(opts || {});
      setMyNotes(Array.isArray(resp?.notes) ? resp.notes : []);
      if (!selectedNoteId && Array.isArray(resp?.notes) && resp.notes.length > 0) {
        setSelectedNoteId(String(resp.notes[0].id));
      }
    } catch (e) {
      setMyNotes([]);
      setMyNotesError(e instanceof Error ? e.message : '載入AI筆記失敗');
    } finally {
      setMyNotesLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadFolders();
    void loadMyNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    // Reset lower levels when parent changes
    setSelectedTopicId('');
    setSelectedSubfolderId('');
  }, [selectedStageId]);

  useEffect(() => {
    setSelectedSubfolderId('');
  }, [selectedTopicId]);

  const stageFolders = useMemo(() => classFolders.filter((f: any) => f && Number(f.level) === 1 && !f.archivedAt), [classFolders]);
  const topicFolders = useMemo(() => classFolders.filter((f: any) => f && Number(f.level) === 2 && !f.archivedAt && String(f.parentId || '') === String(selectedStageId || '')), [classFolders, selectedStageId]);
  const subFolders = useMemo(() => classFolders.filter((f: any) => f && Number(f.level) === 3 && !f.archivedAt && String(f.parentId || '') === String(selectedTopicId || '')), [classFolders, selectedTopicId]);

  const getFolderPathText = (snapshot: any | null) => {
    const path = Array.isArray(snapshot?.path) ? snapshot.path : [];
    const names = path.map((p: any) => String(p?.name || '').trim()).filter(Boolean);
    return names.join(' / ');
  };

  const handleCreateTopic = async () => {
    if (!selectedStageId) return alert('請先選擇學段');
    const name = prompt('輸入新課題名稱', '');
    if (!name || !name.trim()) return;
    try {
      await authService.createMyTopicFolder({ parentId: selectedStageId, name: name.trim() });
      const refreshed = await authService.getMyClassFolders();
      const nextFolders = Array.isArray(refreshed?.folders) ? refreshed.folders : [];
      setClassFolders(nextFolders);
      const topics = nextFolders.filter((f: any) => f && Number(f.level) === 2 && !f.archivedAt && String(f.parentId || '') === String(selectedStageId));
      const found = topics.find((t: any) => String(t.name || '').trim() === name.trim());
      if (found?.id) setSelectedTopicId(String(found.id));
    } catch (e) {
      alert(e instanceof Error ? e.message : '新增課題失敗');
    }
  };

  const handleSave = async () => {
    if (!generatedResult) return;
    const folderId = selectedSubfolderId || selectedTopicId || null;
    setSaving(true);
    try {
      const resp = await authService.createMyAiNote({
        folderId,
        title: String(saveTitle || generatedResult.topic || 'AI筆記').trim(),
        sourceText: text,
        aiResult: generatedResult
      });
      const savedId = String(resp?.note?.id || '');
      await loadMyNotes();
      if (savedId) setSelectedNoteId(savedId);
      setTab('library');
      alert('已儲存 AI筆記');
    } catch (e) {
      alert(e instanceof Error ? e.message : '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!noteId) return;
    if (!confirm('確定要刪除此AI筆記嗎？此操作無法復原。')) return;
    try {
      await authService.deleteMyAiNote(noteId);
      const next = myNotes.filter((n) => String(n.id) !== String(noteId));
      setMyNotes(next);
      setSelectedNoteId(next[0]?.id ? String(next[0].id) : null);
    } catch (e) {
      alert(e instanceof Error ? e.message : '刪除失敗');
    }
  };

  if (!open) return null;

  const modal = (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-6xl max-h-[92vh] overflow-hidden shadow-comic-xl border-4 border-brand-brown">
        <div className="bg-brand-brown text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-7 h-7" />
            <div className="text-xl font-black">AI筆記</div>
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
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setTab('create')}
              className={`px-4 py-2 rounded-xl font-black border-2 transition-all ${
                tab === 'create' ? 'bg-brand-brown text-white border-brand-brown' : 'bg-white text-brand-brown border-brand-brown/40 hover:bg-brand-cream'
              }`}
            >
              新筆記
            </button>
            <button
              type="button"
              onClick={() => { setTab('library'); void loadMyNotes(); }}
              className={`px-4 py-2 rounded-xl font-black border-2 transition-all ${
                tab === 'library' ? 'bg-brand-brown text-white border-brand-brown' : 'bg-white text-brand-brown border-brand-brown/40 hover:bg-brand-cream'
              }`}
            >
              我的筆記
            </button>
          </div>

          {tab === 'create' ? (
          <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
            <div className="font-black text-brand-brown mb-3">把你的記錄貼上來（可自由換行）</div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  void handleGenerate();
                }
              }}
              placeholder="例如：今天學到……\n我覺得……\n重點是……"
              className="w-full min-h-[160px] rounded-2xl border-2 border-[#E6D2B5] bg-[#FFF9F0] p-4 text-[#2F2A26] placeholder:text-[#A0806B] focus:outline-none focus:ring-2 focus:ring-blue-300"
            />

            {error ? (
              <div className="mt-3 bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl p-3 font-bold">
                {error}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                className="bg-brand-blue hover:bg-brand-blue/90 text-brand-brown font-black inline-flex items-center gap-2"
                onClick={() => void handleGenerate()}
                disabled={loading}
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                {loading ? '整理中...' : '送出並整理'}
              </Button>
              <Button
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-black inline-flex items-center gap-2"
                onClick={() => { setText(''); setGeneratedResult(null); setError(''); }}
                disabled={loading}
              >
                <Trash2 className="w-5 h-5" />
                清除
              </Button>
              <div className="text-sm text-gray-600 font-bold">
                快捷鍵：Ctrl/Cmd + Enter 送出
              </div>
            </div>
          </div>
          ) : (
            <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="font-black text-brand-brown">我的 AI筆記</div>
                <button
                  type="button"
                  onClick={() => void loadMyNotes()}
                  className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${myNotesLoading ? 'animate-spin' : ''}`} />
                  重新載入
                </button>
              </div>

              {myNotesError ? (
                <div className="bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl p-3 font-bold">
                  {myNotesError}
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <div className="text-sm font-black text-[#5E4C40] mb-2">資料夾篩選</div>
                  <div className="space-y-2">
                    <select
                      value={selectedStageId}
                      onChange={(e) => setSelectedStageId(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
                      disabled={foldersLoading}
                    >
                      <option value="">（選擇學段）</option>
                      {stageFolders.map((f: any) => (
                        <option key={f.id} value={String(f.id)}>{String(f.name || '')}</option>
                      ))}
                    </select>
                    <select
                      value={selectedTopicId}
                      onChange={(e) => setSelectedTopicId(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
                      disabled={!selectedStageId || foldersLoading}
                    >
                      <option value="">（全部課題）</option>
                      {topicFolders.map((f: any) => (
                        <option key={f.id} value={String(f.id)}>{String(f.name || '')}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCreateTopic()}
                        className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50"
                        disabled={!selectedStageId || foldersLoading}
                      >
                        新增課題
                      </button>
                      <button
                        type="button"
                        onClick={() => void loadMyNotes({ folderId: selectedSubfolderId || selectedTopicId || null })}
                        className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50"
                        disabled={myNotesLoading}
                        title="套用篩選"
                      >
                        套用
                      </button>
                    </div>
                    {foldersError ? (
                      <div className="text-xs text-red-600 font-bold">{foldersError}</div>
                    ) : null}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-sm font-black text-[#5E4C40] mb-2">筆記列表</div>
                  {myNotesLoading ? (
                    <div className="text-gray-600 font-bold">載入中...</div>
                  ) : myNotes.length === 0 ? (
                    <div className="text-gray-600 font-bold">暫無已儲存的筆記。</div>
                  ) : (
                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                      {myNotes.slice(0, 200).map((n) => {
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
              </div>
            </div>
          )}

          {tab === 'create' && generatedResult ? (
            <div className="mt-4 bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
              <div className="font-black text-brand-brown text-lg mb-3">儲存到資料夾</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <div className="text-sm font-bold text-gray-700 mb-1">學段</div>
                  <select
                    value={selectedStageId}
                    onChange={(e) => setSelectedStageId(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
                    disabled={foldersLoading}
                  >
                    <option value="">（未分類）</option>
                    {stageFolders.map((f: any) => (
                      <option key={f.id} value={String(f.id)}>{String(f.name || '')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-700 mb-1">課題</div>
                  <select
                    value={selectedTopicId}
                    onChange={(e) => setSelectedTopicId(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
                    disabled={!selectedStageId || foldersLoading}
                  >
                    <option value="">（不選）</option>
                    {topicFolders.map((f: any) => (
                      <option key={f.id} value={String(f.id)}>{String(f.name || '')}</option>
                    ))}
                  </select>
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => void handleCreateTopic()}
                      className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50"
                      disabled={!selectedStageId || foldersLoading}
                    >
                      新增課題
                    </button>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-700 mb-1">子資料夾（可選）</div>
                  <select
                    value={selectedSubfolderId}
                    onChange={(e) => setSelectedSubfolderId(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
                    disabled={!selectedTopicId || foldersLoading}
                  >
                    <option value="">（不選）</option>
                    {subFolders.map((f: any) => (
                      <option key={f.id} value={String(f.id)}>{String(f.name || '')}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div className="md:col-span-2">
                  <div className="text-sm font-bold text-gray-700 mb-1">標題</div>
                  <input
                    value={saveTitle}
                    onChange={(e) => setSaveTitle(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
                    placeholder="例如：水的三種狀態"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    className="w-full px-4 py-3 rounded-2xl bg-[#93C47D] border-4 border-brand-brown text-brand-brown font-black shadow-comic active:translate-y-1 active:shadow-none hover:bg-[#86b572]"
                    disabled={saving}
                  >
                    {saving ? '儲存中...' : '儲存'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {displayedNote ? (
            <div className="mt-6 space-y-6">
              <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-black text-brand-brown text-lg">AI判斷主題</div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!displayedNote) return;
                        const raw = buildExportText(displayedNote, { includeEnrichment: true, includeSelfCheck: false });
                        // StudyPractice 自定義內容限制 2000 字
                        const limit = 2000;
                        const content = raw.length > limit ? `${raw.slice(0, Math.max(0, limit - 18))}\n\n（內容已截短以配合出題限制）` : raw;
                        onExportToSelfStudy?.({ content, difficulty: grade });
                      }}
                      className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                    >
                      <Brain className="w-4 h-4" />
                      匯到自學天地出題
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDownloadNotes()}
                      className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      下載筆記圖片
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDownloadMindmap()}
                      className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                      disabled={!displayedNote.mindmap}
                    >
                      <Download className="w-4 h-4" />
                      下載思維圖圖片
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-xl font-black text-[#2F2A26]">{displayedNote.topic}</div>
                {tab === 'library' && displayedNoteMeta ? (
                  <div className="mt-2 text-sm text-gray-600 font-bold">
                    {getFolderPathText(displayedNoteMeta.folderSnapshot) || '未分類'} ｜ {displayedNoteMeta.createdAt ? new Date(displayedNoteMeta.createdAt).toLocaleString('zh-HK') : ''}
                    <span className="ml-2">｜</span>
                    <button
                      type="button"
                      onClick={() => void handleDeleteNote(String(displayedNoteMeta.id))}
                      className="ml-2 underline text-red-600 hover:text-red-700"
                    >
                      刪除
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                <div className="font-black text-brand-brown text-lg mb-3">需要修正 / 需要核對</div>
                {Array.isArray(displayedNote.corrections) && displayedNote.corrections.length > 0 ? (
                  <div className="space-y-3">
                    {displayedNote.corrections.slice(0, 12).map((c, idx) => (
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
                  <div dangerouslySetInnerHTML={{ __html: markdownToSafeHtml(displayedNote.notesMarkdown) }} />
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                <div className="font-black text-brand-brown text-lg mb-3">知識增潤</div>
                {Array.isArray(displayedNote.enrichment) && displayedNote.enrichment.length > 0 ? (
                  <ul className="list-disc pl-6 space-y-2 text-gray-700 font-bold">
                    {displayedNote.enrichment.slice(0, 5).map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-gray-600 font-bold">暫無增潤內容。</div>
                )}
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                <div className="font-black text-brand-brown text-lg mb-3">自我檢查題</div>
                {Array.isArray(displayedNote.selfCheck) && displayedNote.selfCheck.length > 0 ? (
                  <div className="space-y-3">
                    {displayedNote.selfCheck.slice(0, 5).map((q, idx) => (
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
                        aria-label="縮小"
                      >
                        <ZoomOut className="w-4 h-4" />
                        縮小
                      </button>
                      <button
                        type="button"
                        onClick={() => zoomBy(1.2)}
                        className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                        aria-label="放大"
                      >
                        <ZoomIn className="w-4 h-4" />
                        放大
                      </button>
                      <button
                        type="button"
                        onClick={() => fitMindmap()}
                        className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                        aria-label="置中"
                      >
                        <LocateFixed className="w-4 h-4" />
                        置中
                      </button>
                    </div>
                  </div>

                  <div
                    ref={mindmapViewportRef}
                    className={`relative w-full h-[420px] md:h-[520px] overflow-hidden rounded-2xl border-2 border-[#E6D2B5] bg-white ${mindmapDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                    style={{ touchAction: 'none' }}
                    onPointerDown={(e) => {
                      if (!result?.mindmap) return;
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
                    onPointerLeave={() => {
                      // If pointer capture is active, pointerleave won't matter; this is just a fallback.
                      if (!mindmapDragStartRef.current) return;
                      setMindmapDragging(false);
                      mindmapDragStartRef.current = null;
                    }}
                  >
                    <div
                      className="absolute left-0 top-0 will-change-transform"
                      style={{
                        transform: `translate(${mindmapOffset.x}px, ${mindmapOffset.y}px) scale(${mindmapScale})`,
                        transformOrigin: '0 0'
                      }}
                    >
                      <MindmapTree mindmap={displayedNote.mindmap} svgRef={mindmapSvgRef} dataAttr={tab === 'library' ? 'ai-notes-lib' : 'ai-notes'} />
                    </div>
                  </div>

                  {/* Full-size SVG for export (not affected by zoom/pan) */}
                  <div className="hidden">
                    <MindmapTree mindmap={displayedNote.mindmap} svgRef={mindmapExportSvgRef} dataAttr={tab === 'library' ? 'ai-notes-lib-export' : 'ai-notes-export'} />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};
