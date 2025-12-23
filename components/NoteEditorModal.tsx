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
import { VISIBLE_SUBJECTS } from '../platform';

type Mode = 'student' | 'template' | 'teacher' | 'draft';

export type NoteEditorHandle = {
  getSnapshot: () => any;
};

type Props = {
  open: boolean;
  onClose: () => void;
  authService: any;
  mode: Mode;
  noteId?: string;
  viewerId: string;
  viewerRole: 'student' | 'teacher' | 'admin';
  studentId?: string; // teacher view
  onPublished?: () => void;
  // draft mode
  draftId?: string;
  draftReadOnly?: boolean;
  draftTitle?: string;
  draftSubject?: string;
  draftSnapshot?: any;
  onDraftTitleChange?: (next: string) => void;
  onDraftSubjectChange?: (next: string) => void;
  onDraftCancel?: () => void;
  onDraftSave?: () => void;
  onDraftSaveAndPublish?: () => void;
};

const A4_PORTRAIT_W = 595;
const A4_PORTRAIT_H = 842;

type PageOrientation = 'portrait' | 'landscape';

const getA4Size = (orientation: PageOrientation) => {
  if (orientation === 'landscape') return { w: A4_PORTRAIT_H, h: A4_PORTRAIT_W };
  return { w: A4_PORTRAIT_W, h: A4_PORTRAIT_H };
};

const PAGE_GAP = 80;

const getPageOffsetY = (pageIndex: number, pageH: number) => pageIndex * (pageH + PAGE_GAP);

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const getPageIndexFromY = (y: number, pageH: number, pageCount: number) => {
  if (pageCount <= 1) return 0;
  const idx = Math.floor((Number.isFinite(y) ? y : 0) / (pageH + PAGE_GAP));
  return clamp(idx, 0, pageCount - 1);
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

const sanitizePageJson = (pageJson: any, pageW: number, pageH: number) => {
  const base = pageJson && typeof pageJson === 'object' ? pageJson : emptyPage();
  const objects = Array.isArray((base as any).objects) ? (base as any).objects : [];
  const near = (a: number, b: number, tol: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
  const isPaperLikeRect = (o: any) => {
    if (!o || typeof o !== 'object') return false;
    if (o.lpediaPaper) return true;
    if (String(o.lpediaLayer || '') === 'paper') return true;
    if (String(o.type || '') !== 'rect') return false;
    const fill = String(o.fill || '').toLowerCase();
    const stroke = String(o.stroke || '').toLowerCase();
    const w = Number(o.width);
    const h = Number(o.height);
    const left = Number(o.left);
    const top = Number(o.top);
    const scaleX = Number(o.scaleX ?? 1);
    const scaleY = Number(o.scaleY ?? 1);
    const effW = Number.isFinite(w) && Number.isFinite(scaleX) ? w * scaleX : w;
    const effH = Number.isFinite(h) && Number.isFinite(scaleY) ? h * scaleY : h;

    const fillOk = fill === '#fff' || fill === '#ffffff' || fill === 'white';
    const strokeOk = stroke === '#d1d5db' || stroke.includes('209') || stroke === 'rgb(209,213,219)';
    const sizeOk = near(effW, pageW, 6) && near(effH, pageH, 6);
    const posOk = near(left, 0, 6) && near(top, 0, 6);
    return fillOk && strokeOk && sizeOk && posOk;
  };

  const nextObjects = objects.filter((o: any) => !isPaperLikeRect(o));
  return { ...base, objects: nextObjects };
};

const normalizeDoc = (snap: any): FabricDocSnapshot => {
  if (isFabricDocSnapshot(snap)) {
    const orientation: PageOrientation = snap?.page?.orientation === 'landscape' ? 'landscape' : 'portrait';
    const { w: pageW, h: pageH } = getA4Size(orientation);
    const pagesRaw = snap.pages.length > 0 ? snap.pages : [emptyPage()];
    const pages = pagesRaw.map((p) => sanitizePageJson(p, pageW, pageH));
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

const canvasMoveToIndex = (canvas: fabric.Canvas, obj: fabric.Object, index: number) => {
  const c: any = canvas as any;
  if (typeof c.moveObjectTo === 'function') return c.moveObjectTo(obj, index);
  if (typeof c.moveTo === 'function') return c.moveTo(obj, index);
  const o: any = obj as any;
  if (typeof o.moveTo === 'function') return o.moveTo(index);
};

const getPaperObjects = (canvas: fabric.Canvas) =>
  canvas
    .getObjects()
    .filter((o) => Boolean((o as any).lpediaPaper) || String((o as any).lpediaLayer || '') === 'paper') as fabric.Object[];

const normalizePaperZOrder = (canvas: fabric.Canvas) => {
  const papers = getPaperObjects(canvas);
  papers.forEach((p, idx) => canvasMoveToIndex(canvas, p, idx));
  papers.forEach((p, idx) => canvasMoveToIndex(canvas, p, idx));
  return papers.length;
};

const sendToBackAbovePaper = (canvas: fabric.Canvas, obj: fabric.Object) => {
  const paperCount = normalizePaperZOrder(canvas);
  canvasMoveToIndex(canvas, obj, paperCount);
  normalizePaperZOrder(canvas);
};

const bringToFrontCompat = (canvas: fabric.Canvas, obj: fabric.Object) => {
  const c: any = canvas as any;
  if (typeof c.bringObjectToFront === 'function') return c.bringObjectToFront(obj);
  if (typeof c.bringToFront === 'function') return c.bringToFront(obj);
  return canvasMoveToIndex(canvas, obj, canvas.getObjects().length - 1);
};

const ensurePaperPages = (canvas: fabric.Canvas, pageW: number, pageH: number, pageCount: number) => {
  const near = (a: number, b: number, tol: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
  const isPaperRectLike = (o: any) => {
    if (!o || typeof o !== 'object') return false;
    if (o.lpediaPaper) return true;
    if (String(o.lpediaLayer || '') === 'paper') return true;
    if (String(o.type || '') !== 'rect') return false;
    const fill = String(o.fill || '').toLowerCase();
    const stroke = String(o.stroke || '').toLowerCase();
    const w = Number(o.width);
    const h = Number(o.height);
    const left = Number(o.left);
    const top = Number(o.top);
    const scaleX = Number(o.scaleX ?? 1);
    const scaleY = Number(o.scaleY ?? 1);
    const effW = Number.isFinite(w) && Number.isFinite(scaleX) ? w * scaleX : w;
    const effH = Number.isFinite(h) && Number.isFinite(scaleY) ? h * scaleY : h;
    const fillOk = fill === '#fff' || fill === '#ffffff' || fill === 'white';
    const strokeOk = stroke === '#d1d5db' || stroke.includes('209') || stroke === 'rgb(209,213,219)';
    const sizeOk = near(effW, pageW, 6) && near(effH, pageH, 6);
    const leftOk = near(left, 0, 6);
    if (!(fillOk && strokeOk && sizeOk && leftOk)) return false;
    // Top must match a page position (stacked layout)
    for (let i = 0; i < pageCount; i += 1) {
      if (near(top, getPageOffsetY(i, pageH), 8)) return true;
    }
    return false;
  };

  // Always remove any existing paper-like rects (prevents duplicates growing on addPage)
  const existing = canvas.getObjects().slice();
  for (const o of existing) {
    if (isPaperRectLike(o as any)) canvas.remove(o);
  }

  for (let i = 0; i < pageCount; i += 1) {
    const top = getPageOffsetY(i, pageH);
    const rect = new fabric.Rect({
      left: 0,
      top,
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
    (rect as any).lpediaPageIndex = i;
    rect.set({
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true
    } as any);
    canvas.add(rect);
  }

  normalizePaperZOrder(canvas);
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
  pageH: number,
  offsetY = 0
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
    nodePos.set(n.id, { x: margin + col * (nodeW + gapX), y: offsetY + margin + row * (nodeH + gapY) });
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
    sendToBackAbovePaper(canvas, line);
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

const NoteEditorModal = React.forwardRef<NoteEditorHandle, Props>(
  (
    {
      open,
      onClose,
      authService,
      mode,
      noteId,
      viewerId,
      viewerRole,
      studentId,
      onPublished,
      draftId,
      draftReadOnly,
      draftTitle,
      draftSubject,
      draftSnapshot,
      onDraftTitleChange,
      onDraftSubjectChange,
      onDraftCancel,
      onDraftSave,
      onDraftSaveAndPublish
    },
    ref
  ) => {
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

  const effectiveNoteId = mode === 'draft' ? `draft:${String(draftId || 'new')}` : String(noteId || '').trim();
  const isDraft = mode === 'draft';
  const isDraftReadOnly = !!draftReadOnly;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const suppressSaveRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const templateSaveTimerRef = useRef<number | null>(null);
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

  const canTemplateEdit = (mode === 'template' || mode === 'draft') && canEdit;
  const canAddPage =
    ((mode === 'template' || mode === 'draft') && canEdit) ||
    (mode === 'student' && canEdit && !submittedAt);
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
        (o as any).hasControls = false;
        (o as any).hasBorders = false;
        (o as any).lockMovementX = true;
        (o as any).lockMovementY = true;
        (o as any).lockScalingX = true;
        (o as any).lockScalingY = true;
        (o as any).lockRotation = true;
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
          (o as any).hasControls = false;
          (o as any).hasBorders = false;
          (o as any).lockMovementX = true;
          (o as any).lockMovementY = true;
          (o as any).lockScalingX = true;
          (o as any).lockScalingY = true;
          (o as any).lockRotation = true;
        } else {
          o.selectable = true;
          o.evented = true;
          (o as any).hasControls = true;
          (o as any).hasBorders = true;
          (o as any).lockMovementX = false;
          (o as any).lockMovementY = false;
          (o as any).lockScalingX = false;
          (o as any).lockScalingY = false;
          (o as any).lockRotation = false;
        }
        continue;
      }

      // template
      o.selectable = true;
      o.evented = true;
      (o as any).hasBorders = true;
      (o as any).hasControls = !locked;
      (o as any).lockMovementX = locked;
      (o as any).lockMovementY = locked;
      (o as any).lockScalingX = locked;
      (o as any).lockScalingY = locked;
      (o as any).lockRotation = locked;
      o.opacity = locked ? 0.95 : 1;
    }
  };

  const saveCanvasToDoc = () => {
    if (mode === 'teacher') return;
    const canvas = fabricRef.current;
    if (!canvas) return;
    const { h: pageH } = pageSizeRef.current;
    const pageCountNow = docRef.current.pages.length;
    const json = canvas.toJSON(['lpediaLocked', 'lpediaLayer', 'crossOrigin', 'lpediaPaper', 'lpediaPageIndex']);
    const objects = Array.isArray((json as any).objects) ? (json as any).objects : [];

    const pages = Array.from({ length: pageCountNow }, () => ({ ...emptyPage(), objects: [] as any[] }));
    for (const o of objects) {
      if (o?.lpediaPaper || String(o?.lpediaLayer || '') === 'paper') continue;
      const layer = String(o?.lpediaLayer || 'base');
      if (layer === 'annotation') continue;
      const rawTop = Number(o?.top) || 0;
      const explicitIdx = Number(o?.lpediaPageIndex);
      const idx = Number.isFinite(explicitIdx)
        ? clamp(explicitIdx, 0, pageCountNow - 1)
        : getPageIndexFromY(rawTop, pageH, pageCountNow);
      const offsetY = getPageOffsetY(idx, pageH);
      const normalized = { ...o, top: rawTop - offsetY, lpediaLayer: layer, lpediaPageIndex: idx };
      pages[idx].objects.push(normalized);
    }

    docRef.current.pages = pages.map((p) => stripPaperFromCanvasJson(p));
    docRef.current.currentPage = clamp(docRef.current.currentPage ?? 0, 0, docRef.current.pages.length - 1);
  };

  React.useImperativeHandle(ref, () => ({
    getSnapshot: () => {
      saveCanvasToDoc();
      return { ...docRef.current, currentPage: docRef.current.currentPage };
    }
  }));

  const scheduleStudentSave = async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (suppressSaveRef.current) return;
    if (mode !== 'student') return;
    const nid = String(noteId || '').trim();
    if (!nid) return;

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        saveCanvasToDoc();
        const doc = { ...docRef.current, currentPage: docRef.current.currentPage };
        await idbSet(buildLocalKey(nid, viewerId), { savedAt: new Date().toISOString(), snapshot: doc });

        if (!navigator.onLine) return;
        if (submittedAt) return;
        await authService.saveMyNoteDraft(nid, doc);
      } catch {
        // keep silent (offline / network)
      }
    }, 1200);
  };

  const scheduleTemplateSave = async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (suppressSaveRef.current) return;
    if (mode !== 'template') return;
    if (!canTemplateEdit) return;
    const nid = String(noteId || '').trim();
    if (!nid) return;

    if (templateSaveTimerRef.current) window.clearTimeout(templateSaveTimerRef.current);
    templateSaveTimerRef.current = window.setTimeout(async () => {
      try {
        saveCanvasToDoc();
        const doc = { ...docRef.current, currentPage: docRef.current.currentPage };
        await idbSet(buildLocalKey(nid, viewerId), { savedAt: new Date().toISOString(), snapshot: doc });

        if (!navigator.onLine) return;
        await authService.updateNoteTemplate(nid, doc);
      } catch {
        // keep silent (offline / network)
      }
    }, 1200);
  };

  const scheduleDraftSave = async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (suppressSaveRef.current) return;
    if (mode !== 'draft') return;
    if (!canTemplateEdit) return;
    if (!draftId) return;
    if (isDraftReadOnly) return;

    if (templateSaveTimerRef.current) window.clearTimeout(templateSaveTimerRef.current);
    templateSaveTimerRef.current = window.setTimeout(async () => {
      try {
        saveCanvasToDoc();
        const doc = { ...docRef.current, currentPage: docRef.current.currentPage };
        await idbSet(buildLocalKey(effectiveNoteId, viewerId), { savedAt: new Date().toISOString(), snapshot: doc });
        if (!navigator.onLine) return;
        await authService.updateDraftContent(String(draftId), { note: { templateSnapshot: doc } });
      } catch {
        // keep silent (offline / network)
      }
    }, 1200);
  };

  const scheduleAutoSave = async () => {
    if (mode === 'student') return scheduleStudentSave();
    if (mode === 'template') return scheduleTemplateSave();
    if (mode === 'draft') return scheduleDraftSave();
    return;
  };

  const saveCanvasAnnotationsToRef = () => {
    if (mode !== 'teacher') return;
    const canvas = fabricRef.current;
    const ann = annotationDocRef.current;
    if (!canvas || !ann) return;
    const { h: pageH } = pageSizeRef.current;
    const pageCountNow = docRef.current.pages.length;
    const json = canvas.toJSON(['lpediaLocked', 'lpediaLayer', 'crossOrigin', 'lpediaPaper', 'lpediaPageIndex']);
    const objects = Array.isArray((json as any).objects) ? (json as any).objects : [];
    const pages = Array.from({ length: pageCountNow }, () => ({ ...emptyPage(), objects: [] as any[] }));
    for (const o of objects) {
      if (o?.lpediaPaper || String(o?.lpediaLayer || '') === 'paper') continue;
      const layer = String(o?.lpediaLayer || '');
      if (layer !== 'annotation') continue;
      const rawTop = Number(o?.top) || 0;
      const explicitIdx = Number(o?.lpediaPageIndex);
      const idx = Number.isFinite(explicitIdx)
        ? clamp(explicitIdx, 0, pageCountNow - 1)
        : getPageIndexFromY(rawTop, pageH, pageCountNow);
      const offsetY = getPageOffsetY(idx, pageH);
      const normalized = { ...o, top: rawTop - offsetY, lpediaLayer: 'annotation', lpediaPageIndex: idx };
      pages[idx].objects.push(normalized);
    }
    ann.pages = pages.map((p) => stripPaperFromCanvasJson(p));
    ann.currentPage = clamp(ann.currentPage ?? 0, 0, ann.pages.length - 1);
  };

  const reloadCanvas = async (opts?: { fit?: boolean }) => {
    const canvas = fabricRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const { w: pageW, h: pageH } = pageSizeRef.current;
    const pageCountNow = docRef.current.pages.length;
    if (pendingLoadAbortRef.current) pendingLoadAbortRef.current.abort();
    const loadAbort = new AbortController();
    pendingLoadAbortRef.current = loadAbort;
    suppressSaveRef.current = true;
    try {
      setPageCount(pageCountNow);
      docRef.current.currentPage = clamp(docRef.current.currentPage ?? 0, 0, pageCountNow - 1);

      const prevVpt = Array.isArray(canvas.viewportTransform) ? [...canvas.viewportTransform] : null;

      canvas.clear();
      canvas.backgroundColor = undefined;

      const merged = { ...emptyPage(), objects: [] as any[] };
      for (let i = 0; i < pageCountNow; i += 1) {
        const offsetY = getPageOffsetY(i, pageH);
        const baseJson = docRef.current.pages[i] || emptyPage();
        const baseObjects = Array.isArray((baseJson as any).objects) ? (baseJson as any).objects : [];
        for (const o of baseObjects) {
          if (o?.lpediaPaper || String(o?.lpediaLayer || '') === 'paper') continue;
          const rawTop = Number(o?.top) || 0;
          merged.objects.push({
            ...o,
            top: rawTop + offsetY,
            lpediaLayer: String(o?.lpediaLayer || 'base'),
            lpediaPageIndex: i
          });
        }
        if (mode === 'teacher') {
          const ann = annotationDocRef.current;
          const annPage = ann ? ann.pages[i] : null;
          const annObjects = Array.isArray((annPage as any)?.objects) ? (annPage as any).objects : [];
          for (const o of annObjects) {
            if (o?.lpediaPaper || String(o?.lpediaLayer || '') === 'paper') continue;
            const rawTop = Number(o?.top) || 0;
            merged.objects.push({ ...o, top: rawTop + offsetY, lpediaLayer: 'annotation', lpediaPageIndex: i });
          }
        }
      }

      await withTimeout(canvas.loadFromJSON(merged, undefined, { signal: loadAbort.signal } as any), 15000, '載入頁面超時', () => loadAbort.abort());
      ensurePaperPages(canvas, pageW, pageH, pageCountNow);
      applyPermissionsToObjects(canvas);
      if (opts?.fit !== true && prevVpt) {
        canvas.setViewportTransform(prevVpt as any);
      } else {
        fitPaperToContainer(canvas, container, pageW, pageH);
      }
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

  const goToPage = (idx: number) => {
    const canvas = fabricRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const pageCountNow = docRef.current.pages.length;
    const { w: pageW, h: pageH } = pageSizeRef.current;
    const next = clamp(idx, 0, pageCountNow - 1);
    const s = canvas.getZoom() || 1;
    const w = Math.max(1, container.clientWidth);
    const padding = 48;
    const tx = (w - pageW * s) / 2;
    const offsetY = getPageOffsetY(next, pageH);
    const ty = padding - offsetY * s;
    canvas.setViewportTransform([s, 0, 0, s, tx, ty]);
    docRef.current.currentPage = next;
    setPageIndex(next);
    canvas.requestRenderAll();
  };

  const syncCurrentPageFromViewport = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const v = canvas.viewportTransform;
    if (!Array.isArray(v)) return;
    const s = v[0] || 1;
    const ty = v[5] || 0;
    const { h: pageH } = pageSizeRef.current;
    const centerY = canvas.getHeight() / 2;
    const worldY = (centerY - ty) / s;
    const idx = getPageIndexFromY(worldY, pageH, docRef.current.pages.length);
    if (idx !== pageIndex) {
      docRef.current.currentPage = idx;
      setPageIndex(idx);
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
    await reloadCanvas({ fit: true });
    goToPage(0);
    setError('');
  };

  const addPage = async () => {
    if (!canAddPage) return;
    saveCanvasToDoc();
    docRef.current.pages.push(emptyPage());
    setPageCount(docRef.current.pages.length);
    await reloadCanvas();
    await scheduleAutoSave();
  };

  const canChangePageOrientation =
    ((mode === 'template' || mode === 'draft') && canTemplateEdit) || (mode === 'student' && canEdit && !submittedAt);

  const fitView = () => {
    const canvas = fabricRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const { w: pageW, h: pageH } = pageSizeRef.current;
    ensurePaperPages(canvas, pageW, pageH, docRef.current.pages.length);
    fitPaperToContainer(canvas, container, pageW, pageH);
    setZoomPct(Math.round((canvas.getZoom() || 1) * 100));
  };

  const zoomBy = (factor: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
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
    saveCanvasToDoc();
    docRef.current.page = { ...(docRef.current.page || {}), orientation: next };
    setPageOrientation(next);
    void reloadCanvas({ fit: true }).then(() => {
      goToPage(docRef.current.currentPage);
    });
  };

  const insertTextBox = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (!canEdit) return;
    if (mode === 'student' && submittedAt) return;
    if (mode === 'teacher' && !annotationMode) return;

    const v = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
    const s = v[0] || 1;
    const tx = v[4] || 0;
    const ty = v[5] || 0;
    const centerX = canvas.getWidth() / 2;
    const centerY = canvas.getHeight() / 2;
    const worldX = (centerX - tx) / s;
    const worldY = (centerY - ty) / s;

    const tb = new fabric.Textbox('雙擊編輯文字', {
      left: worldX - 210,
      top: worldY - 40,
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
    void scheduleAutoSave();
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
    void scheduleAutoSave();
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
    void scheduleAutoSave();
  };

  const bringToFront = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    const locked = Boolean((obj as any).lpediaLocked);
    const layer = String((obj as any).lpediaLayer || 'base');
    if (mode === 'student' && (locked || submittedAt)) return;
    if ((mode === 'template' || mode === 'draft') && !canTemplateEdit) return;
    if (mode === 'teacher' && (!annotationMode || layer !== 'annotation')) return;
    bringToFrontCompat(canvas, obj);
    canvas.requestRenderAll();
    setLayersVersion((v) => v + 1);
    void scheduleAutoSave();
  };

  const sendToBack = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    const locked = Boolean((obj as any).lpediaLocked);
    const layer = String((obj as any).lpediaLayer || 'base');
    if (mode === 'student' && (locked || submittedAt)) return;
    if ((mode === 'template' || mode === 'draft') && !canTemplateEdit) return;
    if (mode === 'teacher' && (!annotationMode || layer !== 'annotation')) return;
    sendToBackAbovePaper(canvas, obj);
    canvas.requestRenderAll();
    setLayersVersion((v) => v + 1);
    void scheduleAutoSave();
  };

  const bringForward = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    const locked = Boolean((obj as any).lpediaLocked);
    const layer = String((obj as any).lpediaLayer || 'base');
    if (mode === 'student' && (locked || submittedAt)) return;
    if ((mode === 'template' || mode === 'draft') && !canTemplateEdit) return;
    if (mode === 'teacher' && (!annotationMode || layer !== 'annotation')) return;
    (canvas as any).bringObjectForward?.(obj);
    canvas.requestRenderAll();
    setLayersVersion((v) => v + 1);
    void scheduleAutoSave();
  };

  const sendBackward = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    const locked = Boolean((obj as any).lpediaLocked);
    const layer = String((obj as any).lpediaLayer || 'base');
    if (mode === 'student' && (locked || submittedAt)) return;
    if ((mode === 'template' || mode === 'draft') && !canTemplateEdit) return;
    if (mode === 'teacher' && (!annotationMode || layer !== 'annotation')) return;
    (canvas as any).sendObjectBackwards?.(obj);
    canvas.requestRenderAll();
    setLayersVersion((v) => v + 1);
    void scheduleAutoSave();
  };

  const toggleLockSelected = () => {
    if (!canTemplateEdit) return;
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objs = canvas.getActiveObjects();
    if (objs.length === 0) return alert('請先選擇要鎖定的物件');
    const willLock = objs.some((o) => !(o as any).lpediaLocked);
    for (const o of objs) {
      if ((o as any).lpediaPaper) continue;
      (o as any).lpediaLocked = willLock;
      o.opacity = willLock ? 0.95 : 1;
      (o as any).lockMovementX = willLock;
      (o as any).lockMovementY = willLock;
      (o as any).lockScalingX = willLock;
      (o as any).lockScalingY = willLock;
      (o as any).lockRotation = willLock;
      (o as any).hasControls = !willLock;
      (o as any).hasBorders = true;
    }
    applyPermissionsToObjects(canvas);
    canvas.requestRenderAll();
    void scheduleAutoSave();
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
      const v = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
      const s = v[0] || 1;
      const tx = v[4] || 0;
      const ty = v[5] || 0;
      const worldX = (canvas.getWidth() / 2 - tx) / s;
      const worldY = (canvas.getHeight() / 2 - ty) / s;
      localImg.set({ left: worldX - 160, top: worldY - 120, selectable: true });
      if (mode === 'teacher') (localImg as any).lpediaLayer = 'annotation';
      canvas.add(localImg);
      canvas.setActiveObject(localImg);
      canvas.requestRenderAll();

      // Stop blocking UI as soon as the image is inserted
      setLoading(false);
      await scheduleAutoSave();
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
      const nid = String(noteId || '').trim();
      if (!nid) throw new Error('缺少 noteId');
      let server: any = null;
      try {
        server = await authService.getMyNote(nid);
      } catch {
        server = null;
      }
      const local = (await idbGet(buildLocalKey(nid, viewerId)).catch(() => null)) as any;
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
    } catch (e: any) {
      setError(e?.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  };

  const loadForTemplate = async () => {
    setLoading(true);
    setError('');
    try {
      const nid = String(noteId || '').trim();
      if (!nid) throw new Error('缺少 noteId');
      const resp = await authService.getNoteDetail(nid);
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
      const nid = String(noteId || '').trim();
      if (!nid) throw new Error('缺少 noteId');
      const sid = String(studentId || '').trim();
      if (!sid) throw new Error('缺少 studentId');
      const resp = await authService.getNoteSubmissionDetail(nid, sid);
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

  const loadForDraft = async () => {
    setLoading(true);
    setError('');
    try {
      setSubmittedAt(null);
      setAnnotationMode(false);
      setAnnotationsVisible(true);
      setCanEdit(!isDraftReadOnly);

      const local = (await idbGet(buildLocalKey(effectiveNoteId, viewerId)).catch(() => null)) as any;
      const localSnap = local?.snapshot;
      const chosen = draftSnapshot || localSnap;

      if (looksLikeLegacyTldrawSnapshot(chosen)) {
        docRef.current = emptyDoc();
        setError('此筆記草稿為舊版格式（tldraw），已改用新方案（Fabric）。');
      } else {
        docRef.current = normalizeDoc(chosen);
      }

      setNoteTitle(String(draftTitle || '筆記'));
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
    else if (mode === 'draft') void loadForDraft();
    else void loadForTeacher();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, noteId, draftId, draftSnapshot]);

  useEffect(() => {
    if (!open) return;
    if (mode !== 'draft') return;
    setCanEdit(!isDraftReadOnly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, isDraftReadOnly]);

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
      ensurePaperPages(canvas, pageW, pageH, docRef.current.pages.length);
      fitPaperToContainer(canvas, container, pageW, pageH);
      setZoomPct(Math.round((canvas.getZoom() || 1) * 100));
    };
    window.addEventListener('resize', onResize);
    onResize();

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
        syncCurrentPageFromViewport();
        return;
      }
      // Pan (scroll up/down or trackpad)
      canvas.relativePan(new fabric.Point(-e.deltaX, -e.deltaY));
      canvas.requestRenderAll();
      syncCurrentPageFromViewport();
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
      syncCurrentPageFromViewport();
    };
    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);

    const allowEdit = () => {
      const st = latestStateRef.current;
      if (!st.canEdit) return false;
      if (st.mode === 'student' && st.submittedAt) return false;
      if (st.mode === 'teacher' && !st.annotationMode) return false;
      if ((st.mode === 'template' || st.mode === 'draft') && !st.canTemplateEdit) return false;
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
      if ((obj as any).lpediaPaper) return;
      if (suppressSaveRef.current) return;
      if (!allowEdit()) {
        canvas.remove(obj);
        return;
      }
      const { h: pageH } = pageSizeRef.current;
      (obj as any).lpediaPageIndex = getPageIndexFromY(Number((obj as any).top) || 0, pageH, docRef.current.pages.length);
      markNewObjectLayer(obj);
      applyPermissionsToObjects(canvas);
      setLayersVersion((v) => v + 1);
      void scheduleAutoSave();
    };
    const onModified = (e: any) => {
      if (suppressSaveRef.current) return;
      if (!allowEdit()) return;
      const obj = e?.target as fabric.Object | undefined;
      if (obj && !(obj as any).lpediaPaper) {
        const { h: pageH } = pageSizeRef.current;
        (obj as any).lpediaPageIndex = getPageIndexFromY(Number((obj as any).top) || 0, pageH, docRef.current.pages.length);
      }
      setLayersVersion((v) => v + 1);
      void scheduleAutoSave();
    };

    canvas.on('object:added', onAdded);
    canvas.on('object:modified', onModified);
    canvas.on('object:removed', onModified);
    canvas.on('text:changed', onModified as any);

    const bumpSelection = () => {
      setSelectionVersion((v) => v + 1);
      const active = canvas.getActiveObject() as any;
      if (active && !active.lpediaPaper) {
        const { h: pageH } = pageSizeRef.current;
        const idx = getPageIndexFromY(Number(active.top) || 0, pageH, docRef.current.pages.length);
        docRef.current.currentPage = idx;
        setPageIndex(idx);
      } else {
        syncCurrentPageFromViewport();
      }
    };
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

    void reloadCanvas({ fit: true }).then(() => {
      goToPage(docRef.current.currentPage);
    });

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
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (templateSaveTimerRef.current) window.clearTimeout(templateSaveTimerRef.current);
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
    ensurePaperPages(canvas, pageW, pageH, docRef.current.pages.length);
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
      !((mode === 'template' || mode === 'draft') && !canTemplateEdit);

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
    void reloadCanvas({ fit: true })
      .then(() => {
        goToPage(docRef.current.currentPage);
      })
      .finally(() => {
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
    !((mode === 'template' || mode === 'draft') && !canTemplateEdit);

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
        : mode === 'draft'
          ? draftId
            ? navigator.onLine
              ? '草稿（自動保存中）'
              : '草稿（離線：只保存到本機）'
            : '草稿（未儲存）'
          : navigator.onLine
            ? '模板編輯（自動保存中）'
            : '模板編輯（離線：只保存到本機）';

  const showLegacyConvert = mode === 'template' && error.includes('舊版格式');

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 z-[80] flex items-center justify-center ${fullscreen ? 'p-0' : 'p-4'}`}>
      <div className={`bg-white border-4 border-brand-brown w-full overflow-hidden shadow-comic flex flex-col ${fullscreen ? 'max-w-none h-full rounded-none' : 'max-w-6xl h-[90vh] rounded-3xl'}`}>
        <div className="p-4 border-b-4 border-brand-brown bg-[#C0E2BE] flex items-center justify-between gap-3">
          <div className="min-w-0">
            {mode === 'draft' ? (
              <div className="space-y-2">
                <input
                  className="w-full max-w-[360px] px-3 py-2 rounded-2xl border-2 border-brand-brown bg-white font-black text-brand-brown"
                  value={String(draftTitle ?? noteTitle)}
                  onChange={(e) => onDraftTitleChange?.(e.target.value)}
                  placeholder="輸入標題..."
                  disabled={isDraftReadOnly}
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    className="px-3 py-2 rounded-2xl border-2 border-brand-brown bg-white font-black text-brand-brown"
                    value={String(draftSubject || VISIBLE_SUBJECTS[0] || '科學')}
                    onChange={(e) => onDraftSubjectChange?.(e.target.value)}
                    disabled={isDraftReadOnly}
                  >
                    {VISIBLE_SUBJECTS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <div className="text-xs font-bold text-brand-brown/80">{statusText}</div>
                </div>
              </div>
            ) : (
              <>
                <div className="text-xl font-black text-brand-brown truncate">{noteTitle}</div>
                <div className="text-xs font-bold text-brand-brown/80">{statusText}</div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {mode !== 'teacher' && (
              <button
                type="button"
                onClick={() => {
                  saveCanvasToDoc();
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
                onClick={() => goToPage(pageIndex - 1)}
                title="上一頁"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="text-sm">{pageIndex + 1}/{pageCount}頁</div>
              <button
                type="button"
                className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-40"
                disabled={pageIndex >= pageCount - 1 || loading}
                onClick={() => goToPage(pageIndex + 1)}
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
                      const offsetY = getPageOffsetY(docRef.current.currentPage ?? 0, pageH);
                      insertMindmap(canvas, resp, pageW, pageH, offsetY);
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

            {(mode === 'template' || mode === 'draft') && (
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
                  const nid = String(noteId || '').trim();
                  if (!nid) return;
                  setLoading(true);
                  setError('');
                  try {
                    saveCanvasToDoc();
                    await authService.updateNoteTemplate(nid, docRef.current);
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
                  const nid = String(noteId || '').trim();
                  if (!nid) return;
                  setLoading(true);
                  setError('');
                  try {
                    saveCanvasToDoc();
                    await authService.updateNoteTemplate(nid, docRef.current);
                    await authService.publishNote(nid);
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
                    const nid = String(noteId || '').trim();
                    if (!nid) return;
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
	                    saveCanvasAnnotationsToRef();
	                    await authService.saveNoteAnnotations(nid, sid, annotationDocRef.current);
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
                  const nid = String(noteId || '').trim();
                  if (!nid) return;
                  setLoading(true);
                  setError('');
                  try {
                    saveCanvasToDoc();
                    await authService.saveMyNoteDraft(nid, docRef.current);
                    const resp = await authService.submitMyNote(nid);
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

            {mode === 'draft' && (
              <>
                <button
                  type="button"
                  onClick={() => (onDraftCancel ? onDraftCancel() : onClose())}
                  className="px-3 py-2 rounded-2xl border-4 border-gray-400 bg-white text-gray-700 font-black shadow-comic hover:bg-gray-50 flex items-center gap-2"
                  disabled={loading}
                >
                  <Trash2 className="w-4 h-4" />
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => onDraftSave?.()}
                  className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 flex items-center gap-2 disabled:opacity-60"
                  disabled={loading || isDraftReadOnly}
                >
                  <Save className="w-4 h-4" />
                  儲存
                </button>
                <button
                  type="button"
                  onClick={() => onDraftSaveAndPublish?.()}
                  className="px-3 py-2 rounded-2xl border-4 border-blue-700 bg-blue-600 text-white font-black shadow-comic hover:bg-blue-700 flex items-center gap-2"
                  disabled={loading}
                >
                  <Send className="w-4 h-4" />
                  儲存及派發
                </button>
              </>
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
});

export default NoteEditorModal;
