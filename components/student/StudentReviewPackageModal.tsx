import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Play, Pause, Lock, CheckCircle2, XCircle, Maximize2, Minimize2 } from 'lucide-react';
import { authService } from '../../services/authService';

type Props = {
  open: boolean;
  packageId: string | null;
  onClose: () => void;
  onFinished?: () => void;
};

type Checkpoint = {
  id: string;
  timestampSec: number;
  required: boolean;
  points: number;
  questionText: string;
  options: string[];
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const formatTime = (sec: number) => {
  const s = Math.max(0, Math.floor(sec || 0));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

const parseYouTubeVideoId = (input: string) => {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    const host = String(url.hostname || '').toLowerCase();
    const isYouTube = host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be';
    if (!isYouTube) return '';
    if (host === 'youtu.be') {
      const id = url.pathname.replace(/^\/+/, '').slice(0, 64);
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : '';
    }
    const v = url.searchParams.get('v');
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    const parts = url.pathname.split('/').filter(Boolean);
    const embedIdx = parts.findIndex((p) => p === 'embed');
    if (embedIdx >= 0 && parts[embedIdx + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[embedIdx + 1])) return parts[embedIdx + 1];
    const shortsIdx = parts.findIndex((p) => p === 'shorts');
    if (shortsIdx >= 0 && parts[shortsIdx + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[shortsIdx + 1])) return parts[shortsIdx + 1];
  } catch {
    return '';
  }
  return '';
};

export function StudentReviewPackageModal({ open, packageId, onClose, onFinished }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ytPlayerRef = useRef<any | null>(null);
  const ytPollRef = useRef<number | null>(null);
  const ytReadyRef = useRef(false);
  const ytSeekGuardRef = useRef(false);
  const ytPollStateRef = useRef<{ t: number; at: number }>({ t: 0, at: 0 });
  const ytContainerIdRef = useRef<string>('');
  const seekingGuardRef = useRef(false);
  const maxReachedRef = useRef(0);
  const lockedRef = useRef(false);
  const attemptRef = useRef<any | null>(null);
  const checkpointsRef = useRef<Checkpoint[]>([]);
  const activeCheckpointIdRef = useRef<string | null>(null);
  const lastReportRef = useRef<{ max: number; pos: number; at: number }>({ max: 0, pos: 0, at: 0 });
  const diagnosedRef = useRef(false);
  const fsRootRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [pkg, setPkg] = useState<any | null>(null);
  const [attempt, setAttempt] = useState<any | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [ytReady, setYtReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [locked, setLocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [activeCheckpointId, setActiveCheckpointId] = useState<string | null>(null);
  const [editingCheckpointId, setEditingCheckpointId] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [submitting, setSubmitting] = useState(false);
  const [finalSubmitting, setFinalSubmitting] = useState(false);
  const [report, setReport] = useState<any | null>(null);

  const videoProvider = String(pkg?.videoProvider || 'youtube');
  const youtubeVideoId = String(pkg?.youtubeVideoId || '').trim() || parseYouTubeVideoId(String(pkg?.videoUrl || ''));
  const isYouTube = videoProvider === 'youtube' && !!youtubeVideoId;

  useEffect(() => {
    maxReachedRef.current = maxReached;
  }, [maxReached]);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  useEffect(() => {
    attemptRef.current = attempt;
  }, [attempt]);

  const checkpoints: Checkpoint[] = useMemo(() => {
    const cps = Array.isArray(pkg?.checkpoints) ? pkg.checkpoints : [];
    return cps
      .filter((c: any) => c && c.id)
      .map((c: any) => ({
        id: String(c.id),
        timestampSec: Number(c.timestampSec) || 0,
        required: c.required !== false,
        points: Number(c.points) || 1,
        questionText: String(c.questionText || ''),
        options: Array.isArray(c.options) ? c.options.map((o: any) => String(o || '')) : []
      }))
      .slice()
      .sort((a, b) => a.timestampSec - b.timestampSec);
  }, [pkg]);

  useEffect(() => {
    checkpointsRef.current = checkpoints;
  }, [checkpoints]);

  useEffect(() => {
    activeCheckpointIdRef.current = activeCheckpointId;
  }, [activeCheckpointId]);

  const answeredIds = useMemo(() => {
    const answers = Array.isArray(attempt?.answers) ? attempt.answers : [];
    return new Set(answers.map((a: any) => String(a?.checkpointId || '')).filter(Boolean));
  }, [attempt]);

  const selectedByCheckpointId = useMemo(() => {
    const answers = Array.isArray(attempt?.answers) ? attempt.answers : [];
    const map = new Map<string, number>();
    for (const a of answers) {
      const id = String(a?.checkpointId || '');
      if (!id) continue;
      const sel = Number.isInteger(Number(a?.selectedIndex)) ? Number(a.selectedIndex) : -1;
      map.set(id, sel);
    }
    return map;
  }, [attempt]);

  const requiredCheckpointIds = useMemo(() => checkpoints.filter((c) => c.required).map((c) => c.id), [checkpoints]);

  const nextRequiredCheckpoint = useMemo(() => {
    const req = checkpoints.filter((c) => c.required);
    return req.find((c) => !answeredIds.has(c.id)) || null;
  }, [checkpoints, answeredIds]);

  const activeCheckpoint = useMemo(() => {
    if (!activeCheckpointId) return null;
    return checkpoints.find((c) => c.id === activeCheckpointId) || null;
  }, [activeCheckpointId, checkpoints]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(''), 2000);
  };

  const safePause = () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      v.pause();
    } catch {
      // ignore
    }
  };

  const safePlay = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      v.playbackRate = 1;
      await v.play();
    } catch (e: any) {
      const name = String(e?.name || '');
      if (name === 'NotAllowedError') {
        setError('瀏覽器阻止播放（NotAllowed）。請再按一次播放，或點一下影片畫面。');
      } else if (name === 'NotSupportedError') {
        setError('此影片連結不支援直接播放（NotSupported）。若是 SharePoint 分享連結，可嘗試在原連結加上 &download=1，或改用可直接播放的 mp4 連結。');
      } else {
        setError(e?.message || '播放失敗：請檢查影片連結是否可直接播放');
      }
    }
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

  const destroyYouTube = () => {
    ytReadyRef.current = false;
    setYtReady(false);
    ytPollStateRef.current = { t: 0, at: 0 };
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

  const getYouTubeTime = () => {
    const p = ytPlayerRef.current;
    if (!p || typeof p.getCurrentTime !== 'function') return 0;
    try { return Number(p.getCurrentTime()) || 0; } catch { return 0; }
  };

  const getYouTubeDuration = () => {
    const p = ytPlayerRef.current;
    if (!p || typeof p.getDuration !== 'function') return 0;
    try { return Number(p.getDuration()) || 0; } catch { return 0; }
  };

  const ytPause = () => {
    const p = ytPlayerRef.current;
    if (!p || typeof p.pauseVideo !== 'function') return;
    try { p.pauseVideo(); } catch { /* ignore */ }
  };

  const ytPlay = () => {
    const p = ytPlayerRef.current;
    if (!p || typeof p.playVideo !== 'function') return;
    try { p.playVideo(); } catch { /* ignore */ }
  };

  const ytSeekTo = (sec: number) => {
    const p = ytPlayerRef.current;
    if (!p || typeof p.seekTo !== 'function') return;
    ytSeekGuardRef.current = true;
    try { p.seekTo(Math.max(0, sec), true); } catch { /* ignore */ }
    window.setTimeout(() => { ytSeekGuardRef.current = false; }, 0);
  };

  const reportProgress = async (opts?: { ended?: boolean; force?: boolean; posSec?: number; maxSec?: number }) => {
    const pid = packageId || '';
    if (!pid) return;
    const pos = Math.floor(Number(opts?.posSec ?? currentTime) || 0);
    const max = Math.floor(Number(opts?.maxSec ?? maxReachedRef.current) || 0);
    const now = Date.now();
    const force = opts?.force === true;
    if (!force) {
      const last = lastReportRef.current;
      const changed = Math.abs(max - last.max) >= 1 || Math.abs(pos - last.pos) >= 1;
      if (!changed && now - last.at < 8000) return;
    }
    lastReportRef.current = { max, pos, at: now };
    try {
      const resp = await authService.reportReviewPackageProgress(pid, { maxReachedSec: max, lastPositionSec: pos, ...(opts?.ended ? { ended: true } : null) });
      if (resp?.attempt) setAttempt(resp.attempt);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!open || !packageId) return;
    setLoading(true);
    setError('');
    setPkg(null);
    setAttempt(null);
    setToast('');
    setIsPlaying(false);
    setYtReady(false);
    setDuration(0);
    setCurrentTime(0);
    setMaxReached(0);
    setLocked(false);
    setActiveCheckpointId(null);
    setEditingCheckpointId(null);
    setSelectedIndex(-1);
    setSubmitting(false);
    setFinalSubmitting(false);
    setReport(null);
    setIsFullscreen(false);
    diagnosedRef.current = false;
    ytContainerIdRef.current = '';
    destroyYouTube();
    ytPollStateRef.current = { t: 0, at: 0 };
    lastReportRef.current = { max: 0, pos: 0, at: 0 };
    (async () => {
      try {
        const resp = await authService.getReviewPackageForStudent(packageId);
        setPkg(resp?.package || null);
        setAttempt(resp?.attempt || null);
        setReport(resp?.report || null);
        const max = Number(resp?.attempt?.maxReachedSec) || 0;
        setMaxReached(max);
        maxReachedRef.current = max;
        const resume = Number(resp?.attempt?.lastPositionSec) || 0;
        setCurrentTime(clamp(resume, 0, max || resume || 0));
      } catch (e: any) {
        setError(e?.message || '載入温習套件失敗');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, packageId]);

  useEffect(() => {
    if (!open) return;
    const onFsChange = () => {
      const el = fsRootRef.current;
      const active = !!el && document.fullscreenElement === el;
      setIsFullscreen(active);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    onFsChange();
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [open]);

  const toggleFullscreen = async () => {
    const el = fsRootRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => {
      void reportProgress();
    }, 5000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, packageId]);

  useEffect(() => {
    if (!open) return;
    return () => {
      destroyYouTube();
      void reportProgress({ force: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, packageId]);

  useEffect(() => {
    if (!open) return;
    if (!packageId) return;
    if (!isYouTube) return;
    if (!youtubeVideoId) return;

    if (!ytContainerIdRef.current) ytContainerIdRef.current = `yt-${packageId}-${Math.random().toString(16).slice(2)}`;

    setError('');
    ytReadyRef.current = false;
    setYtReady(false);
    ytPollStateRef.current = { t: 0, at: 0 };
    destroyYouTube();

    void (async () => {
      try {
        const YT = await loadYouTubeIframeApi();
        if (!YT || !YT.Player) {
          setError('YouTube 播放器載入失敗');
          return;
        }

        const player = new YT.Player(ytContainerIdRef.current, {
          videoId: youtubeVideoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
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
              ytReadyRef.current = true;
              setYtReady(true);
              try {
                if (typeof player.setPlaybackRate === 'function') player.setPlaybackRate(1);
              } catch {
                // ignore
              }
              const d = getYouTubeDuration();
              if (d > 0) setDuration(d);
              const resume = clamp(currentTime, 0, Math.max(0, maxReachedRef.current || 0));
              if (resume > 0) ytSeekTo(resume);
            },
            onStateChange: (evt: any) => {
              const state = typeof evt?.data === 'number' ? evt.data : null;
              if (state === 1) {
                if (lockedRef.current) {
                  ytPause();
                  showToast('請先完成題目');
                  return;
                }
                setIsPlaying(true);
                // ensure 1x
                try {
                  if (typeof player.setPlaybackRate === 'function') player.setPlaybackRate(1);
                } catch {
                  // ignore
                }
              } else if (state === 2) {
                setIsPlaying(false);
              } else if (state === 0) {
                setIsPlaying(false);
                const pos = Math.floor(getYouTubeTime());
                const max = Math.floor(Math.max(maxReachedRef.current, pos));
                setCurrentTime(pos);
                setMaxReached(max);
                void reportProgress({ ended: true, force: true, posSec: pos, maxSec: max });
                onFinished?.();
              }
            },
            onPlaybackRateChange: () => {
              try {
                if (typeof player.setPlaybackRate === 'function') player.setPlaybackRate(1);
              } catch {
                // ignore
              }
              showToast('倍速已鎖定為 1x');
            },
            onError: () => {
              setError('此 YouTube 影片不允許嵌入播放或載入失敗，請更換影片。');
            }
          }
        });

        ytPlayerRef.current = player;
        if (ytPollRef.current) window.clearInterval(ytPollRef.current);
        ytPollRef.current = window.setInterval(() => {
          if (!ytReadyRef.current) return;
          const t = getYouTubeTime();
          const d = getYouTubeDuration();
          if (d > 0) setDuration(d);
          setCurrentTime(t);

          if (!ytSeekGuardRef.current && !lockedRef.current) {
            const allowedMax = maxReachedRef.current || 0;
            const now = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
            const prev = ytPollStateRef.current;
            const wallDelta = prev.at > 0 ? Math.max(0, (now - prev.at) / 1000) : 0;
            const timeDelta = prev.at > 0 ? t - prev.t : 0;
            ytPollStateRef.current = { t, at: now };

            const tolerance = Math.max(1.25, wallDelta + 0.75);
            const jumpedForward = timeDelta > tolerance && t > allowedMax + tolerance;
            if (jumpedForward) {
              ytSeekTo(allowedMax);
              showToast('請勿跳過影片');
              setCurrentTime(allowedMax);
              return;
            }
          } else {
            const now = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
            ytPollStateRef.current = { t, at: now };
          }

          if (!lockedRef.current) {
            const nextMax = Math.max(maxReachedRef.current || 0, t);
            if (nextMax !== maxReachedRef.current) {
              maxReachedRef.current = nextMax;
              setMaxReached(nextMax);
            }
          }

          void reportProgress({ posSec: t, maxSec: maxReachedRef.current });
          maybeGateAtCheckpoint(t);
        }, 300);
      } catch (e: any) {
        setError(e?.message || 'YouTube 播放器載入失敗');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, packageId, isYouTube, youtubeVideoId]);

  if (!open || !packageId) return null;

  if (isYouTube && !ytContainerIdRef.current) {
    ytContainerIdRef.current = `yt-${packageId}-${Math.random().toString(16).slice(2)}`;
  }

  const token = authService.getToken();
  const apiBase = authService.getApiBase();
  const proxiedSrc = token
    ? `${apiBase}/review-packages/${encodeURIComponent(packageId)}/video?token=${encodeURIComponent(token)}`
    : String(pkg?.videoUrl || '');

  const onSeekCheck = () => {
    const video = videoRef.current;
    if (!video) return;
    if (seekingGuardRef.current) return;
    const allowed = maxReachedRef.current || 0;
    const target = Number(video.currentTime) || 0;
    if (target > allowed + 0.5) {
      seekingGuardRef.current = true;
      try {
        video.currentTime = allowed;
      } finally {
        window.setTimeout(() => { seekingGuardRef.current = false; }, 0);
      }
      setCurrentTime(allowed);
      showToast('請勿跳過影片');
    }
  };

  const maybeGateAtCheckpoint = (timeSec?: number) => {
    if (lockedRef.current) return;
    if (activeCheckpointIdRef.current) return;
    const cps = Array.isArray(checkpointsRef.current) ? checkpointsRef.current : [];
    const answers = Array.isArray(attemptRef.current?.answers) ? attemptRef.current.answers : [];
    const answeredIdsLocal = new Set(answers.map((a: any) => String(a?.checkpointId || '')).filter(Boolean));
    const next = cps.filter((c) => c.required).find((c) => !answeredIdsLocal.has(c.id)) || null;
    if (!next) return;
    const t = Number(timeSec ?? currentTime) || 0;
    if (t + 0.05 >= next.timestampSec) {
      lockedRef.current = true;
      if (isYouTube) ytPause();
      else safePause();
      setLocked(true);
      activeCheckpointIdRef.current = next.id;
      setActiveCheckpointId(next.id);
      setSelectedIndex(-1);
    }
  };

  const submitAnswer = async () => {
    if (!activeCheckpoint) return;
    if (selectedIndex < 0) return;
    setSubmitting(true);
    setError('');
    try {
      const resp = await authService.submitReviewPackageCheckpoint(packageId, activeCheckpoint.id, selectedIndex);
      if (resp?.attempt) {
        attemptRef.current = resp.attempt;
        setAttempt(resp.attempt);
      }
      lockedRef.current = false;
      activeCheckpointIdRef.current = null;
      setLocked(false);
      setActiveCheckpointId(null);
      setSelectedIndex(-1);
      onFinished?.();
      if (isYouTube) {
        ytPlay();
      } else {
        await safePlay();
      }
    } catch (e: any) {
      setError(e?.message || '提交失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const saveEditedAnswer = async () => {
    const checkpoint = checkpoints.find((c) => c.id === editingCheckpointId) || null;
    if (!checkpoint) return;
    if (selectedIndex < 0) return;
    setSubmitting(true);
    setError('');
    try {
      const resp = await authService.submitReviewPackageCheckpoint(packageId, checkpoint.id, selectedIndex);
      if (resp?.attempt) {
        attemptRef.current = resp.attempt;
        setAttempt(resp.attempt);
      }
      setEditingCheckpointId(null);
      setSelectedIndex(-1);
      onFinished?.();
    } catch (e: any) {
      setError(e?.message || '更新答案失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const submitWholePackage = async () => {
    setFinalSubmitting(true);
    setError('');
    try {
      const resp = await authService.submitReviewPackage(packageId);
      if (resp?.attempt) {
        attemptRef.current = resp.attempt;
        setAttempt(resp.attempt);
      }
      setReport(resp?.report || null);
      showToast('已提交温習套件');
      onFinished?.();
    } catch (e: any) {
      setError(e?.message || '提交失敗');
    } finally {
      setFinalSubmitting(false);
    }
  };

  const progressPct = duration > 0 ? clamp((currentTime / duration) * 100, 0, 100) : 0;
  const watchedPct = duration > 0 ? clamp((maxReached / duration) * 100, 0, 100) : 0;
  const requiredDone = requiredCheckpointIds.every((id) => answeredIds.has(id));
  const watchedToEnd = !!attempt?.watchedToEnd;
  const readyToSubmit = requiredDone && watchedToEnd;
  const submitted = !!attempt?.completedAt;
  const completed = submitted;
  const canPlay = !locked && (!isYouTube || ytReady);
  const canEditAnswers = !submitted;
  const unlockedCheckpoints = checkpoints
    .filter((c) => c.required)
    .filter((c) => c.timestampSec <= (maxReachedRef.current || maxReached) + 0.5)
    .slice()
    .sort((a, b) => a.timestampSec - b.timestampSec);
  const editingCheckpoint = checkpoints.find((c) => c.id === editingCheckpointId) || null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4">
      <div
        ref={fsRootRef}
        className={[
          'bg-white border-4 border-brand-brown w-full overflow-y-auto shadow-comic',
          isFullscreen ? 'h-full max-h-none max-w-none rounded-none' : 'max-w-6xl max-h-[90vh] rounded-3xl'
        ].join(' ')}
      >
        <div className="p-5 border-b-4 border-brand-brown bg-[#C0E2BE] flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-2xl font-black text-brand-brown truncate">{String(pkg?.title || '温習套件')}</div>
            <div className="text-sm text-brand-brown/80 font-bold flex items-center gap-2">
              <span>倍速：固定 1x</span>
              {locked && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl border-2 border-brand-brown bg-white">
                  <Lock className="w-4 h-4" />
                  已鎖定（需答題）
                </span>
              )}
              {completed && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl border-2 border-green-700 bg-green-100 text-green-900">
                  <CheckCircle2 className="w-4 h-4" />
                  已完成
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
              aria-label={isFullscreen ? '退出全螢幕' : '全螢幕'}
              title={isFullscreen ? '退出全螢幕' : '全螢幕'}
            >
              {isFullscreen ? <Minimize2 className="w-6 h-6 text-brand-brown" /> : <Maximize2 className="w-6 h-6 text-brand-brown" />}
            </button>
            <button
              onClick={() => {
                void reportProgress({ force: true });
                try {
                  if (document.fullscreenElement) void document.exitFullscreen();
                } catch {
                  // ignore
                }
                onClose();
              }}
              className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
              aria-label="關閉"
            >
              <X className="w-6 h-6 text-brand-brown" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {toast && (
            <div className="bg-[#FFF2DC] border-4 border-brand-brown rounded-2xl px-4 py-2 font-black text-brand-brown">
              {toast}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border-4 border-red-300 rounded-2xl px-4 py-2 font-black text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center font-black text-brand-brown py-10">載入中...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4 items-start">
                <div className="space-y-3">
                  <div className="bg-black rounded-2xl overflow-hidden border-4 border-brand-brown">
                    {isYouTube ? (
                      <div className="w-full bg-black relative" style={{ aspectRatio: '16 / 9' }}>
                        <div id={ytContainerIdRef.current || `yt-${packageId}`} className="w-full h-full" />
                        {!ytReady && !error && (
                          <div className="absolute inset-0 flex items-center justify-center text-white font-black">
                            載入 YouTube 播放器中...
                          </div>
                        )}
                      </div>
                    ) : (
                      <video
                        ref={videoRef}
                        src={proxiedSrc}
                        className="w-full max-h-[55vh] bg-black"
                        controls={false}
                        playsInline
                        onLoadedMetadata={() => {
                          const video = videoRef.current;
                          if (!video) return;
                          const d = Number(video.duration) || 0;
                          setDuration(d);
                          const resume = clamp(currentTime, 0, d || currentTime || 0);
                          seekingGuardRef.current = true;
                          try {
                            if (Number.isFinite(resume) && resume > 0) video.currentTime = resume;
                            video.playbackRate = 1;
                          } finally {
                            window.setTimeout(() => { seekingGuardRef.current = false; }, 0);
                          }
                        }}
                        onTimeUpdate={() => {
                          const video = videoRef.current;
                          if (!video) return;
                          const t = Number(video.currentTime) || 0;
                          setCurrentTime(t);
                          const nextMax = Math.max(maxReachedRef.current || 0, t);
                          maxReachedRef.current = nextMax;
                          setMaxReached(nextMax);
                          void reportProgress({ posSec: t, maxSec: nextMax });
                          maybeGateAtCheckpoint(t);
                        }}
                        onSeeking={onSeekCheck}
                        onRateChange={() => {
                          const video = videoRef.current;
                          if (!video) return;
                          if (video.playbackRate !== 1) {
                            video.playbackRate = 1;
                            showToast('倍速已鎖定為 1x');
                          }
                        }}
                        onError={() => {
                          const video = videoRef.current;
                          const code = video?.error?.code;
                          const msg = code === 4
                            ? '影片來源不支援播放（MEDIA_ERR_SRC_NOT_SUPPORTED）。請改用可直接播放的 mp4 連結。'
                            : '載入影片失敗，請檢查影片連結是否可直接播放。';
                          setError(msg);
                        }}
                        onPlay={() => {
                          if (lockedRef.current) {
                            safePause();
                            showToast('請先完成題目');
                            return;
                          }
                          setIsPlaying(true);
                          const video = videoRef.current;
                          if (video) video.playbackRate = 1;
                        }}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => {
                          setIsPlaying(false);
                          const pos = Math.floor(duration || 0);
                          const max = Math.floor(Math.max(maxReachedRef.current || 0, pos));
                          void reportProgress({ ended: true, force: true, posSec: pos, maxSec: max });
                          onFinished?.();
                        }}
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-white border-4 border-brand-brown rounded-2xl p-4 shadow-comic space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
                      <div className="font-black text-brand-brown">
                        進度：{formatTime(currentTime)} / {formatTime(duration)}
                        <span className="ml-3 text-sm font-bold text-brand-brown/80">
                          已解鎖至：{formatTime(maxReached)}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={!canPlay}
                          onClick={() => {
                            if (isPlaying) {
                              if (isYouTube) ytPause();
                              else safePause();
                              return;
                            }
                            if (isYouTube) ytPlay();
                            else void safePlay();
                          }}
                          className={[
                            'px-4 py-2 rounded-2xl border-4 border-brand-brown font-black shadow-comic active:translate-y-1 active:shadow-none flex items-center gap-2',
                            !canPlay ? 'bg-gray-200 text-gray-600 cursor-not-allowed' : 'bg-[#FDEEAD] text-brand-brown hover:bg-[#FCE690]'
                          ].join(' ')}
                        >
                          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                          {isPlaying ? '暫停' : (isYouTube && !ytReady ? '載入中' : '播放')}
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <div className="h-4 rounded-full border-2 border-brand-brown bg-gray-200 overflow-hidden">
                        <div className="h-full bg-[#D2EFFF]" style={{ width: `${watchedPct}%` }} />
                        <div className="h-full bg-[#93C47D] -mt-4" style={{ width: `${progressPct}%` }} />
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0, Math.floor(duration || 0))}
                        value={Math.floor(currentTime || 0)}
                        disabled={isYouTube && !ytReady}
                        onChange={(e) => {
                          const target = Number(e.target.value) || 0;
                          const allowed = maxReachedRef.current || 0;
                          const next = target > allowed + 0.5 ? allowed : target;
                          if (target > allowed + 0.5) showToast('請勿跳過影片');
                          if (isYouTube) {
                            ytSeekTo(next);
                          } else {
                            const video = videoRef.current;
                            if (!video) return;
                            seekingGuardRef.current = true;
                            try {
                              video.currentTime = next;
                            } finally {
                              window.setTimeout(() => { seekingGuardRef.current = false; }, 0);
                            }
                          }
                          setCurrentTime(next);
                        }}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer"
                        aria-label="影片進度"
                      />
                    </div>

                    <div className="text-sm font-bold text-gray-700">
                      必答題目：{requiredCheckpointIds.filter((id) => answeredIds.has(id)).length} / {requiredCheckpointIds.length}
                      <span className="ml-3">結尾：{watchedToEnd ? '已看完' : '未看完'}</span>
                      {submitted && typeof attempt?.score === 'number' && <span className="ml-3">分數：{Math.round(Number(attempt.score) || 0)}%</span>}
                      <span className="ml-3">提交：{submitted ? '已提交' : '未提交'}</span>
                    </div>

                    {!locked && nextRequiredCheckpoint && (
                      <div className="text-sm font-bold text-gray-700">
                        下一個必答時間點：{formatTime(nextRequiredCheckpoint.timestampSec)}
                      </div>
                    )}
                  </div>

                  {!submitted && (
                    <div className="bg-white border-4 border-brand-brown rounded-3xl p-4 shadow-comic flex flex-col gap-3">
                      <div className="text-sm font-bold text-gray-700">
                        {readyToSubmit ? '已符合提交條件（看至結尾 + 完成必答）' : '完成條件：看至結尾 + 完成所有必答題目'}
                      </div>
                      <button
                        type="button"
                        disabled={!readyToSubmit || finalSubmitting || locked}
                        onClick={submitWholePackage}
                        className={[
                          'px-4 py-2 rounded-2xl border-4 border-brand-brown font-black shadow-comic active:translate-y-1 active:shadow-none flex items-center justify-center gap-2',
                          !readyToSubmit || finalSubmitting || locked ? 'bg-gray-200 text-gray-600 cursor-not-allowed' : 'bg-[#93C47D] text-brand-brown hover:bg-[#86b572]'
                        ].join(' ')}
                      >
                        {finalSubmitting ? '提交中...' : '完成並提交'}
                      </button>
                    </div>
                  )}

                  {locked && activeCheckpoint && (
                    <div className="bg-white border-4 border-brand-brown rounded-3xl p-5 shadow-comic space-y-4">
                      <div className="font-black text-brand-brown">
                        時間點 {formatTime(activeCheckpoint.timestampSec)}：{activeCheckpoint.questionText || '請作答'}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(Array.isArray(activeCheckpoint.options) ? activeCheckpoint.options : []).map((opt, idx) => {
                          const picked = selectedIndex === idx;
                          return (
                            <button
                              key={idx}
                              type="button"
                              disabled={submitting}
                              onClick={() => setSelectedIndex(idx)}
                              className={[
                                'text-left px-4 py-3 rounded-2xl border-4 font-bold shadow-comic active:translate-y-1 active:shadow-none transition-all',
                                picked ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown' : 'bg-white border-brand-brown text-gray-800 hover:-translate-y-1'
                              ].join(' ')}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="text-sm font-bold text-gray-700 flex items-center gap-2">
                          <Lock className="w-4 h-4" />
                          需提交答案才可繼續播放（答對/答錯皆可繼續）
                        </div>
                        <button
                          type="button"
                          onClick={submitAnswer}
                          disabled={submitting || selectedIndex < 0}
                          className={[
                            'px-4 py-2 rounded-2xl border-4 border-brand-brown font-black shadow-comic active:translate-y-1 active:shadow-none flex items-center justify-center gap-2',
                            submitting || selectedIndex < 0 ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-[#93C47D] text-brand-brown hover:bg-[#86b572]'
                          ].join(' ')}
                        >
                          {submitting ? '提交中...' : '提交'}
                          {submitting ? null : (selectedIndex < 0 ? <XCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />)}
                        </button>
                      </div>
                    </div>
                  )}

                  {!locked && editingCheckpoint && canEditAnswers && (
                    <div className="bg-white border-4 border-brand-brown rounded-3xl p-5 shadow-comic space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-black text-brand-brown">
                          修改答案（{formatTime(editingCheckpoint.timestampSec)}）：{editingCheckpoint.questionText || '請作答'}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCheckpointId(null);
                            setSelectedIndex(-1);
                          }}
                          className="px-3 py-1 rounded-xl border-2 border-brand-brown bg-white font-black text-brand-brown hover:bg-gray-50"
                        >
                          關閉
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(Array.isArray(editingCheckpoint.options) ? editingCheckpoint.options : []).map((opt, idx) => {
                          const picked = selectedIndex === idx;
                          return (
                            <button
                              key={idx}
                              type="button"
                              disabled={submitting}
                              onClick={() => setSelectedIndex(idx)}
                              className={[
                                'text-left px-4 py-3 rounded-2xl border-4 font-bold shadow-comic active:translate-y-1 active:shadow-none transition-all',
                                picked ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown' : 'bg-white border-brand-brown text-gray-800 hover:-translate-y-1'
                              ].join(' ')}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={saveEditedAnswer}
                          disabled={submitting || selectedIndex < 0}
                          className={[
                            'px-4 py-2 rounded-2xl border-4 border-brand-brown font-black shadow-comic active:translate-y-1 active:shadow-none flex items-center gap-2',
                            submitting || selectedIndex < 0 ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-[#93C47D] text-brand-brown hover:bg-[#86b572]'
                          ].join(' ')}
                        >
                          {submitting ? '更新中...' : '更新答案'}
                          {submitting ? null : (selectedIndex < 0 ? <XCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />)}
                        </button>
                      </div>
                    </div>
                  )}

                  {canEditAnswers && unlockedCheckpoints.length > 0 && (
                    <div className="bg-white border-4 border-brand-brown rounded-3xl p-5 shadow-comic space-y-3">
                      <div className="font-black text-brand-brown">已解鎖題目（可修改答案，提交前不會顯示對錯）</div>
                      <div className="space-y-2">
                        {unlockedCheckpoints.map((c) => {
                          const sel = selectedByCheckpointId.get(c.id) ?? -1;
                          return (
                            <div key={c.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-2 border-brand-brown rounded-2xl p-3 bg-[#FFFDF6]">
                              <div className="min-w-0">
                                <div className="font-black text-brand-brown truncate">
                                  {formatTime(c.timestampSec)}：{c.questionText || '（題目）'}
                                </div>
                                <div className="text-sm font-bold text-gray-700">
                                  目前答案：{sel >= 0 ? `${sel + 1}` : '（未作答）'}
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={locked || submitting}
                                onClick={() => {
                                  if (isYouTube) ytPause();
                                  else safePause();
                                  setEditingCheckpointId(c.id);
                                  const existing = selectedByCheckpointId.get(c.id);
                                  setSelectedIndex(typeof existing === 'number' ? existing : -1);
                                }}
                                className={[
                                  'px-4 py-2 rounded-2xl border-4 border-brand-brown font-black shadow-comic active:translate-y-1 active:shadow-none',
                                  locked || submitting ? 'bg-gray-200 text-gray-600 cursor-not-allowed' : 'bg-white text-brand-brown hover:bg-gray-50'
                                ].join(' ')}
                              >
                                修改答案
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {submitted && report && (
                    <div className="bg-white border-4 border-brand-brown rounded-3xl p-5 shadow-comic space-y-3">
                      <div className="font-black text-brand-brown text-lg">回饋報告</div>
                      <div className="text-sm font-bold text-gray-700">
                        得分：{Number(report.earnedPoints) || 0} / {Number(report.totalPoints) || 0}（{Math.round(Number(report.scorePct) || 0)}%）
                      </div>
                      <div className="space-y-2">
                        {(Array.isArray(report.items) ? report.items : []).map((it: any) => {
                          const ts = formatTime(Number(it.timestampSec) || 0);
                          const correctIdx = Number.isInteger(Number(it.correctIndex)) ? Number(it.correctIndex) : -1;
                          const selectedIdx = Number.isInteger(Number(it.selectedIndex)) ? Number(it.selectedIndex) : -1;
                          const opts = Array.isArray(it.options) ? it.options : [];
                          const isCorrect = it?.isCorrect === true || Number(it?.pointsEarned) > 0;
                          return (
                            <div
                              key={String(it.checkpointId)}
                              className={[
                                'border-2 rounded-2xl p-3',
                                isCorrect ? 'border-green-700 bg-green-50' : 'border-red-700 bg-red-50'
                              ].join(' ')}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="font-black text-brand-brown">
                                  {ts}：{String(it.questionText || '')}
                                </div>
                                <div className={[
                                  'text-xs font-black px-2 py-0.5 rounded-xl border',
                                  isCorrect ? 'border-green-700 bg-green-100 text-green-900' : 'border-red-700 bg-red-100 text-red-900'
                                ].join(' ')}>
                                  {isCorrect ? '正確' : '錯誤'}
                                </div>
                              </div>
                              <div className="text-sm font-bold text-gray-700">
                                你的答案：{selectedIdx >= 0 ? `${selectedIdx + 1}. ${String(opts[selectedIdx] ?? '')}` : '（未作答）'}
                              </div>
                              <div className="text-sm font-bold text-gray-700">
                                正確答案：{correctIdx >= 0 ? `${correctIdx + 1}. ${String(opts[correctIdx] ?? '')}` : '（無）'}
                                <span className="ml-2">得分：{Number(it.pointsEarned) || 0}/{Number(it.points) || 0}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
