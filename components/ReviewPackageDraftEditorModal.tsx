import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import DraftSavePublishWizardModal from './DraftSavePublishWizardModal';
import { authService } from '../services/authService';

type Props = {
  open: boolean;
  onClose: () => void;
  draftId?: string | null;
  availableSubjects: string[];
  availableGrades: string[];
  availableClasses: string[];
  onPublished?: () => void;
};

type DraftCheckpoint = {
  id: string;
  timestampSec: number;
  required: boolean;
  points: number;
  questionText: string;
  options: string[];
  correctIndex: number;
};

const newId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const clampInt = (value: any, min = 0, max = 24 * 60 * 60) => {
  const n = Math.floor(Number(value) || 0);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
};

const parseTimeToSec = (input: string) => {
  const raw = String(input || '').trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return clampInt(raw);
  const m = raw.match(/^(\d{1,3}):(\d{1,2})$/);
  if (!m) return null;
  const mm = clampInt(m[1], 0, 999);
  const ss = clampInt(m[2], 0, 59);
  return mm * 60 + ss;
};

const formatSec = (sec: number) => {
  const s = clampInt(sec);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

const parseYouTubeVideoId = (input: string) => {
  const raw = String(input || '').trim();
  if (!raw) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    const host = String(url.hostname || '').toLowerCase();
    const isYouTube = host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be';
    if (!isYouTube) return null;
    if (host === 'youtu.be') {
      const id = url.pathname.replace(/^\/+/, '').slice(0, 64);
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    const v = url.searchParams.get('v');
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    const parts = url.pathname.split('/').filter(Boolean);
    const embedIdx = parts.findIndex((p) => p === 'embed');
    if (embedIdx >= 0 && parts[embedIdx + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[embedIdx + 1])) return parts[embedIdx + 1];
    const shortsIdx = parts.findIndex((p) => p === 'shorts');
    if (shortsIdx >= 0 && parts[shortsIdx + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[shortsIdx + 1])) return parts[shortsIdx + 1];
  } catch {
    return null;
  }
  return null;
};

const loadYouTubeIframeApi = async (): Promise<any> => {
  const w = window as any;
  if (w.YT && w.YT.Player) return w.YT;
  if (w.__lpediaYtLoading) return w.__lpediaYtLoading;
  w.__lpediaYtLoading = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-lpedia-youtube-api="1"]');
    if (!existing) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.dataset.lpediaYoutubeApi = '1';
      tag.onerror = () => reject(new Error('YouTube API 載入失敗'));
      const first = document.getElementsByTagName('script')[0];
      if (first && first.parentNode) first.parentNode.insertBefore(tag, first);
      else document.head.appendChild(tag);
    }
    w.onYouTubeIframeAPIReady = () => resolve(w.YT);
  });
  return w.__lpediaYtLoading;
};

export default function ReviewPackageDraftEditorModal({
  open,
  onClose,
  draftId: draftIdToOpen,
  availableSubjects,
  availableGrades,
  availableClasses,
  onPublished
}: Props) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [durationText, setDurationText] = useState('');
  const [checkpoints, setCheckpoints] = useState<DraftCheckpoint[]>([]);
  const [error, setError] = useState('');
  const [loadingDraft, setLoadingDraft] = useState(false);

  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<any | null>(null);
  const ytPollRef = useRef<number | null>(null);
  const [ytReady, setYtReady] = useState(false);
  const [ytTime, setYtTime] = useState(0);
  const [ytDuration, setYtDuration] = useState(0);

  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string>('');

  const [draftId, setDraftId] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState<'save' | 'publish'>('save');

  const youtubeVideoId = useMemo(() => parseYouTubeVideoId(videoUrl) || '', [videoUrl]);

  const destroyYouTube = () => {
    setYtReady(false);
    setYtTime(0);
    setYtDuration(0);
    if (ytPollRef.current) {
      window.clearInterval(ytPollRef.current);
      ytPollRef.current = null;
    }
    const p = ytPlayerRef.current;
    ytPlayerRef.current = null;
    if (p && typeof p.destroy === 'function') {
      try { p.destroy(); } catch { /* ignore */ }
    }
  };

  useEffect(() => {
    if (!open) return;
    setWizardOpen(false);
	    setWizardMode('save');
	    setError('');
	    setLoadingDraft(false);
	    setSelectedCheckpointId('');
	    destroyYouTube();

	    const incomingId = String(draftIdToOpen || '').trim();
	    if (!incomingId) {
	      setTitle('');
	      setSubject(availableSubjects[0] || '');
	      setVideoUrl('');
	      setDurationText('');
	      setCheckpoints([]);
	      setDraftId('');
	      setSelectedCheckpointId('');
	      return;
	    }

    setLoadingDraft(true);
    void (async () => {
      try {
        const resp = await authService.getDraft(incomingId);
        const d = resp?.draft;
        if (!d) throw new Error('找不到草稿');
        if (String(d.toolType || '') !== 'review-package') throw new Error('草稿類型不正確');
        setDraftId(String(d.id || incomingId));
        setTitle(String(d.title || ''));
        setSubject(String(d.subject || availableSubjects[0] || ''));
	        const snap = d.contentSnapshot?.reviewPackage;
	        setVideoUrl(String(snap?.videoUrl || ''));
	        setDurationText(snap?.videoDurationSec ? formatSec(Number(snap.videoDurationSec) || 0) : '');
	        const cps = Array.isArray(snap?.checkpoints) ? snap.checkpoints : [];
	        const next = cps.map((c: any) => ({
	          id: String(c?.id || newId()),
	          timestampSec: clampInt(c?.timestampSec),
	          required: c?.required !== false,
	          points: Math.max(0, Number(c?.points) || 0),
	          questionText: String(c?.questionText || ''),
	          options: Array.isArray(c?.options) ? c.options.map((o: any) => String(o || '')) : ['A', 'B', 'C', 'D'],
	          correctIndex: clampInt(c?.correctIndex, 0, 7)
	        }));
	        setCheckpoints(next);
	        setSelectedCheckpointId(next.length > 0 ? String(next[0]?.id || '') : '');
	      } catch (e: any) {
	        setError(e?.message || '載入草稿失敗');
	      } finally {
	        setLoadingDraft(false);
      }
    })();
  }, [open, availableSubjects, draftIdToOpen]);

  useEffect(() => {
    if (!open) return;
    if (!selectedCheckpointId) {
      if (checkpoints.length > 0) setSelectedCheckpointId(String(checkpoints[0]?.id || ''));
      return;
    }
    if (!checkpoints.some((c) => c.id === selectedCheckpointId)) {
      setSelectedCheckpointId(checkpoints.length > 0 ? String(checkpoints[0]?.id || '') : '');
    }
  }, [open, checkpoints, selectedCheckpointId]);

  useEffect(() => {
    if (!open) return;
    if (!youtubeVideoId) {
      destroyYouTube();
      return;
    }
    const container = ytContainerRef.current;
    if (!container) return;

    destroyYouTube();

    void (async () => {
      try {
        const YT = await loadYouTubeIframeApi();
        if (!YT || !YT.Player) {
          setError('YouTube 播放器載入失敗');
          return;
        }

        const player = new YT.Player(container, {
          videoId: youtubeVideoId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            fs: 1,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin
          },
          events: {
            onReady: () => {
              ytPlayerRef.current = player;
              setYtReady(true);
              try { setYtDuration(Number(player.getDuration?.()) || 0); } catch { /* ignore */ }
              if (ytPollRef.current) window.clearInterval(ytPollRef.current);
              ytPollRef.current = window.setInterval(() => {
                try {
                  const t = Number(player.getCurrentTime?.()) || 0;
                  const d = Number(player.getDuration?.()) || 0;
                  setYtTime(t);
                  if (d > 0) setYtDuration(d);
                } catch {
                  // ignore
                }
              }, 250);
            },
            onError: () => {
              setError('此 YouTube 影片不允許嵌入播放或載入失敗，請更換影片。');
            }
          }
        });
        ytPlayerRef.current = player;
      } catch (e: any) {
        setError(e?.message || 'YouTube 播放器載入失敗');
      }
    })();

    return () => {
      destroyYouTube();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, youtubeVideoId]);

  const selectedCheckpoint = useMemo(() => {
    const id = String(selectedCheckpointId || '');
    return checkpoints.find((c) => c.id === id) || null;
  }, [checkpoints, selectedCheckpointId]);

  const addCheckpointAt = (sec: number) => {
    const id = newId();
    setCheckpoints((prev) => ([
      ...prev,
      {
        id,
        timestampSec: clampInt(sec),
        required: true,
        points: 1,
        questionText: '',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0
      }
    ]));
    setSelectedCheckpointId(id);
  };

  const seekTo = (sec: number) => {
    const p = ytPlayerRef.current;
    if (!p || typeof p.seekTo !== 'function') return;
    try { p.seekTo(Math.max(0, Number(sec) || 0), true); } catch { /* ignore */ }
  };

  const normalizedCheckpointsForSave = useMemo(() => {
    return checkpoints
      .map((c) => ({
        ...c,
        timestampSec: clampInt(c.timestampSec),
        points: Math.max(0, Number(c.points) || 0),
        correctIndex: clampInt(c.correctIndex, 0, 7),
        options: Array.isArray(c.options) ? c.options.map((o) => String(o || '')) : []
      }))
      .slice()
      .sort((a, b) => a.timestampSec - b.timestampSec);
  }, [checkpoints]);

  const openWizard = (mode: 'save' | 'publish') => {
    setError('');
    setWizardMode(mode);
    setWizardOpen(true);
  };

  const validate = (mode: 'save' | 'publish') => {
    const t = String(title || '').trim();
    if (!t) return '請先輸入標題';
    const s = String(subject || '').trim();
    if (!s) return '請先選擇科目';
    const url = String(videoUrl || '').trim();
    if (!url) return '請先輸入影片連結';
    const yt = parseYouTubeVideoId(url);
    if (!yt) return '請輸入有效的 YouTube 連結（或 11 位 videoId）';
    if (mode === 'publish') {
      for (const c of normalizedCheckpointsForSave) {
        if (!c.id) return '題目時間點缺少 id';
        if (!Number.isFinite(c.timestampSec) || c.timestampSec < 0) return '題目時間點格式不正確';
        const opts = Array.isArray(c.options) ? c.options : [];
        if (opts.length < 2) return '每題至少需要 2 個選項';
        if (c.correctIndex < 0 || c.correctIndex >= opts.length) return '正確答案索引不正確';
        if (!String(c.questionText || '').trim()) return '題目內容不可為空';
      }
    }
    return '';
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4">
	        <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-comic">
          <div className="p-6 border-b-4 border-brand-brown bg-[#C0E2BE] flex items-center justify-between">
            <div>
              <div className="text-2xl font-black text-brand-brown">建立温習套件</div>
              <div className="text-sm text-brand-brown/80 font-bold">固定 1x；可回放；不可快進；到點必答</div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
              aria-label="關閉"
            >
              <X className="w-6 h-6 text-brand-brown" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {error && <div className="text-red-600 font-bold">{error}</div>}

            {loadingDraft ? (
              <div className="text-center font-black text-brand-brown py-8">載入草稿中...</div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <div className="text-sm font-black text-brand-brown mb-1">標題</div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 rounded-2xl border-4 border-brand-brown font-bold"
                  placeholder="例如：温習套件 - 物質三態"
                />
              </label>

              <label className="block">
                <div className="text-sm font-black text-brand-brown mb-1">科目</div>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-2 rounded-2xl border-4 border-brand-brown font-bold bg-white"
                >
                  {availableSubjects.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <div className="text-sm font-black text-brand-brown mb-1">YouTube 影片連結（或 11 位 videoId）</div>
              <input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="w-full px-4 py-2 rounded-2xl border-4 border-brand-brown font-bold"
                placeholder="https://..."
              />
              <div className="mt-1 text-xs font-bold text-gray-700">
                例：<span className="font-black">https://youtu.be/VIDEO_ID</span> 或 <span className="font-black">https://www.youtube.com/watch?v=VIDEO_ID</span>
              </div>
            </label>

            <label className="block">
              <div className="text-sm font-black text-brand-brown mb-1">影片長度（選填，用於完成判定；格式 mm:ss 或秒數）</div>
              <input
                value={durationText}
                onChange={(e) => setDurationText(e.target.value)}
                className="w-full px-4 py-2 rounded-2xl border-4 border-brand-brown font-bold"
                placeholder="例如：12:34"
              />
            </label>

              <div className="bg-white border-4 border-brand-brown rounded-3xl p-4 shadow-comic">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="text-lg font-black text-brand-brown">題目時間點（MCQ）</div>
                  <div className="text-sm font-bold text-gray-700">
                    播放/拖曳影片到合適時間，然後按「增加題目」
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-3">
                    <div className="bg-black rounded-2xl overflow-hidden border-4 border-brand-brown">
                      <div className="w-full bg-black relative" style={{ aspectRatio: '16 / 9' }}>
                        <div ref={ytContainerRef} className="w-full h-full" />
                        {!youtubeVideoId && (
                          <div className="absolute inset-0 flex items-center justify-center text-white font-black text-center px-6">
                            先輸入有效的 YouTube 連結後，這裡會顯示影片預覽
                          </div>
                        )}
                        {youtubeVideoId && !ytReady && !error && (
                          <div className="absolute inset-0 flex items-center justify-center text-white font-black">
                            載入 YouTube 播放器中...
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div className="text-sm font-black text-brand-brown">
                        目前時間：{formatSec(Math.floor(ytTime || 0))}
                        <span className="ml-2 text-xs font-bold text-gray-700">/ {formatSec(Math.floor(ytDuration || 0))}</span>
                      </div>
                      <button
                        type="button"
                        disabled={!youtubeVideoId || !ytReady}
                        onClick={() => addCheckpointAt(Math.floor(ytTime || 0))}
                        className={[
                          'px-4 py-2 rounded-2xl border-4 border-brand-brown font-black shadow-comic active:translate-y-1 active:shadow-none flex items-center gap-2',
                          !youtubeVideoId || !ytReady ? 'bg-gray-200 text-gray-600 cursor-not-allowed' : 'bg-[#FDEEAD] text-brand-brown hover:bg-[#FCE690]'
                        ].join(' ')}
                      >
                        <Plus className="w-5 h-5" />
                        增加題目（在 {formatSec(Math.floor(ytTime || 0))}）
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-black text-brand-brown">題目列表</div>
                      <div className="text-sm font-bold text-gray-700">共 {normalizedCheckpointsForSave.length} 題</div>
                    </div>

                    {normalizedCheckpointsForSave.length === 0 ? (
                      <div className="text-sm font-bold text-gray-600 border-4 border-dashed border-gray-300 rounded-3xl p-6 text-center">
                        尚未設定題目時間點（可留空，只觀看影片）
                      </div>
                    ) : (
                      <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
                        {normalizedCheckpointsForSave.map((c, idx) => {
                          const active = c.id === selectedCheckpointId;
                          const hasText = !!String(c.questionText || '').trim();
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedCheckpointId(c.id);
                                if (ytReady) {
                                  seekTo(c.timestampSec);
                                  try { ytPlayerRef.current?.pauseVideo?.(); } catch { /* ignore */ }
                                }
                              }}
                              className={[
                                'w-full text-left px-4 py-3 rounded-2xl border-4 shadow-comic active:translate-y-1 active:shadow-none transition-all',
                                active ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown' : 'bg-white border-brand-brown text-gray-800 hover:-translate-y-1'
                              ].join(' ')}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="font-black truncate">
                                  {idx + 1}. {formatSec(c.timestampSec)}
                                  {c.required ? null : <span className="ml-2 text-xs font-black text-gray-700">（選答）</span>}
                                </div>
                                <div className="text-xs font-bold text-gray-700 shrink-0">
                                  {hasText ? '已填題目' : '未填題目'}
                                </div>
                              </div>
                              <div className="text-xs font-bold text-gray-700 mt-1 truncate">
                                {hasText ? String(c.questionText || '') : '（尚未輸入題目內容）'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  {selectedCheckpoint ? (
                    <div className="bg-white border-4 border-brand-brown rounded-3xl p-4 shadow-comic space-y-3">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="font-black text-brand-brown">
                          編輯題目：{formatSec(selectedCheckpoint.timestampSec)}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={!ytReady}
                            onClick={() => {
                              seekTo(selectedCheckpoint.timestampSec);
                              try { ytPlayerRef.current?.pauseVideo?.(); } catch { /* ignore */ }
                            }}
                            className={[
                              'px-3 py-2 rounded-2xl bg-white border-4 border-brand-brown text-brand-brown font-black hover:bg-gray-50 shadow-comic active:translate-y-1 active:shadow-none',
                              !ytReady ? 'opacity-60 cursor-not-allowed' : ''
                            ].join(' ')}
                          >
                            跳到此時間
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCheckpoints((prev) => prev.filter((x) => x.id !== selectedCheckpoint.id));
                            }}
                            className="px-3 py-2 rounded-2xl bg-white border-4 border-brand-brown text-brand-brown font-black hover:bg-gray-50 shadow-comic active:translate-y-1 active:shadow-none flex items-center gap-2"
                          >
                            <Trash2 className="w-5 h-5" />
                            刪除
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <label className="block">
                          <div className="text-xs font-black text-brand-brown mb-1">時間點（秒）</div>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min={0}
                              value={String(selectedCheckpoint.timestampSec)}
                              onChange={(e) => {
                                const v = clampInt(e.target.value);
                                setCheckpoints((prev) => prev.map((x) => x.id === selectedCheckpoint.id ? { ...x, timestampSec: v } : x));
                              }}
                              className="w-full px-3 py-2 rounded-2xl border-4 border-brand-brown font-bold"
                            />
                            <button
                              type="button"
                              disabled={!ytReady}
                              onClick={() => {
                                const v = Math.floor(ytTime || 0);
                                setCheckpoints((prev) => prev.map((x) => x.id === selectedCheckpoint.id ? { ...x, timestampSec: clampInt(v) } : x));
                              }}
                              className={[
                                'px-3 py-2 rounded-2xl border-4 border-brand-brown font-black shadow-comic active:translate-y-1 active:shadow-none',
                                !ytReady ? 'bg-gray-200 text-gray-600 cursor-not-allowed' : 'bg-[#FDEEAD] text-brand-brown hover:bg-[#FCE690]'
                              ].join(' ')}
                            >
                              用目前時間
                            </button>
                          </div>
                          <div className="mt-1 text-xs font-bold text-gray-700">顯示：{formatSec(selectedCheckpoint.timestampSec)}</div>
                        </label>

                        <label className="block">
                          <div className="text-xs font-black text-brand-brown mb-1">分數（points）</div>
                          <input
                            type="number"
                            min={0}
                            value={String(selectedCheckpoint.points)}
                            onChange={(e) => setCheckpoints((prev) => prev.map((x) => x.id === selectedCheckpoint.id ? { ...x, points: Number(e.target.value) || 0 } : x))}
                            className="w-full px-3 py-2 rounded-2xl border-4 border-brand-brown font-bold"
                          />
                        </label>

                        <label className="flex items-center gap-2 font-black text-brand-brown mt-6">
                          <input
                            type="checkbox"
                            checked={selectedCheckpoint.required}
                            onChange={(e) => setCheckpoints((prev) => prev.map((x) => x.id === selectedCheckpoint.id ? { ...x, required: e.target.checked } : x))}
                          />
                          必答（required）
                        </label>
                      </div>

                      <label className="block">
                        <div className="text-xs font-black text-brand-brown mb-1">題目</div>
                        <textarea
                          value={selectedCheckpoint.questionText}
                          onChange={(e) => setCheckpoints((prev) => prev.map((x) => x.id === selectedCheckpoint.id ? { ...x, questionText: e.target.value } : x))}
                          className="w-full px-3 py-2 rounded-2xl border-4 border-brand-brown font-bold min-h-[70px]"
                          placeholder="輸入題目內容"
                        />
                      </label>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {((Array.isArray(selectedCheckpoint.options) && selectedCheckpoint.options.length > 0) ? selectedCheckpoint.options : ['']).map((opt, optIdx) => (
                          <label key={optIdx} className="block">
                            <div className="text-xs font-black text-brand-brown mb-1">選項 {optIdx + 1}</div>
                            <input
                              value={opt}
                              onChange={(e) => {
                                const value = e.target.value;
                                setCheckpoints((prev) => prev.map((x) => {
                                  if (x.id !== selectedCheckpoint.id) return x;
                                  const next = (Array.isArray(x.options) ? x.options.slice() : []);
                                  next[optIdx] = value;
                                  return { ...x, options: next };
                                }));
                              }}
                              className="w-full px-3 py-2 rounded-2xl border-4 border-brand-brown font-bold"
                            />
                          </label>
                        ))}
                      </div>

                      <label className="block">
                        <div className="text-xs font-black text-brand-brown mb-1">正確答案（提交後才顯示回饋給學生）</div>
                        <select
                          value={String(selectedCheckpoint.correctIndex)}
                          onChange={(e) => setCheckpoints((prev) => prev.map((x) => x.id === selectedCheckpoint.id ? { ...x, correctIndex: Number(e.target.value) || 0 } : x))}
                          className="w-full px-3 py-2 rounded-2xl border-4 border-brand-brown font-bold bg-white"
                        >
                          {((Array.isArray(selectedCheckpoint.options) && selectedCheckpoint.options.length > 0) ? selectedCheckpoint.options : ['']).map((opt, optIdx) => (
                            <option key={optIdx} value={String(optIdx)}>
                              {optIdx + 1}. {String(opt || '').slice(0, 30)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : (
                    <div className="text-sm font-bold text-gray-700">
                      先按「增加題目」或在右側選取題目以編輯
                    </div>
                  )}
                </div>
              </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => openWizard('save')}
                className="px-4 py-2 rounded-2xl bg-white border-4 border-brand-brown text-brand-brown font-black hover:bg-gray-50 shadow-comic active:translate-y-1 active:shadow-none"
              >
                儲存草稿
              </button>
              <button
                type="button"
                onClick={() => openWizard('publish')}
                className="px-4 py-2 rounded-2xl bg-[#93C47D] border-4 border-brand-brown text-brand-brown font-black hover:bg-[#86b572] shadow-comic active:translate-y-1 active:shadow-none"
              >
                儲存及派發
              </button>
            </div>
          </div>
        </div>
      </div>

      <DraftSavePublishWizardModal
        open={wizardOpen}
        mode={wizardMode}
        onClose={() => setWizardOpen(false)}
        authService={authService}
        availableGrades={availableGrades}
        availableClasses={availableClasses}
        title={title}
        allowShared={true}
	        keepDraftDefault={true}
	        onSave={async (picked) => {
	          const msg = validate(wizardMode);
	          if (msg) {
	            setError(msg);
	            throw new Error(msg);
	          }

	          const durationSec = durationText ? parseTimeToSec(durationText) : null;
	          const youtubeVideoIdForSave = parseYouTubeVideoId(videoUrl);
	          if (!youtubeVideoIdForSave) {
	            const msg = '請輸入有效的 YouTube 連結（或 11 位 videoId）';
	            setError(msg);
	            throw new Error(msg);
	          }
	          const contentSnapshot = {
	            reviewPackage: {
	              videoUrl: String(videoUrl || '').trim(),
	              videoProvider: 'youtube',
	              youtubeVideoId: youtubeVideoIdForSave,
	              videoDurationSec: durationSec === null ? null : clampInt(durationSec),
	              checkpoints: normalizedCheckpointsForSave.map((c) => ({
	                id: c.id,
	                timestampSec: clampInt(c.timestampSec),
                required: c.required !== false,
                points: Math.max(0, Number(c.points) || 0),
                questionText: String(c.questionText || ''),
                options: Array.isArray(c.options) ? c.options.map((o) => String(o || '')) : [],
                correctIndex: clampInt(c.correctIndex, 0, 7)
              }))
            }
          };

          const titleTrim = String(title || '').trim();
          const subjectTrim = String(subject || '').trim();

          if (!draftId) {
            const resp = await authService.createDraft({
              toolType: 'review-package',
              title: titleTrim,
              subject: subjectTrim,
              grade: picked.grade,
              scope: picked.scope,
              folderId: picked.folderId,
              contentSnapshot
            });
            const id = String(resp?.draft?.id || '');
            setDraftId(id);
            return { draftId: id };
          }

          await authService.updateDraftMeta(draftId, {
            title: titleTrim,
            subject: subjectTrim,
            grade: picked.grade,
            scope: picked.scope,
            folderId: picked.folderId
          });
          await authService.updateDraftContent(draftId, contentSnapshot);
          return { draftId };
        }}
        onPublished={() => {
          onPublished?.();
        }}
      />
    </>
  );
}
