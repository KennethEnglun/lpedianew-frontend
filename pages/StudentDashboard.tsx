import React, { useState, useEffect } from 'react';
import { Settings, LogOut, CheckCircle2, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SvgFrame from '../components/SvgFrame';
import UiSettingsModal from '../components/UiSettingsModal';

const NewStudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showUiSettings, setShowUiSettings] = useState(false);

  // Sample data - replace with real data from your backend
  const courses = [
    {
      id: 1,
      name: 'AI基礎',
      icon: '🤖',
      progress: 100,
      total: 200,
      color: '#A8E6CF'
    },
    {
      id: 2,
      name: '趣味化學',
      icon: '🧪',
      progress: 100,
      total: 200,
      color: '#FFB3BA'
    },
    {
      id: 3,
      name: '宇宙探索',
      icon: '🚀',
      progress: 200,
      total: 300,
      color: '#BFCFFF'
    }
  ];

  const dailyChallenges = [
    { id: 1, name: '打解網嗨生活課體', completed: true },
    { id: 2, name: '每日挑戰攻略', completed: true },
    { id: 3, name: '每日生事挑戰', completed: true }
  ];

  const achievements = [
    { id: 1, name: '收集獎勵', count: 200, icon: '🏆' },
    { id: 2, name: '星星積分', count: 0, icon: '⭐' }
  ];

  return (
    <div className="min-h-screen font-sans" style={{
      background: 'linear-gradient(135deg, #FEF7EC 0%, #F0F8FF 50%, #E8F5E9 100%)'
    }}>
      {/* Header */}
      <header className="bg-gradient-to-r from-[#A1D9AE] to-[#87CEEB] border-b-4 border-[#5E4C40] py-4 px-6 flex justify-between items-center shadow-lg">
        {/* Logo placeholder */}
        <div className="w-32 h-16 bg-white/90 border-3 border-[#5E4C40] rounded-xl flex items-center justify-center shadow-md">
          <span className="text-xs font-bold text-[#5E4C40]">LOGO</span>
        </div>

        <div className="text-center">
          <div className="text-4xl font-black text-[#5E4C40] font-rounded tracking-wider">
            LP科樂園
          </div>
          <div className="text-lg font-bold text-[#5E4C40]/90">
            LP S‧PARK
          </div>
          <div className="text-sm font-bold text-[#5E4C40]/80">
            李炳科學AI學習平台
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowUiSettings(true)}
            className="w-12 h-12 bg-white/90 rounded-full border-3 border-[#5E4C40] flex items-center justify-center hover:bg-white shadow-md transition-all"
            title="設定"
          >
            <Settings className="w-6 h-6 text-[#5E4C40]" />
          </button>
          <button
            onClick={logout}
            className="w-12 h-12 bg-white/90 rounded-full border-3 border-[#5E4C40] flex items-center justify-center hover:bg-white shadow-md transition-all"
            title="登出"
          >
            <LogOut className="w-6 h-6 text-[#5E4C40]" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-8 max-w-7xl mx-auto">
        {/* Welcome Banner */}
        <div className="mb-8">
          <SvgFrame
            className="h-64"
            backgroundColor="linear-gradient(135deg, #87CEEB 0%, #98FB98 50%, #FFB6C1 100%)"
            borderColor="#5E4C40"
            cornerRadius={20}
            strokeWidth={4}
          >
            <div className="h-full flex items-center justify-center relative">
              {/* Rainbow background effect */}
              <div
                className="absolute inset-0 opacity-30 rounded-2xl"
                style={{
                  background: 'linear-gradient(45deg, #ff6b6b, #ffa500, #ffff00, #32cd32, #1e90ff, #9400d3)',
                  backgroundSize: '400% 400%',
                  animation: 'rainbow 3s ease infinite'
                }}
              />

              <div className="relative z-10 text-center">
                <h1 className="text-4xl font-black text-[#5E4C40] mb-4">
                  歡迎回到科學之旅！
                </h1>
                <div className="flex justify-center gap-8">
                  {/* Cartoon characters placeholder */}
                  <div className="w-24 h-24 bg-white/80 border-3 border-[#5E4C40] rounded-full flex items-center justify-center">
                    👦
                  </div>
                  <div className="w-24 h-24 bg-white/80 border-3 border-[#5E4C40] rounded-full flex items-center justify-center">
                    👧
                  </div>
                </div>
              </div>
            </div>
          </SvgFrame>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* My Courses */}
          <div>
            <SvgFrame
              className="h-80"
              backgroundColor="#FFFACD"
              borderColor="#5E4C40"
              cornerRadius={16}
              strokeWidth={3}
            >
              <div>
                <h2 className="text-2xl font-black text-[#5E4C40] mb-6 text-center">我的課程</h2>
                <div className="space-y-4">
                  {courses.map((course) => (
                    <div key={course.id} className="bg-white/80 border-2 border-[#5E4C40] rounded-xl p-4 shadow-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className="w-12 h-12 rounded-full border-2 border-[#5E4C40] flex items-center justify-center text-xl"
                          style={{ backgroundColor: course.color }}
                        >
                          {course.icon}
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-[#5E4C40]">{course.name}</div>
                          <div className="text-sm text-gray-600">{course.progress} / {course.total}</div>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 border-2 border-[#5E4C40]">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(course.progress / course.total) * 100}%`,
                            backgroundColor: course.color
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SvgFrame>
          </div>

          {/* Daily Challenges */}
          <div>
            <SvgFrame
              className="h-80"
              backgroundColor="#F0FFFF"
              borderColor="#5E4C40"
              cornerRadius={16}
              strokeWidth={3}
            >
              <div>
                <h2 className="text-2xl font-black text-[#5E4C40] mb-6 text-center">每日挑戰</h2>
                <div className="space-y-4">
                  {dailyChallenges.map((challenge) => (
                    <div key={challenge.id} className="bg-white/80 border-2 border-[#5E4C40] rounded-xl p-4 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full border-2 border-[#5E4C40] flex items-center justify-center ${
                          challenge.completed ? 'bg-green-400' : 'bg-gray-200'
                        }`}>
                          {challenge.completed ? <CheckCircle2 className="w-6 h-6 text-white" /> : ''}
                        </div>
                        <div className="flex-1 font-bold text-[#5E4C40]">{challenge.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SvgFrame>
          </div>

          {/* My Achievements */}
          <div>
            <SvgFrame
              className="h-80"
              backgroundColor="#FFF0F5"
              borderColor="#5E4C40"
              cornerRadius={16}
              strokeWidth={3}
            >
              <div>
                <h2 className="text-2xl font-black text-[#5E4C40] mb-6 text-center">我的獎勵</h2>

                {/* Achievement badges */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-yellow-300/80 border-2 border-[#5E4C40] rounded-xl p-3 text-center shadow-sm">
                    <div className="text-2xl mb-1">🏆</div>
                    <div className="text-sm font-bold text-[#5E4C40]">成就徽章</div>
                  </div>
                  <div className="bg-blue-300/80 border-2 border-[#5E4C40] rounded-xl p-3 text-center shadow-sm">
                    <div className="text-2xl mb-1">🏅</div>
                    <div className="text-sm font-bold text-[#5E4C40]">獎章</div>
                  </div>
                  <div className="bg-pink-300/80 border-2 border-[#5E4C40] rounded-xl p-3 text-center shadow-sm">
                    <div className="text-2xl mb-1">🥇</div>
                    <div className="text-sm font-bold text-[#5E4C40]">金牌</div>
                  </div>
                  <div className="bg-orange-300/80 border-2 border-[#5E4C40] rounded-xl p-3 text-center shadow-sm">
                    <div className="text-2xl mb-1">🏆</div>
                    <div className="text-sm font-bold text-[#5E4C40]">獎盃</div>
                  </div>
                </div>

                {/* Points */}
                <div className="space-y-3">
                  <div className="bg-white/80 border-2 border-[#5E4C40] rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Star className="w-6 h-6 text-yellow-500" />
                      <span className="font-bold text-[#5E4C40]">收集獎勵</span>
                    </div>
                    <span className="font-black text-[#5E4C40] text-lg">200分</span>
                  </div>
                  <div className="bg-white/80 border-2 border-[#5E4C40] rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Star className="w-6 h-6 text-blue-500" />
                      <span className="font-bold text-[#5E4C40]">星星積分</span>
                    </div>
                    <span className="font-black text-[#5E4C40] text-lg">0</span>
                  </div>
                </div>
              </div>
            </SvgFrame>
          </div>
        </div>
      </div>

      {/* Modals */}
      <UiSettingsModal open={showUiSettings} onClose={() => setShowUiSettings(false)} />

      {/* CSS Animation for rainbow background */}
      <style jsx>{`
        @keyframes rainbow {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
    </div>
  );
};

export default NewStudentDashboard;