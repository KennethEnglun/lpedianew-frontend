import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileDown, Lock, Plus, Sparkles, Save, Send, X } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import {
  Box,
  Editor,
  Tldraw,
  createShapeId,
  createTLStore,
  defaultBindingUtils,
  defaultShapeUtils,
  getSnapshot,
  loadSnapshot
} from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
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
const LOCAL_KEY_PREFIX = 'lpedia_note_draft_v1';

const buildLocalKey = (noteId: string, userId: string) => `${LOCAL_KEY_PREFIX}:${noteId}:${userId}`;

const findA4FrameIdOnCurrentPage = (editor: Editor): string | null => {
  const ids = Array.from(editor.getCurrentPageShapeIds());
  for (const id of ids) {
    const shape: any = editor.getShape(id as any);
    if (!shape) continue;
    if (shape?.meta?.lpediaA4Frame === true) return String(shape.id);
  }
  return null;
};

const ensureAtLeastOnePage = (editor: Editor) => {
  const pages = editor.getPages();
  if (pages.length > 0) return;
  editor.createPage({ name: '第1頁' } as any);
};

const ensureA4FrameOnCurrentPage = (editor: Editor) => {
  const existing = findA4FrameIdOnCurrentPage(editor);
  if (existing) return existing;
  const id = createShapeId();
  editor.createShape({
    id,
    type: 'frame',
    x: -A4_W / 2,
    y: -A4_H / 2,
    props: { w: A4_W, h: A4_H, name: '', color: 'black' },
    isLocked: true,
    meta: { lpediaA4Frame: true }
  } as any);
  return String(id);
};

const ensureA4FramesForAllPages = (editor: Editor) => {
  ensureAtLeastOnePage(editor);
  const current = editor.getCurrentPageId();
  for (const p of editor.getPages()) {
    editor.setCurrentPage(p.id);
    ensureA4FrameOnCurrentPage(editor);
  }
  editor.setCurrentPage(current);
};

const makeRichText = (text: string) => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text }]
    }
  ]
});

const insertMindmap = (editor: Editor, mindmap: { nodes: Array<{ id: string; label: string }>; edges: Array<{ from: string; to: string; label?: string }> }) => {
  const nodes = Array.isArray(mindmap?.nodes) ? mindmap.nodes : [];
  const edges = Array.isArray(mindmap?.edges) ? mindmap.edges : [];
  if (nodes.length === 0) return;

  const margin = 36;
  const nodeW = 180;
  const nodeH = 76;
  const maxCols = nodes.length <= 10 ? 2 : 3;
  const cols = Math.min(maxCols, Math.max(1, Math.ceil(Math.sqrt(nodes.length))));
  const gapX = 24;
  const gapY = 18;

  const left = -A4_W / 2 + margin;
  const top = -A4_H / 2 + margin;

  const shapeIdByNodeId = new Map<string, string>();
  const centerByNodeId = new Map<string, { x: number; y: number }>();

  const shapes: any[] = [];

  nodes.forEach((n, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = left + col * (nodeW + gapX);
    const y = top + row * (nodeH + gapY);

    const sid = String(createShapeId());
    shapeIdByNodeId.set(String(n.id), sid);
    centerByNodeId.set(String(n.id), { x: x + nodeW / 2, y: y + nodeH / 2 });

    shapes.push({
      id: sid,
      type: 'geo',
      x,
      y,
      props: {
        w: nodeW,
        h: nodeH,
        geo: 'rectangle',
        dash: 'draw',
        growY: 0,
        url: '',
        scale: 1,
        color: 'black',
        labelColor: 'black',
        fill: 'none',
        size: 'm',
        font: 'draw',
        align: 'middle',
        verticalAlign: 'middle',
        richText: makeRichText(String(n.label || '').trim())
      },
      meta: { lpediaAiMindmap: true }
    });
  });

  const arrows: any[] = [];
  for (const e of edges) {
    const from = String(e?.from || '').trim();
    const to = String(e?.to || '').trim();
    if (!from || !to) continue;
    const a = centerByNodeId.get(from);
    const b = centerByNodeId.get(to);
    if (!a || !b) continue;

    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const start = { x: a.x - x, y: a.y - y };
    const end = { x: b.x - x, y: b.y - y };
    const id = String(createShapeId());
    arrows.push({
      id,
      type: 'arrow',
      x,
      y,
      props: {
        color: 'black',
        labelColor: 'black',
        bend: 0,
        start,
        end,
        arrowheadStart: 'none',
        arrowheadEnd: 'arrow',
        richText: makeRichText(String(e?.label || '').trim()),
        labelPosition: 0.5,
        font: 'draw',
        scale: 1
      },
      meta: { lpediaAiMindmap: true }
    });
  }

  editor.createShapes([...shapes, ...arrows] as any);
  editor.selectNone();
};

const exportPdfA4 = async (editor: Editor) => {
  const pdf = await PDFDocument.create();
  const current = editor.getCurrentPageId();

  const pages = editor.getPages();
  for (const p of pages) {
    editor.setCurrentPage(p.id);
    const frameId = ensureA4FrameOnCurrentPage(editor);
    const bounds = editor.getShapePageBounds(frameId as any) || new Box(-A4_W / 2, -A4_H / 2, A4_W, A4_H);
    const shapeIds = Array.from(editor.getCurrentPageShapeIds());
    const { blob } = await editor.toImage(shapeIds as any, {
      format: 'png',
      bounds,
      padding: 0,
      background: true,
      pixelRatio: 2
    } as any);

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const png = await pdf.embedPng(bytes);
    const page = pdf.addPage([A4_W, A4_H]);
    page.drawImage(png, { x: 0, y: 0, width: A4_W, height: A4_H });
  }

  editor.setCurrentPage(current);

  const out = await pdf.save();
  const outBlob = new Blob([out], { type: 'application/pdf' });
  const url = URL.createObjectURL(outBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '筆記.pdf';
  a.click();
  URL.revokeObjectURL(url);
};

const NoteEditorModal: React.FC<Props> = ({ open, onClose, authService, mode, noteId, viewerId, viewerRole, studentId, onPublished }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [noteTitle, setNoteTitle] = useState('筆記');
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(true);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [annotationsVisible, setAnnotationsVisible] = useState(true);
  const [teacherAnnotations, setTeacherAnnotations] = useState<any | null>(null);

  const editorRef = useRef<Editor | null>(null);
  const lockedTemplateIdsRef = useRef<Set<string>>(new Set());
  const baseShapeIdsRef = useRef<Set<string>>(new Set());
  const annotationShapeIdsRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<number | null>(null);

  const store = useMemo(() => {
    const assets = {
      upload: async (_asset: any, file: File) => {
        const compressed = await compressImageToMaxBytes(file);
        const resp = await authService.uploadNoteAsset(noteId, compressed);
        const url = String(resp?.asset?.url || '');
        if (!url) throw new Error('圖片上傳失敗');
        return { src: url };
      },
      resolve: async (asset: any) => {
        const src = asset?.props?.src;
        return typeof src === 'string' ? src : null;
      },
      remove: async () => {}
    };

    return createTLStore({
      shapeUtils: defaultShapeUtils,
      bindingUtils: defaultBindingUtils,
      assets
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  const enforceTemplateLocks = (editor: Editor) => {
    const ids = Array.from(lockedTemplateIdsRef.current);
    if (ids.length === 0) return;
    const patches: any[] = [];
    for (const id of ids) {
      const shape: any = editor.getShape(id as any);
      if (!shape) continue;
      if (shape.isLocked !== true) {
        patches.push({ id, type: shape.type, isLocked: true });
      }
    }
    if (patches.length > 0) editor.updateShapes(patches as any);
  };

  const scheduleStudentSave = (editor: Editor) => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        const snap: any = getSnapshot(editor.store);
        await idbSet(buildLocalKey(noteId, viewerId), { savedAt: new Date().toISOString(), snapshot: snap });

        if (!navigator.onLine) return;
        if (submittedAt) return;
        await authService.saveMyNoteDraft(noteId, snap);
      } catch {
        // keep silent (offline / network)
      }
    }, 1200);
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

      const local = await idbGet(buildLocalKey(noteId, viewerId)).catch(() => null) as any;
      const serverSnap = server?.submission?.snapshot;
      const localSnap = local?.snapshot;
      const chosen = localSnap || serverSnap;
      if (chosen && typeof chosen === 'object') {
        loadSnapshot(store, chosen, { forceOverwriteSessionState: true } as any);
      }
      setSubmittedAt(server?.submission?.submittedAt || null);
      setNoteTitle(String(server?.note?.title || '筆記'));
      setCanEdit(!server?.submission?.submittedAt);
    } finally {
      setLoading(false);
    }
  };

  const clearAnnotationsFromCanvas = (editor: Editor) => {
    const ids = Array.from(annotationShapeIdsRef.current);
    if (ids.length === 0) return;
    editor.deleteShapes(ids as any);
    annotationShapeIdsRef.current = new Set();
  };

  const applyTeacherAnnotationsToCanvas = (editor: Editor, annotations: any) => {
    clearAnnotationsFromCanvas(editor);
    if (!annotationsVisible) return;
    const pages = annotations?.pages && typeof annotations.pages === 'object' ? annotations.pages : {};
    const current = editor.getCurrentPageId();
    for (const [pageId, shapes] of Object.entries(pages)) {
      if (!Array.isArray(shapes) || shapes.length === 0) continue;
      editor.setCurrentPage(String(pageId));
      const created = editor.createShapes(shapes as any) as any;
      // Track ids if API returns them; otherwise just collect from input
      for (const s of shapes) {
        if (s?.id) annotationShapeIdsRef.current.add(String(s.id));
      }
      void created;
    }
    editor.setCurrentPage(current);
  };

  const collectTeacherAnnotations = (editor: Editor) => {
    const pages: Record<string, any[]> = {};
    const baseIds = baseShapeIdsRef.current;
    const current = editor.getCurrentPageId();
    for (const p of editor.getPages()) {
      editor.setCurrentPage(p.id);
      const list: any[] = [];
      for (const sid of Array.from(editor.getCurrentPageShapeIds())) {
        const id = String(sid);
        if (baseIds.has(id)) continue;
        const shape: any = editor.getShape(sid as any);
        if (!shape) continue;
        // do not persist the A4 frame
        if (shape?.meta?.lpediaA4Frame === true) continue;
        list.push(shape);
      }
      if (list.length > 0) pages[String(p.id)] = list;
    }
    editor.setCurrentPage(current);
    return { version: 1, pages };
  };

  const lockBaseShapes = (editor: Editor) => {
    const patches: any[] = [];
    for (const id of Array.from(baseShapeIdsRef.current)) {
      const shape: any = editor.getShape(id as any);
      if (!shape) continue;
      if (shape.isLocked === true) continue;
      patches.push({ id, type: shape.type, isLocked: true });
    }
    if (patches.length > 0) editor.updateShapes(patches as any);
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
      if (snap && typeof snap === 'object') {
        loadSnapshot(store, snap, { forceOverwriteSessionState: true } as any);
      }
      setTeacherAnnotations(submission?.annotations || null);
      setNoteTitle('學生筆記');
      setSubmittedAt(submission?.submittedAt || null);
      setCanEdit(true);
      setAnnotationMode(false);
      setAnnotationsVisible(true);
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
      const resp = await authService.getNoteDetail(noteId);
      const note = resp?.note;
      setNoteTitle(String(note?.title || '筆記模板'));
      setSubmittedAt(null);
      setCanEdit(viewerRole === 'admin' || String(note?.teacherId || '') === String(viewerId || ''));
      const snap = note?.templateSnapshot;
      if (snap && typeof snap === 'object') {
        loadSnapshot(store, snap, { forceOverwriteSessionState: true } as any);
      }
    } catch (e: any) {
      setError(e?.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    editorRef.current = null;
    lockedTemplateIdsRef.current = new Set();
    baseShapeIdsRef.current = new Set();
    annotationShapeIdsRef.current = new Set();
    setSubmittedAt(null);
    setCanEdit(true);
    setAnnotationMode(false);
    setAnnotationsVisible(true);
    setTeacherAnnotations(null);
    setError('');
    if (mode === 'student') void loadForStudent();
    else if (mode === 'template') void loadForTemplate();
    else if (mode === 'teacher') void loadForTeacher();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, noteId, mode]);

  useEffect(() => {
    if (!open) return;
    const editor = editorRef.current;
    if (!editor) return;

    ensureA4FramesForAllPages(editor);
    const frameId = ensureA4FrameOnCurrentPage(editor);
    const bounds = editor.getShapePageBounds(frameId as any);
    if (bounds) editor.zoomToBounds(bounds, { immediate: true, inset: 64 } as any);

    // Record template locked shapes (only for student mode)
    if (mode === 'student') {
      const locked = new Set<string>();
      for (const r of editor.store.allRecords() as any[]) {
        if (r?.typeName === 'shape' && r.isLocked === true) locked.add(String(r.id));
      }
      lockedTemplateIdsRef.current = locked;
    }

    if (mode === 'teacher') {
      const base = new Set<string>();
      for (const r of editor.store.allRecords() as any[]) {
        if (r?.typeName === 'shape') base.add(String(r.id));
      }
      baseShapeIdsRef.current = base;
      if (teacherAnnotations) applyTeacherAnnotationsToCanvas(editor, teacherAnnotations);
      editor.setReadOnly(true);
    }
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    const editor = editorRef.current;
    if (!editor) return;
    if (mode !== 'teacher') return;
    if (!teacherAnnotations) {
      clearAnnotationsFromCanvas(editor);
      return;
    }
    applyTeacherAnnotationsToCanvas(editor, teacherAnnotations);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, teacherAnnotations, annotationsVisible]);

  useEffect(() => {
    if (!open) return;
    const editor = editorRef.current;
    if (!editor) return;
    if (mode !== 'student') return;

    const unsub = editor.store.listen(() => {
      enforceTemplateLocks(editor);
      if (!canEdit) return;
      scheduleStudentSave(editor);
    }, { source: 'user', scope: 'document' });

    return () => {
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, canEdit, submittedAt]);

  if (!open) return null;

  const canTemplateEdit = mode === 'template' && canEdit;
  const canAnnotate = mode === 'teacher' && (viewerRole === 'teacher' || viewerRole === 'admin');
  const canAddPage = (mode === 'template' && canEdit) || (mode === 'student' && canEdit && !submittedAt);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[80] flex items-center justify-center p-4">
      <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-comic flex flex-col">
        <div className="p-4 border-b-4 border-brand-brown bg-[#C0E2BE] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xl font-black text-brand-brown truncate">{noteTitle}</div>
            <div className="text-xs font-bold text-brand-brown/80">
              {mode === 'student' ? (submittedAt ? `已交回（${submittedAt}）` : (navigator.onLine ? '自動保存中' : '離線模式（只保存到本機）')) : '模板編輯'}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {mode === 'student' && canEdit && (
              <button
                type="button"
                onClick={async () => {
                  const editor = editorRef.current;
                  if (!editor) return;
                  const prompt = window.prompt('輸入要生成思維圖的內容（可貼上段落/重點）');
                  if (!prompt || !prompt.trim()) return;
                  setLoading(true);
                  setError('');
                  try {
                    const resp = await authService.generateMindmap({ prompt: prompt.trim() });
                    insertMindmap(editor, resp);
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

            {mode === 'teacher' && (
              <>
	                <button
	                  type="button"
	                  onClick={() => {
	                    const editor = editorRef.current;
	                    if (!editor) return;
	                    setAnnotationsVisible((v) => {
	                      const next = !v;
	                      if (!next) clearAnnotationsFromCanvas(editor);
	                      else if (teacherAnnotations) applyTeacherAnnotationsToCanvas(editor, teacherAnnotations);
	                      return next;
	                    });
	                  }}
	                  className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 flex items-center gap-2"
	                  disabled={loading}
	                  title="顯示/隱藏批註層"
	                >
                  <Lock className="w-4 h-4" />
                  {annotationsVisible ? '隱藏批註' : '顯示批註'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const editor = editorRef.current;
                    if (!editor) return;
                    if (!canAnnotate) return;
                    const next = !annotationMode;
                    setAnnotationMode(next);
                    if (next) {
                      lockBaseShapes(editor);
                      editor.setReadOnly(false);
                    } else {
                      editor.setReadOnly(true);
                    }
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
                    const editor = editorRef.current;
                    if (!editor) return;
                    if (!canAnnotate) return;
                    const sid = String(studentId || '').trim();
                    if (!sid) return;
                    setLoading(true);
                    setError('');
                    try {
                      const annotations = collectTeacherAnnotations(editor);
                      await authService.saveNoteAnnotations(noteId, sid, annotations);
                      setTeacherAnnotations(annotations);
                      alert('已保存批註');
                      setAnnotationMode(false);
                      editor.setReadOnly(true);
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
            <button
              type="button"
              onClick={() => {
                const editor = editorRef.current;
                if (!editor) return;
                void exportPdfA4(editor);
              }}
              className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 flex items-center gap-2"
              disabled={loading}
              title="匯出 PDF"
            >
              <FileDown className="w-4 h-4" />
              匯出PDF
            </button>

	            <button
	              type="button"
	              onClick={() => {
	                const editor = editorRef.current;
	                if (!editor) return;
	                const count = editor.getPages().length;
	                const before = new Set(editor.getPages().map((p) => String(p.id)));
	                editor.createPage({ name: `第${count + 1}頁` } as any);
	                requestAnimationFrame(() => {
	                  const after = editor.getPages();
	                  const nextPage = after.find((p) => !before.has(String(p.id))) || after[after.length - 1];
	                  if (nextPage) editor.setCurrentPage(nextPage.id);
	                  const frameId = ensureA4FrameOnCurrentPage(editor);
	                  const bounds = editor.getShapePageBounds(frameId as any);
	                  if (bounds) editor.zoomToBounds(bounds, { immediate: true, inset: 64 } as any);
	                });
	              }}
	              className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 flex items-center gap-2"
	              disabled={loading || !canAddPage}
	              title="新增一頁"
	            >
              <Plus className="w-4 h-4" />
              加頁
            </button>

            {mode === 'template' && (
              <button
                type="button"
                onClick={() => {
                  const editor = editorRef.current;
                  if (!editor) return;
                  const ids = Array.from(editor.getSelectedShapeIds());
                  if (ids.length === 0) return alert('請先選擇要鎖定的物件');
                  editor.toggleLock(ids as any);
                }}
                className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 flex items-center gap-2"
                disabled={loading || !canTemplateEdit}
                title="鎖定/解鎖選取物件（學生不能更改鎖定物件）"
              >
                <Lock className="w-4 h-4" />
                鎖定
              </button>
            )}

            {mode === 'template' && (
              <button
                type="button"
                onClick={async () => {
                  const editor = editorRef.current;
                  if (!editor) return;
                  setLoading(true);
                  setError('');
                  try {
                    const snap: any = getSnapshot(editor.store);
                    await authService.updateNoteTemplate(noteId, snap);
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
                  const editor = editorRef.current;
                  if (!editor) return;
                  if (!window.confirm('確定要派發？派發後模板會固定，學生各自一份。')) return;
                  setLoading(true);
                  setError('');
                  try {
                    const snap: any = getSnapshot(editor.store);
                    await authService.updateNoteTemplate(noteId, snap);
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

            {mode === 'student' && (
              <button
                type="button"
                onClick={async () => {
                  if (submittedAt) return;
                  const editor = editorRef.current;
                  if (!editor) return;
                  if (!window.confirm('確定要交回？交回後不能再修改。')) return;
                  setLoading(true);
                  setError('');
                  try {
                    const snap: any = getSnapshot(editor.store);
                    await authService.saveMyNoteDraft(noteId, snap);
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

        <div className="flex-1 min-h-0">
          <Tldraw
            store={store as any}
            onMount={(editor) => {
              editorRef.current = editor;
              ensureA4FramesForAllPages(editor);
              const frameId = ensureA4FrameOnCurrentPage(editor);
              const bounds = editor.getShapePageBounds(frameId as any);
              if (bounds) editor.zoomToBounds(bounds, { immediate: true, inset: 64 } as any);
              if (mode === 'student' && submittedAt) editor.setReadOnly(true);
              if (mode === 'teacher') {
                const base = new Set<string>();
                for (const r of editor.store.allRecords() as any[]) {
                  if (r?.typeName === 'shape') base.add(String(r.id));
                }
                baseShapeIdsRef.current = base;
                if (teacherAnnotations) applyTeacherAnnotationsToCanvas(editor, teacherAnnotations);
                editor.setReadOnly(true);
              }
            }}
            maxAssetSize={3 * 1024 * 1024}
            maxImageDimension={2560}
            autoFocus
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
