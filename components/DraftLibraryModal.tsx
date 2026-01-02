import React, { useEffect, useMemo, useState } from 'react';
import { Copy, FolderInput, FolderPlus, Pencil, Trash2, X } from 'lucide-react';
import TeacherFolderPickerModal from './TeacherFolderPickerModal';
import StudentFolderManagerPanel from './StudentFolderManagerPanel';

type Props = {
  open: boolean;
  onClose: () => void;
  authService: any;
  userId: string;
  availableClasses: string[];
  onOpenDraft: (draft: any) => void;
};

const parseGradeFromClassName = (className?: string) => {
  const match = String(className || '').match(/^(\d+)/);
  return match ? match[1] : '';
};

const toolLabel = (toolType: string) => {
  switch (String(toolType || '')) {
    case 'discussion': return '討論';
    case 'note': return '筆記';
    case 'quiz': return '小測驗';
    case 'game': return '遊戲';
    case 'contest': return '問答比賽';
    case 'ai-bot': return 'AI小助手任務';
    default: return toolType || '草稿';
  }
};

const DraftLibraryModal: React.FC<Props> = ({ open, onClose, authService, userId, availableClasses, onOpenDraft }) => {
  const [space, setSpace] = useState<'my' | 'shared' | 'student'>('my');
  const gradeOptions = useMemo(() => {
    const grades = Array.from(new Set(availableClasses.map((c) => parseGradeFromClassName(c)).filter(Boolean)));
    grades.sort((a, b) => Number(a) - Number(b));
    return grades;
  }, [availableClasses]);

  const [grade, setGrade] = useState('');
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [movePickerOpen, setMovePickerOpen] = useState(false);
  const [movingDraft, setMovingDraft] = useState<any | null>(null);

  const [draftSelectMode, setDraftSelectMode] = useState(false);
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());

  const isMy = space === 'my';
  const isStudent = space === 'student';

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

  const loadFolders = async (s: 'my' | 'shared', g: string) => {
    if (!g) return [];
    if (s === 'my') {
      const resp = await authService.listMyLibraryFolders(g);
      return Array.isArray(resp.folders) ? resp.folders : [];
    }
    const resp = await authService.listSharedLibraryFolders(g);
    return Array.isArray(resp.folders) ? resp.folders : [];
  };

  const loadDrafts = async (s: 'my' | 'shared', g: string, folderId: string | null) => {
    if (!g) return [];
    if (s === 'my') {
      const resp = await authService.listMyDrafts({ grade: g, ...(folderId !== undefined ? { folderId } : {}) });
      return Array.isArray(resp.drafts) ? resp.drafts : [];
    }
    const resp = await authService.listSharedDrafts({ grade: g, ...(folderId !== undefined ? { folderId } : {}) });
    return Array.isArray(resp.drafts) ? resp.drafts : [];
  };

  const reload = async (opts?: { keepFolder?: boolean }) => {
    if (isStudent) return;
    if (!grade) return;
    setLoading(true);
    setError('');
    try {
      const [f, d] = await Promise.all([
        loadFolders(space, grade),
        loadDrafts(space, grade, selectedFolderId)
      ]);
      setFolders(f);
      setDrafts(d);
      if (!opts?.keepFolder) setSelectedFolderId(null);
    } catch (e: any) {
      setError(e?.message || '載入失敗');
      setFolders([]);
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setSpace('my');
    const g = gradeOptions[0] || '';
    setGrade(g);
    setSelectedFolderId(null);
    setFolders([]);
    setDrafts([]);
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (isStudent) return;
    if (!grade) return;
    void reload({ keepFolder: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, space, grade, selectedFolderId]);

  useEffect(() => {
    if (!open) return;
    setDraftSelectMode(false);
    setSelectedDraftIds(new Set());
  }, [open, space, grade, selectedFolderId]);

  useEffect(() => {
    if (!draftSelectMode) return;
    const currentIds = new Set(drafts.map((d) => String(d?.id)));
    setSelectedDraftIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (currentIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [draftSelectMode, drafts]);

  const isDraftDeletable = (d: any) => String(d?.ownerTeacherId || '') === String(userId || '');

  const deletableDraftIds = useMemo(
    () => drafts.filter(isDraftDeletable).map((d) => String(d.id)),
    [drafts, userId]
  );

  const allDeletableSelected = useMemo(() => {
    if (deletableDraftIds.length === 0) return false;
    return deletableDraftIds.every((id) => selectedDraftIds.has(id));
  }, [deletableDraftIds, selectedDraftIds]);

  const toggleSelectAllDrafts = () => {
    if (allDeletableSelected) {
      setSelectedDraftIds(new Set());
      return;
    }
    setSelectedDraftIds(new Set(deletableDraftIds));
  };

  const deleteSelectedDrafts = async () => {
    const ids = Array.from(selectedDraftIds).filter((id) => deletableDraftIds.includes(id));
    if (ids.length === 0) return;
    if (!window.confirm(`確定要刪除選取的 ${ids.length} 個草稿嗎？此操作無法復原！`)) return;
    setLoading(true);
    setError('');
    try {
      for (const id of ids) {
        await authService.deleteDraft(String(id));
      }
      setSelectedDraftIds(new Set());
      setDraftSelectMode(false);
      await reload({ keepFolder: true });
    } catch (e: any) {
      setError(e?.message || '刪除失敗');
    } finally {
      setLoading(false);
    }
  };

  const createLibraryFolder = async (parentId: string | null) => {
    if (!grade) return;
    const next = prompt(parentId ? '輸入子folder名稱' : '輸入 folder 名稱', '');
    const name = String(next || '').trim();
    if (!name) return;
    setLoading(true);
    setError('');
    try {
      const resp = isMy
        ? await authService.createMyLibraryFolder({ grade, name, parentId })
        : await authService.createSharedLibraryFolder({ grade, name, parentId });
      const id = String(resp?.folder?.id || '');
      await reload({ keepFolder: true });
      if (id) setSelectedFolderId(id);
    } catch (e: any) {
      setError(e?.message || '建立資料夾失敗');
    } finally {
      setLoading(false);
    }
  };

  const renameLibraryFolder = async () => {
    if (!selectedFolderId) return;
    const current = folders.find((f) => String(f?.id) === String(selectedFolderId)) || null;
    const next = prompt('改名', String(current?.name || ''));
    const name = String(next || '').trim();
    if (!name || name === String(current?.name || '')) return;
    setLoading(true);
    setError('');
    try {
      if (isMy) await authService.updateMyLibraryFolder(String(selectedFolderId), { name });
      else await authService.updateSharedLibraryFolder(String(selectedFolderId), { name });
      await reload({ keepFolder: true });
    } catch (e: any) {
      setError(e?.message || '改名失敗');
    } finally {
      setLoading(false);
    }
  };

  const deleteLibraryFolder = async () => {
    if (!selectedFolderId) return;
    if (!confirm('確定要刪除此 folder 嗎？（資料夾內仍有子資料夾會刪除失敗）')) return;
    setLoading(true);
    setError('');
    try {
      if (isMy) await authService.deleteMyLibraryFolder(String(selectedFolderId));
      else await authService.deleteSharedLibraryFolder(String(selectedFolderId));
      setSelectedFolderId(null);
      await reload({ keepFolder: true });
    } catch (e: any) {
      setError(e?.message || '刪除失敗');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[80] flex items-center justify-center p-4">
      <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-comic">
        <div className="p-6 border-b-4 border-brand-brown bg-[#C0E2BE] flex items-center justify-between">
          <div>
            <div className="text-2xl font-black text-brand-brown">教師資料夾（草稿）</div>
            <div className="text-sm text-brand-brown/80 font-bold">所有工具先「建立草稿」存於此，再由草稿派發</div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
          >
            <X className="w-6 h-6 text-brand-brown" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSpace('my')}
              className={`px-4 py-2 rounded-2xl border-4 font-black shadow-comic ${space === 'my' ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown' : 'bg-white border-brand-brown text-brand-brown hover:bg-gray-50'}`}
            >
              私人
            </button>
            <button
              type="button"
              onClick={() => setSpace('shared')}
              className={`px-4 py-2 rounded-2xl border-4 font-black shadow-comic ${space === 'shared' ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown' : 'bg-white border-brand-brown text-brand-brown hover:bg-gray-50'}`}
            >
              共用
            </button>
            <button
              type="button"
              onClick={() => setSpace('student')}
              className={`px-4 py-2 rounded-2xl border-4 font-black shadow-comic ${space === 'student' ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown' : 'bg-white border-brand-brown text-brand-brown hover:bg-gray-50'}`}
            >
              學生
            </button>
            <div className="flex items-center gap-2 ml-auto">
              {!isStudent && (
                <>
                  <div className="font-black text-gray-700">年級</div>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="px-3 py-2 rounded-xl border-2 border-gray-300 font-bold"
                  >
                    {gradeOptions.map((g) => (
                      <option key={g} value={g}>
                        {g}年級
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>

          {error && <div className="text-red-700 font-bold">{error}</div>}

          {isStudent ? (
            <div className="p-4 rounded-2xl border-2 border-gray-200 bg-white">
              <StudentFolderManagerPanel authService={authService} availableClasses={availableClasses} />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl border-2 border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="font-black text-gray-700">folder</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="px-3 py-1 rounded-xl border-2 border-gray-300 bg-white text-green-700 font-black hover:border-blue-500 disabled:opacity-60 flex items-center gap-2"
                      disabled={loading || !grade}
                      onClick={() => void createLibraryFolder(null)}
                      title="新增根目錄 folder"
                    >
                      <FolderPlus className="w-4 h-4" />
                      新增
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1 rounded-xl border-2 border-gray-300 bg-white text-blue-700 font-black hover:border-blue-500 disabled:opacity-60 flex items-center gap-2"
                      disabled={loading || !selectedFolderId}
                      onClick={() => void renameLibraryFolder()}
                      title="改名"
                    >
                      <Pencil className="w-4 h-4" />
                      改名
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1 rounded-xl border-2 border-red-300 bg-red-100 text-red-700 font-black hover:bg-red-200 disabled:opacity-60 flex items-center gap-2"
                      disabled={loading || !selectedFolderId}
                      onClick={() => void deleteLibraryFolder()}
                      title="刪除（封存）"
                    >
                      <Trash2 className="w-4 h-4" />
                      刪除
                    </button>
                  </div>
                </div>

                <select
                  className="w-full px-3 py-2 rounded-xl border-2 border-gray-300 font-bold bg-white"
                  value={selectedFolderId || ''}
                  onChange={(e) => setSelectedFolderId(e.target.value ? e.target.value : null)}
                  disabled={loading}
                >
                  <option value="">（未分類）</option>
                  {folderTree.map((row) => (
                    <option key={row.folder.id} value={row.folder.id}>
                      {'　'.repeat(row.depth)}{row.folder.name}
                    </option>
                  ))}
                </select>

                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    className="px-3 py-1 rounded-xl border-2 border-gray-300 bg-white text-brand-brown font-black hover:border-blue-500 disabled:opacity-60"
                    disabled={loading || !selectedFolderId}
                    onClick={() => void createLibraryFolder(selectedFolderId)}
                    title="新增子folder"
                  >
                    ＋子folder
                  </button>
                </div>
              </div>

	              <div className="p-4 rounded-2xl border-2 border-gray-200 bg-white lg:col-span-2">
	                <div className="flex items-center justify-between mb-3">
	                  <div className="font-black text-gray-700">草稿列表</div>
	                  <div className="flex items-center gap-2">
	                    {draftSelectMode ? (
	                      <>
	                        <button
	                          type="button"
	                          className="px-3 py-1 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-black hover:border-blue-500 disabled:opacity-60"
	                          disabled={loading || deletableDraftIds.length === 0}
	                          onClick={toggleSelectAllDrafts}
	                        >
	                          {allDeletableSelected ? '取消全選' : '全選'}
	                        </button>
	                        <button
	                          type="button"
	                          className="px-3 py-1 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-black hover:border-blue-500 disabled:opacity-60"
	                          disabled={loading || selectedDraftIds.size === 0}
	                          onClick={() => setSelectedDraftIds(new Set())}
	                        >
	                          全不選
	                        </button>
	                        <button
	                          type="button"
	                          className="px-3 py-1 rounded-xl border-2 border-red-300 bg-red-100 text-red-700 font-black hover:bg-red-200 disabled:opacity-60 flex items-center gap-2"
	                          disabled={loading || selectedDraftIds.size === 0}
	                          onClick={() => void deleteSelectedDrafts()}
	                        >
	                          <Trash2 className="w-4 h-4" />
	                          刪除選取（{selectedDraftIds.size}）
	                        </button>
	                        <button
	                          type="button"
	                          className="px-3 py-1 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-black hover:border-blue-500 disabled:opacity-60"
	                          disabled={loading}
	                          onClick={() => {
	                            setDraftSelectMode(false);
	                            setSelectedDraftIds(new Set());
	                          }}
	                        >
	                          取消
	                        </button>
	                      </>
	                    ) : (
	                      <button
	                        type="button"
	                        className="px-3 py-1 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-black hover:border-blue-500 disabled:opacity-60"
	                        disabled={loading || deletableDraftIds.length === 0}
	                        onClick={() => setDraftSelectMode(true)}
	                      >
	                        多選刪除
	                      </button>
	                    )}
	                    <div className="text-sm text-gray-600 font-bold">共 {drafts.length} 個</div>
	                  </div>
	                </div>

                {loading ? (
                  <div className="text-brand-brown font-bold">載入中...</div>
                ) : drafts.length === 0 ? (
                  <div className="text-gray-500 font-bold">（未有草稿）</div>
                ) : (
	                  <div className="grid grid-cols-1 gap-3">
	                    {drafts.map((d) => {
	                      const owner = String(d.ownerTeacherId || '');
	                      const isOwner = owner === String(userId || '');
	                      const canEdit = isMy && isOwner;
	                      const canDelete = isOwner;
	                      const id = String(d.id);
	                      const isSelected = selectedDraftIds.has(id);
	                      return (
	                        <div
	                          key={d.id}
	                          className={`p-4 rounded-2xl border-2 bg-gray-50 ${draftSelectMode && isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
	                        >
	                          <div className="flex items-start justify-between gap-3">
	                            <div className="flex items-start gap-3 min-w-0">
	                              {draftSelectMode && (
	                                <input
	                                  type="checkbox"
	                                  className={`w-5 h-5 mt-1 rounded border-2 border-gray-400 text-blue-600 focus:ring-blue-500 ${!canDelete ? 'opacity-50 cursor-not-allowed' : ''}`}
	                                  checked={isSelected}
	                                  disabled={!canDelete}
	                                  onChange={(e) => {
	                                    if (!canDelete) return;
	                                    setSelectedDraftIds((prev) => {
	                                      const next = new Set(prev);
	                                      if (e.target.checked) next.add(id);
	                                      else next.delete(id);
	                                      return next;
	                                    });
	                                  }}
	                                />
	                              )}
	                              <div className="min-w-0">
	                              <div className="font-black text-gray-800 truncate">{String(d.title || '')}</div>
	                              <div className="text-sm text-gray-600 font-bold">
	                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#FDEEAD] border border-brand-brown text-brand-brown font-black text-xs mr-2">
	                                  {toolLabel(d.toolType)}
	                                </span>
	                                科目：{String(d.subject || '')} ｜ 作者：{String(d.ownerTeacherName || d.ownerTeacherId || '')}
	                              </div>
	                              <div className="text-xs text-gray-500 font-bold">
	                                更新：{d.updatedAt ? new Date(d.updatedAt).toLocaleString() : '—'}
	                              </div>
	                              </div>
	                            </div>

                            <div className="flex flex-wrap gap-2 justify-end">
	                              <button
	                                onClick={() => onOpenDraft(d)}
	                                className="px-3 py-2 rounded-xl bg-white border-2 border-gray-300 hover:border-blue-500 font-black text-gray-700"
	                                disabled={draftSelectMode}
	                              >
	                                開啟
	                              </button>

                              {space === 'shared' && !isOwner && (
                                <button
                                  onClick={async () => {
                                    setLoading(true);
                                    setError('');
                                    try {
                                      const resp = await authService.copyDraftToMy(String(d.id));
                                      alert('已複製到我的草稿（未分類）');
                                      setSpace('my');
                                      setSelectedFolderId(null);
                                      setGrade(String(resp?.draft?.grade || grade));
                                    } catch (e: any) {
                                      setError(e?.message || '複製失敗');
                                    } finally {
                                      setLoading(false);
                                    }
                                  }}
                                  className="px-3 py-2 rounded-xl bg-green-600 text-white border-2 border-green-700 hover:bg-green-700 font-black flex items-center gap-2"
                                  title="複製到我的草稿後才可修改"
                                >
                                  <Copy className="w-4 h-4" />
                                  複製到我的
                                </button>
                              )}

                              {canEdit && (
                                <>
                                  <button
                                    onClick={async () => {
                                      const next = prompt('輸入新名稱', String(d.title || ''));
                                      const title = String(next || '').trim();
                                      if (!title || title === String(d.title || '')) return;
                                      setLoading(true);
                                      setError('');
                                      try {
                                        await authService.updateDraftMeta(String(d.id), { title });
                                        await reload({ keepFolder: true });
                                      } catch (e: any) {
                                        setError(e?.message || '改名失敗');
                                      } finally {
                                        setLoading(false);
                                      }
                                    }}
                                    className="px-3 py-2 rounded-xl bg-white border-2 border-gray-300 hover:border-blue-500 font-black text-gray-700 flex items-center gap-2"
                                  >
                                    <Pencil className="w-4 h-4" />
                                    改名
                                  </button>
                                  <button
                                    onClick={() => {
                                      setMovingDraft(d);
                                      setMovePickerOpen(true);
                                    }}
                                    className="px-3 py-2 rounded-xl bg-white border-2 border-gray-300 hover:border-blue-500 font-black text-gray-700 flex items-center gap-2"
                                    title="移動到其他 folder"
                                  >
                                    <FolderInput className="w-4 h-4" />
                                    移動
                                  </button>
                                </>
                              )}

                              {canDelete && (
                                <button
                                  onClick={async () => {
                                    if (!window.confirm('確定要刪除此草稿嗎？')) return;
                                    setLoading(true);
                                    setError('');
                                    try {
                                      await authService.deleteDraft(String(d.id));
                                      await reload({ keepFolder: true });
                                    } catch (e: any) {
                                      setError(e?.message || '刪除失敗');
                                    } finally {
                                      setLoading(false);
                                    }
                                  }}
                                  className="px-3 py-2 rounded-xl bg-red-600 text-white border-2 border-red-700 hover:bg-red-700 font-black flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  刪除
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <TeacherFolderPickerModal
        open={movePickerOpen}
        onClose={() => {
          setMovePickerOpen(false);
          setMovingDraft(null);
        }}
        authService={authService}
        availableGrades={gradeOptions}
        initial={{ scope: space, grade, folderId: selectedFolderId }}
        allowShared={true}
        readOnly={false}
        onPicked={async (picked) => {
          setMovePickerOpen(false);
          try {
            if (!movingDraft) return;
            await authService.updateDraftMeta(String(movingDraft.id), picked);
            await reload({ keepFolder: true });
          } catch (e: any) {
            setError(e?.message || '移動失敗');
          } finally {
            setMovingDraft(null);
          }
        }}
      />
    </div>
  );
};

export default DraftLibraryModal;
