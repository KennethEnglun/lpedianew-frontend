import React, { useEffect, useMemo, useState } from 'react';
import { FolderPlus, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { VISIBLE_SUBJECTS } from '../platform';

type Props = {
  authService: any;
  availableClasses: string[];
};

const splitLines = (raw: string) => raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

export default function StudentFolderManagerPanel(props: Props) {
  const { authService, availableClasses } = props;
  const [subject, setSubject] = useState('');
  const [className, setClassName] = useState('');
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stageId, setStageId] = useState('');

  const stageFolders = useMemo(() => folders.filter((f) => f && f.level === 1), [folders]);
  const topicFolders = useMemo(
    () => folders.filter((f) => f && f.level === 2 && String(f.parentId || '') === String(stageId || '')),
    [folders, stageId]
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

  const [newTopicText, setNewTopicText] = useState('');
  const [newSubByTopicId, setNewSubByTopicId] = useState<Record<string, string>>({});

  const load = async (cls: string, opts?: { keepStage?: boolean }) => {
    const c = String(cls || '').trim();
    if (!c) return;
    setLoading(true);
    setError('');
    try {
      const resp = await authService.getClassFolders(c);
      const list = Array.isArray(resp.folders) ? resp.folders : [];
      setFolders(list);
      setClassName(c);
      if (!opts?.keepStage) {
        const firstStage = list.find((f: any) => f && f.level === 1) || null;
        setStageId(firstStage ? String(firstStage.id) : '');
      } else if (stageId && !list.some((f: any) => f && String(f.id) === String(stageId))) {
        const firstStage = list.find((f: any) => f && f.level === 1) || null;
        setStageId(firstStage ? String(firstStage.id) : '');
      }
    } catch (e: any) {
      setError(e?.message || '載入失敗');
      setFolders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSubject('');
    setClassName('');
    setFolders([]);
    setStageId('');
    setError('');
    setNewTopicText('');
    setNewSubByTopicId({});
  }, []);

  if (!subject) {
    return (
      <div className="space-y-3">
        <div className="text-lg font-black text-gray-700">學生</div>
        <div className="text-sm text-gray-600 font-bold">科目 → 班別 → 學段 → 課題（可管理）</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {VISIBLE_SUBJECTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSubject(s)}
              className="text-left bg-white border-4 border-brand-brown rounded-3xl p-4 shadow-comic hover:-translate-y-1 transition-transform"
            >
              <div className="font-black text-brand-brown">{s}</div>
              <div className="text-xs text-gray-600 font-bold">進入</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!className) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-lg font-black text-gray-700">學生</div>
            <div className="text-sm text-gray-600 font-bold">科目：{subject}</div>
          </div>
          <button
            type="button"
            className="px-3 py-2 rounded-xl bg-white border-2 border-gray-300 hover:border-blue-500 font-black text-gray-700"
            onClick={() => setSubject('')}
          >
            ← 返回科目
          </button>
        </div>
        <div className="text-lg font-black text-brand-brown">班別</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {availableClasses.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => void load(c)}
              className="text-left bg-white border-4 border-brand-brown rounded-3xl p-4 shadow-comic hover:-translate-y-1 transition-transform"
            >
              <div className="font-black text-brand-brown">{c}</div>
              <div className="text-xs text-gray-600 font-bold">進入</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-lg font-black text-gray-700">學生</div>
          <div className="text-sm text-gray-600 font-bold">科目：{subject} ｜ 班別：{className}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-2 rounded-xl bg-white border-2 border-gray-300 hover:border-blue-500 font-black text-gray-700"
            onClick={() => setClassName('')}
            disabled={loading}
          >
            ← 返回班別
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-xl bg-white border-2 border-gray-300 hover:border-blue-500 font-black text-gray-700 flex items-center gap-2"
            onClick={() => void load(className, { keepStage: true })}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            重新載入
          </button>
        </div>
      </div>

      {error ? <div className="text-red-700 font-bold">{error}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border-2 border-gray-200 bg-gray-50">
          <div className="font-black text-gray-700 mb-2">學段</div>
          <div className="space-y-2">
            {stageFolders.map((s: any) => (
              <div key={String(s.id)} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStageId(String(s.id))}
                  className={`flex-1 px-3 py-2 rounded-xl border-2 font-bold text-left ${
                    String(s.id) === String(stageId) ? 'bg-blue-500 text-white border-blue-600' : 'bg-white border-gray-300 hover:border-blue-500'
                  }`}
                >
                  {String(s.name || '')}
                </button>
                <button
                  type="button"
                  title="改名"
                  className="px-2 py-2 rounded-xl bg-white border-2 border-gray-300 hover:border-blue-500 text-blue-700 disabled:opacity-60"
                  disabled={loading}
                  onClick={async () => {
                    const next = prompt('改名（學段）', String(s.name || ''));
                    const name = String(next || '').trim();
                    if (!name || name === String(s.name || '')) return;
                    setLoading(true);
                    setError('');
                    try {
                      await authService.updateClassFolder(className, String(s.id), { name });
                      await load(className, { keepStage: true });
                    } catch (e: any) {
                      setError(e?.message || '改名失敗');
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            ))}
            {stageFolders.length === 0 ? <div className="text-gray-500 font-bold">（未有學段）</div> : null}
          </div>
        </div>

        <div className="md:col-span-2 p-4 rounded-2xl border-2 border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="font-black text-gray-700">課題</div>
            <div className="text-xs text-gray-600 font-bold">學段：{stageFolders.find((s: any) => String(s.id) === String(stageId))?.name || '—'}</div>
          </div>

          <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <FolderPlus className="w-4 h-4 text-green-700" />
              <div className="font-black text-gray-700">新增課題（可多行）</div>
            </div>
            <textarea
              className="w-full min-h-[70px] px-3 py-2 rounded-xl border-2 border-gray-300 font-bold"
              placeholder="輸入課題名稱（可多行）"
              value={newTopicText}
              onChange={(e) => setNewTopicText(e.target.value)}
              disabled={loading || !stageId}
            />
            <div className="flex justify-end pt-2">
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-green-600 text-white font-black border-2 border-green-700 hover:bg-green-700 disabled:opacity-60"
                disabled={loading || !stageId}
                onClick={async () => {
                  const lines = splitLines(newTopicText);
                  if (lines.length === 0) return;
                  setLoading(true);
                  setError('');
                  try {
                    if (lines.length === 1) {
                      await authService.createClassFolder(className, { parentId: stageId, level: 2, name: lines[0] });
                    } else {
                      await authService.batchCreateClassFolders(className, { parentId: stageId, level: 2, names: lines });
                    }
                    setNewTopicText('');
                    await load(className, { keepStage: true });
                  } catch (e: any) {
                    setError(e?.message || '新增失敗');
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                新增
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {topicFolders.map((t: any) => (
              <div key={String(t.id)} className="border-2 border-gray-200 rounded-2xl p-3 bg-gray-50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-black text-brand-brown">{String(t.name || '')}</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="px-3 py-1 rounded-xl border-2 border-gray-300 bg-white text-blue-700 font-black hover:border-blue-500 disabled:opacity-60"
                      disabled={loading}
                      onClick={async () => {
                        const next = prompt('改名（課題）', String(t.name || ''));
                        const name = String(next || '').trim();
                        if (!name || name === String(t.name || '')) return;
                        setLoading(true);
                        setError('');
                        try {
                          await authService.updateClassFolder(className, String(t.id), { name });
                          await load(className, { keepStage: true });
                        } catch (e: any) {
                          setError(e?.message || '改名失敗');
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                      改名
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1 rounded-xl border-2 border-red-300 bg-red-100 text-red-700 font-black hover:bg-red-200 disabled:opacity-60"
                      disabled={loading}
                      onClick={async () => {
                        if (!confirm('確定要封存此課題及其子folder嗎？')) return;
                        setLoading(true);
                        setError('');
                        try {
                          await authService.archiveClassFolder(className, String(t.id));
                          await load(className, { keepStage: true });
                        } catch (e: any) {
                          setError(e?.message || '刪除失敗');
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                      刪除
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-sm font-black text-gray-700 mb-2">子folder（可選）</div>
                  <div className="flex flex-col md:flex-row gap-2">
                    <textarea
                      className="flex-1 min-h-[52px] px-3 py-2 rounded-xl border-2 border-gray-300 font-bold"
                      placeholder="輸入子folder（可多行：用 \\n 分隔）"
                      value={newSubByTopicId[String(t.id)] || ''}
                      onChange={(e) => setNewSubByTopicId((prev) => ({ ...prev, [String(t.id)]: e.target.value }))}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl bg-green-600 text-white font-black border-2 border-green-700 hover:bg-green-700 disabled:opacity-60"
                      disabled={loading}
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
                          await load(className, { keepStage: true });
                        } catch (e: any) {
                          setError(e?.message || '新增失敗');
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      新增
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {(subfoldersByTopicId.get(String(t.id)) || []).map((sf: any) => (
                      <div key={String(sf.id)} className="px-3 py-1 rounded-xl border-2 border-gray-200 bg-white flex items-center gap-2">
                        <span className="font-bold text-gray-700">{String(sf.name || '')}</span>
                        <button
                          type="button"
                          title="改名"
                          className="text-blue-700 hover:text-blue-900 disabled:opacity-60"
                          disabled={loading}
                          onClick={async () => {
                            const next = prompt('改名（子folder）', String(sf.name || ''));
                            const name = String(next || '').trim();
                            if (!name || name === String(sf.name || '')) return;
                            setLoading(true);
                            setError('');
                            try {
                              await authService.updateClassFolder(className, String(sf.id), { name });
                              await load(className, { keepStage: true });
                            } catch (e: any) {
                              setError(e?.message || '改名失敗');
                            } finally {
                              setLoading(false);
                            }
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="封存"
                          className="text-red-700 hover:text-red-900 disabled:opacity-60"
                          disabled={loading}
                          onClick={async () => {
                            if (!confirm('確定要封存此子folder嗎？')) return;
                            setLoading(true);
                            setError('');
                            try {
                              await authService.archiveClassFolder(className, String(sf.id));
                              await load(className, { keepStage: true });
                            } catch (e: any) {
                              setError(e?.message || '刪除失敗');
                            } finally {
                              setLoading(false);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {(subfoldersByTopicId.get(String(t.id)) || []).length === 0 ? (
                      <div className="text-gray-500 font-bold">（未有子folder）</div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {topicFolders.length === 0 ? <div className="text-gray-500 font-bold">此學段未有課題</div> : null}
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-600 font-bold">
        注意：此處「刪除」會封存資料夾（不會影響已派送作業的紀錄）。
      </div>
    </div>
  );
}

