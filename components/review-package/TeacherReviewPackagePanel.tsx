import React, { useMemo, useState } from 'react';

type Checkpoint = {
  id: string;
  timestampSec: number;
  required: boolean;
  points: number;
  questionText: string;
  options: string[];
  correctIndex: number;
};

type StudentAnswer = {
  checkpointId: string;
  selectedIndex: number;
  answeredAt: string | null;
};

type StudentResult = {
  studentId: string;
  studentName: string;
  className: string;
  status: 'not_started' | 'in_progress' | 'submitted';
  maxReachedSec: number;
  lastPositionSec: number;
  watchedToEnd: boolean;
  completed: boolean;
  score: number | null;
  answers: StudentAnswer[];
  startedAt?: string | null;
  updatedAt?: string | null;
  completedAt?: string | null;
};

type Package = {
  id: string;
  title: string;
  subject: string;
  videoProvider: string;
  youtubeVideoId: string | null;
  videoUrl: string;
  videoDurationSec: number | null;
  checkpoints: Checkpoint[];
};

type Stats = {
  totalStudents: number;
  notStartedCount: number;
  inProgressCount: number;
  submittedCount: number;
  averageScore: number | null;
};

type Props = {
  pkg: Package | null;
  results: StudentResult[];
  stats: Stats | null;
  onOpenAiReport: () => void;
};

const indexToLetter = (idx: number) => {
  const i = Number(idx);
  if (!Number.isFinite(i) || i < 0) return '';
  return String.fromCharCode('A'.charCodeAt(0) + i);
};

const formatTime = (sec: number) => {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

const statusLabel = (status: StudentResult['status']) => {
  switch (status) {
    case 'submitted': return '已提交';
    case 'in_progress': return '進行中';
    default: return '未開始';
  }
};

const statusClass = (status: StudentResult['status']) => {
  switch (status) {
    case 'submitted': return 'bg-green-100 text-green-800 border-green-300';
    case 'in_progress': return 'bg-yellow-100 text-yellow-900 border-yellow-300';
    default: return 'bg-gray-100 text-gray-700 border-gray-300';
  }
};

export function TeacherReviewPackagePanel({ pkg, results, stats, onOpenAiReport }: Props) {
  const [tab, setTab] = useState<'students' | 'matrix'>('students');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string>('');

  const checkpoints = useMemo(() => {
    const cps = Array.isArray(pkg?.checkpoints) ? pkg!.checkpoints : [];
    return cps.slice().sort((a, b) => Number(a.timestampSec) - Number(b.timestampSec));
  }, [pkg]);

  const checkpointById = useMemo(() => {
    return new Map(checkpoints.map((c) => [String(c.id), c]));
  }, [checkpoints]);

  const resultsByStudentId = useMemo(() => new Map(results.map((r) => [String(r.studentId), r])), [results]);

  const selectedStudent = selectedStudentId ? resultsByStudentId.get(selectedStudentId) || null : null;
  const selectedCheckpoint = selectedCheckpointId ? checkpointById.get(selectedCheckpointId) || null : null;

  const matrixStudents = useMemo(() => {
    return results.slice().sort((a, b) => {
      const aCls = String(a.className || '');
      const bCls = String(b.className || '');
      if (aCls !== bCls) return aCls.localeCompare(bCls, 'zh-Hant');
      return String(a.studentName || '').localeCompare(String(b.studentName || ''), 'zh-Hant');
    });
  }, [results]);

  const youtubeSrc = useMemo(() => {
    const vid = pkg?.youtubeVideoId ? String(pkg.youtubeVideoId) : '';
    if (!vid) return '';
    const params = new URLSearchParams({
      controls: '1',
      rel: '0',
      modestbranding: '1',
      fs: '1'
    });
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(vid)}?${params.toString()}`;
  }, [pkg]);

  const ensureCheckpointSelected = () => {
    if (selectedCheckpointId) return;
    if (checkpoints.length > 0) setSelectedCheckpointId(String(checkpoints[0].id));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('students')}
            className={`px-4 py-2 rounded-2xl border-4 border-brand-brown font-black shadow-comic active:translate-y-1 active:shadow-none ${tab === 'students' ? 'bg-[#93C47D] text-brand-brown' : 'bg-white text-brand-brown hover:bg-gray-50'}`}
          >
            學生名單
          </button>
          <button
            type="button"
            onClick={() => { setTab('matrix'); ensureCheckpointSelected(); }}
            className={`px-4 py-2 rounded-2xl border-4 border-brand-brown font-black shadow-comic active:translate-y-1 active:shadow-none ${tab === 'matrix' ? 'bg-[#93C47D] text-brand-brown' : 'bg-white text-brand-brown hover:bg-gray-50'}`}
          >
            全班報告
          </button>
        </div>
        <button
          type="button"
          onClick={onOpenAiReport}
          className="px-4 py-2 rounded-2xl border-4 border-brand-brown bg-[#FDEEAD] text-brand-brown font-black shadow-comic hover:bg-[#FCE690] active:translate-y-1 active:shadow-none"
        >
          AI 分析報告
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-3">
          <div className="bg-white border-4 border-brand-brown rounded-3xl shadow-comic overflow-hidden">
            <div className="p-4 bg-[#D2EFFF] border-b-4 border-brand-brown">
              <div className="font-black text-brand-brown">影片預覽</div>
              {pkg?.videoUrl && (
                <div className="text-xs text-gray-700 font-bold break-all mt-1">{String(pkg.videoUrl)}</div>
              )}
            </div>
            <div className="p-4 bg-brand-cream">
              {youtubeSrc ? (
                <div className="relative w-full rounded-2xl overflow-hidden border-2 border-brand-brown bg-black" style={{ aspectRatio: '16/9' }}>
                  <iframe
                    src={youtubeSrc}
                    title="YouTube 影片"
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  />
                </div>
              ) : (
                <div className="text-gray-700 font-bold">（缺少 YouTube 影片 ID，無法在此直接播放）</div>
              )}
            </div>
          </div>

          {tab === 'students' && (
            <div className="bg-white border-4 border-brand-brown rounded-3xl shadow-comic overflow-hidden">
              <div className="p-4 bg-[#D2EFFF] border-b-4 border-brand-brown flex items-center justify-between gap-2 flex-wrap">
                <div className="font-black text-brand-brown">學生名單</div>
                {stats && (
                  <div className="text-sm font-black text-gray-700 flex flex-wrap gap-3">
                    <span>已提交：{stats.submittedCount}</span>
                    <span>進行中：{stats.inProgressCount}</span>
                    <span>未開始：{stats.notStartedCount}</span>
                    {stats.averageScore !== null && (
                      <span>平均：{Math.round(Number(stats.averageScore) || 0)}%</span>
                    )}
                  </div>
                )}
              </div>
              <div className="p-4 bg-brand-cream">
                {results.length === 0 ? (
                  <div className="text-gray-500 font-bold">（沒有學生資料）</div>
                ) : (
                  <div className="space-y-2">
                    {results.map((r) => (
                      <button
                        type="button"
                        key={String(r.studentId)}
                        onClick={() => setSelectedStudentId(String(r.studentId))}
                        className={`w-full text-left p-3 rounded-2xl border-2 shadow-comic-sm ${selectedStudentId === String(r.studentId) ? 'border-brand-brown bg-white' : 'border-gray-200 bg-white/70 hover:border-brand-brown'}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-black text-brand-brown truncate">
                              {String(r.studentName || '學生')}{r.className ? `（${r.className}）` : ''}
                            </div>
                            <div className="text-xs font-bold text-gray-600 mt-1 flex flex-wrap gap-3">
                              <span className={`px-2 py-0.5 rounded-xl border-2 ${statusClass(r.status)}`}>{statusLabel(r.status)}</span>
                              {r.status !== 'not_started' && (
                                <>
                                  <span>解鎖至：{formatTime(Number(r.maxReachedSec) || 0)}</span>
                                  <span>結尾：{r.watchedToEnd ? '已看完' : '未看完'}</span>
                                </>
                              )}
                              {r.status === 'submitted' && r.score !== null && (
                                <span className="text-brand-brown">分數：{Math.round(Number(r.score) || 0)}%</span>
                              )}
                            </div>
                          </div>
                          <div className="text-xs font-bold text-gray-600">
                            {r.completedAt || r.updatedAt || r.startedAt || ''}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'matrix' && (
            <div className="bg-white border-4 border-brand-brown rounded-3xl shadow-comic overflow-hidden">
              <div className="p-4 bg-[#D2EFFF] border-b-4 border-brand-brown flex items-center justify-between gap-2 flex-wrap">
                <div className="font-black text-brand-brown">全班回答報告</div>
                <div className="text-sm font-bold text-gray-700">點題號可查看詳情</div>
              </div>
              <div className="p-3 bg-brand-cream overflow-auto">
                {checkpoints.length === 0 ? (
                  <div className="text-gray-500 font-bold">（沒有題目）</div>
                ) : (
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-10 bg-brand-cream border-b-2 border-gray-200 p-2 text-left font-black text-brand-brown min-w-[180px]">
                          學生
                        </th>
                        {checkpoints.map((c, idx) => (
                          <th key={c.id} className="border-b-2 border-gray-200 p-2 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedCheckpointId(String(c.id))}
                              className={`w-10 h-10 rounded-xl border-2 font-black shadow-comic-sm ${selectedCheckpointId === String(c.id) ? 'bg-white border-brand-brown text-brand-brown' : 'bg-white/70 border-gray-200 text-gray-800 hover:border-brand-brown'}`}
                              title={`${formatTime(c.timestampSec)} ${c.required ? '（必答）' : ''}`}
                            >
                              {idx + 1}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrixStudents.map((s) => {
                        const byCheckpointId = new Map((Array.isArray(s.answers) ? s.answers : []).map((a) => [String(a.checkpointId), a]));
                        return (
                          <tr key={String(s.studentId)}>
                            <td className="sticky left-0 z-10 bg-brand-cream border-b border-gray-200 p-2 font-black text-brand-brown">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => { setSelectedStudentId(String(s.studentId)); setTab('students'); }}
                                  className="text-left hover:underline"
                                  title="查看學生詳情"
                                >
                                  {String(s.studentName || '學生')}{s.className ? `（${s.className}）` : ''}
                                </button>
                                <span className={`px-2 py-0.5 rounded-xl border-2 text-xs ${statusClass(s.status)}`}>{statusLabel(s.status)}</span>
                              </div>
                            </td>
                            {checkpoints.map((c) => {
                              const ans = byCheckpointId.get(String(c.id)) || null;
                              const picked = ans && Number.isInteger(Number(ans.selectedIndex)) ? Number(ans.selectedIndex) : -1;
                              const correct = Number.isInteger(Number(c.correctIndex)) ? Number(c.correctIndex) : 0;
                              const isAnswered = picked >= 0;
                              const isCorrect = isAnswered && picked === correct;
                              const cellClass = !isAnswered
                                ? 'bg-gray-100'
                                : (isCorrect ? 'bg-green-200' : 'bg-red-200');
                              return (
                                <td key={String(c.id)} className="border-b border-gray-200 p-2 text-center">
                                  <div
                                    className={`w-10 h-10 rounded-xl border-2 border-gray-200 mx-auto ${cellClass}`}
                                    title={isAnswered ? `${indexToLetter(picked)} ${isCorrect ? '✅' : '❌'}` : '未作答'}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              {selectedCheckpoint && (
                <div className="p-4 border-t-4 border-brand-brown bg-white">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-black text-brand-brown">
                        題目：{checkpoints.findIndex((c) => c.id === selectedCheckpoint.id) + 1} • {formatTime(selectedCheckpoint.timestampSec)}
                        {selectedCheckpoint.required ? '（必答）' : ''}
                      </div>
                      <div className="mt-1 text-gray-800 font-bold whitespace-pre-wrap">{String(selectedCheckpoint.questionText || '')}</div>
                    </div>
                    <div className="text-sm font-black text-gray-700">
                      正確答案：{indexToLetter(selectedCheckpoint.correctIndex)} {selectedCheckpoint.options?.[selectedCheckpoint.correctIndex] ? `（${selectedCheckpoint.options[selectedCheckpoint.correctIndex]}）` : ''}
                    </div>
                  </div>
                  {Array.isArray(selectedCheckpoint.options) && selectedCheckpoint.options.length > 0 && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {selectedCheckpoint.options.map((opt, oi) => {
                        const isCorrect = oi === selectedCheckpoint.correctIndex;
                        return (
                          <div
                            key={oi}
                            className={`p-2 rounded-xl border-2 font-bold ${isCorrect ? 'border-green-400 bg-green-50 text-green-900' : 'border-gray-200 bg-gray-50 text-gray-800'}`}
                          >
                            {indexToLetter(oi)}. {String(opt)}
                            {isCorrect ? '（正確）' : ''}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-4">
                    <div className="font-black text-brand-brown mb-2">全班作答</div>
                    <div className="space-y-2">
                      {matrixStudents.map((s) => {
                        const ans = (Array.isArray(s.answers) ? s.answers : []).find((a) => String(a.checkpointId) === String(selectedCheckpoint.id)) || null;
                        const picked = ans && Number.isInteger(Number(ans.selectedIndex)) ? Number(ans.selectedIndex) : -1;
                        const isAnswered = picked >= 0;
                        const isCorrect = isAnswered && picked === selectedCheckpoint.correctIndex;
                        const pickedText = isAnswered && selectedCheckpoint.options?.[picked] ? String(selectedCheckpoint.options[picked]) : '';
                        return (
                          <div key={String(s.studentId)} className="p-3 rounded-2xl border-2 border-gray-200 bg-brand-cream/60 flex flex-wrap items-center justify-between gap-2">
                            <div className="font-black text-brand-brown">
                              {String(s.studentName || '學生')}{s.className ? `（${s.className}）` : ''}
                              <span className={`ml-2 px-2 py-0.5 rounded-xl border-2 text-xs ${statusClass(s.status)}`}>{statusLabel(s.status)}</span>
                            </div>
                            <div className={`font-black ${!isAnswered ? 'text-gray-600' : (isCorrect ? 'text-green-800' : 'text-red-700')}`}>
                              {!isAnswered ? '未作答' : `答案：${indexToLetter(picked)}${pickedText ? `（${pickedText}）` : ''} ${isCorrect ? '✅' : '❌'}`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-3">
          <div className="bg-white border-4 border-brand-brown rounded-3xl shadow-comic overflow-hidden">
            <div className="p-4 bg-[#D2EFFF] border-b-4 border-brand-brown">
              <div className="font-black text-brand-brown">題目列表</div>
              <div className="text-xs text-gray-600 font-bold mt-1">點選題目可快速查看</div>
            </div>
            <div className="p-4 bg-brand-cream">
              {checkpoints.length === 0 ? (
                <div className="text-gray-500 font-bold">（沒有題目）</div>
              ) : (
                <div className="space-y-2">
                  {checkpoints.map((c, idx) => (
                    <button
                      type="button"
                      key={String(c.id)}
                      onClick={() => { setSelectedCheckpointId(String(c.id)); setTab('matrix'); }}
                      className={`w-full text-left p-3 rounded-2xl border-2 ${selectedCheckpointId === String(c.id) ? 'border-brand-brown bg-white' : 'border-gray-200 bg-white/70 hover:border-brand-brown'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-black text-brand-brown">第 {idx + 1} 題 • {formatTime(c.timestampSec)} {c.required ? '（必答）' : ''}</div>
                          <div className="text-sm font-bold text-gray-800 whitespace-pre-wrap line-clamp-3">{String(c.questionText || '')}</div>
                        </div>
                        <div className="text-xs font-black text-gray-700 flex-shrink-0">分數 {Number(c.points) || 1}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border-4 border-brand-brown rounded-3xl shadow-comic overflow-hidden">
            <div className="p-4 bg-[#D2EFFF] border-b-4 border-brand-brown">
              <div className="font-black text-brand-brown">學生詳情</div>
              <div className="text-xs text-gray-600 font-bold mt-1">從「學生名單」選學生</div>
            </div>
            <div className="p-4 bg-brand-cream">
              {!selectedStudent ? (
                <div className="text-gray-500 font-bold">（尚未選擇學生）</div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-black text-brand-brown">
                      {String(selectedStudent.studentName || '學生')}{selectedStudent.className ? `（${selectedStudent.className}）` : ''}
                    </div>
                    <span className={`px-2 py-0.5 rounded-xl border-2 text-xs ${statusClass(selectedStudent.status)}`}>{statusLabel(selectedStudent.status)}</span>
                  </div>
                  <div className="text-sm font-bold text-gray-700 flex flex-wrap gap-3">
                    <span>解鎖至：{formatTime(Number(selectedStudent.maxReachedSec) || 0)}</span>
                    <span>結尾：{selectedStudent.watchedToEnd ? '已看完' : '未看完'}</span>
                    {selectedStudent.status === 'submitted' && selectedStudent.score !== null && (
                      <span className="text-brand-brown">分數：{Math.round(Number(selectedStudent.score) || 0)}%</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {checkpoints.map((c, idx) => {
                      const ans = (Array.isArray(selectedStudent.answers) ? selectedStudent.answers : []).find((a) => String(a.checkpointId) === String(c.id)) || null;
                      const picked = ans && Number.isInteger(Number(ans.selectedIndex)) ? Number(ans.selectedIndex) : -1;
                      const isAnswered = picked >= 0;
                      const isCorrect = isAnswered && picked === c.correctIndex;
                      const pickedText = isAnswered && c.options?.[picked] ? String(c.options[picked]) : '';
                      const correctText = c.options?.[c.correctIndex] ? String(c.options[c.correctIndex]) : '';
                      return (
                        <div key={String(c.id)} className="p-3 rounded-2xl border-2 border-gray-200 bg-white">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="font-black text-brand-brown">第 {idx + 1} 題 • {formatTime(c.timestampSec)} {c.required ? '（必答）' : ''}</div>
                            <div className={`font-black ${!isAnswered ? 'text-gray-600' : (isCorrect ? 'text-green-800' : 'text-red-700')}`}>
                              {!isAnswered ? '未作答' : (isCorrect ? '✅ 正確' : '❌ 錯誤')}
                            </div>
                          </div>
                          <div className="mt-1 text-sm font-bold text-gray-800 whitespace-pre-wrap">{String(c.questionText || '')}</div>
                          <div className="mt-2 text-sm font-black text-brand-brown">
                            學生答案：{!isAnswered ? '（未答）' : `${indexToLetter(picked)}${pickedText ? `（${pickedText}）` : ''}`}
                          </div>
                          {isAnswered && !isCorrect && (
                            <div className="mt-1 text-sm font-black text-gray-700">
                              正確答案：{indexToLetter(c.correctIndex)}{correctText ? `（${correctText}）` : ''}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

