import React from 'react';
import { ArchiveRestore, Eye, Trash2 } from 'lucide-react';
import Button from '../../Button';

export default function AdminFoldersPanel(props: {
  folderClassName: string;
  classOptions: string[];
  folderLoading: boolean;
  folderError: string;
  archivedFolders: any[];
  onClassChange: (v: string) => void;
  onLoad: () => void;
  getFolderPath: (folderId: string) => string;
  onView: (folder: any) => void;
  onRestore: (folder: any) => void;
  onHardDelete?: (folder: any) => void;
}) {
  const { folderClassName, classOptions, folderLoading, folderError, archivedFolders, onClassChange, onLoad, getFolderPath, onView, onRestore, onHardDelete } = props;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="text-lg font-black text-brand-brown">班級資料夾（封存）</div>
          <div className="text-sm text-gray-600 font-bold mt-1">可查看封存資料夾詳細內容並復原。</div>
        </div>
        <div className="flex items-center gap-3">
          <label className="font-bold text-gray-700">班別</label>
          <select
            className="px-4 py-2 border border-gray-300 rounded-xl bg-white font-bold"
            value={folderClassName}
            onChange={(e) => onClassChange(e.target.value)}
            disabled={classOptions.length === 0}
          >
            {classOptions.length === 0 ? (
              <option value="">（未有班別）</option>
            ) : (
              classOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))
            )}
          </select>
          <Button
            className="bg-[#E8F5E9] hover:bg-[#C8E6C9] flex items-center gap-2"
            onClick={onLoad}
            disabled={!folderClassName || folderLoading}
          >
            <ArchiveRestore className="w-4 h-4" />
            {folderLoading ? '載入中...' : '載入'}
          </Button>
        </div>
      </div>

      {folderError && <div className="mb-3 text-red-700 font-bold">{folderError}</div>}

      {archivedFolders.length === 0 ? (
        <div className="text-gray-600 font-bold">目前沒有封存資料夾</div>
      ) : (
        <div className="space-y-2">
          {archivedFolders
            .slice()
            .sort((a, b) => {
              const la = Number(a.level) || 0;
              const lb = Number(b.level) || 0;
              if (la !== lb) return la - lb;
              return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
            })
            .map((f: any) => {
              const level = Number(f.level);
              const label = level === 1 ? '學段' : level === 2 ? '課題' : level === 3 ? '子folder' : '資料夾';
              const path = getFolderPath(String(f.id));
              return (
                <div key={String(f.id)} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border border-gray-200 bg-gray-50">
                  <div className="min-w-0">
                    <div className="font-black text-gray-900">{label}：{String(f.name || '')}</div>
                    <div className="text-xs text-gray-600 font-bold break-words">路徑：{path || String(f.name || '')}</div>
                    <div className="text-xs text-gray-500 font-bold">封存時間：{String(f.archivedAt || '')}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      className="bg-white hover:bg-gray-100 flex items-center gap-2 border border-gray-300 text-gray-800"
                      onClick={() => onView(f)}
                      disabled={folderLoading}
                    >
                      <Eye className="w-4 h-4" />
                      查看
                    </Button>
                    <Button
                      className="bg-[#B5D8F8] hover:bg-[#A1CCF0] flex items-center gap-2"
                      onClick={() => onRestore(f)}
                      disabled={folderLoading || !folderClassName}
                    >
                      <ArchiveRestore className="w-4 h-4" />
                      復原
                    </Button>
                    {onHardDelete && (
                      <Button
                        className="bg-[#F8B5B5] hover:bg-[#F29E9E] flex items-center gap-2 text-[#5C2A2A]"
                        onClick={() => onHardDelete(f)}
                        disabled={folderLoading}
                      >
                        <Trash2 className="w-4 h-4" />
                        永久刪除
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
