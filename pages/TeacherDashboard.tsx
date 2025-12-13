import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Menu, Settings, SlidersHorizontal, User, LogOut, MessageSquare, Plus, X, Image, Link, Code, Bold, Italic, Underline, Type, Palette, Upload, Trash, Filter, Eye, EyeOff, HelpCircle, Clock, Bot } from 'lucide-react';
import Button from '../components/Button';
import Select from '../components/Select';
import Input from '../components/Input';
import AiQuestionGeneratorModal from '../components/AiQuestionGeneratorModal';
import UiSettingsModal from '../components/UiSettingsModal';
import AiChatModal from '../components/AiChatModal';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { sanitizeHtml } from '../services/sanitizeHtml';
import { loadHiddenTaskKeys, makeTaskKey, parseTaskKey, saveHiddenTaskKeys } from '../services/taskVisibility';
import { Subject, Discussion } from '../types';

const TeacherDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { logout, user, refreshUser } = useAuth();

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showUiSettings, setShowUiSettings] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);

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
    subject: Subject.CHINESE,
    targetClasses: [] as string[],
    targetGroups: [] as string[],
    content: ''
  });

  // 小測驗相關狀態
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [imageUploading, setImageUploading] = useState(false); // New state for tracking image upload status
  const [quizForm, setQuizForm] = useState({
    title: '',
    description: '',
    subject: Subject.CHINESE,
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

  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [aiGeneratorMode, setAiGeneratorMode] = useState<'mcq' | 'pairs'>('mcq');
  const [aiGeneratorTitle, setAiGeneratorTitle] = useState('AI 生成題目');
  const [aiGeneratorSubject, setAiGeneratorSubject] = useState<string>(String(Subject.CHINESE));
  const [aiGeneratorImportModes, setAiGeneratorImportModes] = useState<Array<'replace' | 'append'>>(['replace']);
  const aiGeneratorOnImportRef = useRef<(payload: any, mode: 'replace' | 'append') => void>(() => {});

  const [editorRef, setEditorRef] = useState<HTMLDivElement | null>(null);
  const [currentFontSize, setCurrentFontSize] = useState('16');
  const [currentTextColor, setCurrentTextColor] = useState('#000000');

  // 作業管理相關狀態
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [assignmentResponses, setAssignmentResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [myBots, setMyBots] = useState<any[]>([]);
  const [showBotTaskAssignModal, setShowBotTaskAssignModal] = useState(false);
  const [botTaskForm, setBotTaskForm] = useState<{ botId: string; subject: string; targetClasses: string[]; targetGroups: string[] }>({
    botId: '',
    subject: String(Subject.CHINESE),
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
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [viewingResultDetails, setViewingResultDetails] = useState<any>(null); // State for viewing specific student result details
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
    received: number;
    completed: number;
    pending: number;
  }>>([]);
  const [progressSearch, setProgressSearch] = useState('');
  const [progressFilterClass, setProgressFilterClass] = useState('');
  const [progressFilterSubject, setProgressFilterSubject] = useState('');
  const [progressIncludeHidden, setProgressIncludeHidden] = useState(false);

  // 小遊戲相關狀態
  const [showGameModal, setShowGameModal] = useState(false);
	  const [gameType, setGameType] = useState<'maze' | 'matching' | 'tower-defense' | null>(null);
  const [gameForm, setGameForm] = useState({
    title: '',
    description: '',
    subject: Subject.CHINESE,
    targetClasses: [] as string[],
    targetGroups: [] as string[],
    questions: [] as Array<{
      question: string;
      answer: string;
      wrongOptions?: string[];
    }>,
    difficulty: 'medium' as 'easy' | 'medium' | 'hard'
  });

  const [towerDefenseQuestions, setTowerDefenseQuestions] = useState<Array<{
    question: string;
    options: string[];
    correctAnswer: number;
  }>>([]);
  const [towerDefenseTimeSeconds, setTowerDefenseTimeSeconds] = useState(60);

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

  const parseGradeFromClassName = (className?: string) => {
    const match = String(className || '').match(/^(\d+)/);
    return match ? match[1] : '';
  };

  // 載入作業列表（包含小測驗和遊戲）
  const loadAssignments = async () => {
    try {
      setLoading(true);

      // 並行載入自己的作業、小測驗和遊戲
      const [assignmentData, quizData, gameData, botTaskData] = await Promise.all([
        authService.getTeacherAssignments(filterSubject || undefined, filterClass || undefined),
        authService.getTeacherQuizzes(filterSubject || undefined, filterClass || undefined),
        authService.getTeacherGames(filterSubject || undefined, filterClass || undefined),
        authService.getTeacherBotTasks(filterSubject || undefined, filterClass || undefined)
      ]);

      const mine = [
        ...(assignmentData.assignments || []).map((item: any) => ({ ...item, type: 'assignment' })),
        ...(quizData.quizzes || []).map((item: any) => ({ ...item, type: 'quiz' })),
        ...(gameData.games || []).map((item: any) => ({ ...item, type: 'game' })),
	        ...(botTaskData.tasks || []).map((item: any) => ({
	          ...item,
	          type: 'ai-bot',
	          title: item.title || item.botName || 'Pedia 任務',
	          targetClasses: item.targetClasses || [],
	          responseCount: item.completedStudents ?? 0,
	          uniqueStudents: item.completedStudents ?? 0
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
	      alert('請先在「AI對話 → Pedia」建立一個 Pedia，才可以派發。');
	      return;
	    }

	    const defaultBotId = String(bots[0]?.id || '');
	    const defaultSubject = filterSubject || String(Subject.CHINESE);
	    setBotTaskForm({
	      botId: defaultBotId,
	      subject: defaultSubject,
	      targetClasses: filterClass ? [filterClass] : [],
	      targetGroups: []
	    });
	    loadClassesAndGroups(defaultSubject);
	    setShowBotTaskAssignModal(true);
	  };

  const submitBotTaskAssign = async () => {
    try {
      if (!botTaskForm.botId) return alert('請選擇 Pedia');
      if (!botTaskForm.subject) return alert('請選擇科目');
      if (botTaskForm.targetClasses.length === 0 && botTaskForm.targetGroups.length === 0) return alert('請選擇班級或分組');
      await authService.createBotTask({
        botId: botTaskForm.botId,
        subject: botTaskForm.subject,
        targetClasses: botTaskForm.targetClasses,
        targetGroups: botTaskForm.targetGroups
      });
      alert('Pedia 任務已派發！');
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
    try {
      const [subjectsData, classesData] = await Promise.all([
        authService.getAvailableSubjects(),
        authService.getAvailableClasses()
      ]);
      setAvailableSubjects(subjectsData.subjects || []);
      setAvailableClasses(classesData.classes || []);
    } catch (error) {
      console.error('載入篩選選項失敗:', error);
    }
  };

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

      if (isGame) {
        // 載入遊戲結果
        const data = await authService.getGameResults(assignment.id);
        setSelectedAssignment(assignment);
        setAssignmentResponses(data.scores || []); // 遊戲成績
        setEditedContent(assignment.description || '迷宮追逐遊戲');
      } else if (isQuiz) {
        // 載入小測驗結果
        const data = await authService.getQuizResults(assignment.id);
        setSelectedAssignment(assignment);
        setAssignmentResponses(data.results || []); // 測驗結果
        setEditedContent(assignment.description || '小測驗');
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
    const itemType = assignment.type === 'quiz' ? '小測驗' : assignment.type === 'game' ? '遊戲' : assignment.type === 'ai-bot' ? 'Pedia任務' : '作業';
    if (!confirm(`確定要刪除整個${itemType}及其所有回應嗎？此操作無法復原！`)) return;

    try {
      if (assignment.type === 'quiz') await authService.deleteQuiz(assignment.id);
      else if (assignment.type === 'game') await authService.deleteGame(assignment.id);
      else if (assignment.type === 'ai-bot') await authService.deleteBotTask(assignment.id);
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
      const next = new Set(prev);
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

      const [studentsData, assignmentData, quizData, gameData, botTaskData] = await Promise.all([
        authService.getStudentRoster({ limit: 2000 }),
        authService.getTeacherAssignments(progressFilterSubject || undefined, progressFilterClass || undefined),
        authService.getTeacherQuizzes(progressFilterSubject || undefined, progressFilterClass || undefined),
        authService.getTeacherGames(progressFilterSubject || undefined, progressFilterClass || undefined),
        authService.getTeacherBotTasks(progressFilterSubject || undefined, progressFilterClass || undefined)
      ]);

      const students = (studentsData.users || []).filter((u: any) => u?.role === 'student');

      const tasksAll = [
        ...(assignmentData.assignments || []).map((item: any) => ({ ...item, type: 'assignment' as const })),
        ...(quizData.quizzes || []).map((item: any) => ({ ...item, type: 'quiz' as const })),
        ...(gameData.games || []).map((item: any) => ({ ...item, type: 'game' as const })),
        ...(botTaskData.tasks || []).map((item: any) => ({ ...item, type: 'ai-bot' as const }))
      ];

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

	  // 監聽篩選條件變化
	  useEffect(() => {
	    if (showAssignmentModal) {
	      loadAssignments();
    }
  }, [filterSubject, filterClass, filterGroup, showAssignmentModal]);

  // 監聽討論串模態框開啟
  useEffect(() => {
    if (showDiscussionModal) {
      loadClassesAndGroups(discussionForm.subject);
    }
  }, [showDiscussionModal]);

  // 監聽小測驗模態框開啟
  useEffect(() => {
    if (showQuizModal) {
      loadClassesAndGroups(quizForm.subject);
    }
  }, [showQuizModal]);

  // 監聽遊戲模態框開啟
  useEffect(() => {
    if (showGameModal) {
      loadClassesAndGroups(gameForm.subject);
    }
  }, [showGameModal]);

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

  // === 答題塔防題庫（四選一） ===
  const addTowerDefenseQuestion = () => {
    setTowerDefenseQuestions(prev => ([
      ...prev,
      { question: '', options: ['', '', '', ''], correctAnswer: 0 }
    ]));
  };

  const removeTowerDefenseQuestion = (index: number) => {
    setTowerDefenseQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const updateTowerDefenseQuestion = (index: number, field: 'question' | 'correctAnswer', value: any) => {
    setTowerDefenseQuestions(prev => prev.map((q, i) => i === index ? { ...q, [field]: value } : q));
  };

  const updateTowerDefenseOption = (questionIndex: number, optionIndex: number, value: string) => {
    setTowerDefenseQuestions(prev => prev.map((q, i) =>
      i === questionIndex
        ? { ...q, options: q.options.map((opt, j) => j === optionIndex ? value : opt) }
        : q
    ));
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

    if (quizForm.targetClasses.length === 0 && quizForm.targetGroups.length === 0) {
      alert('請選擇班級或分組');
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
        subject: quizForm.subject,
        targetClasses: quizForm.targetClasses,
        targetGroups: quizForm.targetGroups,
        questions: quizForm.questions,
        timeLimit: quizForm.timeLimit
      });

      alert('小測驗創建成功！');
      setShowQuizModal(false);
      setQuizForm({
        title: '',
        description: '',
        subject: Subject.CHINESE,
        targetClasses: [],
        targetGroups: [],
        questions: [],
        timeLimit: 0
      });

    } catch (error) {
      console.error('創建小測驗失敗:', error);
      alert('創建小測驗失敗：' + (error instanceof Error ? error.message : '未知錯誤'));
    }
  };

  const handleSubmitDiscussion = async () => {
    if (!discussionForm.title) {
      alert('請填寫標題');
      return;
    }

    if (discussionForm.targetClasses.length === 0 && discussionForm.targetGroups.length === 0) {
      alert('請選擇班級或分組');
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
        targetGroups: discussionForm.targetGroups
      });

      alert('討論串派發成功！');
      setShowDiscussionModal(false);
      setDiscussionForm({
        title: '',
        subject: Subject.CHINESE,
        targetClasses: [],
        targetGroups: [],
        content: ''
      });

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
        defaultSubject={filterSubject || String(Subject.CHINESE)}
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                  <div>
                    <label className="block text-sm font-bold text-gray-600 mb-2">科目</label>
                    <select
                      value={progressFilterSubject}
                      onChange={(e) => setProgressFilterSubject(e.target.value)}
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
                        <th className="p-4 border-b-4 border-brand-brown text-brand-brown font-black">收到</th>
                        <th className="p-4 border-b-4 border-brand-brown text-brand-brown font-black">完成</th>
                        <th className="p-4 border-b-4 border-brand-brown text-brand-brown font-black">未完成</th>
                        <th className="p-4 border-b-4 border-brand-brown text-brand-brown font-black">完成率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progressRows.map((row) => {
                        const pct = row.received > 0 ? Math.round((row.completed / row.received) * 100) : 0;
                        return (
                          <tr key={row.id} className="bg-white odd:bg-[#FEF7EC]">
                            <td className="p-4 border-b-2 border-gray-200">
                              <div className="font-bold text-brand-brown">{row.name}</div>
                              <div className="text-sm text-gray-600">{row.username}</div>
                            </td>
                            <td className="p-4 border-b-2 border-gray-200 font-bold text-gray-700">{row.className || '-'}</td>
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

      {/* Mobile Drawer Sidebar */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-black/50"
            aria-label="關閉選單"
            onClick={closeSidebar}
          />
          <aside className="absolute inset-y-0 left-0 w-[min(22rem,85vw)] bg-[#D9F3D5] border-r-4 border-brand-brown shadow-2xl overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-black text-brand-brown font-rounded">Lpedia</h1>
                <button
                  onClick={closeSidebar}
                  className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                  aria-label="關閉"
                >
                  <X className="w-6 h-6 text-brand-brown" />
                </button>
              </div>

              {/* User Profile Section */}
              <div className="text-center mb-6">
                <div className="w-20 h-20 rounded-full border-4 border-brand-brown bg-white mb-3 overflow-hidden mx-auto">
                  <img src="/teacher_login.png" alt="Teacher Avatar" className="w-full h-full object-cover" />
                </div>
                <div className="text-lg font-bold text-brand-brown">{user?.profile?.name || '教師'}</div>
                <div className="text-sm text-gray-600">{user?.username}</div>
              </div>

              <div className="text-center mb-6 border-b-4 border-brand-brown pb-3 mx-2">
                <h2 className="text-xl font-bold text-brand-brown">教師工具包</h2>
              </div>

              <nav className="space-y-3">
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
	                  className="bg-[#D2EFFF] hover:bg-[#BCE0FF] flex items-center justify-center gap-2"
	                  onClick={() => {
	                    openBotTaskAssign();
	                    closeSidebar();
	                  }}
	                >
	                  <Bot className="w-5 h-5" />
	                  派發Pedia
	                </Button>
	                <Button
	                  fullWidth
	                  className="bg-[#F8C5C5] hover:bg-[#F0B5B5] flex items-center justify-center gap-2"
	                  onClick={() => {
	                    setShowDiscussionModal(true);
                    closeSidebar();
                  }}
                >
                  <MessageSquare className="w-5 h-5" />
                  派發討論串
                </Button>
                <Button
                  fullWidth
                  className="bg-[#FDEEAD] hover:bg-[#FCE690] flex items-center justify-center gap-2"
                  onClick={() => {
                    setShowQuizModal(true);
                    closeSidebar();
                  }}
                >
                  <HelpCircle className="w-5 h-5" />
                  派發小測驗
                </Button>
                <Button
                  fullWidth
                  className="bg-[#E8F5E9] hover:bg-[#C8E6C9] flex items-center justify-center gap-2"
                  onClick={() => {
                    openGameCreator();
                    closeSidebar();
                  }}
                >
                  🎮 創建小遊戲
                </Button>
                <Button fullWidth className="bg-[#FAD5BE] hover:bg-[#F8C4A6]" onClick={closeSidebar}>
                  更多功能開發中⋯⋯
                </Button>
              </nav>
            </div>
          </aside>
        </div>
      )}

      {/* Sidebar */}
      <aside className="hidden lg:flex relative z-10 w-full lg:w-80 bg-[#D9F3D5] min-h-fit my-0 lg:my-auto ml-0 rounded-b-[3rem] lg:rounded-b-none lg:rounded-r-[3rem] border-4 lg:border-l-0 border-brand-brown shadow-2xl flex-col p-6">
        <div className="flex items-center justify-center mb-2">
          <h1 className="text-4xl font-black text-brand-brown font-rounded">Lpedia</h1>
        </div>

        {/* User Profile Section */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 rounded-full border-4 border-brand-brown bg-white mb-3 overflow-hidden mx-auto">
            <img
              src="/teacher_login.png"
              alt="Teacher Avatar"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-lg font-bold text-brand-brown">
            {user?.profile?.name || '教師'}
          </div>
          <div className="text-sm text-gray-600">
            {user?.username}
          </div>
        </div>

        <div className="text-center mb-8 border-b-4 border-brand-brown pb-4 mx-4">
          <h2 className="text-2xl font-bold text-brand-brown">教師工具包</h2>
        </div>

        <nav className="flex-1 space-y-4 px-2">
          <Button
            fullWidth
            className="bg-[#D2EFFF] hover:bg-[#BCE0FF] text-lg"
            onClick={() => setShowAiChat(true)}
          >
            AI對話
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
	            className="bg-[#D2EFFF] hover:bg-[#BCE0FF] text-lg flex items-center justify-center gap-2"
	            onClick={openBotTaskAssign}
	          >
	            <Bot className="w-5 h-5" />
	            派發Pedia
	          </Button>
	          <Button
	            fullWidth
	            className="bg-[#F8C5C5] hover:bg-[#F0B5B5] text-lg flex items-center justify-center gap-2"
	            onClick={() => setShowDiscussionModal(true)}
	          >
            <MessageSquare className="w-5 h-5" />
            派發討論串
          </Button>
          <Button
            fullWidth
            className="bg-[#FDEEAD] hover:bg-[#FCE690] text-lg flex items-center justify-center gap-2"
            onClick={() => setShowQuizModal(true)}
          >
            <HelpCircle className="w-5 h-5" />
            派發小測驗
          </Button>
	          <Button
	            fullWidth
	            className="bg-[#E8F5E9] hover:bg-[#C8E6C9] text-lg flex items-center justify-center gap-2"
	            onClick={openGameCreator}
	          >
	            🎮 創建小遊戲
	          </Button>
          <Button fullWidth className="bg-[#FAD5BE] hover:bg-[#F8C4A6] text-lg">更多功能開發中⋯⋯</Button>
        </nav>
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
                    {Object.values(Subject).map(subject => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Target Classes */}
              <div>
                <label className="block text-sm font-bold text-purple-800 mb-2">派發至班級</label>
                <div className="flex flex-wrap gap-2">
                  {availableClasses.map(className => (
                    <button
                      key={className}
                      type="button"
                      onClick={() => {
                        setGameForm(prev => ({
                          ...prev,
                          targetClasses: prev.targetClasses.includes(className)
                            ? prev.targetClasses.filter(c => c !== className)
                            : [...prev.targetClasses, className]
                        }));
                      }}
                      className={`px-4 py-2 rounded-2xl border-2 font-bold transition-colors ${gameForm.targetClasses.includes(className)
                        ? 'bg-purple-200 border-purple-500 text-purple-700'
                        : 'bg-white border-gray-300 text-gray-600 hover:border-purple-500'
                        }`}
                    >
                      {className}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Groups */}
              {availableGroups.length > 0 && (
                <div>
                  <label className="block text-sm font-bold text-purple-800 mb-2">
                    選擇分組 ({gameForm.subject})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableGroups.map(groupName => (
                      <button
                        key={groupName}
                        type="button"
                        onClick={() => {
                          setGameForm(prev => ({
                            ...prev,
                            targetGroups: prev.targetGroups.includes(groupName)
                              ? prev.targetGroups.filter(g => g !== groupName)
                              : [...prev.targetGroups, groupName]
                          }));
                        }}
                        className={`px-4 py-2 rounded-2xl border-2 font-bold transition-colors ${gameForm.targetGroups.includes(groupName)
                          ? 'bg-purple-200 border-purple-500 text-purple-700'
                          : 'bg-white border-gray-300 text-gray-600 hover:border-purple-500'
                          }`}
                      >
                        {groupName}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                  onClick={() => { setGameType(null); }}
                  className="flex-1 py-3 rounded-2xl border-4 border-gray-300 text-gray-600 font-bold hover:bg-gray-100"
                >
                  返回
                </button>
                <button
                  onClick={async () => {
                    try {
                      if (!gameForm.title) {
                        alert('請填寫遊戲標題');
                        return;
                      }
                      if (gameForm.targetClasses.length === 0 && gameForm.targetGroups.length === 0) {
                        alert('請選擇至少一個班級或分組');
                        return;
                      }
                      if (gameForm.questions.length === 0) {
                        alert('請至少新增一個題目');
                        return;
                      }

                      await authService.createGame({
                        title: gameForm.title,
                        description: gameForm.description,
                        gameType: 'maze',
                        subject: gameForm.subject,
                        targetClasses: gameForm.targetClasses,
                        targetGroups: gameForm.targetGroups,
                        questions: gameForm.questions,
                        difficulty: gameForm.difficulty
                      });

                      alert('迷宮追逐遊戲創建成功！');
                      setShowGameModal(false);
                      setGameType(null);
                      setGameForm({
                        title: '',
                        description: '',
                        subject: Subject.CHINESE,
                        targetClasses: [],
                        targetGroups: [],
                        questions: [],
                        difficulty: 'medium'
                      });
                    } catch (error) {
                      alert('創建遊戲失敗：' + (error instanceof Error ? error.message : '未知錯誤'));
                    }
                  }}
                  className="flex-1 py-3 rounded-2xl border-4 border-purple-500 bg-purple-500 text-white font-bold hover:bg-purple-600"
                >
                  創建遊戲
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
	                    loadClassesAndGroups(newSubject);
	                  }}
	                >
	                  {Object.values(Subject).map(subject => (
	                    <option key={subject} value={subject}>{subject}</option>
	                  ))}
	                </select>
	              </div>

	              {/* Target Classes */}
	              <div>
	                <label className="block text-sm font-bold text-blue-800 mb-2">派發至班級</label>
	                <div className="flex flex-wrap gap-2">
	                  {availableClasses.map(className => (
	                    <button
	                      key={className}
	                      type="button"
	                      onClick={() => {
	                        setGameForm(prev => ({
	                          ...prev,
	                          targetClasses: prev.targetClasses.includes(className)
	                            ? prev.targetClasses.filter(c => c !== className)
	                            : [...prev.targetClasses, className]
	                        }));
	                      }}
	                      className={`px-4 py-2 rounded-2xl border-2 font-bold transition-colors ${gameForm.targetClasses.includes(className)
	                        ? 'bg-blue-200 border-blue-500 text-blue-800'
	                        : 'bg-white border-gray-300 text-gray-600 hover:border-blue-500'
	                        }`}
	                    >
	                      {className}
	                    </button>
	                  ))}
	                </div>
	              </div>

	              {/* Target Groups */}
	              {availableGroups.length > 0 && (
	                <div>
	                  <label className="block text-sm font-bold text-blue-800 mb-2">
	                    選擇分組 ({gameForm.subject})
	                  </label>
	                  <div className="flex flex-wrap gap-2">
	                    {availableGroups.map(groupName => (
	                      <button
	                        key={groupName}
	                        type="button"
	                        onClick={() => {
	                          setGameForm(prev => ({
	                            ...prev,
	                            targetGroups: prev.targetGroups.includes(groupName)
	                              ? prev.targetGroups.filter(g => g !== groupName)
	                              : [...prev.targetGroups, groupName]
	                          }));
	                        }}
	                        className={`px-4 py-2 rounded-2xl border-2 font-bold transition-colors ${gameForm.targetGroups.includes(groupName)
	                          ? 'bg-blue-100 border-blue-500 text-blue-700'
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
                  onClick={() => { setGameType(null); }}
                  className="flex-1 py-3 rounded-2xl border-4 border-gray-300 text-gray-600 font-bold hover:bg-gray-100"
                >
                  返回
                </button>
	                <button
	                  onClick={() => {
	                    (async () => {
	                      try {
	                        if (!gameForm.title.trim()) {
	                          alert('請輸入遊戲標題');
	                          return;
	                        }

	                        if (gameForm.targetClasses.length === 0 && gameForm.targetGroups.length === 0) {
	                          alert('請選擇至少一個班級或分組');
	                          return;
	                        }

	                        const requiredPairs = gameForm.difficulty === 'easy' ? 4 : gameForm.difficulty === 'medium' ? 6 : 8;
	                        const cleanedPairs = gameForm.questions
	                          .map(q => ({
	                            question: q.question.trim(),
	                            answer: q.answer.trim()
	                          }))
	                          .filter(q => q.question && q.answer);

	                        if (cleanedPairs.length < requiredPairs) {
	                          alert(`請至少輸入 ${requiredPairs} 對配對內容`);
	                          return;
	                        }

	                        await authService.createGame({
	                          title: gameForm.title.trim(),
	                          description: gameForm.description,
	                          gameType: 'matching',
	                          subject: gameForm.subject,
	                          targetClasses: gameForm.targetClasses,
	                          targetGroups: gameForm.targetGroups,
	                          questions: cleanedPairs.slice(0, requiredPairs),
	                          difficulty: gameForm.difficulty
	                        });

	                        alert('翻牌記憶遊戲創建成功！');
	                        setShowGameModal(false);
	                        setGameType(null);
	                        setGameForm({
	                          title: '',
	                          description: '',
	                          subject: Subject.CHINESE,
	                          targetClasses: [],
	                          targetGroups: [],
	                          questions: [],
	                          difficulty: 'medium'
	                        });
	                      } catch (error) {
	                        alert('創建遊戲失敗：' + (error instanceof Error ? error.message : '未知錯誤'));
	                      }
	                    })();
	                  }}
	                  className="flex-1 py-3 rounded-2xl border-4 border-blue-500 bg-blue-500 text-white font-bold hover:bg-blue-600"
	                >
	                  創建遊戲
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
			                  onClick={() => { setShowGameModal(false); setGameType(null); setTowerDefenseQuestions([]); setTowerDefenseTimeSeconds(60); }}
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
	                    loadClassesAndGroups(newSubject);
	                  }}
	                >
	                  {Object.values(Subject).map(subject => (
	                    <option key={subject} value={subject}>{subject}</option>
	                  ))}
	                </select>
	              </div>

	              {/* Target Classes */}
	              <div>
	                <label className="block text-sm font-bold text-emerald-800 mb-2">派發至班級</label>
	                <div className="flex flex-wrap gap-2">
	                  {availableClasses.map(className => (
	                    <button
	                      key={className}
	                      type="button"
	                      onClick={() => {
	                        setGameForm(prev => ({
	                          ...prev,
	                          targetClasses: prev.targetClasses.includes(className)
	                            ? prev.targetClasses.filter(c => c !== className)
	                            : [...prev.targetClasses, className]
	                        }));
	                      }}
	                      className={`px-4 py-2 rounded-2xl border-2 font-bold transition-colors ${gameForm.targetClasses.includes(className)
	                        ? 'bg-emerald-200 border-emerald-500 text-emerald-800'
	                        : 'bg-white border-gray-300 text-gray-600 hover:border-emerald-500'
	                        }`}
	                    >
	                      {className}
	                    </button>
	                  ))}
	                </div>
	              </div>

	              {/* Target Groups */}
	              {availableGroups.length > 0 && (
	                <div>
	                  <label className="block text-sm font-bold text-emerald-800 mb-2">
	                    選擇分組 ({gameForm.subject})
	                  </label>
	                  <div className="flex flex-wrap gap-2">
	                    {availableGroups.map(groupName => (
	                      <button
	                        key={groupName}
	                        type="button"
	                        onClick={() => {
	                          setGameForm(prev => ({
	                            ...prev,
	                            targetGroups: prev.targetGroups.includes(groupName)
	                              ? prev.targetGroups.filter(g => g !== groupName)
	                              : [...prev.targetGroups, groupName]
	                          }));
	                        }}
	                        className={`px-4 py-2 rounded-2xl border-2 font-bold transition-colors ${gameForm.targetGroups.includes(groupName)
	                          ? 'bg-lime-200 border-lime-500 text-lime-900'
	                          : 'bg-white border-gray-300 text-gray-600 hover:border-lime-500'
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
		                    type="number"
		                    min={10}
		                    max={600}
		                    value={towerDefenseTimeSeconds}
		                    onChange={(e) => setTowerDefenseTimeSeconds(Math.max(10, Math.min(600, parseInt(e.target.value) || 60)))}
		                    className="w-full px-4 py-2 border-4 border-emerald-300 rounded-2xl bg-white font-bold"
		                  />
		                  <p className="text-xs text-gray-500 mt-1">建議 30–180 秒；預設 60 秒</p>
		                </div>
		              </div>

		              <div>
		                <label className="block text-sm font-bold text-emerald-800 mb-2">題庫（答題賺金幣）</label>
		                <div className="border-2 border-emerald-200 rounded-2xl p-4 bg-white">
			                  <div className="flex justify-between items-center mb-4">
			                    <span className="font-bold text-emerald-800">問題列表（四選一）</span>
			                    <div className="flex gap-2">
			                      <button
			                        type="button"
			                        onClick={() => openAiGenerator({
			                          mode: 'mcq',
			                          title: 'AI 生成答題塔防題目',
			                          subject: String(gameForm.subject),
			                          importModes: ['replace', 'append'],
			                          onImport: (payload, importMode) => {
			                            const incoming = (payload.mcq || []).map((q: any) => ({
			                              question: q.question,
			                              options: q.options,
			                              correctAnswer: q.correctIndex
			                            })).filter((q: any) => q.question && Array.isArray(q.options) && q.options.length === 4);
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
			                        onClick={addTowerDefenseQuestion}
			                        className="px-4 py-2 bg-emerald-100 text-emerald-800 border-2 border-emerald-300 rounded-2xl font-bold hover:bg-emerald-200 flex items-center gap-2"
			                      >
			                        <Plus className="w-4 h-4" />
			                        新增問題
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
		                            <h4 className="text-lg font-bold text-emerald-900">問題 {questionIndex + 1}</h4>
		                            <button
		                              type="button"
		                              onClick={() => removeTowerDefenseQuestion(questionIndex)}
		                              className="p-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200"
		                            >
		                              <Trash className="w-4 h-4" />
		                            </button>
		                          </div>

		                          <div className="space-y-4">
		                            <Input
		                              label="問題內容"
		                              placeholder="輸入問題..."
		                              value={q.question}
		                              onChange={(e) => updateTowerDefenseQuestion(questionIndex, 'question', e.target.value)}
		                            />

		                            <div>
		                              <label className="block text-sm font-bold text-emerald-800 mb-2">選項</label>
		                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
		                                {q.options.map((option, optionIndex) => (
		                                  <div key={optionIndex} className="relative">
		                                    <div className={`flex items-center gap-3 p-3 rounded-2xl border-2 ${q.correctAnswer === optionIndex ? 'bg-emerald-100 border-emerald-400' : 'bg-white border-emerald-200'
		                                      }`}>
		                                      <input
		                                        type="radio"
		                                        name={`td-correct-${questionIndex}`}
		                                        checked={q.correctAnswer === optionIndex}
		                                        onChange={() => updateTowerDefenseQuestion(questionIndex, 'correctAnswer', optionIndex)}
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
		                                    {q.correctAnswer === optionIndex && (
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
	                  onClick={() => { setGameType(null); }}
	                  className="flex-1 py-3 rounded-2xl border-4 border-gray-300 text-gray-600 font-bold hover:bg-gray-100"
	                >
	                  返回
	                </button>
	                <button
	                  onClick={async () => {
	                    try {
	                      if (!gameForm.title.trim()) {
	                        alert('請填寫遊戲標題');
	                        return;
	                      }
	                      if (gameForm.targetClasses.length === 0 && gameForm.targetGroups.length === 0) {
	                        alert('請選擇至少一個班級或分組');
	                        return;
	                      }
		                      const cleanedQuestions = towerDefenseQuestions
		                        .map(q => {
		                          const question = q.question.trim();
		                          const options = (q.options || []).map(o => o.trim());
		                          const correctIndex = q.correctAnswer ?? 0;
		                          const answer = options[correctIndex] || '';
		                          const wrongOptions = options.filter((_, i) => i !== correctIndex).filter(Boolean);
		                          return { question, answer, wrongOptions };
		                        })
		                        .filter(q => q.question && q.answer && q.wrongOptions.length >= 3);
		                      if (cleanedQuestions.length === 0) {
		                        alert('請至少新增一個完整題目（四個選項都要填，且需選擇正確答案）');
		                        return;
		                      }

		                      await authService.createGame({
		                        title: gameForm.title.trim(),
		                        description: gameForm.description,
		                        gameType: 'tower-defense',
		                        subject: gameForm.subject,
		                        targetClasses: gameForm.targetClasses,
		                        targetGroups: gameForm.targetGroups,
		                        questions: cleanedQuestions,
		                        difficulty: gameForm.difficulty,
		                        timeLimitSeconds: towerDefenseTimeSeconds
		                      });

		                      alert('答題塔防遊戲創建成功！');
		                      setShowGameModal(false);
		                      setGameType(null);
			                      setTowerDefenseQuestions([]);
			                      setTowerDefenseTimeSeconds(60);
			                      setGameForm({
			                        title: '',
			                        description: '',
			                        subject: Subject.CHINESE,
			                        targetClasses: [],
			                        targetGroups: [],
			                        questions: [],
			                        difficulty: 'medium'
			                      });
	                    } catch (error) {
	                      alert('創建遊戲失敗：' + (error instanceof Error ? error.message : '未知錯誤'));
	                    }
	                  }}
	                  className="flex-1 py-3 rounded-2xl border-4 border-emerald-600 bg-emerald-600 text-white font-bold hover:bg-emerald-700"
	                >
	                  創建遊戲
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
                    onClick={() => setShowDiscussionModal(false)}
                    className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                  >
                    <X className="w-6 h-6 text-brand-brown" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="討論串標題"
                    placeholder="輸入討論串標題..."
                    value={discussionForm.title}
                    onChange={(e) => setDiscussionForm(prev => ({ ...prev, title: e.target.value }))}
                  />
                  <div>
                    <label className="block text-sm font-bold text-brand-brown mb-2">選擇科目</label>
                    <select
                      className="w-full px-4 py-2 border-4 border-brand-brown rounded-2xl bg-white font-bold"
                      value={discussionForm.subject}
                      onChange={(e) => {
                        const newSubject = e.target.value as Subject;
                        setDiscussionForm(prev => ({ ...prev, subject: newSubject, targetClasses: [], targetGroups: [] }));
                        loadClassesAndGroups(newSubject);
                      }}
                    >
                      {Object.values(Subject).map(subject => (
                        <option key={subject} value={subject}>{subject}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Target Classes */}
                <div>
                  <label className="block text-sm font-bold text-brand-brown mb-2">派發至班級</label>
                  <div className="flex flex-wrap gap-2">
                    {availableClasses.map(className => (
                      <button
                        key={className}
                        type="button"
                        onClick={() => {
                          setDiscussionForm(prev => ({
                            ...prev,
                            targetClasses: prev.targetClasses.includes(className)
                              ? prev.targetClasses.filter(c => c !== className)
                              : [...prev.targetClasses, className]
                          }));
                        }}
                        className={`px-4 py-2 rounded-2xl border-2 font-bold transition-colors ${discussionForm.targetClasses.includes(className)
                          ? 'bg-[#F8C5C5] border-brand-brown text-brand-brown'
                          : 'bg-white border-gray-300 text-gray-600 hover:border-brand-brown'
                          }`}
                      >
                        {className}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Groups (show if groups are available for the subject) */}
                {availableGroups.length > 0 && (
                  <div>
                    <label className="block text-sm font-bold text-brand-brown mb-2">
                      選擇分組 ({discussionForm.subject})
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {availableGroups.map(groupName => (
                        <button
                          key={groupName}
                          type="button"
                          onClick={() => {
                            setDiscussionForm(prev => ({
                              ...prev,
                              targetGroups: prev.targetGroups.includes(groupName)
                                ? prev.targetGroups.filter(g => g !== groupName)
                                : [...prev.targetGroups, groupName]
                            }));
                          }}
                          className={`px-4 py-2 rounded-2xl border-2 font-bold transition-colors ${discussionForm.targetGroups.includes(groupName)
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

                {/* Rich Text Editor */}
                <div>
                  <label className="block text-sm font-bold text-brand-brown mb-2">討論串內容</label>

                  {/* Editor Toolbar */}
                  <div className="border-2 border-gray-300 rounded-t-xl p-3 bg-gray-50 flex flex-wrap gap-2 items-center">
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
                    contentEditable
                    className="w-full min-h-[300px] px-4 py-3 border-2 border-t-0 border-gray-300 rounded-b-xl bg-white font-sans text-sm leading-relaxed focus:outline-none"
                    style={{ fontSize: currentFontSize + 'px', color: currentTextColor }}
                    onInput={(e) => {
                      const target = e.target as HTMLDivElement;
                      setDiscussionForm(prev => ({
                        ...prev,
                        content: target.innerHTML
                      }));
                    }}
                    placeholder="開始輸入您的討論串內容...&#10;&#10;💡 使用方式：&#10;• 直接打字輸入內容&#10;• 選擇文字後點擊工具列按鈕進行格式化&#10;• 使用 B (粗體)、I (斜體)、U (底線) 快速格式化&#10;• 上傳圖片或插入連結來豐富內容"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4 border-t-2 border-gray-200">
                  <Button
                    className="flex-1 bg-gray-300 text-gray-700 hover:bg-gray-400"
                    onClick={() => setShowDiscussionModal(false)}
                  >
                    取消
                  </Button>
                  <Button
                    className="flex-1 bg-[#F8C5C5] text-brand-brown hover:bg-[#F0B5B5] border-brand-brown"
                    onClick={handleSubmitDiscussion}
                  >
                    派發討論串
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Assignment Management Modal */}
	      {
	        showAssignmentModal && (
	          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-comic">
              <div className="p-6 border-b-4 border-brand-brown bg-[#C0E2BE]">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-black text-brand-brown">作業管理</h2>
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
	                                      <span className={`px-2 py-1 rounded-lg ${isGame ? 'bg-green-100' : isQuiz ? 'bg-yellow-100' : isBot ? 'bg-emerald-100' : 'bg-purple-100'}`}>
	                                        {isGame ? '🎮' : isQuiz ? '🧠' : isBot ? '🤖' : '📚'} {assignment.subject}
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
	                                            <span className={`px-2 py-1 rounded-lg ${isGame ? 'bg-blue-100' : isQuiz ? 'bg-orange-100' : 'bg-yellow-100'}`}>
	                                              {isGame ? '🏆' : isQuiz ? '📊' : '💬'} {isGame ? (assignment.totalAttempts || 0) : isQuiz ? (assignment.totalSubmissions || 0) : (assignment.responseCount || 0)} 個{isGame ? '遊玩記錄' : isQuiz ? '提交' : '回應'}
	                                            </span>
	                                          )}
	                                          {!isBot && (
	                                            <span className="bg-purple-100 px-2 py-1 rounded-lg">
	                                              👥 {assignment.uniqueStudents || 0} 位學生
	                                            </span>
	                                          )}
	                                          {(isQuiz || isGame) && assignment.averageScore !== undefined && (
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
		                                            : 'bg-purple-200 text-purple-800'
		                                        }`}>
		                                        {isQuiz
		                                          ? '小測驗'
		                                          : isGame
	                                            ? (assignment.gameType === 'maze'
	                                              ? '迷宮闖關'
	                                              : assignment.gameType === 'matching'
	                                                ? '翻牌記憶'
	                                                : assignment.gameType === 'tower-defense'
	                                                  ? '答題塔防'
	                                                  : '小遊戲')
			                                                : isBot
			                                                  ? 'Pedia任務'
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
		                                      {isBot ? '查看對話' : (isQuiz || isGame) ? '查看結果' : '查看回應'}
		                                    </button>
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
	                                                : 'bg-purple-200 text-purple-800'
	                                            }`}>
	                                            {isQuiz
	                                              ? '小測驗'
	                                              : isGame
                                                ? (assignment.gameType === 'maze'
                                                  ? '迷宮闖關'
                                                  : assignment.gameType === 'matching'
                                                    ? '翻牌記憶'
                                                    : assignment.gameType === 'tower-defense'
                                                      ? '答題塔防'
                                                      : '小遊戲')
		                                                : isBot
		                                                  ? 'Pedia任務'
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
	                                          {isBot ? '查看對話' : (isQuiz || isGame) ? '查看結果' : '查看回應'}
	                                        </button>
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
		                                ? 'Pedia任務資訊'
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
                                      <span className="text-brand-brown">Q{index + 1}:</span> {question.question}
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
		                              <span className="font-bold text-brand-brown">Pedia：</span>
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
	                              <span className="font-bold text-brand-brown">類型：</span>
	                              <span>{selectedAssignment.gameType || '小遊戲'}</span>
	                            </div>
	                            <div>
	                              <span className="font-bold text-brand-brown">描述：</span>
	                              <span>{selectedAssignment.description || '—'}</span>
	                            </div>
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
	                            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(getDisplayContent(selectedAssignment.content)) }} />
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
                              else if (subject === '常識') studentGroup = student.profile?.gsGroup || ''; // Assuming generic or specific mapping

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
	                          <h4 className="text-xl font-bold text-brand-brown">
	                            {selectedAssignment?.type === 'quiz' ? '測驗結果' : '學生回應'} ({assignmentResponses.length})
	                          </h4>
	                          {loading ? (
	                            <div className="text-center py-8">
	                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-brown mx-auto mb-2"></div>
	                              <p className="text-brand-brown">載入中...</p>
	                            </div>
	                          ) : assignmentResponses.length > 0 ? (
	                            assignmentResponses.map(response => (
	                              <div key={response.id} className={`border-2 rounded-2xl p-4 ${selectedAssignment?.type === 'quiz' ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-300'
	                                }`}>
	                                <div className="flex justify-between items-start">
	                                  <div className="flex-1">
	                                    <div className="flex items-center gap-3 mb-2">
	                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedAssignment?.type === 'quiz' ? 'bg-yellow-500' : 'bg-brand-green-light'
	                                        }`}>
	                                        <span className="text-white font-bold text-sm">
	                                          {response.studentName?.charAt(0) || '學'}
	                                        </span>
	                                      </div>
	                                      <div>
	                                        <p className="font-bold text-brand-brown">{response.studentName}</p>
	                                        <p className="text-sm text-gray-600">{response.studentClass} • {response.studentUsername}</p>
	                                      </div>
	                                      {selectedAssignment?.type === 'quiz' && (
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
	                                        </div>
	                                      )}
	                                    </div>
	
	                                    {selectedAssignment?.type === 'quiz' || selectedAssignment?.type === 'game' ? (
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
	                                        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(response.content || response.message || '無內容') }} />
	                                      </div>
	                                    )}
	
	                                    {selectedAssignment?.type !== 'quiz' && (
	                                      <p className="text-xs text-gray-500 mt-2">
	                                        {new Date(response.createdAt).toLocaleString()}
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
		                  派發 Pedia 任務
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
	                  <label className="block text-sm font-bold text-brand-brown mb-2">選擇 Pedia</label>
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
	                      {Object.values(Subject).map((s) => (
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
	                  學生在「我的學科 → 我的任務」看到此 Pedia 任務，學生只要送出任意一句對話就算完成；你可在作業管理中查看學生對話記錄。
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
                    onClick={() => setShowQuizModal(false)}
                    className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                  >
                    <X className="w-6 h-6 text-brand-brown" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="小測驗標題"
                    placeholder="輸入小測驗標題..."
                    value={quizForm.title}
                    onChange={(e) => setQuizForm(prev => ({ ...prev, title: e.target.value }))}
                  />
                  <div>
                    <label className="block text-sm font-bold text-brand-brown mb-2">選擇科目</label>
                    <select
                      className="w-full px-4 py-2 border-4 border-brand-brown rounded-2xl bg-white font-bold"
                      value={quizForm.subject}
                      onChange={(e) => {
                        const newSubject = e.target.value as Subject;
                        setQuizForm(prev => ({ ...prev, subject: newSubject, targetClasses: [], targetGroups: [] }));
                        loadClassesAndGroups(newSubject);
                      }}
                    >
                      {Object.values(Subject).map(subject => (
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
                    />
                  </div>
                </div>

                {/* Target Classes */}
                <div>
                  <label className="block text-sm font-bold text-brand-brown mb-2">派發至班級</label>
                  <div className="flex flex-wrap gap-2">
                    {availableClasses.map(className => (
                      <button
                        key={className}
                        type="button"
                        onClick={() => {
                          setQuizForm(prev => ({
                            ...prev,
                            targetClasses: prev.targetClasses.includes(className)
                              ? prev.targetClasses.filter(c => c !== className)
                              : [...prev.targetClasses, className]
                          }));
                        }}
                        className={`px-4 py-2 rounded-2xl border-2 font-bold transition-colors ${quizForm.targetClasses.includes(className)
                          ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown'
                          : 'bg-white border-gray-300 text-gray-600 hover:border-brand-brown'
                          }`}
                      >
                        {className}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Groups (show if groups are available for the subject) */}
                {availableGroups.length > 0 && (
                  <div>
                    <label className="block text-sm font-bold text-brand-brown mb-2">
                      選擇分組 ({quizForm.subject})
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {availableGroups.map(groupName => (
                        <button
                          key={groupName}
                          type="button"
                          onClick={() => {
                            setQuizForm(prev => ({
                              ...prev,
                              targetGroups: prev.targetGroups.includes(groupName)
                                ? prev.targetGroups.filter(g => g !== groupName)
                                : [...prev.targetGroups, groupName]
                            }));
                          }}
                          className={`px-4 py-2 rounded-2xl border-2 font-bold transition-colors ${quizForm.targetGroups.includes(groupName)
                            ? 'bg-[#FFF4E6] border-orange-500 text-orange-600'
                            : 'bg-white border-gray-300 text-gray-600 hover:border-orange-500'
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
	                      >
	                        🤖 AI 生成
	                      </Button>
	                      <Button
	                        onClick={addQuestion}
	                        className="bg-green-100 text-green-700 hover:bg-green-200 border-green-300 flex items-center gap-2"
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
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="space-y-4">
                            <Input
                              label="問題內容"
                              placeholder="輸入問題..."
                              value={question.question}
                              onChange={(e) => updateQuestion(questionIndex, 'question', e.target.value)}
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
                    onClick={() => setShowQuizModal(false)}
                  >
                    取消
                  </Button>
                  <Button
                    className={`flex-1 border-brand-brown ${imageUploading
                      ? 'bg-gray-400 text-white cursor-wait'
                      : 'bg-[#FDEEAD] text-brand-brown hover:bg-[#FCE690]'
                      }`}
                    onClick={handleSubmitQuiz}
                    disabled={imageUploading}
                  >
                    {imageUploading ? '圖片處理中...' : '創建小測驗'}
                  </Button>
                </div>
              </div>
            </div>
	          </div>
	        )
	      }

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
			                    {availableSubjects.map((subject) => {
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
                {selectedAssignment.questions?.map((question: any, index: number) => {
                  const studentAnswer = viewingResultDetails.answers[index];
                  const isCorrect = studentAnswer === question.correctAnswer;

                  return (
                    <div key={index} className={`p-6 rounded-2xl border-2 ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                      }`}>
                      <div className="flex gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold ${isCorrect ? 'bg-green-500' : 'bg-red-500'
                          }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-lg text-brand-brown mb-2">{question.question}</h4>
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
    </div >
  );
};

export default TeacherDashboard;                                                                                                                                                                                                                                                                                          
