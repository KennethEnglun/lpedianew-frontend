import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Settings, LogOut, MessageSquare, HelpCircle, Bot, RefreshCw, X, Eye, EyeOff, Code2, Volume2, CheckCircle2, Star, Award, ClipboardList, BookOpen, Brain } from 'lucide-react';
import { Subject, SUBJECT_CONFIG, Task } from '../types';
import { DEFAULT_SUBJECT, SINGLE_SUBJECT_MODE, VISIBLE_SUBJECTS } from '../platform';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import UiSettingsModal from '../components/UiSettingsModal';
import AiChatModal from '../components/AiChatModal';
import BotTaskChatModal from '../components/BotTaskChatModal';
import AppStudioModal from '../components/AppStudioModal';
import ImageGenerationConfirmModal from '../components/student/ImageGenerationConfirmModal';
import StudyPracticeModal from '../components/student/StudyPracticeModal';
import { StudyHistoryPanel } from '../components/student/StudyHistoryPanel';
import { StudyAnalyticsModal } from '../components/student/StudyAnalyticsModal';
import { QuizContestModal } from '../components/QuizContestModal';
import { StudentQuizModal } from '../components/student/StudentQuizModal';
import { StudentDiscussionModal } from '../components/student/StudentDiscussionModal';
import NoteEditorModal from '../components/NoteEditorModal';
import { aiAnalyticsService } from '../services/aiAnalyticsService';
import type { StudyAnalytics, StudyScope } from '../types/study';

const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showUiSettings, setShowUiSettings] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  const [showBotTaskChat, setShowBotTaskChat] = useState(false);
  const [showAppStudio, setShowAppStudio] = useState(false);
  const [showStudyPractice, setShowStudyPractice] = useState(false);
  const [showSelfStudyHub, setShowSelfStudyHub] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<StudyAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [retrySessionScope, setRetrySessionScope] = useState<Partial<StudyScope> | null>(null);
  const [activeTab, setActiveTab] = useState<'practice' | 'history'>('practice');
  const [selectedBotTaskId, setSelectedBotTaskId] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject>(DEFAULT_SUBJECT);
  const [showTaskView, setShowTaskView] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [selectedSubfolderId, setSelectedSubfolderId] = useState<string>('');
  const [classFolders, setClassFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [responseStatus, setResponseStatus] = useState<any>({});

  const [showQuizModal, setShowQuizModal] = useState(false);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [showDiscussionModal, setShowDiscussionModal] = useState(false);
  const [selectedDiscussionId, setSelectedDiscussionId] = useState<string | null>(null);
  const [showContestModal, setShowContestModal] = useState(false);
  const [selectedContest, setSelectedContest] = useState<any | null>(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  // 點數系統狀態
  // 從 localStorage 載入點數，如果沒有則使用預設值
  const loadUserPointsFromStorage = () => {
    if (!user?.id) {
      return {
        currentPoints: 0,
        totalReceived: 0,
        totalUsed: 0,
        lastUpdate: new Date().toISOString()
      };
    }

    const userPointsKey = `userPoints_${user.id}`;
    const saved = localStorage.getItem(userPointsKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved points:', e);
      }
    }
    return {
      currentPoints: 0,
      totalReceived: 0,
      totalUsed: 0,
      lastUpdate: new Date().toISOString()
    };
  };

  const [userPoints, setUserPoints] = useState(loadUserPointsFromStorage);

  // 從 localStorage 載入交易記錄
  const loadTransactionsFromStorage = () => {
    if (!user?.id) {
      return [];
    }

    const userTransactionsKey = `pointsTransactions_${user.id}`;
    const saved = localStorage.getItem(userTransactionsKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved transactions:', e);
      }
    }
    return [];
  };

  const [pointsTransactions, setPointsTransactions] = useState(loadTransactionsFromStorage);
  const [showImageConfirm, setShowImageConfirm] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [executeImagePrompt, setExecuteImagePrompt] = useState('');

  // 保存點數變化到 localStorage
  useEffect(() => {
    if (user?.id) {
      const userPointsKey = `userPoints_${user.id}`;
      localStorage.setItem(userPointsKey, JSON.stringify(userPoints));
    }
  }, [userPoints, user?.id]);

  // 保存交易記錄到 localStorage
  useEffect(() => {
    if (user?.id) {
      const userTransactionsKey = `pointsTransactions_${user.id}`;
      localStorage.setItem(userTransactionsKey, JSON.stringify(pointsTransactions));
    }
  }, [pointsTransactions, user?.id]);

  // 當用戶變更時重新載入點數數據
  useEffect(() => {
    if (user?.id) {
      setUserPoints(loadUserPointsFromStorage());
      setPointsTransactions(loadTransactionsFromStorage());
    }
  }, [user?.id]);

  // Compute folder hierarchies
  const stageFolders = useMemo(
    () => classFolders.filter((f) => f && f.level === 1 && !f.archivedAt),
    [classFolders]
  );
  const topicFolders = useMemo(
    () => classFolders.filter((f) => f && f.level === 2 && !f.archivedAt && String(f.parentId || '') === String(selectedStageId || '')),
    [classFolders, selectedStageId]
  );
  const subFolders = useMemo(
    () => classFolders.filter((f) => f && f.level === 3 && !f.archivedAt && String(f.parentId || '') === String(selectedTopicId || '')),
    [classFolders, selectedTopicId]
  );

  const tasksInTopic = useMemo(() => {
    if (!selectedTopicId) return [];
    return tasks.filter((t: any) => {
      const snap = t?.folderSnapshot;
      const path = Array.isArray(snap?.path) ? snap.path : [];
      return path.some((p: any) => String(p?.id) === String(selectedTopicId));
    });
  }, [tasks, selectedTopicId]);

  const tasksInSubfolder = useMemo(() => {
    if (!selectedSubfolderId) return [];
    return tasks.filter((t: any) => String(t?.folderId || '') === String(selectedSubfolderId));
  }, [tasks, selectedSubfolderId]);

  // Calculate task completion status
  const isTaskCompleted = (task: Task) => {
    if (task.type === 'discussion') return !!responseStatus[task.id]?.hasResponded;
    if (task.type === 'quiz' || task.type === 'game') return !!task.completed;
    if (task.type === 'contest') {
      if (task.completed) return true;
      const attempts = Number((task as any).attempts);
      if (Number.isFinite(attempts) && attempts > 0) return true;
      const bestScore = (task as any).bestScore;
      if (typeof bestScore === 'number') return true;
      const score = (task as any).score;
      if (typeof score === 'number') return true;
      return false;
    }
    if (task.type === 'ai-bot' || task.type === 'note') return !!task.completed;
    return !!task.completed;
  };

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(isTaskCompleted).length;
    return { total, completed, pending: Math.max(0, total - completed) };
  }, [tasks, responseStatus]);

  const pendingCountByFolderId = useMemo(() => {
    const map = new Map<string, number>();
    const folderById = new Map(
      (Array.isArray(classFolders) ? classFolders : [])
        .filter((f: any) => f && f.id)
        .map((f: any) => [String(f.id), f] as const)
    );

    const addAncestors = (folderId: string) => {
      let cur = String(folderId || '');
      const visited = new Set<string>();
      while (cur && !visited.has(cur)) {
        visited.add(cur);
        map.set(cur, (map.get(cur) || 0) + 1);
        const parentId = folderById.get(cur)?.parentId;
        cur = parentId ? String(parentId) : '';
      }
    };

    for (const task of Array.isArray(tasks) ? tasks : []) {
      if (!task) continue;
      if (isTaskCompleted(task)) continue;

      const ids = new Set<string>();
      const path = Array.isArray((task as any)?.folderSnapshot?.path) ? (task as any).folderSnapshot.path : [];
      for (const p of path) {
        const id = String(p?.id || '').trim();
        if (id) ids.add(id);
      }
      const folderId = String((task as any)?.folderId || '').trim();
      if (folderId) ids.add(folderId);

      if (ids.size > 0) {
        for (const id of ids) {
          map.set(id, (map.get(id) || 0) + 1);
        }
      } else if (folderId) {
        addAncestors(folderId);
      }
    }
    return map;
  }, [tasks, responseStatus, classFolders]);

  // 添加獲取點數的函數
  const loadUserPoints = useCallback(async () => {
    try {
      try {
        const response = await authService.getUserPoints();
        setUserPoints(response);

        const transactions = await authService.getPointsHistory();
        setPointsTransactions(transactions);
      } catch (apiError) {
        console.log('Points API not available, using mock data for testing...');

        // 模擬學生點數數據
        const mockUserPoints = {
          currentPoints: 12,
          totalReceived: 20,
          totalUsed: 8,
          lastUpdate: new Date().toISOString()
        };

        // 模擬交易記錄
        const mockTransactions = [
          {
            id: 'tx1',
            userId: 'currentUser',
            type: 'admin_grant',
            amount: 10,
            balance: 18,
            description: '作業表現優秀',
            adminId: 'teacher1',
            createdAt: new Date(Date.now() - 86400000).toISOString()
          },
          {
            id: 'tx2',
            userId: 'currentUser',
            type: 'image_generation',
            amount: -1,
            balance: 15,
            description: '圖片生成',
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            metadata: {
              imagePrompt: '一片美麗的櫻花林'
            }
          },
          {
            id: 'tx3',
            userId: 'currentUser',
            type: 'admin_grant',
            amount: 5,
            balance: 10,
            description: '每日挑戰完成',
            adminId: 'teacher1',
            createdAt: new Date(Date.now() - 172800000).toISOString()
          },
          {
            id: 'tx4',
            userId: 'currentUser',
            type: 'image_generation',
            amount: -1,
            balance: 12,
            description: '圖片生成',
            createdAt: new Date(Date.now() - 7200000).toISOString(),
            metadata: {
              imagePrompt: '太空中的星球'
            }
          }
        ];

        setUserPoints(mockUserPoints);
        setPointsTransactions(mockTransactions);
      }
    } catch (error) {
      console.error('Failed to load points:', error);
    }
  }, []);

  // 處理學習分析報告
  const handleViewAnalytics = useCallback(async (analytics: StudyAnalytics) => {
    setAnalyticsData(analytics);
    setShowAnalyticsModal(true);
  }, []);

  // 處理重新練習
  const handleRetryScope = useCallback((scope: Partial<StudyScope>) => {
    // 設置重新練習的學習範圍
    setRetrySessionScope(scope);
    // 關閉自學天地
    setShowSelfStudyHub(false);
    // 開啟練習模態框
    setShowStudyPractice(true);
  }, []);

  // 重新生成分析報告
  const handleRegenerateAnalytics = useCallback(async () => {
    if (!user?.id || !user?.username) return;

    setAnalyticsLoading(true);
    try {
      const response = await aiAnalyticsService.generateEnhancedAnalytics(
        user.id.toString(),
        user.username
      );

      if (response.success && response.data) {
        setAnalyticsData(response.data);
      }
    } catch (error) {
      console.error('重新生成分析報告失敗:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [user?.id, user?.username]);

  // 處理圖片生成確認
  const handleImageGeneration = (prompt: string) => {
    setImagePrompt(prompt);
    setShowImageConfirm(true);
  };

  const handleConfirmImageGeneration = async () => {
    try {
      try {
        const response = await authService.generateImageWithPoints(imagePrompt);
        if (response.success) {
          // 更新點數餘額
          setUserPoints(prev => ({
            ...prev,
            currentPoints: response.remainingPoints || 0,
            totalUsed: prev.totalUsed + 1
          }));

          // 不重新載入，保持 localStorage 的狀態
          // await loadUserPoints();

          alert('圖片生成成功！');
        } else {
          alert(response.error === 'insufficient_points' ? '點數不足' : '生成失敗');
        }
      } catch (apiError) {
        console.log('API not available, simulating image generation...');

        // 檢查是否有足夠點數
        if (userPoints.currentPoints >= 1) {
          // 計算新餘額
          const newBalance = userPoints.currentPoints - 1;
          const newTotalUsed = userPoints.totalUsed + 1;

          // 模擬成功生成
          setUserPoints(prev => ({
            ...prev,
            currentPoints: newBalance,
            totalUsed: newTotalUsed,
            lastUpdate: new Date().toISOString()
          }));

          // 添加新的交易記錄
          setPointsTransactions(prev => [
            {
              id: `tx${Date.now()}`,
              userId: 'currentUser',
              type: 'image_generation',
              amount: -1,
              balance: newBalance,
              description: '圖片生成',
              createdAt: new Date().toISOString(),
              metadata: {
                imagePrompt: imagePrompt
              }
            },
            ...prev
          ]);

          // 觸發 AI 圖片生成
          setExecuteImagePrompt(imagePrompt + '_' + Date.now()); // 添加時間戳確保觸發

          // 延遲重置以確保 AiChatModal 已接收到觸發
          setTimeout(() => {
            setExecuteImagePrompt('');
          }, 1000);

          alert(`圖片生成中！消耗了 1 點數。提示詞：${imagePrompt}`);
          // 不關閉 AI 對話框，讓用戶可以繼續對話
        } else {
          alert('點數不足！請聯繫老師獲取更多點數。');
        }
      }
    } catch (error) {
      console.error('Image generation failed:', error);
      alert('圖片生成失敗，請稍後再試');
    } finally {
      setShowImageConfirm(false);
    }
  };

  const coerceSubject = useCallback((value: any): Subject => {
    const s = String(value ?? '').trim();
    const allowed = new Set(Object.values(Subject));
    return (allowed.has(s as Subject) ? (s as Subject) : Subject.SCIENCE);
  }, []);

  const loadStudentTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const [
        discussionResponse,
        quizResponse,
        gameResponse,
        botTaskResponse,
        contestResponse,
        noteResponse
      ] = await Promise.all([
        authService.getStudentDiscussions().catch(() => ({ discussions: [] })),
        authService.getStudentQuizzes().catch(() => ({ quizzes: [], total: 0 })),
        authService.getStudentGames().catch(() => ({ games: [] })),
        authService.getStudentBotTasks().catch(() => ({ tasks: [], total: 0 })),
        authService.getStudentContests().catch(() => ({ contests: [], total: 0 })),
        authService.getStudentNotes().catch(() => ({ notes: [], total: 0 }))
      ]);

      const discussionTasks: Task[] = (discussionResponse.discussions || []).map((d: any) => ({
        id: String(d.id),
        title: String(d.title || ''),
        type: 'discussion',
        subject: coerceSubject(d.subject),
        teacherName: d.teacherName || '教師',
        teacherAvatar: '/teacher_login.png',
        createdAt: d.createdAt || d.updatedAt,
        folderId: d.classFolderId || d.folderSnapshot?.folderId || null,
        folderSnapshot: d.folderSnapshot || null,
        completed: false
      }));

      const quizTasks: Task[] = (quizResponse.quizzes || []).map((q: any) => ({
        id: String(q.id),
        title: String(q.title || ''),
        type: 'quiz',
        subject: coerceSubject(q.subject),
        teacherName: q.teacherName || '系統',
        teacherAvatar: '/teacher_login.png',
        createdAt: q.createdAt || q.updatedAt || q.assignedAt,
        folderId: q.classFolderId || q.folderSnapshot?.folderId || null,
        folderSnapshot: q.folderSnapshot || null,
        completed: !!q.completed,
        score: q.score ?? null
      }));

      const gameTasks: Task[] = (gameResponse.games || []).map((g: any) => ({
        id: String(g.id),
        title: String(g.title || ''),
        type: 'game',
        subject: coerceSubject(g.subject),
        teacherName: g.teacherName || '系統',
        teacherAvatar: '/teacher_login.png',
        createdAt: g.createdAt || g.updatedAt || g.assignedAt,
        folderId: g.classFolderId || g.folderSnapshot?.folderId || null,
        folderSnapshot: g.folderSnapshot || null,
        completed: !!g.completed,
        score: g.bestScore ?? null
      }));

      const botTasks: Task[] = (botTaskResponse.tasks || []).map((t: any) => ({
        id: String(t.id),
        title: String(t.botName || t.title || 'AI小助手任務'),
        type: 'ai-bot',
        subject: coerceSubject(t.subject),
        teacherName: t.teacherName || '教師',
        teacherAvatar: '/teacher_login.png',
        createdAt: t.createdAt || t.updatedAt || t.assignedAt,
        folderId: t.classFolderId || t.folderSnapshot?.folderId || null,
        folderSnapshot: t.folderSnapshot || null,
        completed: !!t.completed
      }));

      const contestTasks: Task[] = (contestResponse.contests || []).map((c: any) => ({
        id: String(c.id),
        title: String(c.title || ''),
        type: 'contest',
        subject: coerceSubject(c.subject),
        teacherName: c.teacherName || '系統',
        teacherAvatar: '/teacher_login.png',
        createdAt: c.createdAt || c.updatedAt || c.assignedAt,
        folderId: c.classFolderId || c.folderSnapshot?.folderId || null,
        folderSnapshot: c.folderSnapshot || null,
        completed: Number(c.attempts) > 0 || typeof c.bestScore === 'number',
        score: c.bestScore ?? null,
        ...(c.scopeCardId ? { scopeCardId: String(c.scopeCardId) } : {}),
        ...(c.topic ? { topic: c.topic } : {}),
        ...(c.grade ? { grade: c.grade } : {}),
        ...(c.questionCount ? { questionCount: c.questionCount } : {}),
        ...(c.timeLimitSeconds !== undefined ? { timeLimitSeconds: c.timeLimitSeconds } : {}),
        ...(c.attempts !== undefined ? { attempts: c.attempts } : {}),
        ...(c.bestScore !== undefined ? { bestScore: c.bestScore } : {})
      } as any));

      const noteTasks: Task[] = (noteResponse.notes || []).map((n: any) => ({
        id: String(n.id),
        title: String(n.title || '筆記'),
        type: 'note',
        subject: coerceSubject(n.subject),
        teacherName: n.teacherName || '教師',
        teacherAvatar: '/teacher_login.png',
        createdAt: n.createdAt || n.updatedAt || n.assignedAt,
        folderId: n.classFolderId || n.folderSnapshot?.folderId || null,
        folderSnapshot: n.folderSnapshot || null,
        completed: !!n.completed
      }));

      const allTasks: Task[] = [...discussionTasks, ...quizTasks, ...gameTasks, ...botTasks, ...contestTasks, ...noteTasks];
      allTasks.sort((a, b) => new Date(String(b.createdAt || 0)).getTime() - new Date(String(a.createdAt || 0)).getTime());
      setTasks(allTasks);

      // 背景載入：討論串回應狀態（用於顯示完成）
      const statusPairs = await Promise.all(
        discussionTasks.map(async (t) => {
          try {
            const status = await authService.checkStudentResponse(t.id);
            return [t.id, status] as const;
          } catch {
            return [t.id, { hasResponded: false }] as const;
          }
        })
      );
      const nextStatus: any = {};
      for (const [id, st] of statusPairs) nextStatus[id] = st;
      setResponseStatus(nextStatus);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      setTasks([]);
      setResponseStatus({});
    } finally {
      setTasksLoading(false);
    }
  }, [coerceSubject]);

  useEffect(() => {
    if (!user?.id) return;
    void loadStudentTasks();
  }, [user?.id, loadStudentTasks]);

  useEffect(() => {
    if (!showTaskView) return;
    if (tasks.length > 0) return;
    void loadStudentTasks();
  }, [showTaskView, tasks.length, loadStudentTasks]);

  // 刷新點數顯示（僅更新時間戳，不覆蓋localStorage數據）
  const refreshPoints = () => {
    setUserPoints(prev => ({
      ...prev,
      lastUpdate: new Date().toISOString()
    }));
  };


  // 使用 localStorage，不載入遠端數據
  // useEffect(() => {
  //   if (user) {
  //     loadUserPoints();
  //   }
  // }, [user, loadUserPoints]);

  useEffect(() => {
    const loadFoldersData = async () => {
      if (!showTaskView) return;
      setLoading(true);
      try {
        const response = await authService.getMyClassFolders();
        setClassFolders(response.folders || []);
      } catch (error) {
        console.error('Failed to load folders:', error);
      } finally {
        setLoading(false);
      }
    };
    loadFoldersData();
  }, [showTaskView]);

  // Progress data now calculated from real tasks above
  const subjectProgress = new Map([
    ['數學', { total: 5, completed: 3 }],
    ['科學', { total: 4, completed: 2 }],
    ['程式設計', { total: 6, completed: 3 }]
  ]);

  const dailyChallenges = [
    { id: 1, name: '打解網嗨\n生活課體', completed: true },
    { id: 2, name: '每日挑戰\n攻略', completed: true },
    { id: 3, name: '每日生事\n挑戰', completed: true }
  ];

  const style = `
    .cartoon-card {
      background-color: #FFF9F0;
      border: 4px solid #E6D2B5;
      border-radius: 24px;
      box-shadow: 0 6px 0 #DCC098;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }



    .science-background {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -10;
      overflow: hidden;
      pointer-events: none;
    }

    .science-icon {
      position: absolute;
      opacity: 0.2;
      animation: float 6s ease-in-out infinite;
    }

    .science-icon:nth-child(odd) {
      animation-direction: reverse;
    }

    .science-icon.rotate {
      animation: float 6s ease-in-out infinite, rotate 8s linear infinite;
    }

    .science-icon.pulse {
      animation: float 6s ease-in-out infinite, pulse 4s ease-in-out infinite;
    }


    @keyframes float {
      0%, 100% { transform: translateY(0px) translateX(0px); }
      25% { transform: translateY(-20px) translateX(10px); }
      50% { transform: translateY(-10px) translateX(-5px); }
      75% { transform: translateY(-15px) translateX(15px); }
    }

    @keyframes rotate {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.2; }
      50% { opacity: 0.4; }
    }
  `;

  // Science Background Component with 4x elements
  const ScienceBackground = () => {
    const generateRandomPosition = () => ({
      top: Math.random() * 90 + '%',
      left: Math.random() * 90 + '%'
    });

    const scienceElements = [];

    // Create 32 elements (4x the original 8)
    for (let i = 0; i < 32; i++) {
      const pos = generateRandomPosition();
      const size = Math.random() * 30 + 25; // 25-55px
      const animationDelay = Math.random() * 6; // 0-6s delay

      const elementType = i % 8; // Cycle through 8 different types

      switch (elementType) {
        case 0: // DNA
          scienceElements.push(
            <svg key={`dna-${i}`} className="science-icon rotate"
              style={{
                top: pos.top,
                left: pos.left,
                width: `${size}px`,
                height: `${size}px`,
                animationDelay: `${animationDelay}s`
              }}
              viewBox="0 0 100 100" fill="#B5F8CE">
              <path d="M20 20 Q50 10 80 20 Q50 30 20 40 Q50 50 80 60 Q50 70 20 80" stroke="#4CAF50" strokeWidth="3" fill="none"/>
              <circle cx="20" cy="20" r="4" fill="#4CAF50"/>
              <circle cx="80" cy="20" r="4" fill="#4CAF50"/>
              <circle cx="20" cy="40" r="4" fill="#4CAF50"/>
              <circle cx="80" cy="40" r="4" fill="#4CAF50"/>
              <circle cx="20" cy="60" r="4" fill="#4CAF50"/>
              <circle cx="80" cy="60" r="4" fill="#4CAF50"/>
              <circle cx="20" cy="80" r="4" fill="#4CAF50"/>
              <circle cx="80" cy="80" r="4" fill="#4CAF50"/>
            </svg>
          );
          break;
        case 1: // Atom
          scienceElements.push(
            <svg key={`atom-${i}`} className="science-icon pulse"
              style={{
                top: pos.top,
                right: pos.left,
                width: `${size}px`,
                height: `${size}px`,
                animationDelay: `${animationDelay}s`
              }}
              viewBox="0 0 100 100" fill="#FFB74D">
              <circle cx="50" cy="50" r="8" fill="#FF9800"/>
              <ellipse cx="50" cy="50" rx="35" ry="15" fill="none" stroke="#FF9800" strokeWidth="2"/>
              <ellipse cx="50" cy="50" rx="15" ry="35" fill="none" stroke="#FF9800" strokeWidth="2"/>
              <ellipse cx="50" cy="50" rx="25" ry="25" fill="none" stroke="#FF9800" strokeWidth="2" transform="rotate(45 50 50)"/>
              <circle cx="85" cy="50" r="3" fill="#FF5722"/>
              <circle cx="15" cy="50" r="3" fill="#FF5722"/>
              <circle cx="50" cy="15" r="3" fill="#FF5722"/>
              <circle cx="50" cy="85" r="3" fill="#FF5722"/>
            </svg>
          );
          break;
        case 2: // Test Tube
          scienceElements.push(
            <svg key={`testtube-${i}`} className="science-icon"
              style={{
                top: pos.top,
                left: pos.left,
                width: `${size * 0.8}px`,
                height: `${size * 0.8}px`,
                animationDelay: `${animationDelay}s`
              }}
              viewBox="0 0 100 100" fill="#E1BEE7">
              <rect x="40" y="10" width="20" height="60" rx="10" ry="10" fill="none" stroke="#9C27B0" strokeWidth="3"/>
              <rect x="40" y="45" width="20" height="25" fill="#9C27B0" opacity="0.3"/>
              <circle cx="50" cy="15" r="8" fill="none" stroke="#9C27B0" strokeWidth="2"/>
            </svg>
          );
          break;
        case 3: // Microscope
          scienceElements.push(
            <svg key={`microscope-${i}`} className="science-icon rotate"
              style={{
                top: pos.top,
                left: pos.left,
                width: `${size * 1.1}px`,
                height: `${size * 1.1}px`,
                animationDelay: `${animationDelay}s`
              }}
              viewBox="0 0 100 100" fill="#81C784">
              <rect x="20" y="80" width="60" height="8" rx="4" fill="#4CAF50"/>
              <rect x="45" y="30" width="8" height="50" fill="#4CAF50"/>
              <circle cx="49" cy="25" r="15" fill="none" stroke="#4CAF50" strokeWidth="3"/>
              <circle cx="49" cy="25" r="8" fill="#4CAF50"/>
              <rect x="25" y="20" width="15" height="4" fill="#4CAF50"/>
              <rect x="60" y="35" width="15" height="4" fill="#4CAF50"/>
            </svg>
          );
          break;
        case 4: // Chemical Formula
          scienceElements.push(
            <svg key={`formula-${i}`} className="science-icon pulse"
              style={{
                top: pos.top,
                left: pos.left,
                width: `${size * 1.4}px`,
                height: `${size * 0.6}px`,
                animationDelay: `${animationDelay}s`
              }}
              viewBox="0 0 140 60" fill="#42A5F5">
              <text x="10" y="35" fontSize="24" fontWeight="bold" fill="#2196F3">H</text>
              <text x="35" y="45" fontSize="16" fill="#2196F3">2</text>
              <text x="50" y="35" fontSize="24" fontWeight="bold" fill="#2196F3">O</text>
            </svg>
          );
          break;
        case 5: // Beaker
          scienceElements.push(
            <svg key={`beaker-${i}`} className="science-icon"
              style={{
                top: pos.top,
                right: pos.left,
                width: `${size * 0.9}px`,
                height: `${size * 0.9}px`,
                animationDelay: `${animationDelay}s`
              }}
              viewBox="0 0 100 100" fill="#FFC107">
              <path d="M30 20 L30 40 L15 80 L85 80 L70 40 L70 20 Z" fill="none" stroke="#FF9800" strokeWidth="3"/>
              <rect x="25" y="15" width="50" height="8" fill="#FF9800"/>
              <path d="M30 45 L70 45 L65 65 L35 65 Z" fill="#FF9800" opacity="0.3"/>
              <circle cx="45" cy="55" r="2" fill="#FF9800"/>
              <circle cx="55" cy="52" r="1.5" fill="#FF9800"/>
            </svg>
          );
          break;
        case 6: // Gear
          scienceElements.push(
            <svg key={`gear-${i}`} className="science-icon rotate"
              style={{
                top: pos.top,
                left: pos.left,
                width: `${size * 0.7}px`,
                height: `${size * 0.7}px`,
                animationDelay: `${animationDelay}s`
              }}
              viewBox="0 0 100 100" fill="#90A4AE">
              <path d="M50,10 L60,20 L70,15 L75,25 L85,30 L80,40 L90,50 L80,60 L85,70 L75,75 L70,85 L60,80 L50,90 L40,80 L30,85 L25,75 L15,70 L20,60 L10,50 L20,40 L15,30 L25,25 L30,15 L40,20 Z" fill="#607D8B"/>
              <circle cx="50" cy="50" r="15" fill="none" stroke="#455A64" strokeWidth="3"/>
            </svg>
          );
          break;
        case 7: // Flask
          scienceElements.push(
            <svg key={`flask-${i}`} className="science-icon pulse"
              style={{
                top: pos.top,
                left: pos.left,
                width: `${size}px`,
                height: `${size}px`,
                animationDelay: `${animationDelay}s`
              }}
              viewBox="0 0 100 100" fill="#E1BEE7">
              <path d="M35 10 L35 35 L20 70 L80 70 L65 35 L65 10 Z" fill="none" stroke="#9C27B0" strokeWidth="3"/>
              <rect x="30" y="5" width="40" height="8" fill="#9C27B0"/>
              <path d="M35 40 L65 40 L60 60 L40 60 Z" fill="#9C27B0" opacity="0.3"/>
              <circle cx="45" cy="50" r="2" fill="#9C27B0"/>
              <circle cx="55" cy="47" r="1.5" fill="#9C27B0"/>
            </svg>
          );
          break;
      }
    }

    return (
      <div className="science-background">
        {scienceElements}
      </div>
    );
  };

  return (
    <div
      className="min-h-screen p-4 md:p-6 font-sans relative"
      style={{
        backgroundImage: 'url(/stubg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        color: '#5D4037'
      }}
    >
      <style>{style}</style>
      <ScienceBackground />

      {/* Header */}
      <header className="max-w-[1200px] mx-auto flex justify-end items-center mb-8 gap-4">
        {/* Right: User Actions */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowUiSettings(true)}
            className="bg-[#FFF9F0] p-3 rounded-full border-3 border-[#E6D2B5] text-[#DCC098] hover:text-[#F4A261] hover:-translate-y-1 transition-all shadow-md"
            title="設定"
          >
            <Settings className="h-6 w-6" />
          </button>
          {/* Logout Button */}
          <button
            onClick={logout}
            className="bg-[#FFE5E5] hover:bg-[#FFCCCB] p-3 rounded-full border-3 border-[#FF6B6B] text-[#D63384] hover:text-[#B02A37] hover:-translate-y-1 transition-all shadow-md group"
            title="登出"
          >
            <LogOut className="h-6 w-6 group-hover:rotate-12 transition-transform" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 pb-10">
        {/* Left Sidebar */}
        <aside className="lg:col-span-4 cartoon-card px-6 pt-2 pb-6 flex-shrink-0 flex flex-col min-h-fit">
          {/* Logo Section */}
          <div className="text-center -mt-2 -mb-12">
            <img
              src="/lpsparklogo.png"
              alt="LP科樂園 Logo"
              className="h-64 mx-auto block object-contain drop-shadow-sm hover:scale-105 transition-transform duration-300"
            />
          </div>

          {/* Student Info Section */}
          <div className="text-center mb-6 bg-white/60 rounded-xl p-4 border-2 border-[#E6D2B5]">
            <div className="space-y-1">
              <div className="text-lg font-bold text-[#5E4C40]">
                {user?.profile?.name || user?.username || '學生姓名'}
              </div>
              <div className="text-sm font-medium text-[#8D6E63]">
                班級：{user?.profile?.class || '未設定'}
              </div>
              <div className="text-xs text-[#A0806B] font-mono">
                帳號：{user?.username || '未登入'}
              </div>
            </div>
          </div>


          <nav className="flex-1 space-y-3 overflow-y-auto">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowAiChat(true);
              }}
              className="w-[calc(100%-10px)] flex items-center gap-3 px-4 py-2 rounded-2xl border-4 transition-all duration-150 border-[#E6D2B5] bg-[#D2EFFF] hover:bg-white hover:-translate-y-1 shadow-sm"
              title="AI對話"
            >
              <Bot className="w-6 h-6 text-[#5E4C40]" />
              <span className="text-lg font-bold text-[#5E4C40] flex-1 text-left">AI對話</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveTab('practice');
                setShowSelfStudyHub(true);
              }}
              className={`w-[calc(100%-10px)] flex items-center gap-3 px-4 py-2 rounded-2xl border-4 transition-all duration-150 border-[#E6D2B5] hover:bg-white hover:-translate-y-1 shadow-sm ${
                activeTab === 'practice' ? 'bg-white ring-2 ring-blue-300' : 'bg-[#FFF3E0]'
              }`}
              title="自學天地"
            >
              <Brain className="w-6 h-6 text-[#5E4C40]" />
              <span className="text-lg font-bold text-[#5E4C40] flex-1 text-left">自學天地</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowAppStudio(true);
              }}
              className="w-[calc(100%-10px)] flex items-center gap-3 px-4 py-2 rounded-2xl border-4 transition-all duration-150 border-[#E6D2B5] bg-[#E8F5E9] hover:bg-white hover:-translate-y-1 shadow-sm"
              title="小程式工作坊"
            >
              <Code2 className="w-6 h-6 text-[#5E4C40]" />
              <span className="text-lg font-bold text-[#5E4C40] flex-1 text-left">小程式工作坊</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowTaskView(true);
              }}
              className="w-[calc(100%-10px)] flex items-center gap-3 px-4 py-2 rounded-2xl border-4 transition-all duration-150 border-[#E6D2B5] bg-[#B5F8CE] hover:bg-white hover:-translate-y-1 shadow-sm"
            >
              <ClipboardList className="w-6 h-6 text-[#5E4C40]" />
              <span className="text-lg font-bold text-[#5E4C40] flex-1 text-left">我的任務</span>
              {overallProgress.pending > 0 && (
                <span className="min-w-7 h-7 px-2 flex items-center justify-center rounded-full bg-red-500 text-white text-sm font-black border-2 border-[#5E4C40]">
                  {overallProgress.pending}
                </span>
              )}
            </button>
          </nav>

        </aside>

        {/* Right Content */}
        <section className="lg:col-span-8 flex flex-col gap-8">
          {showTaskView ? (
            /* Task View */
            <div className="cartoon-card h-full">
              <div className="bg-[#F9E4C8] p-4 border-b-4 border-[#E6D2B5] flex justify-between items-center">
                <h3 className="text-2xl font-bold text-[#5D4037]">我的任務</h3>
                <button
                  onClick={() => {
                    setShowTaskView(false);
                    setSelectedStageId('');
                    setSelectedTopicId('');
                    setSelectedSubfolderId('');
                    setClassFolders([]);
                  }}
                  className="text-[#5D4037] hover:text-red-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 bg-white/60 min-h-[500px]">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 animate-spin text-[#5D4037]" />
                    <span className="ml-3 text-[#5D4037] font-bold">載入中...</span>
                  </div>
                ) : !selectedStageId && !selectedTopicId ? (
                  /* Stage Folders */
                  <div>
                    <div className="text-lg font-bold text-[#5D4037] mb-4">學段</div>
                    {stageFolders.length === 0 ? (
                      <div className="text-center py-12 text-gray-500 border-4 border-dashed border-gray-300 rounded-3xl">
                        未有學段資料夾
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {stageFolders.map((folder: any) => (
                          <div
                            key={folder.id}
                            onClick={() => setSelectedStageId(folder.id)}
                            className="bg-white border-4 border-[#5D4037] rounded-2xl p-4 shadow-sm cursor-pointer hover:shadow-lg transition-shadow"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="text-xl font-bold text-[#5D4037]">📁 {folder.name}</div>
                              {Number(pendingCountByFolderId.get(String(folder.id)) || 0) > 0 && (
                                <span className="min-w-7 h-7 px-2 flex items-center justify-center rounded-full bg-red-500 text-white text-sm font-black border-2 border-[#5D4037]">
                                  {pendingCountByFolderId.get(String(folder.id))}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 text-sm text-gray-600">點擊查看課題</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-4 text-xs text-gray-600">
                      按「學段」→「課題」→（子folder 可選）進入後才會看到任務。
                    </div>
                  </div>
                ) : selectedStageId && !selectedTopicId ? (
                  /* Topic Folders */
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <button
                        onClick={() => setSelectedStageId('')}
                        className="text-[#5D4037] hover:text-blue-600 text-sm font-bold"
                      >
                        ← 返回學段選擇
                      </button>
                    </div>
                    <div className="text-lg font-bold text-[#5D4037] mb-4">
                      課題 - {stageFolders.find(f => f.id === selectedStageId)?.name}
                    </div>
                    {topicFolders.length === 0 ? (
                      <div className="text-center py-12 text-gray-500 border-4 border-dashed border-gray-300 rounded-3xl">
                        目前未有課題資料夾
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {topicFolders.map((folder: any) => (
                          <div
                            key={folder.id}
                            onClick={() => setSelectedTopicId(folder.id)}
                            className="bg-white border-4 border-[#5D4037] rounded-2xl p-4 shadow-sm cursor-pointer hover:shadow-lg transition-shadow"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="text-xl font-bold text-[#5D4037]">📂 {folder.name}</div>
                              {Number(pendingCountByFolderId.get(String(folder.id)) || 0) > 0 && (
                                <span className="min-w-7 h-7 px-2 flex items-center justify-center rounded-full bg-red-500 text-white text-sm font-black border-2 border-[#5D4037]">
                                  {pendingCountByFolderId.get(String(folder.id))}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 text-sm text-gray-600">點擊查看內容</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Sub Folders or Tasks */
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <button
                        onClick={() => {
                          if (selectedSubfolderId) setSelectedSubfolderId('');
                          else setSelectedTopicId('');
                        }}
                        className="text-[#5D4037] hover:text-blue-600 text-sm font-bold"
                      >
                        {selectedSubfolderId ? '← 返回子資料夾' : '← 返回課題選擇'}
                      </button>
                    </div>
                    <div className="text-lg font-bold text-[#5D4037] mb-4">
                      {selectedSubfolderId
                        ? `${topicFolders.find(f => f.id === selectedTopicId)?.name || ''} / ${subFolders.find((f: any) => String(f.id) === String(selectedSubfolderId))?.name || ''}`
                        : (topicFolders.find(f => f.id === selectedTopicId)?.name || '')}
                    </div>

                    {!selectedSubfolderId && subFolders.length > 0 && (
                      <div className="mb-6">
                        <div className="text-md font-bold text-[#5D4037] mb-3">子資料夾</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {subFolders.map((folder: any) => (
                            <div
                              key={folder.id}
                              onClick={() => setSelectedSubfolderId(folder.id)}
                              className="bg-white border-4 border-[#5D4037] rounded-2xl p-4 shadow-sm cursor-pointer hover:shadow-lg transition-shadow"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="text-lg font-bold text-[#5D4037]">📁 {folder.name}</div>
                                {Number(pendingCountByFolderId.get(String(folder.id)) || 0) > 0 && (
                                  <span className="min-w-7 h-7 px-2 flex items-center justify-center rounded-full bg-red-500 text-white text-sm font-black border-2 border-[#5D4037]">
                                    {pendingCountByFolderId.get(String(folder.id))}
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 text-sm text-gray-600">點擊查看任務</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-md font-bold text-[#5D4037]">任務</div>
                        <button
                          type="button"
                          onClick={() => loadStudentTasks()}
                          className="text-sm font-bold text-[#5D4037] hover:text-blue-600"
                        >
                          重新整理
                        </button>
                      </div>

                      {tasksLoading ? (
                        <div className="flex items-center justify-center py-10">
                          <RefreshCw className="w-6 h-6 animate-spin text-[#5D4037]" />
                          <span className="ml-2 text-[#5D4037] font-bold">載入任務中...</span>
                        </div>
                      ) : (
                        (() => {
                          const list = selectedSubfolderId ? tasksInSubfolder : tasksInTopic;
                          if (list.length === 0) {
                            return (
                              <div className="text-center py-10 text-gray-500 border-4 border-dashed border-gray-300 rounded-3xl">
                                此處暫無任務
                              </div>
                            );
                          }
                          return (
                            <div className="space-y-4">
                              {list.map((task: any) => {
                                const done = isTaskCompleted(task);
                                const typeLabel =
                                  task.type === 'quiz' ? '小測驗'
                                    : task.type === 'contest' ? '問答比賽'
                                      : task.type === 'ai-bot' ? 'AI小助手任務'
                                        : task.type === 'discussion' ? '討論串'
                                          : task.type === 'note' ? '筆記'
                                            : task.type === 'game' ? '遊戲'
                                              : task.type;

                                const pathNames = Array.isArray(task.folderSnapshot?.path)
                                  ? task.folderSnapshot.path.map((p: any) => String(p?.name || '')).filter(Boolean).join(' / ')
                                  : '';

                                return (
                                  <div
                                    key={`${task.type}-${task.id}`}
                                    className="bg-white border-4 border-[#5D4037] rounded-2xl p-4 shadow-sm"
                                  >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="text-lg font-bold text-[#5D4037] truncate">
                                          {task.title}
                                        </div>
                                        <div className="mt-1 text-sm text-gray-700 font-bold">
                                          {typeLabel} • {task.subject}{pathNames ? ` • ${pathNames}` : ''}{task.createdAt ? ` • ${new Date(task.createdAt).toLocaleString()}` : ''}
                                        </div>
                                        <div className="mt-2 text-xs font-bold">
                                          <span className={`px-2 py-1 rounded-lg border-2 ${done ? 'bg-green-50 border-green-300 text-green-800' : 'bg-yellow-50 border-yellow-300 text-yellow-800'}`}>
                                            {done ? '已完成' : '未完成'}
                                          </span>
                                          {typeof task.score === 'number' && (
                                            <span className="ml-2 text-gray-700">分數：{Math.round(task.score)}%</span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex gap-2 flex-shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (task.type === 'ai-bot') {
                                              setSelectedBotTaskId(String(task.id));
                                              setShowBotTaskChat(true);
                                            } else if (task.type === 'contest') {
                                              setSelectedContest(task);
                                              setShowContestModal(true);
                                            } else if (task.type === 'quiz') {
                                              setSelectedQuizId(String(task.id));
                                              setShowQuizModal(true);
                                            } else if (task.type === 'discussion') {
                                              setSelectedDiscussionId(String(task.id));
                                              setShowDiscussionModal(true);
                                            } else if (task.type === 'note') {
                                              setSelectedNoteId(String(task.id));
                                              setShowNoteModal(true);
                                            } else {
                                              window.alert('此任務類型暫未支援於學生端開啟');
                                            }
                                          }}
                                          className="px-4 py-2 rounded-2xl bg-[#FDEEAD] border-4 border-[#5D4037] text-[#5D4037] font-black hover:bg-[#FCE690] shadow-comic active:translate-y-1 active:shadow-none"
                                        >
                                          開啟
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Original Dashboard Content */
            <>
              {/* Top Banner */}
              <div className="cartoon-card relative h-64 md:h-72 w-full group overflow-hidden">
                <img
                  src="/banner2.png"
                  alt="歡迎回到科學之旅!"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Bottom Grid (Challenges & Rewards) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* My Progress Card */}
            <div className="cartoon-card">
              <div className="bg-[#F9E4C8] p-3 border-b-4 border-[#E6D2B5] text-center">
                <h3 className="text-xl font-bold text-[#5D4037]">我的進度</h3>
              </div>
              <div className="p-4 bg-white/60 h-full flex flex-col justify-center">
                {/* Overall Progress */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-lg font-black text-[#5D4037]">整體進度</div>
                    <div className="text-sm font-bold text-gray-600">
                      {overallProgress.total > 0 ? Math.round((overallProgress.completed / overallProgress.total) * 100) : 0}%
                    </div>
                  </div>
                  <div className="h-4 bg-gray-200 rounded-full border-2 border-[#E6D2B5] overflow-hidden">
                    <div
                      className="h-full bg-[#93C47D] transition-all"
                      style={{
                        width: `${overallProgress.total > 0 ? Math.round((overallProgress.completed / overallProgress.total) * 100) : 0}%`
                      }}
                    />
                  </div>
                  <div className="mt-3 flex justify-between text-xs font-bold text-[#5D4037]">
                    <span>收到 {overallProgress.total}</span>
                    <span>完成 {overallProgress.completed}</span>
                    <span>未完成 {overallProgress.pending}</span>
                  </div>
                </div>

              </div>
            </div>

            {/* My Rewards Card */}
            <div className="cartoon-card">
              <div className="bg-[#F9E4C8] p-3 border-b-4 border-[#E6D2B5] text-center">
                <h3 className="text-xl font-bold text-[#5D4037]">我的獎勵</h3>
              </div>
              <div className="p-4 bg-white/60 h-full flex flex-col justify-center">
                {/* Awards section */}
                <div className="grid grid-cols-4 gap-3 justify-items-center mb-6">
                  <div className="flex flex-col items-center gap-1 group">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center group-hover:rotate-12 transition-transform">
                      <Award className="w-10 h-10 text-yellow-500 drop-shadow-md" />
                    </div>
                    <span className="text-xs font-bold text-[#8D6E63] text-center">金獎</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 group">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center group-hover:rotate-12 transition-transform">
                      <Award className="w-10 h-10 text-blue-500 drop-shadow-md opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all" />
                    </div>
                    <span className="text-xs font-bold text-[#8D6E63] text-center">銀獎</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 group">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center group-hover:rotate-12 transition-transform">
                      <Award className="w-10 h-10 text-purple-500 drop-shadow-md opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all" />
                    </div>
                    <span className="text-xs font-bold text-[#8D6E63] text-center">銅獎</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 group">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center group-hover:rotate-12 transition-transform">
                      <Award className="w-10 h-10 text-red-500 drop-shadow-md opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all" />
                    </div>
                    <span className="text-xs font-bold text-[#8D6E63] text-center">特殊</span>
                  </div>
                </div>

                {/* Achievement badges */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-yellow-100 border-2 border-yellow-300 rounded-xl p-3 text-center">
                    <Star className="w-8 h-8 text-yellow-500 mx-auto mb-1" />
                    <div className="text-lg font-bold text-[#5D4037]">200</div>
                    <div className="text-xs font-bold text-[#8D6E63]">收集獎勵</div>
                  </div>
                  <div className="bg-blue-100 border-2 border-blue-300 rounded-xl p-3 text-center">
                    <div className="text-2xl mb-1">🏆</div>
                    <div className="text-lg font-bold text-[#5D4037]">0</div>
                    <div className="text-xs font-bold text-[#8D6E63]">總獎章</div>
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-sm font-bold text-[#8D6E63]">繼續努力獲得更多獎勵！</div>
                </div>
              </div>
            </div>
              </div>
            </>
          )}
        </section>
      </main>

      {/* Modals */}
      <UiSettingsModal open={showUiSettings} onClose={() => setShowUiSettings(false)} />
      <AiChatModal
        open={showAiChat}
        onClose={() => setShowAiChat(false)}
        onImageGeneration={handleImageGeneration}
        userPoints={userPoints.currentPoints}
        userPointsInfo={userPoints}
        pointsTransactions={pointsTransactions}
        onRefreshPoints={refreshPoints}
        executeImageGeneration={executeImagePrompt}
      />
      <AppStudioModal
        open={showAppStudio}
        onClose={() => setShowAppStudio(false)}
      />
      <BotTaskChatModal
        open={showBotTaskChat}
        taskId={selectedBotTaskId}
        onClose={() => { setShowBotTaskChat(false); setSelectedBotTaskId(null); }}
      />
      <ImageGenerationConfirmModal
        open={showImageConfirm}
        currentPoints={userPoints.currentPoints}
        costPerGeneration={1}
        prompt={imagePrompt}
        onConfirm={handleConfirmImageGeneration}
        onCancel={() => setShowImageConfirm(false)}
        isGenerating={false}
      />

      <StudyPracticeModal
        open={showStudyPractice}
        onClose={() => {
          setShowStudyPractice(false);
          setRetrySessionScope(null); // 關閉時清除重新練習的學習範圍
        }}
        initialScope={retrySessionScope}
      />

      {/* 自學天地（練習 / 記錄 分頁） */}
      {showSelfStudyHub && user && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-lg border-4 border-brand-brown">
            <div className="bg-brand-brown text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Brain className="w-8 h-8" />
                <h2 className="text-2xl font-bold">自學天地</h2>
              </div>
              <button
                onClick={() => setShowSelfStudyHub(false)}
                className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="px-6 pt-4 bg-white">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('practice')}
                  className={`px-4 py-2 rounded-xl font-bold border-2 transition-all ${
                    activeTab === 'practice'
                      ? 'bg-brand-brown text-white border-brand-brown'
                      : 'bg-white text-brand-brown border-brand-brown/40 hover:bg-brand-cream'
                  }`}
                >
                  練習
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`px-4 py-2 rounded-xl font-bold border-2 transition-all ${
                    activeTab === 'history'
                      ? 'bg-brand-brown text-white border-brand-brown'
                      : 'bg-white text-brand-brown border-brand-brown/40 hover:bg-brand-cream'
                  }`}
                >
                  學習記錄
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh] bg-brand-cream">
              {activeTab === 'practice' ? (
                <div className="bg-white rounded-2xl p-6 shadow-comic border-2 border-brand-brown/10">
                  <div className="text-xl font-black text-brand-brown mb-2">科學自學練習</div>
                  <div className="text-sm text-gray-700 font-bold mb-5">
                    本系統學生自學科目固定為「科學」。
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSelfStudyHub(false);
                      setShowStudyPractice(true);
                    }}
                    className="px-6 py-3 rounded-2xl bg-[#93C47D] border-4 border-brand-brown text-brand-brown font-black text-lg shadow-comic active:translate-y-1 active:shadow-none hover:bg-[#86b572]"
                  >
                    開始練習
                  </button>
                </div>
              ) : (
                <StudyHistoryPanel
                  studentId={user.id.toString()}
                  studentName={user.username || user.profile?.name || '學生'}
                  onViewAnalytics={handleViewAnalytics}
                  onRetryScope={handleRetryScope}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI分析報告模態框 */}
      <StudyAnalyticsModal
        isOpen={showAnalyticsModal}
        onClose={() => setShowAnalyticsModal(false)}
        analytics={analyticsData}
        onRegenerateAnalytics={handleRegenerateAnalytics}
      />

      <StudentQuizModal
        open={showQuizModal}
        quizId={selectedQuizId}
        onClose={() => { setShowQuizModal(false); setSelectedQuizId(null); }}
        onFinished={() => loadStudentTasks()}
      />

      <StudentDiscussionModal
        open={showDiscussionModal}
        discussionId={selectedDiscussionId}
        onClose={() => { setShowDiscussionModal(false); setSelectedDiscussionId(null); }}
        onSubmitted={() => loadStudentTasks()}
      />

      <QuizContestModal
        open={showContestModal}
        contest={selectedContest}
        onClose={() => { setShowContestModal(false); setSelectedContest(null); }}
        onFinished={() => loadStudentTasks()}
      />

      {showNoteModal && user && (
        <NoteEditorModal
          open={showNoteModal}
          onClose={() => { setShowNoteModal(false); setSelectedNoteId(null); }}
          authService={authService}
          mode="student"
          noteId={selectedNoteId || undefined}
          viewerId={String(user.id)}
          viewerRole="student"
        />
      )}
    </div>
  );
};

export default StudentDashboard;
