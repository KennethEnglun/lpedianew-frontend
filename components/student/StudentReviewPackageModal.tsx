import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Play, Pause, Lock, CheckCircle2, XCircle } from 'lucide-react';
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

export function StudentReviewPackageModal({ open, packageId, onClose, onFinished }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const seekingGuardRef = useRef(false);
  const maxReachedRef = useRef(0);
  const lockedRef = useRef(false);
  const lastReportRef = useRef<{ max: number; pos: number; at: number }>({ max: 0, pos: 0, at: 0 });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [pkg, setPkg] = useState<any | null>(null);
  const [attempt, setAttempt] = useState<any | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [locked, setLocked] = useState(false);

  const [activeCheckpointId, setActiveCheckpointId] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    maxReachedRef.current = maxReached;
  }, [maxReached]);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

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

  const answeredIds = useMemo(() => {
    const answers = Array.isArray(attempt?.answers) ? attempt.answers : [];
    return new Set(answers.map((a: any) => String(a?.checkpointId || '')).filter(Boolean));
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
        setError('此影片連結不支援直接播放（NotSupported）。請教師改用可直接播放的 mp4 連結。');
      } else {
        setError(e?.message || '播放失敗：請檢查影片連結是否可直接播放');
      }
    }
  };

  const reportProgress = async (opts?: { ended?: boolean; force?: boolean }) => {
    const pid = packageId || '';
    const v = videoRef.current;
    if (!pid || !v) return;
    const pos = Math.floor(Number(v.currentTime) || 0);
    const max = Math.floor(maxReachedRef.current || 0);
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
    setDuration(0);
    setCurrentTime(0);
    setMaxReached(0);
    setLocked(false);
    setActiveCheckpointId(null);
    setSelectedIndex(-1);
    setSubmitting(false);
    lastReportRef.current = { max: 0, pos: 0, at: 0 };
    (async () => {
      try {
        const resp = await authService.getReviewPackageForStudent(packageId);
        setPkg(resp?.package || null);
        setAttempt(resp?.attempt || null);
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
    const t = window.setInterval(() => {
      void reportProgress();
    }, 5000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, packageId]);

  useEffect(() => {
    if (!open) return;
    return () => {
      void reportProgress({ force: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, packageId]);

  if (!open || !packageId) return null;

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

  const maybeGateAtCheckpoint = () => {
    const video = videoRef.current;
    if (!video) return;
    if (lockedRef.current) return;
    if (activeCheckpointId) return;
    const next = nextRequiredCheckpoint;
    if (!next) return;
    const t = Number(video.currentTime) || 0;
    if (t + 0.05 >= next.timestampSec) {
      safePause();
      setLocked(true);
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
      if (resp?.attempt) setAttempt(resp.attempt);
      setLocked(false);
      setActiveCheckpointId(null);
      setSelectedIndex(-1);
      onFinished?.();
      await safePlay();
    } catch (e: any) {
      setError(e?.message || '提交失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const progressPct = duration > 0 ? clamp((currentTime / duration) * 100, 0, 100) : 0;
  const watchedPct = duration > 0 ? clamp((maxReached / duration) * 100, 0, 100) : 0;
  const requiredDone = requiredCheckpointIds.every((id) => answeredIds.has(id));
  const watchedToEnd = !!attempt?.watchedToEnd;
  const completed = requiredDone && watchedToEnd;

  return (
    <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4">
      <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-comic">
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
          <button
            onClick={() => {
              void reportProgress({ force: true });
              onClose();
            }}
            className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
            aria-label="關閉"
          >
            <X className="w-6 h-6 text-brand-brown" />
          </button>
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
              <div className="bg-black rounded-2xl overflow-hidden border-4 border-brand-brown">
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
                    setMaxReached((prev) => {
                      const next = Math.max(prev, t);
                      maxReachedRef.current = next;
                      return next;
                    });
                    void reportProgress();
                    maybeGateAtCheckpoint();
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
                      ? '影片來源不支援播放（MEDIA_ERR_SRC_NOT_SUPPORTED）。請教師改用可直接播放的 mp4 連結。'
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
                    void reportProgress({ ended: true, force: true });
                    onFinished?.();
                  }}
                />
              </div>

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
                      disabled={locked}
                      onClick={() => (isPlaying ? safePause() : void safePlay())}
                      className={[
                        'px-4 py-2 rounded-2xl border-4 border-brand-brown font-black shadow-comic active:translate-y-1 active:shadow-none flex items-center gap-2',
                        locked ? 'bg-gray-200 text-gray-600 cursor-not-allowed' : 'bg-[#FDEEAD] text-brand-brown hover:bg-[#FCE690]'
                      ].join(' ')}
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      {isPlaying ? '暫停' : '播放'}
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
                    onChange={(e) => {
                      const video = videoRef.current;
                      if (!video) return;
                      const target = Number(e.target.value) || 0;
                      const allowed = maxReachedRef.current || 0;
                      const next = target > allowed + 0.5 ? allowed : target;
                      if (target > allowed + 0.5) showToast('請勿跳過影片');
                      seekingGuardRef.current = true;
                      try {
                        video.currentTime = next;
                      } finally {
                        window.setTimeout(() => { seekingGuardRef.current = false; }, 0);
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
                  {typeof attempt?.score === 'number' && <span className="ml-3">分數：{Math.round(Number(attempt.score) || 0)}%</span>}
                </div>
              </div>

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

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      需提交答案才可繼續播放（答對/答錯皆可繼續）
                    </div>
                    <button
                      type="button"
                      onClick={submitAnswer}
                      disabled={submitting || selectedIndex < 0}
                      className={[
                        'px-4 py-2 rounded-2xl border-4 border-brand-brown font-black shadow-comic active:translate-y-1 active:shadow-none flex items-center gap-2',
                        submitting || selectedIndex < 0 ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-[#93C47D] text-brand-brown hover:bg-[#86b572]'
                      ].join(' ')}
                    >
                      {submitting ? '提交中...' : '提交'}
                      {submitting ? null : (selectedIndex < 0 ? <XCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />)}
                    </button>
                  </div>
                </div>
              )}

              {!locked && nextRequiredCheckpoint && (
                <div className="text-sm font-bold text-gray-700">
                  下一個必答時間點：{formatTime(nextRequiredCheckpoint.timestampSec)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
