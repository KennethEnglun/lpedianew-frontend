import React, { useState, useEffect } from 'react';
import { Settings, LogOut, MessageSquare, HelpCircle, Bot, RefreshCw, X } from 'lucide-react';
import { Subject, SUBJECT_CONFIG, Task } from '../types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';

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

  // 小测验相关状态
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizStartTime, setQuizStartTime] = useState<Date | null>(null);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [viewingQuizResult, setViewingQuizResult] = useState<any>(null); // State for reviewing quiz result

  // 遊戲相關狀態
  const [showGameModal, setShowGameModal] = useState(false);
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [gameStatus, setGameStatus] = useState<'playing' | 'completed'>('playing');
  const [gameScore, setGameScore] = useState(0);
  const [gameStartTime, setGameStartTime] = useState<Date | null>(null);
  const [gameCurrentQuestionIndex, setGameCurrentQuestionIndex] = useState(0);
  const [gameMatchingCards, setGameMatchingCards] = useState<any[]>([]);
  const [gameSelectedCards, setGameSelectedCards] = useState<number[]>([]);
  const [gameMatchedPairs, setGameMatchedPairs] = useState<string[]>([]);
  const [submittingGame, setSubmittingGame] = useState(false);

  const navigate = useNavigate();
  const { logout, user } = useAuth();

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

      const result = await authService.submitStudentResponse(selectedDiscussion.id, responseContent);

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
  const loadDiscussions = async (isManualRefresh = false) => {
    if (!user || user.role !== 'student') return;

    try {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // 並行載入討論串、小測驗和遊戲
      const [discussionResponse, quizResponse, gameResponse] = await Promise.all([
        authService.getStudentDiscussions(),
        authService.getStudentQuizzes(),
        authService.getStudentGames()
      ]);

      setDiscussions(discussionResponse.discussions || []);

      // 轉換討論串為任務格式
      const discussionTasks: Task[] = discussionResponse.discussions.map((discussion: Discussion) => ({
        id: discussion.id,
        title: discussion.title,
        type: 'discussion' as const,
        subject: discussion.subject,
        teacherName: discussion.teacherName,
        teacherAvatar: '/teacher_login.png'
      }));

      // 轉換小測驗為任務格式
      const quizTasks: Task[] = (quizResponse.quizzes || []).map((quiz: any) => ({
        id: quiz.id,
        title: quiz.title,
        type: 'quiz' as const,
        subject: quiz.subject,
        teacherName: quiz.teacherName || '系統',
        teacherAvatar: '/teacher_login.png',
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
        completed: game.completed || false,
        score: game.bestScore || null
      }));

      // 合併所有任務
      const allTasks = [...discussionTasks, ...quizTasks, ...gameTasks];
      setTasks(allTasks);
      setLastRefresh(new Date());

      // 檢查每個討論串的回應狀態
      discussionResponse.discussions.forEach((discussion: Discussion) => {
        checkResponseStatus(discussion.id);
      });

    } catch (error) {
      console.error('載入任務失敗:', error);
      setTasks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
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
        [discussionId]: result.responses
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

  // 處理遊戲點擊
  const handleGameClick = async (gameId: string) => {
    try {
      setLoading(true);
      const response = await authService.getGameForStudent(gameId);
      const game = response.game;

      setSelectedGame(game);
      setGameScore(0);
      setGameStartTime(new Date());
      setGameStatus('playing');
      setGameCurrentQuestionIndex(0);

      // 初始化遊戲狀態
      if (game.gameType === 'matching') {
        // 準備配對卡片
        const cards: any[] = [];
        game.questions.forEach((q: any, index: number) => {
          // 問題卡
          cards.push({
            id: `q-${index}`,
            content: q.question,
            type: 'question',
            pairId: index,
            isFlipped: false,
            isMatched: false
          });
          // 答案卡
          cards.push({
            id: `a-${index}`,
            content: q.answer,
            type: 'answer',
            pairId: index,
            isFlipped: false,
            isMatched: false
          });
        });
        // 洗牌
        setGameMatchingCards(cards.sort(() => Math.random() - 0.5));
        setGameSelectedCards([]);
        setGameMatchedPairs([]);
      }

      setShowGameModal(true);
    } catch (error: any) {
      console.error('載入遊戲失敗:', error);
      alert(error.message || '載入遊戲失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 處理配對遊戲卡片點擊
  const handleCardClick = (index: number) => {
    if (gameSelectedCards.length >= 2 || gameMatchingCards[index].isMatched || gameMatchingCards[index].isFlipped) {
      return;
    }

    const newCards = [...gameMatchingCards];
    newCards[index].isFlipped = true;
    setGameMatchingCards(newCards);

    const newSelected = [...gameSelectedCards, index];
    setGameSelectedCards(newSelected);

    if (newSelected.length === 2) {
      const card1 = newCards[newSelected[0]];
      const card2 = newCards[newSelected[1]];

      if (card1.pairId === card2.pairId && card1.type !== card2.type) {
        // 配對成功
        setTimeout(() => {
          const matchedCards = [...newCards];
          matchedCards[newSelected[0]].isMatched = true;
          matchedCards[newSelected[1]].isMatched = true;
          setGameMatchingCards(matchedCards);
          setGameSelectedCards([]);
          setGameMatchedPairs(prev => [...prev, String(card1.pairId)]);

          // 檢查是否所有都配對完成
          if (matchedCards.every(c => c.isMatched)) {
            handleGameComplete(true);
          }
        }, 1000);
      } else {
        // 配對失敗
        setTimeout(() => {
          const resetCards = [...newCards];
          resetCards[newSelected[0]].isFlipped = false;
          resetCards[newSelected[1]].isFlipped = false;
          setGameMatchingCards(resetCards);
          setGameSelectedCards([]);
        }, 1500);
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
  const handleGameComplete = async (success: boolean) => {
    setGameStatus('completed');

    if (success) {
      try {
        setSubmittingGame(true);
        const timeSpent = gameStartTime ? Math.round((Date.now() - gameStartTime.getTime()) / 1000) : 0;
        const totalQuestions = selectedGame.questions.length;

        // 計算分數 (簡單邏輯：根據完成)
        const score = 100;

        await authService.submitGameScore(selectedGame.id, {
          score,
          correctAnswers: totalQuestions,
          totalQuestions,
          timeSpent
        });

        alert(`恭喜！遊戲通關！\n耗時：${timeSpent}秒`);

        // 延遲關閉
        setTimeout(() => {
          setShowGameModal(false);
          loadDiscussions(); // 刷新列表
        }, 2000);

      } catch (error) {
        console.error('提交成績失敗:', error);
      } finally {
        setSubmittingGame(false);
      }
    }
  };

  // 渲染討論串內容
  const renderDiscussionContent = (content: { type: string; value: string }[]) => {
    return content.map((block, index) => (
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
            dangerouslySetInnerHTML={{ __html: block.value }}
          />
        )}
      </div>
    ));
  };

  // 初始載入
  useEffect(() => {
    loadDiscussions();
  }, [user]);

  // 設置自動刷新，每5秒檢查一次新的討論串
  useEffect(() => {
    if (!user || user.role !== 'student') return;

    const interval = setInterval(() => {
      loadDiscussions();
    }, 60000); // 1分鐘刷新一次

    return () => clearInterval(interval);
  }, [user]);

  const filteredTasks = tasks.filter(task => task.subject === selectedSubject);
  const subjectConfig = SUBJECT_CONFIG[selectedSubject];

  return (
    <div className="min-h-screen font-sans flex flex-col relative overflow-hidden" style={{ backgroundColor: '#D9F3D5' }}>
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
          <h1 className="text-4xl font-black text-brand-brown font-rounded tracking-wider">Lpedia</h1>
        </div>
        <div className="flex gap-3">
          <button className="w-10 h-10 bg-brand-cream rounded-full border-2 border-brand-brown flex items-center justify-center hover:bg-white">
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

          <div className="text-center mb-4 border-b-4 border-brand-brown pb-2">
            <h3 className="text-xl font-bold text-brand-brown">我的學科</h3>
          </div>

          <nav className="flex-1 space-y-3 overflow-y-auto">
            {Object.values(Subject).map((subject) => {
              const config = SUBJECT_CONFIG[subject];
              const isSelected = selectedSubject === subject;
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
                  <span className="text-lg font-bold text-brand-brown">{subject}</span>
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
            ) : filteredTasks.length > 0 ? (
              filteredTasks.map(task => {
                const getTaskIcon = () => {
                  switch (task.type) {
                    case 'quiz': return <HelpCircle className="w-5 h-5 text-blue-600" />;
                    case 'ai-bot': return <Bot className="w-5 h-5 text-green-600" />;
                    case 'discussion': return <MessageSquare className="w-5 h-5 text-purple-600" />;
                    case 'game': return <span className="text-xl">🎮</span>;
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
                  switch (task.type) {
                    case 'ai-bot': return '開始對話';
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
                    case 'ai-bot': return 'bg-[#B5D8F8] hover:bg-[#A1CCF0]';
                    default: return 'bg-[#93C47D] hover:bg-[#86b572]';
                  }
                };

                return (
                  <div key={task.id} className="bg-white border-4 border-brand-brown rounded-3xl p-4 flex items-center shadow-comic hover:-translate-y-1 transition-transform cursor-pointer">
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
                      onClick={() => {
                        if (task.type === 'discussion') {
                          handleDiscussionClick(task.id);
                        } else if (task.type === 'quiz') {
                          handleQuizClick(task.id);
                        } else if (task.type === 'game') {
                          handleGameClick(task.id);
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
                {allResponses[selectedDiscussion.id] && allResponses[selectedDiscussion.id].length > 0 ? (
                  <div className="space-y-4 mb-6">
                    {allResponses[selectedDiscussion.id].map((response: any, index: number) => {
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
                            dangerouslySetInnerHTML={{ __html: response.content || '載入中...' }}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-gray-500 text-center py-8 mb-6">
                    還沒有任何回應，成為第一個回應的學生吧！
                  </div>
                )}

                {/* 編輯器 - 無論是否已回應都顯示 */}
                <div className="space-y-4">
                  <h4 className="text-lg font-bold text-brand-brown">
                    {allResponses[selectedDiscussion.id]?.some(r => r.studentId === user?.id)
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
                  {selectedGame.gameType === 'matching' ? '記憶配對' : '知識迷宮'} • {selectedGame.subject}
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                  {gameMatchingCards.map((card, index) => (
                    <button
                      key={card.id}
                      onClick={() => handleCardClick(index)}
                      className={`aspect-[3/4] rounded-xl text-xl font-bold flex items-center justify-center p-4 transition-all duration-500 transform ${card.isFlipped || card.isMatched
                          ? 'bg-white rotate-y-180'
                          : 'bg-[#A1D9AE] border-4 border-brand-brown'
                        } ${card.isMatched ? 'opacity-50' : 'hover:scale-105 shadow-xl'}`}
                      disabled={card.isMatched}
                    >
                      {(card.isFlipped || card.isMatched) ? (
                        <div className="text-brand-brown text-center text-sm md:text-base">
                          {card.content}
                          <div className="text-[10px] text-gray-400 mt-2 uppercase">{card.type === 'question' ? '題目' : '答案'}</div>
                        </div>
                      ) : (
                        <div className="text-4xl text-brand-brown opacity-50">?</div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Maze / Quiz Game Layout */}
              {selectedGame.gameType === 'maze' && (
                <div className="max-w-2xl mx-auto text-center mt-10">
                  <div className="mb-8">
                    <div className="w-full bg-[#333] rounded-full h-4 mb-2">
                      <div className="bg-green-500 h-4 rounded-full transition-all" style={{ width: `${((gameCurrentQuestionIndex) / selectedGame.questions.length) * 100}%` }}></div>
                    </div>
                    <p className="text-gray-400">關卡 {gameCurrentQuestionIndex + 1} / {selectedGame.questions.length}</p>
                  </div>

                  <div className="bg-[#333] p-8 rounded-3xl border-2 border-[#555] shadow-2xl">
                    <h3 className="text-2xl text-white font-bold mb-8 leading-relaxed">
                      {selectedGame.questions[gameCurrentQuestionIndex]?.question}
                    </h3>

                    <div className="grid grid-cols-1 gap-4">
                      {[
                        selectedGame.questions[gameCurrentQuestionIndex]?.answer,
                        ...(selectedGame.questions[gameCurrentQuestionIndex]?.wrongOptions || [])
                      ].sort(() => Math.random() - 0.5).map((option, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleGameOptionSelect(option === selectedGame.questions[gameCurrentQuestionIndex].answer)}
                          className="p-4 bg-[#444] hover:bg-[#555] text-white rounded-xl border-2 border-[#666] transition-all hover:scale-[1.02] text-lg font-medium"
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Game Status Footer */}
            {gameStatus === 'completed' && (
              <div className="absolute inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center p-8 z-50">
                <h1 className="text-6xl font-black text-[#A1D9AE] mb-4 animate-bounce">VICTORY!</h1>
                <p className="text-2xl text-white mb-8">恭喜完成所有挑戰！</p>
                <button
                  onClick={() => setShowGameModal(false)}
                  className="px-8 py-3 bg-[#A1D9AE] text-brand-brown font-bold text-xl rounded-full hover:bg-white transition-colors"
                >
                  返回任務列表
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Quiz Taking Modal */}
      {showQuizModal && selectedQuiz && (
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
                        問題 {questionIndex + 1}: {question.question}
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
      )}
    </div>
  );
};

export default StudentDashboard;