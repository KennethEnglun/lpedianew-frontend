import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, X } from 'lucide-react';
import Button from '../Button';
import Input from '../Input';

type TabKey = 'chat' | 'ai-notes' | 'self-study' | 'appstudio';
type TabKeyV2 = TabKey | 'charts' | 'ai-reports';

export default function YearArchiveStudentContentModal(props: {
  open: boolean;
  onClose: () => void;
  archiveId: string;
  authService: any;
}) {
  const { open, onClose, archiveId, authService } = props;

  const [tab, setTab] = useState<TabKeyV2>('chat');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');
  const [includeTaskThreads, setIncludeTaskThreads] = useState(false);

  const [chatThreads, setChatThreads] = useState<any[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>('');
  const [threadMessages, setThreadMessages] = useState<any[]>([]);
  const [threadStudent, setThreadStudent] = useState<any | null>(null);

  const [aiNotes, setAiNotes] = useState<any[]>([]);
  const [selectedAiNoteId, setSelectedAiNoteId] = useState<string>('');
  const [aiNoteDetail, setAiNoteDetail] = useState<any | null>(null);

  const [selfStudyTx, setSelfStudyTx] = useState<any[]>([]);

  const [apps, setApps] = useState<any[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [appDetail, setAppDetail] = useState<any | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');

  const [charts, setCharts] = useState<any[]>([]);
  const [selectedChartId, setSelectedChartId] = useState<string>('');
  const [chartDetail, setChartDetail] = useState<any | null>(null);

  const [aiReports, setAiReports] = useState<any[]>([]);
  const [selectedAiReportKey, setSelectedAiReportKey] = useState<string>('');
  const [aiReportDetail, setAiReportDetail] = useState<any | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab('chat');
    setLoading(false);
    setError('');
    setSearch('');
    setClassName('');
    setSubject('');
    setIncludeTaskThreads(false);
    setChatThreads([]);
    setSelectedThreadId('');
    setThreadMessages([]);
    setThreadStudent(null);
    setAiNotes([]);
    setSelectedAiNoteId('');
    setAiNoteDetail(null);
    setSelfStudyTx([]);
    setApps([]);
    setSelectedAppId('');
    setAppDetail(null);
    setSelectedVersionId('');
    setCharts([]);
    setSelectedChartId('');
    setChartDetail(null);
    setAiReports([]);
    setSelectedAiReportKey('');
    setAiReportDetail(null);
  }, [open, archiveId]);

  const classOptions = useMemo(() => {
    const set = new Set<string>();
    const source = tab === 'chat'
      ? chatThreads
      : (tab === 'ai-notes'
        ? aiNotes
        : (tab === 'appstudio'
          ? apps
          : (tab === 'charts'
            ? charts
            : (tab === 'ai-reports' ? aiReports : selfStudyTx))));
    for (const row of Array.isArray(source) ? source : []) {
      const cls = String(row?.studentClass || row?.className || '');
      if (cls) set.add(cls);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  }, [aiNotes, apps, chatThreads, selfStudyTx, tab]);

  const subjectOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of Array.isArray(chatThreads) ? chatThreads : []) {
      const s = String(row?.subject || '');
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  }, [chatThreads]);

  const loadTabData = async () => {
    const id = String(archiveId || '').trim();
    if (!id) return;
    try {
      setLoading(true);
      setError('');

      if (tab === 'chat') {
        const resp = await authService.listYearArchiveChatThreads(id, { subject: subject || undefined, className: className || undefined, search: search || undefined, includeTaskThreads });
        setChatThreads(Array.isArray(resp.threads) ? resp.threads : []);
        setSelectedThreadId('');
        setThreadMessages([]);
        setThreadStudent(null);
      } else if (tab === 'ai-notes') {
        const resp = await authService.listYearArchiveAiNotes(id, { className: className || undefined, search: search || undefined });
        setAiNotes(Array.isArray(resp.notes) ? resp.notes : []);
        setSelectedAiNoteId('');
        setAiNoteDetail(null);
      } else if (tab === 'self-study') {
        const resp = await authService.listYearArchiveSelfStudyTransactions(id, { className: className || undefined });
        const list = Array.isArray(resp.transactions) ? resp.transactions : [];
        const filtered = !search
          ? list
          : list.filter((t: any) => {
            const hay = `${t?.studentName || ''} ${t?.studentUsername || ''} ${t?.description || ''} ${JSON.stringify(t?.metadata || {}).slice(0, 5000)}`.toLowerCase();
            return hay.includes(String(search || '').toLowerCase());
          });
        setSelfStudyTx(filtered);
      } else if (tab === 'appstudio') {
        const resp = await authService.listYearArchiveAppStudioApps(id, { className: className || undefined, search: search || undefined });
        setApps(Array.isArray(resp.apps) ? resp.apps : []);
        setSelectedAppId('');
        setAppDetail(null);
        setSelectedVersionId('');
      } else if (tab === 'charts') {
        const resp = await authService.listYearArchiveCharts(id, { className: className || undefined, search: search || undefined });
        setCharts(Array.isArray(resp.charts) ? resp.charts : []);
        setSelectedChartId('');
        setChartDetail(null);
      } else if (tab === 'ai-reports') {
        const resp = await authService.listYearArchiveAiReports(id, { className: className || undefined, search: search || undefined });
        setAiReports(Array.isArray(resp.reports) ? resp.reports : []);
        setSelectedAiReportKey('');
        setAiReportDetail(null);
      }
    } catch (e: any) {
      setError(e?.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadTabData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

  const openThread = async (threadId: string) => {
    const id = String(archiveId || '').trim();
    const tid = String(threadId || '').trim();
    if (!id || !tid) return;
    try {
      setLoading(true);
      setError('');
      setSelectedThreadId(tid);
      setThreadMessages([]);
      setThreadStudent(null);
      const resp = await authService.getYearArchiveChatThreadMessages(id, tid);
      setThreadMessages(Array.isArray(resp.messages) ? resp.messages : []);
      setThreadStudent(resp.student || null);
    } catch (e: any) {
      setError(e?.message || '載入對話失敗');
      setThreadMessages([]);
      setThreadStudent(null);
    } finally {
      setLoading(false);
    }
  };

  const openAiNote = async (noteId: string) => {
    const id = String(archiveId || '').trim();
    const nid = String(noteId || '').trim();
    if (!id || !nid) return;
    try {
      setLoading(true);
      setError('');
      setSelectedAiNoteId(nid);
      setAiNoteDetail(null);
      const resp = await authService.getYearArchiveAiNote(id, nid);
      setAiNoteDetail(resp?.note || null);
    } catch (e: any) {
      setError(e?.message || '載入 AI 筆記失敗');
      setAiNoteDetail(null);
    } finally {
      setLoading(false);
    }
  };

  const openApp = async (appId: string) => {
    const id = String(archiveId || '').trim();
    const aid = String(appId || '').trim();
    if (!id || !aid) return;
    try {
      setLoading(true);
      setError('');
      setSelectedAppId(aid);
      setAppDetail(null);
      setSelectedVersionId('');
      const resp = await authService.getYearArchiveAppStudioAppDetail(id, aid);
      setAppDetail(resp || null);
      const firstVersion = Array.isArray(resp?.versions) && resp.versions[0]?.id ? String(resp.versions[0].id) : '';
      setSelectedVersionId(firstVersion);
    } catch (e: any) {
      setError(e?.message || '載入作品失敗');
      setAppDetail(null);
      setSelectedVersionId('');
    } finally {
      setLoading(false);
    }
  };

  const openChart = async (chartId: string) => {
    const id = String(archiveId || '').trim();
    const cid = String(chartId || '').trim();
    if (!id || !cid) return;
    try {
      setLoading(true);
      setError('');
      setSelectedChartId(cid);
      setChartDetail(null);
      const resp = await authService.getYearArchiveChartDetail(id, cid);
      setChartDetail(resp || null);
    } catch (e: any) {
      setError(e?.message || '載入圖表失敗');
      setChartDetail(null);
    } finally {
      setLoading(false);
    }
  };

  const openAiReport = async (key: string) => {
    const id = String(archiveId || '').trim();
    const k = String(key || '').trim();
    if (!id || !k) return;
    try {
      setLoading(true);
      setError('');
      setSelectedAiReportKey(k);
      setAiReportDetail(null);
      const resp = await authService.getYearArchiveAiReportDetail(id, k);
      setAiReportDetail(resp?.report || null);
    } catch (e: any) {
      setError(e?.message || '載入 AI 報告失敗');
      setAiReportDetail(null);
    } finally {
      setLoading(false);
    }
  };

  const formatSelfStudySummary = (t: any) => {
    const meta = t?.metadata && typeof t.metadata === 'object' ? t.metadata : null;
    const scope = meta?.scope && typeof meta.scope === 'object' ? meta.scope : null;
    const subjectText = scope?.subject ? String(scope.subject) : '';
    const topics = Array.isArray(scope?.topics) ? scope.topics.map((x: any) => String(x || '').trim()).filter(Boolean) : [];
    const correct = meta?.rawCorrectCount ?? null;
    const qCount = meta?.questionCount ?? meta?.assumedQuestionCount ?? null;
    const multiplier = meta?.multiplier ?? null;
    const parts = [];
    if (subjectText) parts.push(subjectText);
    if (topics.length > 0) parts.push(`題材：${topics.slice(0, 3).join('、')}${topics.length > 3 ? '…' : ''}`);
    if (Number.isFinite(Number(correct)) && Number.isFinite(Number(qCount))) parts.push(`答對 ${Number(correct)} / ${Number(qCount)}`);
    if (Number.isFinite(Number(multiplier))) parts.push(`×${Number(multiplier)}`);
    return parts.join(' · ');
  };

  const selfStudyCustomContent = (t: any) => {
    const meta = t?.metadata && typeof t.metadata === 'object' ? t.metadata : null;
    const scope = meta?.scope && typeof meta.scope === 'object' ? meta.scope : null;
    const raw = scope?.customContent;
    const s = typeof raw === 'string' ? raw : '';
    return s.replace(/\\n/g, '\n');
  };

  const selectedVersion = useMemo(() => {
    if (!appDetail || !Array.isArray(appDetail.versions)) return null;
    const vid = String(selectedVersionId || '');
    return appDetail.versions.find((v: any) => v && String(v.id) === vid) || null;
  }, [appDetail, selectedVersionId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-3" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b-2 border-gray-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-lg font-black text-brand-brown truncate">封存學生內容（{archiveId}）</div>
            <div className="text-xs text-gray-600 font-bold">AI 對話 / AI 筆記 / 自學天地 / AppStudio</div>
          </div>
          <button
            type="button"
            className="p-2 rounded-xl border-2 border-gray-200 hover:bg-gray-50"
            onClick={onClose}
            aria-label="close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 pt-3 flex flex-wrap items-center gap-2 border-b border-gray-100">
          {([
            { k: 'chat', label: 'AI 對話' },
            { k: 'ai-notes', label: 'AI 筆記' },
            { k: 'self-study', label: '自學天地' },
            { k: 'appstudio', label: 'AppStudio' },
            { k: 'charts', label: '圖表' },
            { k: 'ai-reports', label: 'AI 報告' }
          ] as any[]).map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => setTab(t.k)}
              className={`px-3 py-1 rounded-xl border-2 font-black ${
                tab === t.k ? 'border-brand-brown bg-[#FEF7EC] text-brand-brown' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4 flex flex-wrap items-center gap-2 border-b-2 border-gray-200">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋學生/標題/內容..."
              className="w-[240px]"
            />
          </div>
          <select
            className="px-3 py-2 rounded-xl border-2 border-gray-200 font-bold"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
          >
            <option value="">全部班別</option>
            {classOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {tab === 'chat' && (
            <>
              <select
                className="px-3 py-2 rounded-xl border-2 border-gray-200 font-bold"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              >
                <option value="">全部科目</option>
                {subjectOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                <input
                  type="checkbox"
                  checked={includeTaskThreads}
                  onChange={(e) => setIncludeTaskThreads(e.target.checked)}
                />
                包括任務對話
              </label>
            </>
          )}

          <Button
            className="bg-white hover:bg-gray-50 flex items-center gap-2 border border-brand-brown text-brand-brown"
            onClick={() => void loadTabData()}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            重新載入
          </Button>
          {error && <div className="text-red-700 font-bold">{error}</div>}
        </div>

        <div className="flex-1 overflow-hidden">
          {tab === 'chat' && (
            <div className="h-full grid grid-cols-1 md:grid-cols-2">
              <div className="border-r-2 border-gray-200 overflow-auto p-3 space-y-2">
                {loading && chatThreads.length === 0 ? (
                  <div className="text-gray-600 font-bold">載入中...</div>
                ) : chatThreads.length === 0 ? (
                  <div className="text-gray-600 font-bold">沒有對話紀錄</div>
                ) : (
                  chatThreads.map((t: any) => (
                    <button
                      key={String(t.threadId)}
                      type="button"
                      onClick={() => void openThread(String(t.threadId))}
                      className={`w-full text-left p-3 rounded-2xl border-2 ${
                        selectedThreadId === String(t.threadId) ? 'border-brand-brown bg-[#FEF7EC]' : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-black text-gray-900 truncate">{String(t.title || '對話')}</div>
                      <div className="text-xs text-gray-700 font-bold truncate">
                        {String(t.studentName || '學生')}{t.studentClass ? `（${t.studentClass}）` : ''} · {String(t.subject || '')}
                      </div>
                      <div className="text-[11px] text-gray-500 font-bold truncate">
                        {String(t.lastMessageAt || '')} · {Number(t.messageCount) || 0} 則
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="overflow-auto p-3">
                {!selectedThreadId ? (
                  <div className="text-gray-600 font-bold">請在左側選擇一個對話</div>
                ) : (
                  <div className="space-y-2">
                    {threadStudent && (
                      <div className="p-3 rounded-2xl border-2 border-gray-200 bg-gray-50">
                        <div className="font-black text-brand-brown">
                          {String(threadStudent.name || '學生')}{threadStudent.class ? `（${threadStudent.class}）` : ''}
                        </div>
                        <div className="text-xs text-gray-600 font-bold">{String(threadStudent.username || '')}</div>
                      </div>
                    )}
                    {threadMessages.map((m: any) => (
                      <div key={String(m.id)} className="p-3 rounded-2xl border-2 border-gray-200 bg-white">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-black text-brand-brown">{String(m.sender || '')}</div>
                          <div className="text-[11px] text-gray-500 font-bold">{String(m.createdAt || '')}</div>
                        </div>
                        <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap break-words">{String(m.content || '')}</div>
                      </div>
                    ))}
                    {threadMessages.length === 0 && <div className="text-gray-600 font-bold">（沒有訊息）</div>}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'ai-notes' && (
            <div className="h-full grid grid-cols-1 md:grid-cols-2">
              <div className="border-r-2 border-gray-200 overflow-auto p-3 space-y-2">
                {loading && aiNotes.length === 0 ? (
                  <div className="text-gray-600 font-bold">載入中...</div>
                ) : aiNotes.length === 0 ? (
                  <div className="text-gray-600 font-bold">沒有 AI 筆記</div>
                ) : (
                  aiNotes.map((n: any) => (
                    <button
                      key={String(n.id)}
                      type="button"
                      onClick={() => void openAiNote(String(n.id))}
                      className={`w-full text-left p-3 rounded-2xl border-2 ${
                        selectedAiNoteId === String(n.id) ? 'border-brand-brown bg-[#FEF7EC]' : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-black text-gray-900 truncate">{String(n.title || 'AI筆記')}</div>
                      <div className="text-xs text-gray-700 font-bold truncate">
                        {String(n.studentName || '學生')}{n.studentClass ? `（${n.studentClass}）` : ''}{n.topic ? ` · ${n.topic}` : ''}
                      </div>
                      <div className="text-[11px] text-gray-500 font-bold truncate">{String(n.createdAt || '')}</div>
                    </button>
                  ))
                )}
              </div>
              <div className="overflow-auto p-3">
                {!selectedAiNoteId ? (
                  <div className="text-gray-600 font-bold">請在左側選擇一份 AI 筆記</div>
                ) : !aiNoteDetail ? (
                  <div className="text-gray-600 font-bold">載入中...</div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 rounded-2xl border-2 border-gray-200 bg-gray-50">
                      <div className="font-black text-brand-brown">{String(aiNoteDetail.title || 'AI筆記')}</div>
                      <div className="text-xs text-gray-600 font-bold">{String(aiNoteDetail.createdAt || '')}</div>
                    </div>
                    {String(aiNoteDetail.notesMarkdown || '').trim() && (
                      <div className="p-3 rounded-2xl border-2 border-gray-200 bg-white">
                        <div className="font-black text-gray-800 mb-2">筆記</div>
                        <div className="text-sm text-gray-800 whitespace-pre-wrap break-words">{String(aiNoteDetail.notesMarkdown || '')}</div>
                      </div>
                    )}
                    {String(aiNoteDetail.sourceText || '').trim() && (
                      <div className="p-3 rounded-2xl border-2 border-gray-200 bg-white">
                        <div className="font-black text-gray-800 mb-2">來源內容</div>
                        <div className="text-sm text-gray-800 whitespace-pre-wrap break-words">{String(aiNoteDetail.sourceText || '')}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'self-study' && (
            <div className="h-full overflow-auto p-3">
              {loading && selfStudyTx.length === 0 ? (
                <div className="text-gray-600 font-bold">載入中...</div>
              ) : selfStudyTx.length === 0 ? (
                <div className="text-gray-600 font-bold">沒有自學天地紀錄</div>
              ) : (
                <div className="space-y-2">
                  {selfStudyTx.map((t: any) => (
                    <div key={String(t.id)} className="p-3 rounded-2xl border-2 border-gray-200 bg-white">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-black text-brand-brown">
                          {String(t.studentName || '學生')}{t.studentClass ? `（${t.studentClass}）` : ''}
                        </div>
                        <div className="text-[11px] text-gray-500 font-bold">{String(t.createdAt || '')}</div>
                      </div>
                      <div className="text-sm text-gray-800 font-bold mt-1">{String(t.description || '')}</div>
                      <div className="text-xs text-gray-600 font-bold mt-1">{formatSelfStudySummary(t) || '—'}</div>
                      {selfStudyCustomContent(t).trim() && (
                        <div className="mt-2 p-2 rounded-xl border-2 border-gray-200 bg-gray-50">
                          <div className="text-xs font-black text-gray-700 mb-1">題目/內容</div>
                          <div className="text-xs text-gray-700 font-bold whitespace-pre-wrap break-words">{selfStudyCustomContent(t)}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'appstudio' && (
            <div className="h-full grid grid-cols-1 md:grid-cols-2">
              <div className="border-r-2 border-gray-200 overflow-auto p-3 space-y-2">
                {loading && apps.length === 0 ? (
                  <div className="text-gray-600 font-bold">載入中...</div>
                ) : apps.length === 0 ? (
                  <div className="text-gray-600 font-bold">沒有 AppStudio 作品</div>
                ) : (
                  apps.map((a: any) => (
                    <button
                      key={String(a.appId)}
                      type="button"
                      onClick={() => void openApp(String(a.appId))}
                      className={`w-full text-left p-3 rounded-2xl border-2 ${
                        selectedAppId === String(a.appId) ? 'border-brand-brown bg-[#FEF7EC]' : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-black text-gray-900 truncate">{String(a.title || '作品')}</div>
                      <div className="text-xs text-gray-700 font-bold truncate">
                        {String(a.studentName || '學生')}{a.studentClass ? `（${a.studentClass}）` : ''} · {String(a.visibility || '')}
                      </div>
                      <div className="text-[11px] text-gray-500 font-bold truncate">
                        {String(a.updatedAt || '')} · 提交 {Number(a.submissionCount) || 0} 次
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="overflow-auto p-3">
                {!selectedAppId ? (
                  <div className="text-gray-600 font-bold">請在左側選擇一個作品</div>
                ) : !appDetail ? (
                  <div className="text-gray-600 font-bold">載入中...</div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 rounded-2xl border-2 border-gray-200 bg-gray-50">
                      <div className="font-black text-brand-brown">{String(appDetail?.app?.title || '作品')}</div>
                      <div className="text-xs text-gray-600 font-bold">
                        {String(appDetail?.owner?.name || '學生')}{appDetail?.owner?.class ? `（${appDetail.owner.class}）` : ''} · {String(appDetail?.app?.visibility || '')}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-black text-gray-800">版本：</div>
                      <select
                        className="px-3 py-2 rounded-xl border-2 border-gray-200 font-bold"
                        value={selectedVersionId}
                        onChange={(e) => setSelectedVersionId(e.target.value)}
                      >
                        {(Array.isArray(appDetail?.versions) ? appDetail.versions : []).map((v: any) => (
                          <option key={String(v.id)} value={String(v.id)}>{String(v.title || '版本')}</option>
                        ))}
                      </select>
                    </div>

                    {selectedVersion && (
                      <div className="p-3 rounded-2xl border-2 border-gray-200 bg-white space-y-2">
                        <div className="text-xs text-gray-600 font-bold">{String(selectedVersion.createdAt || '')}</div>
                        <div className="font-black text-gray-800">index.html</div>
                        <textarea
                          className="w-full h-[260px] p-2 rounded-xl border-2 border-gray-200 font-mono text-xs"
                          readOnly
                          value={String(selectedVersion.indexHtml || '')}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'charts' && (
            <div className="h-full grid grid-cols-1 md:grid-cols-2">
              <div className="border-r-2 border-gray-200 overflow-auto p-3 space-y-2">
                {loading && charts.length === 0 ? (
                  <div className="text-gray-600 font-bold">載入中...</div>
                ) : charts.length === 0 ? (
                  <div className="text-gray-600 font-bold">沒有圖表</div>
                ) : (
                  charts.map((c: any) => (
                    <button
                      key={String(c.chartId)}
                      type="button"
                      onClick={() => void openChart(String(c.chartId))}
                      className={`w-full text-left p-3 rounded-2xl border-2 ${
                        selectedChartId === String(c.chartId) ? 'border-brand-brown bg-[#FEF7EC]' : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-black text-gray-900 truncate">{String(c.title || '圖表')}</div>
                      <div className="text-xs text-gray-700 font-bold truncate">
                        {String(c.studentName || '學生')}{c.studentClass ? `（${c.studentClass}）` : ''}{c.subject ? ` · ${c.subject}` : ''}
                      </div>
                      <div className="text-[11px] text-gray-500 font-bold truncate">{String(c.updatedAt || c.createdAt || '')}</div>
                    </button>
                  ))
                )}
              </div>
              <div className="overflow-auto p-3">
                {!selectedChartId ? (
                  <div className="text-gray-600 font-bold">請在左側選擇一個圖表</div>
                ) : !chartDetail ? (
                  <div className="text-gray-600 font-bold">載入中...</div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 rounded-2xl border-2 border-gray-200 bg-gray-50">
                      <div className="font-black text-brand-brown">{String(chartDetail?.chart?.title || '圖表')}</div>
                      <div className="text-xs text-gray-600 font-bold">
                        {String(chartDetail?.owner?.name || '學生')}{chartDetail?.owner?.class ? `（${chartDetail.owner.class}）` : ''}
                      </div>
                    </div>
                    <div className="p-3 rounded-2xl border-2 border-gray-200 bg-white">
                      <div className="font-black text-gray-800 mb-2">chartSpec</div>
                      <textarea
                        className="w-full h-[360px] p-2 rounded-xl border-2 border-gray-200 font-mono text-xs"
                        readOnly
                        value={JSON.stringify(chartDetail?.chart?.chartSpec || {}, null, 2)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'ai-reports' && (
            <div className="h-full grid grid-cols-1 md:grid-cols-2">
              <div className="border-r-2 border-gray-200 overflow-auto p-3 space-y-2">
                {loading && aiReports.length === 0 ? (
                  <div className="text-gray-600 font-bold">載入中...</div>
                ) : aiReports.length === 0 ? (
                  <div className="text-gray-600 font-bold">沒有 AI 報告</div>
                ) : (
                  aiReports.map((r: any) => (
                    <button
                      key={String(r.key)}
                      type="button"
                      onClick={() => void openAiReport(String(r.key))}
                      className={`w-full text-left p-3 rounded-2xl border-2 ${
                        selectedAiReportKey === String(r.key) ? 'border-brand-brown bg-[#FEF7EC]' : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-black text-gray-900 truncate">{String(r.toolType || 'AI報告')} · {String(r.scope || '')}</div>
                      <div className="text-xs text-gray-700 font-bold truncate">
                        {String(r.toolId || '')}
                        {r.studentName ? ` · ${r.studentName}${r.studentClass ? `（${r.studentClass}）` : ''}` : ''}
                      </div>
                      <div className="text-[11px] text-gray-500 font-bold truncate">{String(r.updatedAt || r.createdAt || '')}</div>
                    </button>
                  ))
                )}
              </div>
              <div className="overflow-auto p-3">
                {!selectedAiReportKey ? (
                  <div className="text-gray-600 font-bold">請在左側選擇一份 AI 報告</div>
                ) : !aiReportDetail ? (
                  <div className="text-gray-600 font-bold">載入中...</div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 rounded-2xl border-2 border-gray-200 bg-gray-50">
                      <div className="font-black text-brand-brown">
                        {String(aiReportDetail.toolType || 'AI報告')} · {String(aiReportDetail.scope || '')}
                      </div>
                      <div className="text-xs text-gray-600 font-bold break-words">{String(aiReportDetail.toolId || '')}</div>
                      <div className="text-[11px] text-gray-500 font-bold">{String(aiReportDetail.updatedAt || aiReportDetail.createdAt || '')}</div>
                    </div>
                    <div className="p-3 rounded-2xl border-2 border-gray-200 bg-white">
                      <div className="font-black text-gray-800 mb-2">report</div>
                      <textarea
                        className="w-full h-[420px] p-2 rounded-xl border-2 border-gray-200 font-mono text-xs"
                        readOnly
                        value={JSON.stringify(aiReportDetail.report || {}, null, 2)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
