import React, { useEffect, useMemo, useState } from 'react';
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

  const [draftId, setDraftId] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState<'save' | 'publish'>('save');

  useEffect(() => {
    if (!open) return;
    setWizardOpen(false);
    setWizardMode('save');
    setError('');
    setLoadingDraft(false);

    const incomingId = String(draftIdToOpen || '').trim();
    if (!incomingId) {
      setTitle('');
      setSubject(availableSubjects[0] || '');
      setVideoUrl('');
      setDurationText('');
      setCheckpoints([]);
      setDraftId('');
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
        setCheckpoints(cps.map((c: any) => ({
          id: String(c?.id || newId()),
          timestampSec: clampInt(c?.timestampSec),
          required: c?.required !== false,
          points: Math.max(0, Number(c?.points) || 0),
          questionText: String(c?.questionText || ''),
          options: Array.isArray(c?.options) ? c.options.map((o: any) => String(o || '')) : ['A', 'B', 'C', 'D'],
          correctIndex: clampInt(c?.correctIndex, 0, 7)
        })));
      } catch (e: any) {
        setError(e?.message || '載入草稿失敗');
      } finally {
        setLoadingDraft(false);
      }
    })();
  }, [open, availableSubjects, draftIdToOpen]);

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

  const validate = () => {
    const t = String(title || '').trim();
    if (!t) return '請先輸入標題';
    const s = String(subject || '').trim();
    if (!s) return '請先選擇科目';
    const url = String(videoUrl || '').trim();
    if (!url) return '請先輸入影片連結';
    for (const c of normalizedCheckpointsForSave) {
      if (!c.id) return '題目時間點缺少 id';
      if (!Number.isFinite(c.timestampSec) || c.timestampSec < 0) return '題目時間點格式不正確';
      const opts = Array.isArray(c.options) ? c.options : [];
      if (opts.length < 2) return '每題至少需要 2 個選項';
      if (c.correctIndex < 0 || c.correctIndex >= opts.length) return '正確答案索引不正確';
      if (!String(c.questionText || '').trim()) return '題目內容不可為空';
    }
    return '';
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4">
        <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-comic">
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
              <div className="text-sm font-black text-brand-brown mb-1">影片連結（建議貼可直接播放的 mp4 連結）</div>
              <input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="w-full px-4 py-2 rounded-2xl border-4 border-brand-brown font-bold"
                placeholder="https://..."
              />
              <div className="mt-1 text-xs font-bold text-gray-700">
                SharePoint 分享連結未必可播放；可嘗試在原連結加上 <span className="font-black"> &amp;download=1</span>，或改用 mp4 直連。
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

            <div className="flex items-center justify-between">
              <div className="text-lg font-black text-brand-brown">題目時間點（MCQ）</div>
              <button
                type="button"
                onClick={() => {
                  setCheckpoints((prev) => ([
                    ...prev,
                    {
                      id: newId(),
                      timestampSec: 0,
                      required: true,
                      points: 1,
                      questionText: '',
                      options: ['A', 'B', 'C', 'D'],
                      correctIndex: 0
                    }
                  ]));
                }}
                className="px-4 py-2 rounded-2xl bg-[#FDEEAD] border-4 border-brand-brown text-brand-brown font-black shadow-comic active:translate-y-1 active:shadow-none flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                新增題目
              </button>
            </div>

            {checkpoints.length === 0 ? (
              <div className="text-sm font-bold text-gray-600 border-4 border-dashed border-gray-300 rounded-3xl p-6 text-center">
                尚未設定題目時間點（可留空，只觀看影片）
              </div>
            ) : (
              <div className="space-y-4">
                {checkpoints.map((c, idx) => (
                  <div key={c.id} className="bg-white border-4 border-brand-brown rounded-3xl p-4 shadow-comic space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-black text-brand-brown">第 {idx + 1} 題</div>
                      <button
                        type="button"
                        onClick={() => setCheckpoints((prev) => prev.filter((x) => x.id !== c.id))}
                        className="px-3 py-2 rounded-2xl bg-white border-4 border-brand-brown text-brand-brown font-black hover:bg-gray-50 shadow-comic active:translate-y-1 active:shadow-none flex items-center gap-2"
                      >
                        <Trash2 className="w-5 h-5" />
                        刪除
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <label className="block">
                        <div className="text-xs font-black text-brand-brown mb-1">時間點（mm:ss / 秒）</div>
                        <input
                          value={formatSec(c.timestampSec)}
                          onChange={(e) => {
                            const sec = parseTimeToSec(e.target.value);
                            setCheckpoints((prev) => prev.map((x) => x.id === c.id ? { ...x, timestampSec: sec ?? x.timestampSec } : x));
                          }}
                          className="w-full px-3 py-2 rounded-2xl border-4 border-brand-brown font-bold"
                        />
                      </label>

                      <label className="block">
                        <div className="text-xs font-black text-brand-brown mb-1">分數（points）</div>
                        <input
                          type="number"
                          min={0}
                          value={String(c.points)}
                          onChange={(e) => setCheckpoints((prev) => prev.map((x) => x.id === c.id ? { ...x, points: Number(e.target.value) || 0 } : x))}
                          className="w-full px-3 py-2 rounded-2xl border-4 border-brand-brown font-bold"
                        />
                      </label>

                      <label className="flex items-center gap-2 font-black text-brand-brown mt-6">
                        <input
                          type="checkbox"
                          checked={c.required}
                          onChange={(e) => setCheckpoints((prev) => prev.map((x) => x.id === c.id ? { ...x, required: e.target.checked } : x))}
                        />
                        必答（required）
                      </label>
                    </div>

                    <label className="block">
                      <div className="text-xs font-black text-brand-brown mb-1">題目</div>
                      <textarea
                        value={c.questionText}
                        onChange={(e) => setCheckpoints((prev) => prev.map((x) => x.id === c.id ? { ...x, questionText: e.target.value } : x))}
                        className="w-full px-3 py-2 rounded-2xl border-4 border-brand-brown font-bold min-h-[70px]"
                        placeholder="輸入題目內容"
                      />
                    </label>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {((Array.isArray(c.options) && c.options.length > 0) ? c.options : ['']).map((opt, optIdx) => (
                        <label key={optIdx} className="block">
                          <div className="text-xs font-black text-brand-brown mb-1">選項 {optIdx + 1}</div>
                          <input
                            value={opt}
                            onChange={(e) => {
                              const value = e.target.value;
                              setCheckpoints((prev) => prev.map((x) => {
                                if (x.id !== c.id) return x;
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
                      <div className="text-xs font-black text-brand-brown mb-1">正確答案</div>
                      <select
                        value={String(c.correctIndex)}
                        onChange={(e) => setCheckpoints((prev) => prev.map((x) => x.id === c.id ? { ...x, correctIndex: Number(e.target.value) || 0 } : x))}
                        className="w-full px-3 py-2 rounded-2xl border-4 border-brand-brown font-bold bg-white"
                      >
                        {((Array.isArray(c.options) && c.options.length > 0) ? c.options : ['']).map((opt, optIdx) => (
                          <option key={optIdx} value={String(optIdx)}>
                            {optIdx + 1}. {String(opt || '').slice(0, 30)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ))}
              </div>
            )}

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
          const msg = validate();
          if (msg) {
            setError(msg);
            throw new Error(msg);
          }

          const durationSec = durationText ? parseTimeToSec(durationText) : null;
          const contentSnapshot = {
            reviewPackage: {
              videoUrl: String(videoUrl || '').trim(),
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
