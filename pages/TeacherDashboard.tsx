import React, { useState, useEffect } from 'react';
import { Settings, User, LogOut, MessageSquare, Plus, X, Image, Link, Code, Bold, Italic, Underline, Type, Palette, Upload, Trash, Filter, Eye, HelpCircle, Clock } from 'lucide-react';
import Button from '../components/Button';
import Select from '../components/Select';
import Input from '../components/Input';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
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

  // 載入作業列表（包含小測驗）
  const loadAssignments = async () => {
    try {
      setLoading(true);

      // 並行載入作業和小測驗
      const [assignmentData, quizData] = await Promise.all([
        authService.getTeacherAssignments(filterSubject || undefined, filterClass || undefined),
        authService.getTeacherQuizzes(filterSubject || undefined, filterClass || undefined)
      ]);

      // 合併作業和小測驗，標記類型
      const allAssignments = [
        ...(assignmentData.assignments || []).map((item: any) => ({ ...item, type: 'assignment' })),
        ...(quizData.quizzes || []).map((item: any) => ({ ...item, type: 'quiz' }))
      ];

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

  // 載入班級和分組選項（用於創建討論串/測驗）
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

      if (assignment.type === 'quiz') {
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
  };

  // 監聽篩選條件變化
  useEffect(() => {
    if (showAssignmentModal) {
      loadAssignments();
    }
  }, [filterSubject, filterClass, showAssignmentModal]);

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
    if (!quizForm.title || quizForm.targetClasses.length === 0 || quizForm.questions.length === 0) {
      alert('請填寫標題、選擇班級並至少新增一個問題');
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
    if (!discussionForm.title || discussionForm.targetClasses.length === 0) {
      alert('請填寫標題並選擇班級');
      return;
    }

    if (!discussionForm.content.trim()) {
      alert('請輸入討論串內容');
      return;
    }

    // 將HTML內容轉換為內容區塊格式
    const contentBlocks = [{ type: 'html', value: discussionForm.content }];

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
      <aside className="relative z-10 w-80 bg-[#D9F3D5] h-[95vh] my-auto ml-0 rounded-r-[3rem] border-y-4 border-r-4 border-brand-brown shadow-2xl flex flex-col p-6">
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
          <Button
            fullWidth
            className="bg-[#C0E2BE] hover:bg-[#A9D8A7] text-lg"
            onClick={openAssignmentManagement}
          >
            作業管理
          </Button>
          <Button fullWidth className="bg-[#E0D2F8] hover:bg-[#D0BCF5] text-lg">學生進度</Button>
          <Button fullWidth className="bg-[#FAD5BE] hover:bg-[#F8C4A6] text-lg">更多功能</Button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative z-10 flex items-center justify-center p-8">
        
        {/* Dispatch Center Modal */}
        <div className="bg-[#FEF7EC] w-full max-w-2xl rounded-[2rem] border-4 border-brand-brown shadow-comic-xl p-8 relative">
          <h2 className="text-4xl font-black text-center text-brand-brown mb-8 font-rounded">派發中心</h2>
          
          <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); alert('派發成功！'); }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Select 
                label="選擇題目" 
                options={['中文', '英文', '數學', '科學', '人文', 'STEAM', '普通話', '視藝', '音樂', '圖書', '體育']}
              />
              <Select 
                label="選擇工具" 
                options={['Quiz', 'AI Bot', 'Flashcards', 'Reading']}
              />
            </div>
            
            <div>
               <Input label="設定期間" type="month" defaultValue="2024-06" />
            </div>

            <div className="pt-4">
              <Button 
                type="submit" 
                fullWidth 
                className="bg-[#C7A27C] text-white hover:bg-[#B58F66] border-brand-brown text-2xl py-4"
              >
                派發
              </Button>
            </div>
          </form>
        </div>

      </main>

      {/* Discussion Creation Modal */}
      {showDiscussionModal && (
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
                      className={`px-4 py-2 rounded-2xl border-2 font-bold transition-colors ${
                        discussionForm.targetClasses.includes(className)
                          ? 'bg-[#F8C5C5] border-brand-brown text-brand-brown'
                          : 'bg-white border-gray-300 text-gray-600 hover:border-brand-brown'
                      }`}
                    >
                      {className}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Groups (only show if groups are available) */}
              {availableGroups.length > 0 && (
                <div>
                  <label className="block text-sm font-bold text-brand-brown mb-2">
                    選擇分組 ({discussionForm.subject} - 可選)
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
                        className={`px-4 py-2 rounded-2xl border-2 font-bold transition-colors ${
                          discussionForm.targetGroups.includes(groupName)
                            ? 'bg-[#E8F4FD] border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-600 hover:border-blue-500'
                        }`}
                      >
                        {groupName}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    不選擇分組則派發給所選班級的所有學生
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
      )}

      {/* Assignment Management Modal */}
      {showAssignmentModal && (
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
                    <div className="flex items-center gap-2 mb-4">
                      <Filter className="w-5 h-5 text-gray-600" />
                      <h3 className="font-bold text-gray-700">篩選條件</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-600 mb-2">科目</label>
                        <select
                          value={filterSubject}
                          onChange={(e) => {
                            setFilterSubject(e.target.value);
                            loadAssignments();
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
                            loadAssignments();
                          }}
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl"
                        >
                          <option value="">全部班級</option>
                          {availableClasses.map(className => (
                            <option key={className} value={className}>{className}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={() => {
                            setFilterSubject('');
                            setFilterClass('');
                            loadAssignments();
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
                        return (
                          <div key={assignment.id} className="bg-white border-4 border-brand-brown rounded-3xl p-6 shadow-comic">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  {isQuiz ? (
                                    <HelpCircle className="w-5 h-5 text-yellow-600" />
                                  ) : (
                                    <MessageSquare className="w-5 h-5 text-purple-600" />
                                  )}
                                  <h4 className="text-xl font-bold text-brand-brown">{assignment.title}</h4>
                                </div>
                                <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                                  <span className={`px-2 py-1 rounded-lg ${isQuiz ? 'bg-yellow-100' : 'bg-purple-100'}`}>
                                    {isQuiz ? '🧠' : '📚'} {assignment.subject}
                                  </span>
                                  <span className="bg-green-100 px-2 py-1 rounded-lg">
                                    🏫 {filterClass ? filterClass : assignment.targetClasses?.join(', ') || '無指定班級'}
                                  </span>
                                  <span className={`px-2 py-1 rounded-lg ${isQuiz ? 'bg-orange-100' : 'bg-yellow-100'}`}>
                                    {isQuiz ? '📊' : '💬'} {isQuiz ? (assignment.totalSubmissions || 0) : (assignment.responseCount || 0)} 個{isQuiz ? '提交' : '回應'}
                                  </span>
                                  <span className="bg-purple-100 px-2 py-1 rounded-lg">
                                    👥 {assignment.uniqueStudents || 0} 位學生
                                  </span>
                                  {isQuiz && assignment.averageScore !== undefined && (
                                    <span className="bg-blue-100 px-2 py-1 rounded-lg">
                                      📈 平均分數: {Math.round(assignment.averageScore)}%
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                                    isQuiz ? 'bg-yellow-200 text-yellow-800' : 'bg-purple-200 text-purple-800'
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
                        🏫 {selectedAssignment.targetClasses?.join(', ') || '無指定班級'}
                      </span>
                    </div>
                  </div>

                  {/* 教師原始內容 */}
                  <div className={`border-4 rounded-3xl p-6 mb-6 ${
                    selectedAssignment?.type === 'quiz' ? 'bg-yellow-50 border-yellow-200' : 'bg-yellow-50 border-yellow-200'
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
                            <span className="font-bold text-brand-brown">目標班級：</span>
                            <span>{selectedAssignment.targetClasses?.join(', ') || '無指定'}</span>
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
                            dangerouslySetInnerHTML={{ __html: editedContent }}
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
                          <div dangerouslySetInnerHTML={{ __html: getDisplayContent(selectedAssignment.content) }} />
                        </div>
                      )
                    )}
                  </div>

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
                        <div key={response.id} className={`border-2 rounded-2xl p-4 ${
                          selectedAssignment?.type === 'quiz' ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-300'
                        }`}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                  selectedAssignment?.type === 'quiz' ? 'bg-yellow-500' : 'bg-brand-green-light'
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
                                    <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                                      response.score >= 80 ? 'bg-green-100 text-green-700' :
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

                              {selectedAssignment?.type === 'quiz' ? (
                                <div className="bg-white p-3 rounded-xl border border-gray-200">
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <span className="font-medium text-gray-600">得分:</span>
                                      <span className="ml-2 font-bold">{Math.round(response.score)}%</span>
                                    </div>
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
                                      <span className="ml-2">{new Date(response.submittedAt).toLocaleString()}</span>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-white p-3 rounded-xl border border-gray-200">
                                  <div dangerouslySetInnerHTML={{ __html: response.content || response.message || '無內容' }} />
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
        </div>
      )}

      {/* Quiz Creation Modal */}
      {showQuizModal && (
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
                      className={`px-4 py-2 rounded-2xl border-2 font-bold transition-colors ${
                        quizForm.targetClasses.includes(className)
                          ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown'
                          : 'bg-white border-gray-300 text-gray-600 hover:border-brand-brown'
                      }`}
                    >
                      {className}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Groups (only show if groups are available) */}
              {availableGroups.length > 0 && (
                <div>
                  <label className="block text-sm font-bold text-brand-brown mb-2">
                    選擇分組 ({quizForm.subject} - 可選)
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
                        className={`px-4 py-2 rounded-2xl border-2 font-bold transition-colors ${
                          quizForm.targetGroups.includes(groupName)
                            ? 'bg-[#FFF4E6] border-orange-500 text-orange-600'
                            : 'bg-white border-gray-300 text-gray-600 hover:border-orange-500'
                        }`}
                      >
                        {groupName}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    不選擇分組則派發給所選班級的所有學生
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
                  className="flex-1 bg-[#FDEEAD] text-brand-brown hover:bg-[#FCE690] border-brand-brown"
                  onClick={handleSubmitQuiz}
                >
                  創建小測驗
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;