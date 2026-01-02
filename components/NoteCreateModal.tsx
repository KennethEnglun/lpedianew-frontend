import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { VISIBLE_SUBJECTS } from '../platform';

type Props = {
  open: boolean;
  onClose: () => void;
  authService: any;
  onCreated: (noteId: string) => void;
};

const NoteCreateModal: React.FC<Props> = ({ open, onClose, authService, onCreated }) => {
  const [title, setTitle] = useState('筆記');
  const [subject, setSubject] = useState<string>(VISIBLE_SUBJECTS[0] || '科學');
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [className, setClassName] = useState('');
  const [folders, setFolders] = useState<any[]>([]);
  const [stageId, setStageId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [subId, setSubId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const stageFolders = useMemo(() => folders.filter((f) => f && f.level === 1), [folders]);
  const topicFolders = useMemo(() => folders.filter((f) => f && f.level === 2 && String(f.parentId || '') === String(stageId || '')), [folders, stageId]);
  const subFolders = useMemo(() => folders.filter((f) => f && f.level === 3 && String(f.parentId || '') === String(topicId || '')), [folders, topicId]);

  const loadFolders = async (cls: string) => {
    const c = String(cls || '').trim();
    if (!c) return;
    setError('');
    try {
      const resp = await authService.getClassFolders(c);
      const list = Array.isArray(resp.folders) ? resp.folders : [];
      setFolders(list);
      const stage = list.find((f: any) => f && f.level === 1) || null;
      const nextStageId = stage ? String(stage.id) : '';
      setStageId(nextStageId);
      const topics = list.filter((f: any) => f && f.level === 2 && String(f.parentId || '') === nextStageId);
      const firstTopic = topics[0] ? String(topics[0].id) : '';
      setTopicId(firstTopic);
      setSubId('');
    } catch (e: any) {
      setError(e?.message || '載入班級資料夾失敗');
      setFolders([]);
      setStageId('');
      setTopicId('');
      setSubId('');
    }
  };

  const loadClasses = async (s: string) => {
    setLoading(true);
    setError('');
    try {
      const resp = await authService.getAvailableClasses(s);
      const list = Array.isArray(resp.classes) ? resp.classes : [];
      setAvailableClasses(list);
      const first = list[0] || '';
      setClassName(first);
      if (first) await loadFolders(first);
    } catch (e: any) {
      setError(e?.message || '載入班級列表失敗');
      setAvailableClasses([]);
      setClassName('');
      setFolders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setTitle('筆記');
    const s = VISIBLE_SUBJECTS[0] || '科學';
    setSubject(s);
    void loadClasses(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!stageId) return;
    const firstTopic = topicFolders[0] ? String(topicFolders[0].id) : '';
    setTopicId(firstTopic);
    setSubId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageId]);

  useEffect(() => {
    if (!open) return;
    setSubId('');
  }, [topicId, open]);

  if (!open) return null;

  const resolvedFolderId = subId || topicId;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[75] flex items-center justify-center p-4">
      <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-comic">
        <div className="p-6 border-b-4 border-brand-brown bg-[#C0E2BE] flex items-center justify-between">
          <div>
            <div className="text-2xl font-black text-brand-brown">新增筆記任務</div>
            <div className="text-sm text-brand-brown/80 font-bold">建立草稿 → 編輯模板 → 派發（每生一份）</div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
          >
            <X className="w-6 h-6 text-brand-brown" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center gap-2">
              <div className="w-20 font-black text-gray-700">標題</div>
              <input
                className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-300 font-bold"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：第一學段筆記"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="w-20 font-black text-gray-700">科目</div>
              <select
                className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-300 font-bold"
                value={subject}
                onChange={(e) => {
                  const s = e.target.value;
                  setSubject(s);
                  void loadClasses(s);
                }}
                disabled={loading}
              >
                {VISIBLE_SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-20 font-black text-gray-700">班別</div>
              <select
                className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-300 font-bold"
                value={className}
                onChange={(e) => {
                  const c = e.target.value;
                  setClassName(c);
                  void loadFolders(c);
                }}
                disabled={loading || availableClasses.length === 0}
              >
                {availableClasses.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-20 font-black text-gray-700">學段</div>
              <select
                className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-300 font-bold"
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                disabled={stageFolders.length === 0}
              >
                {stageFolders.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-20 font-black text-gray-700">課題</div>
              <select
                className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-300 font-bold"
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
                disabled={!stageId || topicFolders.length === 0}
              >
                <option value="" disabled>
                  {topicFolders.length === 0 ? '（此學段未有課題）' : '請選擇課題'}
                </option>
                {topicFolders.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-20 font-black text-gray-700">子folder</div>
              <select
                className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-300 font-bold"
                value={subId}
                onChange={(e) => setSubId(e.target.value)}
                disabled={!topicId}
              >
                <option value="">（不選，直接放在課題底下）</option>
                {subFolders.map((sf) => (
                  <option key={sf.id} value={sf.id}>{sf.name}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <div className="text-red-600 font-bold">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white border-2 border-gray-300 font-black text-gray-700 hover:border-blue-500"
              disabled={loading}
            >
              取消
            </button>
            <button
              onClick={async () => {
                if (!title.trim()) return setError('請輸入標題');
                if (!subject) return setError('請選擇科目');
                if (!className) return setError('請選擇班別');
                if (!topicId) return setError('請選擇課題');
                if (!resolvedFolderId) return setError('請選擇課題或子folder');
                setLoading(true);
                setError('');
                try {
                  const resp = await authService.createDraftNote({
                    title: title.trim(),
                    subject,
                    className,
                    classFolderId: resolvedFolderId,
                    targetClasses: [className]
                  });
                  const id = String(resp?.note?.id || '');
                  if (!id) throw new Error('建立失敗（缺少 noteId）');
                  onCreated(id);
                  onClose();
                } catch (e: any) {
                  setError(e?.message || '建立失敗');
                } finally {
                  setLoading(false);
                }
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white font-black border-2 border-blue-700 hover:bg-blue-700 disabled:opacity-60"
              disabled={loading}
            >
              下一步：編輯模板
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoteCreateModal;

