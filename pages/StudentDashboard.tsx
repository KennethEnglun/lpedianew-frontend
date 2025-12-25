import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Settings, LogOut, MessageSquare, HelpCircle, Bot, RefreshCw, X, Eye, EyeOff, Code2, Volume2, CheckCircle2, Star, Award, ClipboardList } from 'lucide-react';
import { Subject, SUBJECT_CONFIG, Task } from '../types';
import { DEFAULT_SUBJECT, SINGLE_SUBJECT_MODE, VISIBLE_SUBJECTS } from '../platform';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import UiSettingsModal from '../components/UiSettingsModal';
import AiChatModal from '../components/AiChatModal';
import BotTaskChatModal from '../components/BotTaskChatModal';
import AppStudioModal from '../components/AppStudioModal';

const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showUiSettings, setShowUiSettings] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  const [showBotTaskChat, setShowBotTaskChat] = useState(false);
  const [showAppStudio, setShowAppStudio] = useState(false);
  const [selectedBotTaskId, setSelectedBotTaskId] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject>(DEFAULT_SUBJECT);
  const [showTaskView, setShowTaskView] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [selectedSubfolderId, setSelectedSubfolderId] = useState<string>('');
  const [classFolders, setClassFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [responseStatus, setResponseStatus] = useState<any>({});

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

  // Calculate task completion status
  const isTaskCompleted = (task: Task) => {
    if (task.type === 'discussion') return !!responseStatus[task.id]?.hasResponded;
    if (task.type === 'quiz' || task.type === 'game') return !!task.completed;
    if (task.type === 'contest') return false;
    return false;
  };

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(isTaskCompleted).length;
    return { total, completed, pending: Math.max(0, total - completed) };
  }, [tasks, responseStatus]);

  // Fetch all data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load discussion status for progress calculation
        const statusResponse = await authService.getDiscussionResponseStatus().catch(() => ({}));
        setResponseStatus(statusResponse);
        // TODO: Fix getStudentTasks method in authService
        setTasks([]); // Temporary: set empty array until method is fixed
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    loadData();
  }, []);

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
        <aside className="lg:col-span-4 cartoon-card p-6 flex-shrink-0 flex flex-col min-h-fit">
          {/* Logo Section */}
          <div className="text-center mb-6">
            <img
              src="/lpsparklogo.png"
              alt="LP科樂園 Logo"
              className="h-32 mx-auto object-contain drop-shadow-sm hover:scale-105 transition-transform duration-300"
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

          <div className="text-center mb-4 border-b-4 border-[#E6D2B5] pb-2">
            <h3 className="text-xl font-bold text-[#5E4C40]">我的學科</h3>
          </div>

          <nav className="flex-1 space-y-3 overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowAiChat(true)}
              className="w-[calc(100%-10px)] flex items-center gap-3 px-4 py-2 rounded-2xl border-4 transition-all duration-150 border-[#E6D2B5] bg-[#D2EFFF] hover:bg-white hover:-translate-y-1 shadow-sm"
              title="AI對話"
            >
              <Bot className="w-6 h-6 text-[#5E4C40]" />
              <span className="text-lg font-bold text-[#5E4C40] flex-1 text-left">AI對話</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAppStudio(true)}
              className="w-[calc(100%-10px)] flex items-center gap-3 px-4 py-2 rounded-2xl border-4 transition-all duration-150 border-[#E6D2B5] bg-[#E8F5E9] hover:bg-white hover:-translate-y-1 shadow-sm"
              title="小程式工作坊"
            >
              <Code2 className="w-6 h-6 text-[#5E4C40]" />
              <span className="text-lg font-bold text-[#5E4C40] flex-1 text-left">小程式工作坊</span>
            </button>

            <button
              onClick={() => setShowTaskView(true)}
              className="w-[calc(100%-10px)] flex items-center gap-3 px-4 py-2 rounded-2xl border-4 transition-all duration-150 border-[#E6D2B5] bg-[#B5F8CE] hover:bg-white hover:-translate-y-1 shadow-sm"
            >
              <ClipboardList className="w-6 h-6 text-[#5E4C40]" />
              <span className="text-lg font-bold text-[#5E4C40] flex-1 text-left">我的任務</span>
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
                            <div className="text-xl font-bold text-[#5D4037]">📁 {folder.name}</div>
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
                            <div className="text-xl font-bold text-[#5D4037]">📂 {folder.name}</div>
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
                        onClick={() => setSelectedTopicId('')}
                        className="text-[#5D4037] hover:text-blue-600 text-sm font-bold"
                      >
                        ← 返回課題選擇
                      </button>
                    </div>
                    <div className="text-lg font-bold text-[#5D4037] mb-4">
                      {topicFolders.find(f => f.id === selectedTopicId)?.name}
                    </div>
                    {subFolders.length > 0 ? (
                      /* Sub Folders */
                      <div>
                        <div className="text-md font-bold text-[#5D4037] mb-3">子資料夾</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                          {subFolders.map((folder: any) => (
                            <div
                              key={folder.id}
                              onClick={() => setSelectedSubfolderId(folder.id)}
                              className="bg-white border-4 border-[#5D4037] rounded-2xl p-4 shadow-sm cursor-pointer hover:shadow-lg transition-shadow"
                            >
                              <div className="text-lg font-bold text-[#5D4037]">📁 {folder.name}</div>
                              <div className="mt-2 text-sm text-gray-600">點擊查看任務</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        此課題暫無子資料夾或任務
                      </div>
                    )}
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
    </div>
  );
};

export default StudentDashboard;