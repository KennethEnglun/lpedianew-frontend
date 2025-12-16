import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/Button';
import Input from '../components/Input';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, user, isLoading } = useAuth();

  const [form, setForm] = useState<{ username: string; password: string }>({ username: '', password: '' });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

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

  const setField = (field: 'username' | 'password', value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = String(form.username || '').trim();
    const password = String(form.password || '').trim();
    if (!username || !password) {
      setError('請填寫完整的登入資料');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await login(username, password);
    } catch (error) {
      setError(error instanceof Error ? error.message : '登入失敗，請檢查用戶名和密碼');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-brand-cream via-white to-brand-blue/30 p-4 sm:p-8 flex items-center justify-center">
      <div className="relative w-[90vw] h-[90vh]">
        <div className="pointer-events-none absolute -top-8 -left-8 w-24 h-24 rounded-full bg-brand-yellow/80" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-10 -right-10 w-28 h-28 rounded-full bg-brand-pink/50" aria-hidden="true" />

        <div className="h-full bg-white/80 backdrop-blur-sm border-4 border-brand-brown rounded-[2.5rem] shadow-comic-xl overflow-hidden flex flex-col lg:flex-row">
          <div className="bg-[#FDE7F4] p-6 sm:p-10 lg:w-1/4 lg:flex-none min-h-0 flex items-center justify-center">
            <div className="w-full max-w-sm max-h-full overflow-y-auto">
              <div className="mb-10 text-center">
                <h1 className="text-6xl sm:text-7xl font-rounded font-black text-brand-brown leading-none tracking-tight">
                  LPedia
                </h1>
                <div className="mt-3 text-sm sm:text-base font-bold text-brand-brown/80">
                  九龍婦女福利會李炳紀念學校校本AI學習平台
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <Input
                  placeholder="帳號"
                  autoComplete="username"
                  value={form.username}
                  onChange={(e) => setField('username', e.target.value)}
                />
                <Input
                  type="password"
                  placeholder="密碼"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                />
                {error && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-3 text-center">
                    <div className="text-red-700 font-bold text-sm">{error}</div>
                  </div>
                )}
                <Button
                  fullWidth
                  type="submit"
                  className="mt-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? '登入中...' : '登入'}
                </Button>
              </form>
            </div>
          </div>

          <div className="relative flex-1 min-h-[240px] border-t-4 lg:border-t-0 lg:border-l-4 border-brand-brown">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url('/bg.gif')` }}
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/15" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
