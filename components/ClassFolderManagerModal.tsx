import React, { useEffect, useMemo, useState } from 'react';
import { X, FolderPlus, Trash2, Pencil, RefreshCw } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  authService: any;
  availableClasses: string[];
};

const splitLines = (raw: string) => raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

const ClassFolderManagerModal: React.FC<Props> = ({ open, onClose, authService, availableClasses }) => {
  const [className, setClassName] = useState('');
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [newTopicText, setNewTopicText] = useState('');

  const stageFolders = useMemo(() => folders.filter((f) => f && f.level === 1), [folders]);
  const topicFolders = useMemo(
    () => folders.filter((f) => f && f.level === 2 && String(f.parentId || '') === String(selectedStageId || '')),
    [folders, selectedStageId]
  );
  const subfoldersByTopicId = useMemo(() => {
    const map = new Map<string, any[]>();
    folders
      .filter((f) => f && f.level === 3 && f.parentId)
      .forEach((f) => {
        const pid = String(f.parentId);
        if (!map.has(pid)) map.set(pid, []);
        map.get(pid)!.push(f);
      });
    return map;
  }, [folders]);

  const [newSubByTopicId, setNewSubByTopicId] = useState<Record<string, string>>({});

  const load = async (cls: string) => {
    const c = String(cls || '').trim();
    if (!c) return;
    setLoading(true);
    setError('');
    try {
      const resp = await authService.getClassFolders(c);
      const list = Array.isArray(resp.folders) ? resp.folders : [];
      setFolders(list);
      setClassName(c);
      if (!selectedStageId) {
        const firstStage = list.find((f: any) => f && f.level === 1);
        setSelectedStageId(firstStage ? String(firstStage.id) : '');
      }
    } catch (e: any) {
      setError(e?.message || '載入失敗');
      setFolders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (!className && availableClasses.length > 0) {
      void load(availableClasses[0]);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-comic">
        <div className="p-6 border-b-4 border-brand-brown bg-[#C0E2BE] flex items-center justify-between">
          <div>
            <div className="text-2xl font-black text-brand-brown">班級資料夾管理</div>
            <div className="text-sm text-brand-brown/80 font-bold">學段固定；可建課題與子folder</div>
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
            <label className="font-bold text-gray-700">班別</label>
            <select
              className="px-3 py-2 rounded-xl border-2 border-gray-300 font-bold"
              value={className}
              onChange={(e) => void load(e.target.value)}
            >
              {availableClasses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              onClick={() => void load(className)}
              className="px-3 py-2 rounded-xl border-2 border-gray-300 font-bold hover:border-blue-500 flex items-center gap-2"
              disabled={!className || loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              重新載入
            </button>
            {error && <span className="text-red-600 font-bold">{error}</span>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl border-2 border-gray-200 bg-gray-50">
              <div className="font-black text-gray-700 mb-3">學段</div>
              <div className="space-y-2">
                {stageFolders.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStageId(String(s.id))}
                    className={`w-full px-3 py-2 rounded-xl border-2 font-bold text-left ${
                      String(s.id) === String(selectedStageId) ? 'bg-blue-500 text-white border-blue-600' : 'bg-white border-gray-300 hover:border-blue-500'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
                {stageFolders.length === 0 && <div className="text-gray-500 font-bold">未有學段資料</div>}
              </div>
            </div>

            <div className="p-4 rounded-2xl border-2 border-gray-200 bg-gray-50 md:col-span-2">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="font-black text-gray-700">課題</div>
                <div className="text-sm text-gray-600 font-bold">可貼上多行批次新增</div>
              </div>

              <div className="flex gap-2 mb-4">
                <textarea
                  className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-300 font-bold"
                  rows={2}
                  placeholder="輸入課題名稱（可多行）"
                  value={newTopicText}
                  onChange={(e) => setNewTopicText(e.target.value)}
                />
                <button
                  onClick={async () => {
                    if (!className || !selectedStageId) return;
                    const lines = splitLines(newTopicText);
                    if (lines.length === 0) return;
                    setLoading(true);
                    setError('');
                    try {
                      if (lines.length === 1) {
                        await authService.createClassFolder(className, { parentId: selectedStageId, level: 2, name: lines[0] });
                      } else {
                        await authService.batchCreateClassFolders(className, { parentId: selectedStageId, level: 2, names: lines });
                      }
                      setNewTopicText('');
                      await load(className);
                    } catch (e: any) {
                      setError(e?.message || '新增失敗');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-green-600 text-white font-black border-2 border-green-700 hover:bg-green-700 flex items-center gap-2"
                  disabled={!className || !selectedStageId || loading}
                >
                  <FolderPlus className="w-4 h-4" />
                  新增
                </button>
              </div>

              <div className="space-y-3">
                {topicFolders.map((t) => (
                  <div key={t.id} className="p-3 rounded-2xl border-2 border-gray-200 bg-white">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-black text-gray-800">{t.name}</div>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            const next = prompt('改名', String(t.name || ''));
                            if (!next || !next.trim()) return;
                            setLoading(true);
                            setError('');
                            try {
                              await authService.updateClassFolder(className, String(t.id), { name: next.trim() });
                              await load(className);
                            } catch (e: any) {
                              setError(e?.message || '改名失敗');
                            } finally {
                              setLoading(false);
                            }
                          }}
                          className="px-3 py-1 rounded-xl bg-blue-100 text-blue-700 font-bold hover:bg-blue-200 flex items-center gap-1"
                          title="改名"
                        >
                          <Pencil className="w-4 h-4" />
                          改名
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm('確定要封存此課題及其子folder嗎？')) return;
                            setLoading(true);
                            setError('');
                            try {
                              await authService.archiveClassFolder(className, String(t.id));
                              await load(className);
                            } catch (e: any) {
                              setError(e?.message || '刪除失敗');
                            } finally {
                              setLoading(false);
                            }
                          }}
                          className="px-3 py-1 rounded-xl bg-red-100 text-red-700 font-bold hover:bg-red-200 flex items-center gap-1"
                          title="封存"
                        >
                          <Trash2 className="w-4 h-4" />
                          封存
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 pl-3 border-l-4 border-gray-200">
                      <div className="text-sm font-black text-gray-700 mb-2">子folder（可選）</div>
                      <div className="flex gap-2 mb-2">
                        <input
                          className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-300 font-bold"
                          placeholder="輸入子folder（可多行：用 \\n 分隔）"
                          value={newSubByTopicId[String(t.id)] || ''}
                          onChange={(e) => setNewSubByTopicId((prev) => ({ ...prev, [String(t.id)]: e.target.value }))}
                        />
                        <button
                          onClick={async () => {
                            const raw = newSubByTopicId[String(t.id)] || '';
                            const lines = splitLines(raw);
                            if (lines.length === 0) return;
                            setLoading(true);
                            setError('');
                            try {
                              if (lines.length === 1) {
                                await authService.createClassFolder(className, { parentId: String(t.id), level: 3, name: lines[0] });
                              } else {
                                await authService.batchCreateClassFolders(className, { parentId: String(t.id), level: 3, names: lines });
                              }
                              setNewSubByTopicId((prev) => ({ ...prev, [String(t.id)]: '' }));
                              await load(className);
                            } catch (e: any) {
                              setError(e?.message || '新增失敗');
                            } finally {
                              setLoading(false);
                            }
                          }}
                          className="px-4 py-2 rounded-xl bg-green-600 text-white font-black border-2 border-green-700 hover:bg-green-700"
                          disabled={loading}
                        >
                          新增
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {(subfoldersByTopicId.get(String(t.id)) || []).map((sf) => (
                          <div key={sf.id} className="px-3 py-1 rounded-xl border-2 border-gray-200 bg-gray-50 flex items-center gap-2">
                            <span className="font-bold text-gray-700">{sf.name}</span>
                            <button
                              onClick={async () => {
                                const next = prompt('改名', String(sf.name || ''));
                                if (!next || !next.trim()) return;
                                setLoading(true);
                                setError('');
                                try {
                                  await authService.updateClassFolder(className, String(sf.id), { name: next.trim() });
                                  await load(className);
                                } catch (e: any) {
                                  setError(e?.message || '改名失敗');
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              className="text-blue-700 hover:text-blue-900"
                              title="改名"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm('確定要封存此子folder嗎？')) return;
                                setLoading(true);
                                setError('');
                                try {
                                  await authService.archiveClassFolder(className, String(sf.id));
                                  await load(className);
                                } catch (e: any) {
                                  setError(e?.message || '刪除失敗');
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              className="text-red-700 hover:text-red-900"
                              title="封存"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        {(subfoldersByTopicId.get(String(t.id)) || []).length === 0 && (
                          <div className="text-gray-500 font-bold">（未有子folder）</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {topicFolders.length === 0 && <div className="text-gray-500 font-bold">此學段未有課題</div>}
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-600 font-bold">
            注意：此處「封存」只會隱藏資料夾（不會影響已派送作業的紀錄）。學生端只可隱藏/顯示，不能建立/刪除/移動。
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassFolderManagerModal;
