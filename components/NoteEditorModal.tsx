import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bold,
  FileDown,
  Image as ImageIcon,
  Lock,
  Maximize2,
  Minimize2,
  MousePointer2,
  Pencil,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  Type,
  X
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

const A4_W = 595;
const A4_H = 842;
const LOCAL_KEY_PREFIX = 'lpedia_note_draft_v2_fabric';
const buildLocalKey = (noteId: string, userId: string) => `${LOCAL_KEY_PREFIX}:${noteId}:${userId}`;

type FabricDocSnapshot = {
  format: 'fabric-v1';
  version: 1;
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
  currentPage: 0,
  pages: [emptyPage()]
});

const normalizeDoc = (snap: any): FabricDocSnapshot => {
  if (isFabricDocSnapshot(snap)) {
    const pages = snap.pages.length > 0 ? snap.pages : [emptyPage()];
    const currentPage = Math.min(Math.max(0, snap.currentPage ?? 0), pages.length - 1);
    return { format: 'fabric-v1', version: 1, currentPage, pages };
  }
  return emptyDoc();
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

const fitPaperToContainer = (canvas: fabric.Canvas, container: HTMLDivElement) => {
  const w = Math.max(1, container.clientWidth);
  const h = Math.max(1, container.clientHeight);
  canvas.setWidth(w);
  canvas.setHeight(h);
  const padding = 48;
  const scale = Math.min((w - padding * 2) / A4_W, (h - padding * 2) / A4_H);
  const s = Number.isFinite(scale) && scale > 0 ? Math.min(scale, 2) : 1;
  const tx = (w - A4_W * s) / 2;
  const ty = (h - A4_H * s) / 2;
  canvas.setViewportTransform([s, 0, 0, s, tx, ty]);
  canvas.requestRenderAll();
};

const exportPdfFromDoc = async (doc: FabricDocSnapshot) => {
  const pdf = await PDFDocument.create();
  for (const pageJson of doc.pages) {
    const sc = new fabric.StaticCanvas(undefined as any, { width: A4_W, height: A4_H });
    sc.backgroundColor = '#ffffff';
    await new Promise<void>((resolve) => {
      sc.loadFromJSON(pageJson, () => {
        sc.renderAll();
        resolve();
      });
    });
    const dataUrl = sc.toDataURL({ format: 'png', multiplier: 2 });
    const bytes = Uint8Array.from(atob(dataUrl.split(',')[1] || ''), (c) => c.charCodeAt(0));
    const png = await pdf.embedPng(bytes);
    const page = pdf.addPage([A4_W, A4_H]);
    page.drawImage(png, { x: 0, y: 0, width: A4_W, height: A4_H });
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

const insertMindmap = (canvas: fabric.Canvas, mindmap: { nodes: Array<{ id: string; label: string }>; edges: Array<{ from: string; to: string; label?: string }> }) => {
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

  const canTemplateEdit = mode === 'template' && canEdit;
  const canAddPage = (mode === 'template' && canEdit) || (mode === 'student' && canEdit && !submittedAt);
  const canSubmit = mode === 'student' && canEdit && !submittedAt;
  const canAnnotate = mode === 'teacher' && (viewerRole === 'teacher' || viewerRole === 'admin');

  const applyPermissionsToObjects = (canvas: fabric.Canvas) => {
    const objs = canvas.getObjects();
    for (const o of objs) {
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
    const json = canvas.toJSON(['lpediaLocked', 'lpediaLayer', 'crossOrigin']);
    docRef.current.pages[docRef.current.currentPage] = json;
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
    const json = canvas.toJSON(['lpediaLocked', 'lpediaLayer', 'crossOrigin']);
    const objects = Array.isArray((json as any).objects) ? (json as any).objects : [];
    const only = objects.filter((o: any) => String(o.lpediaLayer || '') === 'annotation');
    ann.pages[ann.currentPage] = { ...json, objects: only, background: '#ffffff' };
  };

  const loadPage = async (idx: number) => {
    const canvas = fabricRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const next = Math.min(Math.max(0, idx), docRef.current.pages.length - 1);
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
      canvas.backgroundColor = '#E5E7EB';
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

      await new Promise<void>((resolve) => {
        canvas.loadFromJSON(pageJson, () => {
          canvas.renderAll();
          resolve();
        });
      });
      applyPermissionsToObjects(canvas);
      fitPaperToContainer(canvas, container);
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    } finally {
      suppressSaveRef.current = false;
    }
  };

  const resetToBlank = async () => {
    if (!window.confirm('這會清空現有內容並轉為新筆記格式（Fabric）。確定？')) return;
    docRef.current = emptyDoc();
    annotationDocRef.current = null;
    setPageIndex(0);
    setPageCount(1);
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
    void scheduleStudentSave();
  };

  const bringToFront = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    canvas.bringToFront(obj);
    canvas.requestRenderAll();
    void scheduleStudentSave();
  };

  const sendToBack = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    canvas.sendToBack(obj);
    canvas.requestRenderAll();
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
      let src = '';
      if (navigator.onLine) {
        const resp = await authService.uploadNoteAsset(noteId, compressed);
        src = String(resp?.asset?.url || '');
      }
      if (!src) src = await toDataUrl(compressed);

      const crossOrigin = src.startsWith('http') ? 'anonymous' : undefined;
      // Fabric v6: Image.fromURL returns a Promise (callback form is no longer reliable)
      const img: any = await (fabric.Image as any).fromURL(src, { crossOrigin });
      if (!img) throw new Error('載入圖片失敗');
      img.set({
        left: 80,
        top: 120,
        selectable: true
      });
      (img as any).crossOrigin = crossOrigin;
      if (mode === 'teacher') (img as any).lpediaLayer = 'annotation';
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();

      await scheduleStudentSave();
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
      const chosen = localSnap || serverSnap;

      if (looksLikeLegacyTldrawSnapshot(chosen)) {
        docRef.current = emptyDoc();
        setError('此筆記為舊版格式（tldraw），已改用新方案（Fabric）。請重新建立筆記任務。');
      } else {
        docRef.current = normalizeDoc(chosen);
      }

      setSubmittedAt(server?.submission?.submittedAt || null);
      setNoteTitle(String(server?.note?.title || '筆記'));
      setCanEdit(!server?.submission?.submittedAt);
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
        currentPage: docRef.current.currentPage,
        pages: docRef.current.pages.map((_, idx) => annDoc.pages[idx] || emptyPage())
      };
      annotationDocRef.current = aligned;
      setNoteTitle('學生筆記');
      setSubmittedAt(submission?.submittedAt || null);
      setCanEdit(true);
      setAnnotationMode(false);
      setAnnotationsVisible(true);
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
    annotationDocRef.current = null;
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
    canvas.backgroundColor = '#E5E7EB';

    const drawPaper = () => {
      const ctx = canvas.getContext();
      if (!ctx) return;
      const v = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
      const s = v[0] || 1;
      ctx.save();
      ctx.setTransform(v[0], v[1], v[2], v[3], v[4], v[5]);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, A4_W, A4_H);
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 2 / s;
      ctx.strokeRect(0, 0, A4_W, A4_H);
      ctx.restore();
    };
    canvas.on('before:render', drawPaper);

    const onResize = () => fitPaperToContainer(canvas, container);
    window.addEventListener('resize', onResize);
    onResize();

    const allowEdit = () => {
      if (!canEdit) return false;
      if (mode === 'student' && submittedAt) return false;
      if (mode === 'teacher' && !annotationMode) return false;
      if (mode === 'template' && !canTemplateEdit) return false;
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
      brush.width = mode === 'teacher' ? 3 : 2;
      brush.color = mode === 'teacher' ? '#ef4444' : '#111827';
      canvas.freeDrawingBrush = brush;
    };

    setDrawingMode();

    const markNewObjectLayer = (obj: fabric.Object) => {
      if (mode === 'teacher') {
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
	      void scheduleStudentSave();
	    };
	    const onModified = () => {
	      if (suppressSaveRef.current) return;
	      if (!allowEdit()) return;
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
      if (evt.key === 'Delete' || evt.key === 'Backspace') {
        const active = canvas.getActiveObject() as any;
        if (active && (active as any).isEditing) return;
        evt.preventDefault();
        deleteSelection();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    void loadPage(docRef.current.currentPage);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      canvas.off('before:render', drawPaper);
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
    fitPaperToContainer(canvas, container);
    applyPermissionsToObjects(canvas);
    const allowEdit =
      canEdit &&
      !(mode === 'student' && !!submittedAt) &&
      !(mode === 'teacher' && !annotationMode) &&
      !(mode === 'template' && !canTemplateEdit);

    if (allowEdit && tool === 'pen') {
      canvas.isDrawingMode = true;
      const brush = new fabric.PencilBrush(canvas);
      brush.width = mode === 'teacher' ? 3 : 2;
      brush.color = mode === 'teacher' ? '#ef4444' : '#111827';
      canvas.freeDrawingBrush = brush;
    } else {
      canvas.isDrawingMode = false;
    }
    canvas.requestRenderAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen, annotationMode, annotationsVisible, tool, canEdit, submittedAt]);

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

  if (!open) return null;

  const statusText =
    mode === 'student'
      ? submittedAt
        ? `已交回（${submittedAt}）`
        : navigator.onLine
          ? '自動保存中'
          : '離線模式（只保存到本機）'
      : mode === 'teacher'
        ? '查看 / 批註'
        : '模板編輯';

  const showLegacyConvert = mode === 'template' && error.includes('舊版格式');

  const activeTextTools = useMemo(() => {
    const canvas = fabricRef.current;
    if (!canvas) return { hasText: false, bold: false };
    const obj: any = canvas.getActiveObject();
    if (!obj) return { hasText: false, bold: false };
    const isText = obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text';
    if (!isText) return { hasText: false, bold: false };
    const fw = String(obj.fontWeight || 'normal');
    return { hasText: true, bold: fw === 'bold' || fw === '700' };
  }, [activeTextColor, pageIndex, tool, annotationMode, selectionVersion]);

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
            </div>

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
                      insertMindmap(canvas, resp);
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
                  title="顯示/隱藏批註層"
                >
                  {annotationsVisible ? '隱藏批註' : '顯示批註'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!canAnnotate) return;
                    setAnnotationMode((v) => !v);
                  }}
                  className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 flex items-center gap-2"
                  disabled={loading || !canAnnotate}
                  title="批註模式（只會保存批註層，不會改動學生內容）"
                >
                  <Lock className="w-4 h-4" />
                  {annotationMode ? '退出批註' : '批註模式'}
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
	                    alert('已保存批註');
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
                  保存批註
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
