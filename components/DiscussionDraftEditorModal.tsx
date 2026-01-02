import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { VISIBLE_SUBJECTS } from '../platform';
import TeacherFolderPickerModal from './TeacherFolderPickerModal';
import DraftPublishModal from './DraftPublishModal';

type Props = {
  open: boolean;
  onClose: () => void;
  authService: any;
  viewerId: string;
  availableClasses: string[];
  draftId: string;
  availableGrades: string[];
  onDeleted?: () => void;
  onPublished?: () => void;
};

const parseGradeFromClassName = (className?: string) => {
  const match = String(className || '').match(/^(\d+)/);
  return match ? match[1] : '';
};

const sanitizeHtml = (html: string) => {
  const div = document.createElement('div');
  div.innerHTML = String(html || '');
  div.querySelectorAll('script, style').forEach((el) => el.remove());
  div.querySelectorAll('*').forEach((el) => {
    const attrs = Array.from(el.attributes);
    for (const a of attrs) {
      const name = a.name.toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(a.name);
      if (name === 'style') el.removeAttribute(a.name);
    }
  });
  return div.innerHTML;
};

const DiscussionDraftEditorModal: React.FC<Props> = ({ open, onClose, authService, viewerId, availableClasses, draftId, availableGrades, onDeleted, onPublished }) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<any | null>(null);

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(VISIBLE_SUBJECTS[0] || '科學');
  const [grade, setGrade] = useState('');
  const [scope, setScope] = useState<'my' | 'shared'>('my');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [contentHtml, setContentHtml] = useState('');

  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [folderPickerIntent, setFolderPickerIntent] = useState<'save' | 'publish'>('save');
  const [publishOpen, setPublishOpen] = useState(false);

  const isOwner = useMemo(() => String(draft?.ownerTeacherId || '') === String(viewerId || ''), [draft, viewerId]);
  const isShared = useMemo(() => String(draft?.scope || 'my') === 'shared', [draft]);
  const readOnly = useMemo(() => isShared && !isOwner, [isShared, isOwner]);

  const gradeOptions = useMemo(() => {
    if (availableGrades.length > 0) return availableGrades;
    const grades = Array.from(new Set(availableClasses.map((c) => parseGradeFromClassName(c)).filter(Boolean)));
    grades.sort((a, b) => Number(a) - Number(b));
    return grades;
  }, [availableGrades, availableClasses]);

  const loadDraft = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await authService.getDraft(draftId);
      const d = resp?.draft;
      if (!d) throw new Error('找不到草稿');
      setDraft(d);
      setTitle(String(d.title || ''));
      setSubject(String(d.subject || VISIBLE_SUBJECTS[0] || '科學'));
      setGrade(String(d.grade || gradeOptions[0] || ''));
      setScope(String(d.scope || 'my') === 'shared' ? 'shared' : 'my');
      setFolderId(d.folderId ? String(d.folderId) : null);
      const blocks = d.contentSnapshot?.content;
      const html = Array.isArray(blocks) && blocks[0] && blocks[0].type === 'html' ? String(blocks[0].value || '') : '';
      setContentHtml(html);
      if (editorRef.current) editorRef.current.innerHTML = html;
    } catch (e: any) {
      setError(e?.message || '載入失敗');
      setDraft(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draftId]);

  const buildContentSnapshot = () => {
    const safe = sanitizeHtml(contentHtml);
    return { content: [{ type: 'html', value: safe }] };
  };

  const saveContentOnly = async () => {
    if (!draftId) return;
    await authService.updateDraftContent(draftId, buildContentSnapshot());
  };

  const saveMetaAndContent = async (picked?: { scope: 'my' | 'shared'; grade: string; folderId: string | null }) => {
    const nextScope = picked?.scope ?? scope;
    const nextGrade = picked?.grade ?? grade;
    const nextFolderId = picked?.folderId ?? folderId;
    await authService.updateDraftMeta(draftId, { title: title.trim(), subject, grade: nextGrade, scope: nextScope, folderId: nextFolderId });
    await authService.updateDraftContent(draftId, buildContentSnapshot());
    setScope(nextScope);
    setGrade(nextGrade);
    setFolderId(nextFolderId);
    await loadDraft();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[80] flex items-center justify-center p-4">
      <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-comic flex flex-col">
        <div className="p-6 border-b-4 border-brand-brown bg-[#C0E2BE] flex items-center justify-between">
          <div>
            <div className="text-2xl font-black text-brand-brown">討論草稿</div>
            <div className="text-sm text-brand-brown/80 font-bold">
              {readOnly ? '共用草稿（唯讀，可直接派發）' : '編輯中（草稿只在教師資料夾）'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
          >
            <X className="w-6 h-6 text-brand-brown" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {error && <div className="text-red-700 font-bold">{error}</div>}
          {loading ? (
            <div className="text-brand-brown font-bold">載入中...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-black text-brand-brown mb-2">標題</div>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={readOnly}
                    className="w-full px-4 py-3 border-2 border-brand-brown rounded-2xl font-bold"
                    placeholder="輸入標題..."
                  />
                </div>
                <div>
                  <div className="text-sm font-black text-brand-brown mb-2">科目</div>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={readOnly}
                    className="w-full px-4 py-3 border-2 border-brand-brown rounded-2xl font-bold"
                  >
                    {VISIBLE_SUBJECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="text-sm font-black text-brand-brown mb-2">內容</div>
                <div
                  ref={editorRef}
                  className={`w-full min-h-[220px] border-2 border-brand-brown rounded-2xl bg-white p-4 font-bold text-gray-800 overflow-y-auto ${readOnly ? 'opacity-80' : ''}`}
                  contentEditable={!readOnly}
                  onInput={(e) => {
                    const target = e.target as HTMLDivElement;
                    setContentHtml(target.innerHTML);
                  }}
                  onBlur={() => {
                    if (readOnly) return;
                    void saveContentOnly().catch(() => {});
                  }}
                  suppressContentEditableWarning
                />
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t-4 border-brand-brown bg-[#FEF7EC] flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs font-bold text-gray-600">
            位置：{grade ? `${grade}年級` : '—'} / {scope === 'shared' ? '共用' : '私人'} / {folderId ? `folder:${folderId}` : '未分類'}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                if (!draftId) return;
                if (!isOwner) return onClose();
                if (!window.confirm('取消＝刪除草稿。確定要刪除嗎？')) return;
                try {
                  await authService.deleteDraft(draftId);
                  alert('草稿已刪除');
                  onDeleted?.();
                  onClose();
                } catch (e: any) {
                  alert(e?.message || '刪除失敗');
                }
              }}
              className="px-4 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50"
              disabled={loading}
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                setFolderPickerIntent('save');
                setFolderPickerOpen(true);
              }}
              className="px-4 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 disabled:opacity-60"
              disabled={loading || readOnly}
            >
              儲存
            </button>
            <button
              type="button"
              onClick={() => {
                if (readOnly) {
                  setPublishOpen(true);
                } else {
                  setFolderPickerIntent('publish');
                  setFolderPickerOpen(true);
                }
              }}
              className="px-4 py-2 rounded-2xl border-4 border-blue-700 bg-blue-600 text-white font-black shadow-comic hover:bg-blue-700 disabled:opacity-60"
              disabled={loading}
            >
              儲存及派發
            </button>
          </div>
        </div>
      </div>

      <TeacherFolderPickerModal
        open={folderPickerOpen}
        onClose={() => setFolderPickerOpen(false)}
        authService={authService}
        availableGrades={gradeOptions}
        initial={{ scope, grade, folderId }}
        allowShared={true}
        readOnly={readOnly}
        onPicked={async (picked) => {
          setFolderPickerOpen(false);
          try {
            await saveMetaAndContent(picked);
            if (folderPickerIntent === 'publish') setPublishOpen(true);
          } catch (e: any) {
            alert(e?.message || '儲存失敗');
          }
        }}
      />

      <DraftPublishModal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        authService={authService}
        availableClasses={availableClasses}
        draftTitle={title || (draft?.title || '')}
        draftId={draftId}
        keepDraftDefault={true}
        keepDraftLocked={readOnly}
        onPublished={() => {
          onPublished?.();
        }}
      />
    </div>
  );
};

export default DiscussionDraftEditorModal;
