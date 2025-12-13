import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/Button';
import Input from '../components/Input';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, user, isLoading } = useAuth();

  const [teacherForm, setTeacherForm] = useState({
    username: '',
    password: ''
  });

  const [studentForm, setStudentForm] = useState({
    username: '',
    password: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminForm, setAdminForm] = useState({
    username: 'admin',
    password: ''
  });

  // 如果已經登入，重定向到對應頁面
  useEffect(() => {
    if (isAuthenticated && user) {
      switch (user.role) {
        case 'admin':
          navigate('/admin');
          break;
        case 'teacher':
          navigate('/teacher');
          break;
        case 'student':
          navigate('/student');
          break;
        default:
          break;
      }
    }
  }, [isAuthenticated, user, navigate]);

  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherForm.username || !teacherForm.password) {
      setError('請填寫完整的登入資料');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await login(teacherForm.username, teacherForm.password, 'teacher');
    } catch (error) {
      setError(error instanceof Error ? error.message : '登入失敗，請檢查用戶名和密碼');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.username || !studentForm.password) {
      setError('請填寫完整的登入資料');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await login(studentForm.username, studentForm.password, 'student');
    } catch (error) {
      setError(error instanceof Error ? error.message : '登入失敗，請檢查用戶名和密碼');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminAccess = () => {
    setShowAdminModal(true);
    setAdminForm({ username: 'admin', password: '' });
    setError('');
  };

  const handleAdminLogin = async () => {
    if (!adminForm.username || !adminForm.password) {
      setError('請輸入管理員帳號和密碼');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await login(adminForm.username, adminForm.password, 'admin');
      setShowAdminModal(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : '管理員登入失敗，請聯絡系統管理員');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="h-full w-full flex flex-col items-center justify-center p-4 md:p-8"
      style={{
        backgroundImage: `url('/bg.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="mb-8 md:mb-12 text-center">
        <h1 className="text-6xl md:text-8xl font-rounded font-black text-brand-green-light drop-shadow-[0_4px_0_rgba(94,76,64,1)] text-stroke" style={{ transform: 'translateY(-50px)' }}>
          <span className="text-white drop-shadow-md" style={{ textShadow: '4px 4px 0 #5E4C40, -2px -2px 0 #5E4C40, 2px -2px 0 #5E4C40, -2px 2px 0 #5E4C40' }}>Lpedia</span>
        </h1>
        <h2 className="text-xl md:text-3xl font-rounded font-bold text-yellow-100 mt-2" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8), 1px 1px 2px rgba(0,0,0,0.6)', transform: 'translateY(-30px)' }}>
          九龍婦女福利會李炳紀念學校校本AI學習平台
        </h2>

      </div>

      <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 w-full max-w-5xl justify-center items-center lg:items-start">
        
        {/* Teacher Login Card */}
        <div className="w-full max-w-md bg-brand-yellow-light border-4 border-brand-brown rounded-[2rem] p-8 shadow-comic-lg relative lg:-translate-x-[180px]">
          <div className="flex flex-col items-center mb-6">
            <div className="w-24 h-24 rounded-full border-4 border-brand-brown bg-white mb-4 overflow-hidden relative">
               <img
                src="/teacher_login.png"
                alt="Teacher"
                className="w-full h-full object-cover"
              />
            </div>
            <h3 className="text-2xl font-bold text-brand-brown">教師登入</h3>
          </div>
          
          <form onSubmit={handleTeacherLogin} className="space-y-4">
            <Input
              placeholder="帳號"
              value={teacherForm.username}
              onChange={(e) => setTeacherForm({ ...teacherForm, username: e.target.value })}
            />
            <Input
              type="password"
              placeholder="密碼"
              value={teacherForm.password}
              onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
            />
            <Button
              fullWidth
              type="submit"
              className="mt-4 text-xl"
              disabled={isSubmitting}
            >
              {isSubmitting ? '登入中...' : '登入'}
            </Button>

            {/* Admin Link */}
            <div className="text-center mt-3">
              <button
                type="button"
                onClick={handleAdminAccess}
                className="text-xs text-gray-500 hover:text-gray-700 font-bold opacity-70 hover:opacity-100 transition-opacity"
                style={{ fontSize: '11px' }}
                disabled={isSubmitting}
              >
                管理員入口
              </button>
            </div>
          </form>
        </div>


        {/* Student Login Card */}
        <div className="w-full max-w-md bg-brand-green-light border-4 border-brand-green-dark rounded-[2rem] p-8 shadow-comic-lg relative lg:translate-x-[180px]">
          <div className="flex flex-col items-center mb-6">
            <div className="w-24 h-24 rounded-full border-4 border-brand-brown bg-white mb-4 overflow-hidden">
              <img
                src="/student_login.png"
                alt="Student"
                className="w-full h-full object-cover"
              />
            </div>
            <h3 className="text-2xl font-bold text-brand-green-dark">學生登入</h3>
          </div>
          
          <form onSubmit={handleStudentLogin} className="space-y-4">
            <Input
              placeholder="帳號"
              className="border-brand-green-dark focus:ring-brand-green"
              value={studentForm.username}
              onChange={(e) => setStudentForm({ ...studentForm, username: e.target.value })}
            />
            <Input
              type="password"
              placeholder="密碼"
              className="border-brand-green-dark focus:ring-brand-green"
              value={studentForm.password}
              onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
            />
            <Button
              fullWidth
              type="submit"
              variant="success"
              className="mt-4 text-xl border-brand-green-dark bg-[#A1D9AE] hover:bg-[#8ECF9D] text-brand-green-dark"
              disabled={isSubmitting}
            >
              {isSubmitting ? '登入中...' : '登入'}
            </Button>
          </form>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-6 max-w-md mx-auto">
            <div className="bg-red-100 border-4 border-red-500 rounded-2xl p-4 text-center">
              <p className="text-red-700 font-bold">{error}</p>
            </div>
          </div>
        )}

      </div>

      {/* Admin Password Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-4 border-brand-brown rounded-2xl p-8 max-w-md w-full shadow-comic-xl">
            <h3 className="text-2xl font-bold text-brand-brown text-center mb-6">管理員驗證</h3>
            <div className="space-y-4">
              <Input
                placeholder="管理員帳號"
                value={adminForm.username}
                onChange={(e) => setAdminForm(prev => ({ ...prev, username: e.target.value }))}
                autoFocus
              />
              <Input
                type="password"
                placeholder="管理員密碼"
                value={adminForm.password}
                onChange={(e) => setAdminForm(prev => ({ ...prev, password: e.target.value }))}
                onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
              />
              <div className="flex gap-3">
                <Button
                  fullWidth
                  variant="secondary"
                  onClick={() => {
                    setShowAdminModal(false);
                    setAdminForm({ username: 'admin', password: '' });
                    setError('');
                  }}
                  disabled={isSubmitting}
                >
                  取消
                </Button>
                <Button
                  fullWidth
                  onClick={handleAdminLogin}
                  disabled={isSubmitting || !adminForm.password || !adminForm.username}
                >
                  {isSubmitting ? '登入中...' : '確認'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
