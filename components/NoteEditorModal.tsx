import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronsDown,
  ChevronsUp,
  ChevronDown,
  ChevronUp,
  Bold,
  FileDown,
  Image as ImageIcon,
  Lock,
  Layers,
  Maximize2,
  ArrowDown,
  ArrowUp,
  Minimize2,
  MousePointer2,
  Pencil,
  Plus,
  RotateCw,
  Scan,
  Save,
  Send,
  Sparkles,
  Trash2,
  Type,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import * as fabric from 'fabric';
import { compressImageToMaxBytes } from '../services/imageCompression';

type Mode = 'student' | 'template' | 'teacher';

type Props = {
  open: boolean;
  onClose: () => void;
  authService: any;
  mode: Mode;
  noteId: string;
  viewerId: string;
  viewerRole: 'student' | 'teacher' | 'admin';
  studentId?: string; // teacher view
  onPublished?: () => void;
};

const A4_PORTRAIT_W = 595;
const A4_PORTRAIT_H = 842;

type PageOrientation = 'portrait' | 'landscape';

const getA4Size = (orientation: PageOrientation) => {
  if (orientation === 'landscape') return { w: A4_PORTRAIT_H, h: A4_PORTRAIT_W };
  return { w: A4_PORTRAIT_W, h: A4_PORTRAIT_H };
};
const LOCAL_KEY_PREFIX = 'lpedia_note_draft_v2_fabric';
const buildLocalKey = (noteId: string, userId: string) => `${LOCAL_KEY_PREFIX}:${noteId}:${userId}`;

type FabricDocSnapshot = {
  format: 'fabric-v1';
  version: 1;
  page?: {
    orientation?: PageOrientation;
  };
  currentPage: number;
  pages: any[]; // Fabric canvas JSON
};

const isFabricDocSnapshot = (snap: any): snap is FabricDocSnapshot =>
  snap && snap.format === 'fabric-v1' && snap.version === 1 && Array.isArray(snap.pages);

const looksLikeLegacyTldrawSnapshot = (snap: any) => {
  if (!snap || typeof snap !== 'object') return false;
  if (Array.isArray((snap as any).records)) return true;
  if ((snap as any).store && typeof (snap as any).store === 'object') return true;
  if ((snap as any).schema && typeof (snap as any).schema === 'object') return true;
  return false;
};

const emptyPage = (): any => ({
  version: '6',
  objects: [],
  background: '#ffffff'
});

const emptyDoc = (): FabricDocSnapshot => ({
  format: 'fabric-v1',
  version: 1,
  page: { orientation: 'portrait' },
  currentPage: 0,
  pages: [emptyPage()]
});

const normalizeDoc = (snap: any): FabricDocSnapshot => {
  if (isFabricDocSnapshot(snap)) {
    const orientation: PageOrientation = snap?.page?.orientation === 'landscape' ? 'landscape' : 'portrait';
    const pages = snap.pages.length > 0 ? snap.pages : [emptyPage()];
    const currentPage = Math.min(Math.max(0, snap.currentPage ?? 0), pages.length - 1);
    return { format: 'fabric-v1', version: 1, page: { orientation }, currentPage, pages };
  }
  return emptyDoc();
};

const isBlankDocSnapshot = (snap: any) => {
  if (!isFabricDocSnapshot(snap)) return false;
  return snap.pages.every((p) => {
    const objs = Array.isArray((p as any)?.objects) ? (p as any).objects : [];
    return objs.length === 0;
  });
};

const toDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('讀取圖片失敗'));
    reader.readAsDataURL(file);
  });

const toggleBulletList = (text: string) => {
  const lines = String(text || '').split('\n');
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  const allBulleted = nonEmpty.length > 0 && nonEmpty.every((l) => l.trimStart().startsWith('• '));
  if (allBulleted) {
    return lines
      .map((l) => (l.trimStart().startsWith('• ') ? l.replace(/^(\s*)•\s+/, '$1') : l))
      .join('\n');
  }
  return lines.map((l) => (l.trim().length === 0 ? l : `• ${l.replace(/^\s+/, '')}`)).join('\n');
};

const toggleNumberedList = (text: string) => {
  const lines = String(text || '').split('\n');
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  const allNumbered = nonEmpty.length > 0 && nonEmpty.every((l) => /^\s*\d+\.\s+/.test(l));
  if (allNumbered) {
    return lines
      .map((l) => (l.trim().length === 0 ? l : l.replace(/^(\s*)\d+\.\s+/, '$1')))
      .join('\n');
  }
  let n = 1;
  return lines
    .map((l) => {
      if (l.trim().length === 0) return l;
      const out = `${n}. ${l.replace(/^\s+/, '')}`;
      n += 1;
      return out;
    })
    .join('\n');
};

const fitPaperToContainer = (canvas: fabric.Canvas, container: HTMLDivElement, pageW: number, pageH: number) => {
  const w = Math.max(1, container.clientWidth);
  const h = Math.max(1, container.clientHeight);
  canvas.setWidth(w);
  canvas.setHeight(h);
  const padding = 48;
  const scale = Math.min((w - padding * 2) / pageW, (h - padding * 2) / pageH);
  const s = Number.isFinite(scale) && scale > 0 ? Math.min(scale, 2) : 1;
  const tx = (w - pageW * s) / 2;
  const ty = (h - pageH * s) / 2;
  canvas.setViewportTransform([s, 0, 0, s, tx, ty]);
  canvas.requestRenderAll();
};

const ensurePaperRect = (canvas: fabric.Canvas, pageW: number, pageH: number) => {
  const existing = canvas.getObjects().find((o) => Boolean((o as any).lpediaPaper)) as fabric.Rect | undefined;
  if (existing) {
    existing.set({ left: 0, top: 0, width: pageW, height: pageH, visible: true });
    canvas.sendToBack(existing);
    return existing;
  }
  const rect = new fabric.Rect({
    left: 0,
    top: 0,
    width: pageW,
    height: pageH,
    fill: '#ffffff',
    stroke: '#d1d5db',
    strokeWidth: 2,
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false,
    hoverCursor: 'default'
  });
  (rect as any).lpediaPaper = true;
  (rect as any).lpediaLocked = true;
  (rect as any).lpediaLayer = 'paper';
  canvas.add(rect);
  canvas.sendToBack(rect);
  return rect;
};

const stripPaperFromCanvasJson = (json: any) => {
  if (!json || typeof json !== 'object') return json;
  const objects = Array.isArray(json.objects) ? json.objects : [];
  const nextObjects = objects.filter((o: any) => !o?.lpediaPaper && String(o?.lpediaLayer || '') !== 'paper');
  return { ...json, objects: nextObjects, background: '#ffffff', backgroundColor: undefined };
};

const exportPdfFromDoc = async (doc: FabricDocSnapshot) => {
  const orientation: PageOrientation = doc?.page?.orientation === 'landscape' ? 'landscape' : 'portrait';
  const { w: pageW, h: pageH } = getA4Size(orientation);
  const pdf = await PDFDocument.create();
  for (const pageJson of doc.pages) {
    const canvasEl = document.createElement('canvas');
    canvasEl.width = pageW;
    canvasEl.height = pageH;
    const sc = new fabric.StaticCanvas(canvasEl as any, { width: pageW, height: pageH });
    sc.backgroundColor = '#ffffff';
    await withTimeout(sc.loadFromJSON(pageJson), 15000, 'PDF 匯出時載入頁面超時');
    sc.renderAll();
    const dataUrl = sc.toDataURL({ format: 'png', multiplier: 2 });
    const bytes = Uint8Array.from(atob(dataUrl.split(',')[1] || ''), (c) => c.charCodeAt(0));
    const png = await pdf.embedPng(bytes);
    const page = pdf.addPage([pageW, pageH]);
    page.drawImage(png, { x: 0, y: 0, width: pageW, height: pageH });
    sc.dispose();
  }
  const out = await pdf.save();
  const outBlob = new Blob([out], { type: 'application/pdf' });
  const url = URL.createObjectURL(outBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '筆記.pdf';
  a.click();
  URL.revokeObjectURL(url);
};

const withTimeout = async <T,>(promise: Promise<T>, ms: number, message: string, onTimeout?: () => void): Promise<T> => {
  let timer: number | null = null;
  try {
    const timeoutPromise = new Promise<T>((_, reject) => {
      timer = window.setTimeout(() => {
        try {
          onTimeout?.();
        } finally {
          reject(new Error(message));
        }
      }, ms);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) window.clearTimeout(timer);
  }
};

const insertMindmap = (
  canvas: fabric.Canvas,
  mindmap: { nodes: Array<{ id: string; label: string }>; edges: Array<{ from: string; to: string; label?: string }> },
  pageW: number,
  pageH: number
) => {
  const nodes = Array.isArray(mindmap?.nodes) ? mindmap.nodes : [];
  const edges = Array.isArray(mindmap?.edges) ? mindmap.edges : [];
  if (nodes.length === 0) return;

  const margin = 28;
  const nodeW = 180;
  const nodeH = 70;
  const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(nodes.length))));
  const gapX = 22;
  const gapY = 18;

  const nodePos = new Map<string, { x: number; y: number }>();
  nodes.forEach((n, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    nodePos.set(n.id, { x: margin + col * (nodeW + gapX), y: margin + row * (nodeH + gapY) });
  });

  edges.forEach((e) => {
    const from = nodePos.get(e.from);
    const to = nodePos.get(e.to);
    if (!from || !to) return;
    const line = new fabric.Line(
      [from.x + nodeW / 2, from.y + nodeH / 2, to.x + nodeW / 2, to.y + nodeH / 2],
      { stroke: '#6b7280', strokeWidth: 2, selectable: false, evented: false }
    );
    (line as any).lpediaLayer = 'base';
    canvas.add(line);
    canvas.sendToBack(line);
  });

  nodes.forEach((n) => {
    const pos = nodePos.get(n.id)!;
    const rect = new fabric.Rect({
      left: pos.x,
      top: pos.y,
      width: nodeW,
      height: nodeH,
      rx: 12,
      ry: 12,
      fill: '#ffffff',
      stroke: '#5E4C40',
      strokeWidth: 2
    });
    const text = new fabric.Textbox(n.label, {
      left: pos.x + 10,
      top: pos.y + 10,
      width: nodeW - 20,
      height: nodeH - 20,
      fontSize: 16,
      fontWeight: 'bold',
      fill: '#111827',
      editable: true
    });
    const group = new fabric.Group([rect, text], { left: pos.x, top: pos.y });
    canvas.add(group);
  });

  canvas.requestRenderAll();
};

const NoteEditorModal: React.FC<Props> = ({ open, onClose, authService, mode, noteId, viewerId, viewerRole, studentId, onPublished }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [noteTitle, setNoteTitle] = useState('筆記');
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [annotationsVisible, setAnnotationsVisible] = useState(true);
  const [tool, setTool] = useState<'select' | 'pen'>('select');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [pageOrientation, setPageOrientation] = useState<PageOrientation>('portrait');
  const [penColor, setPenColor] = useState('#111827');
  const [penWidth, setPenWidth] = useState(2);
  const [layersOpen, setLayersOpen] = useState(false);
  const [layersVersion, setLayersVersion] = useState(0);
  const [zoomPct, setZoomPct] = useState(100);
  const [activeTextColor, setActiveTextColor] = useState('#111827');
  const [docLoadedToken, setDocLoadedToken] = useState(0);
  const [selectionVersion, setSelectionVersion] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const suppressSaveRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const docRef = useRef<FabricDocSnapshot>(emptyDoc());
  const annotationDocRef = useRef<FabricDocSnapshot | null>(null);
  const pendingImgAbortRef = useRef<AbortController | null>(null);
  const pendingLoadAbortRef = useRef<AbortController | null>(null);
  const pageSizeRef = useRef(getA4Size('portrait'));
  const penStateRef = useRef({ color: '#111827', width: 2 });
  const spaceDownRef = useRef(false);
  const isPanningRef = useRef(false);
  const panLastRef = useRef<{ x: number; y: number } | null>(null);

  const latestStateRef = useRef({
    open,
    mode,
    canEdit,
    submittedAt,
    annotationMode,
    canTemplateEdit: false
  });

  const canTemplateEdit = mode === 'template' && canEdit;
  const canAddPage = (mode === 'template' && canEdit) || (mode === 'student' && canEdit && !submittedAt);
  const canSubmit = mode === 'student' && canEdit && !submittedAt;
  const canAnnotate = mode === 'teacher' && (viewerRole === 'teacher' || viewerRole === 'admin');

  pageSizeRef.current = getA4Size(pageOrientation);
  penStateRef.current = { color: String(penColor || '#111827'), width: Math.max(1, Number(penWidth) || 2) };
  latestStateRef.current = { open, mode, canEdit, submittedAt, annotationMode, canTemplateEdit };

  const applyPermissionsToObjects = (canvas: fabric.Canvas) => {
    const objs = canvas.getObjects();
    for (const o of objs) {
      if ((o as any).lpediaPaper || String((o as any).lpediaLayer || '') === 'paper') {
        o.visible = true;
        o.selectable = false;
        o.evented = false;
        continue;
      }
      const locked = Boolean((o as any).lpediaLocked);
      const layer = String((o as any).lpediaLayer || 'base');

      if (mode === 'teacher') {
        const isAnnotation = layer === 'annotation';
        o.visible = !isAnnotation || annotationsVisible;
        const selectable = annotationMode && isAnnotation;
        o.selectable = selectable;
        o.evented = selectable;
        continue;
      }

      if (mode === 'student') {
        if (locked) {
          o.selectable = false;
          o.evented = false;
        } else {
          o.selectable = true;
          o.evented = true;
        }
        continue;
      }

      // template
      o.selectable = true;
      o.evented = true;
    }
  };

  const saveCurrentPageToDoc = () => {
    if (mode === 'teacher') return;
    const canvas = fabricRef.current;
    if (!canvas) return;
    const json = canvas.toJSON(['lpediaLocked', 'lpediaLayer', 'crossOrigin', 'lpediaPaper']);
    docRef.current.pages[docRef.current.currentPage] = stripPaperFromCanvasJson(json);
  };

  const scheduleStudentSave = async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (suppressSaveRef.current) return;
    if (mode !== 'student') return;

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        saveCurrentPageToDoc();
        const doc = { ...docRef.current, currentPage: docRef.current.currentPage };
        await idbSet(buildLocalKey(noteId, viewerId), { savedAt: new Date().toISOString(), snapshot: doc });

        if (!navigator.onLine) return;
        if (submittedAt) return;
        await authService.saveMyNoteDraft(noteId, doc);
      } catch {
        // keep silent (offline / network)
      }
    }, 1200);
  };

  const saveCurrentAnnotationsToRef = () => {
    if (mode !== 'teacher') return;
    const canvas = fabricRef.current;
    const ann = annotationDocRef.current;
    if (!canvas || !ann) return;
    const json = canvas.toJSON(['lpediaLocked', 'lpediaLayer', 'crossOrigin', 'lpediaPaper']);
    const objects = Array.isArray((json as any).objects) ? (json as any).objects : [];
    const only = objects.filter((o: any) => String(o.lpediaLayer || '') === 'annotation');
    ann.pages[ann.currentPage] = stripPaperFromCanvasJson({ ...json, objects: only, background: '#ffffff' });
  };

  const loadPage = async (idx: number) => {
    const canvas = fabricRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const { w: pageW, h: pageH } = pageSizeRef.current;
    const next = Math.min(Math.max(0, idx), docRef.current.pages.length - 1);
    if (pendingLoadAbortRef.current) pendingLoadAbortRef.current.abort();
    const loadAbort = new AbortController();
    pendingLoadAbortRef.current = loadAbort;
    suppressSaveRef.current = true;
    try {
      if (mode === 'teacher') saveCurrentAnnotationsToRef();
      else saveCurrentPageToDoc();
      docRef.current.currentPage = next;
      setPageIndex(next);
      setPageCount(docRef.current.pages.length);
      if (mode === 'teacher' && annotationDocRef.current) {
        annotationDocRef.current.currentPage = next;
      }

      canvas.clear();
      canvas.backgroundColor = undefined;
      const baseJson = docRef.current.pages[next] || emptyPage();
      const pageJson =
        mode !== 'teacher'
          ? baseJson
          : (() => {
              const ann = annotationDocRef.current;
              const annPage = ann ? ann.pages[next] : null;
              const baseObjects = Array.isArray((baseJson as any).objects) ? (baseJson as any).objects : [];
              const annObjects = Array.isArray((annPage as any)?.objects) ? (annPage as any).objects : [];
              return {
                ...baseJson,
                objects: [
                  ...baseObjects.map((o: any) => ({ ...o, lpediaLayer: o.lpediaLayer || 'base' })),
                  ...annObjects.map((o: any) => ({ ...o, lpediaLayer: 'annotation' }))
                ]
              };
            })();

      await withTimeout(canvas.loadFromJSON(pageJson, undefined, { signal: loadAbort.signal } as any), 15000, '載入頁面超時', () => loadAbort.abort());
      ensurePaperRect(canvas, pageW, pageH);
      applyPermissionsToObjects(canvas);
      fitPaperToContainer(canvas, container, pageW, pageH);
      setZoomPct(Math.round((canvas.getZoom() || 1) * 100));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      setError('');
    } catch (e: any) {
      if (String(e?.name || '') === 'AbortError') return;
      setError(e?.message || '載入頁面失敗');
    } finally {
      suppressSaveRef.current = false;
      if (pendingLoadAbortRef.current === loadAbort) pendingLoadAbortRef.current = null;
    }
  };

  const resetToBlank = async () => {
    if (!window.confirm('這會清空現有內容並轉為新筆記格式（Fabric）。確定？')) return;
    docRef.current = emptyDoc();
    annotationDocRef.current = null;
    setPageIndex(0);
    setPageCount(1);
    setPageOrientation('portrait');
    setZoomPct(100);
    await loadPage(0);
    setError('');
  };

  const addPage = async () => {
    if (!canAddPage) return;
    saveCurrentPageToDoc();
    docRef.current.pages.push(emptyPage());
    const next = docRef.current.pages.length - 1;
    docRef.current.currentPage = next;
    setPageCount(docRef.current.pages.length);
    await loadPage(next);
    await scheduleStudentSave();
  };

  const canChangePageOrientation =
    (mode === 'template' && canTemplateEdit) || (mode === 'student' && canEdit && !submittedAt);

  const fitView = () => {
    const canvas = fabricRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const { w: pageW, h: pageH } = pageSizeRef.current;
    ensurePaperRect(canvas, pageW, pageH);
    fitPaperToContainer(canvas, container, pageW, pageH);
    setZoomPct(Math.round((canvas.getZoom() || 1) * 100));
  };

  const zoomBy = (factor: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
    const current = canvas.getZoom() || 1;
    const next = clamp(current * factor, 0.25, 4);
    const pt = new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
    canvas.zoomToPoint(pt, next);
    setZoomPct(Math.round((canvas.getZoom() || 1) * 100));
    canvas.requestRenderAll();
  };

  const togglePageOrientation = () => {
    if (!canChangePageOrientation) return;
    const next: PageOrientation = pageOrientation === 'portrait' ? 'landscape' : 'portrait';
    docRef.current.page = { ...(docRef.current.page || {}), orientation: next };
    setPageOrientation(next);
    const canvas = fabricRef.current;
    const container = containerRef.current;
    if (canvas && container) {
      const { w: pageW, h: pageH } = getA4Size(next);
      ensurePaperRect(canvas, pageW, pageH);
      fitPaperToContainer(canvas, container, pageW, pageH);
      setZoomPct(Math.round((canvas.getZoom() || 1) * 100));
      canvas.requestRenderAll();
    }
  };

  const insertTextBox = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (!canEdit) return;
    if (mode === 'student' && submittedAt) return;
    if (mode === 'teacher' && !annotationMode) return;

    const tb = new fabric.Textbox('雙擊編輯文字', {
      left: 60,
      top: 80,
      width: 420,
      fontSize: 22,
      fill: activeTextColor,
      fontFamily: 'sans-serif',
      editable: true
    });
    if (mode === 'teacher') (tb as any).lpediaLayer = 'annotation';
    canvas.add(tb);
    canvas.setActiveObject(tb);
    canvas.requestRenderAll();
    setLayersVersion((v) => v + 1);
  };

  const applyTextStyle = (patch: Partial<fabric.IText>) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject() as any;
    if (!obj) return;
    if (obj.type !== 'textbox' && obj.type !== 'i-text' && obj.type !== 'text') return;

    const it = obj as fabric.IText;
    if ((it as any).isEditing) {
      const start = (it as any).selectionStart ?? 0;
      const end = (it as any).selectionEnd ?? 0;
      if (end > start) {
        (it as any).setSelectionStyles(patch as any, start, end);
      } else {
        Object.assign(it, patch);
      }
    } else {
      Object.assign(it, patch);
    }
    it.dirty = true;
    canvas.requestRenderAll();
    void scheduleStudentSave();
  };

  const toggleBold = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject() as any;
    if (!obj) return;
    if (obj.type !== 'textbox' && obj.type !== 'i-text' && obj.type !== 'text') return;
    const it = obj as fabric.IText;
    const current = String((it as any).fontWeight || 'normal');
    const next = current === 'bold' || current === '700' ? 'normal' : 'bold';
    applyTextStyle({ fontWeight: next as any });
  };

  const toggleList = (kind: 'bullet' | 'number') => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject() as any;
    if (!obj) return;
    if (obj.type !== 'textbox' && obj.type !== 'i-text' && obj.type !== 'text') return;
    const it = obj as fabric.IText;
    const text = String((it as any).text || '');
    const next = kind === 'bullet' ? toggleBulletList(text) : toggleNumberedList(text);
    (it as any).text = next;
    it.dirty = true;
    canvas.requestRenderAll();
    void scheduleStudentSave();
  };

  const deleteSelection = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    if (active.length === 0) return;

    const deletable = active.filter((o) => {
      if ((o as any).lpediaPaper) return false;
      const locked = Boolean((o as any).lpediaLocked);
      const layer = String((o as any).lpediaLayer || 'base');
      if (mode === 'student') return !locked && !submittedAt;
      if (mode === 'template') return canTemplateEdit;
      if (mode === 'teacher') return annotationMode && layer === 'annotation';
      return false;
    });
    deletable.forEach((o) => canvas.remove(o));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    setLayersVersion((v) => v + 1);
    void scheduleStudentSave();
  };

  const bringToFront = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    const locked = Boolean((obj as any).lpediaLocked);
    const layer = String((obj as any).lpediaLayer || 'base');
    if (mode === 'student' && (locked || submittedAt)) return;
    if (mode === 'template' && !canTemplateEdit) return;
    if (mode === 'teacher' && (!annotationMode || layer !== 'annotation')) return;
    canvas.bringToFront(obj);
    canvas.requestRenderAll();
    setLayersVersion((v) => v + 1);
    void scheduleStudentSave();
  };

  const sendToBack = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    const locked = Boolean((obj as any).lpediaLocked);
    const layer = String((obj as any).lpediaLayer || 'base');
    if (mode === 'student' && (locked || submittedAt)) return;
    if (mode === 'template' && !canTemplateEdit) return;
    if (mode === 'teacher' && (!annotationMode || layer !== 'annotation')) return;
    canvas.sendToBack(obj);
    canvas.requestRenderAll();
    setLayersVersion((v) => v + 1);
    void scheduleStudentSave();
  };

  const bringForward = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    const locked = Boolean((obj as any).lpediaLocked);
    const layer = String((obj as any).lpediaLayer || 'base');
    if (mode === 'student' && (locked || submittedAt)) return;
    if (mode === 'template' && !canTemplateEdit) return;
    if (mode === 'teacher' && (!annotationMode || layer !== 'annotation')) return;
    (canvas as any).bringObjectForward?.(obj);
    canvas.requestRenderAll();
    setLayersVersion((v) => v + 1);
    void scheduleStudentSave();
  };

  const sendBackward = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    const locked = Boolean((obj as any).lpediaLocked);
    const layer = String((obj as any).lpediaLayer || 'base');
    if (mode === 'student' && (locked || submittedAt)) return;
    if (mode === 'template' && !canTemplateEdit) return;
    if (mode === 'teacher' && (!annotationMode || layer !== 'annotation')) return;
    (canvas as any).sendObjectBackwards?.(obj);
    canvas.requestRenderAll();
    setLayersVersion((v) => v + 1);
    void scheduleStudentSave();
  };

  const toggleLockSelected = () => {
    if (!canTemplateEdit) return;
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objs = canvas.getActiveObjects();
    if (objs.length === 0) return alert('請先選擇要鎖定的物件');
    const willLock = objs.some((o) => !(o as any).lpediaLocked);
    for (const o of objs) {
      (o as any).lpediaLocked = willLock;
      o.opacity = willLock ? 0.95 : 1;
    }
    applyPermissionsToObjects(canvas);
    canvas.requestRenderAll();
    void scheduleStudentSave();
  };

  const insertImageFromFile = async (file: File) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (!canEdit) return;
    if (mode === 'student' && submittedAt) return;
    if (mode === 'teacher' && !annotationMode) return;

    setLoading(true);
    setError('');
    try {
      const compressed = await compressImageToMaxBytes(file);
      const localSrc = await toDataUrl(compressed);

      // Insert immediately (no network dependency)
      const localImg: any = await (fabric.Image as any).fromURL(localSrc, { crossOrigin: undefined });
      if (!localImg) throw new Error('載入圖片失敗');
      localImg.set({ left: 80, top: 120, selectable: true });
      if (mode === 'teacher') (localImg as any).lpediaLayer = 'annotation';
      canvas.add(localImg);
      canvas.setActiveObject(localImg);
      canvas.requestRenderAll();

      // Stop blocking UI as soon as the image is inserted
      setLoading(false);

      // Background upload (best-effort), then replace src to remote url (smaller JSON, avoids huge base64 in snapshot)
      if (navigator.onLine) {
        // Abort any previous pending upload/load
        if (pendingImgAbortRef.current) pendingImgAbortRef.current.abort();
        const ac = new AbortController();
        pendingImgAbortRef.current = ac;

        void (async () => {
          try {
            const upload = authService.uploadNoteAsset(noteId, compressed) as Promise<any>;
            const resp = await withTimeout(upload, 20000, '圖片上傳超時，已改用本機圖片', () => ac.abort());
            const remoteUrl = String(resp?.asset?.url || '').trim();
            if (!remoteUrl) return;
            const crossOrigin = 'anonymous';
            await withTimeout(
              (localImg as any).setSrc(remoteUrl, { crossOrigin, signal: ac.signal }),
              15000,
              '圖片載入超時，已保留本機圖片',
              () => ac.abort()
            );
            (localImg as any).crossOrigin = crossOrigin;
            canvas.requestRenderAll();
            await scheduleStudentSave();
          } catch {
            // Keep local image; do not block
          } finally {
            if (pendingImgAbortRef.current === ac) pendingImgAbortRef.current = null;
          }
        })();
      } else {
        await scheduleStudentSave();
      }
    } catch (e: any) {
      setError(e?.message || '插入圖片失敗');
    } finally {
      setLoading(false);
    }
  };

  const loadForStudent = async () => {
    setLoading(true);
    setError('');
    try {
      let server: any = null;
      try {
        server = await authService.getMyNote(noteId);
      } catch {
        server = null;
      }
      const local = (await idbGet(buildLocalKey(noteId, viewerId)).catch(() => null)) as any;
      const serverSnap = server?.submission?.snapshot;
      const localSnap = local?.snapshot;
      const localSavedAt = Date.parse(String(local?.savedAt || ''));
      const serverUpdatedAt = Date.parse(String(server?.submission?.updatedAt || ''));
      let chosen = serverSnap;
      if (localSnap && !serverSnap) chosen = localSnap;
      else if (localSnap && serverSnap) {
        if (isBlankDocSnapshot(localSnap) && !isBlankDocSnapshot(serverSnap)) {
          chosen = serverSnap;
        } else
        if (Number.isFinite(localSavedAt) && Number.isFinite(serverUpdatedAt)) {
          chosen = localSavedAt >= serverUpdatedAt ? localSnap : serverSnap;
        } else {
          chosen = serverSnap;
        }
      }

      if (looksLikeLegacyTldrawSnapshot(chosen)) {
        docRef.current = emptyDoc();
        setError('此筆記為舊版格式（tldraw），已改用新方案（Fabric）。請重新建立筆記任務。');
      } else {
        docRef.current = normalizeDoc(chosen);
      }

      setSubmittedAt(server?.submission?.submittedAt || null);
      setNoteTitle(String(server?.note?.title || '筆記'));
      setCanEdit(!server?.submission?.submittedAt);
      setPageOrientation(docRef.current?.page?.orientation === 'landscape' ? 'landscape' : 'portrait');
      setPenColor('#111827');
      setPenWidth(2);
      setPageIndex(docRef.current.currentPage);
      setPageCount(docRef.current.pages.length);
      setDocLoadedToken(Date.now());
    } finally {
      setLoading(false);
    }
  };

  const loadForTemplate = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await authService.getNoteDetail(noteId);
      const note = resp?.note;
      setNoteTitle(String(note?.title || '筆記模板'));
      setSubmittedAt(null);
      const editable = viewerRole === 'admin' || String(note?.teacherId || '') === String(viewerId || '');
      setCanEdit(editable);
      const snap = note?.templateSnapshot;
      if (looksLikeLegacyTldrawSnapshot(snap)) {
        docRef.current = emptyDoc();
        setError('此筆記為舊版格式（tldraw），已改用新方案（Fabric）。可按「轉新格式」清空後繼續。');
      } else {
        docRef.current = normalizeDoc(snap);
      }
      setPageOrientation(docRef.current?.page?.orientation === 'landscape' ? 'landscape' : 'portrait');
      setPenColor('#111827');
      setPenWidth(2);
      setPageIndex(docRef.current.currentPage);
      setPageCount(docRef.current.pages.length);
      setDocLoadedToken(Date.now());
    } catch (e: any) {
      setError(e?.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  };

  const loadForTeacher = async () => {
    setLoading(true);
    setError('');
    try {
      const sid = String(studentId || '').trim();
      if (!sid) throw new Error('缺少 studentId');
      const resp = await authService.getNoteSubmissionDetail(noteId, sid);
      const submission = resp?.submission;
      const snap = submission?.snapshot;
      if (looksLikeLegacyTldrawSnapshot(snap)) {
        docRef.current = emptyDoc();
        setError('此筆記為舊版格式（tldraw），已改用新方案（Fabric）。舊筆記在 production 無法顯示。');
      } else {
        docRef.current = normalizeDoc(snap);
      }
      const rawAnn = submission?.annotations;
      const annDoc = looksLikeLegacyTldrawSnapshot(rawAnn) ? emptyDoc() : normalizeDoc(rawAnn);
      const aligned: FabricDocSnapshot = {
        format: 'fabric-v1',
        version: 1,
        page: { orientation: docRef.current?.page?.orientation === 'landscape' ? 'landscape' : 'portrait' },
        currentPage: docRef.current.currentPage,
        pages: docRef.current.pages.map((_, idx) => annDoc.pages[idx] || emptyPage())
      };
      annotationDocRef.current = aligned;
      setNoteTitle('學生筆記');
      setSubmittedAt(submission?.submittedAt || null);
      setCanEdit(true);
      setAnnotationMode(false);
      setAnnotationsVisible(true);
      setPageOrientation(docRef.current?.page?.orientation === 'landscape' ? 'landscape' : 'portrait');
      setPenColor('#ef4444');
      setPenWidth(3);
      setPageIndex(docRef.current.currentPage);
      setPageCount(docRef.current.pages.length);
      setDocLoadedToken(Date.now());
    } catch (e: any) {
      setError(e?.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setError('');
    setFullscreen(false);
    setTool('select');
    setAnnotationMode(false);
    setAnnotationsVisible(true);
    setLayersOpen(false);
    annotationDocRef.current = null;
    if (pendingImgAbortRef.current) {
      pendingImgAbortRef.current.abort();
      pendingImgAbortRef.current = null;
    }
    if (pendingLoadAbortRef.current) {
      pendingLoadAbortRef.current.abort();
      pendingLoadAbortRef.current = null;
    }
    if (mode === 'student') void loadForStudent();
    else if (mode === 'template') void loadForTemplate();
    else void loadForTeacher();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, noteId]);

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    const el = canvasElRef.current;
    if (!container || !el) return;

    const canvas = new fabric.Canvas(el, {
      preserveObjectStacking: true,
      selection: true,
      stopContextMenu: true
    });
    fabricRef.current = canvas;
    canvas.backgroundColor = undefined;

    const onResize = () => {
      const { w: pageW, h: pageH } = pageSizeRef.current;
      ensurePaperRect(canvas, pageW, pageH);
      fitPaperToContainer(canvas, container, pageW, pageH);
      setZoomPct(Math.round((canvas.getZoom() || 1) * 100));
    };
    window.addEventListener('resize', onResize);
    onResize();

    const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

    const onWheel = (opt: any) => {
      const e = opt?.e as WheelEvent | undefined;
      if (!e) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY;
        const zoom = canvas.getZoom() || 1;
        const next = clamp(zoom * Math.pow(0.999, delta), 0.25, 4);
        const pt = new fabric.Point((e as any).offsetX ?? canvas.getWidth() / 2, (e as any).offsetY ?? canvas.getHeight() / 2);
        canvas.zoomToPoint(pt, next);
        setZoomPct(Math.round((canvas.getZoom() || 1) * 100));
        canvas.requestRenderAll();
        return;
      }
      // Pan (scroll up/down or trackpad)
      canvas.relativePan(new fabric.Point(-e.deltaX, -e.deltaY));
      canvas.requestRenderAll();
    };
    canvas.on('mouse:wheel', onWheel);

    const onMouseDown = (opt: any) => {
      const e = opt?.e as MouseEvent | undefined;
      if (!e) return;
      if (!spaceDownRef.current) return;
      isPanningRef.current = true;
      panLastRef.current = { x: e.clientX, y: e.clientY };
      canvas.selection = false;
      canvas.defaultCursor = 'grabbing';
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    };
    const onMouseMove = (opt: any) => {
      if (!isPanningRef.current) return;
      const e = opt?.e as MouseEvent | undefined;
      const last = panLastRef.current;
      if (!e || !last) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      panLastRef.current = { x: e.clientX, y: e.clientY };
      canvas.relativePan(new fabric.Point(dx, dy));
      canvas.requestRenderAll();
    };
    const onMouseUp = () => {
      if (!isPanningRef.current) return;
      isPanningRef.current = false;
      panLastRef.current = null;
      canvas.selection = true;
      canvas.defaultCursor = 'default';
      canvas.requestRenderAll();
    };
    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);

    const allowEdit = () => {
      const st = latestStateRef.current;
      if (!st.canEdit) return false;
      if (st.mode === 'student' && st.submittedAt) return false;
      if (st.mode === 'teacher' && !st.annotationMode) return false;
      if (st.mode === 'template' && !st.canTemplateEdit) return false;
      return true;
    };

    const setDrawingMode = () => {
      if (!allowEdit()) {
        canvas.isDrawingMode = false;
        return;
      }
      if (tool !== 'pen') {
        canvas.isDrawingMode = false;
        return;
      }
      canvas.isDrawingMode = true;
      const brush = new fabric.PencilBrush(canvas);
      brush.width = penStateRef.current.width;
      brush.color = penStateRef.current.color;
      canvas.freeDrawingBrush = brush;
    };

    setDrawingMode();

    const markNewObjectLayer = (obj: fabric.Object) => {
      if (latestStateRef.current.mode === 'teacher') {
        (obj as any).lpediaLayer = 'annotation';
      } else {
        (obj as any).lpediaLayer = 'base';
      }
    };

    const onAdded = (e: any) => {
      const obj = e?.target as fabric.Object | undefined;
      if (!obj) return;
      if (suppressSaveRef.current) return;
      if (!allowEdit()) {
        canvas.remove(obj);
        return;
      }
      markNewObjectLayer(obj);
      applyPermissionsToObjects(canvas);
      setLayersVersion((v) => v + 1);
      void scheduleStudentSave();
    };
    const onModified = () => {
      if (suppressSaveRef.current) return;
      if (!allowEdit()) return;
      setLayersVersion((v) => v + 1);
      void scheduleStudentSave();
    };

    canvas.on('object:added', onAdded);
    canvas.on('object:modified', onModified);
    canvas.on('object:removed', onModified);
    canvas.on('text:changed', onModified as any);

    const bumpSelection = () => setSelectionVersion((v) => v + 1);
    canvas.on('selection:created', bumpSelection);
    canvas.on('selection:updated', bumpSelection);
    canvas.on('selection:cleared', bumpSelection);

    const onKeyDown = (evt: KeyboardEvent) => {
      if (!open) return;
      if (evt.code === 'Space') {
        spaceDownRef.current = true;
        evt.preventDefault();
        canvas.defaultCursor = 'grab';
        canvas.requestRenderAll();
        return;
      }
      if (evt.key === 'Delete' || evt.key === 'Backspace') {
        const active = canvas.getActiveObject() as any;
        if (active && (active as any).isEditing) return;
        evt.preventDefault();
        deleteSelection();
      }
    };
    const onKeyUp = (evt: KeyboardEvent) => {
      if (evt.code !== 'Space') return;
      spaceDownRef.current = false;
      if (isPanningRef.current) {
        isPanningRef.current = false;
        panLastRef.current = null;
        canvas.selection = true;
      }
      canvas.defaultCursor = 'default';
      canvas.requestRenderAll();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    void loadPage(docRef.current.currentPage);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      canvas.off('mouse:wheel', onWheel);
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:up', onMouseUp);
      canvas.off('object:added', onAdded);
      canvas.off('object:modified', onModified);
      canvas.off('object:removed', onModified);
      canvas.off('text:changed', onModified as any);
      canvas.off('selection:created', bumpSelection);
      canvas.off('selection:updated', bumpSelection);
      canvas.off('selection:cleared', bumpSelection);
      canvas.dispose();
      fabricRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const canvas = fabricRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const { w: pageW, h: pageH } = pageSizeRef.current;
    ensurePaperRect(canvas, pageW, pageH);
    fitPaperToContainer(canvas, container, pageW, pageH);
    setZoomPct(Math.round((canvas.getZoom() || 1) * 100));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fullscreen, pageOrientation]);

  useEffect(() => {
    if (!open) return;
    const canvas = fabricRef.current;
    if (!canvas) return;
    applyPermissionsToObjects(canvas);
    const allowEdit =
      canEdit &&
      !(mode === 'student' && !!submittedAt) &&
      !(mode === 'teacher' && !annotationMode) &&
      !(mode === 'template' && !canTemplateEdit);

    if (allowEdit && tool === 'pen') {
      canvas.isDrawingMode = true;
      const brush = new fabric.PencilBrush(canvas);
      brush.width = penStateRef.current.width;
      brush.color = penStateRef.current.color;
      canvas.freeDrawingBrush = brush;
    } else {
      canvas.isDrawingMode = false;
    }
    canvas.requestRenderAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotationMode, annotationsVisible, tool, canEdit, submittedAt, penColor, penWidth]);

  useEffect(() => {
    if (!open) return;
    const canvas = fabricRef.current;
    if (!canvas) return;
    suppressSaveRef.current = true;
    void loadPage(docRef.current.currentPage).finally(() => {
      suppressSaveRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, docLoadedToken]);

  useEffect(() => {
    if (!open) return;
    const onPaste = async (evt: ClipboardEvent) => {
      if (!evt.clipboardData) return;
      const items = Array.from(evt.clipboardData.items || []);
      const img = items.find((it) => it.type && it.type.startsWith('image/'));
      if (!img) return;
      const file = img.getAsFile();
      if (!file) return;
      evt.preventDefault();
      await insertImageFromFile(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, canEdit, submittedAt, annotationMode]);

  const activeTextTools = useMemo(() => {
    if (!open) return { hasText: false, bold: false };
    const canvas = fabricRef.current;
    if (!canvas) return { hasText: false, bold: false };
    const obj: any = canvas.getActiveObject();
    if (!obj) return { hasText: false, bold: false };
    const isText = obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text';
    if (!isText) return { hasText: false, bold: false };
    const fw = String(obj.fontWeight || 'normal');
    return { hasText: true, bold: fw === 'bold' || fw === '700' };
  }, [activeTextColor, pageIndex, tool, annotationMode, selectionVersion]);

  const hasSelection = useMemo(() => {
    if (!open) return false;
    const canvas = fabricRef.current;
    if (!canvas) return false;
    return canvas.getActiveObjects().length > 0;
  }, [open, pageIndex, selectionVersion, layersVersion]);

  const canEditOnCanvas =
    canEdit &&
    !(mode === 'student' && !!submittedAt) &&
    !(mode === 'teacher' && !annotationMode) &&
    !(mode === 'template' && !canTemplateEdit);

  const layerItems = useMemo(() => {
    if (!open) return [];
    const canvas = fabricRef.current;
    if (!canvas) return [];
    const objects = canvas.getObjects().filter((o) => !(o as any).lpediaPaper).slice();
    const describe = (o: any) => {
      const t = String(o?.type || '');
      if (t === 'textbox' || t === 'i-text' || t === 'text') {
        const txt = String(o.text || '').replace(/\s+/g, ' ').trim();
        return txt ? `文字：${txt.slice(0, 16)}` : '文字';
      }
      if (t === 'image') return '圖片';
      if (t === 'path' || t === 'path-group') return '筆跡';
      if (t === 'group') return '群組';
      return t || '物件';
    };
    return objects
      .map((o, i) => {
        const locked = Boolean((o as any).lpediaLocked);
        const layer = String((o as any).lpediaLayer || 'base');
        const isActive = canvas.getActiveObjects().includes(o);
        return { key: `${layer}-${o.type}-${i}`, obj: o, label: describe(o), locked, layer, isActive };
      })
      .reverse();
  }, [open, pageIndex, layersVersion, selectionVersion, annotationMode, annotationsVisible]);

  if (!open) return null;

  const statusText =
    mode === 'student'
      ? submittedAt
        ? `已交回（${submittedAt}）`
        : navigator.onLine
          ? '自動保存中'
          : '離線模式（只保存到本機）'
      : mode === 'teacher'
        ? '查看 / 批改'
        : '模板編輯';

  const showLegacyConvert = mode === 'template' && error.includes('舊版格式');

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 z-[80] flex items-center justify-center ${fullscreen ? 'p-0' : 'p-4'}`}>
      <div className={`bg-white border-4 border-brand-brown w-full overflow-hidden shadow-comic flex flex-col ${fullscreen ? 'max-w-none h-full rounded-none' : 'max-w-6xl h-[90vh] rounded-3xl'}`}>
        <div className="p-4 border-b-4 border-brand-brown bg-[#C0E2BE] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xl font-black text-brand-brown truncate">{noteTitle}</div>
            <div className="text-xs font-bold text-brand-brown/80">{statusText}</div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {mode !== 'teacher' && (
              <button
                type="button"
                onClick={() => {
                  saveCurrentPageToDoc();
                  const doc = docRef.current;
                  void exportPdfFromDoc(doc);
                }}
                className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 flex items-center gap-2"
                disabled={loading}
                title="匯出 PDF"
              >
                <FileDown className="w-4 h-4" />
                匯出PDF
              </button>
            )}

            <button
              type="button"
              onClick={() => setFullscreen((v) => !v)}
              className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 flex items-center gap-2"
              disabled={loading}
              title="全螢幕"
            >
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              {fullscreen ? '退出全螢幕' : '全螢幕'}
            </button>

            <button
              type="button"
              onClick={togglePageOrientation}
              className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 flex items-center gap-2"
              disabled={loading || !canChangePageOrientation}
              title="切換紙張方向"
            >
              <RotateCw className="w-4 h-4" />
              {pageOrientation === 'portrait' ? '橫放' : '直放'}
            </button>

            <div className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic flex items-center gap-2">
              <button
                type="button"
                className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-40"
                onClick={() => zoomBy(1 / 1.15)}
                disabled={loading}
                title="縮小"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <div className="text-sm w-14 text-center">{zoomPct}%</div>
              <button
                type="button"
                className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-40"
                onClick={() => zoomBy(1.15)}
                disabled={loading}
                title="放大"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="px-2 py-1 rounded-xl border-2 border-brand-brown hover:bg-gray-50 text-sm font-black disabled:opacity-40 flex items-center gap-1"
                onClick={fitView}
                disabled={loading}
                title="適合畫面"
              >
                <Scan className="w-4 h-4" />
                適合
              </button>
            </div>

            <div className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic flex items-center gap-2">
              <button
                type="button"
                className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-40"
                disabled={pageIndex <= 0 || loading}
                onClick={() => void loadPage(pageIndex - 1)}
                title="上一頁"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="text-sm">{pageIndex + 1}/{pageCount}頁</div>
              <button
                type="button"
                className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-40"
                disabled={pageIndex >= pageCount - 1 || loading}
                onClick={() => void loadPage(pageIndex + 1)}
                title="下一頁"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => void addPage()}
              className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 flex items-center gap-2"
              disabled={loading || !canAddPage}
              title="新增一頁"
            >
              <Plus className="w-4 h-4" />
              加頁
            </button>

            <div className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic flex items-center gap-1">
              <button
                type="button"
                className={`p-1 rounded-lg hover:bg-gray-100 ${tool === 'select' ? 'bg-gray-100' : ''}`}
                onClick={() => setTool('select')}
                title="選取"
                disabled={loading}
              >
                <MousePointer2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                className={`p-1 rounded-lg hover:bg-gray-100 ${tool === 'pen' ? 'bg-gray-100' : ''}`}
                onClick={() => setTool('pen')}
                title="筆畫"
                disabled={loading}
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1 rounded-lg hover:bg-gray-100"
                onClick={insertTextBox}
                title="插入文字框"
                disabled={loading || !canEdit || (mode === 'student' && !!submittedAt) || (mode === 'teacher' && !annotationMode)}
              >
                <Type className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1 rounded-lg hover:bg-gray-100"
                onClick={() => fileInputRef.current?.click()}
                title="插入圖片"
                disabled={loading || !canEdit || (mode === 'student' && !!submittedAt) || (mode === 'teacher' && !annotationMode)}
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1 rounded-lg hover:bg-gray-100"
                onClick={deleteSelection}
                title="刪除"
                disabled={loading}
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-40"
                onClick={bringForward}
                title="上移一層"
                disabled={loading || !hasSelection || !canEditOnCanvas}
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-40"
                onClick={sendBackward}
                title="下移一層"
                disabled={loading || !hasSelection || !canEditOnCanvas}
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                className={`p-1 rounded-lg hover:bg-gray-100 ${layersOpen ? 'bg-gray-100' : ''}`}
                onClick={() => setLayersOpen((v) => !v)}
                title="圖層"
                disabled={loading}
              >
                <Layers className="w-4 h-4" />
              </button>
            </div>

            {tool === 'pen' && (
              <div className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic flex items-center gap-2">
                <div className="text-sm">筆</div>
                <input
                  type="color"
                  value={penColor}
                  onChange={(e) => setPenColor(e.target.value)}
                  title="筆色"
                  className="w-8 h-8 p-0 border-0 bg-transparent"
                  disabled={loading || !canEditOnCanvas}
                />
                <input
                  type="range"
                  min={1}
                  max={18}
                  value={penWidth}
                  onChange={(e) => setPenWidth(Number(e.target.value))}
                  title="粗幼"
                  disabled={loading || !canEditOnCanvas}
                />
                <div className="text-xs w-10 text-right">{penWidth}px</div>
              </div>
            )}

            {activeTextTools.hasText && (
              <div className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic flex items-center gap-2">
                <button
                  type="button"
                  className={`p-1 rounded-lg hover:bg-gray-100 ${activeTextTools.bold ? 'bg-gray-100' : ''}`}
                  onClick={toggleBold}
                  title="粗體"
                  disabled={loading}
                >
                  <Bold className="w-4 h-4" />
                </button>
                <input
                  type="color"
                  value={activeTextColor}
                  onChange={(e) => {
                    const c = e.target.value;
                    setActiveTextColor(c);
                    applyTextStyle({ fill: c } as any);
                  }}
                  title="文字顏色"
                  className="w-8 h-8 p-0 border-0 bg-transparent"
                />
                <button
                  type="button"
                  className="px-2 py-1 rounded-xl border-2 border-brand-brown hover:bg-gray-50 text-sm font-black"
                  onClick={() => toggleList('bullet')}
                  title="項目符號列表"
                  disabled={loading}
                >
                  • 列表
                </button>
                <button
                  type="button"
                  className="px-2 py-1 rounded-xl border-2 border-brand-brown hover:bg-gray-50 text-sm font-black"
                  onClick={() => toggleList('number')}
                  title="編號列表"
                  disabled={loading}
                >
                  1. 列表
                </button>
                <button
                  type="button"
                  className="px-2 py-1 rounded-xl border-2 border-brand-brown hover:bg-gray-50 text-sm font-black"
                  onClick={bringToFront}
                  title="置頂"
                  disabled={loading}
                >
                  置頂
                </button>
                <button
                  type="button"
                  className="px-2 py-1 rounded-xl border-2 border-brand-brown hover:bg-gray-50 text-sm font-black"
                  onClick={sendToBack}
                  title="置底"
                  disabled={loading}
                >
                  置底
                </button>
              </div>
            )}

            {mode === 'student' && canEdit && (
              <button
                type="button"
                onClick={async () => {
                  const prompt = window.prompt('輸入要生成思維圖的內容（可貼上段落/重點）');
                  if (!prompt || !prompt.trim()) return;
                    const canvas = fabricRef.current;
                    if (!canvas) return;
                    setLoading(true);
                    setError('');
                    try {
                      const resp = await authService.generateMindmap({ prompt: prompt.trim() });
                      const { w: pageW, h: pageH } = pageSizeRef.current;
                      insertMindmap(canvas, resp, pageW, pageH);
                      await scheduleStudentSave();
                    } catch (e: any) {
                      setError(e?.message || '生成失敗');
                    } finally {
                      setLoading(false);
                    }
                }}
                className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 flex items-center gap-2"
                disabled={loading}
                title="AI 思維圖（會插入到本頁）"
              >
                <Sparkles className="w-4 h-4" />
                AI思維圖
              </button>
            )}

            {mode === 'template' && (
              <button
                type="button"
                onClick={toggleLockSelected}
                className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 flex items-center gap-2"
                disabled={loading || !canTemplateEdit}
                title="鎖定/解鎖選取物件（學生不能更改鎖定物件）"
              >
                <Lock className="w-4 h-4" />
                鎖定
              </button>
            )}

            {showLegacyConvert && (
              <button
                type="button"
                onClick={() => void resetToBlank()}
                className="px-3 py-2 rounded-2xl border-4 border-orange-700 bg-orange-600 text-white font-black shadow-comic hover:bg-orange-700 flex items-center gap-2"
                disabled={loading || !canTemplateEdit}
                title="清空並轉新格式（Fabric）"
              >
                轉新格式
              </button>
            )}

            {mode === 'template' && (
              <button
                type="button"
                onClick={async () => {
                  setLoading(true);
                  setError('');
                  try {
                    saveCurrentPageToDoc();
                    await authService.updateNoteTemplate(noteId, docRef.current);
                    alert('已保存模板');
                  } catch (e: any) {
                    setError(e?.message || '保存失敗');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 flex items-center gap-2"
                disabled={loading || !canTemplateEdit}
              >
                <Save className="w-4 h-4" />
                保存模板
              </button>
            )}

            {mode === 'template' && (
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm('確定要派發？派發後模板會固定，學生各自一份。')) return;
                  setLoading(true);
                  setError('');
                  try {
                    saveCurrentPageToDoc();
                    await authService.updateNoteTemplate(noteId, docRef.current);
                    await authService.publishNote(noteId);
                    alert('派發成功！');
                    onPublished?.();
                    onClose();
                  } catch (e: any) {
                    setError(e?.message || '派發失敗');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="px-3 py-2 rounded-2xl border-4 border-blue-700 bg-blue-600 text-white font-black shadow-comic hover:bg-blue-700 flex items-center gap-2"
                disabled={loading || !canTemplateEdit}
              >
                <Send className="w-4 h-4" />
                派發
              </button>
            )}

            {mode === 'teacher' && (
              <>
                <button
                  type="button"
                  onClick={() => setAnnotationsVisible((v) => !v)}
                  className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 flex items-center gap-2"
                  disabled={loading || !canAnnotate}
                  title="顯示/隱藏批改層"
                >
                  {annotationsVisible ? '隱藏批改' : '顯示批改'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!canAnnotate) return;
                    setAnnotationMode((v) => !v);
                  }}
                  className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 flex items-center gap-2"
                  disabled={loading || !canAnnotate}
                  title="批改模式（只會保存批改層，不會改動學生內容）"
                >
                  <Lock className="w-4 h-4" />
                  {annotationMode ? '退出批改' : '批改模式'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!canAnnotate) return;
                    const sid = String(studentId || '').trim();
                    if (!sid) return;
                    setLoading(true);
                    setError('');
	                  try {
	                    const canvas = fabricRef.current;
	                    if (!canvas) throw new Error('畫布未就緒');
	                    if (!annotationDocRef.current) {
	                      annotationDocRef.current = {
	                        format: 'fabric-v1',
	                        version: 1,
	                        currentPage: docRef.current.currentPage,
	                        pages: docRef.current.pages.map(() => emptyPage())
	                      };
	                    }
	                    saveCurrentAnnotationsToRef();
	                    await authService.saveNoteAnnotations(noteId, sid, annotationDocRef.current);
	                    alert('已保存批改');
	                    setAnnotationMode(false);
	                  } catch (e: any) {
                      setError(e?.message || '保存失敗');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 flex items-center gap-2"
                  disabled={loading || !canAnnotate}
                >
                  <Save className="w-4 h-4" />
                  保存批改
                </button>
              </>
            )}

            {canSubmit && (
              <button
                type="button"
                onClick={async () => {
                  if (submittedAt) return;
                  if (!window.confirm('確定要交回？交回後不能再修改。')) return;
                  setLoading(true);
                  setError('');
                  try {
                    saveCurrentPageToDoc();
                    await authService.saveMyNoteDraft(noteId, docRef.current);
                    const resp = await authService.submitMyNote(noteId);
                    setSubmittedAt(resp?.submission?.submittedAt || new Date().toISOString());
                    setCanEdit(false);
                    alert('已交回！');
                  } catch (e: any) {
                    setError(e?.message || '交回失敗');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="px-3 py-2 rounded-2xl border-4 border-green-700 bg-green-600 text-white font-black shadow-comic hover:bg-green-700 flex items-center gap-2"
                disabled={loading || !canEdit || !!submittedAt}
              >
                <Send className="w-4 h-4" />
                交回
              </button>
            )}

            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
            >
              <X className="w-6 h-6 text-brand-brown" />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 border-b-2 border-red-200 bg-red-50 text-red-700 font-bold">
            {error}
          </div>
        )}

        <div ref={containerRef} className="flex-1 min-h-0 relative bg-gray-200">
          <canvas ref={canvasElRef} className="w-full h-full" />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              await insertImageFromFile(file);
            }}
          />
          {layersOpen && (
            <div className="absolute right-3 top-3 w-80 max-w-[90vw] rounded-2xl border-4 border-brand-brown bg-white shadow-comic overflow-hidden">
              <div className="p-2 bg-[#C0E2BE] border-b-4 border-brand-brown flex items-center justify-between">
                <div className="font-black text-brand-brown">圖層</div>
                <button
                  type="button"
                  onClick={() => setLayersOpen(false)}
                  className="w-8 h-8 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                  title="關閉"
                >
                  <X className="w-4 h-4 text-brand-brown" />
                </button>
              </div>
              <div className="p-2 max-h-[60vh] overflow-auto">
                {layerItems.length === 0 ? (
                  <div className="text-sm text-gray-500 font-bold p-2">（此頁沒有物件）</div>
                ) : (
                  <div className="space-y-2">
                    {layerItems.map((it) => {
                      const canReorder =
                        canEditOnCanvas &&
                        !(mode === 'teacher' && it.layer !== 'annotation') &&
                        !(mode === 'student' && (it.locked || !!submittedAt));
                      return (
                        <button
                          key={it.key}
                          type="button"
                          className={`w-full text-left p-2 rounded-2xl border-2 ${
                            it.isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                          }`}
                          onClick={() => {
                            const canvas = fabricRef.current;
                            if (!canvas) return;
                            canvas.setActiveObject(it.obj);
                            canvas.requestRenderAll();
                            setSelectionVersion((v) => v + 1);
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-black text-brand-brown truncate">{it.label}</div>
                              <div className="text-xs text-brand-brown/70">
                                {it.layer === 'annotation' ? '批改層' : '內容'}
                                {it.locked ? ' · 鎖定' : ''}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="p-1 rounded-lg border-2 border-brand-brown hover:bg-gray-100 disabled:opacity-40"
                                title="置頂"
                                disabled={!canReorder}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const canvas = fabricRef.current;
                                  if (!canvas) return;
                                  canvas.setActiveObject(it.obj);
                                  setSelectionVersion((v) => v + 1);
                                  bringToFront();
                                }}
                              >
                                <ChevronsUp className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                className="p-1 rounded-lg border-2 border-brand-brown hover:bg-gray-100 disabled:opacity-40"
                                title="上移一層"
                                disabled={!canReorder}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const canvas = fabricRef.current;
                                  if (!canvas) return;
                                  canvas.setActiveObject(it.obj);
                                  setSelectionVersion((v) => v + 1);
                                  bringForward();
                                }}
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                className="p-1 rounded-lg border-2 border-brand-brown hover:bg-gray-100 disabled:opacity-40"
                                title="下移一層"
                                disabled={!canReorder}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const canvas = fabricRef.current;
                                  if (!canvas) return;
                                  canvas.setActiveObject(it.obj);
                                  setSelectionVersion((v) => v + 1);
                                  sendBackward();
                                }}
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                className="p-1 rounded-lg border-2 border-brand-brown hover:bg-gray-100 disabled:opacity-40"
                                title="置底"
                                disabled={!canReorder}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const canvas = fabricRef.current;
                                  if (!canvas) return;
                                  canvas.setActiveObject(it.obj);
                                  setSelectionVersion((v) => v + 1);
                                  sendToBack();
                                }}
                              >
                                <ChevronsDown className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          {loading && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center pointer-events-none">
              <div className="px-4 py-2 rounded-2xl border-4 border-brand-brown bg-white font-black text-brand-brown shadow-comic">
                處理中…
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoteEditorModal;
