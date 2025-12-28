import React, { useEffect, useMemo, useState } from 'react';
import { X, FolderPlus, Trash2, Pencil, Share2, Copy, Send, MoveRight } from 'lucide-react';
import RichHtmlContent from './RichHtmlContent';
import TemplateAssignModal from './TemplateAssignModal';

type Props = {
  open: boolean;
  onClose: () => void;
  authService: any;
  userId: string;
  availableClasses: string[];
  onOpenNoteDraft?: (noteId: string) => void;
};

type ContentBlock = { type: string; value: string };

const parseGradeFromClassName = (className?: string) => {
  const match = String(className || '').match(/^(\d+)/);
  return match ? match[1] : '';
};

const toGradeLabel = (grade: string) => {
  const n = Number.parseInt(String(grade), 10);
  if (!Number.isFinite(n)) return grade;
  const zh = ['零', '一', '二', '三', '四', '五', '六'];
  if (n >= 1 && n <= 6) return `小${zh[n]}`;
  return `${n}年級`;
};

const normalizeContentBlocks = (input: any): ContentBlock[] => {
  if (Array.isArray(input)) {
    return input
      .map((raw) => {
        if (!raw || typeof raw !== 'object') return null;
        const type = typeof (raw as any).type === 'string' ? (raw as any).type : String((raw as any).type ?? 'text');
        const value = typeof (raw as any).value === 'string' ? (raw as any).value : String((raw as any).value ?? '');
        return { type, value };
      })
      .filter(Boolean) as ContentBlock[];
  }
  if (typeof input === 'string') {
    const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(input);
    return [{ type: looksLikeHtml ? 'html' : 'text', value: input }];
  }
  if (input && typeof input === 'object' && 'type' in input && 'value' in input) {
    const type = typeof (input as any).type === 'string' ? (input as any).type : String((input as any).type ?? 'text');
    const value = typeof (input as any).value === 'string' ? (input as any).value : String((input as any).value ?? '');
    return [{ type, value }];
  }
  return [];
};

const normalizeTemplateTaskType = (raw: any) => {
  const t = String(raw || '').trim();
  if (t === 'discussion') return 'assignment';
  if (t === 'assignment' || t === 'quiz' || t === 'game' || t === 'contest' || t === 'ai-bot' || t === 'note') return t;
  return 'assignment';
};

const templateTypeLabel = (t: any) => {
  switch (normalizeTemplateTaskType(t?.type)) {
    case 'quiz': return '小測驗';
    case 'game': return '遊戲';
    case 'contest': return '問答比賽';
    case 'ai-bot': return 'AI小助手任務';
    case 'note': return '筆記';
    default: return '任務';
  }
};

const TemplateLibraryModal: React.FC<Props> = ({ open, onClose, authService, userId, availableClasses, onOpenNoteDraft }) => {
  const [space, setSpace] = useState<'my' | 'shared'>('my');
  const gradeOptions = useMemo(() => {
    const grades = Array.from(
      new Set(availableClasses.map((c) => parseGradeFromClassName(c)).filter(Boolean))
    );
    grades.sort((a, b) => Number(a) - Number(b));
    return grades;
  }, [availableClasses]);

  const [grade, setGrade] = useState('');
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [viewingTemplate, setViewingTemplate] = useState<any | null>(null);
  const [viewingVersion, setViewingVersion] = useState<any | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTemplate, setAssignTemplate] = useState<any | null>(null);
  const [assignDraftOnly, setAssignDraftOnly] = useState(false);

  const isMy = space === 'my';

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

  const loadTemplates = async (s: 'my' | 'shared', g: string, folderId: string | null) => {
    if (!g) return [];
    if (s === 'my') {
      const resp = await authService.listMyTemplates({ grade: g, ...(folderId ? { folderId } : {}) });
      return Array.isArray(resp.templates) ? resp.templates : [];
    }
    const resp = await authService.listSharedTemplates({ grade: g, ...(folderId ? { folderId } : {}) });
    return Array.isArray(resp.templates) ? resp.templates : [];
  };

  const reload = async (opts?: { keepFolder?: boolean }) => {
    if (!grade) return;
    setLoading(true);
    setError('');
    try {
      const [f, t] = await Promise.all([
        loadFolders(space, grade),
        loadTemplates(space, grade, selectedFolderId)
      ]);
      setFolders(f);
      setTemplates(t);
      if (!opts?.keepFolder) setSelectedFolderId(null);
    } catch (e: any) {
      setError(e?.message || '載入失敗');
      setFolders([]);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const nextGrade = grade || gradeOptions[0] || '';
    if (!nextGrade) return;
    setGrade(nextGrade);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!grade) return;
    void reload();
  }, [open, space, grade]);

  useEffect(() => {
    if (!open) return;
    if (!grade) return;
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const t = await loadTemplates(space, grade, selectedFolderId);
        setTemplates(t);
      } catch (e: any) {
        setError(e?.message || '載入模板失敗');
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedFolderId]);

  const openView = async (tpl: any) => {
    setViewingTemplate(null);
    setViewingVersion(null);
    setLoadingTemplate(true);
    setError('');
    try {
      const resp = await authService.getTemplate(String(tpl.id));
      setViewingTemplate(resp.template);
      setViewingVersion(resp.version);
    } catch (e: any) {
      setError(e?.message || '讀取模板失敗');
    } finally {
      setLoadingTemplate(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-comic">
        <div className="p-6 border-b-4 border-brand-brown bg-[#C0E2BE] flex items-center justify-between">
          <div>
            <div className="text-3xl font-black text-brand-brown">教師資料夾（模板）</div>
            <div className="text-sm text-brand-brown/80 font-bold">按年級 + folder 整理；共用模板可直接派送（筆記會先開啟草稿再派發）；要改模板本身先複製</div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
          >
            <X className="w-6 h-6 text-brand-brown" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="font-black text-gray-700">空間</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSpace('my')}
                  className={`px-4 py-2 rounded-xl border-2 font-black ${space === 'my' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:border-blue-500'}`}
                >
                  我的題庫
                </button>
                <button
                  onClick={() => setSpace('shared')}
                  className={`px-4 py-2 rounded-xl border-2 font-black ${space === 'shared' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:border-blue-500'}`}
                >
                  教師共用空間
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="font-black text-gray-700">年級</label>
              <select
                className="px-3 py-2 rounded-xl border-2 border-gray-300 font-bold"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                disabled={gradeOptions.length === 0}
              >
                {gradeOptions.map((g) => (
                  <option key={g} value={g}>
                    {toGradeLabel(g)}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => void reload({ keepFolder: true })}
              className="px-4 py-2 rounded-xl bg-white border-2 border-gray-300 hover:border-blue-500 font-black text-gray-700"
              disabled={loading || !grade}
            >
              重新載入
            </button>

            {error && <div className="text-red-600 font-bold">{error}</div>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl border-2 border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <div className="font-black text-gray-700">Folders</div>
                <button
                  onClick={async () => {
                    const name = prompt('新 folder 名稱');
                    if (!name || !name.trim()) return;
                    setLoading(true);
                    setError('');
                    try {
                      if (isMy) {
                        await authService.createMyLibraryFolder({ grade, name: name.trim(), parentId: selectedFolderId || null });
                      } else {
                        await authService.createSharedLibraryFolder({ grade, name: name.trim(), parentId: selectedFolderId || null });
                      }
                      await reload({ keepFolder: true });
                    } catch (e: any) {
                      setError(e?.message || '建立 folder 失敗');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-green-600 text-white font-black border-2 border-green-700 hover:bg-green-700 flex items-center gap-2"
                  disabled={!grade || loading}
                  title="在目前選取的 folder 下新增"
                >
                  <FolderPlus className="w-4 h-4" />
                  新增
                </button>
              </div>

              <div className="space-y-1">
                <button
                  onClick={() => setSelectedFolderId(null)}
                  className={`w-full px-3 py-2 rounded-xl border-2 font-bold text-left ${selectedFolderId === null ? 'bg-blue-600 text-white border-blue-700' : 'bg-white border-gray-300 hover:border-blue-500'}`}
                >
                  （全部）
                </button>
                {folderTree.map(({ folder, depth }) => (
                  <div key={folder.id} className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedFolderId(String(folder.id))}
                      className={`flex-1 px-3 py-2 rounded-xl border-2 font-bold text-left ${
                        String(selectedFolderId || '') === String(folder.id)
                          ? 'bg-blue-600 text-white border-blue-700'
                          : 'bg-white border-gray-300 hover:border-blue-500'
                      }`}
                      style={{ paddingLeft: 12 + depth * 14 }}
                    >
                      {folder.name}
                    </button>
                    <button
                      onClick={async () => {
                        const next = prompt('改名', String(folder.name || ''));
                        if (!next || !next.trim()) return;
                        setLoading(true);
                        setError('');
                        try {
                          if (isMy) await authService.updateMyLibraryFolder(String(folder.id), { name: next.trim() });
                          else await authService.updateSharedLibraryFolder(String(folder.id), { name: next.trim() });
                          await reload({ keepFolder: true });
                        } catch (e: any) {
                          setError(e?.message || '改名失敗');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="p-2 rounded-xl bg-blue-100 text-blue-700 hover:bg-blue-200"
                      title="改名"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm('確定要刪除（封存）此 folder 嗎？（需先清空子 folder）')) return;
                        setLoading(true);
                        setError('');
                        try {
                          if (isMy) await authService.deleteMyLibraryFolder(String(folder.id));
                          else await authService.deleteSharedLibraryFolder(String(folder.id));
                          if (String(selectedFolderId || '') === String(folder.id)) setSelectedFolderId(null);
                          await reload({ keepFolder: true });
                        } catch (e: any) {
                          setError(e?.message || '刪除失敗');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="p-2 rounded-xl bg-red-100 text-red-700 hover:bg-red-200"
                      title="刪除（封存）"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {folders.length === 0 && <div className="text-gray-500 font-bold">（未有 folder）</div>}
              </div>
            </div>

            <div className="p-4 rounded-2xl border-2 border-gray-200 bg-white lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <div className="font-black text-gray-700">模板列表</div>
                <div className="text-sm text-gray-600 font-bold">共 {templates.length} 個</div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {templates.map((t) => {
                  const isOwner = String(t.ownerTeacherId || '') === String(userId || '');
                  const canShare = isMy && isOwner;
                  const canMoveMy = isMy && isOwner;
                  const canMoveShared = !isMy && isOwner && t.visibility === 'shared';
                  const isNote = normalizeTemplateTaskType(t.type) === 'note';
                  return (
                    <div key={t.id} className="p-4 rounded-2xl border-2 border-gray-200 bg-gray-50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-black text-gray-800 truncate">{t.title}</div>
                          <div className="text-sm text-gray-600 font-bold">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#FDEEAD] border border-brand-brown text-brand-brown font-black text-xs mr-2">
                              {templateTypeLabel(t)}
                            </span>
                            科目：{t.subject} ｜ {isMy ? '我的題庫' : '共用'} ｜ 作者：{t.ownerTeacherName || t.ownerTeacherId}
                          </div>
                          <div className="text-xs text-gray-500 font-bold">
                            更新：{t.updatedAt ? new Date(t.updatedAt).toLocaleString() : '—'}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end">
                          <button
                            onClick={() => void openView(t)}
                            className="px-3 py-2 rounded-xl bg-white border-2 border-gray-300 hover:border-blue-500 font-black text-gray-700"
                            disabled={loadingTemplate}
                          >
                            查看
                          </button>
                          {isNote ? (
                            <button
                              onClick={() => {
                                setAssignTemplate(t);
                                setAssignDraftOnly(true);
                                setAssignOpen(true);
                              }}
                              className="px-3 py-2 rounded-xl bg-blue-600 text-white border-2 border-blue-700 hover:bg-blue-700 font-black flex items-center gap-2"
                              title="筆記會先建立草稿（已套用模板）並打開編輯頁；完成後再派發"
                            >
                              <MoveRight className="w-4 h-4" />
                              開啟草稿
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setAssignTemplate(t);
                                setAssignDraftOnly(false);
                                setAssignOpen(true);
                              }}
                              className="px-3 py-2 rounded-xl bg-blue-600 text-white border-2 border-blue-700 hover:bg-blue-700 font-black flex items-center gap-2"
                            >
                              <Send className="w-4 h-4" />
                              派送
                            </button>
                          )}
                          {!isMy && (
                            <button
                              onClick={async () => {
                                setLoading(true);
                                setError('');
                                try {
                                  const myFolders = await authService.listMyLibraryFolders(grade);
                                  const names = (myFolders.folders || []).map((f: any) => `${f.id}:${f.name}`).join('\n');
                                  const picked = prompt(`複製到我的題庫（可選目標 folderId；留空=未分類）\n可用 folder：\n${names}`);
                                  const folderId = picked && picked.trim() ? picked.trim().split(':')[0] : null;
                                  await authService.copyTemplateToMyLibrary(String(t.id), { folderId });
                                  alert('已複製到我的題庫');
                                } catch (e: any) {
                                  setError(e?.message || '複製失敗');
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              className="px-3 py-2 rounded-xl bg-green-600 text-white border-2 border-green-700 hover:bg-green-700 font-black flex items-center gap-2"
                              title="複製後可在我的題庫修改"
                            >
                              <Copy className="w-4 h-4" />
                              複製
                            </button>
                          )}
                          {canShare && (
                            <button
                              onClick={async () => {
                                setLoading(true);
                                setError('');
                                try {
                                  if (t.visibility === 'shared') await authService.unshareTemplate(String(t.id));
                                  else await authService.shareTemplate(String(t.id));
                                  await reload({ keepFolder: true });
                                } catch (e: any) {
                                  setError(e?.message || '更新共享狀態失敗');
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              className="px-3 py-2 rounded-xl bg-purple-600 text-white border-2 border-purple-700 hover:bg-purple-700 font-black flex items-center gap-2"
                            >
                              <Share2 className="w-4 h-4" />
                              {t.visibility === 'shared' ? '取消共享' : '共享'}
                            </button>
                          )}
                          {(canMoveMy || canMoveShared) && (
                            <button
                              onClick={async () => {
                                const list = folders.map((f) => `${f.id}:${f.name}`).join('\n');
                                const picked = prompt(`移動到 folder（輸入 folderId；留空=未分類）\n可用 folder：\n${list}`);
                                const folderId = picked && picked.trim() ? picked.trim().split(':')[0] : null;
                                setLoading(true);
                                setError('');
                                try {
                                  await authService.updateTemplateLocation(String(t.id), { scope: space, folderId });
                                  await reload({ keepFolder: true });
                                } catch (e: any) {
                                  setError(e?.message || '移動失敗');
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              className="px-3 py-2 rounded-xl bg-white border-2 border-gray-300 hover:border-blue-500 font-black text-gray-700 flex items-center gap-2"
                              title="移動模板到 folder"
                            >
                              <MoveRight className="w-4 h-4" />
                              移動
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {templates.length === 0 && (
                  <div className="text-center py-12 text-gray-500 font-black border-4 border-dashed border-gray-200 rounded-3xl">
                    （此年級未有模板）
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl border-2 border-gray-200 bg-gray-50">
            <div className="font-black text-gray-700 mb-2">預覽</div>
            {loadingTemplate && <div className="text-gray-600 font-bold">載入中…</div>}
            {!loadingTemplate && !viewingTemplate && <div className="text-gray-500 font-bold">（選擇「查看」以預覽內容）</div>}
            {!loadingTemplate && viewingTemplate && (
              <div className="space-y-3">
                <div className="font-black text-gray-800">{viewingTemplate.title}</div>
                <div className="text-sm text-gray-600 font-bold">科目：{viewingTemplate.subject}</div>
                <div className="space-y-3">
                  {normalizeContentBlocks(viewingVersion?.content).map((block, idx) => (
                    <div key={idx} className="p-3 bg-white border-2 border-gray-200 rounded-xl">
                      {block.type === 'html' ? (
                        <RichHtmlContent html={block.value} />
                      ) : block.type === 'image' ? (
                        <img src={block.value} className="max-w-full h-auto rounded-xl" />
                      ) : block.type === 'link' ? (
                        <a href={block.value} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline break-all">
                          {block.value}
                        </a>
                      ) : (
                        <div className="whitespace-pre-wrap font-bold text-gray-700">{block.value}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <TemplateAssignModal
          open={assignOpen}
          onClose={() => setAssignOpen(false)}
          authService={authService}
          availableClasses={availableClasses}
          templateTitle={String(assignTemplate?.title || '')}
          templateId={String(assignTemplate?.id || '')}
          draftOnly={assignDraftOnly}
          onAssignedResult={(resp) => {
            if (!assignDraftOnly) return;
            const note = resp?.note;
            const noteId = note?.id ? String(note.id) : '';
            if (!noteId) return;
            onOpenNoteDraft?.(noteId);
            onClose();
          }}
          onAssigned={() => {
            setAssignOpen(false);
          }}
        />
      </div>
    </div>
  );
};

export default TemplateLibraryModal;
