import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Settings, LogOut, MessageSquare, HelpCircle, Bot, RefreshCw, X, Eye, EyeOff, Code2 } from 'lucide-react';
import { Subject, SUBJECT_CONFIG, Task } from '../types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { sanitizeHtml } from '../services/sanitizeHtml';
import { MazeGame } from '../components/MazeGame';
import TowerDefenseGame from '../components/TowerDefenseGame';
import { MathGame } from '../components/MathGame';
import { QuizContestModal } from '../components/QuizContestModal';
import UiSettingsModal from '../components/UiSettingsModal';
import AiChatModal from '../components/AiChatModal';
import BotTaskChatModal from '../components/BotTaskChatModal';
import AppStudioModal from '../components/AppStudioModal';
import { loadHiddenTaskKeys, makeTaskKey, saveHiddenTaskKeys } from '../services/taskVisibility';

interface Discussion {
  id: string;
  title: string;
  content: { type: string; value: string }[];
  subject: Subject;
  targetClasses: string[];
  teacherId: string;
  teacherName: string;
  createdAt: string;
  updatedAt: string;
}

interface MatchingCard {
  id: string;
  content: string;
  type: 'question' | 'answer';
  pairId: number;
  isFlipped: boolean;
  isMatched: boolean;
}

interface MatchParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
  shape: 'circle' | 'star' | 'confetti';
  rotation: number;
  spin: number;
}

// Maze Generation Helper
const generateMaze = (width: number, height: number, items: number) => {
  // 0: Wall, 1: Path, 2: Start, 3: End, 4: Question Gate, 5: Question Path (Passed)
  const maze = Array(height).fill(null).map(() => Array(width).fill(0));

  // DFS to generate maze
  const stack = [{ x: 1, y: 1 }];
  maze[1][1] = 1;
  const directions = [[0, 2], [2, 0], [0, -2], [-2, 0]]; // Jump 2 cells

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = [];

    for (const [dx, dy] of directions) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1 && maze[ny][nx] === 0) {
        neighbors.push({ x: nx, y: ny, dx, dy });
      }
    }

    if (neighbors.length > 0) {
      const { x, y, dx, dy } = neighbors[Math.floor(Math.random() * neighbors.length)];
      maze[y][x] = 1;
      maze[current.y + dy / 2][current.x + dx / 2] = 1; // Knock down wall
      stack.push({ x, y });
    } else {
      stack.pop();
    }
  }

  // Set Start
  maze[1][1] = 2; // Start

  // Set End (Furthest point or bottom right)
  let endX = width - 2;
  let endY = height - 2;
  while (maze[endY][endX] === 0) {
    // Simple fallback if bottom right is a wall
    endX--;
    if (endX < 1) { endX = width - 2; endY--; }
  }
  maze[endY][endX] = 3;

  // Place Items (Question Gates)
  // Find valid path points
  const validPoints = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if ((maze[y][x] === 1) && !(x === 1 && y === 1) && !(x === endX && y === endY)) {
        validPoints.push({ x, y });
      }
    }
  }

  // Shuffle and pick
  const questionMap: Record<string, number> = {};
  for (let i = 0; i < Math.min(items, validPoints.length); i++) {
    const idx = Math.floor(Math.random() * validPoints.length);
    const p = validPoints.splice(idx, 1)[0];
    maze[p.y][p.x] = 4; // Gate
    questionMap[`${p.x},${p.y}`] = i; // Map gate to question index
  }

  return { maze, end: { x: endX, y: endY }, questionMap };
};

const StudentDashboard: React.FC = () => {
  const [selectedSubject, setSelectedSubject] = useState<Subject>(Subject.CHINESE);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selectedDiscussion, setSelectedDiscussion] = useState<Discussion | null>(null);
  const [showDiscussionModal, setShowDiscussionModal] = useState(false);
  const [responseContent, setResponseContent] = useState('');
  const [currentFontSize, setCurrentFontSize] = useState('16');
  const [currentTextColor, setCurrentTextColor] = useState('#000000');
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [responseStatus, setResponseStatus] = useState<Record<string, { hasResponded: boolean, response?: any }>>({});
  const [allResponses, setAllResponses] = useState<Record<string, any[]>>({});
  const [showUiSettings, setShowUiSettings] = useState(false);
  const [hiddenTaskKeys, setHiddenTaskKeys] = useState<Set<string>>(() => new Set());
  const [showHiddenTasks, setShowHiddenTasks] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  const [showAppStudio, setShowAppStudio] = useState(false);
  const [showBotTaskChat, setShowBotTaskChat] = useState(false);
  const [selectedBotTaskId, setSelectedBotTaskId] = useState<string | null>(null);

  // 小测验相关状态
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizStartTime, setQuizStartTime] = useState<Date | null>(null);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [viewingQuizResult, setViewingQuizResult] = useState<any>(null); // State for reviewing quiz result

  // 問答比賽相關狀態
  const [showContestModal, setShowContestModal] = useState(false);
  const [selectedContest, setSelectedContest] = useState<any>(null);

  // 遊戲相關狀態
  const [showGameModal, setShowGameModal] = useState(false);
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [gameStatus, setGameStatus] = useState<'playing' | 'completed' | 'lost'>('playing');
  const [gameScore, setGameScore] = useState(0);
  const [gameStartTime, setGameStartTime] = useState<Date | null>(null);
  const [gameTimerTick, setGameTimerTick] = useState(0);
  const [gameCurrentQuestionIndex, setGameCurrentQuestionIndex] = useState(0);
  const [gameMatchingCards, setGameMatchingCards] = useState<MatchingCard[]>([]);
  const [gameSelectedCards, setGameSelectedCards] = useState<number[]>([]);
  const [gameMatchedPairs, setGameMatchedPairs] = useState<string[]>([]);
  const [mismatchIndices, setMismatchIndices] = useState<number[]>([]);
  const [matchPulseIndices, setMatchPulseIndices] = useState<number[]>([]);
  const [submittingGame, setSubmittingGame] = useState(false);
  const gameCompleteOnceRef = useRef(false);

  // Maze Only Logic
  const [mazeGrid, setMazeGrid] = useState<number[][]>([]);
  const [playerPos, setPlayerPos] = useState({ x: 1, y: 1 });
  const [gameQuestionMap, setGameQuestionMap] = useState<Record<string, number>>({});
  const [mazeSteps, setMazeSteps] = useState(0);

  const mazeQuestions = React.useMemo(() => {
    if (!selectedGame || selectedGame.gameType !== 'maze') return [];
    const source = Array.isArray(selectedGame.questions) ? selectedGame.questions : [];
    return source.map((q: any, i: number) => {
      const allOptions = [q.answer, ...(q.wrongOptions || [])].filter(Boolean);
      const shuffledOptions = [...allOptions].sort(() => Math.random() - 0.5).slice(0, 4);
      const correctIndex = shuffledOptions.indexOf(q.answer);
      return {
        id: `mz-q-${selectedGame.id}-${i}`,
        text: q.question,
        options: shuffledOptions,
        correctIndex: correctIndex >= 0 ? correctIndex : 0
      };
    });
  }, [selectedGame?.id]);

  // Matching Game Visual Refs / Particles
  const matchingAreaRef = useRef<HTMLDivElement | null>(null);
  const matchingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const matchingParticlesRef = useRef<MatchParticle[]>([]);
  const matchingAnimFrameRef = useRef<number | null>(null);
  const matchingLastTimeRef = useRef<number>(0);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const PARTICLE_COLORS = ['#F8B5E0', '#B5D8F8', '#B5F8CE', '#F8E2B5', '#D2B5F8', '#A1D9AE'];

  const spawnBurstAt = useCallback((x: number, y: number, count = 24) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      matchingParticlesRef.current.push({
        id: Date.now() + Math.random(),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1,
        size: Math.random() * 5 + 3,
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
        shape: Math.random() > 0.7 ? 'star' : 'circle',
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.25
      });
    }
  }, []);

  const spawnConfettiRain = useCallback((count = 140) => {
    const area = matchingAreaRef.current;
    if (!area) return;
    const rect = area.getBoundingClientRect();

    for (let i = 0; i < count; i++) {
      matchingParticlesRef.current.push({
        id: Date.now() + Math.random(),
        x: Math.random() * rect.width,
        y: -20 - Math.random() * rect.height * 0.2,
        vx: (Math.random() - 0.5) * 2.5,
        vy: Math.random() * 2 + 1.5,
        life: 1,
        size: Math.random() * 6 + 4,
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
        shape: 'confetti',
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.35
      });
    }
  }, []);

  const burstAtIndices = useCallback((indices: number[]) => {
    const area = matchingAreaRef.current;
    if (!area) return;
    const areaRect = area.getBoundingClientRect();

    indices.forEach(idx => {
      const el = cardRefs.current[idx];
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = rect.left - areaRect.left + rect.width / 2;
      const y = rect.top - areaRect.top + rect.height / 2;
      spawnBurstAt(x, y);
    });
  }, [spawnBurstAt]);

  // Matching particle canvas loop
  useEffect(() => {
    if (!showGameModal || selectedGame?.gameType !== 'matching') return;
    const canvas = matchingCanvasRef.current;
    const area = matchingAreaRef.current;
    if (!canvas || !area) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = area.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resizeCanvas();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(resizeCanvas);
      ro.observe(area);
    } else {
      window.addEventListener('resize', resizeCanvas);
    }

    const drawStar = (cx: number, cy: number, spikes: number, outerR: number, innerR: number, rotation: number) => {
      let rot = Math.PI / 2 * 3 + rotation;
      let x = cx;
      let y = cy;
      const step = Math.PI / spikes;
      ctx.beginPath();
      ctx.moveTo(cx, cy - outerR);
      for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerR;
        y = cy + Math.sin(rot) * outerR;
        ctx.lineTo(x, y);
        rot += step;
        x = cx + Math.cos(rot) * innerR;
        y = cy + Math.sin(rot) * innerR;
        ctx.lineTo(x, y);
        rot += step;
      }
      ctx.lineTo(cx, cy - outerR);
      ctx.closePath();
      ctx.fill();
    };

    const loop = (ts: number) => {
      if (!matchingLastTimeRef.current) matchingLastTimeRef.current = ts;
      const dt = Math.min(32, ts - matchingLastTimeRef.current) / 16.666;
      matchingLastTimeRef.current = ts;

      const rect = area.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      const particles = matchingParticlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.22 * dt;
        p.vx *= 0.985;
        p.life -= 0.018 * dt;
        p.rotation += p.spin * dt;

        if (p.life <= 0 || p.y > rect.height + 60) {
          particles.splice(i, 1);
          continue;
        }

        const alpha = Math.max(0, Math.min(1, p.life));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;

        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'star') {
          drawStar(p.x, p.y, 5, p.size, p.size / 2.2, p.rotation);
        } else {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;

      matchingAnimFrameRef.current = requestAnimationFrame(loop);
    };

    matchingAnimFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', resizeCanvas);
      if (matchingAnimFrameRef.current) cancelAnimationFrame(matchingAnimFrameRef.current);
      matchingAnimFrameRef.current = null;
      matchingParticlesRef.current = [];
      matchingLastTimeRef.current = 0;
    };
  }, [showGameModal, selectedGame?.gameType, selectedGame?.id]);

  // ... (Keep existing refs/functions)

  // 處理遊戲點擊
  const handleGameClick = async (gameId: string) => {
    try {
      setLoading(true);
      const response = await authService.getGameForStudent(gameId);
      const game = response.game;

      setSelectedGame(game);
      setGameScore(0);
      setGameStartTime(game.gameType === 'tower-defense' ? null : new Date());
      setGameTimerTick(0);
      setGameStatus('playing');
      setGameCurrentQuestionIndex(0);
      gameCompleteOnceRef.current = false;

      // 初始化遊戲狀態
      if (game.gameType === 'matching') {
        const cards: MatchingCard[] = [];
        game.questions.forEach((q: any, index: number) => {
          cards.push({ id: `q-${index}`, content: q.question, type: 'question', pairId: index, isFlipped: false, isMatched: false });
          cards.push({ id: `a-${index}`, content: q.answer, type: 'answer', pairId: index, isFlipped: false, isMatched: false });
        });
        setGameMatchingCards(cards.sort(() => Math.random() - 0.5));
        setGameSelectedCards([]);
        setGameMatchedPairs([]);
        setMismatchIndices([]);
        setMatchPulseIndices([]);
        cardRefs.current = [];
        matchingParticlesRef.current = [];
      } else if (game.gameType === 'maze') {
        // Generate Maze Grid
        const mazeW = 15; // Must be odd for DFS
        const mazeH = 11;
        const { maze, end, questionMap } = generateMaze(mazeW, mazeH, game.questions.length);
        setMazeGrid(maze);
        setPlayerPos({ x: 1, y: 1 });
        setGameQuestionMap(questionMap);
        setMazeSteps(0);
        setGameCurrentQuestionIndex(-1); // Ensure no modal on start
      }

      setShowGameModal(true);
    } catch (error: any) {
      console.error('載入遊戲失敗:', error);
      alert(error.message || '載入遊戲失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!showGameModal || !gameStartTime) return;
    const interval = setInterval(() => setGameTimerTick(v => v + 1), 1000);
    return () => clearInterval(interval);
  }, [showGameModal, gameStartTime]);

  // Maze Movement Logic
  const handleMazeMove = (dx: number, dy: number) => {
    if (gameStatus !== 'playing') return;

    const newX = playerPos.x + dx;
    const newY = playerPos.y + dy;

    // Check bounds
    if (newY < 0 || newY >= mazeGrid.length || newX < 0 || newX >= mazeGrid[0].length) return;

    const cell = mazeGrid[newY][newX];

    // Wall
    if (cell === 0) return;

    // Gate / Question
    if (cell === 4) {
      // Trigger Question
      const qIndex = gameQuestionMap[`${newX},${newY}`];
      setGameCurrentQuestionIndex(qIndex);
      // Don't move into the cell yet, open question modal
      // We need a specific state to show the question overlay
      // For simplicity, we can reuse the "card" overlay style
    } else if (cell === 3) {
      // Exit
      setPlayerPos({ x: newX, y: newY });
      handleGameComplete(true);
    } else {
      // Walk
      setPlayerPos({ x: newX, y: newY });
      setMazeSteps(prev => prev + 1);
    }
  };

  // 處理迷宮/問答遊戲選擇 (For Grid Maze)
  const handleMazeAnswer = (isCorrect: boolean, atX: number, atY: number) => {
    if (isCorrect) {
      // Updates map to remove gate
      const newGrid = [...mazeGrid];
      newGrid[atY][atX] = 1; // Become path
      setMazeGrid(newGrid);

      setGameScore(prev => prev + 1);
      setGameCurrentQuestionIndex(-1); // Close question overlay

      // Move player into the cell
      setPlayerPos({ x: atX, y: atY });
      setMazeSteps(prev => prev + 1);
    } else {
      alert('回答錯誤，請再試一次！');
      // Can add penalty here
    }
  };


  // 執行富文本格式化命令
  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
  };

  // 處理文字顏色變化
  const handleTextColorChange = (color: string) => {
    setCurrentTextColor(color);
    execCommand('foreColor', color);
  };

  // 處理字體大小變化
  const handleFontSizeChange = (size: string) => {
    setCurrentFontSize(size);
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

  // 處理圖片上傳
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const img = `<img src="${base64}" style="max-width: 100%; height: auto; border-radius: 8px;" />`;
        document.execCommand('insertHTML', false, img);
      };
      reader.readAsDataURL(file);
    }
    // 重置文件輸入
    event.target.value = '';
  };

  // 提交學生回應
  const handleSubmitResponse = async () => {
    if (!responseContent.trim() || !selectedDiscussion) {
      alert('請輸入回應內容');
      return;
    }

    try {
      setSubmittingResponse(true);

      const safeContent = sanitizeHtml(responseContent);
      const result = await authService.submitStudentResponse(selectedDiscussion.id, safeContent);

      alert('回應提交成功！');
      setResponseContent('');

      // 更新回應狀態
      setResponseStatus(prev => ({
        ...prev,
        [selectedDiscussion.id]: { hasResponded: true, response: result.response }
      }));

      // 重新載入所有回應
      loadAllResponses(selectedDiscussion.id);

    } catch (error: any) {
      console.error('提交回應失敗:', error);
      alert(error.message || '提交回應失敗，請稍後再試');
    } finally {
      setSubmittingResponse(false);
    }
  };

  // 檢查學生回應狀態
  const checkResponseStatus = async (discussionId: string) => {
    try {
      const status = await authService.checkStudentResponse(discussionId);
      setResponseStatus(prev => ({
        ...prev,
        [discussionId]: status
      }));
    } catch (error) {
      console.error('檢查回應狀態失敗:', error);
    }
  };

  // 載入學生的討論串、小測驗和遊戲
  const loadDiscussions = async (isManualRefresh = false, isBackgroundRefresh = false) => {
    if (!user || user.role !== 'student') return;

    try {
      if (!isBackgroundRefresh) {
        if (isManualRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
      }

      // 並行載入討論串、小測驗、遊戲和問答比賽
      const [discussionResponse, quizResponse, gameResponse, botTaskResponse, contestResponse] = await Promise.all([
        authService.getStudentDiscussions(),
        authService.getStudentQuizzes(),
        authService.getStudentGames(),
        authService.getStudentBotTasks(),
        authService.getStudentContests()
      ]);

      const discussionList = Array.isArray(discussionResponse.discussions) ? discussionResponse.discussions : [];
      setDiscussions(discussionList);

      // 轉換討論串為任務格式
      const discussionTasks: Task[] = discussionList.map((discussion: Discussion) => ({
        id: discussion.id,
        title: discussion.title,
        type: 'discussion' as const,
        subject: discussion.subject,
        teacherName: discussion.teacherName,
        teacherAvatar: '/teacher_login.png',
        createdAt: discussion.createdAt
      }));

      // 轉換小測驗為任務格式
      const quizTasks: Task[] = (quizResponse.quizzes || []).map((quiz: any) => ({
        id: quiz.id,
        title: quiz.title,
        type: 'quiz' as const,
        subject: quiz.subject,
        teacherName: quiz.teacherName || '系統',
        teacherAvatar: '/teacher_login.png',
        createdAt: quiz.createdAt || quiz.updatedAt || quiz.assignedAt,
        completed: quiz.completed || false,
        score: quiz.score || null
      }));

      // 轉換遊戲為任務格式
      const gameTasks: Task[] = (gameResponse.games || []).map((game: any) => ({
        id: game.id,
        title: game.title,
        type: 'game' as const,
        subject: game.subject,
        teacherName: '系統',
        teacherAvatar: '/teacher_login.png',
        createdAt: game.createdAt || game.updatedAt || game.assignedAt,
        completed: game.completed || false,
        score: game.bestScore || null
      }));

      const botTasks: Task[] = (botTaskResponse.tasks || []).map((t: any) => ({
        id: String(t.id),
        title: String(t.botName || t.title || 'Pedia 任務'),
        type: 'ai-bot' as const,
        subject: t.subject,
        teacherName: t.teacherName || '教師',
        teacherAvatar: '/teacher_login.png',
        createdAt: t.createdAt || t.updatedAt,
        completed: !!t.completed
      }));

      // 轉換問答比賽為任務格式
      const contestTasks: Task[] = (contestResponse.contests || []).map((contest: any) => ({
        id: String(contest.id),
        title: String(contest.title),
        type: 'contest' as const,
        subject: contest.subject,
        teacherName: '系統',
        teacherAvatar: '/teacher_login.png',
        createdAt: contest.createdAt || contest.updatedAt,
        completed: false, // 問答比賽可重複參賽，不設為已完成
        score: contest.bestScore || null,
        attempts: contest.attempts || 0,
        // 添加QuizContestModal所需的欄位
        topic: contest.topic,
        grade: contest.grade,
        questionCount: contest.questionCount || 0,
        timeLimitSeconds: contest.timeLimitSeconds,
        bestScore: contest.bestScore
      }));

      // 合併所有任務
      const allTasks = [...discussionTasks, ...quizTasks, ...gameTasks, ...botTasks, ...contestTasks];
      setTasks(allTasks);
      setLastRefresh(new Date());

      // 檢查每個討論串的回應狀態
      discussionList.forEach((discussion: Discussion) => {
        checkResponseStatus(discussion.id);
      });

    } catch (error) {
      console.error('載入任務失敗:', error);
      setTasks([]);
    } finally {
      if (!isBackgroundRefresh) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  // 手動刷新
  const handleManualRefresh = () => {
    loadDiscussions(true);
  };

  // 獲取所有回應
  const loadAllResponses = async (discussionId: string) => {
    try {
      const result = await authService.getAllResponsesForStudents(discussionId);
      setAllResponses(prev => ({
        ...prev,
        [discussionId]: Array.isArray(result.responses) ? result.responses : []
      }));
    } catch (error) {
      console.error('載入所有回應失敗:', error);
      setAllResponses(prev => ({
        ...prev,
        [discussionId]: []
      }));
    }
  };

  // 處理討論串點擊
  const handleDiscussionClick = (taskId: string) => {
    const discussion = discussions.find(d => d.id === taskId);
    if (discussion) {
      setSelectedDiscussion(discussion);
      setShowDiscussionModal(true);
      // 載入所有回應
      loadAllResponses(taskId);
    }
  };

  // 處理問答比賽點擊
  const handleContestClick = (contestId: string) => {
    const contest = tasks.find(t => t.id === contestId && t.type === 'contest');
    if (contest) {
      setSelectedContest(contest);
      setShowContestModal(true);
    }
  };

  // 處理小測驗點擊
  const handleQuizClick = async (quizId: string) => {
    try {
      setLoading(true);
      const response = await authService.getQuizForStudent(quizId);

      if (response.mode === 'review') {
        setSelectedQuiz(response.quiz);
        setViewingQuizResult(response.studentResult);
        setShowQuizModal(true);
      } else {
        setSelectedQuiz(response.quiz);
        setQuizAnswers(new Array(response.quiz.questions.length).fill(-1)); // 初始化答案數組
        setQuizStartTime(new Date());
        setViewingQuizResult(null);
        setShowQuizModal(true);
      }
    } catch (error: any) {
      console.error('載入小測驗失敗:', error);
      alert(error.message || '載入小測驗失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleBotTaskClick = (taskId: string) => {
    setSelectedBotTaskId(String(taskId));
    setShowBotTaskChat(true);
  };

  // 處理答案選擇
  const handleAnswerSelect = (questionIndex: number, answerIndex: number) => {
    setQuizAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[questionIndex] = answerIndex;
      return newAnswers;
    });
  };

  // 提交小測驗
  const handleSubmitQuiz = async () => {
    // 檢查是否所有問題都已回答
    if (quizAnswers.includes(-1)) {
      alert('請回答所有問題後再提交');
      return;
    }

    if (!confirm('確定要提交測驗嗎？提交後無法修改答案。')) {
      return;
    }

    try {
      setSubmittingQuiz(true);
      const timeSpent = quizStartTime ? Math.round((Date.now() - quizStartTime.getTime()) / 1000) : 0;

      const result = await authService.submitQuizAnswer(selectedQuiz.id, quizAnswers, timeSpent);

      alert(`測驗提交成功！\n您的得分：${Math.round(result.result.score)}%\n正確答案：${result.result.correctAnswers}/${result.result.totalQuestions}`);

      // 關閉模態框並重新載入任務
      setShowQuizModal(false);
      setSelectedQuiz(null);
      setQuizAnswers([]);
      setQuizStartTime(null);

      // 重新載入任務列表以更新狀態
      loadDiscussions();

    } catch (error: any) {
      console.error('提交測驗失敗:', error);
      alert(error.message || '提交測驗失敗');
    } finally {
      setSubmittingQuiz(false);
    }
  };



  // 處理配對遊戲卡片點擊
  const handleCardClick = (index: number) => {
    if (gameSelectedCards.length >= 2 || gameMatchingCards[index].isMatched || gameMatchingCards[index].isFlipped) {
      return;
    }

    const newCards = [...gameMatchingCards];
    newCards[index] = { ...newCards[index], isFlipped: true };
    setGameMatchingCards(newCards);

    const newSelected = [...gameSelectedCards, index];
    setGameSelectedCards(newSelected);

    if (newSelected.length === 2) {
      const card1 = newCards[newSelected[0]];
      const card2 = newCards[newSelected[1]];

      if (card1.pairId === card2.pairId && card1.type !== card2.type) {
        // 配對成功
        burstAtIndices(newSelected);
        setMatchPulseIndices(newSelected);
        setTimeout(() => setMatchPulseIndices([]), 500);

        setTimeout(() => {
          const matchedCards = [...newCards];
          matchedCards[newSelected[0]].isMatched = true;
          matchedCards[newSelected[1]].isMatched = true;
          setGameMatchingCards(matchedCards);
          setGameSelectedCards([]);
          setGameMatchedPairs(prev => [...prev, String(card1.pairId)]);

          // 檢查是否所有都配對完成
          if (matchedCards.every(c => c.isMatched)) {
            // 讓學生先看到完成動畫
            spawnConfettiRain();
            setTimeout(() => handleGameComplete(true), 900);
          }
        }, 800);
      } else {
        // 配對失敗
        setMismatchIndices(newSelected);
        setTimeout(() => setMismatchIndices([]), 600);

        setTimeout(() => {
          const resetCards = [...newCards];
          resetCards[newSelected[0]].isFlipped = false;
          resetCards[newSelected[1]].isFlipped = false;
          setGameMatchingCards(resetCards);
          setGameSelectedCards([]);
        }, 1100);
      }
    }
  };

  // 處理迷宮/問答遊戲選擇
  const handleGameOptionSelect = (isCorrect: boolean) => {
    if (isCorrect) {
      // 答對了
      const nextIndex = gameCurrentQuestionIndex + 1;
      setGameScore(prev => prev + 1);

      if (nextIndex < selectedGame.questions.length) {
        setGameCurrentQuestionIndex(nextIndex);
      } else {
        handleGameComplete(true);
      }
    } else {
      // 答錯了，重試或扣分
      alert('答案不正確，請再試一次！');
    }
  };

  // 遊戲完成處理
  const handleGameComplete = async (
    success: boolean,
    override?: {
      score: number;
      correctAnswers: number;
      totalQuestions: number;
      timeSpent: number;
      details?: any;
    }
  ) => {
    if (gameCompleteOnceRef.current) return;
    gameCompleteOnceRef.current = true;
    setGameStatus(success ? 'completed' : 'lost');

    try {
      if (submittingGame) return;
      setSubmittingGame(true);
      const timeSpent = override?.timeSpent ?? (gameStartTime ? Math.round((Date.now() - gameStartTime.getTime()) / 1000) : 0);
      const totalQuestions = override?.totalQuestions ?? (selectedGame?.questions?.length || 0);
      const correctAnswers = override?.correctAnswers ?? (success ? totalQuestions : 0);
      const score = override?.score ?? (success ? 100 : Math.max(0, Math.round(gameScore)));

      await authService.submitGameScore(selectedGame.id, {
        score,
        correctAnswers,
        totalQuestions,
        timeSpent,
        ...(override?.details ? { details: override.details } : null)
      });

      if (success) {
        alert(`恭喜！遊戲通關！\n耗時：${timeSpent}秒`);
      } else {
        alert(`遊戲結束！\n分數：${score}\n耗時：${timeSpent}秒`);
      }

      setTimeout(() => {
        setShowGameModal(false);
        loadDiscussions();
      }, 2000);
    } catch (error) {
      console.error('提交成績失敗:', error);
    } finally {
      setSubmittingGame(false);
    }
  };

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

  // 渲染討論串內容
  const renderDiscussionContent = (content: any) => {
    const blocks = normalizeContentBlocks(content);
    if (blocks.length === 0) {
      return <div className="text-gray-500 font-bold">（無內容）</div>;
    }

    return blocks.map((block, index) => (
      <div key={index} className="mb-4">
        {block.type === 'text' && (
          <div className="prose prose-brand-brown max-w-none">
            <p className="whitespace-pre-wrap">{block.value}</p>
          </div>
        )}
        {block.type === 'image' && (
          <div className="flex justify-center">
            <img
              src={block.value}
              alt="討論串圖片"
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
          <div
            className="p-3 bg-gray-50 border-2 border-gray-200 rounded-xl"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.value) }}
          />
        )}
      </div>
    ));
  };

  // 初始載入
  useEffect(() => {
    loadDiscussions();
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    setHiddenTaskKeys(loadHiddenTaskKeys(user.id, 'student'));
  }, [user?.id]);

  const AUTO_HIDE_DAYS = 14;
  const isAutoHidden = (createdAt?: string) => {
    if (!createdAt) return false;
    const createdMs = new Date(createdAt).getTime();
    if (!Number.isFinite(createdMs)) return false;
    return Date.now() - createdMs >= AUTO_HIDE_DAYS * 24 * 60 * 60 * 1000;
  };

  const isTaskHidden = (task: Task) => {
    const key = makeTaskKey(task.type, task.id);
    return isAutoHidden(task.createdAt) || hiddenTaskKeys.has(key);
  };

  const selectedSubjectTasks = useMemo(
    () => tasks.filter(task => task.subject === selectedSubject),
    [tasks, selectedSubject]
  );

  const visibleTasks = useMemo(
    () => selectedSubjectTasks.filter(task => !isTaskHidden(task)),
    [hiddenTaskKeys, selectedSubjectTasks]
  );

  const hiddenTasks = useMemo(
    () => selectedSubjectTasks.filter(task => isTaskHidden(task)),
    [hiddenTaskKeys, selectedSubjectTasks]
  );

  const setManualHidden = (task: Task, hidden: boolean) => {
    if (!user?.id) return;
    if (isAutoHidden(task.createdAt)) return;
    const key = makeTaskKey(task.type, task.id);
    setHiddenTaskKeys(prev => {
      const next = new Set(prev);
      if (hidden) next.add(key);
      else next.delete(key);
      saveHiddenTaskKeys(user.id, 'student', next);
      return next;
    });
  };

  const isTaskCompleted = (task: Task) => {
    if (task.type === 'discussion') return !!responseStatus[task.id]?.hasResponded;
    if (task.type === 'quiz' || task.type === 'game') return !!task.completed;
    if (task.type === 'contest') return false; // 問答比賽可重複參賽，不算已完成
    return false;
  };

  const visibleAllTasks = useMemo(() => tasks.filter(task => !isTaskHidden(task)), [hiddenTaskKeys, tasks]);

  const overallProgress = useMemo(() => {
    const total = visibleAllTasks.length;
    const completed = visibleAllTasks.filter(isTaskCompleted).length;
    return { total, completed, pending: Math.max(0, total - completed) };
  }, [responseStatus, visibleAllTasks]);

  const subjectProgress = useMemo(() => {
    const map = new Map<Subject, { total: number; completed: number }>();
    for (const subject of Object.values(Subject)) {
      map.set(subject, { total: 0, completed: 0 });
    }
    for (const task of visibleAllTasks) {
      const row = map.get(task.subject) ?? { total: 0, completed: 0 };
      row.total += 1;
      if (isTaskCompleted(task)) row.completed += 1;
      map.set(task.subject, row);
    }
    return map;
  }, [responseStatus, visibleAllTasks]);

  // 設置自動刷新，每5秒檢查一次新的討論串
  useEffect(() => {
    if (!user || user.role !== 'student') return;

    const interval = setInterval(() => {
      loadDiscussions(false, true);
    }, 60000); // 1分鐘刷新一次

    return () => clearInterval(interval);
  }, [user]);

  const subjectConfig = SUBJECT_CONFIG[selectedSubject];

  return (
    <div className="min-h-full font-sans flex flex-col relative overflow-x-hidden" style={{ backgroundColor: '#D9F3D5' }}>
       {/* Background */}
       <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-80"
        style={{
          backgroundImage: `url('/studentpagebg.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />

      {/* Header */}
      <header className="relative z-20 bg-[#A1D9AE] border-b-4 border-brand-brown py-2 px-6 flex justify-between items-center shadow-md">
        <div className="w-10"></div>
        <div className="text-center">
          <h1 className="text-4xl font-black text-brand-brown font-rounded tracking-wider">LPedia</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowUiSettings(true)}
            className="w-10 h-10 bg-brand-cream rounded-full border-2 border-brand-brown flex items-center justify-center hover:bg-white"
            title="介面顯示設定"
          >
            <Settings className="w-6 h-6 text-brand-brown" />
          </button>
          <button
            onClick={logout}
            className="w-10 h-10 bg-brand-cream rounded-full border-2 border-brand-brown flex items-center justify-center hover:bg-white"
            title="登出"
          >
            <LogOut className="w-6 h-6 text-brand-brown" />
          </button>
        </div>
      </header>

      <div className="relative z-20 bg-[#A1D9AE] border-b-4 border-brand-brown py-2 flex justify-center shadow-comic">
        <h2 className="text-2xl font-bold text-brand-brown tracking-[0.2em]">學生中心</h2>
      </div>

      <UiSettingsModal open={showUiSettings} onClose={() => setShowUiSettings(false)} />
      <AiChatModal
        open={showAiChat}
        onClose={() => setShowAiChat(false)}
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

      {/* Main Layout */}
      <div className="flex-1 relative z-10 p-4 md:p-8 flex flex-col md:flex-row gap-6 max-w-7xl mx-auto w-full">

        {/* Sidebar Subject Selection */}
        <aside className="w-full md:w-64 bg-brand-cream border-4 border-brand-brown rounded-3xl p-6 shadow-comic flex-shrink-0 flex flex-col min-h-fit">
          {/* Avatar Group */}
          <div className="mb-4 relative h-24 flex justify-center">
            <img
              src="/student_login.png"
              alt="Students"
              className="h-full object-contain"
            />
          </div>

          {/* User Profile Section */}
          <div className="text-center mb-6">
            <div className="text-lg font-bold text-brand-brown">
              {user?.profile?.name || '學生'}
            </div>
            <div className="text-sm text-gray-600">
              {user?.username}
            </div>
            {user?.profile?.class && (
              <div className="text-sm text-gray-600">
                班級: {user.profile.class}
              </div>
            )}
          </div>

          {/* Progress Summary */}
          <div className="mb-6 bg-white/90 border-4 border-brand-brown rounded-3xl p-4 shadow-comic">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-black text-brand-brown">我的進度</div>
              <div className="text-xs font-bold text-gray-600">
                {overallProgress.total > 0 ? Math.round((overallProgress.completed / overallProgress.total) * 100) : 0}%
              </div>
            </div>
            <div className="h-3 bg-gray-200 rounded-full border-2 border-brand-brown overflow-hidden">
              <div
                className="h-full bg-[#93C47D]"
                style={{
                  width: `${overallProgress.total > 0 ? Math.round((overallProgress.completed / overallProgress.total) * 100) : 0}%`
                }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs font-bold text-gray-700">
              <span>收到 {overallProgress.total}</span>
              <span>完成 {overallProgress.completed}</span>
              <span>未完成 {overallProgress.pending}</span>
            </div>
          </div>
          
          <div className="text-center mb-4 border-b-4 border-brand-brown pb-2">
            <h3 className="text-xl font-bold text-brand-brown">我的學科</h3>
          </div>

          <nav className="flex-1 space-y-3 overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowAiChat(true)}
              className="w-[calc(100%-10px)] flex items-center gap-3 px-4 py-2 rounded-2xl border-4 transition-all duration-150 border-brand-brown bg-[#D2EFFF] hover:bg-white shadow-comic"
              title="AI對話"
            >
              <Bot className="w-6 h-6 text-brand-brown" />
              <span className="text-lg font-bold text-brand-brown flex-1 text-left">AI對話</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAppStudio(true)}
              className="w-[calc(100%-10px)] flex items-center gap-3 px-4 py-2 rounded-2xl border-4 transition-all duration-150 border-brand-brown bg-[#E8F5E9] hover:bg-white shadow-comic"
              title="小程式工作坊"
            >
              <Code2 className="w-6 h-6 text-brand-brown" />
              <span className="text-lg font-bold text-brand-brown flex-1 text-left">小程式工作坊</span>
            </button>

            {Object.values(Subject).map((subject) => {
              const config = SUBJECT_CONFIG[subject];
              const isSelected = selectedSubject === subject;
              const stats = subjectProgress.get(subject) ?? { total: 0, completed: 0 };
              return (
                <button
                  key={subject}
                  onClick={() => setSelectedSubject(subject)}
                  className={`w-[calc(100%-10px)] flex items-center gap-3 px-4 py-2 rounded-2xl border-4 transition-all duration-150 ${isSelected
                    ? 'border-brand-brown translate-x-2 bg-opacity-100 shadow-comic'
                    : 'border-transparent hover:border-brand-brown/30 bg-opacity-70'
                    }`}
                  style={{ backgroundColor: config.color }}
                >
                  <span className="text-2xl">{config.icon}</span>
                  <span className="text-lg font-bold text-brand-brown flex-1 text-left">{subject}</span>
                  {stats.total > 0 && (
                    <span className="text-xs font-black text-brand-brown bg-white/70 border-2 border-brand-brown rounded-xl px-2 py-1">
                      {stats.completed}/{stats.total}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-4 pt-4 border-t-4 border-brand-brown">
            <button onClick={() => navigate('/')} className="text-sm text-brand-brown font-bold hover:underline">← 返回登入</button>
          </div>
        </aside>

        {/* Task Area */}
        <main className="flex-1 bg-brand-cream border-4 border-brand-brown rounded-3xl p-6 md:p-10 shadow-comic min-h-[500px]">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-3xl font-bold text-brand-brown">我的任務</h3>
            <div className="flex items-center gap-3">
              {lastRefresh && (
                <span className="text-sm text-gray-500">
                  最後更新: {lastRefresh.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={handleManualRefresh}
                disabled={refreshing}
                className="flex items-center gap-1 px-3 py-1 bg-brand-green-light hover:bg-brand-green text-white rounded-xl border-2 border-brand-brown shadow-comic disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? '刷新中...' : '刷新'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <span className="text-4xl">{subjectConfig.icon}</span>
            <h4 className="text-2xl font-bold text-brand-brown">{selectedSubject}</h4>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-brown mx-auto mb-4"></div>
                <p className="text-brand-brown font-bold">載入中...</p>
              </div>
            ) : visibleTasks.length > 0 ? (
              visibleTasks.map(task => {
                const getTaskIcon = () => {
                  switch (task.type) {
                    case 'quiz': return <HelpCircle className="w-5 h-5 text-blue-600" />;
                    case 'ai-bot': return <Bot className="w-5 h-5 text-green-600" />;
                    case 'discussion': return <MessageSquare className="w-5 h-5 text-purple-600" />;
                    case 'game': return <span className="text-xl">🎮</span>;
                    case 'contest': return <span className="text-xl">🏁</span>;
                    default: return null;
                  }
                };

                const getTaskButtonText = () => {
                  if (task.type === 'discussion') {
                    const status = responseStatus[task.id];
                    if (status?.hasResponded) {
                      return '已回應 ✓';
                    }
                    return '參與討論';
                  }
                  if (task.type === 'quiz') {
                    if (task.completed) {
                      return task.score !== null ? `已完成 (${Math.round(task.score)}%)` : '已完成 ✓';
                    }
                    return '開始測驗';
                  }
                  if (task.type === 'game') {
                    if (task.completed) {
                      return task.score !== null ? `最佳分數: ${Math.round(task.score)}%` : '已遊玩 ✓';
                    }
                    return '開始遊戲';
                  }
                  if (task.type === 'contest') {
                    if (task.attempts && task.attempts > 0) {
                      const bestScore = task.score !== null ? `最佳: ${Math.round(task.score)}%` : '';
                      return `${bestScore} (${task.attempts}次)`;
                    }
                    return '開始比賽';
                  }
                  switch (task.type) {
                    case 'ai-bot': return task.completed ? '已完成 ✓' : '開始對話';
                    default: return '開始';
                  }
                };

                const getTaskButtonColor = () => {
                  if (task.type === 'discussion') {
                    const status = responseStatus[task.id];
                    if (status?.hasResponded) {
                      return 'bg-[#93C47D] hover:bg-[#86b572]'; // 已回應：綠色
                    }
                    return 'bg-[#F8C5C5] hover:bg-[#F0B5B5]'; // 未回應：原本的粉紅色
                  }
                  if (task.type === 'quiz') {
                    if (task.completed) {
                      return 'bg-[#93C47D] hover:bg-[#86b572]'; // 已完成：綠色
                    }
                    return 'bg-[#FDEEAD] hover:bg-[#FCE690]'; // 未完成：黃色
                  }
                  if (task.type === 'game') {
                    if (task.completed) {
                      return 'bg-[#93C47D] hover:bg-[#86b572]'; // 已遊玩：綠色
                    }
                    return 'bg-[#E8F5E9] hover:bg-[#C8E6C9]'; // 未遊玩：淺綠色
                  }
                  switch (task.type) {
                    case 'ai-bot': return task.completed ? 'bg-[#93C47D] hover:bg-[#86b572]' : 'bg-[#B5D8F8] hover:bg-[#A1CCF0]';
                    case 'contest': return task.attempts && task.attempts > 0 ? 'bg-[#FFE4B5] hover:bg-[#FFDBA1]' : 'bg-[#FFF2DC] hover:bg-[#FCEBCD]'; // 已參賽：橙色，未參賽：淺橙色
                    default: return 'bg-[#93C47D] hover:bg-[#86b572]';
                  }
                };

                return (
                  <div key={makeTaskKey(task.type, task.id)} className="bg-white border-4 border-brand-brown rounded-3xl p-4 flex items-center shadow-comic hover:-translate-y-1 transition-transform">
                    <div className="w-14 h-14 rounded-full border-2 border-brand-brown overflow-hidden flex-shrink-0 bg-gray-100">
                      <img src={task.teacherAvatar} alt={task.teacherName} className="w-full h-full object-cover" />
                    </div>
                    <div className="ml-4 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getTaskIcon()}
                        <h5 className="text-xl font-bold text-brand-brown">{task.title}</h5>
                      </div>
                      <p className="text-gray-500 text-sm">- {task.teacherName}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setManualHidden(task, true);
                      }}
                      className="mr-3 w-10 h-10 rounded-2xl border-4 border-brand-brown bg-gray-100 hover:bg-gray-200 shadow-comic active:translate-y-1 active:shadow-none flex items-center justify-center"
                      title="隱藏（14天內可取消）"
                      aria-label="隱藏"
                    >
                      <EyeOff className="w-5 h-5 text-brand-brown" />
                    </button>
                    <button
                      onClick={() => {
                        if (task.type === 'discussion') {
                          handleDiscussionClick(task.id);
                        } else if (task.type === 'quiz') {
                          handleQuizClick(task.id);
                        } else if (task.type === 'game') {
                          handleGameClick(task.id);
                        } else if (task.type === 'ai-bot') {
                          handleBotTaskClick(task.id);
                        } else if (task.type === 'contest') {
                          handleContestClick(task.id);
                        }
                      }}
                      className={`${getTaskButtonColor()} text-brand-brown font-bold px-6 py-2 rounded-2xl border-4 border-brand-brown shadow-comic active:translate-y-1 active:shadow-none bg-opacity-100 ${task.type === 'quiz' && task.completed ? 'cursor-pointer hover:bg-green-300' : ''
                        }`}
                    >
                      {task.type === 'quiz' && task.completed ? '查看結果' : getTaskButtonText()}
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-gray-400 font-bold text-xl border-4 border-dashed border-gray-300 rounded-3xl">
                目前沒有任務 🎉
              </div>
            )}
          </div>

          {hiddenTasks.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowHiddenTasks(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-100 hover:bg-gray-200 border-2 border-gray-300 rounded-2xl font-bold text-gray-700"
              >
                <span>已隱藏 ({hiddenTasks.length})</span>
                <span className="text-sm">{showHiddenTasks ? '收起' : '展開'}</span>
              </button>

              {showHiddenTasks && (
                <div className="mt-4 space-y-4">
                  {hiddenTasks.map((task) => {
                    const autoHidden = isAutoHidden(task.createdAt);
                    const taskKey = makeTaskKey(task.type, task.id);
                    const manuallyHidden = hiddenTaskKeys.has(taskKey) && !autoHidden;

                    const openTask = () => {
                      if (task.type === 'discussion') handleDiscussionClick(task.id);
                      else if (task.type === 'quiz') handleQuizClick(task.id);
                      else if (task.type === 'game') handleGameClick(task.id);
                      else if (task.type === 'ai-bot') handleBotTaskClick(task.id);
                      else if (task.type === 'contest') handleContestClick(task.id);
                    };

                    return (
                      <div key={taskKey} className="bg-gray-50 border-4 border-gray-300 rounded-3xl p-4 flex items-center shadow-comic">
                        <div className="w-14 h-14 rounded-full border-2 border-brand-brown overflow-hidden flex-shrink-0 bg-gray-100">
                          <img src={task.teacherAvatar} alt={task.teacherName} className="w-full h-full object-cover" />
                        </div>
                        <div className="ml-4 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {task.type === 'game'
                              ? <span className="text-xl">🎮</span>
                              : task.type === 'quiz'
                                ? <HelpCircle className="w-5 h-5 text-blue-600" />
                                : task.type === 'ai-bot'
                                  ? <Bot className="w-5 h-5 text-green-600" />
                                  : task.type === 'contest'
                                    ? <span className="text-xl">🏁</span>
                                    : <MessageSquare className="w-5 h-5 text-purple-600" />
                            }
                            <h5 className="text-xl font-bold text-brand-brown">{task.title}</h5>
                            {autoHidden && (
                              <span className="ml-2 text-xs font-bold px-2 py-1 rounded bg-gray-200 text-gray-700">
                                超過14天自動隱藏
                              </span>
                            )}
                          </div>
                          <p className="text-gray-500 text-sm">- {task.teacherName}</p>
                        </div>

                        {manuallyHidden && (
                          <button
                            onClick={() => setManualHidden(task, false)}
                            className="mr-3 w-10 h-10 rounded-2xl border-4 border-brand-brown bg-white hover:bg-gray-100 shadow-comic active:translate-y-1 active:shadow-none flex items-center justify-center"
                            title="取消隱藏"
                            aria-label="顯示"
                          >
                            <Eye className="w-5 h-5 text-brand-brown" />
                          </button>
                        )}

                        <button
                          onClick={openTask}
                          className="bg-[#FDEEAD] hover:bg-[#FCE690] text-brand-brown font-bold px-6 py-2 rounded-2xl border-4 border-brand-brown shadow-comic active:translate-y-1 active:shadow-none"
                        >
                          開啟
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </main>

      </div>

      {/* Discussion Content Modal */}
      {showDiscussionModal && selectedDiscussion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-comic">
            <div className="p-6 border-b-4 border-brand-brown bg-[#F8C5C5]">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-black text-brand-brown">{selectedDiscussion.title}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedDiscussion.teacherName} • {selectedDiscussion.subject} • {new Date(selectedDiscussion.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowDiscussionModal(false);
                    setSelectedDiscussion(null);
                    setResponseContent('');
                  }}
                  className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center flex-shrink-0"
                >
                  <X className="w-6 h-6 text-brand-brown" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="prose prose-brand-brown max-w-none mb-6">
                {renderDiscussionContent(selectedDiscussion.content)}
              </div>

              {/* 學生回應區域 */}
              <div className="border-t-4 border-brand-brown pt-6">
                <h3 className="text-xl font-bold text-brand-brown mb-4">所有回應</h3>

                {/* 顯示所有回應 */}
                {(() => {
                  const responseList = Array.isArray(allResponses[selectedDiscussion.id])
                    ? allResponses[selectedDiscussion.id]
                    : [];

                  if (responseList.length === 0) {
                    return (
                      <div className="text-gray-500 text-center py-8 mb-6">
                        還沒有任何回應，成為第一個回應的學生吧！
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4 mb-6">
                      {responseList.map((response: any, index: number) => {
                        const isCurrentUser = response.studentId === user?.id;
                        return (
                          <div
                            key={response.id || index}
                            className={`border-2 rounded-xl p-4 ${isCurrentUser
                              ? 'bg-blue-50 border-blue-300'
                              : 'bg-gray-50 border-gray-300'
                              }`}
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isCurrentUser
                                ? 'bg-blue-500'
                                : 'bg-gray-500'
                                }`}>
                                <span className="text-white text-sm font-bold">
                                  {isCurrentUser ? '你' : response.studentName?.charAt(0) || '?'}
                                </span>
                              </div>
                              <span className={`font-bold ${isCurrentUser
                                ? 'text-blue-700'
                                : 'text-gray-700'
                                }`}>
                                {isCurrentUser ? '你的回應' : `${response.studentName || '未知學生'} 的回應`}
                              </span>
                              <span className="text-sm text-gray-500">
                                {new Date(response.createdAt).toLocaleString()}
                              </span>
                              {response.studentClass && (
                                <span className="text-sm text-gray-400">
                                  ({response.studentClass})
                                </span>
                              )}
                            </div>
                            <div
                              className="bg-white border border-gray-200 rounded-lg p-4 min-h-16"
                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(response.content || '載入中...') }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* 編輯器 - 無論是否已回應都顯示 */}
                <div className="space-y-4">
                  <h4 className="text-lg font-bold text-brand-brown">
                    {(Array.isArray(allResponses[selectedDiscussion.id]) ? allResponses[selectedDiscussion.id] : []).some(r => r.studentId === user?.id)
                      ? '新增回應'
                      : '撰寫回應'
                    }
                  </h4>

                  {/* 富文本編輯器工具欄 */}
                  <div className="bg-gray-100 border-2 border-gray-300 rounded-t-xl p-3">
                    <div className="flex flex-wrap gap-2 items-center">
                      {/* 基本格式化按鈕 */}
                      <button
                        onClick={() => execCommand('bold')}
                        className="p-2 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50"
                        title="粗體"
                      >
                        <strong>B</strong>
                      </button>
                      <button
                        onClick={() => execCommand('italic')}
                        className="p-2 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50"
                        title="斜體"
                      >
                        <em>I</em>
                      </button>
                      <button
                        onClick={() => execCommand('underline')}
                        className="p-2 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50"
                        title="底線"
                      >
                        <u>U</u>
                      </button>

                      {/* 分隔線 */}
                      <div className="w-px h-8 bg-gray-400 mx-2"></div>

                      {/* 字體大小 */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">大小:</span>
                        <input
                          type="range"
                          min="12"
                          max="32"
                          value={currentFontSize}
                          onChange={(e) => handleFontSizeChange(e.target.value)}
                          className="w-20"
                        />
                        <span className="text-sm text-gray-600 min-w-[30px]">{currentFontSize}px</span>
                      </div>

                      {/* 文字顏色 */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">顏色:</span>
                        <input
                          type="color"
                          value={currentTextColor}
                          onChange={(e) => handleTextColorChange(e.target.value)}
                          className="w-8 h-8 border-2 border-gray-300 rounded cursor-pointer"
                        />
                      </div>

                      {/* 分隔線 */}
                      <div className="w-px h-8 bg-gray-400 mx-2"></div>

                      {/* 圖片上傳 */}
                      <label className="p-2 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer" title="插入圖片">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                        📷
                      </label>
                    </div>
                  </div>

                  {/* 編輯區域 */}
                  <div
                    contentEditable
                    onInput={(e) => setResponseContent(e.currentTarget.innerHTML)}
                    className="min-h-32 p-4 border-2 border-gray-300 rounded-b-xl bg-white focus:outline-none focus:border-[#A1D9AE] resize-none"
                    placeholder="輸入你的回應..."
                    style={{
                      fontSize: `${currentFontSize}px`,
                      color: currentTextColor
                    }}
                  />

                  {/* 提交按鈕 */}
                  <div className="flex justify-end">
                    <button
                      onClick={handleSubmitResponse}
                      disabled={submittingResponse || !responseContent.trim()}
                      className="px-6 py-2 bg-[#A1D9AE] hover:bg-[#8BC7A0] text-white font-bold rounded-xl border-2 border-[#5E8B66] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submittingResponse ? '提交中...' : (responseStatus[selectedDiscussion.id]?.hasResponded ? '提交新回應' : '提交回應')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Taking Modal */}
      {/* Game Playing Modal */}
      {showGameModal && selectedGame && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#2D2D2D] border-4 border-[#4A4A4A] rounded-3xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">

            {/* Game Header */}
            <div className="bg-[#1A1A1A] p-4 flex justify-between items-center border-b-2 border-[#4A4A4A]">
              <div>
                <h2 className="text-2xl font-black text-white tracking-widest">{selectedGame.title}</h2>
	                <p className="text-gray-400 text-sm">
	                  {selectedGame.gameType === 'matching'
	                    ? '記憶配對'
	                    : selectedGame.gameType === 'math'
	                      ? '數學遊戲'
	                    : selectedGame.gameType === 'maze'
	                      ? '知識迷宮'
	                      : '答題塔防'} • {selectedGame.subject}
	                </p>
              </div>
              <div className="flex items-center gap-4">
                {gameStartTime && (
                  <div className="bg-[#333] px-3 py-1 rounded text-green-400 font-mono">
                    時間: {Math.floor((Date.now() - gameStartTime.getTime()) / 1000)}s
                  </div>
                )}
                <button
                  onClick={() => setShowGameModal(false)}
                  className="w-10 h-10 rounded-full bg-[#333] hover:bg-[#444] text-white flex items-center justify-center transition-colors"
                >
                  <X />
                </button>
              </div>
            </div>

            {/* Game Canvas / Area */}
            <div className="flex-1 bg-[#222] p-8 overflow-y-auto relative">

	              {/* Matching Game Layout */}
	              {selectedGame.gameType === 'matching' && (
	                <div className="flex flex-col items-center h-full">
	                  <style>{`
	                    @keyframes lp-card-pop {
	                      0% { transform: translateZ(0) scale(1); }
	                      40% { transform: translateZ(20px) scale(1.12) rotateZ(1deg); }
	                      100% { transform: translateZ(0) scale(1); }
	                    }
	                    @keyframes lp-card-shake {
	                      0%, 100% { transform: translateX(0) rotateZ(0); }
	                      20% { transform: translateX(-6px) rotateZ(-2deg); }
	                      40% { transform: translateX(6px) rotateZ(2deg); }
	                      60% { transform: translateX(-4px) rotateZ(-1deg); }
	                      80% { transform: translateX(4px) rotateZ(1deg); }
	                    }
	                  `}</style>
	                  <div className="flex justify-between w-full max-w-4xl mb-6 px-4">
	                    <div className="text-white text-xl font-bold bg-[#333] px-6 py-2 rounded-full border border-[#555]">
	                      配對進度: {gameMatchedPairs.length} / {selectedGame.questions.length}
	                    </div>
	                    <div className="text-white text-xl font-bold bg-[#333] px-6 py-2 rounded-full border border-[#555]">
	                      步數: {gameSelectedCards.length + gameMatchedPairs.length * 2}
	                    </div>
	                  </div>

	                  <div
	                    ref={matchingAreaRef}
	                    className="relative grid grid-cols-2 md:grid-cols-4 gap-5 max-w-5xl w-full mx-auto p-4 content-start overflow-y-auto"
	                  >
	                    <canvas
	                      ref={matchingCanvasRef}
	                      className="absolute inset-0 w-full h-full pointer-events-none z-20"
	                    />
	                    {gameMatchingCards.map((card, index) => (
	                      <div
	                        key={card.id}
	                        className={`group relative aspect-[3/4] [perspective:1400px] transition-transform duration-300 ${card.isMatched ? 'cursor-default' : 'cursor-pointer'}
	                          ${!card.isFlipped && !card.isMatched ? 'hover:[transform:translateY(-6px)_rotateX(8deg)_rotateZ(-1deg)] active:scale-95' : ''}
	                          ${mismatchIndices.includes(index) ? 'animate-[lp-card-shake_0.6s_ease-in-out]' : ''}
	                          ${matchPulseIndices.includes(index) ? 'animate-[lp-card-pop_0.45s_ease-out]' : ''}
	                        `}
	                        ref={(el) => { cardRefs.current[index] = el; }}
	                        onClick={() => handleCardClick(index)}
	                      >
	                        <div
	                          className={`w-full h-full duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] [transform-style:preserve-3d] absolute inset-0 transition-all will-change-transform
	                            ${card.isFlipped || card.isMatched ? '[transform:rotateY(180deg)]' : ''}
	                            ${card.isMatched ? 'opacity-0 scale-0 [transform:rotateY(180deg)_scale(0.2)]' : 'opacity-100 scale-100'}`}
	                        >
	                          {/* Card Back (Hidden state) */}
	                          <div className="absolute inset-0 [backface-visibility:hidden] w-full h-full rounded-2xl shadow-[0_18px_0_rgba(0,0,0,0.25)] border-[5px] border-indigo-200 overflow-hidden bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
	                            <svg viewBox="0 0 200 260" className="absolute inset-0 w-full h-full opacity-25">
	                              <defs>
	                                <pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse">
	                                  <circle cx="3" cy="3" r="3" fill="white" />
	                                </pattern>
	                              </defs>
	                              <rect width="200" height="260" fill="url(#dots)" />
	                              <path d="M0 210 C40 180 70 230 110 205 C150 180 170 235 200 210 L200 260 L0 260 Z" fill="rgba(255,255,255,0.6)" />
	                            </svg>
	                            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-4 text-center">
	                              <svg viewBox="0 0 120 120" className="w-20 h-20 drop-shadow-md mb-2">
	                                <circle cx="60" cy="60" r="46" fill="#FDEFCB" stroke="#5E4C40" strokeWidth="6" />
	                                <circle cx="44" cy="52" r="7" fill="#5E4C40" />
	                                <circle cx="76" cy="52" r="7" fill="#5E4C40" />
	                                <path d="M38 72 Q60 88 82 72" stroke="#5E4C40" strokeWidth="6" fill="none" strokeLinecap="round" />
	                                <circle cx="30" cy="40" r="8" fill="#F8B5E0" opacity="0.9" />
	                                <circle cx="90" cy="40" r="8" fill="#F8B5E0" opacity="0.9" />
	                                <path d="M60 12 V4" stroke="#5E4C40" strokeWidth="6" strokeLinecap="round" />
	                                <circle cx="60" cy="2" r="6" fill="#B5D8F8" stroke="#5E4C40" strokeWidth="4" />
	                              </svg>
	                              <div className="text-white font-black tracking-widest text-xl drop-shadow">
	                                翻牌記憶
	                              </div>
	                              <div className="mt-1 text-white/90 text-sm font-bold">
	                                {selectedGame.subject}
	                              </div>
	                            </div>
	                          </div>

	                          {/* Card Front (Revealed state) */}
	                          <div className="absolute inset-0 [backface-visibility:hidden] w-full h-full [transform:rotateY(180deg)] rounded-2xl shadow-[0_14px_0_rgba(0,0,0,0.25)] flex flex-col items-center justify-center p-4 border-[5px] border-yellow-400 bg-gradient-to-br from-white via-yellow-50 to-white overflow-hidden">
	                            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-yellow-200/60 blur-xl" />
	                            <div className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full bg-blue-200/50 blur-xl" />
	                            <div className="absolute inset-0 opacity-10 flex items-center justify-center text-7xl">
	                              {SUBJECT_CONFIG[selectedGame.subject as Subject]?.icon || '⭐'}
	                            </div>
	                            <div className="relative z-10 flex items-center gap-2 mb-2">
	                              <span className={`text-xs font-black uppercase px-3 py-1 rounded-full border-2 shadow-sm ${card.type === 'question' ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-green-100 text-green-800 border-green-300'
	                                }`}>
	                                {card.type === 'question' ? '問題' : '答案'}
	                              </span>
	                              {card.type === 'question' ? (
	                                <svg viewBox="0 0 64 64" className="w-6 h-6">
	                                  <path d="M30 4 L12 36 H30 L24 60 L52 24 H34 L40 4 Z" fill="#F8E2B5" stroke="#5E4C40" strokeWidth="4" strokeLinejoin="round" />
	                                </svg>
	                              ) : (
	                                <svg viewBox="0 0 64 64" className="w-6 h-6">
	                                  <path d="M32 56 C16 44 8 34 8 24 C8 14 16 8 24 8 C28 8 32 10 32 14 C32 10 36 8 40 8 C48 8 56 14 56 24 C56 34 48 44 32 56 Z" fill="#F8B5E0" stroke="#5E4C40" strokeWidth="4" strokeLinejoin="round" />
	                                </svg>
	                              )}
	                            </div>
	                            <p className="relative z-10 text-center font-black text-gray-800 text-lg md:text-xl leading-tight line-clamp-4 drop-shadow-[0_1px_0_rgba(255,255,255,0.9)]">
	                              {card.content}
	                            </p>
	                          </div>
	                        </div>

	                        {/* Placeholder for matched cards to keep grid stability */}
	                        {card.isMatched && (
	                          <div className="w-full h-full rounded-2xl border-4 border-dashed border-gray-600 flex items-center justify-center opacity-30 bg-[#111]">
	                            <span className="text-4xl">🌟</span>
	                          </div>
	                        )}
	                      </div>
	                    ))}
	                  </div>
	                </div>
	              )}

	              {/* Tower Defense Game Layout */}
			              {selectedGame.gameType === 'tower-defense' && (
			                <TowerDefenseGame
			                  questions={selectedGame.questions || []}
			                  subject={selectedGame.subject as Subject}
			                  difficulty={(selectedGame.difficulty || 'medium') as any}
			                  durationSeconds={Number(selectedGame.timeLimitSeconds) || 60}
			                  livesLimit={selectedGame.livesLimit ?? null}
			                  onExit={() => setShowGameModal(false)}
			                  onStart={() => { setGameStartTime(new Date()); setGameTimerTick(0); }}
			                  onComplete={(result) => {
			                    setGameScore(result.score);
			                    handleGameComplete(result.success, {
		                      score: result.score,
	                      correctAnswers: result.correctAnswers,
	                      totalQuestions: result.totalQuestions,
	                      timeSpent: result.timeSpent
	                    });
	                  }}
	                />
	              )}

	              {/* Math Game Layout */}
	              {selectedGame.gameType === 'math' && (
	                <MathGame
	                  game={selectedGame}
	                  gameId={selectedGame.id}
	                  onExit={() => setShowGameModal(false)}
	                  onStart={() => { setGameStartTime(new Date()); setGameTimerTick(0); }}
	                  onComplete={(result) => {
	                    setGameScore(result.score);
	                    handleGameComplete(result.success, {
	                      score: result.score,
	                      correctAnswers: result.correctAnswers,
	                      totalQuestions: result.totalQuestions,
	                      timeSpent: result.timeSpent,
	                      ...(result.details ? { details: result.details } : null)
	                    });
	                  }}
	                />
	              )}

	              {/* Maze / Quiz Game Layout - New 3D Implementation */}
		              {selectedGame.gameType === 'maze' && (
		                <MazeGame
	                  questions={mazeQuestions}
	                  onExit={() => setShowGameModal(false)}
	                  onComplete={(finalScore) => {
	                    setGameScore(finalScore);
	                    handleGameComplete(true);
	                  }}
	                />
	              )}
            </div>

	            {/* Game Status Footer */}
	            {gameStatus !== 'playing' && (
	              <div className="absolute inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center p-8 z-50">
	                {gameStatus === 'completed' ? (
	                  <>
	                    <h1 className="text-6xl font-black text-[#A1D9AE] mb-4 animate-bounce">VICTORY!</h1>
	                    <p className="text-2xl text-white mb-8">恭喜完成所有挑戰！</p>
	                  </>
	                ) : (
	                  <>
	                    <h1 className="text-6xl font-black text-red-300 mb-4 animate-pulse">GAME OVER</h1>
	                    <p className="text-2xl text-white mb-2">基地被突破了！</p>
	                    <p className="text-lg text-gray-300 mb-8">努力再試一次吧。</p>
	                  </>
	                )}
	                <button
	                  onClick={() => setShowGameModal(false)}
	                  className="px-8 py-3 bg-[#A1D9AE] text-brand-brown font-bold text-xl rounded-full hover:bg-white transition-colors"
	                >
	                  返回任務列表
	                </button>
	              </div>
	            )}

          </div >
        </div >
      )}

      {/* Quiz Taking Modal */}
      {
        showQuizModal && selectedQuiz && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-comic">
              <div className="p-6 border-b-4 border-brand-brown bg-[#FDEEAD]">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-3xl font-black text-brand-brown">{selectedQuiz.title}</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedQuiz.description && `${selectedQuiz.description} • `}
                      {selectedQuiz.subject} • 共 {selectedQuiz.questions?.length || 0} 題
                      {selectedQuiz.timeLimit && selectedQuiz.timeLimit > 0 && ` • ${selectedQuiz.timeLimit} 分鐘限時`}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm('確定要退出測驗嗎？已選擇的答案將不會保存。')) {
                        setShowQuizModal(false);
                        setSelectedQuiz(null);
                        setQuizAnswers([]);
                        setQuizStartTime(null);
                      }
                    }}
                    className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center flex-shrink-0"
                  >
                    <X className="w-6 h-6 text-brand-brown" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* 複習模式提示 */}
                {viewingQuizResult && (
                  <div className="mb-6 bg-blue-100 border-l-4 border-blue-500 p-4 rounded-r-xl">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold text-blue-900 text-lg">測驗結果回顧</p>
                        <p className="text-blue-800">
                          得分: <span className="text-2xl font-black">{Math.round(viewingQuizResult.score)}%</span> •
                          正確: {viewingQuizResult.correctAnswers}/{viewingQuizResult.totalQuestions}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {/* 進度條 */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold text-brand-brown">
                      答題進度: {quizAnswers.filter(a => a !== -1).length} / {selectedQuiz.questions?.length || 0}
                    </span>
                    {quizStartTime && selectedQuiz.timeLimit && selectedQuiz.timeLimit > 0 && (
                      <span className="text-sm text-gray-600">
                        剩餘時間: {Math.max(0, selectedQuiz.timeLimit * 60 - Math.floor((Date.now() - quizStartTime.getTime()) / 1000))} 秒
                      </span>
                    )}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-[#FDEEAD] h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(quizAnswers.filter(a => a !== -1).length / (selectedQuiz.questions?.length || 1)) * 100}%` }}
                    />
                  </div>
                </div>

                {/* 問題列表 */}
                <div className="space-y-6">
                  {selectedQuiz.questions?.map((question: any, questionIndex: number) => (
                    <div key={questionIndex} className="bg-gray-50 border-4 border-gray-200 rounded-3xl p-6">
                      <div className="mb-4">
                        <h3 className="text-lg font-bold text-brand-brown mb-3">
                          問題 {questionIndex + 1}: <span className="whitespace-pre-wrap">{question.question}</span>
                        </h3>
                        {question.image && (
                          <div className="mb-4">
                            <img
                              src={question.image}
                              alt="Question"
                              className="max-h-64 rounded-xl border-4 border-white shadow-md mx-auto"
                            />
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {question.options?.map((option: string, optionIndex: number) => (
                          <button
                            key={optionIndex}
                            onClick={() => !viewingQuizResult && handleAnswerSelect(questionIndex, optionIndex)}
                            disabled={!!viewingQuizResult}
                            className={`p-4 rounded-xl border-2 text-left font-medium transition-all duration-200 ${viewingQuizResult
                              ? (() => {
                                const studentSelection = viewingQuizResult.answers[questionIndex];
                                const isCorrect = question.correctAnswer === optionIndex;
                                const isSelected = studentSelection === optionIndex;

                                if (isCorrect) return 'bg-green-100 border-green-500 text-green-900';
                                if (isSelected && !isCorrect) return 'bg-red-100 border-red-500 text-red-900';
                                return 'bg-white border-gray-200 opacity-60';
                              })()
                              : quizAnswers[questionIndex] === optionIndex
                                ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown shadow-comic'
                                : 'bg-white border-gray-300 text-gray-700 hover:border-brand-brown hover:bg-yellow-50'
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${viewingQuizResult
                                ? (() => {
                                  const studentSelection = viewingQuizResult.answers[questionIndex];
                                  const isCorrect = question.correctAnswer === optionIndex;
                                  const isSelected = studentSelection === optionIndex;

                                  if (isCorrect) return 'border-green-600 bg-green-600 text-white';
                                  if (isSelected) return 'border-red-500 bg-red-500 text-white';
                                  return 'border-gray-300 text-gray-400';
                                })()
                                : quizAnswers[questionIndex] === optionIndex
                                  ? 'border-brand-brown bg-brand-brown text-white'
                                  : 'border-gray-400'
                                }`}>
                                <span className="text-sm font-bold">
                                  {String.fromCharCode(65 + optionIndex)}
                                </span>
                              </div>
                              <span className="flex-1">{option}</span>
                              {viewingQuizResult && (
                                <>
                                  {question.correctAnswer === optionIndex && (
                                    <span className="text-xs font-bold bg-green-200 text-green-800 px-2 py-1 rounded-full">正確答案</span>
                                  )}
                                  {viewingQuizResult.answers[questionIndex] === optionIndex && viewingQuizResult.answers[questionIndex] !== question.correctAnswer && (
                                    <span className="text-xs font-bold bg-red-200 text-red-800 px-2 py-1 rounded-full">你的選擇</span>
                                  )}
                                </>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 提交按鈕 (只在非複習模式顯示) */}
                {!viewingQuizResult && (
                  <div className="flex justify-center mt-8 pt-6 border-t-4 border-gray-200">
                    <button
                      onClick={handleSubmitQuiz}
                      disabled={submittingQuiz || quizAnswers.includes(-1)}
                      className={`px-8 py-3 font-bold rounded-2xl border-4 text-lg transition-all duration-200 ${quizAnswers.includes(-1)
                        ? 'bg-gray-300 border-gray-400 text-gray-600 cursor-not-allowed'
                        : submittingQuiz
                          ? 'bg-yellow-400 border-yellow-600 text-yellow-800 cursor-wait'
                          : 'bg-[#FDEEAD] border-brand-brown text-brand-brown hover:bg-[#FCE690] shadow-comic active:translate-y-1 active:shadow-none'
                        }`}
                    >
                      {submittingQuiz ? '提交中...' : '提交測驗'}
                    </button>
                  </div>
                )}

                {/* 提示信息 */}
                {quizAnswers.includes(-1) && (
                  <div className="mt-4 p-4 bg-orange-100 border-2 border-orange-300 rounded-xl text-center">
                    <p className="text-orange-700 font-medium">
                      請回答所有問題後再提交測驗 (還有 {quizAnswers.filter(a => a === -1).length} 題未回答)
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* Contest Modal */}
      {showContestModal && selectedContest && (
        <QuizContestModal
          open={showContestModal}
          contest={selectedContest}
          onClose={() => {
            setShowContestModal(false);
            setSelectedContest(null);
          }}
          onFinished={() => {
            // 重新載入任務以更新比賽記錄
            loadDiscussions(false);
          }}
        />
      )}
    </div >
  );
};

export default StudentDashboard;
