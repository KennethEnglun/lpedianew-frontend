import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Settings, LogOut, MessageSquare, HelpCircle, Bot, RefreshCw, X, Eye, EyeOff, Code2, Search, Volume2, CheckCircle2, Star, Award } from 'lucide-react';
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

  // Sample progress data
  const overallProgress = { total: 15, completed: 8, pending: 7 };
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

    .text-outline-thick {
      color: white;
      text-shadow:
        4px 4px 0 #8D6E63,
        -2px -2px 0 #8D6E63,
        2px -2px 0 #8D6E63,
        -2px 2px 0 #8D6E63,
        2px 2px 0 #8D6E63;
    }

    .rainbow-gradient {
      background: linear-gradient(135deg,
        #ff9a9e 0%,
        #fecfef 20%,
        #fecfef 40%,
        #a8edea 60%,
        #fed6e3 80%,
        #ff9a9e 100%);
      background-size: 400% 400%;
      animation: rainbow 3s ease infinite;
    }

    @keyframes rainbow {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    @keyframes bounce {
      0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-10px); }
      60% { transform: translateY(-5px); }
    }
  `;

  return (
    <div className="min-h-screen p-4 md:p-6 font-sans" style={{ backgroundColor: '#FDF6E3', color: '#5D4037' }}>
      <style>{style}</style>

      {/* Header */}
      <header className="max-w-[1200px] mx-auto flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        {/* Left: Logo */}
        <div className="flex-shrink-0">
          <img
            src="/lpsparklogo.png"
            alt="LP科樂園 Logo"
            className="h-20 object-contain drop-shadow-sm hover:scale-105 transition-transform duration-300"
          />
        </div>

        {/* Center: Search Bar */}
        <div className="w-full max-w-lg mx-4">
          <div className="relative group">
            <input
              className="w-full bg-white border-4 border-[#E6D2B5] text-[#5D4037] text-lg rounded-full py-2 pl-6 pr-12 focus:outline-none focus:border-[#F4A261] focus:ring-0 placeholder-[#C4A484] shadow-sm transition-colors"
              placeholder="搜尋課程..."
              type="text"
            />
            <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#E6D2B5] group-hover:text-[#F4A261] transition-colors">
              <Search className="h-7 w-7" strokeWidth={3} />
            </button>
          </div>
        </div>

        {/* Right: User Actions */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowUiSettings(true)}
            className="bg-[#FFF9F0] p-2 rounded-full border-2 border-[#E6D2B5] text-[#DCC098] hover:text-[#F4A261] hover:-translate-y-1 transition-all shadow-sm"
          >
            <Volume2 className="h-6 w-6" />
          </button>
          <button className="bg-[#FFF9F0] p-2 rounded-full border-2 border-[#E6D2B5] text-[#DCC098] hover:text-[#F4A261] hover:-translate-y-1 transition-all shadow-sm">
            <MessageSquare className="h-6 w-6" />
          </button>
          <button
            onClick={logout}
            className="h-12 w-12 rounded-full border-4 border-[#E6D2B5] bg-white overflow-hidden shadow-sm cursor-pointer hover:scale-110 transition-transform"
          >
            <div className="h-full w-full flex items-center justify-center">
              <div className="h-8 w-8 rounded-full bg-[#8D6E63] flex items-center justify-center text-white text-sm font-bold">
                {user?.profile?.name?.charAt(0) || user?.username?.charAt(0) || 'S'}
              </div>
            </div>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 pb-10">
        {/* Left Sidebar */}
        <aside className="lg:col-span-4 bg-[#FEF7EC] border-4 border-[#5E4C40] rounded-3xl p-6 shadow-lg flex-shrink-0 flex flex-col min-h-fit">
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
            <div className="text-lg font-bold text-[#5E4C40]">
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
          <div className="mb-6 bg-white/90 border-4 border-[#5E4C40] rounded-3xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-black text-[#5E4C40]">我的進度</div>
              <div className="text-xs font-bold text-gray-600">
                {overallProgress.total > 0 ? Math.round((overallProgress.completed / overallProgress.total) * 100) : 0}%
              </div>
            </div>
            <div className="h-3 bg-gray-200 rounded-full border-2 border-[#5E4C40] overflow-hidden">
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

          <div className="text-center mb-4 border-b-4 border-[#5E4C40] pb-2">
            <h3 className="text-xl font-bold text-[#5E4C40]">我的學科</h3>
          </div>

          <nav className="flex-1 space-y-3 overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowAiChat(true)}
              className="w-[calc(100%-10px)] flex items-center gap-3 px-4 py-2 rounded-2xl border-4 transition-all duration-150 border-[#5E4C40] bg-[#D2EFFF] hover:bg-white shadow-sm"
              title="AI對話"
            >
              <Bot className="w-6 h-6 text-[#5E4C40]" />
              <span className="text-lg font-bold text-[#5E4C40] flex-1 text-left">AI對話</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAppStudio(true)}
              className="w-[calc(100%-10px)] flex items-center gap-3 px-4 py-2 rounded-2xl border-4 transition-all duration-150 border-[#5E4C40] bg-[#E8F5E9] hover:bg-white shadow-sm"
              title="小程式工作坊"
            >
              <Code2 className="w-6 h-6 text-[#5E4C40]" />
              <span className="text-lg font-bold text-[#5E4C40] flex-1 text-left">小程式工作坊</span>
            </button>

            {VISIBLE_SUBJECTS.map((subject) => {
              const config = SUBJECT_CONFIG[subject];
              const isSelected = selectedSubject === subject;
              const stats = subjectProgress.get(subject) ?? { total: 0, completed: 0 };
              return (
                <button
                  key={subject}
                  onClick={() => (SINGLE_SUBJECT_MODE ? null : setSelectedSubject(subject))}
                  className={`w-[calc(100%-10px)] flex items-center gap-3 px-4 py-2 rounded-2xl border-4 transition-all duration-150 ${isSelected
                    ? 'border-[#5E4C40] translate-x-2 bg-opacity-100 shadow-sm'
                    : 'border-transparent hover:border-[#5E4C40]/30 bg-opacity-70'
                    }`}
                  style={{ backgroundColor: config.color }}
                >
                  <span className="text-2xl">{config.icon}</span>
                  <span className="text-lg font-bold text-[#5E4C40] flex-1 text-left">{subject}</span>
                  {stats.total > 0 && (
                    <span className="text-xs font-black text-[#5E4C40] bg-white/70 border-2 border-[#5E4C40] rounded-xl px-2 py-1">
                      {stats.completed}/{stats.total}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-4 pt-4 border-t-4 border-[#5E4C40]">
            <button onClick={() => navigate('/')} className="text-sm text-[#5E4C40] font-bold hover:underline">← 返回登入</button>
          </div>
        </aside>

        {/* Right Content */}
        <section className="lg:col-span-8 flex flex-col gap-8">
          {/* Top Banner */}
          <div className="cartoon-card relative h-64 md:h-72 w-full group overflow-hidden">
            <div className="absolute inset-0 border-[6px] border-[#DCC098]/30 rounded-[20px] pointer-events-none z-10"></div>

            {/* Rainbow background */}
            <div className="w-full h-full rainbow-gradient" />

            {/* Character illustrations */}
            <div className="absolute inset-0 flex justify-center items-center z-10">
              <div className="flex gap-8">
                <div className="w-20 h-20 bg-white/80 border-3 border-[#5D4037] rounded-full flex items-center justify-center text-3xl">
                  👦
                </div>
                <div className="w-20 h-20 bg-white/80 border-3 border-[#5D4037] rounded-full flex items-center justify-center text-3xl">
                  👧
                </div>
              </div>
            </div>

            {/* Overlay Text */}
            <div className="absolute inset-0 flex flex-col justify-center items-center z-20">
              <h1
                className="text-4xl md:text-6xl font-extrabold text-outline-thick text-center tracking-wider"
                style={{
                  animation: 'bounce 2s infinite',
                  textShadow: '4px 4px 0 #8D6E63, -2px -2px 0 #8D6E63, 2px -2px 0 #8D6E63, -2px 2px 0 #8D6E63, 2px 2px 0 #8D6E63'
                }}
              >
                歡迎回到科學之旅!
              </h1>
            </div>
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
                  <div className="mt-2 flex justify-between text-sm font-bold text-gray-600">
                    <span>完成 {overallProgress.completed}</span>
                    <span>剩餘 {overallProgress.pending}</span>
                  </div>
                </div>

                {/* Course Progress */}
                <div className="space-y-3">
                  {VISIBLE_SUBJECTS.slice(0, 3).map((subject) => {
                    const config = SUBJECT_CONFIG[subject];
                    const stats = subjectProgress.get(subject) ?? { total: 3, completed: 2 };
                    const percentage = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

                    return (
                      <div key={subject} className="flex items-center gap-3">
                        <span className="text-lg">{config.icon}</span>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-bold text-[#5D4037]">{subject}</span>
                            <span className="text-xs font-bold text-gray-600">{stats.completed}/{stats.total}</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full border border-[#E6D2B5]">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: config.color
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
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