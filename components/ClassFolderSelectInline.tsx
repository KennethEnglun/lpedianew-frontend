import React, { useEffect, useMemo, useState } from 'react';

type Props = {
  authService: any;
  className: string;
  value: string;
  onChange: (folderId: string) => void;
  disabled?: boolean;
  required?: boolean;
};

const ClassFolderSelectInline: React.FC<Props> = ({ authService, className, value, onChange, disabled = false, required = true }) => {
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [stageId, setStageId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [subId, setSubId] = useState('');

  const stageFolders = useMemo(() => folders.filter((f) => f && f.level === 1 && !f.archivedAt), [folders]);
  const topicFolders = useMemo(() => folders.filter((f) => f && f.level === 2 && !f.archivedAt && String(f.parentId || '') === String(stageId || '')), [folders, stageId]);
  const subFolders = useMemo(() => folders.filter((f) => f && f.level === 3 && !f.archivedAt && String(f.parentId || '') === String(topicId || '')), [folders, topicId]);

  useEffect(() => {
    const c = String(className || '').trim();
    if (!c) {
      setFolders([]);
      setStageId('');
      setTopicId('');
      setSubId('');
      setError('');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const resp = await authService.getClassFolders(c);
        const list = Array.isArray(resp.folders) ? resp.folders : [];
        if (cancelled) return;
        setFolders(list);
        const firstStage = list.find((f: any) => f && f.level === 1) || null;
        setStageId(firstStage ? String(firstStage.id) : '');
        setTopicId('');
        setSubId('');
        onChange('');
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || '載入資料夾失敗');
        setFolders([]);
        setStageId('');
        setTopicId('');
        setSubId('');
        onChange('');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [className]);

  useEffect(() => {
    setTopicId('');
    setSubId('');
    onChange('');
  }, [stageId]);

  useEffect(() => {
    setSubId('');
    if (topicId) onChange(String(topicId));
    else onChange('');
  }, [topicId]);

  useEffect(() => {
    if (subId) onChange(String(subId));
    else if (topicId) onChange(String(topicId));
  }, [subId]);

  const resolvedValue = value || (subId || topicId || '');

  return (
    <div className="p-4 bg-gray-50 border-2 border-gray-200 rounded-2xl space-y-3">
      <div className="text-sm font-black text-brand-brown">資料夾（必選）</div>

      {error && <div className="text-sm font-bold text-red-600">{error}</div>}
      {loading && <div className="text-sm font-bold text-gray-600">載入資料夾中…</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-black text-gray-700 mb-1">學段</label>
          <select
            className="w-full px-3 py-2 rounded-xl border-2 border-gray-300 font-bold bg-white"
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
            disabled={disabled || loading || stageFolders.length === 0}
          >
            <option value="" disabled>
              {stageFolders.length === 0 ? '（未有學段）' : '請選擇'}
            </option>
            {stageFolders.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-black text-gray-700 mb-1">課題</label>
          <select
            className="w-full px-3 py-2 rounded-xl border-2 border-gray-300 font-bold bg-white"
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            disabled={disabled || loading || !stageId || topicFolders.length === 0}
          >
            <option value="">
              {topicFolders.length === 0 ? '（此學段未有課題）' : required ? '請選擇課題' : '（不選）'}
            </option>
            {topicFolders.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-black text-gray-700 mb-1">子folder（可選）</label>
          <select
            className="w-full px-3 py-2 rounded-xl border-2 border-gray-300 font-bold bg-white"
            value={subId}
            onChange={(e) => setSubId(e.target.value)}
            disabled={disabled || loading || !topicId}
          >
            <option value="">（不選）</option>
            {subFolders.map((sf: any) => (
              <option key={sf.id} value={sf.id}>
                {sf.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {required && !resolvedValue && (
      <div className="text-xs font-bold text-red-700">請先選擇課題或子folder</div>
      )}
    </div>
  );
};

export default ClassFolderSelectInline;
