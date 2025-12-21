import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  authService: any;
  availableClasses: string[];
  templateTitle: string;
  templateId: string;
  onAssigned?: () => void;
};

const parseGradeFromClassName = (className?: string) => {
  const match = String(className || '').match(/^(\d+)/);
  return match ? match[1] : '';
};

const TemplateAssignModal: React.FC<Props> = ({ open, onClose, authService, availableClasses, templateTitle, templateId, onAssigned }) => {
  const [className, setClassName] = useState('');
  const [folders, setFolders] = useState<any[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState('');

  const [stageId, setStageId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [subId, setSubId] = useState('');

  const stageFolders = useMemo(() => folders.filter((f) => f && f.level === 1), [folders]);
  const topicFolders = useMemo(() => folders.filter((f) => f && f.level === 2 && String(f.parentId || '') === String(stageId || '')), [folders, stageId]);
  const subFolders = useMemo(() => folders.filter((f) => f && f.level === 3 && String(f.parentId || '') === String(topicId || '')), [folders, topicId]);

  const loadFolders = async (cls: string) => {
    const c = String(cls || '').trim();
    if (!c) return;
    setLoadingFolders(true);
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
    } finally {
      setLoadingFolders(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const first = availableClasses[0] || '';
    if (first) {
      setClassName(first);
      void loadFolders(first);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!stageId) return;
    const firstTopic = topicFolders[0] ? String(topicFolders[0].id) : '';
    setTopicId(firstTopic);
    setSubId('');
  }, [stageId]);

  useEffect(() => {
    if (!open) return;
    setSubId('');
  }, [topicId]);

  if (!open) return null;

  const resolvedFolderId = subId || topicId;
  const grade = parseGradeFromClassName(className);

  if (availableClasses.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4">
        <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-xl shadow-comic">
          <div className="p-6 border-b-4 border-brand-brown bg-[#C0E2BE] flex items-center justify-between">
            <div className="text-2xl font-black text-brand-brown">派送模板</div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
            >
              <X className="w-6 h-6 text-brand-brown" />
            </button>
          </div>
          <div className="p-6 font-bold text-gray-700">未有班別資料（availableClasses 為空）。請先在作業管理中載入班級列表。</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-comic">
        <div className="p-6 border-b-4 border-brand-brown bg-[#C0E2BE] flex items-center justify-between">
          <div>
            <div className="text-2xl font-black text-brand-brown">派送模板</div>
            <div className="text-sm text-brand-brown/80 font-bold">{templateTitle}</div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
          >
            <X className="w-6 h-6 text-brand-brown" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-sm font-bold text-gray-700">
            流程：班別 → 學段 → 課題 → 子folder(可選)
          </div>

          <div className="grid grid-cols-1 gap-3">
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
              >
                {availableClasses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <div className="text-xs text-gray-500 font-bold w-16 text-right">{grade ? `${grade}年級` : ''}</div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-20 font-black text-gray-700">學段</div>
              <select
                className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-300 font-bold"
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                disabled={loadingFolders || stageFolders.length === 0}
              >
                {stageFolders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-20 font-black text-gray-700">課題</div>
              <select
                className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-300 font-bold"
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
                disabled={loadingFolders || topicFolders.length === 0}
              >
                <option value="" disabled>
                  {loadingFolders ? '載入中…' : topicFolders.length === 0 ? '（此學段未有課題）' : '請選擇課題'}
                </option>
                {topicFolders.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-20 font-black text-gray-700">子folder</div>
              <select
                className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-300 font-bold"
                value={subId}
                onChange={(e) => setSubId(e.target.value)}
                disabled={loadingFolders || !topicId}
              >
                <option value="">
                  （不選，直接放在課題底下）
                </option>
                {subFolders.map((sf) => (
                  <option key={sf.id} value={sf.id}>
                    {sf.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <div className="text-red-600 font-bold">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white border-2 border-gray-300 font-black text-gray-700 hover:border-blue-500"
              disabled={assigning}
            >
              取消
            </button>
            <button
              onClick={async () => {
                if (!className) return setError('請選擇班別');
                if (!stageId) return setError('請選擇學段');
                if (!topicId) return setError('請選擇課題');
                if (!resolvedFolderId) return setError('請選擇課題或子folder');
                setAssigning(true);
                setError('');
                try {
                  await authService.assignTemplateToClass(templateId, { className, classFolderId: resolvedFolderId });
                  alert('派送成功！');
                  onAssigned?.();
                  onClose();
                } catch (e: any) {
                  setError(e?.message || '派送失敗');
                } finally {
                  setAssigning(false);
                }
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white font-black border-2 border-blue-700 hover:bg-blue-700 disabled:opacity-60"
              disabled={assigning || loadingFolders}
            >
              {assigning ? '派送中…' : '派送'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateAssignModal;
