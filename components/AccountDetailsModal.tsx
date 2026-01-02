import React, { useMemo, useState } from 'react';
import { KeyRound, User, X } from 'lucide-react';
import Button from './Button';
import { authService } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';

export default function AccountDetailsModal(props: { open: boolean; onClose: () => void }) {
  const { open, onClose } = props;
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const roleLabel = useMemo(() => {
    if (!user?.role) return '';
    if (user.role === 'admin') return '管理員';
    if (user.role === 'teacher') return '教師';
    return '學生';
  }, [user?.role]);

  if (!open) return null;

  const close = () => {
    setError('');
    setNewPassword('');
    setNewPasswordConfirm('');
    onClose();
  };

  const submit = async () => {
    const pw = String(newPassword || '').trim();
    const pw2 = String(newPasswordConfirm || '').trim();
    if (!pw) return setError('請輸入新密碼');
    if (pw.length < 6) return setError('新密碼至少 6 個字元');
    if (pw !== pw2) return setError('兩次輸入的新密碼不一致');

    if (!confirm('確定要更新密碼？更新後建議重新登入。')) return;

    try {
      setSubmitting(true);
      setError('');
      await authService.updateMyPassword(pw);
      alert('密碼已更新！');
      close();
    } catch (e) {
      const message = e instanceof Error ? e.message : '更新失敗';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-comic overflow-hidden flex flex-col">
        <div className="p-6 border-b-4 border-brand-brown bg-[#D2EFFF] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-2xl font-black text-brand-brown truncate flex items-center gap-2">
              <User className="w-6 h-6" />
              帳號詳情
            </div>
            <div className="text-sm font-bold text-gray-600">查看帳號資料及重設密碼</div>
          </div>
          <button
            onClick={close}
            className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center flex-shrink-0"
            aria-label="關閉"
          >
            <X className="w-6 h-6 text-brand-brown" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto bg-brand-cream space-y-5">
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-red-800 font-bold">
              {error}
            </div>
          )}

          <div className="bg-white border-4 border-brand-brown rounded-3xl p-5 shadow-comic">
            <div className="text-lg font-black text-brand-brown mb-3">基本資料</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm font-bold text-gray-800">
              <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-3">
                <div className="text-xs font-black text-gray-600 mb-1">帳號</div>
                <div className="text-base font-black text-brand-brown">{user?.username || '—'}</div>
              </div>
              <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-3">
                <div className="text-xs font-black text-gray-600 mb-1">身份</div>
                <div className="text-base font-black text-brand-brown">{roleLabel || '—'}</div>
              </div>
              <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-3 md:col-span-2">
                <div className="text-xs font-black text-gray-600 mb-1">姓名</div>
                <div className="text-base font-black text-brand-brown">{user?.profile?.name || '—'}</div>
              </div>
            </div>
          </div>

          <div className="bg-white border-4 border-brand-brown rounded-3xl p-5 shadow-comic">
            <div className="text-lg font-black text-brand-brown mb-3 flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              重設密碼
            </div>
            <div className="space-y-3">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="新密碼（至少 6 個字元）"
                className="w-full px-4 py-3 border-4 border-brand-brown rounded-2xl bg-white font-bold"
                disabled={submitting}
              />
              <input
                type="password"
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                placeholder="確認新密碼"
                className="w-full px-4 py-3 border-4 border-brand-brown rounded-2xl bg-white font-bold"
                disabled={submitting}
              />
              <div className="text-xs font-bold text-gray-600">更新後建議登出再重新登入。</div>
              <div className="flex gap-3 pt-1">
                <Button
                  className="flex-1 bg-gray-300 text-gray-700 hover:bg-gray-400"
                  onClick={close}
                  disabled={submitting}
                >
                  取消
                </Button>
                <Button
                  className="flex-1 bg-[#FDEEAD] text-brand-brown hover:bg-[#FCE690] border-brand-brown"
                  onClick={submit}
                  disabled={submitting}
                >
                  {submitting ? '更新中...' : '更新密碼'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

