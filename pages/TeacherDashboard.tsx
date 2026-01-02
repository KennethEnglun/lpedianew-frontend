import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Menu, Settings, SlidersHorizontal, User, LogOut, MessageSquare, Plus, X, Image, Link, Code, Bold, Italic, Underline, Type, Palette, Upload, Trash, Filter, Eye, EyeOff, HelpCircle, Clock, Bot, BarChart3, Coins } from 'lucide-react';
import Button from '../components/Button';
import Select from '../components/Select';
import Input from '../components/Input';
import AiQuestionGeneratorModal from '../components/AiQuestionGeneratorModal';
import UiSettingsModal from '../components/UiSettingsModal';
import AiChatModal from '../components/AiChatModal';
import AppStudioModal from '../components/AppStudioModal';
import { ChartGeneratorModal } from '../components/ChartGeneratorModal';
import ClassFolderManagerModal from '../components/ClassFolderManagerModal';
import TemplateLibraryModal from '../components/TemplateLibraryModal';
import CreateTaskModal from '../components/CreateTaskModal';
import DraftLibraryModal from '../components/DraftLibraryModal';
import DraftSavePublishWizardModal from '../components/DraftSavePublishWizardModal';
import ClassFolderSelectInline from '../components/ClassFolderSelectInline';
import AssignmentExplorerModal from '../components/AssignmentExplorerModal';
import NoteEditorModal, { NoteEditorHandle } from '../components/NoteEditorModal';
import { AiReportModal } from '../components/AiReportModal';
import { MathExpressionBuilder, finalizeMathQuestions } from '../components/MathExpressionBuilder';
import { MathEquationBuilder, finalizeMathEquationQuestions } from '../components/MathEquationBuilder';
import { MathExpressionView, FractionView } from '../components/MathExpressionView';
import { MathGame } from '../components/MathGame';
import { MazeGame } from '../components/MazeGame';
import TowerDefenseGame from '../components/TowerDefenseGame';
import { RangerTdGame } from '../components/RangerTdGame';
import { MatchingGamePreview } from '../components/MatchingGamePreview';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { sanitizeHtml } from '../services/sanitizeHtml';
import RichHtmlContent from '../components/RichHtmlContent';
import { buildHtmlPreviewPlaceholder, looksLikeExecutableHtml, MAX_LPEDIA_HTML_PREVIEW_CHARS } from '../services/htmlPreview';
import { loadHiddenTaskKeys, makeTaskKey, parseTaskKey, saveHiddenTaskKeys } from '../services/taskVisibility';
import type { MathOp, MathToken } from '../services/mathGame';
import { evaluateTokens, validateTokens } from '../services/mathGame';
import type { MathConstraints } from '../services/mathConstraints';
import { validateEquationAnswerType, validateEquationSteps, validateRationalAgainstConstraints, validateTokensAgainstConstraints } from '../services/mathConstraints';
import { parseAndSolveSingleUnknownEquation } from '../services/equationSolver';
import { Subject, Discussion } from '../types';
import { DEFAULT_SUBJECT, GROUPS_ENABLED, VISIBLE_SUBJECTS } from '../platform';

type TowerDefenseQuestionDraft =
  | { type: 'mcq'; prompt: string; options: string[]; correctIndex: number }
  | { type: 'match'; left: string; options: string[]; correctIndex: number };

type MathDraft =
  | { kind: 'expr'; tokens: MathToken[] }
  | { kind: 'eq'; equation: string };

const TeacherDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { logout, user, refreshUser } = useAuth();

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showUiSettings, setShowUiSettings] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  const [showChartGenerator, setShowChartGenerator] = useState(false);
  const [showAppStudio, setShowAppStudio] = useState(false);

  const [teacherSettingsDraft, setTeacherSettingsDraft] = useState<{
    homeroomClass: string;
    subjectsTaught: string[];
    subjectGroups: Record<string, string[]>;
  }>({ homeroomClass: '', subjectsTaught: [], subjectGroups: {} });
  const [teacherSettingsSaving, setTeacherSettingsSaving] = useState(false);
  const [teacherSettingsError, setTeacherSettingsError] = useState('');
  const [groupOptionsBySubject, setGroupOptionsBySubject] = useState<Record<string, string[]>>({});

  const [showDiscussionModal, setShowDiscussionModal] = useState(false);
  const [discussionForm, setDiscussionForm] = useState({
    title: '',
    subject: DEFAULT_SUBJECT,
    targetClasses: [] as string[],
    targetGroups: [] as string[],
    content: ''
  });
  const [discussionDraftId, setDiscussionDraftId] = useState('');
  const [discussionDraftMeta, setDiscussionDraftMeta] = useState<any | null>(null);
  const [discussionDraftReadOnly, setDiscussionDraftReadOnly] = useState(false);
  const [discussionWizardOpen, setDiscussionWizardOpen] = useState(false);
  const [discussionWizardMode, setDiscussionWizardMode] = useState<'save' | 'publish'>('save');
  const [pendingDiscussionHtml, setPendingDiscussionHtml] = useState<string | null>(null);

  const parseGradeFromClassName = (className?: string) => {
    const match = String(className || '').match(/^(\d+)/);
    return match ? match[1] : '';
  };

  // 小測驗相關狀態
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [imageUploading, setImageUploading] = useState(false); // New state for tracking image upload status
  const [quizForm, setQuizForm] = useState({
    title: '',
    description: '',
    scopeText: '',
    subject: DEFAULT_SUBJECT,
    targetClasses: [] as string[],
    targetGroups: [] as string[],
    questions: [] as Array<{
      question: string;
      options: string[];
      correctAnswer: number;
      image?: string;
    }>,
    timeLimit: 0
  });
  const [quizDraftId, setQuizDraftId] = useState('');
  const [quizDraftMeta, setQuizDraftMeta] = useState<any | null>(null);
  const [quizDraftReadOnly, setQuizDraftReadOnly] = useState(false);
  const [quizWizardOpen, setQuizWizardOpen] = useState(false);
  const [quizWizardMode, setQuizWizardMode] = useState<'save' | 'publish'>('save');

  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [aiGeneratorMode, setAiGeneratorMode] = useState<'mcq' | 'pairs'>('mcq');
  const [aiGeneratorTitle, setAiGeneratorTitle] = useState('AI 生成題目');
  const [aiGeneratorSubject, setAiGeneratorSubject] = useState<string>(String(DEFAULT_SUBJECT));
  const [aiGeneratorImportModes, setAiGeneratorImportModes] = useState<Array<'replace' | 'append'>>(['replace']);
  const aiGeneratorOnImportRef = useRef<(payload: any, mode: 'replace' | 'append') => void>(() => {});

  const [editorRef, setEditorRef] = useState<HTMLDivElement | null>(null);
  const [currentFontSize, setCurrentFontSize] = useState('16');
  const [currentTextColor, setCurrentTextColor] = useState('#000000');

  const applyDiscussionHtmlToEditor = (html: string) => {
    setDiscussionForm((prev) => ({ ...prev, content: html }));
    if (editorRef) editorRef.innerHTML = html;
    else setPendingDiscussionHtml(html);
  };

  useEffect(() => {
    if (!editorRef) return;
    if (pendingDiscussionHtml === null) return;
    editorRef.innerHTML = pendingDiscussionHtml;
    setPendingDiscussionHtml(null);
  }, [editorRef, pendingDiscussionHtml]);

  // 作業管理相關狀態
	  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
	  const [showClassFolderManager, setShowClassFolderManager] = useState(false);
	  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
    const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
    const [showDraftLibraryModal, setShowDraftLibraryModal] = useState(false);
    const [activeDraftId, setActiveDraftId] = useState('');
    const [activeDraftToolType, setActiveDraftToolType] = useState<string>('');
    const noteEditorRef = useRef<NoteEditorHandle | null>(null);
	  const [showNoteDraftModal, setShowNoteDraftModal] = useState(false);
	  const [noteDraftId, setNoteDraftId] = useState('');
	  const [noteDraftMeta, setNoteDraftMeta] = useState<any | null>(null);
	  const [noteDraftReadOnly, setNoteDraftReadOnly] = useState(false);
	  const [noteDraftSnapshot, setNoteDraftSnapshot] = useState<any>(null);
	  const [noteDraftForm, setNoteDraftForm] = useState<{ title: string; subject: string }>({
	    title: '筆記',
	    subject: String(DEFAULT_SUBJECT)
	  });
	  const [noteWizardOpen, setNoteWizardOpen] = useState(false);
	  const [noteWizardMode, setNoteWizardMode] = useState<'save' | 'publish'>('save');
	  const [discussionClassFolderId, setDiscussionClassFolderId] = useState('');
	  const [quizClassFolderId, setQuizClassFolderId] = useState('');
	  const [contestClassFolderId, setContestClassFolderId] = useState('');
	  const [botTaskClassFolderId, setBotTaskClassFolderId] = useState('');
	  const [gameClassFolderId, setGameClassFolderId] = useState('');
  const [rangerClassFolderId, setRangerClassFolderId] = useState('');
  const [mathClassFolderId, setMathClassFolderId] = useState('');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [assignmentResponses, setAssignmentResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [myBots, setMyBots] = useState<any[]>([]);
  const [showBotTaskAssignModal, setShowBotTaskAssignModal] = useState(false);
  const [botTaskForm, setBotTaskForm] = useState<{ botId: string; subject: string; targetClasses: string[]; targetGroups: string[] }>({
    botId: '',
    subject: String(DEFAULT_SUBJECT),
    targetClasses: [],
    targetGroups: []
  });
  const [botTaskThreadModalOpen, setBotTaskThreadModalOpen] = useState(false);
  const [botTaskThreadModalTitle, setBotTaskThreadModalTitle] = useState('');
  const [botTaskThreadMessages, setBotTaskThreadMessages] = useState<any[]>([]);

  // 篩選狀態
  const [filterSubject, setFilterSubject] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(false);
  const [filterOptionsLoaded, setFilterOptionsLoaded] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const teacherGradeOptions = useMemo(() => {
    const grades = Array.from(new Set(availableClasses.map((c) => parseGradeFromClassName(c)).filter(Boolean)));
    grades.sort((a, b) => Number(a) - Number(b));
    return grades;
  }, [availableClasses]);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [viewingResultDetails, setViewingResultDetails] = useState<any>(null); // State for viewing specific student result details
  const [aiReportModalOpen, setAiReportModalOpen] = useState(false);
  const [aiReportLoading, setAiReportLoading] = useState(false);
  const [aiReportError, setAiReportError] = useState('');
  const [aiReportData, setAiReportData] = useState<any | null>(null);
  const [aiReportTitle, setAiReportTitle] = useState('');
  const [aiReportRequest, setAiReportRequest] = useState<null | { toolType: 'quiz' | 'contest'; toolId: string; scope: 'overall' | 'student'; studentId?: string }>(null);
  const [showGamePreviewModal, setShowGamePreviewModal] = useState(false);
  const [previewGame, setPreviewGame] = useState<any>(null);
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [allStudents, setAllStudents] = useState<any[]>([]); // Store all students for completion checking

  // 分組篩選狀態
  const [filterGroup, setFilterGroup] = useState('');
  const [filterGroupOptions, setFilterGroupOptions] = useState<string[]>([]);

  // 多選刪除狀態
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedAssignments, setSelectedAssignments] = useState<string[]>([]);
  const [hiddenTaskKeys, setHiddenTaskKeys] = useState<Set<string>>(() => new Set());
  const [showHiddenAssignments, setShowHiddenAssignments] = useState(false);

  // 學生進度（教師查看）
  const [showStudentProgressModal, setShowStudentProgressModal] = useState(false);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState('');
  const [progressRows, setProgressRows] = useState<Array<{
    id: string;
    name: string;
    username: string;
    className: string;
    points: number;
    received: number;
    completed: number;
    pending: number;
  }>>([]);
  const [progressSearch, setProgressSearch] = useState('');
  const [progressFilterClass, setProgressFilterClass] = useState('');
  const [progressFilterSubject, setProgressFilterSubject] = useState('');
  const [progressFilterGroup, setProgressFilterGroup] = useState('');
  const [progressIncludeHidden, setProgressIncludeHidden] = useState(false);

  // 教師加分（我的獎勵）
  const [pointsGrantLoading, setPointsGrantLoading] = useState(false);
  const [pointsGrantError, setPointsGrantError] = useState('');
  const [pointsGrantMode, setPointsGrantMode] = useState<'student' | 'class'>('student');
  const [pointsGrantStudents, setPointsGrantStudents] = useState<any[]>([]);
  const [pointsGrantClass, setPointsGrantClass] = useState('');
  const [pointsGrantStudentId, setPointsGrantStudentId] = useState('');
  const [pointsGrantAmount, setPointsGrantAmount] = useState<number>(10);
  const [pointsGrantDescription, setPointsGrantDescription] = useState('');

  // 學生詳細任務查看
  const [showStudentTaskModal, setShowStudentTaskModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [studentTasks, setStudentTasks] = useState<any[]>([]);
  const [studentTasksLoading, setStudentTasksLoading] = useState(false);

  // 小遊戲相關狀態
  const [showGameModal, setShowGameModal] = useState(false);
	  const [gameType, setGameType] = useState<'maze' | 'matching' | 'tower-defense' | 'math' | 'ranger-td' | null>(null);
  const [gameDraftId, setGameDraftId] = useState('');
  const [gameDraftMeta, setGameDraftMeta] = useState<any | null>(null);
  const [gameDraftReadOnly, setGameDraftReadOnly] = useState(false);
  const [gameWizardOpen, setGameWizardOpen] = useState(false);
  const [gameWizardMode, setGameWizardMode] = useState<'save' | 'publish'>('save');

  // 問答比賽相關狀態
  const [showContestModal, setShowContestModal] = useState(false);
  const [contestForm, setContestForm] = useState({
    title: '',
    topic: '',
    scopeText: '',
    advancedOnly: false,
    subject: DEFAULT_SUBJECT,
    grade: '小一',
    questionCount: 10,
    timeLimitSeconds: null as number | null,
    targetClasses: [] as string[],
    targetGroups: [] as string[]
  });
  const [contestDraftId, setContestDraftId] = useState('');
  const [contestDraftMeta, setContestDraftMeta] = useState<any | null>(null);
  const [contestDraftReadOnly, setContestDraftReadOnly] = useState(false);
  const [contestWizardOpen, setContestWizardOpen] = useState(false);
  const [contestWizardMode, setContestWizardMode] = useState<'save' | 'publish'>('save');
  const [gameForm, setGameForm] = useState({
    title: '',
    description: '',
    subject: DEFAULT_SUBJECT,
    targetClasses: [] as string[],
    targetGroups: [] as string[],
    questions: [] as Array<{
      question: string;
      answer: string;
      wrongOptions?: string[];
    }>,
    difficulty: 'medium' as 'easy' | 'medium' | 'hard'
  });

  const [towerDefenseQuestions, setTowerDefenseQuestions] = useState<TowerDefenseQuestionDraft[]>([]);
  const [towerDefenseTimeSeconds, setTowerDefenseTimeSeconds] = useState(60);
  const [towerDefenseTimeSecondsText, setTowerDefenseTimeSecondsText] = useState('60');
  const [towerDefenseLivesEnabled, setTowerDefenseLivesEnabled] = useState(true);
  const [towerDefenseLivesLimit, setTowerDefenseLivesLimit] = useState(10);

  // Ranger 塔防（數學驅動）
  const [rangerForm, setRangerForm] = useState({ title: '', description: '', targetClasses: [] as string[], targetGroups: [] as string[] });
  const [rangerGrade, setRangerGrade] = useState<'小一' | '小二' | '小三' | '小四' | '小五' | '小六'>('小一');
  const [rangerSubject, setRangerSubject] = useState<Subject>(DEFAULT_SUBJECT);
  const [rangerStageQuestionCount, setRangerStageQuestionCount] = useState(10);
  const [rangerEquationPercentText, setRangerEquationPercentText] = useState('30'); // 方程式比例
  const [rangerDecimalPercentText, setRangerDecimalPercentText] = useState('50'); // 小數比例
  const [rangerOps, setRangerOps] = useState<{ add: boolean; sub: boolean; mul: boolean; div: boolean; paren: boolean }>({
    add: true,
    sub: true,
    mul: true,
    div: true,
    paren: true
  });
  const [rangerRunSeconds, setRangerRunSeconds] = useState(300);
  const [rangerRunSecondsText, setRangerRunSecondsText] = useState('300');
  const [rangerAllowNegative, setRangerAllowNegative] = useState(false);
  const [rangerMinValueText, setRangerMinValueText] = useState('0');
  const [rangerMaxValueText, setRangerMaxValueText] = useState('50');
  const [rangerMaxDenText, setRangerMaxDenText] = useState('20');
  const [rangerMaxDecimalPlacesText, setRangerMaxDecimalPlacesText] = useState('2');
  const [rangerEquationSteps, setRangerEquationSteps] = useState<1 | 2>(2);
  const [rangerEquationAnswerType, setRangerEquationAnswerType] = useState<'any' | 'int' | 'properFraction' | 'decimal'>('int');
  const [rangerAnswerMode, setRangerAnswerMode] = useState<'mcq' | 'input'>('mcq');
  const [rangerMcqQuestions, setRangerMcqQuestions] = useState<TowerDefenseQuestionDraft[]>([]);
  const [rangerWrongTowerDamageText, setRangerWrongTowerDamageText] = useState('2');
  const [rangerTowerHpText, setRangerTowerHpText] = useState('20');
  const [rangerPromptText, setRangerPromptText] = useState('');

  // 數學測驗
  const [mathGameTab, setMathGameTab] = useState<'manual' | 'ai'>('manual');
  const [mathAnswerMode, setMathAnswerMode] = useState<'mcq' | 'input'>('input');
  const [mathQuestionType, setMathQuestionType] = useState<'calc' | 'equation'>('calc');
  const [mathGrade, setMathGrade] = useState<'小一' | '小二' | '小三' | '小四' | '小五' | '小六'>('小一');
  const [mathOps, setMathOps] = useState<{ add: boolean; sub: boolean; mul: boolean; div: boolean; paren: boolean }>({
    add: true,
    sub: true,
    mul: true,
    div: true,
    paren: true
  });
  const [mathNumberMode, setMathNumberMode] = useState<'fraction' | 'decimal'>('fraction');
  const [mathPromptText, setMathPromptText] = useState('');
  const [mathAiLoading, setMathAiLoading] = useState(false);
  const [mathAiError, setMathAiError] = useState('');
  const [mathQuestionCount, setMathQuestionCount] = useState(10);
  const [mathTimeEnabled, setMathTimeEnabled] = useState(false);
  const [mathTimeSeconds, setMathTimeSeconds] = useState(60);
  const [mathTimeSecondsText, setMathTimeSecondsText] = useState('60');
  const [mathAllowNegative, setMathAllowNegative] = useState(false);
  const [mathMinValueText, setMathMinValueText] = useState('0');
  const [mathMaxValueText, setMathMaxValueText] = useState('50');
  const [mathMaxDenText, setMathMaxDenText] = useState('20');
  const [mathMaxDecimalPlacesText, setMathMaxDecimalPlacesText] = useState('2');
  const [mathEquationSteps, setMathEquationSteps] = useState<1 | 2>(1);
  const [mathEquationAnswerType, setMathEquationAnswerType] = useState<'any' | 'int' | 'properFraction' | 'decimal'>('int');
  const [mathForm, setMathForm] = useState({
    title: '',
    description: '',
    targetClasses: [] as string[],
    targetGroups: [] as string[]
  });
  const [mathDrafts, setMathDrafts] = useState<MathDraft[]>([]);

  useEffect(() => {
    setTowerDefenseTimeSecondsText(String(towerDefenseTimeSeconds));
  }, [towerDefenseTimeSeconds]);

  const clampTowerDefenseTimeSeconds = (raw: string, fallback: number) => {
    const n = Number.parseInt(String(raw || '').trim(), 10);
    if (!Number.isFinite(n)) return Math.max(10, Math.min(600, fallback));
    return Math.max(10, Math.min(600, n));
  };

  // 處理內容顯示的輔助函數
  const getDisplayContent = (content: any) => {
    if (!content) return '無內容';

    // 如果是字符串，直接返回
    if (typeof content === 'string') {
      return content;
    }

    // 如果是對象，嘗試提取內容
    if (typeof content === 'object') {
      // 如果有 value 屬性，使用它
      if (content.value) {
        return content.value;
      }

      // 如果是數組格式的內容塊
      if (Array.isArray(content)) {
        return content.map(block => block.value || '').join('');
      }

      // 其他情況，轉換為JSON字符串查看
      return JSON.stringify(content);
    }

    return '無內容';
  };

  // 移除固定班級列表，改用動態載入的 availableClasses

  // 執行富文本格式化命令
  const execCommand = (command: string, value?: string) => {
    if (discussionDraftReadOnly) return;
    document.execCommand(command, false, value);
    if (editorRef) {
      setDiscussionForm(prev => ({
        ...prev,
        content: editorRef.innerHTML
      }));
    }
  };

  // 格式化按鈕
  const formatBold = () => execCommand('bold');
  const formatItalic = () => execCommand('italic');
  const formatUnderline = () => execCommand('underline');
  const changeFontSize = (size: string) => {
    setCurrentFontSize(size);
    execCommand('fontSize', '3');
    // 手動設置字體大小
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const span = document.createElement('span');
      span.style.fontSize = size + 'px';
      try {
        range.surroundContents(span);
      } catch (e) {
        span.appendChild(range.extractContents());
        range.insertNode(span);
      }
    }
  };

  const changeTextColor = (color: string) => {
    setCurrentTextColor(color);
    execCommand('foreColor', color);
  };

  // 處理圖片上傳
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (discussionDraftReadOnly) return;
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const img = document.createElement('img');
        img.src = base64;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '8px';
        img.style.margin = '10px 0';

        if (editorRef) {
          editorRef.appendChild(img);
          setDiscussionForm(prev => ({
            ...prev,
            content: editorRef.innerHTML
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // 插入連結
  const insertLink = () => {
    if (discussionDraftReadOnly) return;
    const linkUrl = prompt('請輸入連結URL:');
    if (linkUrl) {
      const linkText = prompt('請輸入連結文字:') || linkUrl;
      execCommand('createLink', linkUrl);
    }
  };

  const normalizeTeacherSettingsFromUser = () => {
    const profile: any = user?.profile || {};
    const homeroomClass = typeof profile.homeroomClass === 'string' ? profile.homeroomClass : '';
    const subjectsTaught = Array.isArray(profile.subjectsTaught) ? profile.subjectsTaught.filter((s: any) => typeof s === 'string') : [];
    const subjectGroups: Record<string, string[]> = {};
    if (profile.subjectGroups && typeof profile.subjectGroups === 'object') {
      Object.entries(profile.subjectGroups as Record<string, any>).forEach(([subject, groups]) => {
        if (!Array.isArray(groups)) return;
        subjectGroups[subject] = groups.filter((g: any) => typeof g === 'string');
      });
    }
    return { homeroomClass, subjectsTaught, subjectGroups };
  };

  const openSettings = async () => {
    setShowSettingsModal(true);
    setTeacherSettingsError('');

    // teacher settings init
    const nextDraft = normalizeTeacherSettingsFromUser();
    setTeacherSettingsDraft(nextDraft);
    try {
      if (availableSubjects.length === 0 || availableClasses.length === 0) {
        await loadFilterOptions();
      }

      const subjects = nextDraft.subjectsTaught;
      if (subjects.length === 0) {
        setGroupOptionsBySubject({});
        return;
      }
      const results = await Promise.all(
        subjects.map(async (subject) => {
          const data = await authService.getAvailableClasses(subject);
          return { subject, groups: (data.groups || []).slice().sort() };
        })
      );
      const map: Record<string, string[]> = {};
      results.forEach((r) => { map[r.subject] = r.groups; });
      setGroupOptionsBySubject(map);
    } catch (error) {
      console.error('載入教師設定選項失敗:', error);
    }
  };

  const saveTeacherSettings = async () => {
    try {
      setTeacherSettingsSaving(true);
      setTeacherSettingsError('');
      await authService.updateMyTeacherSettings(teacherSettingsDraft);
      refreshUser();
      alert('教師設定已更新');
    } catch (error) {
      console.error('更新教師設定失敗:', error);
      setTeacherSettingsError(error instanceof Error ? error.message : '更新失敗');
    } finally {
      setTeacherSettingsSaving(false);
    }
  };

  const toggleSubjectTaught = async (subject: string) => {
    const already = teacherSettingsDraft.subjectsTaught.includes(subject);
    if (already) {
      setTeacherSettingsDraft((prev) => {
        const { [subject]: _removed, ...restGroups } = prev.subjectGroups;
        return {
          ...prev,
          subjectsTaught: prev.subjectsTaught.filter((s) => s !== subject),
          subjectGroups: restGroups
        };
      });
      setGroupOptionsBySubject((prev) => {
        const { [subject]: _removed, ...rest } = prev;
        return rest;
      });
      return;
    }

    setTeacherSettingsDraft((prev) => ({
      ...prev,
      subjectsTaught: [...prev.subjectsTaught, subject],
      subjectGroups: { ...prev.subjectGroups, [subject]: prev.subjectGroups[subject] || [] }
    }));

    try {
      const data = await authService.getAvailableClasses(subject);
      const groups = (data.groups || []).slice().sort();
      setGroupOptionsBySubject((prev) => ({ ...prev, [subject]: groups }));
      setTeacherSettingsDraft((prev) => {
        const selected = prev.subjectGroups[subject] || [];
        const allowed = new Set(groups);
        const nextSelected = selected.filter((g) => allowed.has(g));
        return { ...prev, subjectGroups: { ...prev.subjectGroups, [subject]: nextSelected } };
      });
    } catch (error) {
      console.error('載入科目分組失敗:', error);
      setGroupOptionsBySubject((prev) => ({ ...prev, [subject]: [] }));
    }
  };

  const toggleSubjectGroup = (subject: string, group: string) => {
    setTeacherSettingsDraft((prev) => {
      const current = Array.isArray(prev.subjectGroups[subject]) ? prev.subjectGroups[subject] : [];
      const next = current.includes(group) ? current.filter((g) => g !== group) : [...current, group];
      return { ...prev, subjectGroups: { ...prev.subjectGroups, [subject]: next } };
    });
  };

  const openAiGenerator = (config: {
    mode: 'mcq' | 'pairs';
    title: string;
    subject: string;
    importModes?: Array<'replace' | 'append'>;
    onImport: (payload: any, importMode: 'replace' | 'append') => void;
  }) => {
    setAiGeneratorMode(config.mode);
    setAiGeneratorTitle(config.title);
    setAiGeneratorSubject(config.subject);
    setAiGeneratorImportModes(config.importModes || ['replace']);
    aiGeneratorOnImportRef.current = config.onImport;
    setShowAiGenerator(true);
  };

  // === 作業管理功能 ===

  // 載入作業列表（包含小測驗和遊戲）
  const loadAssignments = async () => {
    try {
      setLoading(true);

      // 並行載入自己的作業、小測驗、遊戲和問答比賽
      const [assignmentData, quizData, gameData, botTaskData, contestData] = await Promise.all([
        authService.getTeacherAssignments(filterSubject || undefined, filterClass || undefined),
        authService.getTeacherQuizzes(filterSubject || undefined, filterClass || undefined),
        authService.getTeacherGames(filterSubject || undefined, filterClass || undefined),
        authService.getTeacherBotTasks(filterSubject || undefined, filterClass || undefined),
        authService.getTeacherContests(filterSubject || undefined, filterClass || undefined)
      ]);

      const mine = [
        ...(assignmentData.assignments || []).map((item: any) => ({ ...item, type: 'assignment' })),
        ...(quizData.quizzes || []).map((item: any) => ({ ...item, type: 'quiz' })),
        ...(gameData.games || []).map((item: any) => ({ ...item, type: 'game' })),
	        ...(botTaskData.tasks || []).map((item: any) => ({
	          ...item,
	          type: 'ai-bot',
	          title: item.title || item.botName || 'AI小助手任務',
	          targetClasses: item.targetClasses || [],
	          responseCount: item.completedStudents ?? 0,
	          uniqueStudents: item.completedStudents ?? 0
	        })),
        ...(contestData.contests || []).map((item: any) => ({
          ...item,
          type: 'contest',
          responseCount: item.totalAttempts ?? 0,
          uniqueStudents: item.uniqueParticipants ?? 0,
          averageScore: item.averageScore ?? 0
        }))
	      ];

      // 同科同級其他教師任務（需要先在設定中填寫所屬班級/任教科目）
      const profile: any = user?.profile || {};
      const homeroomClass = typeof profile.homeroomClass === 'string' ? profile.homeroomClass : '';
      const grade = parseGradeFromClassName(homeroomClass);
      const subjectsTaught = Array.isArray(profile.subjectsTaught) ? profile.subjectsTaught.filter((s: any) => typeof s === 'string') : [];
      const subjectGroups: Record<string, string[]> = profile.subjectGroups && typeof profile.subjectGroups === 'object' ? profile.subjectGroups : {};

      const subjectsForShared = (filterSubject ? [filterSubject] : subjectsTaught).filter((s) => subjectsTaught.includes(s));
      const shared: any[] = [];

      if (grade && subjectsForShared.length > 0) {
        const results = await Promise.all(
          subjectsForShared.map(async (subject) => {
            const groups = Array.isArray(subjectGroups[subject]) ? subjectGroups[subject] : [];
            const [a, q, g] = await Promise.all([
              authService.getSharedAssignments({ subject, grade, targetClass: filterClass || undefined, groups }),
              authService.getSharedQuizzes({ subject, grade, targetClass: filterClass || undefined, groups }),
              authService.getSharedGames({ subject, grade, targetClass: filterClass || undefined, groups })
            ]);
            return { subject, a, q, g };
          })
        );

        results.forEach(({ a, q, g }) => {
          (a.assignments || []).forEach((item: any) => shared.push({ ...item, type: 'assignment', isShared: true }));
          (q.quizzes || []).forEach((item: any) => shared.push({ ...item, type: 'quiz', isShared: true }));
          (g.games || []).forEach((item: any) => shared.push({ ...item, type: 'game', isShared: true }));
        });
      }

      // 合併並標記來源
      let allAssignments = [...mine, ...shared];

      // 收集所有分組選項
      const allGroups = new Set<string>();
      allAssignments.forEach(item => {
        if (Array.isArray(item.targetGroups)) {
          item.targetGroups.forEach((g: string) => allGroups.add(g));
        }
      });
      setFilterGroupOptions(Array.from(allGroups).sort());

      // 如果有分組篩選，過濾結果
      if (filterGroup) {
        allAssignments = allAssignments.filter(item =>
          Array.isArray(item.targetGroups) && item.targetGroups.includes(filterGroup)
        );
      }

      // 按創建時間排序（最新的在前面）
      allAssignments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setAssignments(allAssignments);
    } catch (error) {
      console.error('載入作業失敗:', error);
      alert('載入作業失敗：' + (error instanceof Error ? error.message : '未知錯誤'));
    } finally {
      setLoading(false);
    }
  };

	  const openBotTaskAssign = async () => {
	    let bots = myBots;
	    if (bots.length === 0) {
	      try {
	        const botsResp = await authService.getMyChatBots();
	        bots = Array.isArray(botsResp.bots) ? botsResp.bots : [];
	        setMyBots(bots);
	      } catch (err) {
	        console.error('Failed to load bot list', err);
	        bots = [];
	        setMyBots([]);
	      }
	    }

	    if (bots.length === 0) {
	      alert('請先在「AI對話 → AI小助手」建立一個 AI小助手，才可以派發。');
	      return;
	    }

	    const defaultBotId = String(bots[0]?.id || '');
	    const defaultSubject = filterSubject || String(DEFAULT_SUBJECT);
	    setBotTaskForm({
	      botId: defaultBotId,
	      subject: defaultSubject,
	      targetClasses: filterClass ? [filterClass] : [],
	      targetGroups: []
	    });
      setBotTaskClassFolderId('');
	    loadClassesAndGroups(defaultSubject);
	    setShowBotTaskAssignModal(true);
	  };

  const submitBotTaskAssign = async () => {
    try {
      if (!botTaskForm.botId) return alert('請選擇 AI小助手');
      if (!botTaskForm.subject) return alert('請選擇科目');
      if (botTaskForm.targetClasses.length === 0) return alert('請選擇班級');
      if (botTaskForm.targetClasses.length !== 1) return alert('請只選擇 1 個班級（資料夾屬於單一班別）');
      if (GROUPS_ENABLED && botTaskForm.targetGroups.length > 0) return alert('使用資料夾分類時暫不支援分組派發，請取消分組');
      if (!botTaskClassFolderId) return alert('請選擇資料夾（學段→課題→子folder可選）');
      await authService.createBotTask({
        botId: botTaskForm.botId,
        subject: botTaskForm.subject,
        targetClasses: botTaskForm.targetClasses,
        targetGroups: GROUPS_ENABLED ? botTaskForm.targetGroups : [],
        classFolderId: botTaskClassFolderId
      });
      alert('AI小助手任務已派發！');
      setShowBotTaskAssignModal(false);
      await loadAssignments();
    } catch (error) {
      alert('派發失敗：' + (error instanceof Error ? error.message : '未知錯誤'));
    }
  };

  const openBotTaskThreadMessages = async (taskId: string, threadId: string) => {
    try {
      setLoading(true);
      const data = await authService.getBotTaskThreadMessages(taskId, threadId);
      const studentName = data.student?.name || '學生';
      setBotTaskThreadModalTitle(`${studentName} 的對話記錄`);
      setBotTaskThreadMessages(Array.isArray(data.messages) ? data.messages : []);
      setBotTaskThreadModalOpen(true);
    } catch (error) {
      alert('載入對話失敗：' + (error instanceof Error ? error.message : '未知錯誤'));
    } finally {
      setLoading(false);
    }
  };

  // 載入篩選選項
  const loadFilterOptions = async () => {
    if (filterOptionsLoading) return;
    try {
      setFilterOptionsLoading(true);
      const [subjectsData, classesData] = await Promise.all([
        authService.getAvailableSubjects(),
        authService.getAvailableClasses()
      ]);
      setAvailableSubjects(subjectsData.subjects || []);
      setAvailableClasses(classesData.classes || []);
      setFilterOptionsLoaded(true);
    } catch (error) {
      console.error('載入篩選選項失敗:', error);
    } finally {
      setFilterOptionsLoading(false);
    }
  };

  // 教師頁首次載入就預取班別/年級資料，避免「開咗作業管理先有分層」的體驗
  useEffect(() => {
    if (!user?.id) return;
    if (user.role !== 'teacher' && user.role !== 'admin') return;
    if (filterOptionsLoaded || filterOptionsLoading) return;
    void loadFilterOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  // 圖片壓縮函式
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = document.createElement('img');
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // 調整尺寸以利壓縮 (最大寬度 800px)
          const MAX_WIDTH = 800;
          if (width > MAX_WIDTH) {
            height = height * (MAX_WIDTH / width);
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas Context fail'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);

          // 壓縮至 JPEG, 品質 0.8
          let quality = 0.8;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);

          // 如果還是太大，降低品質直到 1MB 以下
          while (dataUrl.length > 1000 * 1024 && quality > 0.1) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          resolve(dataUrl);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // 處理問題圖片上傳
  const handleQuestionImageUpload = async (questionIndex: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        setImageUploading(true);
        const compressedImage = await compressImage(file);
        updateQuestion(questionIndex, 'image', compressedImage);
      } catch (error) {
        console.error('圖片處理失敗:', error);
        alert('圖片處理失敗，請重試');
      } finally {
        setImageUploading(false);
      }
    }
    // 重置 input
    event.target.value = '';
  };

  // 載入班級和分組資料選項（用於創建討論串/測驗）
  const loadClassesAndGroups = async (subject?: string) => {
    try {
      const data = await authService.getAvailableClasses(subject);
      setAvailableClasses(data.classes || []);
      setAvailableGroups(data.groups || []);
    } catch (error) {
      console.error('載入班級和分組失敗:', error);
    }
  };

  // 查看作業詳情和學生回應
  const viewAssignmentDetails = async (assignment: any) => {
    try {
      setLoading(true);
      const isQuiz = assignment.type === 'quiz';
      const isGame = assignment.type === 'game';
      const isBotTask = assignment.type === 'ai-bot';
      const isContest = assignment.type === 'contest';

      if (isGame) {
        // 載入遊戲結果
        const data = await authService.getGameResults(assignment.id);
        const scores = Array.isArray(data.scores) ? data.scores : [];
        const attemptsByStudent = scores.reduce((acc: Record<string, number>, s: any) => {
          const sid = String(s.studentId || '');
          if (!sid) return acc;
          acc[sid] = (acc[sid] || 0) + 1;
          return acc;
        }, {});

        const studentById = new Map<string, any>(
          allStudents.map((s: any) => [String(s.id), s] as [string, any])
        );

        setSelectedAssignment(assignment);
        setAssignmentResponses(scores.map((s: any) => {
          const student = studentById.get(String(s.studentId || ''));
          return {
            ...s,
            submittedAt: s.completedAt,
            playedAt: s.completedAt,
            studentUsername: student?.username || s.studentUsername,
            studentClass: student?.profile?.class || s.studentClass,
            attempts: attemptsByStudent[String(s.studentId || '')] || s.attempts
          };
        })); // 遊戲成績
        setEditedContent(assignment.description || '迷宮追逐遊戲');
      } else if (isQuiz) {
        // 載入小測驗結果
        const data = await authService.getQuizResults(assignment.id);
        setSelectedAssignment(assignment);
        setAssignmentResponses(data.results || []); // 測驗結果
        setEditedContent(assignment.description || '小測驗');
      } else if (isContest) {
        // 載入問答比賽結果
        const data = await authService.getContestResults(assignment.id);
        setSelectedAssignment(assignment);
        setAssignmentResponses(data.attempts || []); // 比賽參賽記錄
        setEditedContent(assignment.topic || '問答比賽');
      } else if (isBotTask) {
        const data = await authService.getBotTaskThreads(assignment.id);
        setSelectedAssignment(assignment);
        setAssignmentResponses(Array.isArray(data.threads) ? data.threads : []);
        setEditedContent('');
      } else {
        // 載入一般作業回應
        const data = await authService.getAssignmentResponses(assignment.id);
        setSelectedAssignment(assignment);
        setAssignmentResponses(data.responses || []);
        setEditedContent(getDisplayContent(assignment.content));
      }

      setIsEditingContent(false);
    } catch (error) {
      console.error('載入詳情失敗:', error);
      alert('載入詳情失敗：' + (error instanceof Error ? error.message : '未知錯誤'));
    } finally {
      setLoading(false);
    }
  };

  const openAiReport = async (payload: { toolType: 'quiz' | 'contest'; toolId: string; scope: 'overall' | 'student'; studentId?: string; titleSuffix?: string }) => {
    setAiReportModalOpen(true);
    setAiReportLoading(true);
    setAiReportError('');
    setAiReportData(null);
    setAiReportRequest({ toolType: payload.toolType, toolId: payload.toolId, scope: payload.scope, studentId: payload.studentId });
    setAiReportTitle(`${payload.toolType === 'quiz' ? '小測驗' : '問答比賽'} AI 報告${payload.titleSuffix ? ` - ${payload.titleSuffix}` : ''}`);
    try {
      const data = payload.toolType === 'quiz'
        ? await authService.getQuizAiReport(payload.toolId, { scope: payload.scope, studentId: payload.studentId })
        : await authService.getContestAiReport(payload.toolId, { scope: payload.scope, studentId: payload.studentId });
      setAiReportData(data?.report || null);
    } catch (e: any) {
      setAiReportError(e?.message || '載入 AI 報告失敗');
    } finally {
      setAiReportLoading(false);
    }
  };

  const regenerateAiReport = async () => {
    if (!aiReportRequest) return;
    setAiReportLoading(true);
    setAiReportError('');
    try {
      const data = aiReportRequest.toolType === 'quiz'
        ? await authService.regenerateQuizAiReport(aiReportRequest.toolId, { scope: aiReportRequest.scope, studentId: aiReportRequest.studentId })
        : await authService.regenerateContestAiReport(aiReportRequest.toolId, { scope: aiReportRequest.scope, studentId: aiReportRequest.studentId });
      setAiReportData(data?.report || null);
    } catch (e: any) {
      setAiReportError(e?.message || '重新生成 AI 報告失敗');
    } finally {
      setAiReportLoading(false);
    }
  };

  // 保存編輯的內容
  const handleSaveContent = async () => {
    try {
      // 這裡需要調用後端API來更新討論內容
      // 暫時更新本地狀態
      setSelectedAssignment({
        ...selectedAssignment,
        content: editedContent
      });
      setIsEditingContent(false);
      // TODO: 實現後端API調用
      console.log('保存內容:', editedContent);
    } catch (error) {
      console.error('保存內容失敗:', error);
    }
  };

  // 刪除單個回應
  const handleDeleteResponse = async (responseId: string) => {
    if (!confirm('確定要刪除這個回應嗎？')) return;

    try {
      await authService.deleteResponse(responseId);
      alert('回應已刪除');

      // 重新載入回應列表
      if (selectedAssignment) {
        await viewAssignmentDetails(selectedAssignment);
      }
    } catch (error) {
      console.error('刪除回應失敗:', error);
      alert('刪除回應失敗：' + (error instanceof Error ? error.message : '未知錯誤'));
    }
  };

  // 刪除整個作業或小測驗
  const handleDeleteAssignment = async (assignment: any) => {
    const itemType = assignment.type === 'quiz' ? '小測驗' : assignment.type === 'game' ? '遊戲' : assignment.type === 'ai-bot' ? 'AI小助手任務' : assignment.type === 'contest' ? '問答比賽' : '作業';
    if (!confirm(`確定要刪除整個${itemType}及其所有回應嗎？此操作無法復原！`)) return;

    try {
      if (assignment.type === 'quiz') await authService.deleteQuiz(assignment.id);
      else if (assignment.type === 'game') await authService.deleteGame(assignment.id);
      else if (assignment.type === 'ai-bot') await authService.deleteBotTask(assignment.id);
      else if (assignment.type === 'contest') await authService.deleteContest(assignment.id);
      else await authService.deleteAssignment(assignment.id);

      alert(`${itemType}已刪除`);

      // 重新載入列表
      await loadAssignments();

      // 如果正在查看被刪除的項目，關閉詳情視圖
      if (selectedAssignment && selectedAssignment.id === assignment.id) {
        setSelectedAssignment(null);
        setAssignmentResponses([]);
      }
    } catch (error) {
      console.error(`刪除${itemType}失敗:`, error);
      alert(`刪除${itemType}失敗：` + (error instanceof Error ? error.message : '未知錯誤'));
    }
  };

  const saveDiscussionAsTemplate = async (assignment: any) => {
    try {
      const isQuiz = assignment?.type === 'quiz';
      const isGame = assignment?.type === 'game';
      const isBot = assignment?.type === 'ai-bot';
      const isContest = assignment?.type === 'contest';
      if (isQuiz || isGame || isBot || isContest) {
        alert('此類型暫不支援存為模板');
        return;
      }

      const title = String(assignment?.title || '新模板').trim() || '新模板';
      const subject = String(assignment?.subject || DEFAULT_SUBJECT).trim() || String(DEFAULT_SUBJECT);
      const content = assignment?.content ?? [{ type: 'text', value: '' }];

      const parseGradeFromClassNameLocal = (className?: string) => {
        const match = String(className || '').match(/^(\d+)/);
        return match ? match[1] : '';
      };

      const targetClasses = Array.isArray(assignment?.targetClasses) ? assignment.targetClasses : [];
      const classCandidate = targetClasses.find((c: any) => c && String(c) !== '全部' && String(c) !== '全級') || targetClasses[0] || '';
      let grade = parseGradeFromClassNameLocal(String(classCandidate || ''));
      if (!grade) {
        const profile: any = user?.profile || {};
        grade = parseGradeFromClassNameLocal(profile?.homeroomClass);
      }

      const grades = Array.from(new Set<string>(
        availableClasses
          .map((c: any) => parseGradeFromClassNameLocal(String(c)))
          .filter((g): g is string => Boolean(g))
      ))
        .sort((a, b) => Number(a) - Number(b));

      if (!grade) {
        const input = prompt(`模板年級（輸入數字，例如 4）\n可選：${grades.join(', ')}`, grades[0] || '');
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

      await authService.createMyTemplate({
        grade,
        subject,
        title,
        content,
        ...(folderId ? { folderId } : {})
      });

      alert('已存為模板（我的題庫）');
      setShowTemplateLibrary(true);
    } catch (error) {
      console.error('存為模板失敗:', error);
      alert('存為模板失敗：' + (error instanceof Error ? error.message : '未知錯誤'));
    }
  };

	  // 開啟作業管理模態框
	  const openAssignmentManagement = async () => {
	    setShowAssignmentModal(true);
      setShowHiddenAssignments(false);
	    await loadFilterOptions();
	    await loadAssignments();
      try {
        const botsResp = await authService.getMyChatBots();
        setMyBots(Array.isArray(botsResp.bots) ? botsResp.bots : []);
      } catch (err) {
        console.error('Failed to load bot list', err);
        setMyBots([]);
      }
    // Fetch all students for completion tracking
    try {
      const usersData = await authService.getStudentRoster({ limit: 2000 });
      setAllStudents(usersData.users || []);
    } catch (err) {
      console.error('Failed to load students list', err);
	    }
	  };

  useEffect(() => {
    if (!showAssignmentModal) return;
    if (!user?.id) return;
    setHiddenTaskKeys(loadHiddenTaskKeys(user.id, 'teacher'));
  }, [showAssignmentModal, user?.id]);

  const AUTO_HIDE_DAYS = 14;
  const isAutoHidden = (createdAt?: string) => {
    if (!createdAt) return false;
    const createdMs = new Date(createdAt).getTime();
    if (!Number.isFinite(createdMs)) return false;
    const ageMs = Date.now() - createdMs;
    return ageMs >= AUTO_HIDE_DAYS * 24 * 60 * 60 * 1000;
  };

  const isItemHidden = (item: any) => {
    const key = makeTaskKey(item.type, item.id);
    return isAutoHidden(item.createdAt) || hiddenTaskKeys.has(key);
  };

  const visibleAssignments = useMemo(() => assignments.filter((a) => !isItemHidden(a)), [assignments, hiddenTaskKeys]);
  const hiddenAssignments = useMemo(() => assignments.filter((a) => isItemHidden(a)), [assignments, hiddenTaskKeys]);

  const displayedDeletableAssignmentKeys = useMemo(() => {
    const items = showHiddenAssignments ? [...visibleAssignments, ...hiddenAssignments] : visibleAssignments;
    return items.filter((a: any) => !a?.isShared).map((a) => makeTaskKey(a.type, a.id));
  }, [hiddenAssignments, showHiddenAssignments, visibleAssignments]);

  const setManualHidden = (item: any, hidden: boolean) => {
    if (!user?.id) return;
    if (isAutoHidden(item.createdAt)) return;
    const key = makeTaskKey(item.type, item.id);
    setHiddenTaskKeys((prev) => {
      const next = new Set<string>(prev);
      if (hidden) next.add(key);
      else next.delete(key);
      saveHiddenTaskKeys(user.id, 'teacher', next);
      return next;
    });
  };

  useEffect(() => {
    if (!showStudentProgressModal) return;
    if (!user?.id) return;
    setHiddenTaskKeys(loadHiddenTaskKeys(user.id, 'teacher'));
  }, [showStudentProgressModal, user?.id]);

  // 清除分組篩選當科目改變時，並載入分組選項
  useEffect(() => {
    setProgressFilterGroup('');
    // 如果選擇的科目不是教師任教的科目，需要載入分組選項
    if (progressFilterSubject && !(user?.profile?.subjectGroups?.[progressFilterSubject]?.length > 0)) {
      loadGroupOptionsForSubject(progressFilterSubject);
    }
  }, [progressFilterSubject]);

  // 載入科目分組選項
  const loadGroupOptionsForSubject = async (subject: string) => {
    try {
      const data = await authService.getAvailableClasses(subject);
      const groups = (data.groups || []).slice().sort();
      setGroupOptionsBySubject(prev => ({ ...prev, [subject]: groups }));
    } catch (error) {
      console.error('載入分組選項失敗:', error);
    }
  };

  // 查看學生詳細任務
  const viewStudentTasks = async (studentRow: any) => {
    console.log('viewStudentTasks called for student row:', studentRow);

    // 需要找到原始的學生對象，因為 studentRow 是進度表中的簡化對象
    // 重新獲取學生數據以獲取完整的 profile 信息
    let actualStudent = null;
    try {
      const studentsData = await authService.getStudentRoster({ limit: 2000 });
      const students = (studentsData.users || []).filter((u: any) => u?.role === 'student');
      actualStudent = students.find((s: any) => s.id === studentRow.id);

      if (!actualStudent) {
        // 如果找不到，創建一個兼容的學生對象
        actualStudent = {
          id: studentRow.id,
          username: studentRow.username,
          profile: {
            name: studentRow.name,
            class: studentRow.className,
            // 預設為空的分組信息，之後可以從學生數據中獲取
            chineseGroup: '',
            englishGroup: '',
            mathGroup: ''
          }
        };
      }
    } catch (error) {
      console.error('Failed to get student data:', error);
      // 創建兼容的學生對象
      actualStudent = {
        id: studentRow.id,
        username: studentRow.username,
        profile: {
          name: studentRow.name,
          class: studentRow.className,
          chineseGroup: '',
          englishGroup: '',
          mathGroup: ''
        }
      };
    }

    console.log('Actual student object:', actualStudent);
    setSelectedStudent(actualStudent);
    setShowStudentTaskModal(true);
    setStudentTasksLoading(true);
    setStudentTasks([]);

    try {
      const teacherHidden = loadHiddenTaskKeys(user.id, 'teacher');

	      // 獲取該學生的所有任務（不使用進度篩選器限制）
	      console.log('Loading all tasks for student...');
	      const manageData = await authService.getManageTasks();
	      const allTasks = (Array.isArray(manageData?.tasks) ? manageData.tasks : [])
	        .filter((t: any) => t && t.type && t.id)
	        .filter((t: any) => String(t.type) !== 'note');

	      console.log('All tasks combined:', allTasks.length);

      const filteredTasks = progressIncludeHidden
        ? allTasks
        : allTasks.filter((t: any) => !isAutoHidden(t.createdAt) && !teacherHidden.has(makeTaskKey(t.type, t.id)));

      console.log('Filtered tasks after hidden check:', filteredTasks.length);

      // 只顯示分派給該學生的任務
      const studentTasks = filteredTasks.filter(task => {
        const isTargeted = isStudentTargeted(actualStudent, task);
        console.log(`Task "${task.title}" (${task.type}) targeted to student:`, isTargeted, {
          task: {
            targetClasses: task.targetClasses,
            targetGroups: task.targetGroups,
            subject: task.subject
          },
          student: {
            class: actualStudent?.profile?.class,
            chineseGroup: actualStudent?.profile?.chineseGroup,
            englishGroup: actualStudent?.profile?.englishGroup,
            mathGroup: actualStudent?.profile?.mathGroup
          }
        });
        return isTargeted;
      });

      console.log('Final student tasks:', studentTasks.length);

      // 檢查每個任務的完成狀態
      const tasksWithStatus = await Promise.all(
        studentTasks.map(async (task: any) => {
          let completed = false;
          let completionDetails: any = null;

	          try {
	            if (task.type === 'quiz') {
	              const data = await authService.getQuizResults(task.id);
	              const results = data.results || [];
	              const studentResult = results.find((r: any) => String(r.studentId) === String(actualStudent.id));
	              completed = !!studentResult;
	              if (studentResult) {
	                completionDetails = {
	                  score: studentResult.score || 0,
	                  totalQuestions: studentResult.totalQuestions || 0,
	                  completedAt: studentResult.submittedAt || studentResult.completedAt || studentResult.createdAt
	                };
	              }
	            } else if (task.type === 'game') {
	              const data = await authService.getGameResults(task.id);
	              const scores = data.scores || [];
              const studentScores = scores.filter((s: any) => String(s.studentId) === String(actualStudent.id));
              completed = studentScores.length > 0;
              if (studentScores.length > 0) {
                const bestScore = Math.max(...studentScores.map((s: any) => s.score || 0));
                completionDetails = {
                  bestScore,
                  attempts: studentScores.length,
                  lastPlayedAt: studentScores[studentScores.length - 1]?.completedAt
                };
              }
	            } else if (task.type === 'ai-bot') {
	              const data = await authService.getBotTaskThreads(task.id);
	              const threads = data.threads || [];
	              const studentThread = threads.find((t: any) => String(t.studentId) === String(actualStudent.id));
	              completed = studentThread?.completed || false;
	              if (studentThread) {
	                completionDetails = {
	                  threadId: studentThread.threadId || null,
	                  lastMessageAt: studentThread.lastMessageAt || null
	                };
	              }
	            } else if (task.type === 'contest') {
	              const data = await authService.getContestResults(task.id);
	              const attempts = data.attempts || [];
	              const studentAttempts = attempts.filter((a: any) => String(a.studentId) === String(actualStudent.id));
	              completed = studentAttempts.length > 0;
	              if (studentAttempts.length > 0) {
	                const bestAttempt = studentAttempts.reduce((best: any, current: any) =>
	                  (current.score || 0) > (best.score || 0) ? current : best
	                );
	                completionDetails = {
	                  bestScore: bestAttempt.score || 0,
	                  attempts: studentAttempts.length,
	                  completedAt: bestAttempt.submittedAt || bestAttempt.completedAt || bestAttempt.startedAt
	                };
	              }
	            } else {
	              const data = await authService.getAssignmentResponses(task.id);
	              const responses = data.responses || [];
              const studentResponse = responses.find((r: any) => String(r.studentId) === String(actualStudent.id));
              completed = !!studentResponse;
              if (studentResponse) {
                completionDetails = {
                  submittedAt: studentResponse.submittedAt,
                  responseLength: studentResponse.response?.length || 0
                };
              }
            }
          } catch (error) {
            console.error('檢查任務完成狀態失敗:', task.type, task.id, error);
          }

	          return {
	            ...task,
	            completed,
	            completionDetails,
	            createdAtFormatted: task.createdAt ? new Date(task.createdAt).toLocaleString() : ''
	          };
	        })
	      );

      setStudentTasks(tasksWithStatus.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error('載入學生任務失敗:', error);
    } finally {
      setStudentTasksLoading(false);
    }
  };

  // 重新載入進度當篩選條件改變時
  useEffect(() => {
    if (showStudentProgressModal) {
      loadStudentProgress();
    }
  }, [progressFilterSubject, progressFilterClass, progressFilterGroup, progressIncludeHidden]);

  const openStudentProgress = async () => {
    setShowStudentProgressModal(true);
    setProgressError('');
    if (availableSubjects.length === 0 || availableClasses.length === 0) {
      await loadFilterOptions();
    }
    await loadStudentProgress();
  };

  const extractStudentId = (record: any): string | null => {
    if (!record || typeof record !== 'object') return null;
    const direct = record.studentId || record.userId || record.student?.id || record.student?._id || record.user?.id || record.user?._id;
    return typeof direct === 'string' && direct ? direct : null;
  };

  const getStudentGroupForSubject = (student: any, subject: string): string => {
    const profile = student?.profile || {};
    if (subject === Subject.CHINESE) return profile.chineseGroup || '';
    if (subject === Subject.ENGLISH) return profile.englishGroup || '';
    if (subject === Subject.MATH) return profile.mathGroup || '';
    return '';
  };

  const isStudentTargeted = (student: any, task: any): boolean => {
    const targetClasses = Array.isArray(task.targetClasses) ? task.targetClasses : [];
    const targetGroups = Array.isArray(task.targetGroups) ? task.targetGroups : [];

    if (targetClasses.length > 0) {
      const className = student?.profile?.class || '';
      if (!targetClasses.includes('全部') && !targetClasses.includes(className)) return false;
    }

    if (targetGroups.length > 0) {
      const group = getStudentGroupForSubject(student, String(task.subject));
      if (group && !targetGroups.includes(group)) return false;
    }

    return true;
  };

  const mapWithConcurrency = async <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
    const results: R[] = new Array(items.length);
    let index = 0;
    const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
      while (index < items.length) {
        const current = index++;
        results[current] = await fn(items[current]);
      }
    });
    await Promise.all(workers);
    return results;
  };

	  const loadStudentProgress = async () => {
	    if (!user?.id) return;

	    try {
	      setProgressLoading(true);
	      setProgressError('');

	      const teacherHidden = loadHiddenTaskKeys(user.id, 'teacher');
	      setHiddenTaskKeys(teacherHidden);

	      const [studentsData, manageData] = await Promise.all([
	        authService.getStudentRoster({ limit: 2000 }),
	        authService.getManageTasks({ ...(progressFilterSubject ? { subject: progressFilterSubject } : {}) })
	      ]);

	      const students = (studentsData.users || []).filter((u: any) => u?.role === 'student');
	      setPointsGrantStudents(students);
	      const defaultClass = String(user?.profile?.homeroomClass || '').trim();
	      if (defaultClass && !pointsGrantClass) setPointsGrantClass(defaultClass);

	      const pointsResp = await authService.getStudentsRewards().catch(() => null as any);
	      const pointsById = new Map(
	        (pointsResp?.students || []).map((s: any) => [String(s.userId), Number(s.currentPoints) || 0] as const)
	      );

	      const allTasksRaw = Array.isArray(manageData?.tasks) ? manageData.tasks : [];
	      const tasksAll = allTasksRaw
	        .filter((t: any) => t && t.type && t.id)
	        .filter((t: any) => String(t.type) !== 'note')
	        .filter((t: any) => {
	          if (!progressFilterClass) return true;
	          const classes = Array.isArray(t.targetClasses) ? t.targetClasses : [];
	          if (classes.length === 0) return true;
	          return classes.includes('全部') || classes.includes(progressFilterClass);
	        })
	        .filter((t: any) => {
	          if (!progressFilterGroup) return true;
	          const groups = Array.isArray(t.targetGroups) ? t.targetGroups : [];
	          return groups.length === 0 || groups.includes(progressFilterGroup);
	        });

	      const countedTasks = progressIncludeHidden
	        ? tasksAll
	        : tasksAll.filter((t: any) => !isAutoHidden(t.createdAt) && !teacherHidden.has(makeTaskKey(t.type, t.id)));

      const completionEntries = await mapWithConcurrency(
        countedTasks,
        6,
        async (task: any) => {
          const key = makeTaskKey(task.type, task.id);
          try {
            if (task.type === 'quiz') {
              const data = await authService.getQuizResults(task.id);
              const ids = (data.results || []).map(extractStudentId).filter(Boolean) as string[];
              return { key, set: new Set(ids) };
            }
            if (task.type === 'game') {
              const data = await authService.getGameResults(task.id);
              const ids = (data.scores || []).map(extractStudentId).filter(Boolean) as string[];
              return { key, set: new Set(ids) };
            }
            if (task.type === 'ai-bot') {
              const data = await authService.getBotTaskThreads(task.id);
              const ids = (data.threads || []).filter((r: any) => r?.completed).map((r: any) => String(r.studentId)).filter(Boolean) as string[];
              return { key, set: new Set(ids) };
            }
            if (task.type === 'contest') {
              const data = await authService.getContestResults(task.id);
              const ids = (data.attempts || []).map(extractStudentId).filter(Boolean) as string[];
              return { key, set: new Set(ids) };
            }
            const data = await authService.getAssignmentResponses(task.id);
            const ids = (data.responses || []).map(extractStudentId).filter(Boolean) as string[];
            return { key, set: new Set(ids) };
          } catch (err) {
            console.error('載入完成狀態失敗:', task?.type, task?.id, err);
            return { key, set: new Set<string>() };
          }
        }
      );

      const completionMap = new Map<string, Set<string>>();
      completionEntries.forEach((e) => completionMap.set(e.key, e.set));

      const normalizedSearch = progressSearch.trim().toLowerCase();
      const filteredStudents = students.filter((s: any) => {
        const classOk = !progressFilterClass || (s?.profile?.class || '') === progressFilterClass;
        if (!classOk) return false;
        if (!normalizedSearch) return true;
        const name = String(s?.profile?.name || '').toLowerCase();
        const username = String(s?.username || '').toLowerCase();
        return name.includes(normalizedSearch) || username.includes(normalizedSearch);
      });

      const rows = filteredStudents.map((student: any) => {
        let received = 0;
        let completed = 0;
        for (const task of countedTasks) {
          if (!isStudentTargeted(student, task)) continue;
          received += 1;
          const key = makeTaskKey(task.type, task.id);
          if (completionMap.get(key)?.has(student.id)) completed += 1;
        }
        const pending = Math.max(0, received - completed);
        return {
          id: student.id,
          name: student?.profile?.name || '學生',
          username: student?.username || '',
          className: student?.profile?.class || '',
          points: pointsById.get(String(student.id)) || 0,
          received,
          completed,
          pending
        };
      }).sort((a, b) => b.pending - a.pending || a.className.localeCompare(b.className) || a.name.localeCompare(b.name));

      setProgressRows(rows);
    } catch (error) {
      console.error('載入學生進度失敗:', error);
      const message = error instanceof Error ? error.message : '載入失敗';
      setProgressError(
        message.includes('權限不足')
          ? '權限不足：後端需要更新以支援教師讀取學生名單（/api/users/students）。'
          : message
      );
      setProgressRows([]);
    } finally {
      setProgressLoading(false);
    }
  };

  const progressSummary = useMemo(() => {
    const students = progressRows.length;
    const received = progressRows.reduce((acc, r) => acc + r.received, 0);
    const completed = progressRows.reduce((acc, r) => acc + r.completed, 0);
    const pending = progressRows.reduce((acc, r) => acc + r.pending, 0);
    return { students, received, completed, pending };
  }, [progressRows]);

	  // 開啟小遊戲建立入口（確保每次從選單開始）
	  const openGameCreator = () => {
	    setGameType(null);
	    setShowGameModal(true);
	  };

	  const openMathQuizCreator = () => {
	    setGameType('math');
	    setMathGameTab('manual');
	    setMathAiError('');
	    setMathPromptText('');
	    setMathAnswerMode('input');
	    setMathQuestionType('calc');
	    setMathGrade('小一');
	    setMathOps({ add: true, sub: true, mul: true, div: true, paren: true });
	    setMathNumberMode('fraction');
	    setMathAllowNegative(false);
	    setMathMinValueText('0');
	    setMathMaxValueText('50');
	    setMathMaxDenText('20');
	    setMathMaxDecimalPlacesText('2');
	    setMathEquationSteps(1);
	    setMathEquationAnswerType('int');
	    setMathQuestionCount(10);
	    setMathTimeEnabled(false);
	    setMathTimeSeconds(60);
	    setMathTimeSecondsText('60');
	    setMathForm({ title: '', description: '', targetClasses: [], targetGroups: [] });
	    setMathDrafts(Array.from({ length: 10 }, () => ({ kind: 'expr', tokens: [] })));
	    setShowGameModal(true);
	  };

		  const openRangerTdCreator = () => {
		    setGameType('ranger-td');
		    setRangerForm({ title: '', description: '', targetClasses: [], targetGroups: [] });
		    setRangerGrade('小一');
		    setRangerSubject(DEFAULT_SUBJECT);
		    setRangerAnswerMode('mcq');
		    setRangerMcqQuestions([]);
		    setRangerStageQuestionCount(10);
		    setRangerEquationPercentText('30');
		    setRangerDecimalPercentText('50');
		    setRangerOps({ add: true, sub: true, mul: true, div: true, paren: true });
		    setRangerRunSeconds(300);
	    setRangerRunSecondsText('300');
	    setRangerAllowNegative(false);
	    setRangerMinValueText('0');
	    setRangerMaxValueText('50');
	    setRangerMaxDenText('20');
	    setRangerMaxDecimalPlacesText('2');
	    setRangerEquationSteps(2);
	    setRangerEquationAnswerType('int');
	    setRangerWrongTowerDamageText('2');
	    setRangerTowerHpText('20');
	    setRangerPromptText('');
	    setShowGameModal(true);
	  };

  // 監聽篩選條件變化
	  useEffect(() => {
	    if (showAssignmentModal) {
	      loadAssignments();
    }
  }, [filterSubject, filterClass, filterGroup, showAssignmentModal]);

  const resetDiscussionEditor = () => {
    setDiscussionDraftId('');
    setDiscussionDraftMeta(null);
    setDiscussionDraftReadOnly(false);
    setDiscussionForm({
      title: '',
      subject: DEFAULT_SUBJECT,
      targetClasses: [],
      targetGroups: [],
      content: ''
    });
    applyDiscussionHtmlToEditor('');
  };

  const loadDiscussionDraft = async (draftId: string) => {
    const id = String(draftId || '').trim();
    if (!id) return;
    try {
      const resp = await authService.getDraft(id);
      const d = resp?.draft;
      if (!d) throw new Error('找不到草稿');
      setDiscussionDraftMeta(d);
      setDiscussionDraftId(String(d.id || id));
      const isOwner = String(d.ownerTeacherId || '') === String(user?.id || '');
      const isShared = String(d.scope || 'my') === 'shared';
      setDiscussionDraftReadOnly(isShared && !isOwner);
      const html = Array.isArray(d.contentSnapshot?.content) && d.contentSnapshot.content[0]?.type === 'html' ? String(d.contentSnapshot.content[0].value || '') : '';
      setDiscussionForm((prev) => ({
        ...prev,
        title: String(d.title || ''),
        subject: String(d.subject || DEFAULT_SUBJECT) as any,
        content: html,
        targetClasses: [],
        targetGroups: []
      }));
      applyDiscussionHtmlToEditor(html);
    } catch (e: any) {
      alert(e?.message || '載入草稿失敗');
      resetDiscussionEditor();
      setShowDiscussionModal(false);
    }
  };

  const resetQuizEditor = () => {
    setQuizDraftId('');
    setQuizDraftMeta(null);
    setQuizDraftReadOnly(false);
    setQuizForm({
      title: '',
      description: '',
      subject: DEFAULT_SUBJECT,
      targetClasses: [],
      targetGroups: [],
      questions: [],
      timeLimit: 0
    });
    setQuizClassFolderId('');
    setImageUploading(false);
  };

  const loadQuizDraft = async (draftId: string) => {
    const id = String(draftId || '').trim();
    if (!id) return;
    try {
      const resp = await authService.getDraft(id);
      const d = resp?.draft;
      if (!d) throw new Error('找不到草稿');
      if (String(d.toolType || '') !== 'quiz') throw new Error('草稿類型不正確');
      setQuizDraftMeta(d);
      setQuizDraftId(String(d.id || id));
      const isOwner = String(d.ownerTeacherId || '') === String(user?.id || '');
      const isShared = String(d.scope || 'my') === 'shared';
      setQuizDraftReadOnly(isShared && !isOwner);
      const snap = d.contentSnapshot?.quiz;
      setQuizForm({
        title: String(d.title || ''),
        description: String(snap?.description || ''),
        subject: String(d.subject || DEFAULT_SUBJECT) as any,
        targetClasses: [],
        targetGroups: [],
        questions: Array.isArray(snap?.questions) ? snap.questions : [],
        timeLimit: Number(snap?.timeLimit) || 0
      });
      setQuizClassFolderId('');
    } catch (e: any) {
      alert(e?.message || '載入草稿失敗');
      resetQuizEditor();
      setShowQuizModal(false);
    }
  };

  const resetContestEditor = () => {
    setContestDraftId('');
    setContestDraftMeta(null);
    setContestDraftReadOnly(false);
    setContestForm({
      title: '',
      topic: '',
      scopeText: '',
      advancedOnly: false,
      subject: DEFAULT_SUBJECT,
      grade: '小一',
      questionCount: 10,
      timeLimitSeconds: null,
      targetClasses: [],
      targetGroups: []
    });
    setContestClassFolderId('');
  };

  const loadContestDraft = async (draftId: string) => {
    const id = String(draftId || '').trim();
    if (!id) return;
    try {
      const resp = await authService.getDraft(id);
      const d = resp?.draft;
      if (!d) throw new Error('找不到草稿');
      if (String(d.toolType || '') !== 'contest') throw new Error('草稿類型不正確');
      setContestDraftMeta(d);
      setContestDraftId(String(d.id || id));
      const isOwner = String(d.ownerTeacherId || '') === String(user?.id || '');
      const isShared = String(d.scope || 'my') === 'shared';
      setContestDraftReadOnly(isShared && !isOwner);
      const snap = d.contentSnapshot?.contest;
      setContestForm({
        title: String(d.title || ''),
        topic: String(snap?.topic || ''),
        scopeText: String(snap?.scopeText || ''),
        advancedOnly: !!snap?.advancedOnly,
        subject: String(d.subject || DEFAULT_SUBJECT) as any,
        grade: String(snap?.grade || '小一'),
        questionCount: Number(snap?.questionCount) || 10,
        timeLimitSeconds: snap?.timeLimitSeconds ?? null,
        targetClasses: [],
        targetGroups: []
      });
      setContestClassFolderId('');
    } catch (e: any) {
      alert(e?.message || '載入草稿失敗');
      resetContestEditor();
      setShowContestModal(false);
    }
  };

  const initNewNoteDraftEditor = () => {
    setNoteDraftId('');
    setNoteDraftMeta(null);
    setNoteDraftReadOnly(false);
    setNoteDraftSnapshot(null);
    setNoteDraftForm({ title: '筆記', subject: String(DEFAULT_SUBJECT) });
  };

  const resetNoteDraftEditor = () => {
    initNewNoteDraftEditor();
    setNoteWizardOpen(false);
    setNoteWizardMode('save');
    setShowNoteDraftModal(false);
  };

  const loadNoteDraft = async (draftId: string) => {
    const id = String(draftId || '').trim();
    if (!id) return;
    try {
      const resp = await authService.getDraft(id);
      const d = resp?.draft;
      if (!d) throw new Error('找不到草稿');
      if (String(d.toolType || '') !== 'note') throw new Error('草稿類型不正確');
      setNoteDraftMeta(d);
      setNoteDraftId(String(d.id || id));
      const isOwner = String(d.ownerTeacherId || '') === String(user?.id || '');
      const isShared = String(d.scope || 'my') === 'shared';
      setNoteDraftReadOnly(isShared && !isOwner);
      setNoteDraftForm({ title: String(d.title || '筆記'), subject: String(d.subject || DEFAULT_SUBJECT) });
      const templateSnapshot = d.contentSnapshot?.note?.templateSnapshot;
      setNoteDraftSnapshot(templateSnapshot || null);
    } catch (e: any) {
      alert(e?.message || '載入草稿失敗');
      resetNoteDraftEditor();
    }
  };

  const cancelNoteDraftEditor = async () => {
    const isOwner = String(noteDraftMeta?.ownerTeacherId || user?.id || '') === String(user?.id || '');
    const canDelete = !!noteDraftId && isOwner && !noteDraftReadOnly;
    if (canDelete) {
      const ok = window.confirm('取消＝刪除草稿。確定要刪除嗎？');
      if (!ok) return;
      try {
        await authService.deleteDraft(noteDraftId);
        alert('草稿已刪除');
      } catch (e: any) {
        alert(e?.message || '刪除失敗');
        return;
      }
    }
    resetNoteDraftEditor();
  };

  const resetGameEditor = () => {
    setGameDraftId('');
    setGameDraftMeta(null);
    setGameDraftReadOnly(false);
    setGameWizardOpen(false);
    setGameWizardMode('save');
    setGameType(null);
    setShowGameModal(false);
    setGameForm({
      title: '',
      description: '',
      subject: DEFAULT_SUBJECT,
      targetClasses: [],
      targetGroups: [],
      questions: [],
      difficulty: 'medium'
    });
    setTowerDefenseQuestions([]);
    setTowerDefenseTimeSeconds(60);
    setTowerDefenseTimeSecondsText('60');
    setTowerDefenseLivesEnabled(true);
    setTowerDefenseLivesLimit(10);
    setGameClassFolderId('');
    setRangerForm({ title: '', description: '', targetClasses: [], targetGroups: [] });
    setRangerClassFolderId('');
    setMathClassFolderId('');
  };

  const loadGameDraft = async (draftId: string) => {
    const id = String(draftId || '').trim();
    if (!id) return;
    try {
      const resp = await authService.getDraft(id);
      const d = resp?.draft;
      if (!d) throw new Error('找不到草稿');
      if (String(d.toolType || '') !== 'game') throw new Error('草稿類型不正確');
      setGameDraftMeta(d);
      setGameDraftId(String(d.id || id));
      const isOwner = String(d.ownerTeacherId || '') === String(user?.id || '');
      const isShared = String(d.scope || 'my') === 'shared';
      setGameDraftReadOnly(isShared && !isOwner);

      const snap = d.contentSnapshot?.game;
      const payload = snap && typeof snap === 'object' ? snap : null;
      if (!payload) throw new Error('草稿內容不足');
      const gt = String(payload.gameType || '').trim() as any;
      if (!gt) throw new Error('草稿缺少 gameType');

      const editorState = payload.editorState && typeof payload.editorState === 'object' ? payload.editorState : {};

      setShowGameModal(true);
      setGameType(gt);

      if (gt === 'maze' || gt === 'matching') {
        const gf = editorState.gameForm && typeof editorState.gameForm === 'object' ? editorState.gameForm : payload;
        setGameForm({
          title: String(d.title || ''),
          description: String(gf.description || ''),
          subject: String(d.subject || DEFAULT_SUBJECT) as any,
          targetClasses: [],
          targetGroups: [],
          questions: Array.isArray(gf.questions) ? gf.questions : [],
          difficulty: (gf.difficulty === 'easy' || gf.difficulty === 'hard' ? gf.difficulty : 'medium')
        });
        setGameClassFolderId('');
      } else if (gt === 'tower-defense') {
        const gf = editorState.gameForm && typeof editorState.gameForm === 'object' ? editorState.gameForm : payload;
        setGameForm({
          title: String(d.title || ''),
          description: String(gf.description || ''),
          subject: String(d.subject || DEFAULT_SUBJECT) as any,
          targetClasses: [],
          targetGroups: [],
          questions: [],
          difficulty: (gf.difficulty === 'easy' || gf.difficulty === 'hard' ? gf.difficulty : 'medium')
        });
        setTowerDefenseQuestions(Array.isArray(editorState.towerDefenseQuestions) ? editorState.towerDefenseQuestions : []);
        if (editorState.towerDefenseTimeSecondsText !== undefined) setTowerDefenseTimeSecondsText(String(editorState.towerDefenseTimeSecondsText));
        if (editorState.towerDefenseTimeSeconds !== undefined) setTowerDefenseTimeSeconds(Number(editorState.towerDefenseTimeSeconds) || 60);
        setTowerDefenseLivesEnabled(editorState.towerDefenseLivesEnabled !== false);
        setTowerDefenseLivesLimit(Number(editorState.towerDefenseLivesLimit) || 10);
        setGameClassFolderId('');
      } else if (gt === 'ranger-td') {
        const rf = editorState.rangerForm && typeof editorState.rangerForm === 'object' ? editorState.rangerForm : {};
        setRangerForm({
          title: String(d.title || rf.title || ''),
          description: String(rf.description || ''),
          targetClasses: [],
          targetGroups: []
        });
        setRangerAnswerMode(editorState.rangerAnswerMode === 'input' ? 'input' : 'mcq');
        setRangerGrade((['小一', '小二', '小三', '小四', '小五', '小六'] as const).includes(editorState.rangerGrade) ? editorState.rangerGrade : '小一');
        setRangerSubject((String(d.subject || DEFAULT_SUBJECT) as any) || DEFAULT_SUBJECT);
        setRangerStageQuestionCount(Number(editorState.rangerStageQuestionCount) || 10);
        setRangerEquationPercentText(String(editorState.rangerEquationPercentText || '30'));
        setRangerDecimalPercentText(String(editorState.rangerDecimalPercentText || '50'));
        if (editorState.rangerOps && typeof editorState.rangerOps === 'object') setRangerOps(editorState.rangerOps);
        setRangerRunSeconds(Number(editorState.rangerRunSeconds) || 300);
        setRangerRunSecondsText(String(editorState.rangerRunSecondsText || '300'));
        setRangerAllowNegative(!!editorState.rangerAllowNegative);
        setRangerMinValueText(String(editorState.rangerMinValueText || '0'));
        setRangerMaxValueText(String(editorState.rangerMaxValueText || '50'));
        setRangerMaxDenText(String(editorState.rangerMaxDenText || '20'));
        setRangerMaxDecimalPlacesText(String(editorState.rangerMaxDecimalPlacesText || '2'));
        setRangerEquationSteps(editorState.rangerEquationSteps === 1 ? 1 : 2);
        setRangerEquationAnswerType(editorState.rangerEquationAnswerType || 'int');
        setRangerMcqQuestions(Array.isArray(editorState.rangerMcqQuestions) ? editorState.rangerMcqQuestions : []);
        setRangerWrongTowerDamageText(String(editorState.rangerWrongTowerDamageText || '2'));
        setRangerTowerHpText(String(editorState.rangerTowerHpText || '20'));
        setRangerPromptText(String(editorState.rangerPromptText || ''));
        setRangerClassFolderId('');
      } else if (gt === 'math') {
        const mf = editorState.mathForm && typeof editorState.mathForm === 'object' ? editorState.mathForm : {};
        setMathForm({
          title: String(d.title || mf.title || ''),
          description: String(mf.description || ''),
          targetClasses: [],
          targetGroups: []
        });
        setMathGameTab(editorState.mathGameTab === 'ai' ? 'ai' : 'manual');
        setMathAnswerMode(editorState.mathAnswerMode === 'mcq' ? 'mcq' : 'input');
        setMathQuestionType(editorState.mathQuestionType === 'equation' ? 'equation' : 'calc');
        setMathGrade((['小一', '小二', '小三', '小四', '小五', '小六'] as const).includes(editorState.mathGrade) ? editorState.mathGrade : '小一');
        if (editorState.mathOps && typeof editorState.mathOps === 'object') setMathOps(editorState.mathOps);
        setMathNumberMode(editorState.mathNumberMode === 'decimal' ? 'decimal' : 'fraction');
        setMathAllowNegative(!!editorState.mathAllowNegative);
        setMathMinValueText(String(editorState.mathMinValueText || '0'));
        setMathMaxValueText(String(editorState.mathMaxValueText || '50'));
        setMathMaxDenText(String(editorState.mathMaxDenText || '20'));
        setMathMaxDecimalPlacesText(String(editorState.mathMaxDecimalPlacesText || '2'));
        setMathEquationSteps(editorState.mathEquationSteps === 2 ? 2 : 1);
        setMathEquationAnswerType(editorState.mathEquationAnswerType || 'int');
        setMathQuestionCount(Number(editorState.mathQuestionCount) || 10);
        setMathTimeEnabled(!!editorState.mathTimeEnabled);
        setMathTimeSeconds(Number(editorState.mathTimeSeconds) || 60);
        setMathTimeSecondsText(String(editorState.mathTimeSecondsText || '60'));
        setMathDrafts(Array.isArray(editorState.mathDrafts) ? editorState.mathDrafts : []);
        setMathClassFolderId('');
      }
    } catch (e: any) {
      alert(e?.message || '載入草稿失敗');
      resetGameEditor();
    }
  };

  const getCurrentGameTitle = () => {
    if (gameType === 'ranger-td') return String(rangerForm.title || '').trim();
    if (gameType === 'math') return String(mathForm.title || '').trim();
    return String(gameForm.title || '').trim();
  };

  const getCurrentGameSubject = () => {
    if (gameType === 'ranger-td') return rangerAnswerMode === 'mcq' ? String(rangerSubject || DEFAULT_SUBJECT) : String(DEFAULT_SUBJECT);
    if (gameType === 'math') return String(DEFAULT_SUBJECT);
    return String(gameForm.subject || DEFAULT_SUBJECT);
  };

  const getCurrentGameDescription = () => {
    if (gameType === 'ranger-td') return String(rangerForm.description || '');
    if (gameType === 'math') return String(mathForm.description || '');
    return String(gameForm.description || '');
  };

  const cancelGameDraftEditor = async () => {
    const isOwner = String(gameDraftMeta?.ownerTeacherId || user?.id || '') === String(user?.id || '');
    const canDelete = !!gameDraftId && isOwner && !gameDraftReadOnly;
    if (canDelete) {
      const ok = window.confirm('取消＝刪除草稿。確定要刪除嗎？');
      if (!ok) return;
      try {
        await authService.deleteDraft(gameDraftId);
        alert('草稿已刪除');
      } catch (e: any) {
        alert(e?.message || '刪除失敗');
        return;
      }
    }
    resetGameEditor();
  };

  // 監聽討論串模態框開啟
  useEffect(() => {
    if (showDiscussionModal) {
      if (discussionDraftId) {
        void loadDiscussionDraft(discussionDraftId);
      } else {
        resetDiscussionEditor();
      }
    }
  }, [showDiscussionModal]);

  // 監聽小測驗模態框開啟
  useEffect(() => {
    if (showQuizModal) {
      if (quizDraftId) {
        void loadQuizDraft(quizDraftId);
      } else {
        resetQuizEditor();
      }
    }
  }, [showQuizModal]);

  // 監聽筆記草稿模態框開啟
  useEffect(() => {
    if (!showNoteDraftModal) return;
    if (noteDraftId) {
      void loadNoteDraft(noteDraftId);
      return;
    }
    initNewNoteDraftEditor();
  }, [showNoteDraftModal, noteDraftId]);

  // 監聽遊戲模態框開啟
  useEffect(() => {
    if (showGameModal) {
      if (gameDraftId && String(gameDraftMeta?.id || '') !== String(gameDraftId || '')) {
        void loadGameDraft(gameDraftId);
      }
      if (gameType === 'math') loadClassesAndGroups(DEFAULT_SUBJECT);
      else if (gameType === 'ranger-td') loadClassesAndGroups(DEFAULT_SUBJECT);
      else loadClassesAndGroups(gameForm.subject);
      setGameClassFolderId('');
      setRangerClassFolderId('');
      setMathClassFolderId('');
    }
  }, [showGameModal, gameType, rangerAnswerMode, rangerSubject, gameDraftId]);

  // 監聽問答比賽模態框開啟
  useEffect(() => {
    if (showContestModal) {
      if (contestDraftId) {
        void loadContestDraft(contestDraftId);
      } else {
        resetContestEditor();
      }
    }
  }, [showContestModal]);

  useEffect(() => {
    setMathTimeSecondsText(String(mathTimeSeconds));
  }, [mathTimeSeconds]);

  useEffect(() => {
    setRangerRunSecondsText(String(rangerRunSeconds));
  }, [rangerRunSeconds]);

  const rangerAllowedOps = useMemo(() => {
    const ops: MathOp[] = [];
    if (rangerOps.add) ops.push('add');
    if (rangerOps.sub) ops.push('sub');
    if (rangerOps.mul) ops.push('mul');
    if (rangerOps.div) ops.push('div');
    return ops;
  }, [rangerOps]);

  const rangerConstraints = useMemo(() => {
    const parseIntOr = (s: string, fallback: number) => {
      const n = Number.parseInt(String(s || '').trim(), 10);
      return Number.isFinite(n) ? n : fallback;
    };
    const maxValue = Math.max(1, Math.min(999, parseIntOr(rangerMaxValueText, 50)));
    let minValue = Math.max(-999, Math.min(999, parseIntOr(rangerMinValueText, 0)));
    if (!rangerAllowNegative) minValue = Math.max(0, minValue);
    if (minValue > maxValue) minValue = maxValue;
    const maxDen = Math.max(2, Math.min(999, parseIntOr(rangerMaxDenText, 20)));
    const maxDecimalPlaces = Math.max(0, Math.min(6, parseIntOr(rangerMaxDecimalPlacesText, 2)));
    const equationSteps = rangerEquationSteps === 2 ? 2 : 1;
    const equationAnswerType = rangerEquationAnswerType;
    return { allowNegative: rangerAllowNegative, minValue, maxValue, maxDen, maxDecimalPlaces, equationSteps, equationAnswerType };
  }, [
    rangerAllowNegative,
    rangerMinValueText,
    rangerMaxValueText,
    rangerMaxDenText,
    rangerMaxDecimalPlacesText,
    rangerEquationSteps,
    rangerEquationAnswerType
  ]);

  const mathAllowedOps = useMemo(() => {
    const ops: MathOp[] = [];
    if (mathOps.add) ops.push('add');
    if (mathOps.sub) ops.push('sub');
    if (mathOps.mul) ops.push('mul');
    if (mathOps.div) ops.push('div');
    return ops;
  }, [mathOps]);

  const mathConstraints: MathConstraints = useMemo(() => {
    const parseIntOr = (s: string, fallback: number) => {
      const n = Number.parseInt(String(s || '').trim(), 10);
      return Number.isFinite(n) ? n : fallback;
    };
    const maxValue = Math.max(1, Math.min(999, parseIntOr(mathMaxValueText, 50)));
    let minValue = Math.max(-999, Math.min(999, parseIntOr(mathMinValueText, 0)));
    if (!mathAllowNegative) minValue = Math.max(0, minValue);
    if (minValue > maxValue) minValue = maxValue;
    const maxDen = Math.max(2, Math.min(999, parseIntOr(mathMaxDenText, 20)));
    const maxDecimalPlaces = Math.max(0, Math.min(6, parseIntOr(mathMaxDecimalPlacesText, 2)));
    return {
      numberMode: mathNumberMode,
      allowNegative: mathAllowNegative,
      minValue,
      maxValue,
      maxDen,
      maxDecimalPlaces,
      equationSteps: mathEquationSteps,
      equationAnswerType: mathEquationAnswerType
    };
  }, [
    mathAllowNegative,
    mathMinValueText,
    mathMaxValueText,
    mathMaxDenText,
    mathMaxDecimalPlacesText,
    mathEquationSteps,
    mathEquationAnswerType,
    mathNumberMode
  ]);

  const mathDraftChecks = useMemo(() => {
    return mathDrafts.map((d, idx) => {
      const errors: string[] = [];

      if (d.kind === 'expr') {
        const tokens = Array.isArray(d.tokens) ? d.tokens : [];
        const v = validateTokens(tokens, mathAllowedOps, mathOps.paren);
        if (!v.ok) errors.push(v.error);
        const tokenErrs = validateTokensAgainstConstraints(tokens, mathConstraints, '數字');
        errors.push(...tokenErrs);
        if (v.ok) {
          try {
            const answer = evaluateTokens(tokens);
            errors.push(...validateRationalAgainstConstraints(answer, mathConstraints, '答案'));
          } catch {
            errors.push('算式無法計算');
          }
        }
      } else {
        try {
          const parsed = parseAndSolveSingleUnknownEquation(d.equation || '', { allowedOps: mathAllowedOps, allowParentheses: mathOps.paren });
          if ('error' in parsed) {
            errors.push(parsed.error);
          } else {
            errors.push(...validateTokensAgainstConstraints(parsed.value.leftTokens, mathConstraints, '數字'));
            errors.push(...validateTokensAgainstConstraints(parsed.value.rightTokens, mathConstraints, '數字'));
            errors.push(...validateRationalAgainstConstraints(parsed.value.answer, mathConstraints, '答案'));
            const varSideTokens = parsed.value.leftTokens.some((t: any) => t?.t === 'var') ? parsed.value.leftTokens : parsed.value.rightTokens;
            const stepErr = validateEquationSteps(varSideTokens as any, mathConstraints);
            if (stepErr) errors.push(stepErr);
            const at = validateEquationAnswerType(parsed.value.answer, mathConstraints);
            if (at) errors.push(at);
          }
        } catch {
          errors.push('方程式格式不正確');
        }
      }

      return { index: idx, ok: errors.length === 0, errors };
    });
  }, [mathDrafts, mathConstraints, mathAllowedOps, mathOps.paren]);

  const invalidMathDraftIndexes = useMemo(
    () => mathDraftChecks.filter((c) => !c.ok).map((c) => c.index),
    [mathDraftChecks]
  );

  const regenerateInvalidMathDrafts = async () => {
    const invalid = invalidMathDraftIndexes;
    if (invalid.length === 0) return;
    try {
      setMathAiError('');
      setMathAiLoading(true);
      if (mathAllowedOps.length === 0) return;

      if (mathQuestionType === 'equation') {
        const resp = await authService.generateMathEquationQuestions({
          grade: mathGrade,
          count: invalid.length,
          allowedOps: mathAllowedOps,
          allowParentheses: mathOps.paren,
          numberMode: mathNumberMode,
          allowNegative: mathAllowNegative,
          minValue: mathConstraints.minValue,
          maxValue: mathConstraints.maxValue,
          maxDen: mathConstraints.maxDen,
          maxDecimalPlaces: mathConstraints.maxDecimalPlaces,
          equationSteps: mathConstraints.equationSteps,
          equationAnswerType: mathConstraints.equationAnswerType,
          promptText: mathPromptText
        });
        const qs = Array.isArray(resp?.questions) ? resp.questions : [];
        setMathDrafts((prev) => {
          const next = [...prev];
          invalid.forEach((idx, i) => {
            const q = qs[i];
            if (!q) return;
            next[idx] = { kind: 'eq', equation: String(q?.equation || '').trim() };
          });
          return next;
        });
      } else {
        const resp = await authService.generateMathQuestions({
          grade: mathGrade,
          count: invalid.length,
          allowedOps: mathAllowedOps,
          allowParentheses: mathOps.paren,
          answerMode: mathAnswerMode,
          numberMode: mathNumberMode,
          allowNegative: mathAllowNegative,
          minValue: mathConstraints.minValue,
          maxValue: mathConstraints.maxValue,
          maxDen: mathConstraints.maxDen,
          maxDecimalPlaces: mathConstraints.maxDecimalPlaces,
          promptText: mathPromptText
        });
        const qs = Array.isArray(resp?.questions) ? resp.questions : [];
        setMathDrafts((prev) => {
          const next = [...prev];
          invalid.forEach((idx, i) => {
            const q = qs[i];
            if (!q) return;
            next[idx] = { kind: 'expr', tokens: Array.isArray(q.tokens) ? q.tokens : [] };
          });
          return next;
        });
      }
    } catch (e: any) {
      setMathAiError(e?.message || 'AI 生成失敗');
    } finally {
      setMathAiLoading(false);
    }
  };

  useEffect(() => {
    setMathDrafts((prev) => {
      const next = [...(prev || [])];
      if (mathQuestionCount > next.length) {
        const addCount = mathQuestionCount - next.length;
        for (let i = 0; i < addCount; i++) {
          next.push(mathQuestionType === 'equation' ? { kind: 'eq', equation: '' } : { kind: 'expr', tokens: [] });
        }
      } else if (mathQuestionCount < next.length) {
        next.length = Math.max(0, mathQuestionCount);
      }
      return next;
    });
  }, [mathQuestionCount, mathQuestionType]);

  // === 小測驗功能 ===

  // 新增問題
  const addQuestion = () => {
    setQuizForm(prev => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          question: '',
          options: ['', '', '', ''],
          correctAnswer: 0
        }
      ]
    }));
  };

  // 刪除問題
  const removeQuestion = (index: number) => {
    setQuizForm(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }));
  };

  // 更新問題內容
  const updateQuestion = (index: number, field: string, value: any) => {
    setQuizForm(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) =>
        i === index ? { ...q, [field]: value } : q
      )
    }));
  };

  // 更新選項內容
  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    setQuizForm(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) =>
        i === questionIndex
          ? { ...q, options: q.options.map((opt, j) => j === optionIndex ? value : opt) }
          : q
      )
    }));
  };

  // === 答題塔防題庫（四選一 + 配對（單組）） ===
  const addTowerDefenseMcqQuestion = () => {
    setTowerDefenseQuestions((prev) => [
      ...prev,
      { type: 'mcq', prompt: '', options: ['', '', '', ''], correctIndex: 0 }
    ]);
  };

  const addTowerDefenseMatchQuestion = () => {
    setTowerDefenseQuestions((prev) => [
      ...prev,
      { type: 'match', left: '', options: ['', '', '', ''], correctIndex: 0 }
    ]);
  };

  const removeTowerDefenseQuestion = (index: number) => {
    setTowerDefenseQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTowerDefenseCorrectIndex = (index: number, value: number) => {
    setTowerDefenseQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, correctIndex: value } : q)));
  };

  const updateTowerDefensePrompt = (index: number, value: string) => {
    setTowerDefenseQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== index) return q;
        if (q.type !== 'mcq') return q;
        return { ...q, prompt: value };
      })
    );
  };

  const updateTowerDefenseLeft = (index: number, value: string) => {
    setTowerDefenseQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== index) return q;
        if (q.type !== 'match') return q;
        return { ...q, left: value };
      })
    );
  };

  const updateTowerDefenseOption = (questionIndex: number, optionIndex: number, value: string) => {
    setTowerDefenseQuestions((prev) =>
      prev.map((q, i) => (i === questionIndex ? { ...q, options: q.options.map((opt, j) => (j === optionIndex ? value : opt)) } : q))
    );
  };

  // === Ranger TD（MCQ 題庫） ===
  const addRangerMcqQuestion = () => {
    setRangerMcqQuestions((prev) => [
      ...prev,
      { type: 'mcq', prompt: '', options: ['', '', '', ''], correctIndex: 0 }
    ]);
  };

  const removeRangerMcqQuestion = (index: number) => {
    setRangerMcqQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRangerMcqCorrectIndex = (index: number, value: number) => {
    setRangerMcqQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, correctIndex: value } : q)));
  };

  const updateRangerMcqPrompt = (index: number, value: string) => {
    setRangerMcqQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== index) return q;
        if (q.type !== 'mcq') return q;
        return { ...q, prompt: value };
      })
    );
  };

  const updateRangerMcqOption = (questionIndex: number, optionIndex: number, value: string) => {
    setRangerMcqQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== questionIndex) return q;
        return { ...q, options: q.options.map((opt, j) => (j === optionIndex ? value : opt)) };
      })
    );
  };

  // 提交小測驗
  const handleSubmitQuiz = async () => {
    if (!quizForm.title) {
      alert('請填寫標題');
      return;
    }

    if (imageUploading) {
      alert('圖片正在上傳/處理中，請稍候...');
      return;
    }

    if (quizForm.targetClasses.length === 0) {
      alert('請選擇班級');
      return;
    }
    if (quizForm.targetClasses.length !== 1) {
      alert('請只選擇 1 個班級（資料夾屬於單一班別）');
      return;
    }
    if (GROUPS_ENABLED && quizForm.targetGroups.length > 0) {
      alert('使用資料夾分類時暫不支援分組派發，請取消分組');
      return;
    }
    if (!quizClassFolderId) {
      alert('請選擇資料夾（學段→課題→子folder可選）');
      return;
    }

    if (quizForm.questions.length === 0) {
      alert('請至少新增一個問題');
      return;
    }

    // 驗證所有問題都有內容
    for (const question of quizForm.questions) {
      if (!question.question.trim()) {
        alert('請填寫所有問題內容');
        return;
      }
      if (question.options.some(opt => !opt.trim())) {
        alert('請填寫所有選項內容');
        return;
      }
    }

    try {
      await authService.createQuiz({
        title: quizForm.title,
        description: quizForm.description,
        scopeText: quizForm.scopeText,
        subject: quizForm.subject,
        targetClasses: quizForm.targetClasses,
        targetGroups: GROUPS_ENABLED ? quizForm.targetGroups : [],
        questions: quizForm.questions,
        timeLimit: quizForm.timeLimit,
        classFolderId: quizClassFolderId
      });

      alert('小測驗創建成功！');
      setShowQuizModal(false);
      setQuizForm({
        title: '',
        description: '',
        scopeText: '',
        subject: DEFAULT_SUBJECT,
        targetClasses: [],
        targetGroups: [],
        questions: [],
        timeLimit: 0
      });
      setQuizClassFolderId('');

    } catch (error) {
      console.error('創建小測驗失敗:', error);
      alert('創建小測驗失敗：' + (error instanceof Error ? error.message : '未知錯誤'));
    }
  };

  // 提交問答比賽
  const handleSubmitContest = async () => {
    if (!contestForm.title) {
      alert('請填寫標題');
      return;
    }
    if (!contestForm.subject) {
      alert('請選擇科目');
      return;
    }
    if (!contestForm.grade) {
      alert('請選擇年級');
      return;
    }
    if (contestForm.targetClasses.length === 0) {
      alert('請選擇至少一個班級');
      return;
    }
    if (contestForm.targetClasses.length !== 1) {
      alert('請只選擇 1 個班級（資料夾屬於單一班別）');
      return;
    }
    if (GROUPS_ENABLED && contestForm.targetGroups.length > 0) {
      alert('使用資料夾分類時暫不支援分組派發，請取消分組');
      return;
    }
    if (!contestClassFolderId) {
      alert('請選擇資料夾（學段→課題→子folder可選）');
      return;
    }

    try {
      await authService.createContest({
        title: contestForm.title,
        topic: contestForm.topic,
        scopeText: contestForm.scopeText,
        advancedOnly: contestForm.advancedOnly,
        subject: contestForm.subject,
        grade: contestForm.grade,
        questionCount: contestForm.questionCount,
        timeLimitSeconds: contestForm.timeLimitSeconds,
        targetClasses: contestForm.targetClasses,
        targetGroups: GROUPS_ENABLED ? contestForm.targetGroups : [],
        classFolderId: contestClassFolderId
      });
      alert('問答比賽創建成功！');
      setShowContestModal(false);
      setContestForm({
        title: '',
        topic: '',
        scopeText: '',
        advancedOnly: false,
        subject: DEFAULT_SUBJECT,
        grade: '小一',
        questionCount: 10,
        timeLimitSeconds: null,
        targetClasses: [],
        targetGroups: []
      });
      setContestClassFolderId('');
    } catch (error) {
      console.error('創建問答比賽失敗:', error);
      alert('創建問答比賽失敗：' + (error instanceof Error ? error.message : '未知錯誤'));
    }
  };

  const handleSubmitDiscussion = async () => {
    if (!discussionForm.title) {
      alert('請填寫標題');
      return;
    }

    if (discussionForm.targetClasses.length === 0) {
      alert('請選擇班級');
      return;
    }
    if (discussionForm.targetClasses.length !== 1) {
      alert('請只選擇 1 個班級（資料夾屬於單一班別）');
      return;
    }
    if (GROUPS_ENABLED && discussionForm.targetGroups.length > 0) {
      alert('使用資料夾分類時暫不支援分組派發，請取消分組');
      return;
    }
    if (!discussionClassFolderId) {
      alert('請選擇資料夾（學段→課題→子folder可選）');
      return;
    }

    if (!discussionForm.content.trim()) {
      alert('請輸入討論串內容');
      return;
    }

    const safeContent = sanitizeHtml(discussionForm.content);
    if (!safeContent.trim()) {
      alert('討論串內容無有效文字或圖片');
      return;
    }

    // 將HTML內容轉換為內容區塊格式
    const contentBlocks: { type: 'html' | 'text' | 'image' | 'link'; value: string }[] = [{ type: 'html', value: safeContent }];

    try {
      await authService.createDiscussion({
        title: discussionForm.title,
        content: contentBlocks,
        subject: discussionForm.subject,
        targetClasses: discussionForm.targetClasses,
        targetGroups: GROUPS_ENABLED ? discussionForm.targetGroups : [],
        classFolderId: discussionClassFolderId
      });

      alert('討論串派發成功！');
      setShowDiscussionModal(false);
      setDiscussionForm({
        title: '',
        subject: DEFAULT_SUBJECT,
        targetClasses: [],
        targetGroups: [],
        content: ''
      });
      setDiscussionClassFolderId('');

    } catch (error) {
      console.error('派發討論串失敗:', error);
      alert('派發討論串失敗：' + (error instanceof Error ? error.message : '未知錯誤'));
    }
  };

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="min-h-full bg-gray-50 flex flex-col lg:flex-row overflow-x-hidden font-sans">
      {/* Background */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: `url('/teacherpagebg.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />

      {/* Mobile Top Bar */}
      <div className="sticky top-0 z-30 lg:hidden bg-[#D9F3D5]/95 backdrop-blur border-b-4 border-brand-brown">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="w-10 h-10 bg-white rounded-full border-2 border-brand-brown shadow-comic flex items-center justify-center"
            aria-label="開啟選單"
          >
            <Menu className="text-brand-brown w-5 h-5" />
          </button>
          <div className="flex-1 text-center">
            <div className="text-lg font-black text-brand-brown font-rounded leading-none">教師中心</div>
          </div>
          <div className="flex items-center gap-2">
	            <button
	              onClick={openSettings}
	              className="w-10 h-10 bg-white rounded-full border-2 border-brand-brown shadow-comic flex items-center justify-center"
	              title="設定"
	            >
              <Settings className="text-brand-brown w-5 h-5" />
            </button>
            <button
              onClick={() => setShowUiSettings(true)}
              className="w-10 h-10 bg-white rounded-full border-2 border-brand-brown shadow-comic flex items-center justify-center"
              title="介面顯示設定"
            >
              <SlidersHorizontal className="text-brand-brown w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-10 h-10 bg-white rounded-full border-2 border-brand-brown shadow-comic flex items-center justify-center"
              title="返回登入"
            >
              <User className="text-brand-brown w-5 h-5" />
            </button>
            <button
              onClick={logout}
              className="w-10 h-10 bg-white rounded-full border-2 border-brand-brown shadow-comic flex items-center justify-center"
              title="登出"
            >
              <LogOut className="text-brand-brown w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Header Icons */}
      <header className="hidden lg:flex fixed top-4 right-4 sm:right-6 z-20 gap-3 sm:gap-4">
	        <button
	          onClick={openSettings}
	          className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full border-2 border-brand-brown shadow-comic flex items-center justify-center hover:scale-105 transition-transform"
	          title="設定"
	        >
          <Settings className="text-brand-brown w-5 h-5 sm:w-6 sm:h-6" />
        </button>
        <button
          onClick={() => setShowUiSettings(true)}
          className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full border-2 border-brand-brown shadow-comic flex items-center justify-center hover:scale-105 transition-transform"
          title="介面顯示設定"
        >
          <SlidersHorizontal className="text-brand-brown w-5 h-5 sm:w-6 sm:h-6" />
        </button>
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full border-2 border-brand-brown shadow-comic flex items-center justify-center hover:scale-105 transition-transform"
        >
          <User className="text-brand-brown w-5 h-5 sm:w-6 sm:h-6" />
        </button>
        <button
          onClick={logout}
          className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full border-2 border-brand-brown shadow-comic flex items-center justify-center hover:scale-105 transition-transform"
          title="登出"
        >
          <LogOut className="text-brand-brown w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </header>

      <UiSettingsModal open={showUiSettings} onClose={() => setShowUiSettings(false)} />
      <AiChatModal
        open={showAiChat}
        onClose={() => setShowAiChat(false)}
      />
      <ChartGeneratorModal
        open={showChartGenerator}
        onClose={() => setShowChartGenerator(false)}
        mode="teacher"
      />
      <AppStudioModal
        open={showAppStudio}
        onClose={() => setShowAppStudio(false)}
      />

      <AiReportModal
        open={aiReportModalOpen}
        title={aiReportTitle || 'AI 報告'}
        loading={aiReportLoading}
        error={aiReportError}
        report={aiReportData}
        onClose={() => setAiReportModalOpen(false)}
        onRegenerate={aiReportRequest ? regenerateAiReport : undefined}
      />

      {/* Student Progress Modal */}
      {showStudentProgressModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-comic">
            <div className="p-6 border-b-4 border-brand-brown bg-[#E0D2F8]">
              <div className="flex justify-between items-center gap-4">
                <div>
                  <h2 className="text-3xl font-black text-brand-brown">學生進度</h2>
                  <div className="text-sm text-gray-700 font-bold mt-1">
                    學生 {progressSummary.students} • 收到 {progressSummary.received} • 完成 {progressSummary.completed} • 未完成 {progressSummary.pending}
                  </div>
                </div>
                <button
                  onClick={() => setShowStudentProgressModal(false)}
                  className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                  aria-label="關閉"
                >
                  <X className="w-6 h-6 text-brand-brown" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4 p-4 bg-gray-50 rounded-2xl border-2 border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                  <div>
                    <label className="block text-sm font-bold text-gray-600 mb-2">科目</label>
                    <select
                      value={progressFilterSubject}
                      onChange={(e) => setProgressFilterSubject(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl"
                    >
                      <option value="">全部科目</option>
                      {VISIBLE_SUBJECTS.map(subject => (
                        <option key={subject} value={subject}>{subject}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-600 mb-2">班級</label>
                    <select
                      value={progressFilterClass}
                      onChange={(e) => setProgressFilterClass(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl"
                    >
                      <option value="">全部班級</option>
                      {availableClasses.map(className => (
                        <option key={className} value={className}>{className}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-600 mb-2">分組</label>
                    <select
                      value={progressFilterGroup}
                      onChange={(e) => setProgressFilterGroup(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl"
                      disabled={!progressFilterSubject}
                    >
                      <option value="">全部分組</option>
                      {progressFilterSubject && (
                        // 如果是教師任教的科目，顯示已設定的分組；否則從後端載入
                        (user?.profile?.subjectGroups?.[progressFilterSubject] || []).length > 0
                          ? (user?.profile?.subjectGroups?.[progressFilterSubject] || []).map(group => (
                              <option key={group} value={group}>{group}</option>
                            ))
                          : groupOptionsBySubject[progressFilterSubject]?.map(group => (
                              <option key={group} value={group}>{group}</option>
                            )) || []
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-600 mb-2">搜尋</label>
                    <input
                      value={progressSearch}
                      onChange={(e) => setProgressSearch(e.target.value)}
                      placeholder="搜尋姓名或帳號..."
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                      <input
                        type="checkbox"
                        checked={progressIncludeHidden}
                        onChange={(e) => setProgressIncludeHidden(e.target.checked)}
                        className="w-4 h-4"
                      />
                      包含已隱藏（14天+）
                    </label>
                    <button
                      onClick={loadStudentProgress}
                      className="px-4 py-2 bg-blue-500 text-white rounded-xl font-bold border-2 border-blue-600 hover:bg-blue-600"
                      disabled={progressLoading}
                    >
                      {progressLoading ? '計算中...' : '重新計算'}
                    </button>
                  </div>
                </div>

                {progressError && (
                  <div className="mt-4 bg-red-100 border-4 border-red-500 rounded-2xl p-4 text-center">
                    <p className="text-red-700 font-bold">載入失敗：{progressError}</p>
                  </div>
                )}
              </div>

              {/* 獎勵積分加分（放在學生進度內） */}
              <div className="mb-6 p-4 bg-[#FFF3E0] rounded-2xl border-2 border-brand-brown">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-brand-brown" />
                    <div className="text-lg font-black text-brand-brown">獎勵積分加分</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPointsGrantError('');
                      setPointsGrantDescription('');
                    }}
                    className="px-3 py-2 bg-white text-brand-brown rounded-xl font-bold border-2 border-brand-brown hover:bg-gray-50"
                  >
                    清除說明
                  </button>
                </div>

                {pointsGrantError && (
                  <div className="mb-3 p-3 rounded-2xl border-2 border-red-200 bg-red-50 text-red-700 font-bold">
                    {pointsGrantError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                  <div>
                    <label className="block text-sm font-bold text-gray-600 mb-2">模式</label>
                    <select
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl bg-white font-bold"
                      value={pointsGrantMode}
                      onChange={(e) => setPointsGrantMode(e.target.value as any)}
                    >
                      <option value="student">單一學生</option>
                      <option value="class">整班</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-600 mb-2">班級</label>
                    <select
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl bg-white font-bold"
                      value={pointsGrantClass}
                      onChange={(e) => setPointsGrantClass(e.target.value)}
                    >
                      <option value="">請選擇班級</option>
                      {availableClasses.map((cls) => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-600 mb-2">學生</label>
                    <select
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl bg-white font-bold"
                      value={pointsGrantStudentId}
                      onChange={(e) => setPointsGrantStudentId(e.target.value)}
                      disabled={pointsGrantMode !== 'student'}
                    >
                      <option value="">請選擇學生</option>
                      {pointsGrantStudents
                        .filter((s: any) => !pointsGrantClass || String(s?.profile?.class || '') === pointsGrantClass)
                        .sort((a: any, b: any) => String(a?.profile?.name || a?.username || '').localeCompare(String(b?.profile?.name || b?.username || ''), 'zh-Hant'))
                        .map((s: any) => (
                          <option key={String(s.id)} value={String(s.id)}>
                            {String(s.profile?.name || s.username || '學生')}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-600 mb-2">加分數量</label>
                    <Input
                      type="number"
                      value={pointsGrantAmount}
                      onChange={(e) => setPointsGrantAmount(Number((e.target as any).value))}
                      className="w-full"
                    />
                  </div>

                  <div className="lg:col-span-5">
                    <label className="block text-sm font-bold text-gray-600 mb-2">說明（可選）</label>
                    <div className="flex flex-col md:flex-row gap-3">
                      <Input
                        value={pointsGrantDescription}
                        onChange={(e) => setPointsGrantDescription((e.target as any).value)}
                        placeholder="例如：課堂表現優秀"
                        className="flex-1"
                      />
                      <button
                        type="button"
                        className="px-5 py-2 bg-[#93C47D] text-brand-brown rounded-xl font-black border-2 border-brand-brown hover:bg-[#86b572] disabled:opacity-60"
                        disabled={pointsGrantLoading}
                        onClick={async () => {
                          try {
                            setPointsGrantLoading(true);
                            setPointsGrantError('');
                            const amount = Number(pointsGrantAmount);
                            if (!Number.isFinite(amount) || amount <= 0) {
                              setPointsGrantError('加分數量必須是正數');
                              return;
                            }

                            if (pointsGrantMode === 'student') {
                              if (!pointsGrantStudentId) {
                                setPointsGrantError('請先選擇學生');
                                return;
                              }
                              await authService.grantRewardsToStudent(pointsGrantStudentId, amount, pointsGrantDescription || undefined);
                            } else {
                              if (!pointsGrantClass) {
                                setPointsGrantError('請先選擇班級');
                                return;
                              }
                              const ids = pointsGrantStudents
                                .filter((s: any) => String(s?.profile?.class || '') === pointsGrantClass)
                                .map((s: any) => String(s.id));
                              if (ids.length === 0) {
                                setPointsGrantError('此班級沒有學生');
                                return;
                              }
                              await authService.batchGrantRewards(ids, amount, pointsGrantDescription || `全班加分 ${amount}`);
                            }

                            window.alert('加分成功');
                            await loadStudentProgress();
                          } catch (e: any) {
                            setPointsGrantError(e?.message || '加分失敗');
                          } finally {
                            setPointsGrantLoading(false);
                          }
                        }}
                      >
                        {pointsGrantLoading ? '處理中...' : '確認加分'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {progressLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-brown mx-auto mb-4"></div>
                  <p className="text-brand-brown font-bold">計算中...</p>
                </div>
              ) : progressRows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-4 border-brand-brown rounded-3xl overflow-hidden">
                    <thead className="bg-white">
                      <tr className="text-left">
                        <th className="p-4 border-b-4 border-brand-brown text-brand-brown font-black">學生</th>
                        <th className="p-4 border-b-4 border-brand-brown text-brand-brown font-black">班級</th>
                        <th className="p-4 border-b-4 border-brand-brown text-brand-brown font-black">點數</th>
                        <th className="p-4 border-b-4 border-brand-brown text-brand-brown font-black">獎牌</th>
                        <th className="p-4 border-b-4 border-brand-brown text-brand-brown font-black">收到</th>
                        <th className="p-4 border-b-4 border-brand-brown text-brand-brown font-black">完成</th>
                        <th className="p-4 border-b-4 border-brand-brown text-brand-brown font-black">未完成</th>
                        <th className="p-4 border-b-4 border-brand-brown text-brand-brown font-black">完成率</th>
                        <th className="p-4 border-b-4 border-brand-brown text-brand-brown font-black">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progressRows.map((row) => {
                        const pct = row.received > 0 ? Math.round((row.completed / row.received) * 100) : 0;
                        const medal = (() => {
                          const pts = Number(row.points) || 0;
                          if (pts >= 1000) return { label: '鑽石', icon: '💎' };
                          if (pts >= 500) return { label: '金', icon: '🥇' };
                          if (pts >= 200) return { label: '銀', icon: '🥈' };
                          if (pts >= 100) return { label: '銅', icon: '🥉' };
                          return null;
                        })();
                        return (
                          <tr key={row.id} className="bg-white odd:bg-[#FEF7EC]">
                            <td className="p-4 border-b-2 border-gray-200">
                              <div className="font-bold text-brand-brown">{row.name}</div>
                              <div className="text-sm text-gray-600">{row.username}</div>
                            </td>
                            <td className="p-4 border-b-2 border-gray-200 font-bold text-gray-700">{row.className || '-'}</td>
                            <td className="p-4 border-b-2 border-gray-200 font-black text-brand-brown">{row.points}</td>
                            <td className="p-4 border-b-2 border-gray-200 font-bold text-gray-700">
                              {medal ? (
                                <span className="inline-flex items-center gap-2">
                                  <span className="text-lg">{medal.icon}</span>
                                  <span>{medal.label}</span>
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="p-4 border-b-2 border-gray-200 font-bold text-gray-700">{row.received}</td>
                            <td className="p-4 border-b-2 border-gray-200 font-bold text-green-700">{row.completed}</td>
                            <td className="p-4 border-b-2 border-gray-200 font-bold text-red-600">{row.pending}</td>
                            <td className="p-4 border-b-2 border-gray-200">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-3 bg-gray-200 rounded-full border-2 border-brand-brown overflow-hidden">
                                  <div className="h-full bg-[#93C47D]" style={{ width: `${pct}%` }} />
                                </div>
                                <div className="w-12 text-right text-sm font-black text-brand-brown">{pct}%</div>
                              </div>
                            </td>
                            <td className="p-4 border-b-2 border-gray-200">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => {
                                    setPointsGrantMode('student');
                                    setPointsGrantClass(row.className || '');
                                    setPointsGrantStudentId(String(row.id));
                                    setPointsGrantError('');
                                  }}
                                  className="px-3 py-2 bg-[#93C47D] text-brand-brown rounded-lg hover:bg-[#86b572] text-sm font-black border-2 border-brand-brown"
                                >
                                  加分
                                </button>
                                {user?.role === 'admin' && (
                                  <button
                                    onClick={async () => {
                                      const raw = window.prompt(`設定 ${row.name} 的點數為（目前 ${row.points}）`, String(row.points));
                                      if (raw === null) return;
                                      const next = Number(raw);
                                      if (!Number.isFinite(next) || next < 0) {
                                        window.alert('點數必須是 0 或以上數字');
                                        return;
                                      }
                                      const desc = window.prompt('改分原因（可留空）', '管理員改分') || undefined;
                                      try {
                                        await authService.adjustStudentRewards(String(row.id), Math.floor(next), desc);
                                        await loadStudentProgress();
                                      } catch (e: any) {
                                        window.alert(e?.message || '改分失敗');
                                      }
                                    }}
                                    className="px-3 py-2 bg-white text-brand-brown rounded-lg hover:bg-gray-50 text-sm font-black border-2 border-brand-brown"
                                  >
                                    改分
                                  </button>
                                )}
                                <button
                                  onClick={() => viewStudentTasks(row)}
                                  className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-bold"
                                >
                                  查看詳情
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400 font-bold text-xl border-4 border-dashed border-gray-300 rounded-3xl">
                  沒有資料
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 學生任務詳情模態框 */}
      {showStudentTaskModal && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-comic">
            <div className="p-6 border-b-4 border-brand-brown bg-[#E0D2F8]">
              <div className="flex justify-between items-center gap-4">
                <div>
                  <h2 className="text-3xl font-black text-brand-brown">
                    {selectedStudent.name} 的任務詳情
                  </h2>
                  <div className="text-sm text-gray-700 font-bold mt-1">
                    {selectedStudent.className} • {selectedStudent.username}
                  </div>
                </div>
                <button
                  onClick={() => setShowStudentTaskModal(false)}
                  className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                  aria-label="關閉"
                >
                  <X className="w-6 h-6 text-brand-brown" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {studentTasksLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-brown mx-auto mb-4"></div>
                  <p className="text-brand-brown font-bold">載入中...</p>
                </div>
              ) : studentTasks.length > 0 ? (
                <div className="space-y-4">
                  {studentTasks.map((task) => {
                    const isQuiz = task.type === 'quiz';
                    const isGame = task.type === 'game';
                    const isBot = task.type === 'ai-bot';
                    const isContest = task.type === 'contest';

                    return (
                      <div key={`${task.type}-${task.id}`} className={`border-2 rounded-2xl p-4 ${task.completed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            {isGame ? (
                              <span className="text-2xl">🎮</span>
                            ) : isQuiz ? (
                              <span className="text-2xl">🧠</span>
                            ) : isBot ? (
                              <span className="text-2xl">🤖</span>
                            ) : isContest ? (
                              <span className="text-2xl">🏁</span>
                            ) : (
                              <span className="text-2xl">📚</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="text-lg font-bold text-brand-brown">{task.title}</h4>
                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                task.completed ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                              }`}>
                                {task.completed ? '已完成' : '未完成'}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 mb-2">
                              <span className="font-medium">科目：</span>{task.subject} •
                              <span className="font-medium ml-2">類型：</span>
                              {isQuiz ? '小測驗' : isGame ? '遊戲' : isBot ? 'AI小助手任務' : isContest ? '問答比賽' : '討論串'}
                            </div>
                            {task.description && (
                              <div className="text-sm text-gray-600 mb-2">
                                <span className="font-medium">描述：</span>{task.description}
                              </div>
                            )}

                            {/* 完成詳情 */}
                            {task.completed && task.completionDetails && (
                              <div className="mt-3 p-3 bg-white rounded-lg border border-green-300">
                                <div className="text-sm font-bold text-green-800 mb-2">完成詳情</div>
                                <div className="text-sm space-y-1">
                                  {isQuiz && (
                                    <>
                                      <div><span className="font-medium">分數：</span>{task.completionDetails.score}/{task.completionDetails.totalQuestions}</div>
                                      <div><span className="font-medium">完成時間：</span>{new Date(task.completionDetails.completedAt).toLocaleString()}</div>
                                    </>
                                  )}
                                  {isGame && (
                                    <>
                                      <div><span className="font-medium">最佳分數：</span>{task.completionDetails.bestScore}</div>
                                      <div><span className="font-medium">遊玩次數：</span>{task.completionDetails.attempts}</div>
                                      {task.completionDetails.lastPlayedAt && (
                                        <div><span className="font-medium">最後遊玩：</span>{new Date(task.completionDetails.lastPlayedAt).toLocaleString()}</div>
                                      )}
                                    </>
                                  )}
                                  {isBot && (
                                    <>
                                      <div><span className="font-medium">對話訊息數：</span>{task.completionDetails.messageCount}</div>
                                      {task.completionDetails.lastMessageAt && (
                                        <div><span className="font-medium">最後互動：</span>{new Date(task.completionDetails.lastMessageAt).toLocaleString()}</div>
                                      )}
                                    </>
                                  )}
                                  {isContest && (
                                    <>
                                      <div><span className="font-medium">最佳分數：</span>{task.completionDetails.bestScore}</div>
                                      <div><span className="font-medium">參與次數：</span>{task.completionDetails.attempts}</div>
                                      {task.completionDetails.completedAt && (
                                        <div><span className="font-medium">完成時間：</span>{new Date(task.completionDetails.completedAt).toLocaleString()}</div>
                                      )}
                                    </>
                                  )}
                                  {(!isQuiz && !isGame && !isBot && !isContest) && (
                                    <>
                                      {task.completionDetails.responseLength && (
                                        <div><span className="font-medium">回應長度：</span>{task.completionDetails.responseLength} 字元</div>
                                      )}
                                      {task.completionDetails.submittedAt && (
                                        <div><span className="font-medium">提交時間：</span>{new Date(task.completionDetails.submittedAt).toLocaleString()}</div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="text-sm text-gray-500 mt-2">
                              <span className="font-medium">創建時間：</span>{task.createdAtFormatted}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400 font-bold text-xl border-4 border-dashed border-gray-300 rounded-3xl">
                  沒有找到任務
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Drawer Sidebar */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-black/50"
            aria-label="關閉選單"
            onClick={closeSidebar}
          />
          <aside
            className="absolute inset-y-0 left-0 w-[min(22rem,85vw)] border-r-4 border-brand-brown shadow-2xl overflow-y-auto"
            style={{
              backgroundImage: "url('/stubg.png')",
              backgroundSize: 'cover',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              backgroundColor: '#FEF7EC'
            }}
          >
            <div className="p-6">
              <div className="relative mb-0 flex items-center justify-center">
                <img
                  src="/lpsparklogo.png"
                  alt="LP科樂園 Logo"
                  className="h-[104px] w-auto mx-auto object-contain drop-shadow-sm hover:scale-105 transition-transform duration-300"
                />
                <button
                  onClick={closeSidebar}
                  className="absolute right-0 w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                  aria-label="關閉"
                >
                  <X className="w-6 h-6 text-brand-brown" />
                </button>
              </div>

              <div className="w-full">
                <div className="text-center mb-4 border-b-4 border-brand-brown pb-3 mx-2">
                  <h2 className="text-xl font-bold text-brand-brown">教師工具包</h2>
                </div>

                <nav className="space-y-3 px-1">
                  <Button
                    fullWidth
                    className="bg-[#D2EFFF] hover:bg-[#BCE0FF]"
                    onClick={() => {
                      setShowAiChat(true);
                      closeSidebar();
                    }}
                  >
                    AI對話
                  </Button>
                  <Button
                    fullWidth
                    className="bg-[#E8F5E9] hover:bg-[#C8E6C9] flex items-center justify-center gap-2"
                    onClick={() => {
                      setShowAppStudio(true);
                      closeSidebar();
                    }}
                  >
                    <Code className="w-5 h-5" />
                    小程式工作坊
                  </Button>
                  <Button
                    fullWidth
                    className="bg-[#E0D2F8] hover:bg-[#D0BCF5]"
                    onClick={() => {
                      openStudentProgress();
                      closeSidebar();
                    }}
                  >
                    學生進度
                  </Button>
                  <Button
                    fullWidth
                    className="bg-[#C0E2BE] hover:bg-[#A9D8A7]"
                    onClick={() => {
                      openAssignmentManagement();
                      closeSidebar();
                    }}
                  >
                    作業管理
                  </Button>
                  <Button
                    fullWidth
                    className="bg-[#FFF3E0] hover:bg-[#FFE3C2]"
                    onClick={() => {
                      setShowChartGenerator(true);
                      closeSidebar();
                    }}
                  >
                    圖表生成器
                  </Button>
                  <Button
                    fullWidth
                    className="bg-[#D2EFFF] hover:bg-[#BCE0FF]"
                    onClick={async () => {
                      if (availableSubjects.length === 0 || availableClasses.length === 0) {
                        await loadFilterOptions();
                      }
                      setShowDraftLibraryModal(true);
                      closeSidebar();
                    }}
                  >
                    教師資料夾
                  </Button>
                  <Button
                    fullWidth
                    className="bg-[#F8C5C5] hover:bg-[#F0B5B5] flex items-center justify-center gap-2"
                    onClick={() => {
                      setShowCreateTaskModal(true);
                      closeSidebar();
                    }}
                  >
                    <MessageSquare className="w-5 h-5" />
                    建立任務
                  </Button>
                  <Button fullWidth className="bg-[#FAD5BE] hover:bg-[#F8C4A6]" onClick={closeSidebar}>
                    更多功能開發中⋯⋯
                  </Button>
                </nav>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Sidebar */}
      <aside
        className="hidden lg:flex relative z-10 w-full lg:w-80 max-h-[calc(100vh-1.5rem)] my-0 lg:my-3 ml-0 rounded-b-[3rem] lg:rounded-b-none lg:rounded-r-[3rem] border-4 lg:border-l-0 border-brand-brown shadow-2xl flex-col px-6 pt-5 pb-4 overflow-hidden"
        style={{
          backgroundImage: "url('/stubg.png')",
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundColor: '#FEF7EC'
        }}
      >
        <div className="flex items-center justify-center mb-0">
          <img
            src="/lpsparklogo.png"
            alt="LP科樂園 Logo"
            className="h-[132px] w-auto mx-auto object-contain drop-shadow-sm hover:scale-105 transition-transform duration-300"
          />
        </div>

        <div className="w-full min-h-0">
          <div className="text-center mb-5 border-b-4 border-brand-brown pb-3 mx-3">
            <h2 className="text-2xl font-bold text-brand-brown">教師工具包</h2>
          </div>

          <nav className="flex-1 space-y-3 px-1 overflow-y-auto">
          <Button
            fullWidth
            className="bg-[#D2EFFF] hover:bg-[#BCE0FF] text-lg"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowAiChat(true);
            }}
          >
            AI對話
          </Button>
          <Button
            fullWidth
            className="bg-[#E8F5E9] hover:bg-[#C8E6C9] text-lg flex items-center justify-center gap-2"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowAppStudio(true);
            }}
          >
            <Code className="w-5 h-5" />
            小程式工作坊
          </Button>
          <Button
            fullWidth
            className="bg-[#E0D2F8] hover:bg-[#D0BCF5] text-lg"
            onClick={openStudentProgress}
          >
            學生進度
          </Button>
          <Button fullWidth className="bg-[#C0E2BE] hover:bg-[#A9D8A7] text-lg" onClick={openAssignmentManagement}>
            作業管理
          </Button>
          <Button
            fullWidth
            className="bg-[#FFF3E0] hover:bg-[#FFE3C2] text-lg"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowChartGenerator(true);
            }}
          >
            圖表生成器
          </Button>
          <Button
            fullWidth
            className="bg-[#D2EFFF] hover:bg-[#BCE0FF] text-lg"
            onClick={async () => {
              if (availableSubjects.length === 0 || availableClasses.length === 0) {
                await loadFilterOptions();
              }
              setShowDraftLibraryModal(true);
            }}
          >
            教師資料夾
          </Button>
		          <Button
		            fullWidth
		            className="bg-[#F8C5C5] hover:bg-[#F0B5B5] text-lg flex items-center justify-center gap-2"
		            onClick={() => setShowCreateTaskModal(true)}
		          >
	            <MessageSquare className="w-5 h-5" />
	            建立任務
	          </Button>
          <Button fullWidth className="bg-[#FAD5BE] hover:bg-[#F8C4A6] text-lg">更多功能開發中⋯⋯</Button>
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative z-10 flex items-center justify-center p-4 sm:p-8">

        {/* Welcome Message */}
        <div className="bg-[#FEF7EC] w-full max-w-2xl rounded-[2rem] border-4 border-brand-brown shadow-comic-xl p-8 relative">
          <h2 className="text-4xl font-black text-center text-brand-brown mb-4 font-rounded">歡迎，{user?.profile?.name || '教師'}！</h2>
          <p className="text-center text-gray-600 text-lg">請使用左側工具列選擇功能</p>
        </div>

      </main>

      {/* Game Selection Modal */}
      {
        showGameModal && !gameType && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-2xl shadow-comic">
              <div className="p-6 border-b-4 border-brand-brown bg-[#E8F5E9]">
                <div className="flex justify-between items-center">
	                  <h2 className="text-3xl font-black text-brand-brown">創建小遊戲</h2>
	                  <button
	                    onClick={() => { setShowGameModal(false); setGameType(null); }}
	                    className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
	                  >
	                    <X className="w-6 h-6 text-brand-brown" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-center text-gray-600 mb-6">選擇遊戲類型</p>
	                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
	                  <button
	                    onClick={() => setGameType('maze')}
	                    className="p-6 bg-gradient-to-br from-purple-100 to-purple-200 border-4 border-purple-400 rounded-2xl hover:shadow-lg transition-all hover:scale-105"
                  >
                    <div className="text-4xl mb-3">🎮</div>
                    <h3 className="text-xl font-bold text-purple-800">迷宮追逐</h3>
                    <p className="text-sm text-purple-600 mt-2">在迷宮中尋找正確答案，避開障礙物</p>
                  </button>
	                  <button
	                    onClick={() => setGameType('matching')}
	                    className="p-6 bg-gradient-to-br from-blue-100 to-blue-200 border-4 border-blue-400 rounded-2xl hover:shadow-lg transition-all hover:scale-105"
	                  >
	                    <div className="text-4xl mb-3">🃏</div>
	                    <h3 className="text-xl font-bold text-blue-800">翻牌記憶</h3>
	                    <p className="text-sm text-blue-600 mt-2">翻開卡牌配對，考驗記憶力</p>
	                  </button>
	                  <button
	                    onClick={() => setGameType('tower-defense')}
	                    className="p-6 bg-gradient-to-br from-emerald-100 to-lime-200 border-4 border-emerald-400 rounded-2xl hover:shadow-lg transition-all hover:scale-105"
	                  >
	                    <div className="text-4xl mb-3">🏰</div>
	                    <h3 className="text-xl font-bold text-emerald-800">答題塔防</h3>
	                    <p className="text-sm text-emerald-700 mt-2">不停答題賺金幣，購買士兵守護基地</p>
	                  </button>
	                  <button
	                    onClick={openRangerTdCreator}
	                    className="p-6 bg-gradient-to-br from-amber-100 to-rose-100 border-4 border-amber-400 rounded-2xl hover:shadow-lg transition-all hover:scale-105"
	                  >
	                    <div className="text-4xl mb-3">🧸</div>
	                    <h3 className="text-xl font-bold text-amber-800">Ranger 塔防</h3>
	                    <p className="text-sm text-amber-700 mt-2">答對題目召喚可愛角色/技能，推倒敵人塔樓</p>
	                  </button>
	                </div>
	              </div>
	            </div>
	          </div>
	        )
      }

      {/* Maze Chase Game Creation Modal */}
      {showGameModal && gameType === 'maze' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-purple-400 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-comic">
            <div className="p-6 border-b-4 border-purple-400 bg-gradient-to-r from-purple-100 to-purple-200">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🎮</span>
                  <h2 className="text-3xl font-black text-purple-800">創建迷宮追逐遊戲</h2>
                </div>
                <button
                  onClick={() => { setShowGameModal(false); setGameType(null); }}
                  className="w-10 h-10 rounded-full bg-white border-2 border-purple-400 hover:bg-purple-50 flex items-center justify-center"
                >
                  <X className="w-6 h-6 text-purple-600" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-purple-50 p-4 rounded-xl border-2 border-purple-200">
                <p className="text-purple-800 text-sm">
                  🎮 <strong>遊戲說明：</strong>學生操作角色在迷宮裡移動，必須「吃到」正確答案，同時避開怪物或障礙物。答對會加分、走錯路或被追到就會扣分或失去生命值。
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="遊戲標題"
                  placeholder="輸入遊戲標題..."
                  value={gameForm.title}
                  onChange={(e) => setGameForm(prev => ({ ...prev, title: e.target.value }))}
                />
                <div>
                  <label className="block text-sm font-bold text-purple-800 mb-2">科目</label>
                  <select
                    className="w-full px-4 py-2 border-4 border-purple-300 rounded-2xl bg-white font-bold"
                    value={gameForm.subject}
                    onChange={(e) => {
                      const newSubject = e.target.value as Subject;
                      setGameForm(prev => ({ ...prev, subject: newSubject, targetClasses: [], targetGroups: [] }));
                      loadClassesAndGroups(newSubject);
                    }}
                  >
                    {VISIBLE_SUBJECTS.map(subject => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-purple-800 mb-2">難度</label>
                <select
                  className="w-full px-4 py-2 border-4 border-purple-300 rounded-2xl bg-white font-bold"
                  value={gameForm.difficulty}
                  onChange={(e) => setGameForm(prev => ({ ...prev, difficulty: e.target.value as 'easy' | 'medium' | 'hard' }))}
                >
                  <option value="easy">簡單 (迷宮小)</option>
                  <option value="medium">中等 (迷宮中)</option>
                  <option value="hard">困難 (迷宮大)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-purple-800 mb-2">題目與答案（迷宮中會出現這些選項）</label>
                <div className="space-y-4">
                  {gameForm.questions.map((q, index) => (
                    <div key={index} className="bg-white p-4 rounded-xl border-2 border-purple-200">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-bold text-purple-700">題目 {index + 1}</span>
                        <button
                          onClick={() => setGameForm(prev => ({
                            ...prev,
                            questions: prev.questions.filter((_, i) => i !== index)
                          }))}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                      <Input
                        label="問題"
                        placeholder="輸入問題..."
                        multiline={true}
                        rows={3}
                        value={q.question}
                        onChange={(e) => {
                          const newQuestions = [...gameForm.questions];
                          newQuestions[index].question = e.target.value;
                          setGameForm(prev => ({ ...prev, questions: newQuestions }));
                        }}
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                        <Input
                          label="正確答案"
                          placeholder="正確答案..."
                          value={q.answer}
                          onChange={(e) => {
                            const newQuestions = [...gameForm.questions];
                            newQuestions[index].answer = e.target.value;
                            setGameForm(prev => ({ ...prev, questions: newQuestions }));
                          }}
                        />
                        <Input
                          label="錯誤選項（用逗號分隔）"
                          placeholder="錯誤答案1, 錯誤答案2..."
                          value={q.wrongOptions?.join(', ') || ''}
                          onChange={(e) => {
                            const newQuestions = [...gameForm.questions];
                            newQuestions[index].wrongOptions = e.target.value.split(','); // Allow raw input, clean up on save if needed
                            setGameForm(prev => ({ ...prev, questions: newQuestions }));
                          }}
                        />
                      </div>
                    </div>
                  ))}
	                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
	                    <button
	                      type="button"
	                      onClick={() => openAiGenerator({
	                        mode: 'mcq',
	                        title: 'AI 生成迷宮追逐題目',
	                        subject: String(gameForm.subject),
	                        importModes: ['replace', 'append'],
	                        onImport: (payload, importMode) => {
	                          const incoming = (payload.mcq || []).map((item: any) => {
	                            const correct = item.options?.[item.correctIndex] ?? '';
	                            const wrongOptions = (item.options || []).filter((_: any, i: number) => i !== item.correctIndex);
	                            return { question: item.question, answer: correct, wrongOptions };
	                          }).filter((q: any) => q.question && q.answer);
	                          setGameForm(prev => ({
	                            ...prev,
	                            questions: importMode === 'replace' ? incoming : [...prev.questions, ...incoming]
	                          }));
	                          setShowAiGenerator(false);
	                        }
	                      })}
	                      className="w-full py-3 rounded-2xl border-4 border-blue-300 bg-blue-50 text-blue-700 font-bold hover:bg-blue-100"
	                    >
	                      🤖 AI 生成
	                    </button>
	                    <button
	                      type="button"
	                      onClick={() => setGameForm(prev => ({
	                        ...prev,
	                        questions: [...prev.questions, { question: '', answer: '', wrongOptions: [] }]
	                      }))}
	                      className="w-full py-3 border-4 border-dashed border-purple-300 rounded-2xl text-purple-600 font-bold hover:bg-purple-50"
	                    >
	                      + 新增題目
	                    </button>
	                  </div>
	                </div>
	              </div>

              <div className="flex gap-4 pt-4 border-t-4 border-purple-200">
                <button
                  onClick={() => void cancelGameDraftEditor()}
                  className="flex-1 py-3 rounded-2xl border-4 border-gray-300 text-gray-600 font-bold hover:bg-gray-100"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    if (gameDraftReadOnly) return;
                    if (!String(gameForm.title || '').trim()) return alert('請填寫遊戲標題');
                    setGameWizardMode('save');
                    setGameWizardOpen(true);
                  }}
                  disabled={gameDraftReadOnly}
                  className="flex-1 py-3 rounded-2xl border-4 border-purple-500 bg-white text-purple-800 font-bold hover:bg-purple-50 disabled:opacity-60"
                >
                  儲存
                </button>
                <button
                  onClick={() => {
                    if (!String(gameForm.title || '').trim()) return alert('請填寫遊戲標題');
                    if (!Array.isArray(gameForm.questions) || gameForm.questions.length === 0) return alert('請至少新增一個題目');
                    setGameWizardMode('publish');
                    setGameWizardOpen(true);
                  }}
                  className="flex-1 py-3 rounded-2xl border-4 border-purple-500 bg-purple-500 text-white font-bold hover:bg-purple-600"
                >
                  儲存及派發
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

	      {/* Matching Pairs Game Creation Modal */}
	      {showGameModal && gameType === 'matching' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-blue-400 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-comic">
            <div className="p-6 border-b-4 border-blue-400 bg-gradient-to-r from-blue-100 to-blue-200">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🃏</span>
                  <h2 className="text-3xl font-black text-blue-800">創建翻牌記憶遊戲</h2>
                </div>
                <button
                  onClick={() => { setShowGameModal(false); setGameType(null); }}
                  className="w-10 h-10 rounded-full bg-white border-2 border-blue-400 hover:bg-blue-50 flex items-center justify-center"
                >
                  <X className="w-6 h-6 text-blue-600" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-blue-50 p-4 rounded-xl border-2 border-blue-200">
                <p className="text-blue-800 text-sm">
                  🃏 <strong>遊戲說明：</strong>學生點擊翻牌，一次翻兩張，若是正確配對（例如：字詞與解釋、圖片與詞彙）就會被消除，錯的話再翻回去，考驗記憶與理解。
                </p>
              </div>

	              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
	                <Input
	                  label="遊戲標題"
	                  placeholder="輸入遊戲標題..."
	                  value={gameForm.title}
	                  onChange={(e) => setGameForm(prev => ({ ...prev, title: e.target.value }))}
	                />
	                <div>
	                  <label className="block text-sm font-bold text-blue-800 mb-2">難度（影響卡牌數量）</label>
	                  <select
	                    className="w-full px-4 py-2 border-4 border-blue-300 rounded-2xl bg-white font-bold"
	                    value={gameForm.difficulty}
	                    onChange={(e) => setGameForm(prev => ({ ...prev, difficulty: e.target.value as 'easy' | 'medium' | 'hard' }))}
	                  >
	                    <option value="easy">簡單 (4對)</option>
	                    <option value="medium">中等 (6對)</option>
	                    <option value="hard">困難 (8對)</option>
	                  </select>
	                </div>
	              </div>

	              {/* Subject */}
	              <div>
	                <label className="block text-sm font-bold text-blue-800 mb-2">科目</label>
	                <select
	                  className="w-full px-4 py-2 border-4 border-blue-300 rounded-2xl bg-white font-bold"
	                  value={gameForm.subject}
	                  onChange={(e) => {
	                    const newSubject = e.target.value as Subject;
	                    setGameForm(prev => ({ ...prev, subject: newSubject, targetClasses: [], targetGroups: [] }));
                        setGameClassFolderId('');
	                    loadClassesAndGroups(newSubject);
	                  }}
	                >
	                  {VISIBLE_SUBJECTS.map(subject => (
	                    <option key={subject} value={subject}>{subject}</option>
	                  ))}
	                </select>
	              </div>

	              <div>
	                <label className="block text-sm font-bold text-blue-800 mb-2">配對內容（左邊配右邊）</label>
	                <p className="text-xs text-gray-500 mb-2">
	                  依難度需要配對數：{gameForm.difficulty === 'easy' ? '4對' : gameForm.difficulty === 'medium' ? '6對' : '8對'}（多於需求的配對會自動忽略）
	                </p>
	                <div className="space-y-4">
	                  {gameForm.questions.map((q, index) => (
	                    <div key={index} className="bg-white p-4 rounded-xl border-2 border-blue-200 flex items-center gap-4">
	                      <span className="font-bold text-blue-700 w-8">{index + 1}.</span>
                      <Input
                        placeholder="詞彙/問題..."
                        value={q.question}
                        onChange={(e) => {
                          const newQuestions = [...gameForm.questions];
                          newQuestions[index].question = e.target.value;
                          setGameForm(prev => ({ ...prev, questions: newQuestions }));
                        }}
                      />
                      <span className="text-2xl">↔</span>
                      <Input
                        placeholder="解釋/答案..."
                        value={q.answer}
                        onChange={(e) => {
                          const newQuestions = [...gameForm.questions];
                          newQuestions[index].answer = e.target.value;
                          setGameForm(prev => ({ ...prev, questions: newQuestions }));
                        }}
                      />
                      <button
                        onClick={() => setGameForm(prev => ({
                          ...prev,
                          questions: prev.questions.filter((_, i) => i !== index)
                        }))}
                        className="text-red-500 hover:text-red-700 p-2"
                      >
                        <Trash className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
		                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
		                    <button
		                      type="button"
		                      onClick={() => openAiGenerator({
		                        mode: 'pairs',
		                        title: 'AI 生成翻牌記憶配對',
		                        subject: String(gameForm.subject),
		                        importModes: ['replace', 'append'],
		                        onImport: (payload, importMode) => {
		                          const incoming = (payload.pairs || []).map((p: any) => ({
		                            question: p.question,
		                            answer: p.answer
		                          })).filter((p: any) => p.question && p.answer);
		                          setGameForm(prev => ({
		                            ...prev,
		                            questions: importMode === 'replace' ? incoming : [...prev.questions, ...incoming]
		                          }));
		                          setShowAiGenerator(false);
		                        }
		                      })}
		                      className="w-full py-3 rounded-2xl border-4 border-blue-300 bg-blue-50 text-blue-700 font-bold hover:bg-blue-100"
		                    >
		                      🤖 AI 生成
		                    </button>
		                    <button
		                      type="button"
		                      onClick={() => setGameForm(prev => ({
		                        ...prev,
		                        questions: [...prev.questions, { question: '', answer: '' }]
		                      }))}
		                      className="w-full py-3 border-4 border-dashed border-blue-300 rounded-2xl text-blue-600 font-bold hover:bg-blue-50"
		                    >
		                      + 新增配對
		                    </button>
		                  </div>
		                </div>
		              </div>

              <div className="flex gap-4 pt-4 border-t-4 border-blue-200">
                <button
                  onClick={() => void cancelGameDraftEditor()}
                  className="flex-1 py-3 rounded-2xl border-4 border-gray-300 text-gray-600 font-bold hover:bg-gray-100"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    if (gameDraftReadOnly) return;
                    if (!String(gameForm.title || '').trim()) return alert('請輸入遊戲標題');
                    setGameWizardMode('save');
                    setGameWizardOpen(true);
                  }}
                  disabled={gameDraftReadOnly}
                  className="flex-1 py-3 rounded-2xl border-4 border-blue-500 bg-white text-blue-800 font-bold hover:bg-blue-50 disabled:opacity-60"
                >
                  儲存
                </button>
                <button
                  onClick={() => {
                    if (!String(gameForm.title || '').trim()) return alert('請輸入遊戲標題');
                    setGameWizardMode('publish');
                    setGameWizardOpen(true);
                  }}
                  className="flex-1 py-3 rounded-2xl border-4 border-blue-500 bg-blue-500 text-white font-bold hover:bg-blue-600"
                >
                  儲存及派發
                </button>
              </div>
            </div>
          </div>
        </div>
	      )}

	      {/* Tower Defense Game Creation Modal */}
	      {showGameModal && gameType === 'tower-defense' && (
	        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
	          <div className="bg-white border-4 border-emerald-400 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-comic">
	            <div className="p-6 border-b-4 border-emerald-400 bg-gradient-to-r from-emerald-100 to-lime-200">
	              <div className="flex justify-between items-center">
	                <div className="flex items-center gap-3">
	                  <span className="text-3xl">🏰</span>
	                  <h2 className="text-3xl font-black text-emerald-800">創建答題塔防遊戲</h2>
	                </div>
			                <button
			                  onClick={() => { setShowGameModal(false); setGameType(null); setTowerDefenseQuestions([]); setTowerDefenseTimeSeconds(60); setTowerDefenseTimeSecondsText('60'); }}
			                  className="w-10 h-10 rounded-full bg-white border-2 border-emerald-400 hover:bg-emerald-50 flex items-center justify-center"
			                >
		                  <X className="w-6 h-6 text-emerald-700" />
		                </button>
	              </div>
	            </div>

	            <div className="p-6 space-y-6">
	              <div className="bg-emerald-50 p-4 rounded-xl border-2 border-emerald-200">
	                <p className="text-emerald-900 text-sm">
	                  🏰 <strong>玩法：</strong>學生在塔防中抵擋怪物。每答對一題就獲得金幣，可用來購買士兵（塔）放置在戰場上。題庫會循環出題，選項每次亂序。
	                </p>
	              </div>

	              <Input
	                label="遊戲標題"
	                placeholder="輸入遊戲標題..."
	                value={gameForm.title}
	                onChange={(e) => setGameForm(prev => ({ ...prev, title: e.target.value }))}
	              />

	              <div>
	                <label className="block text-sm font-bold text-emerald-800 mb-2">科目</label>
	                <select
	                  className="w-full px-4 py-2 border-4 border-emerald-300 rounded-2xl bg-white font-bold"
	                  value={gameForm.subject}
	                  onChange={(e) => {
	                    const newSubject = e.target.value as Subject;
	                    setGameForm(prev => ({ ...prev, subject: newSubject, targetClasses: [], targetGroups: [] }));
                        setGameClassFolderId('');
	                    loadClassesAndGroups(newSubject);
	                  }}
	                >
	                  {VISIBLE_SUBJECTS.map(subject => (
	                    <option key={subject} value={subject}>{subject}</option>
	                  ))}
	                </select>
	              </div>

			              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
			                <div>
			                  <label className="block text-sm font-bold text-emerald-800 mb-2">難度（影響起始金幣與怪物強度）</label>
			                  <select
		                    className="w-full px-4 py-2 border-4 border-emerald-300 rounded-2xl bg-white font-bold"
		                    value={gameForm.difficulty}
		                    onChange={(e) => setGameForm(prev => ({ ...prev, difficulty: e.target.value as 'easy' | 'medium' | 'hard' }))}
		                  >
		                    <option value="easy">簡單 (起始金幣多 / 怪物弱)</option>
		                    <option value="medium">中等</option>
		                    <option value="hard">困難 (起始金幣少 / 怪物強)</option>
		                  </select>
		                </div>
		                <div>
		                  <label className="block text-sm font-bold text-emerald-800 mb-2">遊戲時間（秒）</label>
		                  <input
		                    type="text"
		                    inputMode="numeric"
		                    pattern="[0-9]*"
		                    value={towerDefenseTimeSecondsText}
		                    onChange={(e) => {
		                      const v = e.target.value;
		                      if (/^[0-9]*$/.test(v)) setTowerDefenseTimeSecondsText(v);
		                    }}
		                    onBlur={() => setTowerDefenseTimeSeconds((prev) => clampTowerDefenseTimeSeconds(towerDefenseTimeSecondsText, prev))}
		                    onKeyDown={(e) => {
		                      if (e.key === 'Enter') {
		                        (e.currentTarget as HTMLInputElement).blur();
		                      }
		                    }}
		                    className="w-full px-4 py-2 border-4 border-emerald-300 rounded-2xl bg-white font-bold"
		                  />
		                  <p className="text-xs text-gray-500 mt-1">建議 30–180 秒；預設 60 秒</p>
		                </div>
		              </div>

		              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4">
		                <div className="flex items-center gap-3">
		                  <label className="flex items-center gap-2 font-bold text-emerald-900">
		                    <input
		                      type="checkbox"
		                      checked={towerDefenseLivesEnabled}
		                      onChange={(e) => setTowerDefenseLivesEnabled(e.target.checked)}
		                      className="w-4 h-4"
		                    />
		                    啟用生命限制
		                  </label>
		                  <div className="ml-auto flex items-center gap-2">
		                    <span className="text-sm font-bold text-emerald-900">生命值</span>
		                    <input
		                      type="number"
		                      min={1}
		                      max={99}
		                      value={towerDefenseLivesLimit}
		                      disabled={!towerDefenseLivesEnabled}
		                      onChange={(e) => setTowerDefenseLivesLimit(Math.max(1, Math.min(99, parseInt(e.target.value) || 10)))}
		                      className={`w-24 px-3 py-2 border-2 rounded-xl font-bold ${towerDefenseLivesEnabled ? 'border-emerald-300 bg-white' : 'border-gray-200 bg-gray-100 text-gray-400'}`}
		                    />
		                  </div>
		                </div>
		                <p className="text-xs text-gray-500 mt-2">
		                  建議 5–15；關閉代表只按時間結束遊戲。
		                </p>
		              </div>

		              <div>
		                <label className="block text-sm font-bold text-emerald-800 mb-2">題庫（答題驅動自動作戰）</label>
		                <div className="border-2 border-emerald-200 rounded-2xl p-4 bg-white">
			                  <div className="flex justify-between items-center mb-4">
			                    <span className="font-bold text-emerald-800">題目列表（四選一 / 配對）</span>
			                    <div className="flex gap-2">
			                      <button
			                        type="button"
			                        onClick={() => openAiGenerator({
			                          mode: 'mcq',
			                          title: 'AI 生成答題塔防題目',
			                          subject: String(gameForm.subject),
			                          importModes: ['replace', 'append'],
			                          onImport: (payload, importMode) => {
			                            const incoming: TowerDefenseQuestionDraft[] = (payload.mcq || [])
			                              .map((q: any) => ({
			                                type: 'mcq',
			                                prompt: String(q.question || ''),
			                                options: Array.isArray(q.options) ? q.options.map((x: any) => String(x ?? '')) : ['', '', '', ''],
			                                correctIndex: Number(q.correctIndex ?? 0)
			                              }))
			                              .filter((q: any) => q.prompt && Array.isArray(q.options) && q.options.length === 4);
			                            setTowerDefenseQuestions(prev => importMode === 'replace' ? incoming : [...prev, ...incoming]);
			                            setShowAiGenerator(false);
			                          }
			                        })}
			                        className="px-4 py-2 bg-blue-100 text-blue-800 border-2 border-blue-300 rounded-2xl font-bold hover:bg-blue-200"
			                      >
			                        🤖 AI 生成
			                      </button>
			                      <button
			                        type="button"
			                        onClick={addTowerDefenseMcqQuestion}
			                        className="px-4 py-2 bg-emerald-100 text-emerald-800 border-2 border-emerald-300 rounded-2xl font-bold hover:bg-emerald-200 flex items-center gap-2"
			                      >
			                        <Plus className="w-4 h-4" />
			                        新增四選一
			                      </button>
			                      <button
			                        type="button"
			                        onClick={addTowerDefenseMatchQuestion}
			                        className="px-4 py-2 bg-lime-100 text-lime-900 border-2 border-lime-300 rounded-2xl font-bold hover:bg-lime-200 flex items-center gap-2"
			                      >
			                        <Plus className="w-4 h-4" />
			                        新增配對
			                      </button>
			                    </div>
			                  </div>

		                  {towerDefenseQuestions.length === 0 ? (
		                    <div className="text-center py-8 text-gray-400 font-bold border-4 border-dashed border-emerald-200 rounded-3xl">
		                      還沒有問題，點擊上方「新增問題」開始創建 📝
		                    </div>
		                  ) : (
		                    <div className="space-y-6">
		                      {towerDefenseQuestions.map((q, questionIndex) => (
		                        <div key={questionIndex} className="bg-emerald-50 border-4 border-emerald-200 rounded-3xl p-6">
		                          <div className="flex justify-between items-start mb-4">
		                            <div className="flex items-center gap-2">
		                              <h4 className="text-lg font-bold text-emerald-900">題目 {questionIndex + 1}</h4>
		                              <span className={`px-2 py-0.5 rounded-full text-xs font-black border-2 ${q.type === 'match' ? 'bg-lime-100 border-lime-300 text-lime-900' : 'bg-blue-100 border-blue-300 text-blue-900'}`}>
		                                {q.type === 'match' ? '配對' : '四選一'}
		                              </span>
		                            </div>
		                            <button
		                              type="button"
		                              onClick={() => removeTowerDefenseQuestion(questionIndex)}
		                              className="p-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200"
		                            >
		                              <Trash className="w-4 h-4" />
		                            </button>
		                          </div>

		                          <div className="space-y-4">
		                            {q.type === 'mcq' ? (
		                              <Input
		                                label="問題內容"
		                                placeholder="輸入問題..."
		                                multiline={true}
		                                rows={3}
		                                value={q.prompt}
		                                onChange={(e) => updateTowerDefensePrompt(questionIndex, e.target.value)}
		                              />
		                            ) : (
		                              <Input
		                                label="左邊（題幹）"
		                                placeholder="例如：光合作用 / 2+3 / apple..."
		                                multiline={true}
		                                rows={3}
		                                value={q.left}
		                                onChange={(e) => updateTowerDefenseLeft(questionIndex, e.target.value)}
		                              />
		                            )}

		                            <div>
		                              <label className="block text-sm font-bold text-emerald-800 mb-2">{q.type === 'match' ? '右邊選項（四選一）' : '選項'}</label>
		                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
		                                {q.options.map((option, optionIndex) => (
		                                  <div key={optionIndex} className="relative">
		                                    <div className={`flex items-center gap-3 p-3 rounded-2xl border-2 ${q.correctIndex === optionIndex ? 'bg-emerald-100 border-emerald-400' : 'bg-white border-emerald-200'
		                                      }`}>
		                                      <input
		                                        type="radio"
		                                        name={`td-correct-${questionIndex}`}
		                                        checked={q.correctIndex === optionIndex}
		                                        onChange={() => updateTowerDefenseCorrectIndex(questionIndex, optionIndex)}
		                                        className="w-4 h-4 text-emerald-600"
		                                      />
		                                      <span className="font-bold text-emerald-900 min-w-[20px]">
		                                        {String.fromCharCode(65 + optionIndex)}.
		                                      </span>
		                                      <input
		                                        type="text"
		                                        placeholder={`選項 ${String.fromCharCode(65 + optionIndex)}`}
		                                        value={option}
		                                        onChange={(e) => updateTowerDefenseOption(questionIndex, optionIndex, e.target.value)}
		                                        className="flex-1 px-3 py-2 border-2 border-emerald-200 rounded-xl focus:border-emerald-400 font-medium"
		                                      />
		                                    </div>
		                                    {q.correctIndex === optionIndex && (
		                                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
		                                        ✓
		                                      </div>
		                                    )}
		                                  </div>
		                                ))}
		                              </div>
		                              <p className="text-xs text-gray-500 mt-2">
		                                ☑️ 點擊左側圓圈選擇正確答案
		                              </p>
		                            </div>
		                          </div>
		                        </div>
		                      ))}
		                    </div>
		                  )}
		                </div>
		              </div>

	              <div className="flex gap-4 pt-4 border-t-4 border-emerald-200">
	                <button
	                  onClick={() => void cancelGameDraftEditor()}
	                  className="flex-1 py-3 rounded-2xl border-4 border-gray-300 text-gray-600 font-bold hover:bg-gray-100"
	                >
	                  取消
	                </button>
	                <button
	                  onClick={() => {
                      if (gameDraftReadOnly) return;
	                      if (!String(gameForm.title || '').trim()) return alert('請填寫遊戲標題');
                      setGameWizardMode('save');
                      setGameWizardOpen(true);
                    }}
                    disabled={gameDraftReadOnly}
	                  className="flex-1 py-3 rounded-2xl border-4 border-emerald-600 bg-white text-emerald-800 font-bold hover:bg-emerald-50 disabled:opacity-60"
	                >
	                  儲存
	                </button>
	                <button
	                  onClick={() => {
                      if (!String(gameForm.title || '').trim()) return alert('請填寫遊戲標題');
                      setGameWizardMode('publish');
                      setGameWizardOpen(true);
                    }}
	                  className="flex-1 py-3 rounded-2xl border-4 border-emerald-600 bg-emerald-600 text-white font-bold hover:bg-emerald-700"
	                >
	                  儲存及派發
	                </button>
	              </div>
	            </div>
	          </div>
	        </div>
	      )}

	      {/* Ranger TD Game Creation Modal */}
	      {showGameModal && gameType === 'ranger-td' && (
	        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
	          <div className="bg-white border-4 border-amber-400 rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-comic">
	            <div className="p-6 border-b-4 border-amber-400 bg-gradient-to-r from-amber-100 to-rose-100">
		              <div className="flex justify-between items-center">
		                <div className="flex items-center gap-3">
		                  <span className="text-3xl">🧸</span>
		                  <h2 className="text-3xl font-black text-amber-900">
		                    {rangerAnswerMode === 'mcq' ? '創建 Ranger 塔防（答題）' : '創建 Ranger 塔防（數學）'}
		                  </h2>
		                </div>
	                <button
	                  onClick={() => { setShowGameModal(false); setGameType(null); }}
	                  className="w-10 h-10 rounded-full bg-white border-2 border-amber-400 hover:bg-amber-50 flex items-center justify-center"
	                >
	                  <X className="w-6 h-6 text-amber-800" />
	                </button>
	              </div>
	            </div>

	            <div className="p-6 space-y-6">
		              <div className="bg-amber-50 p-4 rounded-xl border-2 border-amber-200">
		                <p className="text-amber-900 text-sm">
		                  🧸 <strong>玩法：</strong>左邊是你的塔（基地），右邊是敵人的塔。角色自動前進與戰鬥；學生需持續回答題目來獲得召喚/技能。每關完成一組題目後（且基地未被摧毀）即可升級技能並進入下一關。
		                </p>
		              </div>

		              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
		                <Input
		                  label="測驗標題"
		                  placeholder="輸入測驗標題..."
		                  value={rangerForm.title}
		                  onChange={(e) => setRangerForm(prev => ({ ...prev, title: e.target.value }))}
		                />

		                {rangerAnswerMode === 'mcq' ? (
		                  <div>
		                    <label className="block text-sm font-bold text-amber-900 mb-2">科目</label>
		                    <select
		                      className="w-full px-4 py-2 border-4 border-amber-300 rounded-2xl bg-white font-bold"
		                      value={rangerSubject}
		                      onChange={(e) => {
		                        const newSubject = e.target.value as Subject;
		                        setRangerSubject(newSubject);
		                        setRangerForm(prev => ({ ...prev, targetClasses: [], targetGroups: [] }));
		                        loadClassesAndGroups(newSubject);
		                      }}
		                    >
		                      {VISIBLE_SUBJECTS.map(subject => (
		                        <option key={subject} value={subject}>{subject}</option>
		                      ))}
		                    </select>
		                  </div>
		                ) : (
		                  <div>
		                    <label className="block text-sm font-bold text-amber-900 mb-2">年級（AI 生成難度參考）</label>
		                    <select
		                      className="w-full px-4 py-2 border-4 border-amber-300 rounded-2xl bg-white font-bold"
		                      value={rangerGrade}
		                      onChange={(e) => setRangerGrade(e.target.value as any)}
		                    >
		                      {(['小一', '小二', '小三', '小四', '小五', '小六'] as const).map((g) => (
		                        <option key={g} value={g}>{g}</option>
		                      ))}
		                    </select>
		                  </div>
		                )}
		              </div>

	              <Input
	                label="描述（可選）"
	                placeholder="簡短說明..."
	                value={rangerForm.description}
	                onChange={(e) => setRangerForm(prev => ({ ...prev, description: e.target.value }))}
	              />

		              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
		                <div>
		                  <label className="block text-sm font-bold text-amber-900 mb-2">整局時間（秒）</label>
		                  <input
	                    value={rangerRunSecondsText}
	                    onChange={(e) => setRangerRunSecondsText(e.target.value)}
	                    className="w-full px-4 py-2 border-4 border-amber-300 rounded-2xl bg-white font-bold"
	                    inputMode="numeric"
	                  />
	                  <p className="text-xs text-gray-600 mt-1">建議 120–600 秒</p>
	                </div>
	                <div>
	                  <label className="block text-sm font-bold text-amber-900 mb-2">每關題目數量</label>
	                  <input
	                    value={String(rangerStageQuestionCount)}
	                    onChange={(e) => {
	                      const n = Number.parseInt(String(e.target.value || '').trim(), 10);
	                      if (!Number.isFinite(n)) return;
	                      setRangerStageQuestionCount(Math.max(1, Math.min(50, n)));
	                    }}
	                    className="w-full px-4 py-2 border-4 border-amber-300 rounded-2xl bg-white font-bold"
	                    inputMode="numeric"
	                  />
	                  <p className="text-xs text-gray-600 mt-1">範圍 1–50</p>
	                </div>
	                <div>
	                  <label className="block text-sm font-bold text-amber-900 mb-2">答錯扣塔血</label>
	                  <input
	                    value={rangerWrongTowerDamageText}
	                    onChange={(e) => setRangerWrongTowerDamageText(e.target.value)}
	                    className="w-full px-4 py-2 border-4 border-amber-300 rounded-2xl bg-white font-bold"
	                    inputMode="numeric"
	                  />
		                  <p className="text-xs text-gray-600 mt-1">答錯會扣血 + combo 歸零</p>
		                </div>
		                <div>
		                  <label className="block text-sm font-bold text-amber-900 mb-2">基地血量（起始）</label>
		                  <input
		                    value={rangerTowerHpText}
		                    onChange={(e) => setRangerTowerHpText(e.target.value)}
		                    className="w-full px-4 py-2 border-4 border-amber-300 rounded-2xl bg-white font-bold"
		                    inputMode="numeric"
		                  />
		                  <p className="text-xs text-gray-600 mt-1">範圍 5–999</p>
		                </div>
		              </div>

		              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
		                <div>
		                  <label className="block text-sm font-bold text-amber-900 mb-2">作答方式</label>
		                  <select
		                    value={rangerAnswerMode}
		                    onChange={(e) => setRangerAnswerMode(e.target.value === 'input' ? 'input' : 'mcq')}
		                    className="w-full px-4 py-2 border-4 border-amber-300 rounded-2xl bg-white font-bold"
		                  >
		                    <option value="mcq">選擇題（MCQ）</option>
		                    <option value="input">輸入答案</option>
		                  </select>
		                  <p className="text-xs text-gray-600 mt-1">建議先用 MCQ 讓學生快速上手</p>
		                </div>
		              </div>

		              {rangerAnswerMode === 'mcq' && (
		                <div>
		                  <label className="block text-sm font-bold text-amber-900 mb-2">題庫（四選一）</label>
		                  <div className="border-2 border-amber-200 rounded-2xl p-4 bg-white">
		                    <div className="flex justify-between items-center mb-4">
		                      <span className="font-bold text-amber-900">題目列表（四選一）</span>
		                      <div className="flex gap-2">
		                        <button
		                          type="button"
		                          onClick={() => openAiGenerator({
		                            mode: 'mcq',
		                            title: 'AI 生成 Ranger 塔防題目',
		                            subject: String(rangerSubject),
		                            importModes: ['replace', 'append'],
		                            onImport: (payload, importMode) => {
		                              const incoming: TowerDefenseQuestionDraft[] = (payload.mcq || [])
		                                .map((q: any) => ({
		                                  type: 'mcq',
		                                  prompt: String(q.question || ''),
		                                  options: Array.isArray(q.options) ? q.options.map((x: any) => String(x ?? '')) : ['', '', '', ''],
		                                  correctIndex: Number(q.correctIndex ?? 0)
		                                }))
		                                .filter((q: any) => q.prompt && Array.isArray(q.options) && q.options.length === 4);
		                              setRangerMcqQuestions(prev => importMode === 'replace' ? incoming : [...prev, ...incoming]);
		                              setShowAiGenerator(false);
		                            }
		                          })}
		                          className="px-4 py-2 bg-blue-100 text-blue-800 border-2 border-blue-300 rounded-2xl font-bold hover:bg-blue-200"
		                        >
		                          🤖 AI 生成
		                        </button>
		                        <button
		                          type="button"
		                          onClick={addRangerMcqQuestion}
		                          className="px-4 py-2 bg-amber-100 text-amber-900 border-2 border-amber-300 rounded-2xl font-bold hover:bg-amber-200 flex items-center gap-2"
		                        >
		                          <Plus className="w-4 h-4" />
		                          新增四選一
		                        </button>
		                      </div>
		                    </div>

		                    {rangerMcqQuestions.length === 0 ? (
		                      <div className="text-center py-8 text-gray-500">
		                        <p className="font-bold mb-2">還沒有題目</p>
		                        <p className="text-sm">點擊上方「新增四選一」或「AI 生成」開始建立題庫</p>
		                      </div>
		                    ) : (
		                      <div className="space-y-6">
		                        {rangerMcqQuestions.map((q, questionIndex) => (
		                          <div key={questionIndex} className="border-2 border-amber-200 rounded-2xl p-4 bg-amber-50">
		                            <div className="flex justify-between items-start mb-4">
		                              <div className="flex items-center gap-2">
		                                <h4 className="text-lg font-bold text-amber-900">題目 {questionIndex + 1}</h4>
		                                <span className="px-2 py-0.5 rounded-full text-xs font-black border-2 bg-blue-100 border-blue-300 text-blue-900">四選一</span>
		                              </div>
		                              <button
		                                type="button"
		                                onClick={() => removeRangerMcqQuestion(questionIndex)}
		                                className="p-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200"
		                              >
		                                <Trash className="w-4 h-4" />
		                              </button>
		                            </div>

		                            {q.type === 'mcq' && (
		                              <>
		                                <Input
		                                  label="問題內容"
		                                  placeholder="輸入問題..."
		                                  multiline={true}
		                                  rows={3}
		                                  value={q.prompt}
		                                  onChange={(e) => updateRangerMcqPrompt(questionIndex, e.target.value)}
		                                />

		                                <div className="mt-4">
		                                  <label className="block text-sm font-bold text-amber-900 mb-2">選項</label>
		                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
		                                    {q.options.map((option, optionIndex) => (
		                                      <div key={optionIndex} className="relative">
		                                        <div className={`flex items-center gap-3 p-3 rounded-2xl border-2 ${q.correctIndex === optionIndex ? 'bg-amber-100 border-amber-400' : 'bg-white border-amber-200'}`}>
		                                          <input
		                                            type="radio"
		                                            name={`ranger-correct-${questionIndex}`}
		                                            checked={q.correctIndex === optionIndex}
		                                            onChange={() => updateRangerMcqCorrectIndex(questionIndex, optionIndex)}
		                                            className="w-4 h-4 text-amber-600"
		                                          />
		                                          <span className="font-bold text-amber-900 min-w-[20px]">
		                                            {String.fromCharCode(65 + optionIndex)}.
		                                          </span>
		                                          <input
		                                            type="text"
		                                            placeholder={`選項 ${String.fromCharCode(65 + optionIndex)}`}
		                                            value={option}
		                                            onChange={(e) => updateRangerMcqOption(questionIndex, optionIndex, e.target.value)}
		                                            className="flex-1 px-3 py-2 border-2 border-amber-200 rounded-xl focus:border-amber-400 font-medium"
		                                          />
		                                        </div>
		                                        {q.correctIndex === optionIndex && (
		                                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
		                                            ✓
		                                          </div>
		                                        )}
		                                      </div>
		                                    ))}
		                                  </div>
		                                  <p className="text-xs text-gray-600 mt-2">☑️ 點擊左側圓圈選擇正確答案</p>
		                                </div>
		                              </>
		                            )}
		                          </div>
		                        ))}
		                      </div>
		                    )}
		                  </div>
		                </div>
		              )}

		              {rangerAnswerMode === 'input' && (
		                <>
		                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
		                    <div>
		                      <label className="block text-sm font-bold text-amber-900 mb-2">題型比例（方程式 %）</label>
		                      <input
		                        value={rangerEquationPercentText}
		                        onChange={(e) => setRangerEquationPercentText(e.target.value)}
		                        className="w-full px-4 py-2 border-4 border-amber-300 rounded-2xl bg-white font-bold"
		                        inputMode="numeric"
		                      />
		                      <p className="text-xs text-gray-600 mt-1">其餘為計算題</p>
		                    </div>
		                    <div>
		                      <label className="block text-sm font-bold text-amber-900 mb-2">數字比例（小數 %）</label>
		                      <input
		                        value={rangerDecimalPercentText}
		                        onChange={(e) => setRangerDecimalPercentText(e.target.value)}
		                        className="w-full px-4 py-2 border-4 border-amber-300 rounded-2xl bg-white font-bold"
		                        inputMode="numeric"
		                      />
		                      <p className="text-xs text-gray-600 mt-1">其餘為分數（可混合出題）</p>
		                    </div>
		                  </div>

		                  <div>
		                    <label className="block text-sm font-bold text-amber-900 mb-2">運算範疇（可多選）</label>
		                    <div className="flex flex-wrap gap-2">
		                      {[
		                        { key: 'add', label: '加' },
		                        { key: 'sub', label: '減' },
		                        { key: 'mul', label: '乘' },
		                        { key: 'div', label: '除' },
		                        { key: 'paren', label: '加括號' }
		                      ].map((item) => {
		                        const active = (rangerOps as any)[item.key] as boolean;
		                        return (
		                          <button
		                            key={item.key}
		                            type="button"
		                            onClick={() => setRangerOps(prev => ({ ...prev, [item.key]: !active } as any))}
		                            className={`px-4 py-2 rounded-2xl border-2 font-black transition-colors ${active
		                              ? 'bg-amber-200 border-amber-500 text-amber-900'
		                              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
		                              }`}
		                          >
		                            {item.label}
		                          </button>
		                        );
		                      })}
		                    </div>
		                    {rangerAllowedOps.length === 0 && (
		                      <div className="mt-2 text-sm font-bold text-red-600">請至少選擇一種運算（加/減/乘/除）</div>
		                    )}
		                  </div>

		                  <div className="bg-white border-2 border-gray-200 rounded-2xl p-4 space-y-4">
		                    <div className="flex items-center justify-between gap-3 flex-wrap">
		                      <div>
		                        <div className="text-sm font-black text-amber-900">數字/方程式限制</div>
		                        <div className="text-xs text-gray-600">此設定會影響 AI 出題與學生輸入方式</div>
		                      </div>
		                      <button
		                        type="button"
		                        onClick={() => {
		                          setRangerAllowNegative((v) => {
		                            const next = !v;
		                            if (!next) {
		                              const minV = Number.parseInt(String(rangerMinValueText || '0').trim(), 10);
		                              if (Number.isFinite(minV) && minV < 0) setRangerMinValueText('0');
		                            }
		                            return next;
		                          });
		                        }}
		                        className={`px-4 py-2 rounded-2xl border-2 font-black ${rangerAllowNegative
		                          ? 'bg-[#A1D9AE] border-[#5E8B66] text-white'
		                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
		                          }`}
		                      >
		                        {rangerAllowNegative ? '允許負數' : '不允許負數'}
		                      </button>
		                    </div>

		                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
		                      <div>
		                        <label className="block text-xs font-bold text-gray-600 mb-1">數值範圍（最小）</label>
		                        <input
		                          value={rangerMinValueText}
		                          onChange={(e) => setRangerMinValueText(e.target.value)}
		                          className="w-full px-4 py-2 rounded-2xl border-2 border-gray-300 font-bold"
		                          inputMode="numeric"
		                        />
		                      </div>
		                      <div>
		                        <label className="block text-xs font-bold text-gray-600 mb-1">數值範圍（最大）</label>
		                        <input
		                          value={rangerMaxValueText}
		                          onChange={(e) => setRangerMaxValueText(e.target.value)}
		                          className="w-full px-4 py-2 rounded-2xl border-2 border-gray-300 font-bold"
		                          inputMode="numeric"
		                        />
		                      </div>
		                    </div>

		                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
		                      <div>
		                        <label className="block text-xs font-bold text-gray-600 mb-1">分母上限（分數題）</label>
		                        <input
		                          value={rangerMaxDenText}
		                          onChange={(e) => setRangerMaxDenText(e.target.value)}
		                          className="w-full px-4 py-2 rounded-2xl border-2 border-gray-300 font-bold"
		                          inputMode="numeric"
		                        />
		                      </div>
		                      <div>
		                        <label className="block text-xs font-bold text-gray-600 mb-1">小數位數上限（小數題）</label>
		                        <input
		                          value={rangerMaxDecimalPlacesText}
		                          onChange={(e) => setRangerMaxDecimalPlacesText(e.target.value)}
		                          className="w-full px-4 py-2 rounded-2xl border-2 border-gray-300 font-bold"
		                          inputMode="numeric"
		                        />
		                      </div>
		                      <div>
		                        <label className="block text-xs font-bold text-gray-600 mb-1">方程式步數（上限）</label>
		                        <select
		                          value={String(rangerEquationSteps)}
		                          onChange={(e) => setRangerEquationSteps(e.target.value === '2' ? 2 : 1)}
		                          className="w-full px-4 py-2 rounded-2xl border-2 border-gray-300 font-bold"
		                        >
		                          <option value="1">一步</option>
		                          <option value="2">最多兩步</option>
		                        </select>
		                      </div>
		                    </div>

		                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
		                      <div>
		                        <label className="block text-xs font-bold text-gray-600 mb-1">方程式答案類型</label>
		                        <select
		                          value={rangerEquationAnswerType}
		                          onChange={(e) => setRangerEquationAnswerType(e.target.value as any)}
		                          className="w-full px-4 py-2 rounded-2xl border-2 border-gray-300 font-bold"
		                        >
		                          <option value="int">只出整數</option>
		                          <option value="properFraction">只出真分數</option>
		                          <option value="decimal">只出小數</option>
		                          <option value="any">不限</option>
		                        </select>
		                      </div>
		                      <div>
		                        <label className="block text-xs font-bold text-gray-600 mb-1">AI 額外要求（可選）</label>
		                        <input
		                          value={rangerPromptText}
		                          onChange={(e) => setRangerPromptText(e.target.value)}
		                          className="w-full px-4 py-2 rounded-2xl border-2 border-gray-300 font-bold"
		                          placeholder="例如：多用括號；避免除法..."
		                        />
		                      </div>
		                    </div>
		                  </div>
		                </>
		              )}

		              <div className="flex gap-4 pt-4 border-t-2 border-gray-100">
		                <button
		                  onClick={() => void cancelGameDraftEditor()}
		                  className="flex-1 py-3 rounded-2xl border-4 border-gray-300 text-gray-600 font-bold hover:bg-gray-100"
		                >
		                  取消
		                </button>
		                <button
		                  onClick={() => {
		                    if (gameDraftReadOnly) return;
		                    if (!String(rangerForm.title || '').trim()) return alert('請輸入標題');
		                    setGameWizardMode('save');
		                    setGameWizardOpen(true);
		                  }}
		                  disabled={gameDraftReadOnly}
		                  className="flex-1 py-3 rounded-2xl border-4 border-amber-600 bg-white text-amber-900 font-bold hover:bg-amber-50 disabled:opacity-60"
		                >
		                  儲存
		                </button>
		                <button
		                  onClick={() => {
		                    if (!String(rangerForm.title || '').trim()) return alert('請輸入標題');
		                    setGameWizardMode('publish');
		                    setGameWizardOpen(true);
		                  }}
		                  className="flex-1 py-3 rounded-2xl border-4 border-amber-600 bg-amber-600 text-white font-bold hover:bg-amber-700"
		                >
		                  儲存及派發
		                </button>
		              </div>
	            </div>
	          </div>
	        </div>
	      )}

	      {/* Math Game Creation Modal */}
	      {showGameModal && gameType === 'math' && (
	        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
	          <div className="bg-white border-4 border-sky-400 rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-comic">
	            <div className="p-6 border-b-4 border-sky-400 bg-gradient-to-r from-sky-100 to-blue-200">
	              <div className="flex justify-between items-center">
	                <div className="flex items-center gap-3">
	                  <span className="text-3xl">🧮</span>
	                  <h2 className="text-3xl font-black text-sky-900">創建數學測驗</h2>
	                </div>
	                <button
	                  onClick={() => { setShowGameModal(false); setGameType(null); }}
	                  className="w-10 h-10 rounded-full bg-white border-2 border-sky-400 hover:bg-sky-50 flex items-center justify-center"
	                >
	                  <X className="w-6 h-6 text-sky-800" />
	                </button>
	              </div>
	            </div>

	            <div className="p-6 space-y-6">
	              <div className="bg-sky-50 p-4 rounded-xl border-2 border-sky-200">
	                <p className="text-sky-900 text-sm">
	                  🧮 <strong>重點：</strong>算式必須顯示正確數學符號（＋ − × ÷），分數以「上下」顯示；方程式未知數用「□」。
	                </p>
	              </div>

	              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
	                <Input
	                  label="測驗標題"
	                  placeholder="輸入測驗標題..."
	                  value={mathForm.title}
	                  onChange={(e) => setMathForm(prev => ({ ...prev, title: e.target.value }))}
	                />

	                <div>
	                  <label className="block text-sm font-bold text-sky-900 mb-2">年級（AI 生成難度參考）</label>
	                  <select
	                    className="w-full px-4 py-2 border-4 border-sky-300 rounded-2xl bg-white font-bold"
	                    value={mathGrade}
	                    onChange={(e) => setMathGrade(e.target.value as any)}
	                  >
	                    {['小一', '小二', '小三', '小四', '小五', '小六'].map(g => (
	                      <option key={g} value={g}>{g}</option>
	                    ))}
	                  </select>
	                </div>
	              </div>

	              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
	                <div>
	                  <label className="block text-sm font-bold text-sky-900 mb-2">模式</label>
	                  <div className="flex flex-wrap gap-2">
	                    <button
	                      type="button"
	                      onClick={() => setMathAnswerMode('mcq')}
	                      className={`px-4 py-2 rounded-2xl border-2 font-black ${mathAnswerMode === 'mcq'
	                        ? 'bg-[#A1D9AE] border-[#5E8B66] text-white'
	                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
	                        }`}
	                    >
	                      四選一
	                    </button>
	                    <button
	                      type="button"
	                      onClick={() => setMathAnswerMode('input')}
	                      className={`px-4 py-2 rounded-2xl border-2 font-black ${mathAnswerMode === 'input'
	                        ? 'bg-[#A1D9AE] border-[#5E8B66] text-white'
	                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
	                        }`}
	                    >
	                      輸入答案
	                    </button>
	                  </div>
	                  <p className="text-xs text-gray-600 mt-1">
	                    四選一會自動產生 4 個選項；輸入答案會按「分數/小數」模式限制輸入方式。
	                  </p>
	                </div>

	                <div>
	                  <label className="block text-sm font-bold text-sky-900 mb-2">題目類型</label>
	                  <div className="flex flex-wrap gap-2">
	                    <button
	                      type="button"
	                      onClick={() => {
	                        setMathQuestionType('calc');
	                        setMathGameTab('manual');
	                        setMathDrafts(Array.from({ length: mathQuestionCount }, () => ({ kind: 'expr', tokens: [] })));
	                      }}
	                      className={`px-4 py-2 rounded-2xl border-2 font-black ${mathQuestionType === 'calc'
	                        ? 'bg-[#A1D9AE] border-[#5E8B66] text-white'
	                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
	                        }`}
	                    >
	                      計算
	                    </button>
	                    <button
	                      type="button"
	                      onClick={() => {
	                        setMathQuestionType('equation');
	                        setMathGameTab('manual');
	                        setMathDrafts(Array.from({ length: mathQuestionCount }, () => ({ kind: 'eq', equation: '' })));
	                      }}
	                      className={`px-4 py-2 rounded-2xl border-2 font-black ${mathQuestionType === 'equation'
	                        ? 'bg-[#A1D9AE] border-[#5E8B66] text-white'
	                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
	                        }`}
	                    >
	                      方程式（□）
	                    </button>
	                  </div>
	                  <p className="text-xs text-gray-600 mt-1">
	                    方程式模式只支援一個未知數 `□`，學生輸入 `□` 的值。
	                  </p>
	                </div>

	                <div>
	                  <label className="block text-sm font-bold text-sky-900 mb-2">題目數量</label>
	                  <input
	                    value={String(mathQuestionCount)}
	                    onChange={(e) => {
	                      const n = Number.parseInt(String(e.target.value || '').trim(), 10);
	                      if (!Number.isFinite(n)) return;
	                      const next = Math.max(1, Math.min(50, n));
	                      if (next < mathQuestionCount) {
	                        const willDrop = mathDrafts.slice(next).some((d) => (
	                          d.kind === 'expr'
	                            ? (d.tokens || []).length > 0
	                            : Boolean(String(d.equation || '').trim())
	                        ));
	                        if (willDrop && !confirm('減少題目數量會刪除後面的題目內容，確定要繼續嗎？')) return;
	                      }
	                      setMathQuestionCount(next);
	                    }}
	                    className="w-full px-4 py-2 border-4 border-sky-300 rounded-2xl bg-white font-bold"
	                    inputMode="numeric"
	                  />
	                  <p className="text-xs text-gray-600 mt-1">範圍 1–50</p>
	                </div>
	              </div>

	              <div>
	                <label className="block text-sm font-bold text-sky-900 mb-2">運算範疇（可多選）</label>
	                <div className="flex flex-wrap gap-2">
	                  {[
	                    { key: 'add', label: '加' },
	                    { key: 'sub', label: '減' },
	                    { key: 'mul', label: '乘' },
	                    { key: 'div', label: '除' },
	                    { key: 'paren', label: '加括號' }
	                  ].map((item) => {
	                    const active = (mathOps as any)[item.key] as boolean;
	                    return (
	                      <button
	                        key={item.key}
	                        type="button"
	                        onClick={() => setMathOps(prev => ({ ...prev, [item.key]: !active } as any))}
	                        className={`px-4 py-2 rounded-2xl border-2 font-black transition-colors ${active
	                          ? 'bg-sky-200 border-sky-500 text-sky-900'
	                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
	                          }`}
	                      >
	                        {item.label}
	                      </button>
	                    );
	                  })}

	                  <button
	                    type="button"
	                    onClick={() => setMathNumberMode('fraction')}
	                    className={`px-4 py-2 rounded-2xl border-2 font-black transition-colors ${mathNumberMode === 'fraction'
	                      ? 'bg-sky-200 border-sky-500 text-sky-900'
	                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
	                      }`}
	                  >
	                    分數
	                  </button>
	                  <button
	                    type="button"
	                    onClick={() => setMathNumberMode('decimal')}
	                    className={`px-4 py-2 rounded-2xl border-2 font-black transition-colors ${mathNumberMode === 'decimal'
	                      ? 'bg-sky-200 border-sky-500 text-sky-900'
	                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
	                      }`}
	                  >
	                    小數
	                  </button>
	                </div>
	                {mathAllowedOps.length === 0 && (
	                  <div className="mt-2 text-sm font-bold text-red-600">請至少選擇一種運算（加/減/乘/除）</div>
	                )}
	              </div>

	              <div className="bg-white border-2 border-gray-200 rounded-2xl p-4">
	                <div className="flex items-center justify-between gap-3 flex-wrap">
	                  <div>
	                    <div className="text-sm font-black text-sky-900">數字設定</div>
	                    <div className="text-xs text-gray-600">此設定會影響手動驗證、AI 生成、學生輸入方式</div>
	                  </div>
	                  <button
	                    type="button"
	                    onClick={() => {
	                      setMathAllowNegative((v) => {
	                        const next = !v;
	                        if (next) {
	                          const maxV = Number.parseInt(String(mathMaxValueText || '').trim(), 10);
	                          if (Number.isFinite(maxV) && maxV > 0 && Number.parseInt(String(mathMinValueText || '0').trim(), 10) >= 0) {
	                            setMathMinValueText(String(-Math.abs(maxV)));
	                          }
	                        } else {
	                          const minV = Number.parseInt(String(mathMinValueText || '0').trim(), 10);
	                          if (Number.isFinite(minV) && minV < 0) setMathMinValueText('0');
	                        }
	                        return next;
	                      });
	                    }}
	                    className={`px-4 py-2 rounded-2xl border-2 font-black ${mathAllowNegative
	                      ? 'bg-[#A1D9AE] border-[#5E8B66] text-white'
	                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
	                      }`}
	                  >
	                    {mathAllowNegative ? '允許負數' : '不允許負數'}
	                  </button>
	                </div>

	                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
	                  <div>
	                    <label className="block text-xs font-bold text-gray-600 mb-1">數值範圍（最小）</label>
	                    <input
	                      value={mathMinValueText}
	                      onChange={(e) => setMathMinValueText(e.target.value)}
	                      className="w-full px-4 py-2 rounded-2xl border-2 border-gray-300 font-bold"
	                      inputMode="numeric"
	                    />
	                  </div>
	                  <div>
	                    <label className="block text-xs font-bold text-gray-600 mb-1">數值範圍（最大）</label>
	                    <input
	                      value={mathMaxValueText}
	                      onChange={(e) => setMathMaxValueText(e.target.value)}
	                      className="w-full px-4 py-2 rounded-2xl border-2 border-gray-300 font-bold"
	                      inputMode="numeric"
	                    />
	                  </div>

	                  {mathNumberMode === 'fraction' ? (
	                    <div>
	                      <label className="block text-xs font-bold text-gray-600 mb-1">最大分母</label>
	                      <input
	                        value={mathMaxDenText}
	                        onChange={(e) => setMathMaxDenText(e.target.value)}
	                        className="w-full px-4 py-2 rounded-2xl border-2 border-gray-300 font-bold"
	                        inputMode="numeric"
	                      />
	                    </div>
	                  ) : (
	                    <div>
	                      <label className="block text-xs font-bold text-gray-600 mb-1">小數位數（最多）</label>
	                      <input
	                        value={mathMaxDecimalPlacesText}
	                        onChange={(e) => setMathMaxDecimalPlacesText(e.target.value)}
	                        className="w-full px-4 py-2 rounded-2xl border-2 border-gray-300 font-bold"
	                        inputMode="numeric"
	                      />
	                    </div>
	                  )}
	                </div>

	                {mathQuestionType === 'equation' && (
	                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
	                    <div>
	                      <label className="block text-xs font-bold text-gray-600 mb-1">方程式步數</label>
	                      <select
	                        value={String(mathEquationSteps)}
	                        onChange={(e) => setMathEquationSteps(e.target.value === '2' ? 2 : 1)}
	                        className="w-full px-4 py-2 rounded-2xl border-2 border-gray-300 font-bold bg-white"
	                      >
	                        <option value="1">一步</option>
	                        <option value="2">兩步</option>
	                      </select>
	                    </div>
	                    <div>
	                      <label className="block text-xs font-bold text-gray-600 mb-1">答案限制</label>
	                      <select
	                        value={mathEquationAnswerType}
	                        onChange={(e) => setMathEquationAnswerType(e.target.value as any)}
	                        className="w-full px-4 py-2 rounded-2xl border-2 border-gray-300 font-bold bg-white"
	                      >
	                        <option value="any">不限</option>
	                        <option value="int">只出整數</option>
	                        <option value="properFraction" disabled={mathNumberMode === 'decimal'}>只出真分數</option>
	                        <option value="decimal" disabled={mathNumberMode === 'fraction'}>只出小數</option>
	                      </select>
	                    </div>
	                  </div>
	                )}
	              </div>

		              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
		                <div className="bg-white border-2 border-gray-200 rounded-2xl p-4">
		                  <div className="flex items-center justify-between gap-3">
	                    <div>
	                      <div className="text-sm font-black text-sky-900">限時（可選）</div>
	                      <div className="text-xs text-gray-600">10–600 秒</div>
	                    </div>
	                    <button
	                      type="button"
	                      onClick={() => setMathTimeEnabled(v => !v)}
	                      className={`px-4 py-2 rounded-2xl border-2 font-black ${mathTimeEnabled
	                        ? 'bg-[#A1D9AE] border-[#5E8B66] text-white'
	                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
	                        }`}
	                    >
	                      {mathTimeEnabled ? '已啟用' : '未啟用'}
	                    </button>
	                  </div>
	                  {mathTimeEnabled && (
	                    <div className="mt-3">
	                      <input
	                        value={mathTimeSecondsText}
	                        onChange={(e) => setMathTimeSecondsText(e.target.value)}
	                        onBlur={() => setMathTimeSeconds(clampTowerDefenseTimeSeconds(mathTimeSecondsText, mathTimeSeconds))}
	                        className="w-full px-4 py-2 rounded-2xl border-2 border-gray-300 font-bold"
	                        inputMode="numeric"
	                      />
	                    </div>
	                  )}
	                </div>
	              </div>

	              <div className="bg-white border-2 border-gray-200 rounded-2xl p-4">
	                <div className="flex items-center justify-between gap-3 flex-wrap">
	                  <div className="flex items-center gap-2">
	                    <button
	                      type="button"
	                      onClick={() => setMathGameTab('manual')}
	                      className={`px-4 py-2 rounded-2xl border-2 font-black ${mathGameTab === 'manual'
	                        ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown'
	                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
	                        }`}
	                    >
	                      手動輸入
	                    </button>
	                    <button
	                      type="button"
	                      onClick={() => setMathGameTab('ai')}
	                      className={`px-4 py-2 rounded-2xl border-2 font-black ${mathGameTab === 'ai'
	                        ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown'
	                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
	                        }`}
	                    >
	                      AI 生成
	                    </button>
	                  </div>

	                  <div className="text-xs text-gray-600">
	                    {mathGameTab === 'manual'
	                      ? (mathQuestionType === 'equation' ? '手動輸入方程式（未知數用 □）' : '用按鈕建立算式（支援分數/括號）')
	                      : '按設定自動生成，之後仍可手動微調'}
	                  </div>
	                </div>
	              </div>

	              {mathGameTab === 'ai' && (
	                <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 space-y-3">
	                  <div>
	                    <label className="block text-sm font-bold text-sky-900 mb-2">AI 額外要求（可選）</label>
	                    <textarea
	                      value={mathPromptText}
	                      onChange={(e) => setMathPromptText(e.target.value)}
	                      className="w-full min-h-[56px] px-4 py-3 border-2 border-sky-200 rounded-2xl bg-white font-bold focus:outline-none focus:border-sky-400"
	                      placeholder="例如：避免負數；加括號多一些；題目難度提高..."
	                    />
	                  </div>
	                  {mathAiError && (
	                    <div className="text-sm font-bold text-red-600">{mathAiError}</div>
	                  )}
	                  <div className="flex items-center gap-3">
	                    <button
	                      type="button"
	                      onClick={async () => {
	                        try {
	                          setMathAiError('');
	                          if (mathAllowedOps.length === 0) return;
	                          setMathAiLoading(true);
	                          if (mathQuestionType === 'equation') {
	                            const resp = await authService.generateMathEquationQuestions({
	                              grade: mathGrade,
	                              count: mathQuestionCount,
	                              allowedOps: mathAllowedOps,
	                              allowParentheses: mathOps.paren,
	                              numberMode: mathNumberMode,
	                              allowNegative: mathAllowNegative,
	                              minValue: mathConstraints.minValue,
	                              maxValue: mathConstraints.maxValue,
	                              maxDen: mathConstraints.maxDen,
	                              maxDecimalPlaces: mathConstraints.maxDecimalPlaces,
	                              equationSteps: mathConstraints.equationSteps,
	                              equationAnswerType: mathConstraints.equationAnswerType,
	                              promptText: mathPromptText
	                            });
	                            const qs = Array.isArray(resp?.questions) ? resp.questions : [];
	                            setMathDrafts(qs.map((q: any) => ({ kind: 'eq', equation: String(q?.equation || '').trim() })));
	                          } else {
	                            const resp = await authService.generateMathQuestions({
	                              grade: mathGrade,
	                              count: mathQuestionCount,
	                              allowedOps: mathAllowedOps,
	                              allowParentheses: mathOps.paren,
	                              answerMode: mathAnswerMode,
	                              numberMode: mathNumberMode,
	                              allowNegative: mathAllowNegative,
	                              minValue: mathConstraints.minValue,
	                              maxValue: mathConstraints.maxValue,
	                              maxDen: mathConstraints.maxDen,
	                              maxDecimalPlaces: mathConstraints.maxDecimalPlaces,
	                              promptText: mathPromptText
	                            });
	                            const qs = Array.isArray(resp?.questions) ? resp.questions : [];
	                            setMathDrafts(qs.map((q: any) => ({ kind: 'expr', tokens: Array.isArray(q.tokens) ? q.tokens : [] })));
	                          }
	                        } catch (e: any) {
	                          setMathAiError(e?.message || 'AI 生成失敗');
	                        } finally {
	                          setMathAiLoading(false);
	                        }
	                      }}
	                      disabled={mathAiLoading || mathAllowedOps.length === 0}
	                      className="px-5 py-3 rounded-2xl bg-[#A1D9AE] border-2 border-[#5E8B66] text-white font-black hover:bg-[#8BC7A0] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
	                    >
	                      <Bot className="w-5 h-5" />
	                      {mathAiLoading ? '生成中...' : 'AI 生成題目'}
	                    </button>
	                    <div className="text-xs text-gray-600">生成後可於下方逐題調整</div>
	                  </div>

	                  <div className="bg-white/70 border-2 border-sky-200 rounded-2xl p-3 flex items-center justify-between gap-3 flex-wrap">
	                    <div className="text-sm font-black text-sky-900">
	                      快速檢查：{invalidMathDraftIndexes.length === 0 ? '全部符合設定 ✅' : `有 ${invalidMathDraftIndexes.length} 題不合格`}
	                    </div>
	                    <button
	                      type="button"
	                      onClick={regenerateInvalidMathDrafts}
	                      disabled={mathAiLoading || invalidMathDraftIndexes.length === 0}
	                      className="px-4 py-2 rounded-2xl bg-white border-2 border-sky-300 text-sky-900 font-black hover:bg-sky-50 disabled:opacity-50 disabled:cursor-not-allowed"
	                    >
	                      重新生成不合格題目
	                    </button>
	                  </div>
	                </div>
	              )}

	              <div className="space-y-4">
	                {mathDrafts.length === 0 ? (
	                  <div className="text-center py-8 text-gray-400 font-bold border-4 border-dashed border-sky-200 rounded-3xl">
	                    還沒有題目，請先設定題目數量或使用 AI 生成 🧮
	                  </div>
	                ) : (
	                  <div className="space-y-6">
	                    {mathDrafts.map((q, idx) => (
	                      <div key={idx} className="bg-white border-4 border-sky-200 rounded-3xl p-5">
	                        <div className="flex items-center justify-between gap-3 mb-3">
	                          <div className="text-lg font-black text-sky-900">第 {idx + 1} 題</div>
	                          <button
	                            type="button"
	                            onClick={() => {
	                              if (!confirm('確定刪除此題嗎？')) return;
	                              setMathDrafts(prev => {
	                                const next = prev.filter((_, i) => i !== idx);
	                                const ensured = next.length > 0
	                                  ? next
	                                  : [mathQuestionType === 'equation' ? { kind: 'eq', equation: '' } : { kind: 'expr', tokens: [] }];
	                                setMathQuestionCount(Math.max(1, ensured.length));
	                                return ensured;
	                              });
	                            }}
	                            className="p-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200"
	                            title="刪除"
	                          >
	                            <Trash className="w-4 h-4" />
	                          </button>
	                        </div>

	                        {q.kind === 'eq' ? (
	                          <MathEquationBuilder
	                            equation={q.equation || ''}
	                            onChange={(next) => setMathDrafts(prev => prev.map((row, i) => i === idx ? ({ kind: 'eq', equation: next } as any) : row))}
	                            allowedOps={mathAllowedOps}
	                            allowParentheses={mathOps.paren}
	                            constraints={mathConstraints}
	                          />
	                        ) : (
	                          <MathExpressionBuilder
	                            tokens={q.tokens || []}
	                            onChange={(next) => setMathDrafts(prev => prev.map((row, i) => i === idx ? ({ kind: 'expr', tokens: next } as any) : row))}
	                            allowedOps={mathAllowedOps}
	                            allowParentheses={mathOps.paren}
	                            constraints={mathConstraints}
	                          />
	                        )}
	                      </div>
	                    ))}
	                  </div>
	                )}

	                <div className="flex items-center justify-between gap-3 flex-wrap">
	                  <button
	                    type="button"
	                    onClick={() => setMathQuestionCount(c => Math.min(50, c + 1))}
	                    disabled={mathDrafts.length >= 50}
	                    className="px-4 py-2 bg-sky-100 text-sky-900 border-2 border-sky-300 rounded-2xl font-black hover:bg-sky-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
	                  >
	                    <Plus className="w-4 h-4" />
	                    新增題目
	                  </button>

	                  <div className="text-xs text-gray-600">
	                    已有 {mathDrafts.length} 題
	                  </div>
	                </div>
	              </div>

		              <div className="flex gap-4 pt-4 border-t-2 border-gray-100">
		                <button
		                  onClick={() => void cancelGameDraftEditor()}
		                  className="flex-1 py-3 rounded-2xl border-4 border-gray-300 text-gray-600 font-bold hover:bg-gray-100"
		                >
		                  取消
		                </button>
		                <button
		                  onClick={() => {
		                    if (gameDraftReadOnly) return;
		                    if (!String(mathForm.title || '').trim()) return alert('請輸入標題');
		                    setGameWizardMode('save');
		                    setGameWizardOpen(true);
		                  }}
		                  disabled={gameDraftReadOnly}
		                  className="flex-1 py-3 rounded-2xl border-4 border-sky-600 bg-white text-sky-900 font-bold hover:bg-sky-50 disabled:opacity-60"
		                >
		                  儲存
		                </button>
		                <button
		                  onClick={() => {
		                    if (!String(mathForm.title || '').trim()) return alert('請輸入標題');
		                    setGameWizardMode('publish');
		                    setGameWizardOpen(true);
		                  }}
		                  className="flex-1 py-3 rounded-2xl border-4 border-sky-600 bg-sky-600 text-white font-black hover:bg-sky-700"
		                >
		                  儲存及派發
		                </button>
		              </div>
		            </div>
		          </div>
		        </div>
		      )}

	      {/* Discussion Creation Modal */}
	      {
	        showDiscussionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-comic">
              <div className="p-6 border-b-4 border-brand-brown bg-[#F8C5C5]">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-black text-brand-brown">創建討論串</h2>
                  <button
                    onClick={() => {
                      setShowDiscussionModal(false);
                      resetDiscussionEditor();
                    }}
                    className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                  >
                    <X className="w-6 h-6 text-brand-brown" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Basic Info */}
                {discussionDraftReadOnly && (
                  <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl text-sm text-gray-700 font-bold">
                    共用草稿（唯讀）：你可以直接「儲存及派發」，但不可修改內容。如需修改請先在教師資料夾按「複製到我的」。
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="討論串標題"
                    placeholder="輸入討論串標題..."
                    value={discussionForm.title}
                    onChange={(e) => setDiscussionForm(prev => ({ ...prev, title: e.target.value }))}
                    disabled={discussionDraftReadOnly}
                  />
                  <div>
                    <label className="block text-sm font-bold text-brand-brown mb-2">選擇科目</label>
                    <select
                      className="w-full px-4 py-2 border-4 border-brand-brown rounded-2xl bg-white font-bold"
                      value={discussionForm.subject}
                      onChange={(e) => {
                        const newSubject = e.target.value as Subject;
                        setDiscussionForm(prev => ({ ...prev, subject: newSubject }));
                      }}
                      disabled={discussionDraftReadOnly}
                    >
                      {VISIBLE_SUBJECTS.map(subject => (
                        <option key={subject} value={subject}>{subject}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Rich Text Editor */}
                <div>
                  <label className="block text-sm font-bold text-brand-brown mb-2">討論串內容</label>

                  {/* Editor Toolbar */}
                  <div className={`border-2 border-gray-300 rounded-t-xl p-3 bg-gray-50 flex flex-wrap gap-2 items-center ${discussionDraftReadOnly ? 'opacity-60 pointer-events-none' : ''}`}>
                    {/* 格式化按鈕 */}
                    <button
                      type="button"
                      onClick={formatBold}
                      className="w-8 h-8 bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center justify-center"
                      title="粗體 (B)"
                    >
                      <Bold className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={formatItalic}
                      className="w-8 h-8 bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center justify-center"
                      title="斜體 (I)"
                    >
                      <Italic className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={formatUnderline}
                      className="w-8 h-8 bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center justify-center"
                      title="底線 (U)"
                    >
                      <Underline className="w-4 h-4" />
                    </button>

                    <div className="w-px h-6 bg-gray-400 mx-1"></div>

                    {/* 字體大小 */}
                    <div className="flex items-center gap-1">
                      <Type className="w-4 h-4 text-gray-600" />
                      <select
                        value={currentFontSize}
                        onChange={(e) => changeFontSize(e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
                      >
                        <option value="12">12px</option>
                        <option value="14">14px</option>
                        <option value="16">16px</option>
                        <option value="18">18px</option>
                        <option value="20">20px</option>
                        <option value="24">24px</option>
                        <option value="28">28px</option>
                        <option value="32">32px</option>
                      </select>
                    </div>

                    {/* 文字顏色 */}
                    <div className="flex items-center gap-1">
                      <Palette className="w-4 h-4 text-gray-600" />
                      <input
                        type="color"
                        value={currentTextColor}
                        onChange={(e) => changeTextColor(e.target.value)}
                        className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                        title="文字顏色"
                      />
                    </div>

                    <div className="w-px h-6 bg-gray-400 mx-1"></div>

                    {/* 圖片上傳 */}
                    <label className="flex items-center gap-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm font-bold cursor-pointer">
                      <Upload className="w-4 h-4" />
                      上傳圖片
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>

                    {/* 插入連結 */}
                    <button
                      type="button"
                      onClick={insertLink}
                      className="flex items-center gap-1 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 text-sm font-bold"
                    >
                      <Link className="w-4 h-4" />
                      插入連結
                    </button>
                  </div>

                  {/* Rich Text Editor */}
                  <div
                    ref={setEditorRef}
                    contentEditable={!discussionDraftReadOnly}
                    suppressContentEditableWarning
                    className="w-full min-h-[300px] px-4 py-3 border-2 border-t-0 border-gray-300 rounded-b-xl bg-white font-sans text-sm leading-relaxed focus:outline-none"
                    style={{ fontSize: currentFontSize + 'px', color: currentTextColor }}
                    onPaste={(e) => {
                      if (discussionDraftReadOnly) return;
                      const plain = e.clipboardData?.getData('text/plain') || '';
                      const html = e.clipboardData?.getData('text/html') || '';
                      const candidate = plain || html;
                      if (!looksLikeExecutableHtml(candidate)) return;
                      if (candidate.length > MAX_LPEDIA_HTML_PREVIEW_CHARS) {
                        const ok = confirm('HTML 內容過大，可能導致學生端載入變慢。仍要插入可執行預覽嗎？');
                        if (!ok) return;
                      }
                      e.preventDefault();
                      try {
                        document.execCommand('insertHTML', false, buildHtmlPreviewPlaceholder(candidate));
                      } catch {
                        document.execCommand('insertText', false, candidate);
                      }
                      if (editorRef) {
                        setDiscussionForm(prev => ({
                          ...prev,
                          content: editorRef.innerHTML
                        }));
                      }
                    }}
                    onInput={(e) => {
                      if (discussionDraftReadOnly) return;
                      const target = e.target as HTMLDivElement;
                      setDiscussionForm(prev => ({
                        ...prev,
                        content: target.innerHTML
                      }));
                    }}
                    placeholder="開始輸入內容..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4 border-t-2 border-gray-200">
                  <Button
                    className="flex-1 bg-gray-300 text-gray-700 hover:bg-gray-400"
                    onClick={async () => {
                      const isOwner = String(discussionDraftMeta?.ownerTeacherId || user?.id || '') === String(user?.id || '');
                      const canDelete = !!discussionDraftId && isOwner && !discussionDraftReadOnly;
                      if (canDelete) {
                        const ok = window.confirm('取消＝刪除草稿。確定要刪除嗎？');
                        if (!ok) return;
                        try {
                          await authService.deleteDraft(discussionDraftId);
                          alert('草稿已刪除');
                        } catch (e: any) {
                          alert(e?.message || '刪除失敗');
                          return;
                        }
                      }
                      setShowDiscussionModal(false);
                      resetDiscussionEditor();
                    }}
                  >
                    取消
                  </Button>
                  <Button
                    className="flex-1 bg-white text-brand-brown hover:bg-gray-50 border-brand-brown"
                    onClick={() => {
                      const title = String(discussionForm.title || '').trim();
                      if (!title) return alert('請輸入標題');
                      if (discussionDraftReadOnly) return;
                      setDiscussionWizardMode('save');
                      setDiscussionWizardOpen(true);
                    }}
                    disabled={discussionDraftReadOnly}
                  >
                    儲存
                  </Button>
                  <Button
                    className="flex-1 bg-[#F8C5C5] text-brand-brown hover:bg-[#F0B5B5] border-brand-brown"
                    onClick={() => {
                      const title = String(discussionForm.title || '').trim();
                      if (!title) return alert('請輸入標題');
                      const safe = sanitizeHtml(discussionForm.content || '');
                      if (!safe.trim()) return alert('請輸入討論串內容');
                      setDiscussionWizardMode('publish');
                      setDiscussionWizardOpen(true);
                    }}
                  >
                    儲存及派發
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )
      }

		      {/* Assignment Management Modal */}
	          {showAssignmentModal && (
	            <AssignmentExplorerModal
	              open={showAssignmentModal}
	              onClose={() => setShowAssignmentModal(false)}
	              authService={authService}
	              viewerRole="teacher"
	              viewerId={String(user?.id || '')}
	            />
	          )}

	          {showNoteDraftModal && (
	            <NoteEditorModal
	              ref={noteEditorRef}
	              open={showNoteDraftModal}
	              onClose={() => setShowNoteDraftModal(false)}
	              authService={authService}
	              mode="draft"
	              viewerId={String(user?.id || '')}
	              viewerRole="teacher"
	              draftId={noteDraftId || undefined}
	              draftReadOnly={noteDraftReadOnly}
	              draftTitle={noteDraftForm.title}
	              draftSubject={noteDraftForm.subject}
	              draftSnapshot={noteDraftSnapshot}
	              onDraftTitleChange={(next) => setNoteDraftForm((prev) => ({ ...prev, title: next }))}
	              onDraftSubjectChange={(next) => setNoteDraftForm((prev) => ({ ...prev, subject: next }))}
	              onDraftCancel={() => void cancelNoteDraftEditor()}
	              onDraftSave={() => {
	                const title = String(noteDraftForm.title || '').trim();
	                if (!title) return alert('請輸入標題');
	                setNoteWizardMode('save');
	                setNoteWizardOpen(true);
	              }}
	              onDraftSaveAndPublish={() => {
	                const title = String(noteDraftForm.title || '').trim();
	                if (!title) return alert('請輸入標題');
	                setNoteWizardMode('publish');
	                setNoteWizardOpen(true);
	              }}
	            />
	          )}
	
			      {
			        showAssignmentModal && false && (
			          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
		            <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-comic">
	              <div className="p-6 border-b-4 border-brand-brown bg-[#C0E2BE]">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-black text-brand-brown">作業管理</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowTemplateLibrary(true)}
                      className="px-4 py-2 rounded-xl bg-white border-2 border-brand-brown hover:bg-gray-100 font-black text-brand-brown"
                      title="我的題庫 / 教師共用空間（模板）"
                    >
                      題目庫
                    </button>
                    <button
                      onClick={() => setShowClassFolderManager(true)}
                      className="px-4 py-2 rounded-xl bg-white border-2 border-brand-brown hover:bg-gray-100 font-black text-brand-brown"
                      title="管理：班別 → 學段 → 課題 → 子folder(可選)"
                    >
                      班級資料夾
                    </button>
                    <button
                      onClick={() => {
                        setShowAssignmentModal(false);
                        setSelectedAssignment(null);
                        setAssignmentResponses([]);
                      }}
                      className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                    >
                      <X className="w-6 h-6 text-brand-brown" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {!selectedAssignment ? (
                  // 作業列表視圖
                  <div>
                    {/* 篩選區域 */}
                    <div className="mb-6 p-4 bg-gray-50 rounded-2xl border-2 border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Filter className="w-5 h-5 text-gray-600" />
                          <h3 className="font-bold text-gray-700">篩選條件</h3>
                        </div>
		                        <div className="flex gap-2">
		                          <button
		                            onClick={() => {
		                              setIsSelectMode(!isSelectMode);
		                              setSelectedAssignments([]);
	                            }}
                            className={`px-4 py-2 rounded-xl font-bold border-2 transition-colors ${isSelectMode
                              ? 'bg-blue-500 text-white border-blue-600'
                              : 'bg-white text-gray-600 border-gray-300 hover:border-blue-500'
                              }`}
                          >
                            {isSelectMode ? '取消選取' : '多選刪除'}
                          </button>
                          {isSelectMode && (
                            <>
                              <button
                                onClick={() => setSelectedAssignments(displayedDeletableAssignmentKeys)}
                                className="px-4 py-2 bg-white text-gray-700 rounded-xl font-bold border-2 border-gray-300 hover:border-blue-500"
                              >
                                全選
                              </button>
                              <button
                                onClick={() => setSelectedAssignments([])}
                                className="px-4 py-2 bg-white text-gray-700 rounded-xl font-bold border-2 border-gray-300 hover:border-blue-500"
                              >
                                全不選
                              </button>
                            </>
                          )}
                          {isSelectMode && selectedAssignments.length > 0 && (
                            <button
                              onClick={async () => {
                                if (confirm(`確定要刪除選取的 ${selectedAssignments.length} 個項目嗎？`)) {
                                  try {
                                    for (const key of selectedAssignments) {
                                      const parsed = parseTaskKey(key);
                                      if (!parsed) continue;
                                      if (parsed.type === 'quiz') await authService.deleteQuiz(parsed.id);
                                      else if (parsed.type === 'game') await authService.deleteGame(parsed.id);
                                      else if (parsed.type === 'ai-bot') await authService.deleteBotTask(parsed.id);
                                      else await authService.deleteAssignment(parsed.id);
                                    }
                                    alert('刪除成功！');
                                    setSelectedAssignments([]);
                                    setIsSelectMode(false);
                                    loadAssignments();
                                  } catch (error) {
                                    alert('刪除失敗：' + (error instanceof Error ? error.message : '未知錯誤'));
                                  }
                                }
                              }}
                              className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold border-2 border-red-600 hover:bg-red-600"
                            >
                              刪除選取 ({selectedAssignments.length})
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-gray-600 mb-2">科目</label>
                          <select
                            value={filterSubject}
                            onChange={(e) => {
                              setFilterSubject(e.target.value);
                            }}
                            className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl"
                          >
                            <option value="">全部科目</option>
                            {availableSubjects.map(subject => (
                              <option key={subject} value={subject}>{subject}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-600 mb-2">班級</label>
                          <select
                            value={filterClass}
                            onChange={(e) => {
                              setFilterClass(e.target.value);
                            }}
                            className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl"
                          >
                            <option value="">全部班級</option>
                            {availableClasses.map(className => (
                              <option key={className} value={className}>{className}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-600 mb-2">分組</label>
                          <select
                            value={filterGroup}
                            onChange={(e) => {
                              setFilterGroup(e.target.value);
                            }}
                            className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl"
                          >
                            <option value="">全部分組</option>
                            {filterGroupOptions.map(group => (
                              <option key={group} value={group}>{group}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={() => {
                              setFilterSubject('');
                              setFilterClass('');
                              setFilterGroup('');
                            }}
                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl border-2 border-gray-300 font-bold"
                          >
                            清除篩選
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 作業列表 */}
                    <div className="space-y-4">
                      {loading ? (
                        <div className="text-center py-12">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-brown mx-auto mb-4"></div>
                          <p className="text-brand-brown font-bold">載入中...</p>
                        </div>
	                      ) : visibleAssignments.length > 0 ? (
	                        visibleAssignments.map(assignment => {
	                          const isQuiz = assignment.type === 'quiz';
	                          const isGame = assignment.type === 'game';
	                          const isBot = assignment.type === 'ai-bot';
	                          const isContest = assignment.type === 'contest';
	                          const isShared = !!(assignment as any).isShared;
	                          const assignmentKey = makeTaskKey(assignment.type, assignment.id);
	                          const isSelected = selectedAssignments.includes(assignmentKey);
	                          return (
                            <div key={assignmentKey} className={`bg-white border-4 rounded-3xl p-6 shadow-comic ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-brand-brown'}`}>
                              <div className="flex justify-between items-start">
                                <div className="flex-1 flex items-start gap-3">
                                  {isSelectMode && (
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      disabled={isShared}
                                      onChange={(e) => {
                                        if (isShared) return;
                                        if (e.target.checked) {
                                          setSelectedAssignments(prev => [...prev, assignmentKey]);
                                        } else {
                                          setSelectedAssignments(prev => prev.filter(key => key !== assignmentKey));
                                        }
                                      }}
                                      className={`w-6 h-6 mt-1 rounded border-2 border-gray-400 text-blue-600 focus:ring-blue-500 ${isShared ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    />
                                  )}
                                  <div className="flex-1">
	                                    <div className="flex items-center gap-2 mb-2">
	                                      {isGame ? (
	                                        <span className="text-2xl">🎮</span>
	                                      ) : isQuiz ? (
	                                        <HelpCircle className="w-5 h-5 text-yellow-600" />
	                                      ) : isBot ? (
	                                        <Bot className="w-5 h-5 text-green-700" />
	                                      ) : isContest ? (
	                                        <span className="text-2xl">🏁</span>
	                                      ) : (
	                                        <MessageSquare className="w-5 h-5 text-purple-600" />
	                                      )}
	                                      <h4 className="text-xl font-bold text-brand-brown">{assignment.title}</h4>
	                                    </div>
	                                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                                      {isShared && (
                                        <span className="bg-indigo-100 px-2 py-1 rounded-lg">
                                          🤝 其他教師：{(assignment as any).teacherName || '—'}
                                        </span>
                                      )}
	                                      <span className={`px-2 py-1 rounded-lg ${isGame ? 'bg-green-100' : isQuiz ? 'bg-yellow-100' : isBot ? 'bg-emerald-100' : isContest ? 'bg-orange-100' : 'bg-purple-100'}`}>
	                                        {isGame ? '🎮' : isQuiz ? '🧠' : isBot ? '🤖' : isContest ? '🏁' : '📚'} {assignment.subject}
	                                      </span>
                                      <span className="bg-green-100 px-2 py-1 rounded-lg">
                                        🏫 {(() => {
                                          const classes = Array.isArray(assignment.targetClasses) ? assignment.targetClasses.join(', ') : '';
                                          const groups = Array.isArray(assignment.targetGroups) ? assignment.targetGroups.join(', ') : '';
                                          if (classes && groups) return `${classes} (${groups})`;
                                          if (classes) return classes;
                                          if (groups) return `分組: ${groups}`;
                                          return '無指定班級';
                                        })()}
                                      </span>
	                                      {!isShared && (
	                                        <>
	                                          {isBot ? (
	                                            <span className="px-2 py-1 rounded-lg bg-emerald-100">
	                                              🤖 完成 {(assignment.completedStudents ?? assignment.responseCount ?? 0)}/{(assignment.expectedStudents ?? 0)}
	                                            </span>
	                                          ) : (
	                                            <span className={`px-2 py-1 rounded-lg ${isGame ? 'bg-blue-100' : isQuiz ? 'bg-orange-100' : isContest ? 'bg-orange-100' : 'bg-yellow-100'}`}>
	                                              {isGame ? '🏆' : isQuiz ? '📊' : isContest ? '🏁' : '💬'} {isGame ? (assignment.totalAttempts || 0) : isQuiz ? (assignment.totalSubmissions || 0) : isContest ? (assignment.responseCount || 0) : (assignment.responseCount || 0)} 個{isGame ? '遊玩記錄' : isQuiz ? '提交' : isContest ? '參賽記錄' : '回應'}
	                                            </span>
	                                          )}
	                                          {!isBot && (
	                                            <span className="bg-purple-100 px-2 py-1 rounded-lg">
	                                              👥 {assignment.uniqueStudents || 0} 位學生
	                                            </span>
	                                          )}
	                                          {(isQuiz || isGame || isContest) && assignment.averageScore !== undefined && (
	                                            <span className="bg-blue-100 px-2 py-1 rounded-lg">
	                                              📈 平均分數: {Math.round(assignment.averageScore)}%
	                                            </span>
	                                          )}
	                                        </>
	                                      )}
                                    </div>
	                                    <div className="flex items-center gap-2 text-sm text-gray-500">
		                                      <span className={`px-2 py-1 rounded text-xs font-bold ${isQuiz
		                                        ? 'bg-yellow-200 text-yellow-800'
		                                        : isGame
		                                          ? 'bg-emerald-200 text-emerald-900'
		                                          : isBot
		                                            ? 'bg-emerald-200 text-emerald-900'
		                                            : isContest
		                                              ? 'bg-orange-200 text-orange-800'
		                                              : 'bg-purple-200 text-purple-800'
		                                        }`}>
		                                        {isQuiz
		                                          ? '小測驗'
		                                          : isContest
		                                            ? '問答比賽'
		                                            : isGame
	                                            ? (assignment.gameType === 'maze'
	                                              ? '迷宮闖關'
	                                              : assignment.gameType === 'matching'
	                                                ? '翻牌記憶'
	                                                : assignment.gameType === 'math'
	                                                  ? '數學測驗'
	                                                : assignment.gameType === 'ranger-td'
	                                                  ? 'Ranger 塔防'
	                                                : assignment.gameType === 'tower-defense'
	                                                  ? '答題塔防'
	                                                  : '小遊戲')
			                                                : isBot
			                                                  ? 'AI小助手任務'
			                                                  : '討論串'}
		                                      </span>
		                                      <span>創建時間: {new Date(assignment.createdAt).toLocaleString()}</span>
		                                    </div>
                                  </div>
                                  <div className="flex gap-2 ml-4">
	                                    <button
	                                      onClick={() => viewAssignmentDetails(assignment)}
	                                      className="flex items-center gap-1 px-4 py-2 bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 font-bold"
	                                    >
		                                      <Eye className="w-4 h-4" />
		                                      {isBot ? '查看對話' : (isQuiz || isGame || isContest) ? '查看結果' : '查看回應'}
		                                    </button>
                                    {!isSelectMode && !isQuiz && !isGame && !isBot && !isContest && (
                                      <button
                                        onClick={() => saveDiscussionAsTemplate(assignment)}
                                        className="flex items-center gap-1 px-4 py-2 bg-green-100 text-green-800 rounded-xl hover:bg-green-200 font-bold"
                                        title="把此討論串存到我的題庫（模板）"
                                      >
                                        <Plus className="w-4 h-4" />
                                        存為模板
                                      </button>
                                    )}
                                    {!isSelectMode && (
                                      <button
                                        onClick={() => setManualHidden(assignment, true)}
                                        className="flex items-center gap-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-bold"
                                        title="隱藏（14天內可取消）"
                                      >
                                        <EyeOff className="w-4 h-4" />
                                        隱藏
                                      </button>
                                    )}
                                    <button
                                      onClick={() => { if (!isShared) handleDeleteAssignment(assignment); }}
                                      disabled={isShared}
                                      title={isShared ? '其他教師任務：不可刪除' : undefined}
                                      className={`flex items-center gap-1 px-4 py-2 rounded-xl font-bold ${isShared ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                                    >
                                      <Trash className="w-4 h-4" />
                                      刪除
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-12 text-gray-400 font-bold text-xl border-4 border-dashed border-gray-300 rounded-3xl">
                          沒有找到作業 📝
                        </div>
                      )}
                    </div>

                    {hiddenAssignments.length > 0 && (
                      <div className="mt-6">
                        <button
                          onClick={() => setShowHiddenAssignments(v => !v)}
                          className="w-full flex items-center justify-between px-4 py-3 bg-gray-100 hover:bg-gray-200 border-2 border-gray-300 rounded-2xl font-bold text-gray-700"
                        >
                          <span>已隱藏 ({hiddenAssignments.length})</span>
                          <span className="text-sm">{showHiddenAssignments ? '收起' : '展開'}</span>
                        </button>
                        {showHiddenAssignments && (
                          <div className="mt-4 space-y-4">
	                            {hiddenAssignments.map((assignment) => {
	                              const isQuiz = assignment.type === 'quiz';
	                              const isGame = assignment.type === 'game';
	                              const isBot = assignment.type === 'ai-bot';
	                              const isContest = assignment.type === 'contest';
	                              const isShared = !!(assignment as any).isShared;
                              const assignmentKey = makeTaskKey(assignment.type, assignment.id);
                              const autoHidden = isAutoHidden(assignment.createdAt);
                              const manuallyHidden = hiddenTaskKeys.has(assignmentKey) && !autoHidden;
                              const isSelected = selectedAssignments.includes(assignmentKey);

                              return (
                                <div
                                  key={assignmentKey}
                                  className={`bg-gray-50 border-4 rounded-3xl p-6 shadow-comic ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                                >
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1 flex items-start gap-3">
                                      {isSelectMode && (
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            if (isShared) return;
                                            if (e.target.checked) setSelectedAssignments(prev => [...prev, assignmentKey]);
                                            else setSelectedAssignments(prev => prev.filter(key => key !== assignmentKey));
                                          }}
                                          disabled={isShared}
                                          className={`w-6 h-6 mt-1 rounded border-2 border-gray-400 text-blue-600 focus:ring-blue-500 ${isShared ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        />
                                      )}
                                      <div className="flex-1">
	                                        <div className="flex items-center gap-2 mb-2">
	                                          {isGame ? (
	                                            <span className="text-2xl">🎮</span>
	                                          ) : isQuiz ? (
	                                            <HelpCircle className="w-5 h-5 text-yellow-600" />
	                                          ) : isBot ? (
	                                            <Bot className="w-5 h-5 text-green-700" />
	                                          ) : isContest ? (
	                                            <span className="text-2xl">🏁</span>
	                                          ) : (
	                                            <MessageSquare className="w-5 h-5 text-purple-600" />
	                                          )}
                                          <h4 className="text-xl font-bold text-brand-brown">{assignment.title}</h4>
                                          {isShared && (
                                            <span className="ml-2 text-xs font-bold px-2 py-1 rounded bg-indigo-100 text-indigo-800">
                                              其他教師：{(assignment as any).teacherName || '—'}
                                            </span>
                                          )}
                                          {autoHidden && (
                                            <span className="ml-2 text-xs font-bold px-2 py-1 rounded bg-gray-200 text-gray-700">
                                              超過14天自動隱藏
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
	                                          <span className={`px-2 py-1 rounded text-xs font-bold ${isQuiz
	                                            ? 'bg-yellow-200 text-yellow-800'
	                                            : isGame
	                                              ? 'bg-emerald-200 text-emerald-900'
	                                              : isBot
	                                                ? 'bg-emerald-200 text-emerald-900'
	                                                : isContest
	                                                  ? 'bg-orange-200 text-orange-800'
	                                                  : 'bg-purple-200 text-purple-800'
	                                            }`}>
	                                            {isQuiz
	                                              ? '小測驗'
	                                              : isContest
	                                                ? '問答比賽'
	                                                : isGame
                                                  ? (assignment.gameType === 'maze'
                                                    ? '迷宮闖關'
                                                    : assignment.gameType === 'matching'
                                                      ? '翻牌記憶'
                                                      : assignment.gameType === 'math'
                                                        ? '數學測驗'
                                                      : assignment.gameType === 'ranger-td'
                                                        ? 'Ranger 塔防'
                                                      : assignment.gameType === 'tower-defense'
                                                        ? '答題塔防'
                                                        : '小遊戲')
		                                                  : isBot
		                                                    ? 'AI小助手任務'
		                                                    : '討論串'}
	                                          </span>
                                          <span>創建時間: {new Date(assignment.createdAt).toLocaleString()}</span>
                                        </div>
                                      </div>
                                      <div className="flex gap-2 ml-4">
                                        <button
                                          onClick={() => viewAssignmentDetails(assignment)}
                                          className="flex items-center gap-1 px-4 py-2 bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 font-bold"
                                        >
	                                          <Eye className="w-4 h-4" />
	                                          {isBot ? '查看對話' : (isQuiz || isGame || isContest) ? '查看結果' : '查看回應'}
	                                        </button>
                                        {!isSelectMode && !isQuiz && !isGame && !isBot && !isContest && (
                                          <button
                                            onClick={() => saveDiscussionAsTemplate(assignment)}
                                            className="flex items-center gap-1 px-4 py-2 bg-green-100 text-green-800 rounded-xl hover:bg-green-200 font-bold"
                                            title="把此討論串存到我的題庫（模板）"
                                          >
                                            <Plus className="w-4 h-4" />
                                            存為模板
                                          </button>
                                        )}
                                        {manuallyHidden && !isSelectMode && (
                                          <button
                                            onClick={() => setManualHidden(assignment, false)}
                                            className="flex items-center gap-1 px-4 py-2 bg-white text-gray-700 rounded-xl hover:bg-gray-100 font-bold border-2 border-gray-200"
                                            title="取消隱藏"
                                          >
                                            <Eye className="w-4 h-4" />
                                            顯示
                                          </button>
                                        )}
                                        <button
                                          onClick={() => { if (!isShared) handleDeleteAssignment(assignment); }}
                                          disabled={isShared}
                                          title={isShared ? '其他教師任務：不可刪除' : undefined}
                                          className={`flex items-center gap-1 px-4 py-2 rounded-xl font-bold ${isShared ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                                        >
                                          <Trash className="w-4 h-4" />
                                          刪除
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  // 作業詳情和回應視圖
                  <div>
                    <div className="mb-6">
                      <button
                        onClick={() => {
                          setSelectedAssignment(null);
                          setAssignmentResponses([]);
                        }}
                        className="mb-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl border-2 border-gray-300 font-bold"
                      >
                        ← 返回作業列表
                      </button>
                      <h3 className="text-2xl font-bold text-brand-brown mb-2">{selectedAssignment.title}</h3>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
                        <span className="bg-blue-100 px-2 py-1 rounded-lg">📚 {selectedAssignment.subject}</span>
                        <span className="bg-green-100 px-2 py-1 rounded-lg">
                          🏫 {(() => {
                            const classes = Array.isArray(selectedAssignment.targetClasses) ? selectedAssignment.targetClasses.join(', ') : '';
                            const groups = Array.isArray(selectedAssignment.targetGroups) ? selectedAssignment.targetGroups.join(', ') : '';
                            if (classes && groups) return `${classes} (${groups})`;
                            if (classes) return classes;
                            if (groups) return `分組: ${groups}`;
                            return '無指定班級';
                          })()}
                        </span>
                      </div>
                    </div>

                    {/* 教師原始內容 */}
                    <div className={`border-4 rounded-3xl p-6 mb-6 ${selectedAssignment?.type === 'quiz' ? 'bg-yellow-50 border-yellow-200' : 'bg-yellow-50 border-yellow-200'
                      }`}>
	                      <div className="flex justify-between items-start mb-4">
	                        <h4 className="text-xl font-bold text-brand-brown">
	                          {selectedAssignment?.type === 'quiz'
	                            ? '小測驗資訊'
	                            : selectedAssignment?.type === 'game'
	                              ? '遊戲資訊'
		                              : selectedAssignment?.type === 'ai-bot'
		                                ? 'AI小助手任務資訊'
		                                : '教師原始內容'}
	                        </h4>
	                        {selectedAssignment?.type === 'assignment' && !(selectedAssignment as any).isShared && (
	                          <button
	                            onClick={() => setIsEditingContent(!isEditingContent)}
	                            className="px-4 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-xl font-bold"
	                          >
	                            {isEditingContent ? '取消編輯' : '編輯內容'}
	                          </button>
	                        )}
	                      </div>

	                      {selectedAssignment?.type === 'quiz' ? (
	                        // 小測驗資訊顯示
	                        <div className="bg-white p-4 rounded-xl border-2 border-yellow-300">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-bold text-brand-brown">標題：</span>
                              <span>{selectedAssignment.title}</span>
                            </div>
                            <div>
                              <span className="font-bold text-brand-brown">科目：</span>
                              <span>{selectedAssignment.subject}</span>
                            </div>
                            <div>
                              <span className="font-bold text-brand-brown">描述：</span>
                              <span>{selectedAssignment.description || '無描述'}</span>
                            </div>
                            <div>
                              <span className="font-bold text-brand-brown">時間限制：</span>
                              <span>{selectedAssignment.timeLimit ? `${selectedAssignment.timeLimit} 分鐘` : '無限制'}</span>
                            </div>
                            <div>
                              <span className="font-bold text-brand-brown">問題數量：</span>
                              <span>{selectedAssignment.questions?.length || 0} 題</span>
                            </div>
                            <div>
                              <span className="font-bold text-brand-brown">派發對象：</span>
                              <span>{(() => {
                                const classes = Array.isArray(selectedAssignment.targetClasses) ? selectedAssignment.targetClasses.join(', ') : '';
                                const groups = Array.isArray(selectedAssignment.targetGroups) ? selectedAssignment.targetGroups.join(', ') : '';
                                if (classes && groups) return `班級: ${classes}, 分組: ${groups}`;
                                if (classes) return `班級: ${classes}`;
                                if (groups) return `分組: ${groups}`;
                                return '無指定班級';
                              })()}</span>
                            </div>
                          </div>

                          {/* 顯示問題列表 */}
                          {selectedAssignment.questions && selectedAssignment.questions.length > 0 && (
                            <div className="mt-4 pt-4 border-t-2 border-yellow-200">
                              <h5 className="font-bold text-brand-brown mb-3">問題預覽：</h5>
                              <div className="space-y-3 max-h-40 overflow-y-auto">
                                {selectedAssignment.questions.map((question: any, index: number) => (
                                  <div key={index} className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                    <p className="font-medium text-sm">
                                      <span className="text-brand-brown">Q{index + 1}:</span> <span className="whitespace-pre-wrap">{question.question}</span>
                                    </p>
                                    {question.image && (
                                      <div className="mt-2 mb-2">
                                        <img
                                          src={question.image}
                                          alt={`Q${index + 1}`}
                                          className="max-h-40 rounded-lg border border-gray-300"
                                        />
                                      </div>
                                    )}
                                    <p className="text-xs text-gray-600 mt-1">
                                      正確答案: {String.fromCharCode(65 + question.correctAnswer)} - {question.options[question.correctAnswer]}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
	                      ) : selectedAssignment?.type === 'ai-bot' ? (
	                        <div className="bg-white p-4 rounded-xl border-2 border-yellow-300">
	                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
	                            <div>
		                              <span className="font-bold text-brand-brown">AI小助手：</span>
		                              <span>{selectedAssignment.botName || selectedAssignment.title}</span>
		                            </div>
	                            <div>
	                              <span className="font-bold text-brand-brown">科目：</span>
	                              <span>{selectedAssignment.subject}</span>
	                            </div>
	                            <div>
	                              <span className="font-bold text-brand-brown">派發對象：</span>
	                              <span>{Array.isArray(selectedAssignment.targetClasses) ? selectedAssignment.targetClasses.join(', ') : '—'}</span>
	                            </div>
	                            <div>
	                              <span className="font-bold text-brand-brown">完成：</span>
	                              <span>{(selectedAssignment.completedStudents ?? 0)}/{(selectedAssignment.expectedStudents ?? 0)}</span>
	                            </div>
	                          </div>
	                        </div>
	                      ) : selectedAssignment?.type === 'game' ? (
	                        <div className="bg-white p-4 rounded-xl border-2 border-yellow-300">
	                          <div className="flex items-start justify-between gap-3 flex-wrap">
	                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm flex-1">
	                              <div>
	                                <span className="font-bold text-brand-brown">標題：</span>
	                                <span>{selectedAssignment.title}</span>
	                              </div>
	                              <div>
	                                <span className="font-bold text-brand-brown">科目：</span>
	                                <span>{selectedAssignment.subject}</span>
	                              </div>
	                              <div>
	                                <span className="font-bold text-brand-brown">類型：</span>
	                                <span>{selectedAssignment.gameType || '小遊戲'}</span>
	                              </div>
	                              <div>
	                                <span className="font-bold text-brand-brown">描述：</span>
	                                <span>{selectedAssignment.description || '—'}</span>
	                              </div>
	                            </div>
	                            <button
	                              type="button"
	                              onClick={() => {
	                                setPreviewGame(selectedAssignment);
	                                setPreviewResult(null);
	                                setShowGamePreviewModal(true);
	                              }}
	                              className="px-4 py-2 bg-emerald-100 text-emerald-900 rounded-xl hover:bg-emerald-200 text-sm font-black border-2 border-emerald-300"
	                            >
	                              🎮 試玩預覽
	                            </button>
	                          </div>
	                        </div>
	                      ) : (
	                        // 一般討論串內容編輯
	                        isEditingContent ? (
	                          <div className="space-y-4">
	                            <div
	                              contentEditable
	                              onInput={(e) => setEditedContent(e.currentTarget.innerHTML)}
	                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(editedContent) }}
                              className="min-h-32 p-4 border-2 border-yellow-300 rounded-xl bg-white focus:outline-none focus:border-yellow-500"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={handleSaveContent}
                                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold"
                              >
                                保存更改
                              </button>
                              <button
                                onClick={() => {
                                  setIsEditingContent(false);
                                  setEditedContent(getDisplayContent(selectedAssignment.content));
                                }}
                                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-xl font-bold"
                              >
                                取消
                              </button>
                            </div>
                          </div>
	                        ) : (
	                          <div className="bg-white p-4 rounded-xl border-2 border-yellow-300">
	                            <RichHtmlContent html={getDisplayContent(selectedAssignment.content)} />
	                          </div>
	                        )
	                      )}
                    </div>



                    {/* Completion Analysis for Games & Quizzes */}
                    {(selectedAssignment?.type === 'quiz' || selectedAssignment?.type === 'game') && (
                      <div className="mb-8 p-6 bg-blue-50 border-4 border-blue-200 rounded-3xl">
                        <h4 className="text-xl font-bold text-blue-800 mb-4">🏆 完成狀況分析</h4>
                        {(() => {
                          const targetClassList = selectedAssignment.targetClasses || [];
                          const targetGroupList = selectedAssignment.targetGroups || [];

                          // Convert targets to sets for easier lookup
                          // Only filter by class if classes are specified. 
                          // If targetGroups is present, check specific group field on user profile.

                          const expectedStudents = allStudents.filter(student => {
                            // If no targets, assume all students? Or none? Usually implies all or error. 
                            // Safety: if both empty, maybe showing all is safer or showing none.
                            if (targetClassList.length === 0 && targetGroupList.length === 0) return false;

                            const inClass = targetClassList.length === 0 || targetClassList.includes(student.profile?.class || '');

                            // Check groups
                            // Student might have chineseGroup, mathGroup, englishGroup.
                            // We need to know which subject this assignment is for to check the correct group.
                            let inGroup = true;
                            if (targetGroupList.length > 0) {
                              const subject = selectedAssignment.subject;
                              let studentGroup = '';
                              if (subject === '中文') studentGroup = student.profile?.chineseGroup || '';
                              else if (subject === '英文') studentGroup = student.profile?.englishGroup || '';
                              else if (subject === '數學') studentGroup = student.profile?.mathGroup || '';
                              inGroup = targetGroupList.includes(studentGroup);
                            }

                            return inClass && inGroup;
                          });

                          const completedStudentIds = new Set(assignmentResponses.map(r => r.studentId));
                          const notCompletedStudents = expectedStudents.filter(s => !completedStudentIds.has(s.id));

                          const bestScore = assignmentResponses.length > 0
                            ? Math.max(...assignmentResponses.map(r => r.score || 0))
                            : 0;

                          const avgScore = assignmentResponses.length > 0
                            ? (assignmentResponses.reduce((acc, curr) => acc + (curr.score || 0), 0) / assignmentResponses.length).toFixed(1)
                            : 0;

                          return (
                            <div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-white p-4 rounded-xl shadow-sm text-center">
                                  <p className="text-gray-500 text-sm font-bold">應完成人數</p>
                                  <p className="text-2xl font-black text-gray-700">{expectedStudents.length}</p>
                                </div>
                                <div className="bg-white p-4 rounded-xl shadow-sm text-center">
                                  <p className="text-gray-500 text-sm font-bold">已完成</p>
                                  <p className="text-2xl font-black text-green-600">{assignmentResponses.length}</p>
                                </div>
                                <div className="bg-white p-4 rounded-xl shadow-sm text-center">
                                  <p className="text-gray-500 text-sm font-bold">未完成</p>
                                  <p className="text-2xl font-black text-red-500">{notCompletedStudents.length}</p>
                                </div>
                                <div className="bg-white p-4 rounded-xl shadow-sm text-center">
                                  <p className="text-gray-500 text-sm font-bold">最高分 / 平均</p>
                                  <p className="text-xl font-black text-blue-600">{Math.round(bestScore)} / {avgScore}</p>
                                </div>
                              </div>

                              {notCompletedStudents.length > 0 && (
                                <div className="bg-white p-4 rounded-xl border-2 border-red-100">
                                  <h5 className="font-bold text-red-600 mb-2">⚠️ 未完成名單</h5>
                                  <div className="flex flex-wrap gap-2">
                                    {notCompletedStudents.map(s => (
                                      <span key={s.id} className="px-3 py-1 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
                                        {s.profile?.name} ({s.profile?.class})
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}

	                    {/* 學生回應或測驗結果列表 */}
	                    <div className="space-y-4">
	                      {selectedAssignment?.type === 'ai-bot' ? (
	                        <>
	                          <h4 className="text-xl font-bold text-brand-brown">
	                            學生對話狀況 ({assignmentResponses.length})
	                          </h4>
	                          {loading ? (
	                            <div className="text-center py-8">
	                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-brown mx-auto mb-2"></div>
	                              <p className="text-brand-brown">載入中...</p>
	                            </div>
	                          ) : assignmentResponses.length > 0 ? (
	                            assignmentResponses.map((row) => (
	                              <div key={row.studentId} className="border-2 rounded-2xl p-4 bg-gray-50 border-gray-300">
	                                <div className="flex justify-between items-start">
	                                  <div className="flex items-center gap-3">
	                                    <div className="w-8 h-8 rounded-full bg-brand-green-light flex items-center justify-center">
	                                      <span className="text-white font-bold text-sm">
	                                        {String(row.studentName || '學').charAt(0)}
	                                      </span>
	                                    </div>
	                                    <div>
	                                      <p className="font-bold text-brand-brown flex items-center gap-2">
	                                        {row.studentName}
	                                        {row.completed ? (
	                                          <span className="text-xs font-bold px-2 py-1 rounded bg-green-100 text-green-800">已完成</span>
	                                        ) : (
	                                          <span className="text-xs font-bold px-2 py-1 rounded bg-gray-200 text-gray-700">未完成</span>
	                                        )}
	                                      </p>
	                                      <p className="text-sm text-gray-600">{row.studentClass} • {row.studentUsername}</p>
	                                      {row.lastMessageAt && (
	                                        <p className="text-xs text-gray-500 mt-1">最後訊息：{new Date(row.lastMessageAt).toLocaleString()}</p>
	                                      )}
	                                    </div>
	                                  </div>
	                                  <div className="flex gap-2">
	                                    <button
	                                      onClick={() => row.threadId && openBotTaskThreadMessages(selectedAssignment.id, String(row.threadId))}
	                                      disabled={!row.threadId}
	                                      className={`px-4 py-2 rounded-xl font-bold border-2 ${row.threadId ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200' : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'}`}
	                                    >
	                                      查看對話
	                                    </button>
	                                  </div>
	                                </div>
	                              </div>
	                            ))
	                          ) : (
	                            <div className="text-center py-8 text-gray-400 font-bold border-4 border-dashed border-gray-300 rounded-2xl">
	                              目前沒有學生對話紀錄 💬
	                            </div>
	                          )}
	                        </>
	                      ) : (
	                        <>
	                          <div className="flex items-center justify-between gap-3">
	                            <h4 className="text-xl font-bold text-brand-brown">
	                              {selectedAssignment?.type === 'quiz' ? '測驗結果' : '學生回應'} ({assignmentResponses.length})
	                            </h4>
	                            {(selectedAssignment?.type === 'quiz' || selectedAssignment?.type === 'contest') && (
	                              <button
	                                onClick={() => openAiReport({ toolType: selectedAssignment.type, toolId: String(selectedAssignment.id), scope: 'overall', titleSuffix: selectedAssignment.title })}
	                                className="px-4 py-2 rounded-xl font-bold border-2 bg-green-100 text-green-800 hover:bg-green-200 border-green-200"
	                              >
	                                AI報告（全體）
	                              </button>
	                            )}
	                          </div>
	                          {loading ? (
	                            <div className="text-center py-8">
	                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-brown mx-auto mb-2"></div>
	                              <p className="text-brand-brown">載入中...</p>
	                            </div>
	                          ) : assignmentResponses.length > 0 ? (
	                            assignmentResponses.map(response => (
	                              <div key={response.id} className={`border-2 rounded-2xl p-4 ${selectedAssignment?.type === 'quiz' ? 'bg-yellow-50 border-yellow-200' : selectedAssignment?.type === 'contest' ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-300'
	                                }`}>
	                                <div className="flex justify-between items-start">
	                                  <div className="flex-1">
	                                    <div className="flex items-center gap-3 mb-2">
	                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedAssignment?.type === 'quiz' ? 'bg-yellow-500' : selectedAssignment?.type === 'contest' ? 'bg-orange-500' : 'bg-brand-green-light'
	                                        }`}>
	                                        <span className="text-white font-bold text-sm">
	                                          {response.studentName?.charAt(0) || '學'}
	                                        </span>
	                                      </div>
	                                      <div>
	                                        <p className="font-bold text-brand-brown">{response.studentName}</p>
	                                        <p className="text-sm text-gray-600">{response.studentClass} • {response.studentUsername}</p>
	                                      </div>
	                                      {(selectedAssignment?.type === 'quiz' || selectedAssignment?.type === 'contest') && (
	                                        <div className="ml-auto flex items-center gap-4">
	                                          <div className={`px-3 py-1 rounded-full text-sm font-bold ${response.score >= 80 ? 'bg-green-100 text-green-700' :
	                                            response.score >= 60 ? 'bg-yellow-100 text-yellow-700' :
	                                              'bg-red-100 text-red-700'
	                                            }`}>
	                                            {Math.round(response.score)}%
	                                          </div>
	                                          <div className="text-sm text-gray-500">
	                                            {response.correctAnswers}/{response.totalQuestions} 正確
	                                          </div>
	                                          {selectedAssignment?.type === 'contest' && (
	                                            <div className="text-sm text-gray-500">
	                                              🏁 第 {response.attempt} 次參賽
	                                            </div>
	                                          )}
	                                        </div>
	                                      )}
	                                    </div>
	
	                                    {selectedAssignment?.type === 'quiz' || selectedAssignment?.type === 'game' || selectedAssignment?.type === 'contest' ? (
	                                      <>
	                                        <div className="bg-white p-3 rounded-xl border border-gray-200">
	                                          <div className="grid grid-cols-2 gap-4 text-sm">
	                                            <div>
	                                              <span className="font-medium text-gray-600">得分:</span>
	                                              <span className="ml-2 font-bold">{Math.round(response.score)}%</span>
	                                            </div>
	                                            {selectedAssignment?.type === 'game' && response.attempts && (
	                                              <div>
	                                                <span className="font-medium text-gray-600">遊玩次數:</span>
	                                                <span className="ml-2">{response.attempts}</span>
	                                              </div>
	                                            )}
	                                            {selectedAssignment?.type === 'contest' && (
	                                              <div>
	                                                <span className="font-medium text-gray-600">參賽次數:</span>
	                                                <span className="ml-2">第 {response.attempt} 次</span>
	                                              </div>
	                                            )}
	                                            <div>
	                                              <span className="font-medium text-gray-600">正確答案:</span>
	                                              <span className="ml-2">{response.correctAnswers}/{response.totalQuestions}</span>
	                                            </div>
	                                            <div>
	                                              <span className="font-medium text-gray-600">用時:</span>
	                                              <span className="ml-2">{response.timeSpent ? `${Math.round(response.timeSpent / 60)}分鐘` : '未記錄'}</span>
	                                            </div>
	                                            <div>
	                                              <span className="font-medium text-gray-600">提交時間:</span>
	                                              <span className="ml-2">{new Date(response.submittedAt || response.playedAt || Date.now()).toLocaleString()}</span>
	                                            </div>
	                                          </div>
	                                        </div>
	                                        <div className="mt-3 flex justify-end">
	                                          {(selectedAssignment?.type === 'quiz' || selectedAssignment?.type === 'contest') && (
	                                            <button
	                                              onClick={() => openAiReport({
	                                                toolType: selectedAssignment.type,
	                                                toolId: String(selectedAssignment.id),
	                                                scope: 'student',
	                                                studentId: String(response.studentId),
	                                                titleSuffix: `${selectedAssignment.title} - ${response.studentName}`
	                                              })}
	                                              className="mr-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 text-sm font-bold"
	                                            >
	                                              AI報告
	                                            </button>
	                                          )}
	                                          <button
	                                            onClick={() => setViewingResultDetails(response)}
	                                            className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 text-sm font-bold flex items-center gap-2"
	                                          >
	                                            <Eye className="w-4 h-4" />
	                                            查看詳情
	                                          </button>
	                                        </div>
	                                      </>
	                                    ) : (
	                                      <div className="bg-white p-3 rounded-xl border border-gray-200">
	                                        <RichHtmlContent html={response.content || response.message || '無內容'} />
	                                      </div>
	                                    )}
	
	                                    {selectedAssignment?.type !== 'quiz' && (
	                                      <p className="text-xs text-gray-500 mt-2">
	                                        {(() => {
	                                          const ts = response.createdAt || response.completedAt || response.submittedAt || response.playedAt || null;
	                                          if (!ts) return '—';
	                                          const d = new Date(ts);
	                                          return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
	                                        })()}
	                                      </p>
	                                    )}
	                                  </div>
	                                  {selectedAssignment?.type === 'assignment' && !(selectedAssignment as any).isShared && (
	                                    <button
	                                      onClick={() => handleDeleteResponse(response.id)}
	                                      className="ml-4 p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
	                                      title="刪除此回應"
	                                    >
	                                      <Trash className="w-4 h-4" />
	                                    </button>
	                                  )}
	                                </div>
	                              </div>
	                            ))
	                          ) : (
	                            <div className="text-center py-8 text-gray-400 font-bold border-4 border-dashed border-gray-300 rounded-2xl">
	                              {selectedAssignment?.type === 'quiz' ? '目前沒有測驗結果 📊' : '目前沒有學生回應 💭'}
	                            </div>
	                          )}
	                        </>
	                      )}
	                    </div>
                  </div>
                )}
              </div>
            </div>
          </div >
        )
	      }

	        {showBotTaskAssignModal && (
	          <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
	            <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-comic overflow-y-auto">
	              <div className="p-6 border-b-4 border-brand-brown bg-[#D2EFFF] flex items-center justify-between">
		                <h2 className="text-2xl font-black text-brand-brown flex items-center gap-2">
		                  <Bot className="w-6 h-6" />
		                  派發 AI小助手任務
		                </h2>
                <button
                  onClick={() => setShowBotTaskAssignModal(false)}
                  className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                >
                  <X className="w-6 h-6 text-brand-brown" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
	                  <label className="block text-sm font-bold text-brand-brown mb-2">選擇 AI小助手</label>
	                  <select
	                    value={botTaskForm.botId}
                    onChange={(e) => setBotTaskForm((prev) => ({ ...prev, botId: e.target.value }))}
                    className="w-full px-4 py-2 border-4 border-brand-brown rounded-2xl bg-white font-bold"
                  >
                    {myBots.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

	                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
	                  <div>
	                    <label className="block text-sm font-bold text-brand-brown mb-2">科目</label>
	                    <select
	                      value={botTaskForm.subject}
	                      onChange={(e) => {
	                        const newSubject = e.target.value as Subject;
	                        setBotTaskForm((prev) => ({ ...prev, subject: newSubject, targetClasses: [], targetGroups: [] }));
	                        loadClassesAndGroups(newSubject);
	                      }}
	                      className="w-full px-4 py-2 border-4 border-brand-brown rounded-2xl bg-white font-bold"
	                    >
	                      {VISIBLE_SUBJECTS.map((s) => (
	                        <option key={s} value={s}>{s}</option>
	                      ))}
	                    </select>
	                  </div>
	                  <div className="p-4 bg-gray-50 border-2 border-gray-200 rounded-2xl text-sm text-gray-700 font-bold flex items-center">
	                    選好科目後，請選擇要派發的班級或分組
	                  </div>
	                </div>

	                <div>
	                  <label className="block text-sm font-bold text-brand-brown mb-2">派發至班級</label>
	                  <div className="flex flex-wrap gap-2">
	                    {availableClasses.map((className) => (
	                      <button
	                        key={className}
	                        type="button"
	                        onClick={() => {
	                          setBotTaskForm((prev) => ({
	                            ...prev,
	                            targetClasses: prev.targetClasses.includes(className)
	                              ? prev.targetClasses.filter((c) => c !== className)
	                              : [...prev.targetClasses, className]
	                          }));
	                        }}
	                        className={`px-4 py-2 rounded-2xl border-2 font-bold transition-colors ${botTaskForm.targetClasses.includes(className)
	                          ? 'bg-[#D2EFFF] border-brand-brown text-brand-brown'
	                          : 'bg-white border-gray-300 text-gray-600 hover:border-brand-brown'
	                          }`}
	                      >
	                        {className}
	                      </button>
	                    ))}
	                  </div>
	                </div>

                  {botTaskForm.targetClasses.length === 1 ? (
                    <ClassFolderSelectInline
                      authService={authService}
                      className={botTaskForm.targetClasses[0]}
                      value={botTaskClassFolderId}
                      onChange={setBotTaskClassFolderId}
                    />
                  ) : (
                    <div className="p-4 bg-gray-50 border-2 border-gray-200 rounded-2xl text-sm text-gray-700 font-bold">
                      請先只選擇 1 個班級，才可選擇資料夾（資料夾屬於單一班別）。
                    </div>
                  )}

	                {availableGroups.length > 0 && (
	                  <div>
	                    <label className="block text-sm font-bold text-brand-brown mb-2">
	                      選擇分組 ({botTaskForm.subject})
	                    </label>
	                    <div className="flex flex-wrap gap-2">
	                      {availableGroups.map((groupName) => (
	                        <button
	                          key={groupName}
	                          type="button"
	                          onClick={() => {
	                            setBotTaskForm((prev) => ({
	                              ...prev,
	                              targetGroups: prev.targetGroups.includes(groupName)
	                                ? prev.targetGroups.filter((g) => g !== groupName)
	                                : [...prev.targetGroups, groupName]
	                            }));
	                          }}
	                          className={`px-4 py-2 rounded-2xl border-2 font-bold transition-colors ${botTaskForm.targetGroups.includes(groupName)
	                            ? 'bg-[#E8F4FD] border-blue-500 text-blue-600'
	                            : 'bg-white border-gray-300 text-gray-600 hover:border-blue-500'
	                            }`}
	                        >
	                          {groupName}
	                        </button>
	                      ))}
	                    </div>
	                    <p className="text-xs text-gray-500 mt-1">
	                      選擇分組會精確派發給該分組的學生
	                    </p>
	                  </div>
	                )}

                <div className="p-4 bg-gray-50 border-2 border-gray-200 rounded-2xl text-sm text-gray-700 font-bold">
	                  學生在「我的學科 → 我的任務」看到此 AI小助手任務，學生只要送出任意一句對話就算完成；你可在作業管理中查看學生對話記錄。
		                </div>

                <div className="flex gap-4 pt-2">
                  <Button
                    className="flex-1 bg-gray-300 text-gray-700 hover:bg-gray-400"
                    onClick={() => setShowBotTaskAssignModal(false)}
                  >
                    取消
                  </Button>
                  <Button
                    className="flex-1 bg-[#D2EFFF] text-brand-brown hover:bg-[#BCE0FF] border-brand-brown"
                    onClick={submitBotTaskAssign}
                  >
                    派發
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {botTaskThreadModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4">
            <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-comic flex flex-col">
              <div className="p-5 border-b-4 border-brand-brown bg-[#E0D2F8] flex items-center justify-between">
                <div className="text-xl font-black text-brand-brown">{botTaskThreadModalTitle || '對話記錄'}</div>
                <button
                  onClick={() => { setBotTaskThreadModalOpen(false); setBotTaskThreadMessages([]); }}
                  className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                >
                  <X className="w-6 h-6 text-brand-brown" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                {botTaskThreadMessages.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 font-bold border-4 border-dashed border-gray-300 rounded-2xl">
                    沒有對話內容
                  </div>
                ) : (
                  <div className="space-y-4">
                    {botTaskThreadMessages.map((m: any) => (
                      <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 border-2 break-words ${m.sender === 'user' ? 'bg-white border-brand-brown' : 'bg-[#E0D2F8] border-purple-300'}`}>
                          <div className="whitespace-pre-wrap text-gray-800">{String(m.content || '')}</div>
                          {m.createdAt && (
                            <div className="text-[10px] text-gray-500 mt-2">
                              {new Date(m.createdAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

		      {/* Quiz Creation Modal */}
		      {
		        showQuizModal && (
	          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-comic">
              <div className="p-6 border-b-4 border-brand-brown bg-[#FDEEAD]">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-black text-brand-brown">創建小測驗</h2>
                  <button
                    onClick={() => {
                      setShowQuizModal(false);
                      resetQuizEditor();
                    }}
                    className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                  >
                    <X className="w-6 h-6 text-brand-brown" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {quizDraftReadOnly && (
                  <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl text-sm text-gray-700 font-bold">
                    共用草稿（唯讀）：你可以直接「儲存及派發」，但不可修改內容。如需修改請先在教師資料夾按「複製到我的」。
                  </div>
                )}
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="小測驗標題"
                    placeholder="輸入小測驗標題..."
                    value={quizForm.title}
                    onChange={(e) => setQuizForm(prev => ({ ...prev, title: e.target.value }))}
                    disabled={quizDraftReadOnly}
                  />
                  <div>
                    <label className="block text-sm font-bold text-brand-brown mb-2">選擇科目</label>
                    <select
                      className="w-full px-4 py-2 border-4 border-brand-brown rounded-2xl bg-white font-bold"
                      value={quizForm.subject}
                      onChange={(e) => {
                        const newSubject = e.target.value as Subject;
                        setQuizForm(prev => ({ ...prev, subject: newSubject }));
                      }}
                      disabled={quizDraftReadOnly}
                    >
                      {VISIBLE_SUBJECTS.map(subject => (
                        <option key={subject} value={subject}>{subject}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Input
                      label="描述 (可選)"
                      placeholder="描述這個小測驗..."
                      value={quizForm.description}
                      onChange={(e) => setQuizForm(prev => ({ ...prev, description: e.target.value }))}
                      disabled={quizDraftReadOnly}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-brand-brown mb-2">
                      <Clock className="w-4 h-4 inline mr-1" />
                      時間限制 (分鐘，0為無限制)
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="w-full px-4 py-2 border-4 border-brand-brown rounded-2xl bg-white font-bold"
                      value={quizForm.timeLimit}
                      onChange={(e) => setQuizForm(prev => ({ ...prev, timeLimit: parseInt(e.target.value) || 0 }))}
                      disabled={quizDraftReadOnly}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-brand-brown mb-2">學習範圍（學習卡用）</label>
                  <textarea
                    className="w-full px-4 py-3 border-4 border-brand-brown rounded-2xl bg-white font-bold resize-y min-h-[96px]"
                    placeholder="輸入此小測驗的學習範圍（會用作學習卡聚合分析）..."
                    value={quizForm.scopeText}
                    onChange={(e) => setQuizForm(prev => ({ ...prev, scopeText: e.target.value }))}
                    disabled={quizDraftReadOnly}
                  />
                </div>

	                {/* Questions Section */}
	                <div className="border-t-4 border-gray-200 pt-6">
	                  <div className="flex justify-between items-center mb-4">
	                    <h3 className="text-xl font-bold text-brand-brown">問題列表</h3>
	                    <div className="flex gap-3">
	                      <Button
	                        onClick={() => openAiGenerator({
	                          mode: 'mcq',
	                          title: 'AI 生成小測驗題目',
	                          subject: String(quizForm.subject),
	                          importModes: ['replace', 'append'],
	                          onImport: (payload, importMode) => {
	                            const incoming = (payload.mcq || []).map((q: any) => ({
	                              question: q.question,
	                              options: q.options,
	                              correctAnswer: q.correctIndex
	                            }));
	                            setQuizForm(prev => ({
	                              ...prev,
	                              questions: importMode === 'replace' ? incoming : [...prev.questions, ...incoming]
	                            }));
	                            setShowAiGenerator(false);
	                          }
	                        })}
	                        className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-300 flex items-center gap-2"
                          disabled={quizDraftReadOnly}
	                      >
	                        🤖 AI 生成
	                      </Button>
	                      <Button
	                        onClick={addQuestion}
	                        className="bg-green-100 text-green-700 hover:bg-green-200 border-green-300 flex items-center gap-2"
                          disabled={quizDraftReadOnly}
	                      >
	                        <Plus className="w-4 h-4" />
	                        新增問題
	                      </Button>
	                    </div>
	                  </div>

                  {quizForm.questions.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 font-bold border-4 border-dashed border-gray-300 rounded-3xl">
                      還沒有問題，點擊上方「新增問題」開始創建 📝
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {quizForm.questions.map((question, questionIndex) => (
                        <div key={questionIndex} className="bg-gray-50 border-4 border-gray-200 rounded-3xl p-6">
                          <div className="flex justify-between items-start mb-4">
                            <h4 className="text-lg font-bold text-brand-brown">問題 {questionIndex + 1}</h4>
                            <button
                              onClick={() => removeQuestion(questionIndex)}
                              className="p-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200"
                              disabled={quizDraftReadOnly}
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="space-y-4">
                            <Input
                              label="問題內容"
                              placeholder="輸入問題..."
                              multiline={true}
                              rows={3}
                              value={question.question}
                              onChange={(e) => updateQuestion(questionIndex, 'question', e.target.value)}
                              disabled={quizDraftReadOnly}
                            />

                            {/* 圖片上傳區域 */}
                            <div>
                              <label className="block text-sm font-bold text-brand-brown mb-2">
                                問題圖片 (選填，自動壓縮至1MB內)
                              </label>
                              <div className="flex items-start gap-4">
                                <div className="flex-1">
                                  <label className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-brand-brown hover:bg-gray-50 transition-colors">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => handleQuestionImageUpload(questionIndex, e)}
                                      className="hidden"
                                      disabled={quizDraftReadOnly}
                                    />
                                    <span className="text-gray-600 font-medium">
                                      {question.image ? '更換圖片' : '上傳圖片'}
                                    </span>
                                  </label>
                                </div>
                                {question.image && (
                                  <div className="relative w-32 h-32 bg-gray-100 rounded-lg overflow-hidden border-2 border-brand-brown">
                                    <img
                                      src={question.image}
                                      alt="Question Preview"
                                      className="w-full h-full object-cover"
                                    />
                                    <button
                                      onClick={() => updateQuestion(questionIndex, 'image', undefined)}
                                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                      title="移除圖片"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-bold text-brand-brown mb-2">選項</label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {question.options.map((option, optionIndex) => (
                                  <div key={optionIndex} className="relative">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="radio"
                                        name={`question-${questionIndex}-correct`}
                                        checked={question.correctAnswer === optionIndex}
                                        onChange={() => updateQuestion(questionIndex, 'correctAnswer', optionIndex)}
                                        className="w-4 h-4 text-green-600"
                                        disabled={quizDraftReadOnly}
                                      />
                                      <span className="font-bold text-gray-600 min-w-[20px]">
                                        {String.fromCharCode(65 + optionIndex)}.
                                      </span>
                                      <input
                                        type="text"
                                        placeholder={`選項 ${String.fromCharCode(65 + optionIndex)}`}
                                        value={option}
                                        onChange={(e) => updateOption(questionIndex, optionIndex, e.target.value)}
                                        className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-xl focus:border-brand-brown font-medium"
                                        disabled={quizDraftReadOnly}
                                      />
                                    </div>
                                    {question.correctAnswer === optionIndex && (
                                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                        ✓
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                              <p className="text-xs text-gray-500 mt-2">
                                ☑️ 點擊左側圓圈選擇正確答案
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4 border-t-2 border-gray-200">
                  <Button
                    className="flex-1 bg-gray-300 text-gray-700 hover:bg-gray-400"
                    onClick={async () => {
                      const isOwner = String(quizDraftMeta?.ownerTeacherId || user?.id || '') === String(user?.id || '');
                      const canDelete = !!quizDraftId && isOwner && !quizDraftReadOnly;
                      if (canDelete) {
                        const ok = window.confirm('取消＝刪除草稿。確定要刪除嗎？');
                        if (!ok) return;
                        try {
                          await authService.deleteDraft(quizDraftId);
                          alert('草稿已刪除');
                        } catch (e: any) {
                          alert(e?.message || '刪除失敗');
                          return;
                        }
                      }
                      setShowQuizModal(false);
                      resetQuizEditor();
                    }}
                  >
                    取消
                  </Button>
                  <Button
                    className="flex-1 bg-white text-brand-brown hover:bg-gray-50 border-brand-brown"
                    onClick={() => {
                      const title = String(quizForm.title || '').trim();
                      if (!title) return alert('請輸入標題');
                      if (quizDraftReadOnly) return;
                      setQuizWizardMode('save');
                      setQuizWizardOpen(true);
                    }}
                    disabled={quizDraftReadOnly || imageUploading}
                  >
                    儲存
                  </Button>
                  <Button
                    className={`flex-1 border-brand-brown ${imageUploading ? 'bg-gray-400 text-white cursor-wait' : 'bg-[#FDEEAD] text-brand-brown hover:bg-[#FCE690]'}`}
                    onClick={() => {
                      const title = String(quizForm.title || '').trim();
                      if (!title) return alert('請輸入標題');
                      if (!Array.isArray(quizForm.questions) || quizForm.questions.length === 0) return alert('請至少新增一題');
                      setQuizWizardMode('publish');
                      setQuizWizardOpen(true);
                    }}
                    disabled={imageUploading}
                  >
                    {imageUploading ? '圖片處理中...' : '儲存及派發'}
                  </Button>
                </div>
              </div>
            </div>
	          </div>
	        )
	      }

      <ClassFolderManagerModal
        open={showClassFolderManager}
        onClose={() => setShowClassFolderManager(false)}
        authService={authService}
        availableClasses={availableClasses}
      />

      <DraftLibraryModal
        open={showDraftLibraryModal}
        onClose={() => setShowDraftLibraryModal(false)}
        authService={authService}
        userId={String(user?.id || '')}
        availableClasses={availableClasses}
        onOpenDraft={(d) => {
          const toolType = String(d?.toolType || '');
          const id = String(d?.id || '');
          if (!id) return;
          if (toolType === 'discussion') {
            setShowDraftLibraryModal(false);
            setDiscussionDraftId(id);
            setShowDiscussionModal(true);
            return;
          }
          if (toolType === 'quiz') {
            setShowDraftLibraryModal(false);
            setQuizDraftId(id);
            setShowQuizModal(true);
            return;
          }
          if (toolType === 'contest') {
            setShowDraftLibraryModal(false);
            setContestDraftId(id);
            setShowContestModal(true);
            return;
          }
          if (toolType === 'game') {
            setShowDraftLibraryModal(false);
            setGameDraftId(id);
            setShowGameModal(true);
            return;
          }
          if (toolType === 'note') {
            setShowDraftLibraryModal(false);
            setNoteDraftId(id);
            setShowNoteDraftModal(true);
            return;
          }
          alert('此草稿工具尚未支援開啟。');
        }}
      />

      <CreateTaskModal
        open={showCreateTaskModal}
        onClose={() => setShowCreateTaskModal(false)}
	        onSelectTool={(tool) => {
	          setShowCreateTaskModal(false);
	          if (tool === 'discussion') {
	            resetDiscussionEditor();
	            return setShowDiscussionModal(true);
	          }
	          if (tool === 'note') {
              initNewNoteDraftEditor();
              return setShowNoteDraftModal(true);
            }
	          if (tool === 'quiz') {
              resetQuizEditor();
              return setShowQuizModal(true);
            }
	          if (tool === 'mathQuiz') {
              resetGameEditor();
              return openMathQuizCreator();
            }
	          if (tool === 'game') {
              resetGameEditor();
              return openGameCreator();
            }
	          if (tool === 'contest') {
              resetContestEditor();
              return setShowContestModal(true);
            }
	        }}
	      />

      <DraftSavePublishWizardModal
        open={discussionWizardOpen}
        mode={discussionWizardMode}
        onClose={() => setDiscussionWizardOpen(false)}
        authService={authService}
        availableGrades={teacherGradeOptions}
        availableClasses={availableClasses}
        title={discussionForm.title}
        allowShared={true}
        initialLocation={{
          scope: discussionDraftMeta?.scope === 'shared' ? 'shared' : 'my',
          grade: String(discussionDraftMeta?.grade || teacherGradeOptions[0] || ''),
          folderId: discussionDraftMeta?.folderId ? String(discussionDraftMeta.folderId) : null
        }}
        readOnlyLocation={discussionDraftReadOnly}
        keepDraftDefault={true}
        keepDraftLocked={discussionDraftReadOnly}
        onSave={async (picked) => {
          const title = String(discussionForm.title || '').trim();
          if (!title) throw new Error('請先輸入標題');
          if (discussionDraftReadOnly && discussionDraftId) return { draftId: discussionDraftId };

          const safe = sanitizeHtml(discussionForm.content || '');
          const contentSnapshot = { content: [{ type: 'html', value: safe }] };
          if (!discussionDraftId) {
            const resp = await authService.createDraft({
              toolType: 'discussion',
              title,
              subject: discussionForm.subject,
              grade: picked.grade,
              scope: picked.scope,
              folderId: picked.folderId,
              contentSnapshot
            });
            const id = String(resp?.draft?.id || '');
            if (!id) throw new Error('建立失敗（缺少 draftId）');
            setDiscussionDraftId(id);
            setDiscussionDraftMeta(resp?.draft || null);
            setDiscussionDraftReadOnly(false);
            return { draftId: id };
          }
          await authService.updateDraftMeta(discussionDraftId, {
            title,
            subject: discussionForm.subject,
            grade: picked.grade,
            scope: picked.scope,
            folderId: picked.folderId
          });
          await authService.updateDraftContent(discussionDraftId, contentSnapshot);
          setDiscussionDraftMeta((prev) => ({ ...(prev || {}), title, subject: discussionForm.subject, grade: picked.grade, scope: picked.scope, folderId: picked.folderId }));
          return { draftId: discussionDraftId };
        }}
        onPublished={() => {
          setDiscussionWizardOpen(false);
          setShowDiscussionModal(false);
          resetDiscussionEditor();
        }}
      />

      <DraftSavePublishWizardModal
        open={quizWizardOpen}
        mode={quizWizardMode}
        onClose={() => setQuizWizardOpen(false)}
        authService={authService}
        availableGrades={teacherGradeOptions}
        availableClasses={availableClasses}
        title={quizForm.title}
        allowShared={true}
        initialLocation={{
          scope: quizDraftMeta?.scope === 'shared' ? 'shared' : 'my',
          grade: String(quizDraftMeta?.grade || teacherGradeOptions[0] || ''),
          folderId: quizDraftMeta?.folderId ? String(quizDraftMeta.folderId) : null
        }}
        readOnlyLocation={quizDraftReadOnly}
        keepDraftDefault={true}
        keepDraftLocked={quizDraftReadOnly}
        onSave={async (picked) => {
          const title = String(quizForm.title || '').trim();
          if (!title) throw new Error('請先輸入標題');
          if (quizDraftReadOnly && quizDraftId) return { draftId: quizDraftId };

          const contentSnapshot = {
            quiz: {
              description: String(quizForm.description || ''),
              timeLimit: Number(quizForm.timeLimit) || 0,
              questions: Array.isArray(quizForm.questions) ? quizForm.questions : []
            }
          };

          if (!quizDraftId) {
            const resp = await authService.createDraft({
              toolType: 'quiz',
              title,
              subject: quizForm.subject,
              grade: picked.grade,
              scope: picked.scope,
              folderId: picked.folderId,
              contentSnapshot
            });
            const id = String(resp?.draft?.id || '');
            if (!id) throw new Error('建立失敗（缺少 draftId）');
            setQuizDraftId(id);
            setQuizDraftMeta(resp?.draft || null);
            setQuizDraftReadOnly(false);
            return { draftId: id };
          }

          await authService.updateDraftMeta(quizDraftId, {
            title,
            subject: quizForm.subject,
            grade: picked.grade,
            scope: picked.scope,
            folderId: picked.folderId
          });
          await authService.updateDraftContent(quizDraftId, contentSnapshot);
          setQuizDraftMeta((prev) => ({ ...(prev || {}), title, subject: quizForm.subject, grade: picked.grade, scope: picked.scope, folderId: picked.folderId }));
          return { draftId: quizDraftId };
        }}
        onPublished={() => {
          setQuizWizardOpen(false);
          setShowQuizModal(false);
          resetQuizEditor();
        }}
      />

      <DraftSavePublishWizardModal
        open={contestWizardOpen}
        mode={contestWizardMode}
        onClose={() => setContestWizardOpen(false)}
        authService={authService}
        availableGrades={teacherGradeOptions}
        availableClasses={availableClasses}
        title={contestForm.title}
        allowShared={true}
        initialLocation={{
          scope: contestDraftMeta?.scope === 'shared' ? 'shared' : 'my',
          grade: String(contestDraftMeta?.grade || teacherGradeOptions[0] || ''),
          folderId: contestDraftMeta?.folderId ? String(contestDraftMeta.folderId) : null
        }}
        readOnlyLocation={contestDraftReadOnly}
        keepDraftDefault={true}
        keepDraftLocked={contestDraftReadOnly}
        onSave={async (picked) => {
          const title = String(contestForm.title || '').trim();
          if (!title) throw new Error('請先輸入標題');
          if (contestDraftReadOnly && contestDraftId) return { draftId: contestDraftId };

          const contentSnapshot = {
            contest: {
              topic: String(contestForm.topic || ''),
              scopeText: String(contestForm.scopeText || ''),
              advancedOnly: !!contestForm.advancedOnly,
              grade: String(contestForm.grade || '小一'),
              questionCount: Number(contestForm.questionCount) || 10,
              timeLimitSeconds: contestForm.timeLimitSeconds ?? null
            }
          };

          if (!contestDraftId) {
            const resp = await authService.createDraft({
              toolType: 'contest',
              title,
              subject: contestForm.subject,
              grade: picked.grade,
              scope: picked.scope,
              folderId: picked.folderId,
              contentSnapshot
            });
            const id = String(resp?.draft?.id || '');
            if (!id) throw new Error('建立失敗（缺少 draftId）');
            setContestDraftId(id);
            setContestDraftMeta(resp?.draft || null);
            setContestDraftReadOnly(false);
            return { draftId: id };
          }

          await authService.updateDraftMeta(contestDraftId, {
            title,
            subject: contestForm.subject,
            grade: picked.grade,
            scope: picked.scope,
            folderId: picked.folderId
          });
          await authService.updateDraftContent(contestDraftId, contentSnapshot);
          setContestDraftMeta((prev) => ({ ...(prev || {}), title, subject: contestForm.subject, grade: picked.grade, scope: picked.scope, folderId: picked.folderId }));
          return { draftId: contestDraftId };
        }}
        onPublished={() => {
          setContestWizardOpen(false);
          setShowContestModal(false);
          resetContestEditor();
        }}
      />

      <DraftSavePublishWizardModal
        open={noteWizardOpen}
        mode={noteWizardMode}
        onClose={() => setNoteWizardOpen(false)}
        authService={authService}
        availableGrades={teacherGradeOptions}
        availableClasses={availableClasses}
        title={noteDraftForm.title}
        allowShared={true}
        initialLocation={{
          scope: noteDraftMeta?.scope === 'shared' ? 'shared' : 'my',
          grade: String(noteDraftMeta?.grade || teacherGradeOptions[0] || ''),
          folderId: noteDraftMeta?.folderId ? String(noteDraftMeta.folderId) : null
        }}
        readOnlyLocation={noteDraftReadOnly}
        keepDraftDefault={true}
        keepDraftLocked={noteDraftReadOnly}
        onSave={async (picked) => {
          const title = String(noteDraftForm.title || '').trim();
          const subject = String(noteDraftForm.subject || DEFAULT_SUBJECT).trim();
          if (!title) throw new Error('請先輸入標題');
          if (!subject) throw new Error('請先選擇科目');
          if (noteDraftReadOnly && noteDraftId) return { draftId: noteDraftId };

          const templateSnapshot = noteEditorRef.current?.getSnapshot?.();
          if (!templateSnapshot) throw new Error('筆記畫布未就緒');

          const contentSnapshot = { note: { templateSnapshot } };

          if (!noteDraftId) {
            const resp = await authService.createDraft({
              toolType: 'note',
              title,
              subject,
              grade: picked.grade,
              scope: picked.scope,
              folderId: picked.folderId,
              contentSnapshot
            });
            const id = String(resp?.draft?.id || '');
            if (!id) throw new Error('建立失敗（缺少 draftId）');
            setNoteDraftId(id);
            setNoteDraftMeta(resp?.draft || null);
            setNoteDraftReadOnly(false);
            return { draftId: id };
          }

          await authService.updateDraftMeta(noteDraftId, {
            title,
            subject,
            grade: picked.grade,
            scope: picked.scope,
            folderId: picked.folderId
          });
          await authService.updateDraftContent(noteDraftId, contentSnapshot);
          setNoteDraftMeta((prev) => ({ ...(prev || {}), title, subject, grade: picked.grade, scope: picked.scope, folderId: picked.folderId }));
          return { draftId: noteDraftId };
        }}
        onPublished={() => {
          setNoteWizardOpen(false);
          resetNoteDraftEditor();
        }}
      />

      <DraftSavePublishWizardModal
        open={gameWizardOpen}
        mode={gameWizardMode}
        onClose={() => setGameWizardOpen(false)}
        authService={authService}
        availableGrades={teacherGradeOptions}
        availableClasses={availableClasses}
        title={getCurrentGameTitle()}
        allowShared={true}
        initialLocation={{
          scope: gameDraftMeta?.scope === 'shared' ? 'shared' : 'my',
          grade: String(gameDraftMeta?.grade || teacherGradeOptions[0] || ''),
          folderId: gameDraftMeta?.folderId ? String(gameDraftMeta.folderId) : null
        }}
        readOnlyLocation={gameDraftReadOnly}
        keepDraftDefault={true}
        keepDraftLocked={gameDraftReadOnly}
        onSave={async (picked) => {
          const title = getCurrentGameTitle();
          const subject = getCurrentGameSubject();
          if (!title) throw new Error('請先輸入標題');
          if (!gameType) throw new Error('請先選擇遊戲類型');
          if (gameDraftReadOnly && gameDraftId) return { draftId: gameDraftId };

          const forPublish = gameWizardMode === 'publish';

          const buildGamePayload = () => {
            if (gameType === 'maze') {
              const questions = Array.isArray(gameForm.questions) ? gameForm.questions : [];
              if (forPublish && questions.length === 0) throw new Error('請至少新增一個題目');
              return {
                gameType: 'maze',
                description: getCurrentGameDescription(),
                difficulty: gameForm.difficulty,
                questions,
                editorState: { gameForm }
              };
            }
            if (gameType === 'matching') {
              const rawPairs = Array.isArray(gameForm.questions) ? gameForm.questions : [];
              const cleanedPairs = rawPairs
                .map((q) => ({ question: String(q.question || '').trim(), answer: String(q.answer || '').trim() }))
                .filter((q) => q.question && q.answer);
              const requiredPairs = gameForm.difficulty === 'easy' ? 4 : gameForm.difficulty === 'hard' ? 8 : 6;
              if (forPublish && cleanedPairs.length < requiredPairs) throw new Error(`請至少輸入 ${requiredPairs} 對配對內容`);
              return {
                gameType: 'matching',
                description: getCurrentGameDescription(),
                difficulty: gameForm.difficulty,
                questions: forPublish ? cleanedPairs.slice(0, requiredPairs) : cleanedPairs,
                editorState: { gameForm }
              };
            }
            if (gameType === 'tower-defense') {
              const cleanedQuestions: any[] = Array.isArray(towerDefenseQuestions)
                ? towerDefenseQuestions
                  .map((q: any) => {
                    const options = (q.options || []).map((o: any) => String(o || '').trim());
                    const correctIndex = Number.isInteger(q.correctIndex) ? q.correctIndex : 0;
                    const safeCorrectIndex = Math.max(0, Math.min(3, correctIndex));
                    if (q.type === 'match') {
                      return { type: 'match', left: String(q.left || '').trim(), options, correctIndex: safeCorrectIndex };
                    }
                    return { type: 'mcq', prompt: String(q.prompt || '').trim(), options, correctIndex: safeCorrectIndex };
                  })
                  .filter((q: any) => {
                    const filledOptions = Array.isArray(q.options) && q.options.length === 4 && q.options.every((o: any) => String(o || '').trim());
                    if (!filledOptions) return false;
                    return q.type === 'match' ? Boolean(q.left.trim()) : Boolean(q.prompt.trim());
                  })
                : [];
              if (forPublish && cleanedQuestions.length === 0) throw new Error('請至少新增一個完整題目（四個選項都要填，且需選擇正確答案）');
              return {
                gameType: 'tower-defense',
                description: getCurrentGameDescription(),
                difficulty: gameForm.difficulty,
                questions: cleanedQuestions,
                timeLimitSeconds: clampTowerDefenseTimeSeconds(towerDefenseTimeSecondsText, towerDefenseTimeSeconds),
                livesLimit: towerDefenseLivesEnabled ? towerDefenseLivesLimit : null,
                editorState: { gameForm, towerDefenseQuestions, towerDefenseTimeSeconds, towerDefenseTimeSecondsText, towerDefenseLivesEnabled, towerDefenseLivesLimit }
              };
            }
            if (gameType === 'ranger-td') {
              const wrongTowerDamage = Math.max(1, Math.min(99, Number.parseInt(String(rangerWrongTowerDamageText || '2').trim(), 10) || 2));
              const towerHp = Math.max(5, Math.min(999, Number.parseInt(String(rangerTowerHpText || '20').trim(), 10) || 20));
              const isMcq = rangerAnswerMode === 'mcq';
              const questionsPayload: any[] = (() => {
                if (!isMcq) return [];
                return (Array.isArray(rangerMcqQuestions) ? rangerMcqQuestions : [])
                  .filter((q: any) => q.type === 'mcq')
                  .map((q: any) => {
                    const options = (q.options || []).map((o: any) => String(o || '').trim());
                    const correctIndex = Number.isInteger(q.correctIndex) ? q.correctIndex : 0;
                    const safeCorrectIndex = Math.max(0, Math.min(3, correctIndex));
                    return { type: 'mcq', prompt: String(q.prompt || '').trim(), options, correctIndex: safeCorrectIndex };
                  })
                  .filter((q: any) => q.prompt && Array.isArray(q.options) && q.options.length === 4 && q.options.every((o: any) => String(o || '').trim()));
              })();
              if (forPublish && isMcq && questionsPayload.length === 0) throw new Error('請至少新增一個完整題目（四個選項都要填，且需選擇正確答案）');
              if (forPublish && !isMcq && rangerAllowedOps.length === 0) throw new Error('請至少選擇一種運算（加/減/乘/除）');
              const rangerTdPayload: any = {
                answerMode: rangerAnswerMode,
                perStageQuestionCount: rangerStageQuestionCount,
                wrongTowerDamage,
                towerHp
              };
              if (!isMcq) {
                const eqPercent = Math.max(0, Math.min(100, Number.parseInt(String(rangerEquationPercentText || '0').trim(), 10) || 0));
                const decPercent = Math.max(0, Math.min(100, Number.parseInt(String(rangerDecimalPercentText || '0').trim(), 10) || 0));
                rangerTdPayload.grade = rangerGrade;
                rangerTdPayload.equationPercent = eqPercent;
                rangerTdPayload.decimalPercent = decPercent;
                rangerTdPayload.allowedOps = rangerAllowedOps;
                rangerTdPayload.allowParentheses = rangerOps.paren;
                rangerTdPayload.constraints = rangerConstraints;
                rangerTdPayload.promptText = rangerPromptText;
              }
              return {
                gameType: 'ranger-td',
                description: getCurrentGameDescription(),
                difficulty: 'medium',
                questions: questionsPayload,
                timeLimitSeconds: clampTowerDefenseTimeSeconds(rangerRunSecondsText, rangerRunSeconds),
                livesLimit: null,
                rangerTd: rangerTdPayload,
                editorState: {
                  rangerForm,
                  rangerAnswerMode,
                  rangerGrade,
                  rangerStageQuestionCount,
                  rangerEquationPercentText,
                  rangerDecimalPercentText,
                  rangerOps,
                  rangerRunSeconds,
                  rangerRunSecondsText,
                  rangerAllowNegative,
                  rangerMinValueText,
                  rangerMaxValueText,
                  rangerMaxDenText,
                  rangerMaxDecimalPlacesText,
                  rangerEquationSteps,
                  rangerEquationAnswerType,
                  rangerMcqQuestions,
                  rangerWrongTowerDamageText,
                  rangerTowerHpText,
                  rangerPromptText
                }
              };
            }
            if (gameType === 'math') {
              if (forPublish && mathAllowedOps.length === 0 && mathQuestionType === 'calc') throw new Error('請至少選擇一種運算（加/減/乘/除）');
              if (forPublish && !mathDrafts.length) throw new Error('請新增至少一題');
              const questions = forPublish
                ? (mathQuestionType === 'equation'
                  ? finalizeMathEquationQuestions(
                    mathDrafts.map((d) => {
                      if (d.kind !== 'eq') throw new Error('題目類型不一致，請重新切換題目類型');
                      return { equation: d.equation || '' };
                    }),
                    { answerMode: mathAnswerMode, allowedOps: mathAllowedOps, allowParentheses: mathOps.paren, constraints: mathConstraints }
                  )
                  : finalizeMathQuestions(
                    mathDrafts.map((d) => {
                      if (d.kind !== 'expr') throw new Error('題目類型不一致，請重新切換題目類型');
                      return { tokens: d.tokens || [] };
                    }),
                    { answerMode: mathAnswerMode, allowedOps: mathAllowedOps, allowParentheses: mathOps.paren, constraints: mathConstraints }
                  ))
                : [];
              const mathPayload = {
                answerMode: mathAnswerMode,
                questionType: mathQuestionType,
                numberMode: mathNumberMode,
                allowedOps: mathAllowedOps,
                allowParentheses: mathOps.paren,
                allowNegative: mathAllowNegative,
                range: { min: mathConstraints.minValue, max: mathConstraints.maxValue },
                maxDen: mathConstraints.maxDen,
                maxDecimalPlaces: mathConstraints.maxDecimalPlaces,
                equationSteps: mathConstraints.equationSteps,
                equationAnswerType: mathConstraints.equationAnswerType,
                grade: mathGrade
              };
              return {
                gameType: 'math',
                description: getCurrentGameDescription(),
                difficulty: 'medium',
                questions,
                timeLimitSeconds: mathTimeEnabled ? clampTowerDefenseTimeSeconds(mathTimeSecondsText, mathTimeSeconds) : null,
                livesLimit: null,
                math: mathPayload,
                editorState: {
                  mathForm,
                  mathGameTab,
                  mathAnswerMode,
                  mathQuestionType,
                  mathGrade,
                  mathOps,
                  mathNumberMode,
                  mathAllowNegative,
                  mathMinValueText,
                  mathMaxValueText,
                  mathMaxDenText,
                  mathMaxDecimalPlacesText,
                  mathEquationSteps,
                  mathEquationAnswerType,
                  mathQuestionCount,
                  mathTimeEnabled,
                  mathTimeSeconds,
                  mathTimeSecondsText,
                  mathDrafts
                }
              };
            }
            throw new Error('未支援的遊戲類型');
          };

          const contentSnapshot = {
            game: {
              ...buildGamePayload()
            }
          };

          if (!gameDraftId) {
            const resp = await authService.createDraft({
              toolType: 'game',
              title,
              subject,
              grade: picked.grade,
              scope: picked.scope,
              folderId: picked.folderId,
              contentSnapshot
            });
            const id = String(resp?.draft?.id || '');
            if (!id) throw new Error('建立失敗（缺少 draftId）');
            setGameDraftId(id);
            setGameDraftMeta(resp?.draft || null);
            setGameDraftReadOnly(false);
            return { draftId: id };
          }

          await authService.updateDraftMeta(gameDraftId, {
            title,
            subject,
            grade: picked.grade,
            scope: picked.scope,
            folderId: picked.folderId
          });
          await authService.updateDraftContent(gameDraftId, contentSnapshot);
          setGameDraftMeta((prev) => ({ ...(prev || {}), title, subject, grade: picked.grade, scope: picked.scope, folderId: picked.folderId }));
          return { draftId: gameDraftId };
        }}
        onPublished={() => {
          setGameWizardOpen(false);
          resetGameEditor();
        }}
      />

      <TemplateLibraryModal
        open={showTemplateLibrary}
        onClose={() => setShowTemplateLibrary(false)}
        authService={authService}
        userId={String(user?.id || '')}
        availableClasses={availableClasses}
      />

		      {/* Settings Modal */}
		      {showSettingsModal && (
		        <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4">
			          <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-3xl shadow-comic-xl max-h-[90vh] overflow-y-auto">
			            <div className="p-6 border-b-4 border-brand-brown bg-[#D9F3D5]">
			              <div className="flex justify-between items-center">
			                <div>
			                  <h2 className="text-2xl font-black text-brand-brown">設定</h2>
			                </div>
			                <button
			                  onClick={() => setShowSettingsModal(false)}
			                  className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
			                  aria-label="關閉"
		                >
		                  <X className="w-6 h-6 text-brand-brown" />
		                </button>
			              </div>
			            </div>

			            <div className="p-6 space-y-4">
			              <>
			                <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 text-sm text-gray-700">
			                  設定後，作業管理會顯示「同科同級其他教師」派發的任務（可查看學生回應/結果，但不可刪除任務）。
			                </div>

			                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
			                  <div>
			                    <label className="block text-sm font-bold text-gray-600 mb-2">所屬班級</label>
			                    <select
			                      value={teacherSettingsDraft.homeroomClass}
			                      onChange={(e) => setTeacherSettingsDraft((prev) => ({ ...prev, homeroomClass: e.target.value }))}
			                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl"
			                    >
			                      <option value="">未設定</option>
			                      {availableClasses.map((className) => (
			                        <option key={className} value={className}>{className}</option>
			                      ))}
			                    </select>
			                  </div>
			                </div>

			                <div>
			                  <div className="text-sm font-black text-gray-700 mb-2">任教科目</div>
			                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
			                    {VISIBLE_SUBJECTS.map((subject) => {
			                      const checked = teacherSettingsDraft.subjectsTaught.includes(subject);
			                      return (
			                        <label
			                          key={subject}
			                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer ${checked ? 'bg-[#FDEEAD] border-brand-brown' : 'bg-white border-gray-200 hover:border-brand-brown'}`}
			                        >
			                          <input
			                            type="checkbox"
			                            checked={checked}
			                            onChange={() => toggleSubjectTaught(subject)}
			                            className="w-4 h-4"
			                          />
			                          <span className="font-bold text-gray-700">{subject}</span>
			                        </label>
			                      );
			                    })}
			                  </div>
			                </div>

			                {teacherSettingsDraft.subjectsTaught.length > 0 && (
			                  <div className="space-y-3">
			                    <div className="text-sm font-black text-gray-700">科目分組</div>
			                    {teacherSettingsDraft.subjectsTaught.map((subject) => {
			                      const groups = groupOptionsBySubject[subject] || [];
			                      const selectedGroups = teacherSettingsDraft.subjectGroups[subject] || [];
			                      return (
			                        <div key={subject} className="p-4 rounded-2xl border-2 border-gray-200 bg-gray-50">
			                          <div className="font-black text-gray-700 mb-2">{subject}</div>
			                          {groups.length > 0 ? (
			                            <div className="flex flex-wrap gap-2">
			                              {groups.map((group) => {
			                                const checked = selectedGroups.includes(group);
			                                return (
			                                  <label
			                                    key={group}
			                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer ${checked ? 'bg-white border-brand-brown' : 'bg-white border-gray-200 hover:border-brand-brown'}`}
			                                  >
			                                    <input
			                                      type="checkbox"
			                                      checked={checked}
			                                      onChange={() => toggleSubjectGroup(subject, group)}
			                                      className="w-4 h-4"
			                                    />
			                                    <span className="font-bold text-gray-700">{group}</span>
			                                  </label>
			                                );
			                              })}
			                            </div>
			                          ) : (
			                            <div className="text-sm text-gray-500">本科暫無分組（或未提供分組名單）</div>
			                          )}
			                        </div>
			                      );
			                    })}
			                  </div>
			                )}

			                {teacherSettingsError && (
			                  <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-sm text-red-700 font-bold">
			                    {teacherSettingsError}
			                  </div>
			                )}

			                <div className="flex items-center gap-3 pt-2">
			                  <button
			                    type="button"
			                    onClick={() => setShowSettingsModal(false)}
			                    className="px-5 py-2 bg-gray-100 border-2 border-gray-300 rounded-2xl font-black text-gray-700 hover:bg-gray-200"
			                  >
			                    關閉
			                  </button>
			                  <button
			                    type="button"
			                    onClick={saveTeacherSettings}
			                    disabled={teacherSettingsSaving}
			                    className={`ml-auto px-6 py-2 rounded-2xl border-2 border-brand-brown font-black ${teacherSettingsSaving ? 'bg-gray-300 text-gray-600 cursor-wait' : 'bg-[#FDEEAD] text-brand-brown hover:bg-[#FCE690]'}`}
			                  >
			                    {teacherSettingsSaving ? '儲存中...' : '儲存'}
			                  </button>
			                </div>
			              </>
			            </div>
			          </div>
			        </div>
			      )}

			      <AiQuestionGeneratorModal
			        open={showAiGenerator}
			        mode={aiGeneratorMode}
			        subject={aiGeneratorSubject}
			        title={aiGeneratorTitle}
			        importModes={aiGeneratorImportModes}
			        onClose={() => setShowAiGenerator(false)}
			        onImport={(payload, importMode) => aiGeneratorOnImportRef.current(payload, importMode)}
			      />

      {/* Teacher Game Preview Modal */}
      {showGamePreviewModal && previewGame && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-[70] flex items-center justify-center p-4">
          <div className="bg-[#2D2D2D] border-4 border-[#4A4A4A] rounded-3xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
            <div className="bg-[#1A1A1A] p-4 flex justify-between items-center border-b-2 border-[#4A4A4A]">
              <div>
                <h2 className="text-2xl font-black text-white tracking-widest">{previewGame.title}（試玩預覽）</h2>
                <p className="text-gray-400 text-sm">
                  {previewGame.gameType === 'matching'
                    ? '記憶配對'
                    : previewGame.gameType === 'math'
                      ? '數學測驗'
                    : previewGame.gameType === 'maze'
                      ? '知識迷宮'
                      : previewGame.gameType === 'ranger-td'
                        ? 'Ranger 塔防'
                        : '答題塔防'} • {previewGame.subject}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setShowGamePreviewModal(false); setPreviewGame(null); setPreviewResult(null); }}
                  className="w-10 h-10 rounded-full bg-[#333] hover:bg-[#444] text-white flex items-center justify-center transition-colors"
                >
                  <X />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-[#222] p-6 overflow-y-auto relative">
              {previewGame.gameType === 'math' && (
                <MathGame
                  game={previewGame}
                  gameId={previewGame.id}
                  onExit={() => { setShowGamePreviewModal(false); setPreviewGame(null); setPreviewResult(null); }}
                  onStart={() => { }}
                  onComplete={(result) => setPreviewResult(result)}
                />
              )}

              {previewGame.gameType === 'ranger-td' && (
                <RangerTdGame
                  game={previewGame}
                  gameId={previewGame.id}
                  onExit={() => { setShowGamePreviewModal(false); setPreviewGame(null); setPreviewResult(null); }}
                  onStart={() => { }}
                  onComplete={(result) => setPreviewResult(result)}
                />
              )}

              {previewGame.gameType === 'tower-defense' && (
                <TowerDefenseGame
                  questions={previewGame.questions || []}
                  subject={previewGame.subject as Subject}
                  difficulty={(previewGame.difficulty || 'medium') as any}
                  durationSeconds={Number(previewGame.timeLimitSeconds) || 60}
                  livesLimit={previewGame.livesLimit ?? null}
                  onExit={() => { setShowGamePreviewModal(false); setPreviewGame(null); setPreviewResult(null); }}
                  onStart={() => { }}
                  onComplete={(result) => setPreviewResult(result)}
                />
              )}

              {previewGame.gameType === 'maze' && (
                <MazeGame
                  questions={(Array.isArray(previewGame.questions) ? previewGame.questions : []).map((q: any, i: number) => {
                    const allOptions = [q.answer, ...(q.wrongOptions || [])].filter(Boolean);
                    const shuffledOptions = [...allOptions].sort(() => Math.random() - 0.5).slice(0, 4);
                    const correctIndex = shuffledOptions.indexOf(q.answer);
                    return {
                      id: `mz-prev-${previewGame.id}-${i}`,
                      text: q.question,
                      options: shuffledOptions,
                      correctIndex: correctIndex >= 0 ? correctIndex : 0
                    };
                  })}
                  onExit={() => { setShowGamePreviewModal(false); setPreviewGame(null); setPreviewResult(null); }}
                  onComplete={(finalScore) => setPreviewResult({ success: true, score: finalScore })}
                />
              )}

              {previewGame.gameType === 'matching' && (
                <MatchingGamePreview
                  questions={previewGame.questions || []}
                  onExit={() => { setShowGamePreviewModal(false); setPreviewGame(null); setPreviewResult(null); }}
                  onComplete={(result) => setPreviewResult(result)}
                />
              )}

              {previewResult && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-6">
                  <div className="bg-white rounded-3xl border-4 border-brand-brown shadow-comic p-6 w-full max-w-md text-center">
                    <div className="text-3xl font-black text-brand-brown mb-2">預覽完成</div>
                    {'score' in previewResult && (
                      <div className="text-lg font-bold text-gray-700 mb-4">分數：{Math.round(Number(previewResult.score) || 0)}</div>
                    )}
                    <div className="flex gap-3 justify-center">
                      <button
                        type="button"
                        onClick={() => setPreviewResult(null)}
                        className="px-5 py-2 rounded-2xl bg-[#FDEEAD] border-2 border-brand-brown text-brand-brown font-black hover:bg-[#FCE690]"
                      >
                        再玩一次
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowGamePreviewModal(false); setPreviewGame(null); setPreviewResult(null); }}
                        className="px-5 py-2 rounded-2xl bg-gray-100 border-2 border-gray-300 text-gray-700 font-black hover:bg-gray-200"
                      >
                        關閉
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Student Quiz Result Detail Modal */}
      {
        viewingResultDetails && selectedAssignment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-comic">
              <div className="p-6 border-b-4 border-brand-brown bg-[#FDEEAD]">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-black text-brand-brown">
                      {viewingResultDetails.studentName} 的答題詳情
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      得分: {Math.round(viewingResultDetails.score)}% •
                      用時: {viewingResultDetails.timeSpent ? Math.round(viewingResultDetails.timeSpent / 60) : 0} 分鐘
                    </p>
                  </div>
                  <button
                    onClick={() => setViewingResultDetails(null)}
                    className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                  >
                    <X className="w-6 h-6 text-brand-brown" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {selectedAssignment.type === 'quiz' && selectedAssignment.questions?.map((question: any, index: number) => {
                  const answersArr = Array.isArray(viewingResultDetails.answers) ? viewingResultDetails.answers : [];
                  const studentAnswer = answersArr[index];
                  const isCorrect = studentAnswer === question.correctAnswer;

                  return (
                    <div key={index} className={`p-6 rounded-2xl border-2 ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold ${isCorrect ? 'bg-green-500' : 'bg-red-500'}`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-lg text-brand-brown mb-2 whitespace-pre-wrap">{question.question}</h4>
                          {question.image && (
                            <img
                              src={question.image}
                              alt="Question"
                              className="max-h-48 rounded-lg border-2 border-gray-200 mb-4"
                            />
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                            {question.options.map((option: string, optIndex: number) => {
                              const isStudentSelected = studentAnswer === optIndex;
                              const isCorrectOption = question.correctAnswer === optIndex;

                              let optionClass = "bg-white border-gray-200 text-gray-600";
                              if (isCorrectOption) optionClass = "bg-green-100 border-green-500 text-green-700 font-bold";
                              else if (isStudentSelected && !isCorrectOption) optionClass = "bg-red-100 border-red-500 text-red-700";
                              else if (isStudentSelected && isCorrectOption) optionClass = "bg-green-100 border-green-500 text-green-700 font-bold";

                              return (
                                <div key={optIndex} className={`p-3 rounded-xl border-2 flex items-center gap-3 ${optionClass}`}>
                                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs ${isCorrectOption ? 'border-green-600 bg-green-600 text-white' :
                                    (isStudentSelected ? 'border-red-500 bg-red-500 text-white' : 'border-gray-400')
                                    }`}>
                                    {String.fromCharCode(65 + optIndex)}
                                  </div>
                                  <span>{option}</span>
                                  {isStudentSelected && (
                                    <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full bg-white bg-opacity-50">
                                      學生選擇
                                    </span>
                                  )}
                                  {isCorrectOption && !isStudentSelected && (
                                    <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full bg-white bg-opacity-50 text-green-700">
                                      正確答案
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {selectedAssignment.type === 'game' && (
                  <div className="space-y-4">
                    <div className="bg-white border-2 border-gray-200 rounded-2xl p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div><span className="font-bold text-gray-600">遊戲：</span>{selectedAssignment.title}</div>
                        <div><span className="font-bold text-gray-600">類型：</span>{selectedAssignment.gameType}</div>
                        <div><span className="font-bold text-gray-600">得分：</span>{Math.round(viewingResultDetails.score)}%</div>
                        <div><span className="font-bold text-gray-600">正確：</span>{viewingResultDetails.correctAnswers}/{viewingResultDetails.totalQuestions}</div>
                        <div><span className="font-bold text-gray-600">用時：</span>{viewingResultDetails.timeSpent ? `${Math.round(viewingResultDetails.timeSpent)} 秒` : '未記錄'}</div>
                        <div><span className="font-bold text-gray-600">提交：</span>{new Date(viewingResultDetails.completedAt || viewingResultDetails.submittedAt || Date.now()).toLocaleString()}</div>
                      </div>
                    </div>

                    {selectedAssignment.gameType === 'math' && viewingResultDetails.details?.type === 'math' && Array.isArray(viewingResultDetails.details?.answers) ? (
                      <div className="space-y-3">
                        {viewingResultDetails.details.answers.map((row: any) => {
                          const q = (Array.isArray(selectedAssignment.questions) ? selectedAssignment.questions : [])[row.index];
                          return (
                            <div key={row.index} className={`p-4 rounded-2xl border-2 ${row.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                              <div className="flex items-start gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold ${row.ok ? 'bg-green-500' : 'bg-red-500'}`}>{row.index + 1}</div>
                                <div className="flex-1">
                                  <div className="font-bold text-brand-brown mb-2">
                                    {Array.isArray(q?.tokens) ? (
                                      <MathExpressionView tokens={q.tokens} />
                                    ) : (Array.isArray(q?.equation?.leftTokens) && Array.isArray(q?.equation?.rightTokens)) ? (
                                      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <MathExpressionView tokens={q.equation.leftTokens} />
                                        <span className="px-0.5 font-black">=</span>
                                        <MathExpressionView tokens={q.equation.rightTokens} />
                                      </span>
                                    ) : (
                                      '（題目缺失）'
                                    )}
                                  </div>
                                  <div className="flex items-center gap-6 flex-wrap text-sm">
                                    <div className="inline-flex items-center gap-2">
                                      <span className="font-bold text-gray-700">學生：</span>
                                      <FractionView value={row.userAnswer} className="font-black" />
                                    </div>
                                    <div className="inline-flex items-center gap-2">
                                      <span className="font-bold text-gray-700">正確：</span>
                                      <FractionView value={row.correctAnswer} className="font-black" />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4 text-sm text-yellow-900 font-bold">
                        此遊戲暫未提供逐題作答記錄回放（只有數學測驗會記錄學生每題答案）。
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-6 border-t-2 border-gray-200 bg-gray-50 rounded-b-3xl">
                <button
                  onClick={() => setViewingResultDetails(null)}
                  className="w-full py-3 bg-brand-brown text-white font-bold rounded-xl hover:bg-opacity-90"
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Contest Creation Modal */}
      {showContestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-comic">
            <div className="p-6 border-b-4 border-brand-brown bg-[#FFF2DC]">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black text-brand-brown">🏁 創建問答比賽</h2>
                <button
                  onClick={() => {
                    setShowContestModal(false);
                    resetContestEditor();
                  }}
                  className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                  aria-label="關閉"
                >
                  <X className="w-6 h-6 text-brand-brown" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {contestDraftReadOnly && (
                <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl text-sm text-gray-700 font-bold mb-6">
                  共用草稿（唯讀）：你可以直接「儲存及派發」，但不可修改內容。如需修改請先在教師資料夾按「複製到我的」。
                </div>
              )}
              <div className="bg-orange-50 p-4 rounded-xl border-2 border-orange-200 mb-6">
                <p className="text-orange-800 text-sm">
                  🏁 <strong>比賽說明：</strong>教師只需設定題目規則，學生點擊開始時由AI即時生成不同題目。每位學生可重複參賽，系統會記錄所有成績並提供3種排行榜。
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 基本資訊 */}
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-brand-brown">基本資訊</h3>

                  <Input
                    label="比賽標題"
                    placeholder="輸入比賽標題..."
                    value={contestForm.title}
                    onChange={(e) => setContestForm(prev => ({ ...prev, title: e.target.value }))}
                    disabled={contestDraftReadOnly}
                  />

                  <Input
                    label="主題 (可選)"
                    placeholder="例如：第一單元 - 自然景觀..."
                    value={contestForm.topic}
                    onChange={(e) => setContestForm(prev => ({ ...prev, topic: e.target.value }))}
                    disabled={contestDraftReadOnly}
                  />

                  <div>
                    <label className="block text-sm font-bold text-brand-brown mb-2">科目</label>
                    <select
                      className="w-full px-4 py-2 border-4 border-gray-300 rounded-2xl bg-white font-bold"
                      value={contestForm.subject}
                      onChange={(e) => {
                        const newSubject = e.target.value as Subject;
                        setContestForm(prev => ({ ...prev, subject: newSubject }));
                      }}
                      disabled={contestDraftReadOnly}
                    >
                      {VISIBLE_SUBJECTS.map(subject => (
                        <option key={subject} value={subject}>{subject}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-brand-brown mb-2">年級</label>
                    <select
                      className="w-full px-4 py-2 border-4 border-gray-300 rounded-2xl bg-white font-bold"
                      value={contestForm.grade}
                      onChange={(e) => setContestForm(prev => ({ ...prev, grade: e.target.value }))}
                      disabled={contestDraftReadOnly}
                    >
                      {['小一', '小二', '小三', '小四', '小五', '小六'].map(grade => (
                        <option key={grade} value={grade}>{grade}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 題目設定 */}
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-brand-brown">題目設定</h3>

                  <div>
                    <label className="block text-sm font-bold text-brand-brown mb-2">題目數量</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      className="w-full px-4 py-2 border-4 border-gray-300 rounded-2xl font-bold"
                      value={contestForm.questionCount}
                      onChange={(e) => setContestForm(prev => ({ ...prev, questionCount: parseInt(e.target.value) || 10 }))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-brand-brown mb-2">限時 (秒，留空表示不限時)</label>
                    <input
                      type="number"
                      min="10"
                      max="1800"
                      className="w-full px-4 py-2 border-4 border-gray-300 rounded-2xl font-bold"
                      placeholder="例如：300"
                      value={contestForm.timeLimitSeconds ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setContestForm(prev => ({
                          ...prev,
                          timeLimitSeconds: val === '' ? null : parseInt(val) || null
                        }));
                      }}
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={contestForm.advancedOnly}
                        onChange={(e) => setContestForm(prev => ({ ...prev, advancedOnly: e.target.checked }))}
                        className="w-5 h-5"
                        disabled={contestDraftReadOnly}
                      />
                      <div>
                        <div className="font-bold text-brand-brown">進階模式</div>
                        <div className="text-sm text-gray-600">開啟後，AI只會根據下方「範圍輸入」出題，不會使用外部知識</div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* 範圍輸入 */}
              <div className="mt-6">
                <h3 className="text-xl font-bold text-brand-brown mb-2">範圍輸入 (可選)</h3>
                <p className="text-sm text-gray-600 mb-3">
                  可貼入課文、筆記、詞彙表等內容，AI會優先從這些範圍出題
                </p>
                <textarea
                  className="w-full px-4 py-3 border-4 border-gray-300 rounded-2xl font-mono text-sm"
                  rows={6}
                  placeholder="例如：春天到了，樹木長出新芽，花朵綻放..."
                  value={contestForm.scopeText}
                  onChange={(e) => setContestForm(prev => ({ ...prev, scopeText: e.target.value }))}
                  disabled={contestDraftReadOnly}
                />
              </div>

              {/* 按鈕區 */}
              <div className="flex gap-4 pt-6 mt-6 border-t-4 border-gray-200">
                  <button
                    onClick={async () => {
                      const isOwner = String(contestDraftMeta?.ownerTeacherId || user?.id || '') === String(user?.id || '');
                      const canDelete = !!contestDraftId && isOwner && !contestDraftReadOnly;
                      if (canDelete) {
                        const ok = window.confirm('取消＝刪除草稿。確定要刪除嗎？');
                        if (!ok) return;
                        try {
                          await authService.deleteDraft(contestDraftId);
                          alert('草稿已刪除');
                        } catch (e: any) {
                          alert(e?.message || '刪除失敗');
                          return;
                        }
                      }
                      setShowContestModal(false);
                      resetContestEditor();
                    }}
                    className="flex-1 py-3 rounded-2xl border-4 border-gray-300 text-gray-600 font-bold hover:bg-gray-100"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      const title = String(contestForm.title || '').trim();
                      if (!title) return alert('請輸入標題');
                      if (contestDraftReadOnly) return;
                      setContestWizardMode('save');
                      setContestWizardOpen(true);
                    }}
                    disabled={contestDraftReadOnly}
                    className="flex-1 py-3 rounded-2xl border-4 border-brand-brown bg-white text-brand-brown font-bold hover:bg-gray-50 shadow-comic active:translate-y-1 active:shadow-none disabled:opacity-60"
                  >
                    儲存
                  </button>
                  <button
                    onClick={() => {
                      const title = String(contestForm.title || '').trim();
                      if (!title) return alert('請輸入標題');
                      setContestWizardMode('publish');
                      setContestWizardOpen(true);
                    }}
                    className="flex-1 py-3 rounded-2xl border-4 border-brand-brown bg-[#FFF2DC] text-brand-brown font-bold hover:bg-[#FCEBCD] shadow-comic active:translate-y-1 active:shadow-none"
                  >
                    儲存及派發
                  </button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};

export default TeacherDashboard;                                                                                                                                                                                                                                                                                          
