import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';

type TeacherLocation = { scope: 'my' | 'shared'; grade: string; folderId: string | null };

type Props = {
  open: boolean;
  mode: 'save' | 'publish';
  onClose: () => void;
  authService: any;
  availableGrades: string[];
  availableClasses: string[];
  title: string;
  allowShared?: boolean;
  initialLocation?: Partial<TeacherLocation>;
  readOnlyLocation?: boolean;
  keepDraftDefault?: boolean;
  keepDraftLocked?: boolean;
  onSave: (picked: TeacherLocation) => Promise<{ draftId: string }>;
  onPublished?: (payload: any) => void;
};

const DraftSavePublishWizardModal: React.FC<Props> = ({
  open,
  mode,
  onClose,
  authService,
  availableGrades,
  availableClasses,
  title,
  allowShared,
  initialLocation,
  readOnlyLocation,
  keepDraftDefault,
  keepDraftLocked,
  onSave,
  onPublished
}) => {
  const [step, setStep] = useState<'location' | 'publish'>('location');

  const [scope, setScope] = useState<'my' | 'shared'>(initialLocation?.scope === 'shared' ? 'shared' : 'my');
  const [grade, setGrade] = useState(initialLocation?.grade || '');
  const [folders, setFolders] = useState<any[]>([]);
  const [folderId, setFolderId] = useState<string | null>(initialLocation?.folderId ?? null);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [locationError, setLocationError] = useState('');

  const [saving, setSaving] = useState(false);
  const [savedDraftId, setSavedDraftId] = useState('');

  const [publishError, setPublishError] = useState('');
  const [className, setClassName] = useState('');
  const [classFolders, setClassFolders] = useState<any[]>([]);
  const [loadingClassFolders, setLoadingClassFolders] = useState(false);
  const [stageId, setStageId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [subId, setSubId] = useState('');
  const [keepDraft, setKeepDraft] = useState(keepDraftDefault !== false);
  const [publishing, setPublishing] = useState(false);
  const [folderEditing, setFolderEditing] = useState(false);

  const scopes: { key: 'my' | 'shared'; label: string }[] = [
    { key: 'my', label: '私人' },
    ...(allowShared ? [{ key: 'shared' as const, label: '共用' }] : [])
  ];

  const folderTree = useMemo(() => {
    const byParent = new Map<string | null, any[]>();
    for (const f of folders) {
      const pid = f.parentId ? String(f.parentId) : null;
      if (!byParent.has(pid)) byParent.set(pid, []);
      byParent.get(pid)!.push(f);
    }
    for (const list of byParent.values()) {
      list.sort((a, b) => {
        const oa = Number.isFinite(a.order) ? a.order : 0;
        const ob = Number.isFinite(b.order) ? b.order : 0;
        if (oa !== ob) return oa - ob;
        return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
      });
    }
    const renderNode = (parentId: string | null, depth: number): any[] => {
      const list = byParent.get(parentId) || [];
      const out: any[] = [];
      for (const f of list) {
        out.push({ folder: f, depth });
        out.push(...renderNode(String(f.id), depth + 1));
      }
      return out;
    };
    return renderNode(null, 0);
  }, [folders]);

  const stageFolders = useMemo(() => classFolders.filter((f) => f && f.level === 1), [classFolders]);
  const topicFolders = useMemo(() => classFolders.filter((f) => f && f.level === 2 && String(f.parentId || '') === String(stageId || '')), [classFolders, stageId]);
  const subFolders = useMemo(() => classFolders.filter((f) => f && f.level === 3 && String(f.parentId || '') === String(topicId || '')), [classFolders, topicId]);
  const resolvedClassFolderId = subId || topicId;

  const pickStageId = (list: any[], preferred?: string) => {
    const stages = list.filter((f: any) => f && f.level === 1);
    if (preferred && stages.some((s: any) => String(s.id) === String(preferred))) return String(preferred);
    return stages[0] ? String(stages[0].id) : '';
  };

  const pickTopicId = (list: any[], stage: string, preferred?: string) => {
    const topics = list.filter((f: any) => f && f.level === 2 && String(f.parentId || '') === String(stage || ''));
    if (preferred && topics.some((t: any) => String(t.id) === String(preferred))) return String(preferred);
    return topics[0] ? String(topics[0].id) : '';
  };

  const pickSubId = (list: any[], topic: string, preferred?: string) => {
    const subs = list.filter((f: any) => f && f.level === 3 && String(f.parentId || '') === String(topic || ''));
    if (preferred && subs.some((s: any) => String(s.id) === String(preferred))) return String(preferred);
    return '';
  };

  const loadTeacherFolders = async (s: 'my' | 'shared', g: string) => {
    if (!g) return [];
    if (s === 'my') {
      const resp = await authService.listMyLibraryFolders(g);
      return Array.isArray(resp.folders) ? resp.folders : [];
    }
    const resp = await authService.listSharedLibraryFolders(g);
    return Array.isArray(resp.folders) ? resp.folders : [];
  };

  const loadClassFolders = async (cls: string, opts?: { stageId?: string; topicId?: string; subId?: string }) => {
    const c = String(cls || '').trim();
    if (!c) return;
    setLoadingClassFolders(true);
    setPublishError('');
    try {
      const resp = await authService.getClassFolders(c);
      const list = Array.isArray(resp.folders) ? resp.folders : [];
      setClassFolders(list);

      const nextStageId = pickStageId(list, opts?.stageId);
      setStageId(nextStageId);

      const nextTopicId = pickTopicId(list, nextStageId, opts?.topicId);
      setTopicId(nextTopicId);
      setSubId(pickSubId(list, nextTopicId, opts?.subId));
    } catch (e: any) {
      setPublishError(e?.message || '載入班級資料夾失敗');
      setClassFolders([]);
      setStageId('');
      setTopicId('');
      setSubId('');
    } finally {
      setLoadingClassFolders(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setStep('location');
    setScope(initialLocation?.scope === 'shared' ? 'shared' : 'my');
    const g = initialLocation?.grade || availableGrades[0] || '';
    setGrade(g);
    setFolderId(initialLocation?.folderId ?? null);
    setFolders([]);
    setLoadingFolders(false);
    setLocationError('');
    setSaving(false);
    setSavedDraftId('');

    setPublishError('');
    const firstClass = availableClasses[0] || '';
    setClassName(firstClass);
    setClassFolders([]);
    setStageId('');
    setTopicId('');
    setSubId('');
    setKeepDraft(keepDraftDefault !== false);
    setFolderEditing(false);
    setPublishing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!grade) return;
    setLoadingFolders(true);
    setLocationError('');
    void (async () => {
      try {
        const list = await loadTeacherFolders(scope, grade);
        setFolders(list);
      } catch (e: any) {
        setLocationError(e?.message || '載入教師資料夾失敗');
        setFolders([]);
      } finally {
        setLoadingFolders(false);
      }
    })();
  }, [open, scope, grade]);

  useEffect(() => {
    if (!open) return;
    if (mode !== 'publish') return;
    if (step !== 'publish') return;
    if (!className) return;
    void loadClassFolders(className);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, step]);

  useEffect(() => {
    if (!open) return;
    if (step !== 'publish') return;
    if (!stageId) return;
    const firstTopic = topicFolders[0] ? String(topicFolders[0].id) : '';
    setTopicId(firstTopic);
    setSubId('');
  }, [open, step, stageId]);

  useEffect(() => {
    if (!open) return;
    if (step !== 'publish') return;
    setSubId('');
  }, [open, step, topicId]);

  if (!open) return null;

  const headerTitle = mode === 'publish' ? '儲存及派發' : '儲存草稿';
  const folderActionsDisabled = folderEditing || publishing || loadingClassFolders;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[140] flex items-center justify-center p-4">
      <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-comic">
        <div className="p-6 border-b-4 border-brand-brown bg-[#C0E2BE] flex items-center justify-between">
          <div>
            <div className="text-2xl font-black text-brand-brown">{headerTitle}</div>
            <div className="text-sm text-brand-brown/80 font-bold truncate max-w-[60vw]">{title || '（未命名）'}</div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
            aria-label="關閉"
          >
            <X className="w-6 h-6 text-brand-brown" />
          </button>
        </div>

        {step === 'location' ? (
          <div className="p-6 space-y-4">
            <div className="text-sm font-bold text-gray-700">第 1 步：選擇教師資料夾位置（年級 → 私人/共用 → folder 可選）</div>

            <div className="flex flex-wrap gap-2">
              {scopes.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setScope(s.key)}
                  disabled={readOnlyLocation}
                  className={`px-4 py-2 rounded-2xl border-4 font-black shadow-comic ${scope === s.key ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown' : 'bg-white border-brand-brown text-brand-brown hover:bg-gray-50'} ${readOnlyLocation ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="w-20 font-black text-gray-700">年級</div>
              <select
                className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-300 font-bold"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                disabled={readOnlyLocation}
              >
                {availableGrades.map((g) => (
                  <option key={g} value={g}>
                    {g}年級
                  </option>
                ))}
              </select>
            </div>

            <div className="border-2 border-gray-200 rounded-2xl p-3 bg-gray-50">
              <div className="font-black text-gray-700 mb-2">folder（可選）</div>
              {loadingFolders ? (
                <div className="text-brand-brown font-bold">載入中...</div>
              ) : (
                <select
                  className="w-full px-3 py-2 rounded-xl border-2 border-gray-300 font-bold bg-white"
                  value={folderId || ''}
                  onChange={(e) => setFolderId(e.target.value ? e.target.value : null)}
                  disabled={readOnlyLocation}
                >
                  <option value="">（未分類）</option>
                  {folderTree.map((row) => (
                    <option key={row.folder.id} value={row.folder.id}>
                      {'　'.repeat(row.depth)}{row.folder.name}
                    </option>
                  ))}
                </select>
              )}
              {locationError && <div className="text-red-600 font-bold mt-2">{locationError}</div>}
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white border-2 border-gray-300 font-black text-gray-700 hover:border-blue-500"
                disabled={saving}
              >
                取消
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!grade) return setLocationError('請選擇年級');
                  setSaving(true);
                  setLocationError('');
                  try {
                    const picked: TeacherLocation = { scope, grade, folderId };
                    const result = await onSave(picked);
                    const id = String(result?.draftId || '');
                    if (!id) throw new Error('儲存失敗（缺少 draftId）');
                    setSavedDraftId(id);
                    if (mode === 'save') {
                      alert('已儲存草稿');
                      onClose();
                      return;
                    }
                    setStep('publish');
                  } catch (e: any) {
                    setLocationError(e?.message || '儲存失敗');
                  } finally {
                    setSaving(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white font-black border-2 border-blue-700 hover:bg-blue-700 disabled:opacity-60"
                disabled={saving || loadingFolders || !grade}
              >
                {saving ? '儲存中…' : mode === 'publish' ? '下一步' : '儲存'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-bold text-gray-700">第 2 步：選擇派發位置（班別 → 學段 → 課題 → 子folder 可選）</div>
              <button
                type="button"
                onClick={() => setStep('location')}
                className="px-3 py-2 rounded-xl bg-white border-2 border-gray-300 hover:border-blue-500 font-black text-gray-700 flex items-center gap-2"
                disabled={publishing}
                title="返回上一步"
              >
                <ArrowLeft className="w-4 h-4" />
                上一步
              </button>
            </div>

            {availableClasses.length === 0 ? (
              <div className="p-4 rounded-2xl border-2 border-gray-200 bg-gray-50 font-bold text-gray-700">未有班別資料（availableClasses 為空）。</div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-20 font-black text-gray-700">班別</div>
                  <select
                    className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-300 font-bold"
                    value={className}
                    onChange={(e) => {
                      const c = e.target.value;
                      setClassName(c);
                      void loadClassFolders(c);
                    }}
                  >
                    {availableClasses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-20 font-black text-gray-700">學段</div>
                  <select
                    className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-300 font-bold"
                    value={stageId}
                    onChange={(e) => setStageId(e.target.value)}
                    disabled={loadingClassFolders || stageFolders.length === 0}
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
                  <div className="flex-1 flex items-center gap-2">
                    <select
                      className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-300 font-bold"
                      value={topicId}
                      onChange={(e) => setTopicId(e.target.value)}
                      disabled={loadingClassFolders || topicFolders.length === 0}
                    >
                      <option value="" disabled>
                        {loadingClassFolders ? '載入中…' : topicFolders.length === 0 ? '（此學段未有課題）' : '請選擇課題'}
                      </option>
                      {topicFolders.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="px-3 py-2 rounded-xl bg-white border-2 border-gray-300 hover:border-blue-500 font-black text-gray-700 disabled:opacity-60"
                      disabled={!className || !stageId || folderActionsDisabled}
                      onClick={async () => {
                        if (!className) return setPublishError('請先選擇班別');
                        if (!stageId) return setPublishError('請先選擇學段');
                        const raw = window.prompt('輸入課題名稱（可多行，用換行分隔）');
                        if (raw == null) return;
                        const names = String(raw)
                          .split(/\r?\n/)
                          .map((s) => String(s || '').trim())
                          .filter(Boolean);
                        if (names.length === 0) return setPublishError('課題名稱不可為空');

                        setFolderEditing(true);
                        setPublishError('');
                        try {
                          if (names.length === 1) {
                            const resp = await authService.createClassFolder(className, { parentId: stageId, level: 2, name: names[0] });
                            const createdId = String(resp?.folder?.id || '');
                            await loadClassFolders(className, { stageId, topicId: createdId || undefined, subId: '' });
                          } else {
                            const resp = await authService.batchCreateClassFolders(className, { parentId: stageId, level: 2, names });
                            const created = Array.isArray(resp?.folders) ? resp.folders : [];
                            const createdId = created[0]?.id ? String(created[0].id) : '';
                            await loadClassFolders(className, { stageId, topicId: createdId || undefined, subId: '' });
                          }
                        } catch (e: any) {
                          setPublishError(e?.message || '新增課題失敗');
                        } finally {
                          setFolderEditing(false);
                        }
                      }}
                    >
                      ＋課題
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-20 font-black text-gray-700">子folder</div>
                  <div className="flex-1 flex items-center gap-2">
                    <select
                      className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-300 font-bold"
                      value={subId}
                      onChange={(e) => setSubId(e.target.value)}
                      disabled={loadingClassFolders || !topicId}
                    >
                      <option value="">（不選，直接放在課題底下）</option>
                      {subFolders.map((sf) => (
                        <option key={sf.id} value={sf.id}>
                          {sf.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="px-3 py-2 rounded-xl bg-white border-2 border-gray-300 hover:border-blue-500 font-black text-gray-700 disabled:opacity-60"
                      disabled={!className || !topicId || folderActionsDisabled}
                      onClick={async () => {
                        if (!className) return setPublishError('請先選擇班別');
                        if (!topicId) return setPublishError('請先選擇課題');
                        const raw = window.prompt('輸入子folder名稱（可多行，用換行分隔）');
                        if (raw == null) return;
                        const names = String(raw)
                          .split(/\r?\n/)
                          .map((s) => String(s || '').trim())
                          .filter(Boolean);
                        if (names.length === 0) return setPublishError('子folder 名稱不可為空');

                        setFolderEditing(true);
                        setPublishError('');
                        try {
                          if (names.length === 1) {
                            const resp = await authService.createClassFolder(className, { parentId: topicId, level: 3, name: names[0] });
                            const createdId = String(resp?.folder?.id || '');
                            await loadClassFolders(className, { stageId, topicId, subId: createdId || undefined });
                          } else {
                            const resp = await authService.batchCreateClassFolders(className, { parentId: topicId, level: 3, names });
                            const created = Array.isArray(resp?.folders) ? resp.folders : [];
                            const createdId = created[0]?.id ? String(created[0].id) : '';
                            await loadClassFolders(className, { stageId, topicId, subId: createdId || undefined });
                          }
                        } catch (e: any) {
                          setPublishError(e?.message || '新增子folder失敗');
                        } finally {
                          setFolderEditing(false);
                        }
                      }}
                    >
                      ＋子folder
                    </button>
                  </div>
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 font-black text-gray-700">
              <input
                type="checkbox"
                checked={keepDraft}
                onChange={(e) => setKeepDraft(e.target.checked)}
                disabled={keepDraftLocked}
              />
              派發後保留草稿（預設保留）
            </label>

            {publishError && <div className="text-red-600 font-bold">{publishError}</div>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white border-2 border-gray-300 font-black text-gray-700 hover:border-blue-500"
                disabled={publishing}
              >
                取消
              </button>
              <button
                onClick={async () => {
                  if (!availableClasses.length) return;
                  if (!className) return setPublishError('請選擇班別');
                  if (!stageId) return setPublishError('請選擇學段');
                  if (!topicId) return setPublishError('請選擇課題');
                  if (!resolvedClassFolderId) return setPublishError('請選擇課題或子folder');
                  const draftId = savedDraftId || '';
                  if (!draftId) return setPublishError('缺少 draftId（請返回上一步再試）');
                  setPublishing(true);
                  setPublishError('');
                  try {
                    const resp = await authService.publishDraft(draftId, { className, classFolderId: resolvedClassFolderId, ...(keepDraftLocked ? {} : { keepDraft }) });
                    alert('派發成功！');
                    onPublished?.(resp);
                    onClose();
                  } catch (e: any) {
                    setPublishError(e?.message || '派發失敗');
                  } finally {
                    setPublishing(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white font-black border-2 border-blue-700 hover:bg-blue-700 disabled:opacity-60"
                disabled={publishing || loadingClassFolders || !availableClasses.length}
              >
                {publishing ? '派發中…' : '派發'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DraftSavePublishWizardModal;
