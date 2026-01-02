import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  authService: any;
  availableGrades: string[];
  initial?: { scope?: 'my' | 'shared'; grade?: string; folderId?: string | null };
  allowShared?: boolean;
  readOnly?: boolean;
  onPicked: (picked: { scope: 'my' | 'shared'; grade: string; folderId: string | null }) => void;
};

const TeacherFolderPickerModal: React.FC<Props> = ({ open, onClose, authService, availableGrades, initial, allowShared, readOnly, onPicked }) => {
  const [scope, setScope] = useState<'my' | 'shared'>(initial?.scope === 'shared' ? 'shared' : 'my');
  const [grade, setGrade] = useState(initial?.grade || '');
  const [folders, setFolders] = useState<any[]>([]);
  const [folderId, setFolderId] = useState<string | null>(initial?.folderId ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const g = initial?.grade || availableGrades[0] || '';
    setGrade(g);
    setScope(initial?.scope === 'shared' ? 'shared' : 'my');
    setFolderId(initial?.folderId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

  useEffect(() => {
    if (!open) return;
    if (!grade) return;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const list = await loadFolders(scope, grade);
        setFolders(list);
      } catch (e: any) {
        setError(e?.message || '載入資料夾失敗');
        setFolders([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, scope, grade]);

  if (!open) return null;

  const scopes: { key: 'my' | 'shared'; label: string }[] = [
    { key: 'my', label: '私人' },
    ...(allowShared ? [{ key: 'shared' as const, label: '共用' }] : [])
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[90] flex items-center justify-center p-4">
      <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-comic">
        <div className="p-6 border-b-4 border-brand-brown bg-[#C0E2BE] flex items-center justify-between">
          <div>
            <div className="text-2xl font-black text-brand-brown">選擇教師資料夾位置</div>
            <div className="text-sm text-brand-brown/80 font-bold">年級 → 私人/共用 → folder（可留空=未分類）</div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
          >
            <X className="w-6 h-6 text-brand-brown" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            {scopes.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setScope(s.key)}
                disabled={readOnly}
                className={`px-4 py-2 rounded-2xl border-4 font-black shadow-comic ${scope === s.key ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown' : 'bg-white border-brand-brown text-brand-brown hover:bg-gray-50'} ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
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
              disabled={readOnly}
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
            {loading ? (
              <div className="text-brand-brown font-bold">載入中...</div>
            ) : (
              <select
                className="w-full px-3 py-2 rounded-xl border-2 border-gray-300 font-bold bg-white"
                value={folderId || ''}
                onChange={(e) => setFolderId(e.target.value ? e.target.value : null)}
                disabled={readOnly}
              >
                <option value="">（未分類）</option>
                {folderTree.map((row) => (
                  <option key={row.folder.id} value={row.folder.id}>
                    {'　'.repeat(row.depth)}{row.folder.name}
                  </option>
                ))}
              </select>
            )}
            {error && <div className="text-red-600 font-bold mt-2">{error}</div>}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white border-2 border-gray-300 font-black text-gray-700 hover:border-blue-500"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                if (!grade) return;
                onPicked({ scope, grade, folderId });
              }}
              disabled={!grade || readOnly}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white font-black border-2 border-blue-700 hover:bg-blue-700 disabled:opacity-60"
            >
              確定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherFolderPickerModal;

