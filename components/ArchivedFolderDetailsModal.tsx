import React, { useMemo, useState } from 'react';
import { X, Folder, FileText, ArchiveRestore } from 'lucide-react';
import Button from './Button';

type FolderItem = {
  id: string;
  className?: string;
  level?: number;
  parentId?: string | null;
  name?: string;
  order?: number;
  archivedAt?: string | null;
};

type TaskItem = {
  id: string;
  type: 'assignment' | 'quiz' | 'game' | 'contest' | 'ai-bot';
  title?: string;
  subject?: string;
  teacherName?: string;
  createdAt?: string;
  isActive?: boolean;
  archivedAt?: string | null;
  classFolderId?: string | null;
};

const labelForFolderLevel = (level?: number) => {
  if (level === 1) return '學段';
  if (level === 2) return '課題';
  if (level === 3) return '子folder';
  return '資料夾';
};

const labelForTaskType = (type: TaskItem['type']) => {
  switch (type) {
    case 'assignment': return '討論/作業';
    case 'quiz': return '小測驗';
    case 'game': return '遊戲';
    case 'contest': return '問答比賽';
    case 'ai-bot': return 'AI 任務';
  }
};

export default function ArchivedFolderDetailsModal(props: {
  open: boolean;
  onClose: () => void;
  className: string;
  folder: FolderItem | null;
  folders: FolderItem[];
  tasks: TaskItem[];
  tasksLoading?: boolean;
  tasksError?: string;
  onRestoreFolder?: (folderId: string) => Promise<void> | void;
}) {
  const { open, onClose, className, folder, folders, tasks, tasksLoading, tasksError, onRestoreFolder } = props;
  const [search, setSearch] = useState('');

  const folderById = useMemo(() => {
    const map = new Map<string, FolderItem>();
    for (const f of folders || []) {
      if (!f) continue;
      map.set(String(f.id), f);
    }
    return map;
  }, [folders]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, FolderItem[]>();
    for (const f of folders || []) {
      if (!f) continue;
      const pid = f.parentId ? String(f.parentId) : '';
      if (!pid) continue;
      const arr = map.get(pid) || [];
      arr.push(f);
      map.set(pid, arr);
    }
    for (const [pid, arr] of map.entries()) {
      arr.sort((a, b) => {
        const oa = Number.isFinite(Number(a.order)) ? Number(a.order) : 0;
        const ob = Number.isFinite(Number(b.order)) ? Number(b.order) : 0;
        if (oa !== ob) return oa - ob;
        return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
      });
      map.set(pid, arr);
    }
    return map;
  }, [folders]);

  const getFolderPath = (folderId: string) => {
    const fid = String(folderId || '').trim();
    if (!fid) return '';
    const path: string[] = [];
    let cur = folderById.get(fid);
    while (cur) {
      path.push(String(cur.name || ''));
      if (!cur.parentId) break;
      cur = folderById.get(String(cur.parentId));
    }
    path.reverse();
    return path.join(' / ');
  };

  const descendantIds = useMemo(() => {
    const rootId = folder?.id ? String(folder.id) : '';
    if (!rootId) return new Set<string>();
    const ids = new Set<string>();
    const queue: string[] = [rootId];
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id || ids.has(id)) continue;
      ids.add(id);
      for (const child of (childrenByParent.get(id) || [])) {
        queue.push(String(child.id));
      }
    }
    return ids;
  }, [childrenByParent, folder?.id]);

  const descendantFoldersFlat = useMemo(() => {
    const rootId = folder?.id ? String(folder.id) : '';
    if (!rootId) return [];
    const depthById = new Map<string, number>();
    const ordered: FolderItem[] = [];
    const visit = (id: string, depth: number) => {
      depthById.set(id, depth);
      const cur = folderById.get(id);
      if (cur) ordered.push(cur);
      for (const child of (childrenByParent.get(id) || [])) {
        visit(String(child.id), depth + 1);
      }
    };
    visit(rootId, 0);
    return ordered.map((f) => ({ ...f, __depth: depthById.get(String(f.id)) || 0 } as any));
  }, [childrenByParent, folder?.id, folderById]);

  const tasksInFolder = useMemo(() => {
    if (!folder?.id) return [];
    const q = String(search || '').trim().toLowerCase();
    return (tasks || [])
      .filter((t) => t && t.classFolderId && descendantIds.has(String(t.classFolderId)))
      .filter((t) => {
        if (!q) return true;
        const hay = `${t.title || ''} ${t.subject || ''} ${t.teacherName || ''} ${t.type || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice()
      .sort((a, b) => {
        const sa = String(a.subject || '');
        const sb = String(b.subject || '');
        const c = sa.localeCompare(sb, 'zh-Hant');
        if (c !== 0) return c;
        const ta = new Date(a.createdAt || 0).getTime();
        const tb = new Date(b.createdAt || 0).getTime();
        return tb - ta;
      });
  }, [descendantIds, folder?.id, search, tasks]);

  if (!open) return null;

  const rootPath = folder?.id ? getFolderPath(String(folder.id)) : '';

  return (
    <div className="fixed inset-0 bg-black/40 z-[80] flex items-center justify-center p-4">
      <div className="w-full max-w-6xl bg-white rounded-3xl border-4 border-brand-brown shadow-comic overflow-hidden">
        <div className="bg-[#A1D9AE] border-b-4 border-brand-brown px-5 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-2xl font-black text-brand-brown truncate">封存資料夾詳情</div>
            <div className="text-sm font-bold text-brand-brown/80 truncate">
              班別：{className}{folder?.name ? `｜${labelForFolderLevel(folder.level)}：${String(folder.name)}` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-brand-brown" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold text-gray-600">路徑</div>
              <div className="font-black text-brand-brown break-words">{rootPath || '（未有路徑）'}</div>
              {folder?.archivedAt && (
                <div className="text-xs font-bold text-gray-500 mt-1">封存時間：{String(folder.archivedAt)}</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {onRestoreFolder && folder?.id && (
                <Button
                  className="bg-[#B5D8F8] hover:bg-[#A1CCF0] flex items-center gap-2"
                  onClick={() => void onRestoreFolder(String(folder.id))}
                >
                  <ArchiveRestore className="w-4 h-4" />
                  復原此資料夾
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 border-2 border-gray-200 rounded-2xl p-3 bg-gray-50">
              <div className="flex items-center gap-2 mb-2">
                <Folder className="w-5 h-5 text-brand-brown" />
                <div className="font-black text-brand-brown">資料夾層級（包含子層）</div>
                <div className="ml-auto text-xs font-bold text-gray-600">{descendantIds.size} 個</div>
              </div>
              <div className="max-h-[55vh] overflow-auto space-y-1 pr-1">
                {descendantFoldersFlat.map((f: any) => {
                  const depth = Number(f.__depth) || 0;
                  const isArchived = !!f.archivedAt;
                  return (
                    <div
                      key={String(f.id)}
                      className="flex items-center gap-2 px-2 py-1 rounded-xl bg-white border border-gray-200"
                      style={{ marginLeft: depth * 12 }}
                    >
                      <Folder className="w-4 h-4 text-brand-brown shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold text-gray-800 truncate">
                          {labelForFolderLevel(f.level)}：{String(f.name || '')}
                        </div>
                        {isArchived && (
                          <div className="text-[11px] font-bold text-gray-500">封存：{String(f.archivedAt || '')}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-3 border-2 border-gray-200 rounded-2xl p-3">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-brand-brown" />
                <div className="font-black text-brand-brown">此資料夾內任務</div>
                <div className="text-xs font-bold text-gray-600">共 {tasksInFolder.length} 個</div>
                <div className="ml-auto flex items-center gap-2">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="搜尋任務標題/科目/教師..."
                    className="px-3 py-2 rounded-xl border-2 border-gray-300 font-bold w-64 max-w-full"
                  />
                </div>
              </div>

              {tasksLoading && (
                <div className="text-gray-600 font-bold">載入任務中…</div>
              )}
              {!tasksLoading && tasksError && (
                <div className="text-red-700 font-bold">{tasksError}</div>
              )}
              {!tasksLoading && !tasksError && tasksInFolder.length === 0 && (
                <div className="text-gray-600 font-bold">此資料夾目前沒有任務</div>
              )}

              {!tasksLoading && !tasksError && tasksInFolder.length > 0 && (
                <div className="max-h-[55vh] overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left py-2 pr-2 font-black text-brand-brown">科目</th>
                        <th className="text-left py-2 pr-2 font-black text-brand-brown">類型</th>
                        <th className="text-left py-2 pr-2 font-black text-brand-brown">標題</th>
                        <th className="text-left py-2 pr-2 font-black text-brand-brown">資料夾</th>
                        <th className="text-left py-2 pr-2 font-black text-brand-brown">狀態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasksInFolder.map((t) => {
                        const taskArchived = !!t.archivedAt || t.isActive === false;
                        const folderPath = t.classFolderId ? getFolderPath(String(t.classFolderId)) : '';
                        return (
                          <tr key={`${t.type}:${t.id}`} className="border-b border-gray-100">
                            <td className="py-2 pr-2 font-bold">{String(t.subject || '')}</td>
                            <td className="py-2 pr-2 font-bold">{labelForTaskType(t.type)}</td>
                            <td className="py-2 pr-2 font-black text-gray-800 break-words">{String(t.title || '')}</td>
                            <td className="py-2 pr-2 text-xs font-bold text-gray-600 break-words">{folderPath}</td>
                            <td className="py-2 pr-2">
                              <span className={`px-2 py-1 rounded-lg text-xs font-black ${taskArchived ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-800'}`}>
                                {taskArchived ? '已封存' : '使用中'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

