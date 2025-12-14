import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Code2, Copy, Folder, FolderPlus, Globe, Loader2, Maximize2, Plus, Save, Send, StopCircle, Trash2, Users, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Button from './Button';
import { authService } from '../services/authService';

type StudioApp = {
  id: string;
  ownerId: string;
  ownerRole: string;
  title: string;
  visibility: 'private' | 'public';
  latestVersionId?: string | null;
  folderId?: string | null;
  updatedAt?: string;
  stats?: { forks?: number; submissions?: number; lastSubmissionAt?: number | null };
  owner?: any;
};

const AppStudioModal: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

  const [tab, setTab] = useState<'my' | 'public'>('my');
  const [search, setSearch] = useState('');
  const [folderId, setFolderId] = useState<string>('all');
  const [folders, setFolders] = useState<any[]>([]);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [apps, setApps] = useState<StudioApp[]>([]);
  const [publicApps, setPublicApps] = useState<StudioApp[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [appsError, setAppsError] = useState('');
  const [publicSort, setPublicSort] = useState<'popular' | 'updated' | 'forks' | 'submits'>('popular');

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
  const [previewStopped, setPreviewStopped] = useState(false);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitTeacherId, setSubmitTeacherId] = useState<string>('');
  const [submitTeacherName, setSubmitTeacherName] = useState<string>('');
  const [showSubmitPicker, setShowSubmitPicker] = useState(false);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [showForks, setShowForks] = useState(false);
  const [forks, setForks] = useState<any[]>([]);
  const [loadingForks, setLoadingForks] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [draftNotice, setDraftNotice] = useState<null | { key: string; savedAt: number }>(null);
  const [thumbHtmlByAppId, setThumbHtmlByAppId] = useState<Record<string, string>>({});

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const fullscreenIframeRef = useRef<HTMLIFrameElement | null>(null);

  const selectedApp: StudioApp | null = useMemo(() => {
    const pool = tab === 'public' ? publicApps : apps;
    return pool.find((a) => a.id === selectedAppId) || null;
  }, [apps, publicApps, selectedAppId, tab]);

  const canEditSelected = Boolean(selectedApp && (selectedApp.ownerId === user?.id || user?.role === 'admin'));

  const loadLists = async () => {
    try {
      setLoadingApps(true);
      setAppsError('');
      const [mine, pub, folderResp] = await Promise.all([
        authService.listAppStudioApps({ scope: 'my', includeStats: true, sort: 'updated' }),
        authService.listAppStudioApps({ scope: 'public', includeStats: true, sort: publicSort })
        , authService.listAppStudioFolders()
      ]);
      setApps(Array.isArray(mine.apps) ? mine.apps : []);
      setPublicApps(Array.isArray(pub.apps) ? pub.apps : []);
      setFolders(Array.isArray(folderResp.folders) ? folderResp.folders : []);
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
    setFolderId('all');
    setPublicSort('popular');
    setSelectedAppId(null);
    setVersions([]);
    setSelectedVersionId(null);
    setPrompt('');
    setGeneratedTitle('');
    setGeneratedHtml('');
    setGenerateError('');
    setSubmittedAt(null);
    setSubmitTeacherId('');
    setSubmitTeacherName('');
    setShowSubmitPicker(false);
    setPreviewStopped(false);
    setPreviewFullscreen(false);
    setDiffOpen(false);
    setDraftNotice(null);
    setThumbHtmlByAppId({});
    loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicSort]);

  const visibleApps = useMemo(() => {
    const pool = tab === 'public' ? publicApps : apps;
    const q = search.trim().toLowerCase();
    return pool.filter((a: any) => {
      if (tab === 'my' && folderId !== 'all') {
        const aFolder = String(a?.folderId || '');
        if (folderId === 'unfiled') {
          if (aFolder) return false;
        } else if (aFolder !== folderId) return false;
      }
      if (!q) return true;
      return String(a.title || '').toLowerCase().includes(q);
    });
  }, [apps, publicApps, search, tab]);

  // Load a few thumbnails for the current list (lightweight: small number, sandboxed iframes)
  useEffect(() => {
    if (!open) return;
    const pool = visibleApps.slice(0, 8);
    let canceled = false;

    const run = async () => {
      for (const a of pool) {
        const appId = String((a as any)?.id || '');
        const versionId = String((a as any)?.latestVersionId || '');
        if (!appId || !versionId) continue;
        if (thumbHtmlByAppId[appId]) continue;
        try {
          const resp = await authService.getAppStudioVersion(appId, versionId);
          const html = String(resp.version?.indexHtml || '');
          if (!html.trim()) continue;
          if (canceled) return;
          setThumbHtmlByAppId((prev) => (prev[appId] ? prev : { ...prev, [appId]: html }));
        } catch {
          // ignore
        }
      }
    };

    run();
    return () => { canceled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, publicSort, folderId, search, visibleApps.length]);

  const draftKey = useMemo(() => {
    const uid = user?.id || 'anon';
    const appId = selectedAppId || 'new';
    return `lpedia_appstudio_draft_${uid}_${appId}`;
  }, [selectedAppId, user?.id]);

  // autosave draft
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      const payload = {
        prompt,
        generatedTitle,
        generatedHtml,
        updatedAt: Date.now()
      };
      try {
        localStorage.setItem(draftKey, JSON.stringify(payload));
      } catch {
        // ignore
      }
    }, 900);
    return () => window.clearTimeout(t);
  }, [draftKey, generatedHtml, generatedTitle, open, prompt]);

  const tryRestoreDraft = () => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const savedAt = Number(parsed?.updatedAt || 0);
      if (!savedAt) return;
      setDraftNotice({ key: draftKey, savedAt });
    } catch {
      // ignore
    }
  };

  const openApp = async (appId: string) => {
    setSelectedAppId(appId);
    setVersions([]);
    setSelectedVersionId(null);
    setSubmittedAt(null);
    setPreviewStopped(false);
    await loadAppVersions(appId);
    tryRestoreDraft();
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
      setPreviewStopped(false);
      setPreviewKey((k) => k + 1);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : '生成失敗');
    } finally {
      setGenerating(false);
    }
  };

  const ensureEditableApp = async (): Promise<string | null> => {
    if (selectedAppId && canEditSelected) return selectedAppId;
    if (selectedAppId && !canEditSelected) {
      const resp = await authService.forkAppStudioApp(selectedAppId, selectedVersionId ? { versionId: selectedVersionId } : undefined);
      const app = resp.app;
      if (app?.id) {
        await loadLists();
        setTab('my');
        await openApp(String(app.id));
        return String(app.id);
      }
      return null;
    }
    // no app yet
    const resp = await authService.createAppStudioApp({ title: '新作品', visibility: 'private' });
    const app = resp.app;
    if (app?.id) {
      await loadLists();
      setTab('my');
      await openApp(String(app.id));
      return String(app.id);
    }
    return null;
  };

  const saveAsVersion = async () => {
    if (!generatedHtml.trim()) return;
    const appId = await ensureEditableApp();
    if (!appId) return;
    if (!generatedHtml.trim()) return;
    const title = String(generatedTitle || selectedApp?.title || '版本').trim();
    const resp = await authService.createAppStudioVersion(appId, {
      title,
      prompt: String(prompt || '').trim(),
      indexHtml: generatedHtml
    });
    const v = resp.version;
    await loadLists();
    await loadAppVersions(appId);
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

  const moveToFolder = async (nextFolderId: string) => {
    if (!selectedAppId || !selectedApp) return;
    if (!canEditSelected) return;
    await authService.updateAppStudioApp(selectedAppId, { folderId: nextFolderId === 'unfiled' ? null : nextFolderId });
    await loadLists();
  };

  const submit = async () => {
    if (!selectedAppId) return;
    try {
      setSubmitting(true);
      const payload: any = {};
      if (selectedVersionId) payload.versionId = selectedVersionId;
      if (submitTeacherId) payload.teacherId = submitTeacherId;
      const resp = await authService.submitAppStudio(selectedAppId, Object.keys(payload).length ? payload : undefined);
      setSubmittedAt(String(resp.submission?.createdAt || new Date().toISOString()));
    } catch (e) {
      setSubmittedAt(null);
      alert(e instanceof Error ? e.message : '提交失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const openSubmitPicker = async () => {
    if (user?.role !== 'student') return;
    if (!selectedAppId) return;
    try {
      setLoadingTeachers(true);
      setSubmitTeacherId('');
      setSubmitTeacherName('');
      if (teachers.length === 0) {
        const resp = await authService.listTeachers();
        const list = Array.isArray(resp.users) ? resp.users : [];
        setTeachers(list);
      }
      setShowSubmitPicker(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : '載入老師名單失敗');
    } finally {
      setLoadingTeachers(false);
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

  const buildPreviewHtml = (html: string) => {
    const appId = selectedAppId || '';
    const versionId = selectedVersionId || '';
    const canSubmit = Boolean(appId) && user?.role === 'student';
    const injector = `
<style>
  .lpedia-submit-btn{position:fixed;right:14px;bottom:14px;z-index:2147483647;border:3px solid #5E4C40;background:#10B981;color:#fff;font-weight:900;border-radius:16px;padding:10px 14px;box-shadow:0 6px 0 rgba(0,0,0,.2);cursor:pointer}
  .lpedia-submit-btn:active{transform:translateY(2px);box-shadow:0 3px 0 rgba(0,0,0,.2)}
</style>
<script>
  (function(){
    try{
      if(!${canSubmit ? 'true' : 'false'}) return;
      var btn=document.createElement('button');
      btn.className='lpedia-submit-btn';
      btn.type='button';
      btn.textContent='提交';
      btn.addEventListener('click',function(){
        try{ parent.postMessage({type:'LPEDIA_APP_SUBMIT', appId:${JSON.stringify(appId)}, versionId:${JSON.stringify(versionId)}}, '*'); }catch(e){}
      });
      document.addEventListener('DOMContentLoaded',function(){ document.body.appendChild(btn); });
      if(document.readyState==='interactive'||document.readyState==='complete'){ document.body.appendChild(btn); }
    }catch(e){}
  })();
</script>`;
    const raw = String(html || '');
    if (raw.includes('lpedia-submit-btn')) return raw;
    if (raw.includes('</body>')) return raw.replace('</body>', `${injector}</body>`);
    return `${raw}${injector}`;
  };

  // in-app submit bridge
  useEffect(() => {
    if (!open) return;
    const onMsg = (evt: MessageEvent) => {
      const srcWin = iframeRef.current?.contentWindow;
      const fullWin = fullscreenIframeRef.current?.contentWindow;
      if ((!srcWin && !fullWin) || (evt.source !== srcWin && evt.source !== fullWin)) return;
      const data: any = evt.data;
      if (!data || data.type !== 'LPEDIA_APP_SUBMIT') return;
      if (!selectedAppId) return;
      openSubmitPicker();
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedAppId, selectedVersionId, submitting, user?.role]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-[98vw] h-[96vh] max-w-none max-h-none overflow-hidden rounded-3xl border-4 border-brand-brown shadow-comic-xl flex flex-col">
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

            {tab === 'my' && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-black text-gray-600">資料夾</label>
                  <button
                    type="button"
                    onClick={() => setCreatingFolder(true)}
                    className="text-xs font-black text-brand-brown underline"
                  >
                    新增
                  </button>
                </div>
                <select
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl bg-white font-bold"
                >
                  <option value="all">全部</option>
                  <option value="unfiled">未分類</option>
                  {folders.map((f) => (
                    <option key={String(f.id)} value={String(f.id)}>{String(f.name || '資料夾')}</option>
                  ))}
                </select>
              </div>
            )}
            {tab === 'public' && (
              <div className="mb-3">
                <label className="block text-xs font-black text-gray-600 mb-1">排序</label>
                <select
                  value={publicSort}
                  onChange={(e) => setPublicSort(e.target.value as any)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl bg-white font-bold"
                >
                  <option value="popular">最熱門</option>
                  <option value="updated">最新</option>
                  <option value="forks">最多 Fork</option>
                  <option value="submits">最多提交</option>
                </select>
              </div>
            )}

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
                    {tab === 'public' && (
                      <div className="mb-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="h-20 overflow-hidden relative">
                          {thumbHtmlByAppId[String(a.id)] ? (
                            <div className="absolute inset-0 origin-top-left" style={{ transform: 'scale(0.25)' }}>
                              <iframe
                                title={`thumb-${a.id}`}
                                sandbox="allow-scripts"
                                className="w-[1200px] h-[600px] bg-white pointer-events-none"
                                srcDoc={thumbHtmlByAppId[String(a.id)]}
                              />
                            </div>
                          ) : (
                            <div className="h-full flex items-center justify-center text-xs text-gray-500 font-bold">
                              預覽載入中…
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-brand-brown">{a.title || '作品'}</span>
                      {a.visibility === 'public' ? <Globe className="w-4 h-4 text-emerald-700" /> : <Folder className="w-4 h-4 text-gray-500" />}
                    </div>
                    {tab === 'public' && a.owner?.profile?.name && (
                      <div className="text-xs text-gray-500 font-bold mt-1">作者：{String(a.owner.profile.name)}</div>
                    )}
                    {a.stats && (
                      <div className="text-xs text-gray-500 font-bold mt-1">Fork {Number(a.stats.forks || 0)} • 提交 {Number(a.stats.submissions || 0)}</div>
                    )}
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

            {selectedAppId && (
              <div className="mt-4 pt-4 border-t-2 border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="font-black text-gray-700">版本控制</div>
                  <div className="ml-auto text-[11px] text-gray-500 font-bold">
                    {versions.length ? `${versions.length} 個版本` : ''}
                  </div>
                </div>

                {draftNotice && (
                  <div className="text-sm text-brand-brown font-black bg-[#FEF7EC] border-2 border-brand-brown rounded-2xl p-3 mb-2">
                    發現草稿（{new Date(draftNotice.savedAt).toLocaleString()}）
	                    <div className="mt-2 flex gap-2">
	                      <Button
	                        className="flex-1 bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
	                        onClick={() => {
	                          try {
	                            const raw = localStorage.getItem(draftNotice.key);
	                            if (raw) {
                              const parsed = JSON.parse(raw);
                              setPrompt(String(parsed?.prompt || ''));
                              setGeneratedTitle(String(parsed?.generatedTitle || ''));
                              setGeneratedHtml(String(parsed?.generatedHtml || ''));
                              setPreviewStopped(false);
                              setPreviewKey((k) => k + 1);
                            }
                          } catch {
                            // ignore
                          } finally {
                            setDraftNotice(null);
                          }
                        }}
	                      >
	                        恢復
	                      </Button>
	                      <Button
	                        className="flex-1 bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
	                        onClick={() => setDraftNotice(null)}
	                      >
	                        忽略
	                      </Button>
	                    </div>
                  </div>
                )}

                {versionError && <div className="text-sm text-red-600 font-bold mb-2">{versionError}</div>}

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
                      setPreviewStopped(false);
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

                <div className="mt-2">
                  <Button
                    fullWidth
                    className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                    onClick={() => setDiffOpen(true)}
                    disabled={!selectedAppId || !selectedVersionId}
                  >
                    版本差異
                  </Button>
                </div>

                {tab === 'my' && canEditSelected && selectedAppId && (
                  <div className="mt-2">
                    <label className="block text-xs font-black text-gray-600 mb-1">放入資料夾</label>
                    <select
                      value={String(selectedApp?.folderId || 'unfiled')}
                      onChange={(e) => moveToFolder(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl bg-white font-bold"
                    >
                      <option value="unfiled">未分類</option>
                      {folders.map((f) => (
                        <option key={String(f.id)} value={String(f.id)}>{String(f.name || '資料夾')}</option>
                      ))}
                    </select>
                  </div>
                )}

                {canEditSelected && selectedAppId && selectedVersionId && (
                  <div className="mt-2">
                    <Button
                      fullWidth
                      className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                      onClick={async () => {
                        if (!selectedAppId || !selectedVersionId) return;
                        const v = versions.find((x) => String(x.id) === String(selectedVersionId));
                        if (!v?.indexHtml) {
                          try {
                            const resp = await authService.getAppStudioVersion(selectedAppId, selectedVersionId);
                            v.indexHtml = resp.version?.indexHtml;
                          } catch {
                            // ignore
                          }
                        }
                        if (!confirm('回退會建立一個新版本並設為最新版本，確定？')) return;
                        try {
                          await authService.createAppStudioVersion(selectedAppId, {
                            title: `${String(v?.title || selectedApp?.title || '')}（回退）`,
                            prompt: 'rollback',
                            indexHtml: String(v?.indexHtml || generatedHtml || '')
                          });
                          await loadAppVersions(selectedAppId);
                          await loadLists();
                        } catch (e) {
                          alert(e instanceof Error ? e.message : '回退失敗');
                        }
                      }}
                    >
                      回退到此版本
                    </Button>
                  </div>
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
                    onClick={() => setPreviewStopped(true)}
                  >
                    <StopCircle className="w-4 h-4 mr-2" />
                    停止
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
                  {isTeacher && canEditSelected && (
                    <Button
                      className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                      onClick={async () => {
                        if (!selectedAppId) return;
                        try {
                          setLoadingForks(true);
                          setShowForks(true);
                          const resp = await authService.listAppStudioForks(selectedAppId);
                          setForks(Array.isArray(resp.forks) ? resp.forks : []);
                        } catch (e) {
                          alert(e instanceof Error ? e.message : '載入失敗');
                        } finally {
                          setLoadingForks(false);
                        }
                      }}
                    >
                      <Users className="w-4 h-4 mr-2" />
                      查看副本
                    </Button>
                  )}
                  {canEditSelected && (
                    <Button
                      className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                      onClick={togglePublic}
                    >
                      {selectedApp.visibility === 'public' ? '設為私人' : '設為公開'}
                    </Button>
                  )}
                  {user?.role === 'student' && (
                    <Button
                      className="bg-emerald-500 hover:bg-emerald-600 text-white"
                      onClick={openSubmitPicker}
                      disabled={submitting || !selectedAppId || loadingTeachers}
                    >
                      <Send className={`w-4 h-4 mr-2 ${submitting ? 'animate-pulse' : ''}`} />
                      提交
                    </Button>
                  )}
                  {isTeacher && canEditSelected && (
                    <Button
                      className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                      onClick={async () => {
                        if (!selectedAppId) return;
                        try {
                          setLoadingSubmissions(true);
                          setShowSubmissions(true);
                          const resp = await authService.listAppStudioSubmissions(selectedAppId);
                          setSubmissions(Array.isArray(resp.submissions) ? resp.submissions : []);
                        } catch (e) {
                          alert(e instanceof Error ? e.message : '載入失敗');
                        } finally {
                          setLoadingSubmissions(false);
                        }
                      }}
                    >
                      查看提交
                    </Button>
                  )}
                  {isTeacher && canEditSelected && (
                    <Button
                      className="bg-white hover:bg-gray-50 border-2 border-red-300 text-red-700"
                      onClick={async () => {
                        if (!selectedAppId) return;
                        if (!confirm('確定要刪除這個作品？（版本與提交記錄會一併刪除）')) return;
                        try {
                          await authService.deleteAppStudioApp(selectedAppId);
                          setSelectedAppId(null);
                          setVersions([]);
                          setSelectedVersionId(null);
                          setGeneratedHtml('');
                          setGeneratedTitle('');
                          setPrompt('');
                          setSubmittedAt(null);
                          await loadLists();
                        } catch (e) {
                          alert(e instanceof Error ? e.message : '刪除失敗');
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      刪除作品
                    </Button>
                  )}
                </>
              )}
            </div>

            <div className="flex-1 min-h-0 flex flex-col gap-4 p-4">
              <div className="flex-1 min-h-0 flex flex-col bg-white border-2 border-gray-200 rounded-2xl overflow-hidden">
                <div className="p-3 border-b-2 border-gray-200 bg-gray-50 flex items-center gap-2">
                  <div className="font-black text-gray-700">預覽</div>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewFullscreen(true)}
                      disabled={!generatedHtml.trim()}
                      className={`w-9 h-9 rounded-full bg-white border-2 flex items-center justify-center ${generatedHtml.trim() ? 'border-brand-brown hover:bg-gray-100' : 'border-gray-200 text-gray-400 cursor-not-allowed'}`}
                      aria-label="全螢幕"
                      title="全螢幕"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    <div className="text-xs text-gray-500 font-bold hidden sm:block">iframe sandbox</div>
                  </div>
                </div>
                <div className="flex-1 min-h-0 bg-black/5">
                  {previewStopped ? (
                    <div className="h-full flex items-center justify-center text-gray-500 font-bold">
                      已停止（按「重新執行」再次載入）
                    </div>
                  ) : generatedHtml.trim() ? (
                    <iframe
                      key={previewKey}
                      ref={iframeRef}
                      title="app-preview"
                      sandbox="allow-scripts"
                      className="w-full h-full bg-white"
                      srcDoc={buildPreviewHtml(generatedHtml)}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-500 font-bold">
                      生成後會在這裡預覽
                    </div>
                  )}
                </div>
              </div>

              <div className="h-[280px] min-h-[240px] max-h-[360px] flex flex-col bg-white border-2 border-gray-200 rounded-2xl overflow-hidden">
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
                      {canEditSelected ? '儲存版本' : 'Fork 並儲存'}
                    </Button>
                  </div>
                </div>
                <div className="p-3 flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="例如：做一個可以輸入英文單字、按下開始後每 5 秒顯示一個提示的練習小工具..."
                    className="w-full flex-1 min-h-[120px] resize-none px-3 py-2 border-2 border-gray-300 rounded-xl font-bold"
                  />
                  {generateError && <div className="text-sm text-red-600 font-bold">{generateError}</div>}
                  {submittedAt && (
                    <div className="text-sm text-emerald-700 font-black">
                      {submitTeacherName ? `已提交給 ${submitTeacherName}：` : '已提交：'}
                      {new Date(submittedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {isTeacher && selectedAppId && (
              <div className="p-4 border-t-2 border-gray-200 bg-white">
                <div className="text-xs text-gray-500 font-bold">
                  提示：作品以「按提交」作完成記錄；公開作品可被全站 fork。
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {creatingFolder && (
        <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl border-4 border-brand-brown shadow-comic-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <FolderPlus className="w-5 h-5 text-brand-brown" />
              <div className="text-xl font-black text-brand-brown">新增資料夾</div>
              <button
                type="button"
                onClick={() => { setCreatingFolder(false); setNewFolderName(''); }}
                className="ml-auto w-9 h-9 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                aria-label="關閉"
              >
                <X className="w-5 h-5 text-brand-brown" />
              </button>
            </div>
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="資料夾名稱"
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl font-bold"
            />
            <div className="mt-4 flex gap-2">
              <Button
                fullWidth
                className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                onClick={() => { setCreatingFolder(false); setNewFolderName(''); }}
              >
                取消
              </Button>
              <Button
                fullWidth
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                onClick={async () => {
                  const name = String(newFolderName || '').trim();
                  if (!name) return;
                  try {
                    await authService.createAppStudioFolder({ name });
                    setCreatingFolder(false);
                    setNewFolderName('');
                    await loadLists();
                  } catch (e) {
                    alert(e instanceof Error ? e.message : '新增失敗');
                  }
                }}
              >
                新增
              </Button>
            </div>
          </div>
        </div>
      )}

      {showSubmissions && (
        <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl max-h-[80vh] overflow-hidden rounded-3xl border-4 border-brand-brown shadow-comic-xl flex flex-col">
            <div className="p-4 border-b-4 border-brand-brown bg-[#D2EFFF] flex items-center gap-2">
              <div className="text-xl font-black text-brand-brown">提交記錄</div>
              <button
                type="button"
                onClick={() => setShowSubmissions(false)}
                className="ml-auto w-9 h-9 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                aria-label="關閉"
              >
                <X className="w-5 h-5 text-brand-brown" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              {loadingSubmissions ? (
                <div className="text-sm text-gray-500 font-bold flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> 載入中...
                </div>
              ) : submissions.length === 0 ? (
                <div className="text-sm text-gray-500 font-bold">未有提交</div>
              ) : (
                <div className="border-2 border-gray-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3 font-black text-gray-700">學生</th>
                        <th className="text-left p-3 font-black text-gray-700">班別</th>
                        <th className="text-left p-3 font-black text-gray-700">時間</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((s) => (
                        <tr key={String(s.id)} className="border-t border-gray-200">
                          <td className="p-3 font-bold text-gray-800">
                            {String(s.user?.profile?.name || s.user?.username || s.userId || '')}
                          </td>
                          <td className="p-3 font-bold text-gray-600">
                            {String(s.user?.profile?.class || '')}
                          </td>
                          <td className="p-3 font-bold text-gray-600">
                            {s.createdAt ? new Date(s.createdAt).toLocaleString() : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showForks && (
        <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl max-h-[80vh] overflow-hidden rounded-3xl border-4 border-brand-brown shadow-comic-xl flex flex-col">
            <div className="p-4 border-b-4 border-brand-brown bg-[#FEF7EC] flex items-center gap-2">
              <div className="text-xl font-black text-brand-brown">作品副本（Fork）</div>
              <button
                type="button"
                onClick={() => setShowForks(false)}
                className="ml-auto w-9 h-9 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                aria-label="關閉"
              >
                <X className="w-5 h-5 text-brand-brown" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              {loadingForks ? (
                <div className="text-sm text-gray-500 font-bold flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> 載入中...
                </div>
              ) : forks.length === 0 ? (
                <div className="text-sm text-gray-500 font-bold">未有副本</div>
              ) : (
                <div className="space-y-2">
                  {forks.map((f) => (
                    <div key={String(f.id)} className="bg-white border-2 border-gray-200 rounded-2xl p-3">
                      <div className="font-black text-brand-brown">{String(f.title || '')}</div>
                      <div className="text-xs text-gray-600 font-bold mt-1">
                        由 {String(f.owner?.profile?.name || f.owner?.username || f.ownerId)} 建立 • {f.updatedAt ? new Date(f.updatedAt).toLocaleString() : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showSubmitPicker && user?.role === 'student' && (
        <div className="fixed inset-0 z-[95] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl border-4 border-brand-brown shadow-comic-xl overflow-hidden">
            <div className="p-4 border-b-4 border-brand-brown bg-[#E8F5E9] flex items-center gap-2">
              <div className="text-xl font-black text-brand-brown">選擇提交老師</div>
              <button
                type="button"
                onClick={() => setShowSubmitPicker(false)}
                className="ml-auto w-9 h-9 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                aria-label="關閉"
              >
                <X className="w-5 h-5 text-brand-brown" />
              </button>
            </div>
            <div className="p-4">
              <label className="block text-xs font-black text-gray-600 mb-1">提交給</label>
              <select
                value={submitTeacherId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSubmitTeacherId(id);
                  const t = teachers.find((x) => String(x?.id) === String(id));
                  setSubmitTeacherName(String(t?.profile?.name || t?.username || ''));
                }}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl bg-white font-bold"
              >
                <option value="">請選擇老師</option>
                {teachers.map((t) => (
                  <option key={String(t.id)} value={String(t.id)}>
                    {String(t.profile?.name || t.username || '')}
                  </option>
                ))}
              </select>
              <div className="mt-4 flex gap-2">
                <Button
                  fullWidth
                  className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                  onClick={() => setShowSubmitPicker(false)}
                >
                  取消
                </Button>
                <Button
                  fullWidth
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={async () => {
                    if (!submitTeacherId) {
                      alert('請先選擇老師');
                      return;
                    }
                    setShowSubmitPicker(false);
                    await submit();
                  }}
                  disabled={submitting}
                >
                  確認提交
                </Button>
              </div>
              <div className="mt-3 text-xs text-gray-500 font-bold">
                提示：提交後老師會看到你的提交記錄；你也可以先 fork 再修改。
              </div>
            </div>
          </div>
        </div>
      )}

      {diffOpen && selectedAppId && selectedVersionId && (
        <DiffModal
          onClose={() => setDiffOpen(false)}
          versions={versions}
          selectedVersionId={selectedVersionId}
          appId={selectedAppId}
        />
      )}

      {previewFullscreen && (
        <div className="fixed inset-0 z-[94] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white w-[98vw] h-[96vh] max-w-none max-h-none overflow-hidden rounded-3xl border-4 border-brand-brown shadow-comic-xl flex flex-col">
            <div className="p-4 border-b-4 border-brand-brown bg-[#D2EFFF] flex items-center gap-2">
              <div className="text-xl font-black text-brand-brown">預覽（全螢幕）</div>
              <button
                type="button"
                onClick={() => setPreviewFullscreen(false)}
                className="ml-auto w-9 h-9 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                aria-label="關閉"
              >
                <X className="w-5 h-5 text-brand-brown" />
              </button>
            </div>
            <div className="flex-1 min-h-0 bg-black/5">
              {previewStopped ? (
                <div className="h-full flex items-center justify-center text-gray-500 font-bold">
                  已停止（按「重新執行」再次載入）
                </div>
              ) : generatedHtml.trim() ? (
                <iframe
                  key={`full-${previewKey}`}
                  ref={fullscreenIframeRef}
                  title="app-preview-fullscreen"
                  sandbox="allow-scripts"
                  className="w-full h-full bg-white"
                  srcDoc={buildPreviewHtml(generatedHtml)}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 font-bold">
                  生成後會在這裡預覽
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppStudioModal;

const computeDiffSummary = (a: string, b: string) => {
  const aLines = String(a || '').split('\n');
  const bLines = String(b || '').split('\n');
  const aSet = new Set(aLines);
  const bSet = new Set(bLines);
  let added = 0;
  let removed = 0;
  for (const line of bSet) if (!aSet.has(line)) added++;
  for (const line of aSet) if (!bSet.has(line)) removed++;
  return { aLines: aLines.length, bLines: bLines.length, added, removed };
};

const DiffModal: React.FC<{
  onClose: () => void;
  versions: any[];
  selectedVersionId: string;
  appId: string;
}> = ({ onClose, versions, selectedVersionId, appId }) => {
  const idx = versions.findIndex((v) => String(v.id) === String(selectedVersionId));
  const cur = versions[idx] || null;
  const prev = idx >= 0 ? (versions[idx + 1] || null) : null;
  const [curHtml, setCurHtml] = useState<string>(String(cur?.indexHtml || ''));
  const [prevHtml, setPrevHtml] = useState<string>(String(prev?.indexHtml || ''));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        if (cur && !curHtml) {
          const resp = await authService.getAppStudioVersion(appId, String(cur.id));
          setCurHtml(String(resp.version?.indexHtml || ''));
        }
        if (prev && !prevHtml) {
          const resp = await authService.getAppStudioVersion(appId, String(prev.id));
          setPrevHtml(String(resp.version?.indexHtml || ''));
        }
      } finally {
        setLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, selectedVersionId]);

  const summary = useMemo(() => computeDiffSummary(prevHtml, curHtml), [curHtml, prevHtml]);

  return (
    <div className="fixed inset-0 z-[95] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl max-h-[85vh] overflow-hidden rounded-3xl border-4 border-brand-brown shadow-comic-xl flex flex-col">
        <div className="p-4 border-b-4 border-brand-brown bg-[#D2EFFF] flex items-center gap-2">
          <div className="text-xl font-black text-brand-brown">版本差異</div>
          <div className="ml-3 text-xs text-gray-600 font-bold">
            {loading ? '載入中…' : `行數 ${summary.aLines} → ${summary.bLines} • 新增行(粗略) ${summary.added} • 刪除行(粗略) ${summary.removed}`}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto w-9 h-9 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
            aria-label="關閉"
          >
            <X className="w-5 h-5 text-brand-brown" />
          </button>
        </div>
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3 p-4 overflow-y-auto">
          <div className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden flex flex-col min-h-0">
            <div className="p-3 border-b-2 border-gray-200 bg-gray-50 font-black text-gray-700">上一版本</div>
            <pre className="flex-1 min-h-0 overflow-auto p-3 text-xs bg-white">{prevHtml || '（沒有上一版本）'}</pre>
          </div>
          <div className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden flex flex-col min-h-0">
            <div className="p-3 border-b-2 border-gray-200 bg-gray-50 font-black text-gray-700">目前版本</div>
            <pre className="flex-1 min-h-0 overflow-auto p-3 text-xs bg-white">{curHtml || ''}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};
