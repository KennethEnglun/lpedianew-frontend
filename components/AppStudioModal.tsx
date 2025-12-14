import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Code2, Copy, Folder, Globe, Loader2, Plus, Save, Send, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Button from './Button';
import Input from './Input';
import { authService } from '../services/authService';

type StudioApp = {
  id: string;
  ownerId: string;
  ownerRole: string;
  title: string;
  visibility: 'private' | 'public';
  latestVersionId?: string | null;
  updatedAt?: string;
};

const AppStudioModal: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

  const [tab, setTab] = useState<'my' | 'public'>('my');
  const [search, setSearch] = useState('');
  const [apps, setApps] = useState<StudioApp[]>([]);
  const [publicApps, setPublicApps] = useState<StudioApp[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [appsError, setAppsError] = useState('');

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [loadingVersion, setLoadingVersion] = useState(false);
  const [versionError, setVersionError] = useState('');

  const [prompt, setPrompt] = useState('');
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  const [previewKey, setPreviewKey] = useState(0);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const selectedApp: StudioApp | null = useMemo(() => {
    const pool = tab === 'public' ? publicApps : apps;
    return pool.find((a) => a.id === selectedAppId) || null;
  }, [apps, publicApps, selectedAppId, tab]);

  const canEditSelected = Boolean(selectedApp && (selectedApp.ownerId === user?.id || user?.role === 'admin'));

  const loadLists = async () => {
    try {
      setLoadingApps(true);
      setAppsError('');
      const [mine, pub] = await Promise.all([
        authService.listAppStudioApps({ scope: 'my' }),
        authService.listAppStudioApps({ scope: 'public' })
      ]);
      setApps(Array.isArray(mine.apps) ? mine.apps : []);
      setPublicApps(Array.isArray(pub.apps) ? pub.apps : []);
    } catch (e) {
      setAppsError(e instanceof Error ? e.message : '載入失敗');
    } finally {
      setLoadingApps(false);
    }
  };

  const loadAppVersions = async (appId: string) => {
    try {
      setLoadingVersion(true);
      setVersionError('');
      const resp = await authService.listAppStudioVersions(appId);
      const list = Array.isArray(resp.versions) ? resp.versions : [];
      setVersions(list);
      const first = list[0]?.id ? String(list[0].id) : null;
      setSelectedVersionId(first);
      if (first) {
        const v = await authService.getAppStudioVersion(appId, first);
        setGeneratedHtml(String(v.version?.indexHtml || ''));
        setGeneratedTitle(String(v.version?.title || ''));
        setPreviewKey((k) => k + 1);
      }
    } catch (e) {
      setVersionError(e instanceof Error ? e.message : '載入失敗');
    } finally {
      setLoadingVersion(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setTab('my');
    setSearch('');
    setSelectedAppId(null);
    setVersions([]);
    setSelectedVersionId(null);
    setPrompt('');
    setGeneratedTitle('');
    setGeneratedHtml('');
    setGenerateError('');
    setSubmittedAt(null);
    loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const visibleApps = useMemo(() => {
    const pool = tab === 'public' ? publicApps : apps;
    const q = search.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter((a) => String(a.title || '').toLowerCase().includes(q));
  }, [apps, publicApps, search, tab]);

  const openApp = async (appId: string) => {
    setSelectedAppId(appId);
    setVersions([]);
    setSelectedVersionId(null);
    setSubmittedAt(null);
    await loadAppVersions(appId);
  };

  const createNewApp = async () => {
    const title = '新作品';
    const resp = await authService.createAppStudioApp({ title, visibility: 'private' });
    const app = resp.app;
    if (app?.id) {
      await loadLists();
      setTab('my');
      await openApp(String(app.id));
    }
  };

  const generate = async () => {
    const p = String(prompt || '').trim();
    if (!p) {
      setGenerateError('請輸入你想製作的小程式描述');
      return;
    }
    try {
      setGenerating(true);
      setGenerateError('');
      const resp = await authService.generateAppStudio({ prompt: p });
      setGeneratedTitle(String(resp.title || '小程式'));
      setGeneratedHtml(String(resp.indexHtml || ''));
      setPreviewKey((k) => k + 1);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : '生成失敗');
    } finally {
      setGenerating(false);
    }
  };

  const saveAsVersion = async () => {
    if (!selectedAppId) {
      await createNewApp();
      return;
    }
    if (!generatedHtml.trim()) return;
    const title = String(generatedTitle || selectedApp?.title || '版本').trim();
    const resp = await authService.createAppStudioVersion(selectedAppId, {
      title,
      prompt: String(prompt || '').trim(),
      indexHtml: generatedHtml
    });
    const v = resp.version;
    await loadLists();
    await loadAppVersions(selectedAppId);
    if (v?.id) setSelectedVersionId(String(v.id));
  };

  const fork = async () => {
    if (!selectedAppId) return;
    const resp = await authService.forkAppStudioApp(selectedAppId, selectedVersionId ? { versionId: selectedVersionId } : undefined);
    const app = resp.app;
    if (app?.id) {
      await loadLists();
      setTab('my');
      await openApp(String(app.id));
    }
  };

  const togglePublic = async () => {
    if (!selectedAppId || !selectedApp) return;
    if (!canEditSelected) return;
    const next = selectedApp.visibility === 'public' ? 'private' : 'public';
    await authService.updateAppStudioApp(selectedAppId, { visibility: next });
    await loadLists();
  };

  const submit = async () => {
    if (!selectedAppId) return;
    try {
      setSubmitting(true);
      const resp = await authService.submitAppStudio(selectedAppId, selectedVersionId ? { versionId: selectedVersionId } : undefined);
      setSubmittedAt(String(resp.submission?.createdAt || new Date().toISOString()));
    } catch (e) {
      setSubmittedAt(null);
      alert(e instanceof Error ? e.message : '提交失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = async () => {
    const text = String(generatedHtml || '');
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-7xl max-h-[92vh] overflow-hidden rounded-3xl border-4 border-brand-brown shadow-comic-xl flex flex-col">
        <div className="p-5 border-b-4 border-brand-brown bg-[#E8F5E9] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown flex items-center justify-center">
              <Code2 className="w-6 h-6 text-brand-brown" />
            </div>
            <div>
              <div className="text-2xl font-black text-brand-brown">小程式工作坊</div>
              <div className="text-xs text-gray-600 font-bold">用 AI 製作可運行的小程式（支援 jsDelivr / unpkg 外部庫）</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
            aria-label="關閉"
          >
            <X className="w-6 h-6 text-brand-brown" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex bg-gray-50">
          <aside className="w-80 border-r-2 border-gray-200 bg-white p-4 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={() => setTab('my')}
                className={`flex-1 px-3 py-2 rounded-xl border-2 font-black ${tab === 'my' ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown' : 'bg-white border-gray-200 text-gray-700'}`}
              >
                我的
              </button>
              <button
                type="button"
                onClick={() => setTab('public')}
                className={`flex-1 px-3 py-2 rounded-xl border-2 font-black ${tab === 'public' ? 'bg-[#D2EFFF] border-brand-brown text-brand-brown' : 'bg-white border-gray-200 text-gray-700'}`}
              >
                全站
              </button>
            </div>

            <div className="mb-3">
              <label className="block text-xs font-black text-gray-600 mb-1">搜尋</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜尋作品..."
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl"
              />
            </div>

            <div className="flex items-center gap-2 mb-3">
              <Button
                fullWidth
                className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                onClick={createNewApp}
              >
                <Plus className="w-4 h-4 mr-2" />
                新作品
              </Button>
            </div>

            {appsError && (
              <div className="mb-3 text-sm text-red-600 font-bold">{appsError}</div>
            )}
            {loadingApps ? (
              <div className="text-sm text-gray-500 font-bold flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> 載入中...
              </div>
            ) : (
              <div className="space-y-2">
                {visibleApps.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => openApp(a.id)}
                    className={`w-full text-left px-3 py-3 rounded-2xl border-2 font-black ${selectedAppId === a.id ? 'bg-[#FEF7EC] border-brand-brown' : 'bg-white border-gray-200 hover:border-brand-brown'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-brand-brown">{a.title || '作品'}</span>
                      {a.visibility === 'public' ? <Globe className="w-4 h-4 text-emerald-700" /> : <Folder className="w-4 h-4 text-gray-500" />}
                    </div>
                    <div className="text-xs text-gray-500 font-bold mt-1">
                      {a.updatedAt ? new Date(a.updatedAt).toLocaleString() : ''}
                    </div>
                  </button>
                ))}
                {visibleApps.length === 0 && (
                  <div className="text-sm text-gray-500 font-bold">沒有作品</div>
                )}
              </div>
            )}
          </aside>

          <div className="flex-1 min-h-0 flex flex-col">
            <div className="p-4 border-b-2 border-gray-200 bg-white flex flex-wrap items-center gap-2">
              <div className="font-black text-brand-brown flex-1">
                {selectedApp ? selectedApp.title : '未選擇作品'}
              </div>
              {selectedApp && (
                <>
                  <Button
                    className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                    onClick={() => setPreviewKey((k) => k + 1)}
                  >
                    重新執行
                  </Button>
                  <Button
                    className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                    onClick={copyCode}
                    disabled={!generatedHtml.trim()}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    複製程式
                  </Button>
                  <Button
                    className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                    onClick={fork}
                    disabled={!selectedAppId}
                  >
                    Fork
                  </Button>
                  {canEditSelected && (
                    <Button
                      className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                      onClick={togglePublic}
                    >
                      {selectedApp.visibility === 'public' ? '設為私人' : '設為公開'}
                    </Button>
                  )}
                  <Button
                    className="bg-emerald-500 hover:bg-emerald-600 text-white"
                    onClick={submit}
                    disabled={submitting || !selectedAppId}
                  >
                    <Send className={`w-4 h-4 mr-2 ${submitting ? 'animate-pulse' : ''}`} />
                    提交
                  </Button>
                </>
              )}
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
              <div className="min-h-0 flex flex-col bg-white border-2 border-gray-200 rounded-2xl overflow-hidden">
                <div className="p-3 border-b-2 border-gray-200 bg-gray-50 flex items-center gap-2">
                  <div className="font-black text-gray-700">需求描述</div>
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                      onClick={generate}
                      disabled={generating}
                    >
                      {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      生成
                    </Button>
                    <Button
                      className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                      onClick={saveAsVersion}
                      disabled={!generatedHtml.trim()}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      儲存版本
                    </Button>
                  </div>
                </div>
                <div className="p-3 flex flex-col gap-2 min-h-0">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="例如：做一個可以輸入英文單字、按下開始後每 5 秒顯示一個提示的練習小工具..."
                    className="w-full h-36 resize-none px-3 py-2 border-2 border-gray-300 rounded-xl font-bold"
                  />
                  {generateError && <div className="text-sm text-red-600 font-bold">{generateError}</div>}
                  {versionError && <div className="text-sm text-red-600 font-bold">{versionError}</div>}
                  {submittedAt && <div className="text-sm text-emerald-700 font-black">已提交：{new Date(submittedAt).toLocaleString()}</div>}

                  <div className="mt-2 flex-1 min-h-0">
                    <label className="block text-xs font-black text-gray-600 mb-1">版本</label>
                    <select
                      value={selectedVersionId || ''}
                      onChange={async (e) => {
                        const id = e.target.value;
                        if (!selectedAppId || !id) return;
                        setSelectedVersionId(id);
                        try {
                          setLoadingVersion(true);
                          const v = await authService.getAppStudioVersion(selectedAppId, id);
                          setGeneratedHtml(String(v.version?.indexHtml || ''));
                          setGeneratedTitle(String(v.version?.title || ''));
                          setPreviewKey((k) => k + 1);
                        } catch (err) {
                          setVersionError(err instanceof Error ? err.message : '載入失敗');
                        } finally {
                          setLoadingVersion(false);
                        }
                      }}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl bg-white font-bold"
                      disabled={!selectedAppId || loadingVersion}
                    >
                      <option value="">（未選擇）</option>
                      {versions.map((v) => (
                        <option key={String(v.id)} value={String(v.id)}>
                          {String(v.title || '版本')} • {v.createdAt ? new Date(v.createdAt).toLocaleString() : ''}
                        </option>
                      ))}
                    </select>
                    {loadingVersion && (
                      <div className="mt-2 text-sm text-gray-500 font-bold flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> 載入版本中...
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex flex-col bg-white border-2 border-gray-200 rounded-2xl overflow-hidden">
                <div className="p-3 border-b-2 border-gray-200 bg-gray-50 flex items-center gap-2">
                  <div className="font-black text-gray-700">預覽</div>
                  <div className="ml-auto text-xs text-gray-500 font-bold">
                    iframe sandbox
                  </div>
                </div>
                <div className="flex-1 min-h-0 bg-black/5">
                  {generatedHtml.trim() ? (
                    <iframe
                      key={previewKey}
                      ref={iframeRef}
                      title="app-preview"
                      sandbox="allow-scripts"
                      className="w-full h-full bg-white"
                      srcDoc={generatedHtml}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-500 font-bold">
                      生成後會在這裡預覽
                    </div>
                  )}
                </div>
              </div>
            </div>

            {isTeacher && selectedAppId && (
              <div className="p-4 border-t-2 border-gray-200 bg-white">
                <Button
                  className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                  onClick={async () => {
                    try {
                      const resp = await authService.listAppStudioSubmissions(selectedAppId);
                      alert(`提交記錄：${Array.isArray(resp.submissions) ? resp.submissions.length : 0}`);
                    } catch (e) {
                      alert(e instanceof Error ? e.message : '載入失敗');
                    }
                  }}
                >
                  查看提交記錄
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppStudioModal;

