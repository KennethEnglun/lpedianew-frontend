import React, { useEffect, useMemo, useState } from 'react';
import { Archive, ArchiveRestore, BarChart3, BookOpen, ChevronLeft, Copy, FolderInput, Pencil, RefreshCw, Trash2, X } from 'lucide-react';
import { VISIBLE_SUBJECTS } from '../platform';
import RichHtmlContent from './RichHtmlContent';
import NoteCreateModal from './NoteCreateModal';
import NoteEditorModal from './NoteEditorModal';
import { ScopeCardExplorerModal } from './ScopeCardExplorerModal';
import { StudentAiNotesModal } from './StudentAiNotesModal';
import { AiReportModal } from './AiReportModal';
import { TeacherReviewPackagePanel } from './review-package/TeacherReviewPackagePanel';

type ManagedTaskType = 'assignment' | 'quiz' | 'game' | 'contest' | 'ai-bot' | 'note' | 'review-package';
type ManageApiTaskType = 'assignment' | 'quiz' | 'game' | 'contest' | 'ai-bot' | 'note';

const isManageApiTaskType = (value: any): value is ManageApiTaskType => (
  value === 'assignment'
  || value === 'quiz'
  || value === 'game'
  || value === 'contest'
  || value === 'ai-bot'
  || value === 'note'
);

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
    case 'ai-bot': return 'AI小助手任務';
    case 'note': return '筆記';
    case 'review-package': return '温習套件';
    default: return '任務';
  }
};

const formatTime = (sec: number) => {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

const parseFolder = (task: any) => {
  const snapshot = task?.folderSnapshot;
  const path = Array.isArray(snapshot?.path) ? snapshot.path : [];
  const stage = path[0] ? { id: String(path[0].id), name: String(path[0].name || '') } : null;
  const topic = path[1] ? { id: String(path[1].id), name: String(path[1].name || '') } : null;
  const sub = path[2] ? { id: String(path[2].id), name: String(path[2].name || '') } : null;
  return { stage, topic, sub };
};

const parseGradeFromClassName = (className?: string) => {
  const match = String(className || '').match(/^(\d+)/);
  return match ? match[1] : '';
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
  const [scopeCardOpen, setScopeCardOpen] = useState(false);
  const [studentAiNotesOpen, setStudentAiNotesOpen] = useState(false);
  const [reviewPackageStats, setReviewPackageStats] = useState<any | null>(null);

  const [aiReportModalOpen, setAiReportModalOpen] = useState(false);
  const [aiReportLoading, setAiReportLoading] = useState(false);
  const [aiReportError, setAiReportError] = useState('');
  const [aiReportData, setAiReportData] = useState<any | null>(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedTaskKeys, setSelectedTaskKeys] = useState<Set<string>>(new Set());

  // AI小助手任務：查看學生對話紀錄
  const [botThreadModalOpen, setBotThreadModalOpen] = useState(false);
  const [botThreadModalTitle, setBotThreadModalTitle] = useState('');
  const [botThreadLoading, setBotThreadLoading] = useState(false);
  const [botThreadError, setBotThreadError] = useState('');
  const [botThreadMessages, setBotThreadMessages] = useState<any[]>([]);

  const canArchive = viewerRole === 'admin';

  const copyText = async (text: string) => {
    const value = String(text || '');
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    } catch {
      // ignore
    }
  };

  const openBotThreadMessages = async (taskId: string, threadId: string | null, studentName?: string, studentClass?: string) => {
    const tid = threadId ? String(threadId) : '';
    if (!tid) {
      alert('學生尚未開始對話');
      return;
    }
    try {
      setBotThreadModalOpen(true);
      setBotThreadModalTitle(`${studentName || '學生'}${studentClass ? `（${studentClass}）` : ''} 的對話記錄`);
      setBotThreadLoading(true);
      setBotThreadError('');
      setBotThreadMessages([]);
      const resp = await authService.getBotTaskThreadMessages(String(taskId), tid);
      setBotThreadMessages(Array.isArray(resp.messages) ? resp.messages : []);
    } catch (e: any) {
      setBotThreadError(e?.message || '載入對話失敗');
      setBotThreadMessages([]);
    } finally {
      setBotThreadLoading(false);
    }
  };

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
        setReviewPackageStats(null);
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
    setReviewPackageStats(null);
    setScopeCardOpen(false);
    setSelectMode(false);
    setSelectedTaskKeys(new Set());
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSelectMode(false);
    setSelectedTaskKeys(new Set());
  }, [open, subject, className, stageId, topicId]);

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
    setReviewPackageStats(null);
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
      } else if (t.type === 'review-package') {
        const resp = await authService.getReviewPackageResults(t.id);
        setTaskDetail(resp?.package ? { ...t, ...resp.package } : t);
        setTaskResponses(Array.isArray(resp?.results) ? resp.results : []);
        setReviewPackageStats(resp?.stats || null);
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

  const openSelectedReviewPackageAiReport = async () => {
    if (!selectedTask || String(selectedTask.type) !== 'review-package') return;
    setAiReportModalOpen(true);
    setAiReportLoading(true);
    setAiReportError('');
    setAiReportData(null);
    try {
      const data = await authService.getReviewPackageAiReport(String(selectedTask.id), { scope: 'overall' });
      setAiReportData(data?.report || null);
    } catch (e: any) {
      setAiReportError(e?.message || '載入 AI 報告失敗');
    } finally {
      setAiReportLoading(false);
    }
  };

  const regenerateSelectedReviewPackageAiReport = async () => {
    if (!selectedTask || String(selectedTask.type) !== 'review-package') return;
    setAiReportLoading(true);
    setAiReportError('');
    try {
      const data = await authService.regenerateReviewPackageAiReport(String(selectedTask.id), { scope: 'overall' });
      setAiReportData(data?.report || null);
    } catch (e: any) {
      setAiReportError(e?.message || '重新生成 AI 報告失敗');
    } finally {
      setAiReportLoading(false);
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
    if (String(t.type) === 'review-package') return false;
    if (viewerRole === 'admin') return true;
    return String(t.teacherId || '') === String(viewerId || '');
  };

  const taskKey = (t: any) => `${String(t?.type || '')}-${String(t?.id || '')}`;

  const renameTask = async (t: any) => {
    if (!canDeleteTask(t)) return;
    if (!isManageApiTaskType(String(t?.type || ''))) return;
    const current = String(t?.title || '').trim();
    const next = prompt('輸入新名稱', current);
    const title = String(next || '').trim();
    if (!title || title === current) return;
    try {
      await authService.renameManageTaskTitle(String(t.type) as ManageApiTaskType, String(t.id), title);
      setSelectedTask((prev) => (prev && String(prev.id) === String(t.id) && String(prev.type) === String(t.type) ? { ...prev, title } : prev));
      await load({ keepSelection: true });
    } catch (e: any) {
      setError(e?.message || '改名失敗');
    }
  };

  const copyTaskToTeacherFolder = async (t: any) => {
    try {
      const type = String(t?.type || '').trim();
      const id = String(t?.id || '').trim();
      if (!type || !id) return;

      const classes = normalizeStringArray(t?.targetClasses);
      const classCandidate = (classes.length === 1 && classes[0] !== '全部') ? classes[0] : '';
      let grade = parseGradeFromClassName(classCandidate);
      if (!grade) {
        const input = prompt('模板年級（輸入數字，例如 4）', '');
        grade = String(input || '').trim();
      }
      if (!grade) return;

      let folderId: string | null = null;
      try {
        const myFolders = await authService.listMyLibraryFolders(grade);
        const list = (myFolders.folders || []).map((f: any) => `${f.id}:${f.name}`).join('\n');
        const picked = prompt(`放入哪個 folder？（留空=未分類）\n可用 folder：\n${list}`, '');
        folderId = picked && picked.trim() ? picked.trim().split(':')[0] : null;
      } catch {
        folderId = null;
      }

      await authService.createTemplateFromTask({ type, id, grade, ...(folderId ? { folderId } : {}) });
      alert('已複製到教師資料夾（模板）');
    } catch (e: any) {
      setError(e?.message || '複製失敗');
    }
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

  const deleteTaskNoConfirm = async (t: any) => {
    if (!t) return;
    if (t.type === 'quiz') await authService.deleteQuiz(t.id);
    else if (t.type === 'game') await authService.deleteGame(t.id);
    else if (t.type === 'contest') await authService.deleteContest(t.id);
    else if (t.type === 'ai-bot') await authService.deleteBotTask(t.id);
    else if (t.type === 'note') await authService.deleteNote(t.id);
    else await authService.deleteAssignment(t.id);
  };

  const bulkDeletableTaskKeys = useMemo(() => {
    if (!topicId) return [];
    const list = (Array.isArray(tasks) ? tasks : []).filter(Boolean);
    const filtered = list.filter((t: any) => {
      if (String(t.subject || '') !== String(subject || '')) return false;
      const classes = normalizeStringArray(t?.targetClasses);
      const classCandidate = (classes.length === 1 && classes[0] !== '全部') ? classes[0] : '';
      if (String(classCandidate) !== String(className || '')) return false;
      const { stage, topic } = parseFolder(t);
      if (stageId && String(stage?.id || '') !== String(stageId)) return false;
      if (topicId && String(topic?.id || '') !== String(topicId)) return false;
      return true;
    });
    return filtered.filter(canDeleteTask).map(taskKey).filter(Boolean);
  }, [tasks, subject, className, stageId, topicId]);

  const allSelectableSelected = useMemo(() => {
    if (bulkDeletableTaskKeys.length === 0) return false;
    return bulkDeletableTaskKeys.every((k) => selectedTaskKeys.has(k));
  }, [bulkDeletableTaskKeys, selectedTaskKeys]);

  const toggleSelectAllTasks = () => {
    if (allSelectableSelected) {
      setSelectedTaskKeys(new Set());
      return;
    }
    setSelectedTaskKeys(new Set(bulkDeletableTaskKeys));
  };

  const deleteSelectedTasks = async () => {
    const keys = Array.from(selectedTaskKeys).filter((k) => bulkDeletableTaskKeys.includes(k));
    if (keys.length === 0) return;
    if (!window.confirm(`確定要刪除選取的 ${keys.length} 個任務嗎？此操作無法復原！`)) return;
    setLoading(true);
    setError('');
    try {
      const byKey = new Map<string, any>();
      (Array.isArray(tasks) ? tasks : []).forEach((t) => byKey.set(taskKey(t), t));
      for (const k of keys) {
        const t = byKey.get(k);
        if (!t) continue;
        if (!canDeleteTask(t)) continue;
        await deleteTaskNoConfirm(t);
      }
      setSelectedTaskKeys(new Set());
      setSelectMode(false);
      await load();
    } catch (e: any) {
      setError(e?.message || '刪除失敗');
    } finally {
      setLoading(false);
    }
  };

  const archiveTask = async (t: any, archived: boolean) => {
    if (!canArchive) return;
    if (!isManageApiTaskType(String(t?.type || ''))) return;
    const label = getTaskLabel(t);
    if (!window.confirm(archived ? `確定要復原此${label}嗎？` : `確定要封存此${label}嗎？（學生將不再看到，但資料會保留）`)) return;
    try {
      const type = String(t.type) as ManageApiTaskType;
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
			              onClick={() => setScopeCardOpen(true)}
			              className="px-4 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 flex items-center gap-2"
			              title="學生學習分析（範圍卡）"
			            >
			              <BarChart3 className="w-4 h-4" />
			              學生學習分析
			            </button>
			            <button
			              type="button"
			              onClick={() => setStudentAiNotesOpen(true)}
			              className="px-4 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 flex items-center gap-2"
			              title="查看每位學生的 AI筆記"
			            >
			              <BookOpen className="w-4 h-4" />
			              學生AI筆記
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
	                  {String(selectedTask.type) !== 'review-package' && (
	                    <button
	                      type="button"
	                      onClick={() => void copyTaskToTeacherFolder(selectedTask)}
	                      className="px-4 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 flex items-center gap-2"
	                      title="複製到教師資料夾（模板），可日後再派送"
	                    >
	                      <FolderInput className="w-4 h-4" />
	                      複製到資料夾
	                    </button>
	                  )}
	                  {canDeleteTask(selectedTask) && (
	                    <button
	                      type="button"
	                      onClick={() => void renameTask(selectedTask)}
                      className="px-4 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 flex items-center gap-2"
                      title="改名（只限派發老師或管理員）"
                    >
                      <Pencil className="w-4 h-4" />
                      改名
                    </button>
                  )}
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
	
	                {selectedTask.type === 'review-package' && (
	                  <div className="bg-[#FEF7EC] border-2 border-gray-200 rounded-2xl p-4 space-y-3">
	                    <div className="text-sm font-black text-brand-brown">
	                      影片：<span className="text-gray-800 font-bold break-all">{String((taskDetail as any)?.videoUrl || selectedTask?.videoUrl || '')}</span>
	                    </div>
	                    <div className="text-sm font-bold text-gray-700">
	                      題目數：{Array.isArray((taskDetail as any)?.checkpoints) ? (taskDetail as any).checkpoints.length : (Array.isArray(selectedTask?.checkpoints) ? selectedTask.checkpoints.length : 0)}
	                    </div>
	                    {Array.isArray((taskDetail as any)?.checkpoints) && (taskDetail as any).checkpoints.length > 0 && (
	                      <div className="space-y-2">
	                        {(taskDetail as any).checkpoints
	                          .slice()
	                          .sort((a: any, b: any) => (Number(a?.timestampSec) || 0) - (Number(b?.timestampSec) || 0))
	                          .slice(0, 20)
	                          .map((c: any, i: number) => (
	                            <div key={String(c?.id || i)} className="p-3 rounded-2xl border-2 border-gray-200 bg-white">
	                              <div className="text-xs font-black text-brand-brown">
	                                {i + 1}. {formatTime(Number(c?.timestampSec) || 0)} {c?.required === false ? '（選答）' : '（必答）'} ・ 分數 {Number(c?.points) || 0}
	                              </div>
	                              <div className="text-sm font-bold text-gray-800 whitespace-pre-wrap">{String(c?.questionText || '')}</div>
	                              {Array.isArray(c?.options) && c.options.length > 0 && (
	                                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
	                                  {c.options.map((opt: any, oi: number) => {
	                                    const correct = Number.isInteger(Number(c?.correctIndex)) ? Number(c.correctIndex) : -1;
	                                    const isCorrect = oi === correct;
	                                    return (
	                                      <div
	                                        key={oi}
	                                        className={[
	                                          'p-2 rounded-xl border-2 font-bold text-gray-800',
	                                          isCorrect ? 'border-green-700 bg-green-50' : 'border-gray-200 bg-gray-50'
	                                        ].join(' ')}
	                                      >
	                                        {indexToLetter(oi)}. {String(opt)}
	                                      </div>
	                                    );
	                                  })}
	                                </div>
	                              )}
	                            </div>
	                          ))}
	                        {(taskDetail as any).checkpoints.length > 20 && (
	                          <div className="text-xs text-gray-600 font-bold">（只顯示前 20 題）</div>
	                        )}
	                      </div>
	                    )}
	                  </div>
	                )}

		                {selectedTask.type === 'quiz' && (
		                  <div className="bg-[#FEF7EC] border-2 border-gray-200 rounded-2xl p-4 space-y-3">
	                    {quizQuestions.length === 0 ? (
	                      <div className="text-gray-500 font-bold">（未有題目資料）</div>
	                    ) : (
	                      quizQuestions.map((q: any, i: number) => {
	                        const options = Array.isArray(q?.options) ? q.options : [];
	                        const correctIndex = Number.isFinite(Number(q?.correctAnswer))
	                          ? Number(q.correctAnswer)
	                          : (Number.isFinite(Number(q?.correctIndex)) ? Number(q.correctIndex) : null);
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
                    <div className="font-bold text-gray-800">AI小助手：{String(taskDetail?.botName || selectedTask?.botName || selectedTask?.title || '')}</div>
                    <div className="text-sm text-gray-600 font-bold">（在下方學生清單點「查看對話」可查看對話內容）</div>
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
                {selectedTask.type === 'review-package' ? (
                  taskLoading ? (
                    <div className="text-brand-brown font-bold">載入中...</div>
                  ) : (
                    <TeacherReviewPackagePanel
                      pkg={taskDetail as any}
                      results={taskResponses as any}
                      stats={reviewPackageStats}
                      onOpenAiReport={() => void openSelectedReviewPackageAiReport()}
                    />
                  )
                ) : taskLoading ? (
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
                          if (selectedTask.type === 'review-package') {
                            const completed = r.completed ? '已提交' : '未提交';
                            const score = r.score !== undefined && r.score !== null ? `${Math.round(Number(r.score))}%` : '';
                            const max = r.maxReachedSec !== undefined && r.maxReachedSec !== null ? `解鎖至 ${formatTime(Number(r.maxReachedSec) || 0)}` : '';
                            const at = r.completedAt || r.updatedAt || '';
                            return [completed, score, max, at].filter(Boolean).join(' ・ ');
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
                      const canOpenBotChat = selectedTask.type === 'ai-bot' && !!r.threadId;

                      return (
                        <div
                          key={r.id || r.threadId || r.studentId || idx}
                          className={`p-3 rounded-2xl border-2 border-gray-200 bg-gray-50 ${canOpenBotChat ? 'cursor-pointer hover:border-brand-brown' : ''}`}
                          role={canOpenBotChat ? 'button' : undefined}
                          tabIndex={canOpenBotChat ? 0 : undefined}
                          onClick={() => {
                            if (!canOpenBotChat) return;
                            void openBotThreadMessages(String(selectedTask.id), String(r.threadId || ''), name, cls);
                          }}
                          onKeyDown={(e) => {
                            if (!canOpenBotChat) return;
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              void openBotThreadMessages(String(selectedTask.id), String(r.threadId || ''), name, cls);
                            }
                          }}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-black text-brand-brown">{name}{cls ? `（${cls}）` : ''}</div>
                            <div className="text-xs text-gray-600 font-bold">{meta}</div>
                          </div>
	                          {selectedTask.type === 'assignment' && typeof r.content === 'string' && (
	                            <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap break-words">
	                              {r.content}
	                            </div>
	                          )}

                            {selectedTask.type === 'review-package' && (
                              <div className="mt-2 text-sm font-bold text-gray-700 flex flex-wrap gap-3">
                                <span>結尾：{r.watchedToEnd ? '已看完' : '未看完'}</span>
                                <span>必答：{r.completed ? '已提交' : '未提交'}</span>
                                {r.completed && (r.score !== undefined && r.score !== null) && <span>分數：{Math.round(Number(r.score))}%</span>}
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
	                                      const correctIndex = Number.isFinite(Number(q?.correctAnswer))
	                                        ? Number(q.correctAnswer)
	                                        : (Number.isFinite(Number(q?.correctIndex)) ? Number(q.correctIndex) : null);
	                                      const ans = Number.isFinite(Number(r.answers?.[qi])) ? Number(r.answers[qi]) : -1;
	                                      const label = ans >= 0 ? indexToLetter(ans) : '（未答）';
	                                      const isCorrect = correctIndex !== null && ans === correctIndex;
	                                      const answerText = ans >= 0 && options[ans] !== undefined ? String(options[ans]) : '';
	                                      const correctLabel = correctIndex !== null ? indexToLetter(correctIndex) : '';
	                                      const correctText = correctIndex !== null && options[correctIndex] !== undefined ? String(options[correctIndex]) : '';
	                                      return (
	                                        <div key={qi} className="p-3 rounded-2xl border-2 border-gray-200 bg-white">
	                                          <div className="text-xs font-black text-brand-brown">問題 {qi + 1}</div>
	                                          <div className="text-sm font-bold text-gray-800 whitespace-pre-wrap">{String(q?.question || '')}</div>
	                                          <div className={`mt-1 text-sm font-black ${isCorrect ? 'text-green-800' : 'text-red-700'}`}>
	                                            {correctIndex === null ? '結果：—' : (isCorrect ? '結果：✅ 正確' : '結果：❌ 錯誤')}
	                                          </div>
	                                          <div className="mt-1 text-sm font-black text-brand-brown">
	                                            學生答案：{label}{answerText ? `（${answerText}）` : ''}
	                                          </div>
	                                          {!isCorrect && correctIndex !== null && (
	                                            <div className="mt-1 text-sm font-black text-gray-700">
	                                              正確答案：{correctLabel}{correctText ? `（${correctText}）` : ''}
	                                            </div>
	                                          )}
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

                          {selectedTask.type === 'ai-bot' && (
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void openBotThreadMessages(String(selectedTask.id), r.threadId ? String(r.threadId) : null, name, cls);
                                }}
                                className={`px-3 py-1 rounded-xl border-2 font-black shadow-comic ${canOpenBotChat
                                  ? 'border-brand-brown bg-white text-brand-brown hover:bg-gray-50'
                                  : 'border-gray-300 bg-gray-200 text-gray-500 cursor-not-allowed'
                                  }`}
                                disabled={!canOpenBotChat}
                              >
                                查看對話
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
	              <div className="flex items-center justify-between gap-2 mb-3">
	                <div className="text-lg font-black text-brand-brown">任務</div>
	                {topicId && (
	                  <div className="flex items-center gap-2">
	                    {selectMode ? (
	                      <>
	                        <button
	                          type="button"
	                          onClick={toggleSelectAllTasks}
	                          disabled={loading || bulkDeletableTaskKeys.length === 0}
	                          className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 disabled:opacity-60"
	                        >
	                          {allSelectableSelected ? '取消全選' : '全選'}
	                        </button>
	                        <button
	                          type="button"
	                          onClick={() => setSelectedTaskKeys(new Set())}
	                          disabled={loading || selectedTaskKeys.size === 0}
	                          className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-black shadow-comic hover:bg-gray-50 disabled:opacity-60"
	                        >
	                          全不選
	                        </button>
	                        <button
	                          type="button"
	                          onClick={() => void deleteSelectedTasks()}
	                          disabled={loading || selectedTaskKeys.size === 0}
	                          className="px-3 py-2 rounded-2xl border-4 border-red-300 bg-red-100 text-red-700 font-black shadow-comic hover:bg-red-200 disabled:opacity-60 flex items-center gap-2"
	                        >
	                          <Trash2 className="w-4 h-4" />
	                          刪除選取（{selectedTaskKeys.size}）
	                        </button>
	                        <button
	                          type="button"
	                          onClick={() => {
	                            setSelectMode(false);
	                            setSelectedTaskKeys(new Set());
	                          }}
	                          disabled={loading}
	                          className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-gray-100 text-brand-brown font-black shadow-comic hover:bg-gray-200 disabled:opacity-60"
	                        >
	                          取消
	                        </button>
	                      </>
	                    ) : (
	                      <button
	                        type="button"
	                        onClick={() => setSelectMode(true)}
	                        disabled={loading || bulkDeletableTaskKeys.length === 0}
	                        className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-gray-100 text-brand-brown font-black shadow-comic hover:bg-gray-200 disabled:opacity-60"
	                      >
	                        多選刪除
	                      </button>
	                    )}
	                  </div>
	                )}
	              </div>
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
	                    const key = taskKey(t);
	                    const isSelected = selectedTaskKeys.has(key);
	                    return (
	                      <div
	                        key={key}
	                        className={`bg-white border-4 rounded-3xl p-4 shadow-comic flex flex-wrap items-center justify-between gap-3 ${archived ? 'opacity-70' : ''} ${selectMode && isSelected ? 'border-blue-500 bg-blue-50' : 'border-brand-brown'}`}
	                      >
	                        <div className="min-w-0 flex items-start gap-3 flex-1">
	                          {selectMode && (
	                            <input
	                              type="checkbox"
	                              className={`w-5 h-5 mt-1 rounded border-2 border-gray-400 text-blue-600 focus:ring-blue-500 ${!deletable ? 'opacity-50 cursor-not-allowed' : ''}`}
	                              checked={isSelected}
	                              disabled={!deletable}
	                              onChange={(e) => {
	                                if (!deletable) return;
	                                setSelectedTaskKeys((prev) => {
	                                  const next = new Set(prev);
	                                  if (e.target.checked) next.add(key);
	                                  else next.delete(key);
	                                  return next;
	                                });
	                              }}
	                            />
	                          )}
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
	                        </div>
	                        <div className="flex items-center gap-2">
	                          {canArchive && (
	                            <button
	                              type="button"
	                              onClick={() => void archiveTask(t, archived)}
	                              disabled={selectMode}
	                              className="px-3 py-2 rounded-2xl border-4 border-brand-brown bg-gray-100 text-brand-brown font-black shadow-comic hover:bg-gray-200 flex items-center gap-2 disabled:opacity-60"
	                              title={archived ? '復原' : '封存'}
	                            >
	                              {archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
	                              {archived ? '復原' : '封存'}
	                            </button>
	                          )}
	                          {deletable && !selectMode && (
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
	                            disabled={selectMode}
	                            className="px-4 py-2 rounded-2xl border-4 border-brand-brown bg-[#B5F8CE] text-brand-brown font-black shadow-comic hover:bg-[#A1E5B8] disabled:opacity-60"
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

	        {botThreadModalOpen && (
	          <div className="fixed inset-0 bg-black/50 z-[90] flex items-center justify-center p-4">
	            <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-3xl max-h-[90vh] shadow-comic overflow-hidden flex flex-col">
	              <div className="p-6 border-b-4 border-brand-brown bg-[#D2EFFF] flex items-center justify-between gap-4">
	                <div className="min-w-0">
	                  <div className="text-2xl font-black text-brand-brown truncate">{botThreadModalTitle || '對話記錄'}</div>
	                  <div className="text-xs font-bold text-gray-700 mt-1">AI小助手任務對話</div>
	                </div>
	                <button
	                  type="button"
	                  onClick={() => { setBotThreadModalOpen(false); setBotThreadMessages([]); setBotThreadError(''); }}
	                  className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center flex-shrink-0"
	                  aria-label="關閉"
	                >
	                  <X className="w-6 h-6 text-brand-brown" />
	                </button>
	              </div>

	              <div className="p-6 overflow-y-auto flex-1 space-y-3 bg-[#FFF9F0]">
	                {botThreadLoading ? (
	                  <div className="text-brand-brown font-bold">載入中...</div>
	                ) : botThreadError ? (
	                  <div className="text-red-700 font-bold">{botThreadError}</div>
	                ) : botThreadMessages.length === 0 ? (
	                  <div className="text-gray-500 font-bold">（沒有對話內容）</div>
	                ) : (
	                  botThreadMessages.map((m: any) => {
	                    const sender = String(m?.sender || '');
	                    const isStudent = sender === 'user';
	                    const ts = m?.createdAt ? new Date(m.createdAt) : null;
	                    const timeText = ts && !Number.isNaN(ts.getTime()) ? ts.toLocaleString() : '';
	                    const content = String(m?.content || '');
	                    return (
	                      <div key={String(m?.id || `${sender}-${timeText}-${content.slice(0, 16)}`)} className={`flex ${isStudent ? 'justify-end' : 'justify-start'}`}>
	                        <div className={`max-w-[85%] rounded-2xl border-2 px-4 py-3 ${isStudent ? 'bg-white border-brand-brown text-gray-900' : 'bg-[#E8F4FD] border-blue-300 text-gray-900'}`}>
	                          <div className="flex items-center justify-between gap-3 mb-1">
	                            <div className="text-[11px] font-black text-gray-700">{isStudent ? '學生' : 'AI'}</div>
	                            <div className="flex items-center gap-2">
	                              {timeText && <div className="text-[11px] font-bold text-gray-600">{timeText}</div>}
	                              <button
	                                type="button"
	                                onClick={() => void copyText(content)}
	                                className="p-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
	                                title="複製"
	                              >
	                                <Copy className="w-3.5 h-3.5 text-gray-700" />
	                              </button>
	                            </div>
	                          </div>
	                          <div className="whitespace-pre-wrap break-words font-bold text-gray-900">{content}</div>
	                        </div>
	                      </div>
	                    );
	                  })
	                )}
	              </div>
	            </div>
	          </div>
	        )}

	        <StudentAiNotesModal
	          open={studentAiNotesOpen}
	          onClose={() => setStudentAiNotesOpen(false)}
	          authService={authService}
	        />

	        <ScopeCardExplorerModal
	          isOpen={scopeCardOpen}
	          onClose={() => setScopeCardOpen(false)}
	        />

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

        <AiReportModal
          open={aiReportModalOpen}
          title="温習套件 AI 報告"
          loading={aiReportLoading}
          error={aiReportError}
          report={aiReportData}
          onClose={() => setAiReportModalOpen(false)}
          onRegenerate={aiReportData ? () => void regenerateSelectedReviewPackageAiReport() : undefined}
        />
	    </div>
	  );
};

export default AssignmentExplorerModal;
