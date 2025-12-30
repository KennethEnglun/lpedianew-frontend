import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Download, Hand, LocateFixed, RefreshCw, Send, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';
import Button from '../Button';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import { MindmapTree, type MindmapGraph } from './MindmapTree';

type AiNotesResult = {
  topic: string;
  corrections: Array<{ claim: string; issue: string; correction: string; needsVerification: boolean }>;
  notesMarkdown: string;
  mindmap: MindmapGraph;
};

type Props = {
  open: boolean;
  onClose: () => void;
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

export const AiNotesModal: React.FC<Props> = ({ open, onClose }) => {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AiNotesResult | null>(null);
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
      setResult(null);
      setText('');
      setMindmapScale(1);
      setMindmapOffset({ x: 0, y: 0 });
    }
  }, [open]);

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
    if (!result?.mindmap) return;
    // Ensure SVG is mounted before measuring.
    const t = window.setTimeout(() => fitMindmap(), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, result?.mindmap]);

  useEffect(() => {
    if (!open) return;
    if (!result?.mindmap) return;
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
  }, [open, result?.mindmap, mindmapScale, mindmapOffset.x, mindmapOffset.y]);

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
      setResult(resp as any);
      window.setTimeout(() => fitMindmap(), 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI筆記生成失敗';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadNotes = async () => {
    if (!result) return;
    const plain = markdownToPlainText(result.notesMarkdown);
    const title = String(result.topic || 'AI筆記').trim() || 'AI筆記';
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
                onClick={() => { setText(''); setResult(null); setError(''); }}
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

          {result ? (
            <div className="mt-6 space-y-6">
              <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-black text-brand-brown text-lg">AI判斷主題</div>
                  <div className="flex gap-2">
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
                      disabled={!result.mindmap}
                    >
                      <Download className="w-4 h-4" />
                      下載思維圖圖片
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-xl font-black text-[#2F2A26]">{result.topic}</div>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                <div className="font-black text-brand-brown text-lg mb-3">需要修正 / 需要核對</div>
                {Array.isArray(result.corrections) && result.corrections.length > 0 ? (
                  <div className="space-y-3">
                    {result.corrections.slice(0, 12).map((c, idx) => (
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
                  <div dangerouslySetInnerHTML={{ __html: markdownToSafeHtml(result.notesMarkdown) }} />
                </div>
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
                      <MindmapTree mindmap={result.mindmap} svgRef={mindmapSvgRef} dataAttr="ai-notes" />
                    </div>
                  </div>

                  {/* Full-size SVG for export (not affected by zoom/pan) */}
                  <div className="hidden">
                    <MindmapTree mindmap={result.mindmap} svgRef={mindmapExportSvgRef} dataAttr="ai-notes-export" />
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
