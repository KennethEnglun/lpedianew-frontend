import React, { useState, useEffect } from 'react';
import { Settings, User, LogOut, MessageSquare, Plus, X, Image, Link, Code, Bold, Italic, Underline, Type, Palette, Upload, Trash, Filter, Eye, HelpCircle, Clock } from 'lucide-react';
import Button from '../components/Button';
import Select from '../components/Select';
import Input from '../components/Input';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { sanitizeHtml } from '../services/sanitizeHtml';
import { Subject, Discussion } from '../types';

const TeacherDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

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

  const [editorRef, setEditorRef] = useState<HTMLDivElement | null>(null);
  const [currentFontSize, setCurrentFontSize] = useState('16');
  const [currentTextColor, setCurrentTextColor] = useState('#000000');

  // 作業管理相關狀態
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [assignmentResponses, setAssignmentResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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

  // === 作業管理功能 ===

  // 載入作業列表（包含小測驗和遊戲）
  const loadAssignments = async () => {
    try {
      setLoading(true);

      // 並行載入作業、小測驗和遊戲
      const [assignmentData, quizData, gameData] = await Promise.all([
        authService.getTeacherAssignments(filterSubject || undefined, filterClass || undefined),
        authService.getTeacherQuizzes(filterSubject || undefined, filterClass || undefined),
        authService.getTeacherGames(filterSubject || undefined, filterClass || undefined)
      ]);

      // 合併作業、小測驗和遊戲，標記類型
      let allAssignments = [
        ...(assignmentData.assignments || []).map((item: any) => ({ ...item, type: 'assignment' })),
        ...(quizData.quizzes || []).map((item: any) => ({ ...item, type: 'quiz' })),
        ...(gameData.games || []).map((item: any) => ({ ...item, type: 'game' }))
      ];

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
    const itemType = assignment.type === 'quiz' ? '小測驗' : '作業';
    if (!confirm(`確定要刪除整個${itemType}及其所有回應嗎？此操作無法復原！`)) return;

    try {
      if (assignment.type === 'quiz') {
        await authService.deleteQuiz(assignment.id);
      } else {
        await authService.deleteAssignment(assignment.id);
      }

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
    await loadFilterOptions();
    await loadAssignments();
    // Fetch all students for completion tracking
    try {
      const usersData = await authService.getUsers({ role: 'student', limit: 1000 });
      setAllStudents(usersData.users || []);
    } catch (err) {
      console.error('Failed to load students list', err);
    }
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

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-hidden font-sans">
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

      {/* Header Icons */}
      <header className="fixed top-4 right-6 z-20 flex gap-4">
        <button className="w-12 h-12 bg-white rounded-full border-2 border-brand-brown shadow-comic flex items-center justify-center hover:scale-105 transition-transform">
          <Settings className="text-brand-brown w-6 h-6" />
        </button>
        <button
          onClick={() => navigate('/')}
          className="w-12 h-12 bg-white rounded-full border-2 border-brand-brown shadow-comic flex items-center justify-center hover:scale-105 transition-transform"
        >
          <User className="text-brand-brown w-6 h-6" />
        </button>
        <button
          onClick={logout}
          className="w-12 h-12 bg-white rounded-full border-2 border-brand-brown shadow-comic flex items-center justify-center hover:scale-105 transition-transform"
          title="登出"
        >
          <LogOut className="text-brand-brown w-6 h-6" />
        </button>
      </header>

      {/* Sidebar */}
      <aside className="relative z-10 w-80 bg-[#D9F3D5] min-h-fit my-auto ml-0 rounded-r-[3rem] border-y-4 border-r-4 border-brand-brown shadow-2xl flex flex-col p-6">
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
            className="bg-[#FDEEAD] hover:bg-[#FCE690] text-lg flex items-center justify-center gap-2"
            onClick={() => setShowQuizModal(true)}
          >
            <HelpCircle className="w-5 h-5" />
            派發小測驗
          </Button>
          <Button fullWidth className="bg-[#D2EFFF] hover:bg-[#BCE0FF] text-lg">派發自建 AI Bot</Button>
          <Button
            fullWidth
            className="bg-[#F8C5C5] hover:bg-[#F0B5B5] text-lg flex items-center justify-center gap-2"
            onClick={() => setShowDiscussionModal(true)}
          >
            <MessageSquare className="w-5 h-5" />
            派發討論串
          </Button>
          <Button fullWidth className="bg-[#C0E2BE] hover:bg-[#A9D8A7] text-lg" onClick={openAssignmentManagement}>
            作業管理
          </Button>
          <Button
            fullWidth
            className="bg-[#E8F5E9] hover:bg-[#C8E6C9] text-lg flex items-center justify-center gap-2"
            onClick={() => setShowGameModal(true)}
          >
            🎮 創建小遊戲
          </Button>
          <Button fullWidth className="bg-[#E0D2F8] hover:bg-[#D0BCF5] text-lg">學生進度</Button>
          <Button fullWidth className="bg-[#FAD5BE] hover:bg-[#F8C4A6] text-lg">更多功能</Button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative z-10 flex items-center justify-center p-8">

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
                    onClick={() => setShowGameModal(false)}
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
                  <button
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
	                  onClick={() => { setShowGameModal(false); setGameType(null); }}
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
	                <label className="block text-sm font-bold text-emerald-800 mb-2">題庫（答題賺金幣）</label>
	                <div className="space-y-4">
	                  {gameForm.questions.map((q, index) => (
	                    <div key={index} className="bg-white p-4 rounded-xl border-2 border-emerald-200">
	                      <div className="flex justify-between items-center mb-3">
	                        <span className="font-bold text-emerald-700">題目 {index + 1}</span>
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
	                            newQuestions[index].wrongOptions = e.target.value.split(',');
	                            setGameForm(prev => ({ ...prev, questions: newQuestions }));
	                          }}
	                        />
	                      </div>
	                    </div>
	                  ))}
	                  <button
	                    onClick={() => setGameForm(prev => ({
	                      ...prev,
	                      questions: [...prev.questions, { question: '', answer: '', wrongOptions: [] }]
	                    }))}
	                    className="w-full py-3 border-4 border-dashed border-emerald-300 rounded-2xl text-emerald-700 font-bold hover:bg-emerald-50"
	                  >
	                    + 新增題目
	                  </button>
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
	                      const cleanedQuestions = gameForm.questions
	                        .map(q => ({
	                          question: q.question.trim(),
	                          answer: q.answer.trim(),
	                          wrongOptions: (q.wrongOptions || []).map(o => o.trim()).filter(Boolean)
	                        }))
	                        .filter(q => q.question && q.answer);
	                      if (cleanedQuestions.length === 0) {
	                        alert('請至少新增一個完整題目');
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
	                        difficulty: gameForm.difficulty
	                      });

	                      alert('答題塔防遊戲創建成功！');
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
	                  className="flex-1 py-3 rounded-2xl border-4 border-emerald-600 bg-emerald-600 text-white font-bold hover:bg-emerald-700"
	                >
	                  創建遊戲
	                </button>
	              </div>
	            </div>
	          </div>
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
                  <button
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
                          {isSelectMode && selectedAssignments.length > 0 && (
                            <button
                              onClick={async () => {
                                if (confirm(`確定要刪除選取的 ${selectedAssignments.length} 個項目嗎？`)) {
                                  try {
                                    for (const id of selectedAssignments) {
                                      const item = assignments.find(a => a.id === id);
                                      if (item?.type === 'quiz') {
                                        await authService.deleteQuiz(id);
                                      } else {
                                        await authService.deleteAssignment(id);
                                      }
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
                      ) : assignments.length > 0 ? (
                        assignments.map(assignment => {
                          const isQuiz = assignment.type === 'quiz';
                          const isGame = assignment.type === 'game';
                          const isSelected = selectedAssignments.includes(assignment.id);
                          return (
                            <div key={assignment.id} className={`bg-white border-4 rounded-3xl p-6 shadow-comic ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-brand-brown'}`}>
                              <div className="flex justify-between items-start">
                                <div className="flex-1 flex items-start gap-3">
                                  {isSelectMode && (
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedAssignments(prev => [...prev, assignment.id]);
                                        } else {
                                          setSelectedAssignments(prev => prev.filter(id => id !== assignment.id));
                                        }
                                      }}
                                      className="w-6 h-6 mt-1 rounded border-2 border-gray-400 text-blue-600 focus:ring-blue-500"
                                    />
                                  )}
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      {isGame ? (
                                        <span className="text-2xl">🎮</span>
                                      ) : isQuiz ? (
                                        <HelpCircle className="w-5 h-5 text-yellow-600" />
                                      ) : (
                                        <MessageSquare className="w-5 h-5 text-purple-600" />
                                      )}
                                      <h4 className="text-xl font-bold text-brand-brown">{assignment.title}</h4>
                                    </div>
                                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                                      <span className={`px-2 py-1 rounded-lg ${isGame ? 'bg-green-100' : isQuiz ? 'bg-yellow-100' : 'bg-purple-100'}`}>
                                        {isGame ? '🎮' : isQuiz ? '🧠' : '📚'} {assignment.subject}
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
                                      <span className={`px-2 py-1 rounded-lg ${isGame ? 'bg-blue-100' : isQuiz ? 'bg-orange-100' : 'bg-yellow-100'}`}>
                                        {isGame ? '🏆' : isQuiz ? '📊' : '💬'} {isGame ? (assignment.totalAttempts || 0) : isQuiz ? (assignment.totalSubmissions || 0) : (assignment.responseCount || 0)} 個{isGame ? '遊玩記錄' : isQuiz ? '提交' : '回應'}
                                      </span>
                                      <span className="bg-purple-100 px-2 py-1 rounded-lg">
                                        👥 {assignment.uniqueStudents || 0} 位學生
                                      </span>
                                      {(isQuiz || isGame) && assignment.averageScore !== undefined && (
                                        <span className="bg-blue-100 px-2 py-1 rounded-lg">
                                          📈 平均分數: {Math.round(assignment.averageScore)}%
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                      <span className={`px-2 py-1 rounded text-xs font-bold ${isQuiz ? 'bg-yellow-200 text-yellow-800' : 'bg-purple-200 text-purple-800'
                                        }`}>
                                        {isQuiz ? '小測驗' : '討論串'}
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
                                      {isQuiz ? '查看結果' : '查看回應'}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteAssignment(assignment)}
                                      className="flex items-center gap-1 px-4 py-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 font-bold"
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
                          {selectedAssignment?.type === 'quiz' ? '小測驗資訊' : '教師原始內容'}
                        </h4>
                        {selectedAssignment?.type !== 'quiz' && (
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
                                        {/* For games, check if attempts data is available, otherwise show standard stats */}
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
                              <button
                                onClick={() => handleDeleteResponse(response.id)}
                                className="ml-4 p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                                title={selectedAssignment?.type === 'quiz' ? '刪除此測驗結果' : '刪除此回應'}
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-gray-400 font-bold border-4 border-dashed border-gray-300 rounded-2xl">
                          {selectedAssignment?.type === 'quiz' ? '目前沒有測驗結果 📊' : '目前沒有學生回應 💭'}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div >
        )
      }

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
                    <Button
                      onClick={addQuestion}
                      className="bg-green-100 text-green-700 hover:bg-green-200 border-green-300 flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      新增問題
                    </Button>
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
