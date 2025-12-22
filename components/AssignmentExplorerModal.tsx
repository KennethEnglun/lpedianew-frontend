import React, { useEffect, useMemo, useState } from 'react';
import { Archive, ArchiveRestore, ChevronLeft, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { VISIBLE_SUBJECTS } from '../platform';
import RichHtmlContent from './RichHtmlContent';
import NoteCreateModal from './NoteCreateModal';
import NoteEditorModal from './NoteEditorModal';

type ManagedTaskType = 'assignment' | 'quiz' | 'game' | 'contest' | 'ai-bot' | 'note';

type Props = {
  open: boolean;
  onClose: () => void;
  authService: any;
  viewerRole: 'teacher' | 'admin';
  viewerId: string;
};

const normalizeStringArray = (value: any) => (
  Array.isArray(value) ? value.map((v) => String(v || '').trim()).filter(Boolean) : []
);

type ContentBlock = { type: string; value: string };

const normalizeContentBlocks = (input: any): ContentBlock[] => {
  if (Array.isArray(input)) {
    return input
      .map((raw) => {
        if (!raw || typeof raw !== 'object') return null;
        const type = typeof (raw as any).type === 'string' ? (raw as any).type : String((raw as any).type ?? 'text');
        const value = typeof (raw as any).value === 'string' ? (raw as any).value : String((raw as any).value ?? '');
        return { type, value };
      })
      .filter(Boolean) as ContentBlock[];
  }

  if (typeof input === 'string') {
    const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(input);
    return [{ type: looksLikeHtml ? 'html' : 'text', value: input }];
  }

  if (input && typeof input === 'object') {
    if ('type' in input && 'value' in input) {
      const type = typeof (input as any).type === 'string' ? (input as any).type : String((input as any).type ?? 'text');
      const value = typeof (input as any).value === 'string' ? (input as any).value : String((input as any).value ?? '');
      return [{ type, value }];
    }
  }

  return [];
};

const renderContentBlocks = (content: any) => {
  const blocks = normalizeContentBlocks(content);
  if (blocks.length === 0) return <div className="text-gray-500 font-bold">（無內容）</div>;

  return blocks.map((block, index) => (
    <div key={index} className="mb-3">
      {block.type === 'text' && (
        <div className="prose prose-brand-brown max-w-none">
          <p className="whitespace-pre-wrap">{block.value}</p>
        </div>
      )}
      {block.type === 'image' && (
        <div className="flex justify-center">
          <img
            src={block.value}
            alt="內容圖片"
            className="max-w-full h-auto rounded-xl border-2 border-brand-brown"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </div>
      )}
      {block.type === 'link' && (
        <div className="p-3 bg-blue-50 border-2 border-blue-200 rounded-xl">
          <a
            href={block.value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline break-all"
          >
            🔗 {block.value}
          </a>
        </div>
      )}
      {block.type === 'html' && (
        <div className="p-3 bg-gray-50 border-2 border-gray-200 rounded-xl">
          <RichHtmlContent html={block.value} />
        </div>
      )}
    </div>
  ));
};

const indexToLetter = (idx: number) => {
  const i = Number(idx);
  if (!Number.isFinite(i) || i < 0) return '';
  return String.fromCharCode('A'.charCodeAt(0) + i);
};

const getTaskLabel = (t: any) => {
  switch (String(t?.type)) {
    case 'quiz': return '小測驗';
    case 'game': return '遊戲';
    case 'contest': return '問答比賽';
    case 'ai-bot': return 'Pedia 任務';
    case 'note': return '筆記';
    default: return '任務';
  }
};

const parseFolder = (task: any) => {
  const snapshot = task?.folderSnapshot;
  const path = Array.isArray(snapshot?.path) ? snapshot.path : [];
  const stage = path[0] ? { id: String(path[0].id), name: String(path[0].name || '') } : null;
  const topic = path[1] ? { id: String(path[1].id), name: String(path[1].name || '') } : null;
  const sub = path[2] ? { id: String(path[2].id), name: String(path[2].name || '') } : null;
  return { stage, topic, sub };
};

const AssignmentExplorerModal: React.FC<Props> = ({ open, onClose, authService, viewerRole, viewerId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tasks, setTasks] = useState<any[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);

  const [subject, setSubject] = useState<string>('');
  const [className, setClassName] = useState<string>('');
  const [stageId, setStageId] = useState<string>('');
  const [topicId, setTopicId] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskResponses, setTaskResponses] = useState<any[]>([]);
  const [taskDetail, setTaskDetail] = useState<any | null>(null);
  const [expandedQuizResultIds, setExpandedQuizResultIds] = useState<Set<string>>(new Set());
  const [expandedContestAttemptIds, setExpandedContestAttemptIds] = useState<Set<string>>(new Set());
  const [contestAttemptDetails, setContestAttemptDetails] = useState<Record<string, any>>({});
  const [contestAttemptLoading, setContestAttemptLoading] = useState<Record<string, boolean>>({});
  const [createNoteOpen, setCreateNoteOpen] = useState(false);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [noteEditorMode, setNoteEditorMode] = useState<'template' | 'teacher'>('teacher');
  const [noteEditorNoteId, setNoteEditorNoteId] = useState('');
  const [noteEditorStudentId, setNoteEditorStudentId] = useState('');

  const canArchive = viewerRole === 'admin';

  const load = async (opts?: { keepSelection?: boolean }) => {
    setLoading(true);
    setError('');
    try {
      const resp = await authService.getManageTasks({ includeArchived: includeArchived && canArchive });
      const list = Array.isArray(resp.tasks) ? resp.tasks : [];
      setTasks(list);

      if (!opts?.keepSelection) {
        setSelectedTask(null);
        setTaskResponses([]);
        setTaskDetail(null);
        setTaskLoading(false);
      }
    } catch (e: any) {
      setError(e?.message || '載入失敗');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setIncludeArchived(false);
    setSubject('');
    setClassName('');
    setStageId('');
    setTopicId('');
    setSelectedTask(null);
    setTaskResponses([]);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!canArchive) return;
    void load({ keepSelection: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeArchived]);

  const tasksBySubject = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const t of tasks) {
      if (!t) continue;
      const s = String(t.subject || '').trim();
      if (!s) continue;
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(t);
    }
    return map;
  }, [tasks]);

  const availableSubjects = useMemo(() => {
    const list = VISIBLE_SUBJECTS.filter((s) => tasksBySubject.has(s));
    // fallback: show enabled subjects even if none yet, so UI is stable
    return list.length > 0 ? list : VISIBLE_SUBJECTS;
  }, [tasksBySubject]);

  const subjectTasks = useMemo(() => {
    if (!subject) return [];
    return tasksBySubject.get(subject) || [];
  }, [subject, tasksBySubject]);

  const classOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of subjectTasks) {
      const classes = normalizeStringArray(t.targetClasses);
      if (classes.length === 1 && classes[0] !== '全部') set.add(classes[0]);
      else set.add('（多班/全部）');
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  }, [subjectTasks]);

  const classCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of subjectTasks) {
      const classes = normalizeStringArray(t.targetClasses);
      const key = (classes.length === 1 && classes[0] !== '全部') ? classes[0] : '（多班/全部）';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [subjectTasks]);

  const classTasks = useMemo(() => {
    if (!className) return [];
    if (className === '（多班/全部）') {
      return subjectTasks.filter((t) => {
        const classes = normalizeStringArray(t.targetClasses);
        return classes.length !== 1 || classes[0] === '全部';
      });
    }
    return subjectTasks.filter((t) => normalizeStringArray(t.targetClasses).includes(className));
  }, [className, subjectTasks]);

  const stageOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const t of classTasks) {
      const { stage } = parseFolder(t);
      const id = stage?.id || 'unclassified-stage';
      const name = stage?.name || '未分類（學段）';
      const row = map.get(id) || { id, name, count: 0 };
      row.count += 1;
      map.set(id, row);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  }, [classTasks]);

  const stageTasks = useMemo(() => {
    if (!stageId) return [];
    return classTasks.filter((t) => {
      const { stage } = parseFolder(t);
      const id = stage?.id || 'unclassified-stage';
      return id === stageId;
    });
  }, [classTasks, stageId]);

  const topicOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const t of stageTasks) {
      const { topic } = parseFolder(t);
      const id = topic?.id || 'unclassified-topic';
      const name = topic?.name || '未分類（課題）';
      const row = map.get(id) || { id, name, count: 0 };
      row.count += 1;
      map.set(id, row);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  }, [stageTasks]);

  const topicTasks = useMemo(() => {
    if (!topicId) return [];
    return stageTasks.filter((t) => {
      const { topic } = parseFolder(t);
      const id = topic?.id || 'unclassified-topic';
      return id === topicId;
    });
  }, [stageTasks, topicId]);

  const breadcrumbs = useMemo(() => {
    const parts: string[] = [];
    if (subject) parts.push(subject);
    if (className) parts.push(className);
    if (stageId) parts.push(stageOptions.find((s) => s.id === stageId)?.name || '學段');
    if (topicId) parts.push(topicOptions.find((t) => t.id === topicId)?.name || '課題');
    if (selectedTask) parts.push(String(selectedTask.title || '任務'));
    return parts.join(' / ');
  }, [className, stageId, stageOptions, subject, topicId, topicOptions, selectedTask]);

  const goBackOne = () => {
    if (selectedTask) {
      setSelectedTask(null);
      setTaskResponses([]);
      return;
    }
    if (topicId) {
      setTopicId('');
      return;
    }
    if (stageId) {
      setStageId('');
      return;
    }
    if (className) {
      setClassName('');
      return;
    }
    if (subject) {
      setSubject('');
      return;
    }
  };

  const openTask = async (t: any) => {
    setSelectedTask(t);
    setTaskResponses([]);
    setTaskDetail(null);
    setExpandedQuizResultIds(new Set());
    setExpandedContestAttemptIds(new Set());
    setContestAttemptDetails({});
    setContestAttemptLoading({});
    setTaskLoading(true);
    try {
      if (t.type === 'game') {
        const resp = await authService.getGameResults(t.id);
        setTaskDetail(resp.game || null);
        setTaskResponses(Array.isArray(resp.scores) ? resp.scores : []);
      } else if (t.type === 'quiz') {
        const resp = await authService.getQuizResults(t.id);
        setTaskDetail(resp.quiz || null);
        setTaskResponses(Array.isArray(resp.results) ? resp.results : []);
      } else if (t.type === 'contest') {
        const resp = await authService.getContestResults(t.id);
        setTaskDetail(resp.contest || null);
        setTaskResponses(Array.isArray(resp.attempts) ? resp.attempts : []);
      } else if (t.type === 'ai-bot') {
        const resp = await authService.getBotTaskThreads(t.id);
        setTaskDetail(resp.task || null);
        setTaskResponses(Array.isArray(resp.threads) ? resp.threads : []);
      } else if (t.type === 'note') {
        if (String(t.status || '') && String(t.status) !== 'published') {
          const resp = await authService.getNoteDetail(t.id);
          setTaskDetail(resp.note || null);
          setTaskResponses([]);
        } else {
          const resp = await authService.listNoteSubmissions(t.id);
          setTaskDetail(resp.note || null);
          setTaskResponses(Array.isArray(resp.submissions) ? resp.submissions : []);
        }
      } else {
        const resp = await authService.getAssignmentResponses(t.id);
        setTaskDetail(resp.assignment || null);
        setTaskResponses(Array.isArray(resp.responses) ? resp.responses : []);
      }
    } catch (e: any) {
      setError(e?.message || '載入詳情失敗');
    } finally {
      setTaskLoading(false);
    }
  };

  const quizQuestions = useMemo(() => {
    const q = taskDetail?.questions;
    return Array.isArray(q) ? q : [];
  }, [taskDetail]);

  const toggleQuizResult = (id: string) => {
    setExpandedQuizResultIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleContestAttempt = async (attemptId: string) => {
    setExpandedContestAttemptIds((prev) => {
      const next = new Set(prev);
      if (next.has(attemptId)) next.delete(attemptId);
      else next.add(attemptId);
      return next;
    });

    if (contestAttemptDetails[attemptId]) return;
    setContestAttemptLoading((prev) => ({ ...prev, [attemptId]: true }));
    try {
      const resp = await authService.getContestAttemptDetail(attemptId);
      setContestAttemptDetails((prev) => ({ ...prev, [attemptId]: resp }));
    } catch (e: any) {
      setContestAttemptDetails((prev) => ({ ...prev, [attemptId]: { error: e?.message || '載入失敗' } }));
    } finally {
      setContestAttemptLoading((prev) => ({ ...prev, [attemptId]: false }));
    }
  };

  const canDeleteTask = (t: any) => {
    if (!t) return false;
    if (viewerRole === 'admin') return true;
    return String(t.teacherId || '') === String(viewerId || '');
  };

  const deleteTask = async (t: any) => {
    const label = getTaskLabel(t);
    if (!window.confirm(`確定要刪除此${label}及相關記錄嗎？此操作無法復原！`)) return;
    try {
      if (t.type === 'quiz') await authService.deleteQuiz(t.id);
      else if (t.type === 'game') await authService.deleteGame(t.id);
      else if (t.type === 'contest') await authService.deleteContest(t.id);
      else if (t.type === 'ai-bot') await authService.deleteBotTask(t.id);
      else if (t.type === 'note') await authService.deleteNote(t.id);
      else await authService.deleteAssignment(t.id);
      await load();
      setSelectedTask(null);
      setTaskResponses([]);
    } catch (e: any) {
      setError(e?.message || '刪除失敗');
    }
  };

  const archiveTask = async (t: any, archived: boolean) => {
    if (!canArchive) return;
    const label = getTaskLabel(t);
    if (!window.confirm(archived ? `確定要復原此${label}嗎？` : `確定要封存此${label}嗎？（學生將不再看到，但資料會保留）`)) return;
    try {
      const type = String(t.type) as ManagedTaskType;
      if (archived) await authService.restoreManageTask(type, String(t.id));
      else await authService.archiveManageTask(type, String(t.id));
      await load({ keepSelection: true });
    } catch (e: any) {
      setError(e?.message || '更新失敗');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-comic">
        <div className="p-6 border-b-4 border-brand-brown bg-[#C0E2BE] flex items-center justify-between">
          <div>
            <div className="text-2xl font-black text-brand-brown">作業管理</div>
            <div className="text-sm text-brand-brown/80 font-bold">
              {breadcrumbs || '科目 → 班別 → 學段 → 課題 → 任務'}
            </div>
	          </div>
	          <div className="flex items-center gap-2">
	            <button
	              type="button"
	              onClick={() => setCreateNoteOpen(true)}
	              className="px-4 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 flex items-center gap-2"
	              title="新增筆記任務（草稿→編輯模板→派發）"
	            >
	              <Plus className="w-4 h-4" />
	              新增筆記
	            </button>
	            {canArchive && (
	              <button
	                type="button"
	                onClick={() => setIncludeArchived((v) => !v)}
	                className={`px-4 py-2 rounded-2xl border-4 font-black shadow-comic ${includeArchived ? 'bg-[#B5D8F8] border-brand-brown text-brand-brown' : 'bg-white border-brand-brown text-brand-brown hover:bg-gray-50'}`}
	                title="顯示/隱藏已封存任務"
	              >
                {includeArchived ? '顯示封存中' : '只顯示未封存'}
              </button>
            )}
            <button
              type="button"
              onClick={() => void load({ keepSelection: true })}
              className="px-4 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 flex items-center gap-2"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              重新載入
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
            >
              <X className="w-6 h-6 text-brand-brown" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {(subject || className || stageId || topicId || selectedTask) && (
            <button
              type="button"
              onClick={goBackOne}
              className="px-4 py-2 rounded-2xl border-4 border-brand-brown bg-gray-100 text-brand-brown font-black shadow-comic hover:bg-gray-200 inline-flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              上一層
            </button>
          )}

          {error && (
            <div className="text-red-700 font-bold">{error}</div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-brown mx-auto mb-4"></div>
              <p className="text-brand-brown font-bold">載入中...</p>
            </div>
          ) : selectedTask ? (
            <div className="bg-white border-4 border-brand-brown rounded-3xl p-6 shadow-comic">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-2xl font-black text-brand-brown">{String(selectedTask.title || '')}</div>
                  <div className="text-sm text-gray-600 font-bold mt-1">
                    {getTaskLabel(selectedTask)} ・ {String(selectedTask.teacherName || '教師')}
                  </div>
                  <div className="text-xs text-gray-500 font-bold mt-1">
                    {String(selectedTask.createdAt || '')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canArchive && (
                    <button
                      type="button"
                      onClick={() => void archiveTask(selectedTask, !!selectedTask.archivedAt || selectedTask.isActive === false)}
                      className="px-4 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 flex items-center gap-2"
                    >
                      {(selectedTask.archivedAt || selectedTask.isActive === false) ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                      {(selectedTask.archivedAt || selectedTask.isActive === false) ? '復原' : '封存'}
                    </button>
                  )}
                  {canDeleteTask(selectedTask) && (
                    <button
                      type="button"
                      onClick={() => void deleteTask(selectedTask)}
                      className="px-4 py-2 rounded-2xl border-4 border-red-300 bg-red-100 text-red-700 font-black shadow-comic hover:bg-red-200 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      刪除
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 border-t-2 border-gray-200 pt-4">
                <div className="text-lg font-black text-brand-brown mb-2">教師內容 / 題目</div>
                {selectedTask.type === 'assignment' && (
                  <div className="bg-[#FEF7EC] border-2 border-gray-200 rounded-2xl p-4">
                    {renderContentBlocks(taskDetail?.content)}
                  </div>
                )}

                {selectedTask.type === 'quiz' && (
                  <div className="bg-[#FEF7EC] border-2 border-gray-200 rounded-2xl p-4 space-y-3">
                    {quizQuestions.length === 0 ? (
                      <div className="text-gray-500 font-bold">（未有題目資料）</div>
                    ) : (
                      quizQuestions.map((q: any, i: number) => {
                        const options = Array.isArray(q?.options) ? q.options : [];
                        const correctIndex = Number.isFinite(Number(q?.correctIndex)) ? Number(q.correctIndex) : null;
                        return (
                          <div key={q?.id ?? i} className="border-2 border-gray-200 rounded-2xl bg-white p-3">
                            <div className="font-black text-brand-brown mb-2">問題 {i + 1}</div>
                            <div className="text-gray-800 font-bold whitespace-pre-wrap">{String(q?.question || '')}</div>
                            {options.length > 0 && (
                              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                                {options.map((opt: any, oi: number) => {
                                  const isCorrect = correctIndex !== null && oi === correctIndex;
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
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {selectedTask.type === 'contest' && (
                  <div className="bg-[#FEF7EC] border-2 border-gray-200 rounded-2xl p-4 space-y-2">
                    <div className="font-bold text-gray-800">主題：{String(taskDetail?.topic || '') || '（未提供）'}</div>
                    {taskDetail?.scopeText && (
                      <div className="font-bold text-gray-800 whitespace-pre-wrap">範圍：{String(taskDetail.scopeText)}</div>
                    )}
                    <div className="text-sm text-gray-700 font-bold">
                      題數：{String(taskDetail?.questionCount ?? '') || '-'}；限時：{taskDetail?.timeLimitSeconds ? `${taskDetail.timeLimitSeconds} 秒` : '不限'}
                    </div>
                    <div className="text-sm text-gray-600 font-bold">（每位學生的題目/選項/答案請在下方按「查看答題詳情」）</div>
                  </div>
                )}

                {selectedTask.type === 'game' && (
                  <div className="bg-[#FEF7EC] border-2 border-gray-200 rounded-2xl p-4 space-y-2">
                    {taskDetail?.description && (
                      <div className="font-bold text-gray-800 whitespace-pre-wrap">{String(taskDetail.description)}</div>
                    )}
                    {Array.isArray(taskDetail?.questions) && taskDetail.questions.length > 0 && (
                      <div className="space-y-2">
                        {taskDetail.questions.slice(0, 10).map((q: any, i: number) => (
                          <div key={i} className="border-2 border-gray-200 rounded-2xl bg-white p-3">
                            <div className="font-black text-brand-brown mb-2">題目 {i + 1}</div>
                            <div className="text-gray-800 font-bold whitespace-pre-wrap">{String(q?.question || q?.prompt || q?.title || '')}</div>
                            {Array.isArray(q?.options) && q.options.length > 0 && (
                              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                                {q.options.map((opt: any, oi: number) => (
                                  <div key={oi} className="p-2 rounded-xl border-2 border-gray-200 bg-gray-50 font-bold text-gray-800">
                                    {indexToLetter(oi)}. {String(opt)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                        {taskDetail.questions.length > 10 && (
                          <div className="text-xs text-gray-600 font-bold">（只顯示前 10 題）</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {selectedTask.type === 'ai-bot' && (
                  <div className="bg-[#FEF7EC] border-2 border-gray-200 rounded-2xl p-4 space-y-1">
                    <div className="font-bold text-gray-800">Pedia：{String(taskDetail?.botName || selectedTask?.botName || selectedTask?.title || '')}</div>
                    <div className="text-sm text-gray-600 font-bold">（對話內容請到學生清單點選對話查看）</div>
                  </div>
                )}

                {selectedTask.type === 'note' && (
                  <div className="bg-[#FEF7EC] border-2 border-gray-200 rounded-2xl p-4 space-y-1">
                    {String((selectedTask as any).status || '') !== 'published' ? (
                      <>
                        <div className="font-bold text-gray-800">（草稿）先編輯模板，確認後再派發（派發後模板會固定）</div>
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setNoteEditorMode('template');
                              setNoteEditorNoteId(String(selectedTask.id));
                              setNoteEditorStudentId('');
                              setNoteEditorOpen(true);
                            }}
                            className="px-3 py-1 rounded-xl border-2 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50"
                          >
                            編輯模板 / 派發
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-bold text-gray-800">（此任務為 A4 筆記；學生按「交回」才算完成）</div>
                        <div className="text-sm text-gray-600 font-bold">在下方可查看每位學生狀態，並點「查看筆記」查看內容。</div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 border-t-2 border-gray-200 pt-4">
                <div className="text-lg font-black text-brand-brown mb-2">學生回應 / 結果</div>
                {taskLoading ? (
                  <div className="text-brand-brown font-bold">載入中...</div>
                ) : taskResponses.length === 0 ? (
                  <div className="text-gray-500 font-bold">目前沒有資料</div>
                ) : (
                  <div className="space-y-2">
                    {taskResponses.map((r: any, idx: number) => {
                      const name = r.studentName || r.studentUsername || '學生';
                      const cls = r.studentClass || r.className || '';
                      const meta = (() => {
                        if (selectedTask.type === 'quiz' || selectedTask.type === 'contest') {
                          const score = r.score !== undefined && r.score !== null ? `${Math.round(Number(r.score))}%` : '';
                          const at = r.submittedAt || r.startedAt || r.createdAt || '';
                          return [score, at].filter(Boolean).join(' ・ ');
                        }
                        if (selectedTask.type === 'game') {
                          const score = r.score !== undefined && r.score !== null ? `${Math.round(Number(r.score))}%` : '';
                          const at = r.completedAt || r.playedAt || '';
                          return [score, at].filter(Boolean).join(' ・ ');
                        }
                        if (selectedTask.type === 'ai-bot') {
                          const done = r.completed ? '已完成' : '未完成';
                          const at = r.lastMessageAt || '';
                          return [done, at].filter(Boolean).join(' ・ ');
                        }
                        if (selectedTask.type === 'note') {
                          const status = r.submittedAt ? '已交回' : r.startedAt ? '進行中' : '未開始';
                          const at = r.submittedAt || r.updatedAt || '';
                          return [status, at].filter(Boolean).join(' ・ ');
                        }
                        return r.createdAt || '';
                      })();

                      return (
                        <div key={r.id || r.threadId || r.studentId || idx} className="p-3 rounded-2xl border-2 border-gray-200 bg-gray-50">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-black text-brand-brown">{name}{cls ? `（${cls}）` : ''}</div>
                            <div className="text-xs text-gray-600 font-bold">{meta}</div>
                          </div>
                          {selectedTask.type === 'assignment' && typeof r.content === 'string' && (
                            <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap break-words">
                              {r.content}
                            </div>
                          )}

                          {selectedTask.type === 'quiz' && Array.isArray(r.answers) && (
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={() => toggleQuizResult(String(r.id || idx))}
                                className="px-3 py-1 rounded-xl border-2 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50"
                              >
                                {expandedQuizResultIds.has(String(r.id || idx)) ? '收起答題' : '查看答題'}
                              </button>
                              {expandedQuizResultIds.has(String(r.id || idx)) && (
                                <div className="mt-2 space-y-2">
                                  {quizQuestions.length === 0 ? (
                                    <div className="text-gray-500 font-bold">（未有題目資料）</div>
                                  ) : (
                                    quizQuestions.map((q: any, qi: number) => {
                                      const options = Array.isArray(q?.options) ? q.options : [];
                                      const correctIndex = Number.isFinite(Number(q?.correctIndex)) ? Number(q.correctIndex) : null;
                                      const ans = Number.isFinite(Number(r.answers?.[qi])) ? Number(r.answers[qi]) : -1;
                                      const label = ans >= 0 ? indexToLetter(ans) : '（未答）';
                                      const isCorrect = correctIndex !== null && ans === correctIndex;
                                      const answerText = ans >= 0 && options[ans] !== undefined ? String(options[ans]) : '';
                                      return (
                                        <div key={qi} className="p-2 rounded-2xl border-2 border-gray-200 bg-white">
                                          <div className="text-xs font-black text-brand-brown">問題 {qi + 1}</div>
                                          <div className={`text-sm font-bold ${isCorrect ? 'text-green-800' : 'text-gray-800'}`}>
                                            答案：{label}{answerText ? `（${answerText}）` : ''}{isCorrect ? ' ✅' : ''}
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              )}
                            </div>
                          )}

	                          {selectedTask.type === 'contest' && (
	                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={() => void toggleContestAttempt(String(r.id))}
                                className="px-3 py-1 rounded-xl border-2 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50"
                              >
                                {expandedContestAttemptIds.has(String(r.id)) ? '收起答題詳情' : '查看答題詳情'}
                              </button>
                              {expandedContestAttemptIds.has(String(r.id)) && (
                                <div className="mt-2">
                                  {contestAttemptLoading[String(r.id)] ? (
                                    <div className="text-brand-brown font-bold">載入中...</div>
                                  ) : contestAttemptDetails[String(r.id)]?.error ? (
                                    <div className="text-red-700 font-bold">{String(contestAttemptDetails[String(r.id)].error)}</div>
                                  ) : (
                                    (() => {
                                      const attempt = contestAttemptDetails[String(r.id)]?.attempt;
                                      const questions = Array.isArray(attempt?.questions) ? attempt.questions : [];
                                      const answers = Array.isArray(attempt?.answers) ? attempt.answers : [];
                                      if (questions.length === 0) return <div className="text-gray-500 font-bold">（未有答題資料）</div>;
                                      return (
                                        <div className="space-y-2">
                                          {questions.map((q: any, qi: number) => {
                                            const options = Array.isArray(q?.options) ? q.options : [];
                                            const ans = Number.isFinite(Number(answers[qi])) ? Number(answers[qi]) : -1;
                                            const label = ans >= 0 ? indexToLetter(ans) : '（未答）';
                                            const answerText = ans >= 0 && options[ans] !== undefined ? String(options[ans]) : '';
                                            return (
                                              <div key={qi} className="p-3 rounded-2xl border-2 border-gray-200 bg-white">
                                                <div className="font-black text-brand-brown mb-1">問題 {qi + 1}</div>
                                                <div className="text-sm font-bold text-gray-800 whitespace-pre-wrap">{String(q?.question || '')}</div>
                                                {options.length > 0 && (
                                                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {options.map((opt: any, oi: number) => (
                                                      <div key={oi} className="p-2 rounded-xl border-2 border-gray-200 bg-gray-50 font-bold text-gray-800">
                                                        {indexToLetter(oi)}. {String(opt)}
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                                <div className="mt-2 text-sm font-black text-brand-brown">學生答案：{label}{answerText ? `（${answerText}）` : ''}</div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      );
                                    })()
                                  )}
                                </div>
                              )}
	                            </div>
	                          )}

	                          {selectedTask.type === 'note' && (
	                            <div className="mt-3 flex flex-wrap gap-2">
	                              <button
	                                type="button"
	                                onClick={() => {
	                                  const sid = String(r.studentId || '');
	                                  if (!sid) return;
	                                  setNoteEditorMode('teacher');
	                                  setNoteEditorNoteId(String(selectedTask.id));
	                                  setNoteEditorStudentId(sid);
	                                  setNoteEditorOpen(true);
	                                }}
	                                className="px-3 py-1 rounded-xl border-2 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 disabled:opacity-60"
	                                disabled={!r.studentId}
	                              >
	                                查看筆記
	                              </button>
	                            </div>
	                          )}
	                        </div>
	                      );
	                    })}
	                  </div>
	                )}
              </div>
            </div>
          ) : !subject ? (
            <div>
              <div className="text-lg font-black text-brand-brown mb-3">科目</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {availableSubjects.map((s) => {
                  const count = (tasksBySubject.get(s) || []).length;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { setSubject(s); setClassName(''); setStageId(''); setTopicId(''); }}
                      className="text-left bg-white border-4 border-brand-brown rounded-3xl p-4 shadow-comic hover:-translate-y-1 transition-transform"
                    >
                      <div className="text-xl font-black text-brand-brown">📚 {s}</div>
                      <div className="text-xs font-bold text-gray-600 mt-1">{count} 個任務</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : !className ? (
            <div>
              <div className="text-lg font-black text-brand-brown mb-3">班別</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {classOptions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { setClassName(c); setStageId(''); setTopicId(''); }}
                    className="text-left bg-white border-4 border-brand-brown rounded-3xl p-4 shadow-comic hover:-translate-y-1 transition-transform"
                  >
                    <div className="text-xl font-black text-brand-brown">🏫 {c}</div>
                    <div className="text-xs font-bold text-gray-600 mt-1">{classCounts.get(c) || 0} 個任務</div>
                  </button>
                ))}
              </div>
            </div>
          ) : !stageId ? (
            <div>
              <div className="text-lg font-black text-brand-brown mb-3">學段</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {stageOptions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setStageId(s.id); setTopicId(''); }}
                    className="text-left bg-white border-4 border-brand-brown rounded-3xl p-4 shadow-comic hover:-translate-y-1 transition-transform"
                  >
                    <div className="text-xl font-black text-brand-brown">📁 {s.name}</div>
                    <div className="text-xs font-bold text-gray-600 mt-1">{s.count} 個任務</div>
                  </button>
                ))}
              </div>
            </div>
          ) : !topicId ? (
            <div>
              <div className="text-lg font-black text-brand-brown mb-3">課題</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topicOptions.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTopicId(t.id)}
                    className="text-left bg-white border-4 border-brand-brown rounded-3xl p-4 shadow-comic hover:-translate-y-1 transition-transform"
                  >
                    <div className="text-xl font-black text-brand-brown">📁 {t.name}</div>
                    <div className="text-xs font-bold text-gray-600 mt-1">{t.count} 個任務</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-lg font-black text-brand-brown mb-3">任務</div>
              {topicTasks.length === 0 ? (
                <div className="text-gray-500 font-bold border-4 border-dashed border-gray-300 rounded-3xl p-8 text-center">
                  目前沒有任務
                </div>
              ) : (
                <div className="space-y-3">
                  {topicTasks.map((t) => {
                    const archived = !!t.archivedAt || t.isActive === false;
                    const deletable = canDeleteTask(t);
                    const { sub } = parseFolder(t);
                    return (
                      <div
                        key={`${t.type}-${t.id}`}
                        className={`bg-white border-4 border-brand-brown rounded-3xl p-4 shadow-comic flex flex-wrap items-center justify-between gap-3 ${archived ? 'opacity-70' : ''}`}
                      >
                        <div className="min-w-0">
                          <div className="text-xl font-black text-brand-brown break-words">
                            {String(t.title || '')}
                          </div>
                          <div className="text-sm text-gray-600 font-bold mt-1">
                            {getTaskLabel(t)} ・ {String(t.teacherName || '教師')}
                            {!!sub?.name && <span className="ml-2 text-xs">（子folder：{sub.name}）</span>}
                          </div>
                          <div className="text-xs text-gray-600 font-bold mt-1">
                            回應/結果：{Number(t.responseCount) || 0} ・ 學生：{Number(t.uniqueStudents) || 0}
                          </div>
                          {archived && (
                            <div className="text-xs text-red-700 font-black mt-1">
                              已封存
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {canArchive && (
                            <button
                              type="button"
                              onClick={() => void archiveTask(t, archived)}
                              className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-gray-100 text-brand-brown font-black shadow-comic hover:bg-gray-200 flex items-center gap-2"
                              title={archived ? '復原' : '封存'}
                            >
                              {archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                              {archived ? '復原' : '封存'}
                            </button>
                          )}
                          {deletable && (
                            <button
                              type="button"
                              onClick={() => void deleteTask(t)}
                              className="px-3 py-2 rounded-2xl border-4 border-red-300 bg-red-100 text-red-700 font-black shadow-comic hover:bg-red-200 flex items-center gap-2"
                              title="刪除"
                            >
                              <Trash2 className="w-4 h-4" />
                              刪除
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void openTask(t)}
                            className="px-4 py-2 rounded-2xl border-4 border-brand-brown bg-[#B5F8CE] text-brand-brown font-black shadow-comic hover:bg-[#A1E5B8]"
                            title="查看學生回應/結果"
                          >
                            查看
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
	        </div>
	      </div>

	      <NoteCreateModal
	        open={createNoteOpen}
	        onClose={() => setCreateNoteOpen(false)}
	        authService={authService}
	        onCreated={(id) => {
	          setCreateNoteOpen(false);
	          setNoteEditorMode('template');
	          setNoteEditorNoteId(String(id));
	          setNoteEditorStudentId('');
	          setNoteEditorOpen(true);
	        }}
	      />

	      <NoteEditorModal
	        open={noteEditorOpen && !!noteEditorNoteId}
	        onClose={() => {
	          setNoteEditorOpen(false);
	          setNoteEditorStudentId('');
	          void load({ keepSelection: true });
	        }}
	        authService={authService}
	        mode={noteEditorMode === 'template' ? 'template' : 'teacher'}
	        noteId={noteEditorNoteId || ''}
	        viewerId={String(viewerId || '')}
	        viewerRole={viewerRole}
	        studentId={noteEditorStudentId || undefined}
	        onPublished={() => {
	          void load({ keepSelection: true });
	        }}
	      />
	    </div>
	  );
};

export default AssignmentExplorerModal;
