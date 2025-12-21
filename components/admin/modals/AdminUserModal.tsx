import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import Button from '../../Button';
import Input from '../../Input';

type UserDetails = {
  id: string;
  username: string;
  role: 'admin' | 'teacher' | 'student';
  isActive: boolean;
  lastLogin?: string | null;
  profile?: Record<string, any>;
};

export default function AdminUserModal(props: {
  open: boolean;
  mode: 'view' | 'edit';
  loading?: boolean;
  saving?: boolean;
  error?: string;
  user: UserDetails | null;
  learningStats?: any;
  onClose: () => void;
  onRequestEdit: () => void;
  onSave: (payload: { username: string; role: 'teacher' | 'student'; isActive: boolean; profile: Record<string, any> }) => Promise<void> | void;
}) {
  const { open, mode, loading, saving, error, user, learningStats, onClose, onRequestEdit, onSave } = props;
  const isEdit = mode === 'edit';

  const initial = useMemo(() => {
    const profile = (user?.profile && typeof user.profile === 'object') ? user.profile : {};
    return {
      username: String(user?.username || ''),
      role: (user?.role === 'teacher' || user?.role === 'student') ? user.role : 'student',
      isActive: !!user?.isActive,
      name: String(profile.name || ''),
      className: String(profile.class || ''),
      teacherCode: String(profile.teacherCode || ''),
      chineseGroup: String(profile.chineseGroup || ''),
      englishGroup: String(profile.englishGroup || ''),
      mathGroup: String(profile.mathGroup || ''),
      homeroomClass: String(profile.homeroomClass || '')
    };
  }, [user]);

  const [form, setForm] = useState(initial);

  useEffect(() => {
    if (!open) return;
    setForm(initial);
  }, [initial, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-[90] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
        <div className="bg-[#A1D9AE] border-b border-gray-200 px-5 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xl font-black text-brand-brown truncate">
              {isEdit ? '編輯用戶' : '用戶詳情'}
            </div>
            {user && (
              <div className="text-xs font-bold text-brand-brown/80 truncate">
                {user.username}（{user.role === 'teacher' ? '教師' : user.role === 'student' ? '學生' : '管理員'}）
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white border border-gray-300 hover:bg-gray-100 flex items-center justify-center shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-brand-brown" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading && <div className="text-gray-700 font-bold">載入中…</div>}
          {!loading && error && <div className="text-red-700 font-bold">{error}</div>}

          {!loading && user && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-bold text-gray-600 mb-1">用戶名</div>
                  {isEdit ? (
                    <Input value={form.username} onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))} />
                  ) : (
                    <div className="font-mono font-bold text-gray-800">{user.username}</div>
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-600 mb-1">角色</div>
                  {isEdit ? (
                    <select
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white font-bold"
                      value={form.role}
                      onChange={(e) => setForm((s) => ({ ...s, role: e.target.value as any }))}
                      disabled={user.role === 'admin'}
                    >
                      <option value="student">學生</option>
                      <option value="teacher">教師</option>
                    </select>
                  ) : (
                    <div className="font-bold text-gray-800">{user.role === 'teacher' ? '教師' : user.role === 'student' ? '學生' : '管理員'}</div>
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-600 mb-1">姓名</div>
                  {isEdit ? (
                    <Input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
                  ) : (
                    <div className="font-bold text-gray-800">{String(user.profile?.name || '')}</div>
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-600 mb-1">狀態</div>
                  {isEdit ? (
                    <label className="inline-flex items-center gap-2 font-bold text-gray-800">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(e) => setForm((s) => ({ ...s, isActive: e.target.checked }))}
                      />
                      啟用
                    </label>
                  ) : (
                    <div className="font-bold text-gray-800">{user.isActive ? '啟用' : '停用'}</div>
                  )}
                </div>

                {(form.role === 'student' || user.role === 'student') && (
                  <>
                    <div>
                      <div className="text-xs font-bold text-gray-600 mb-1">班級</div>
                      {isEdit ? (
                        <Input value={form.className} onChange={(e) => setForm((s) => ({ ...s, className: e.target.value }))} />
                      ) : (
                        <div className="font-bold text-gray-800">{String(user.profile?.class || '')}</div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-600 mb-1">中文/英文/數學分組</div>
                      {isEdit ? (
                        <div className="grid grid-cols-3 gap-2">
                          <Input value={form.chineseGroup} onChange={(e) => setForm((s) => ({ ...s, chineseGroup: e.target.value }))} />
                          <Input value={form.englishGroup} onChange={(e) => setForm((s) => ({ ...s, englishGroup: e.target.value }))} />
                          <Input value={form.mathGroup} onChange={(e) => setForm((s) => ({ ...s, mathGroup: e.target.value }))} />
                        </div>
                      ) : (
                        <div className="text-sm font-bold text-gray-800">
                          中：{String(user.profile?.chineseGroup || '-')}, 英：{String(user.profile?.englishGroup || '-')}, 數：{String(user.profile?.mathGroup || '-')}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {(form.role === 'teacher' || user.role === 'teacher') && (
                  <>
                    <div>
                      <div className="text-xs font-bold text-gray-600 mb-1">教師代碼</div>
                      {isEdit ? (
                        <Input value={form.teacherCode} onChange={(e) => setForm((s) => ({ ...s, teacherCode: e.target.value }))} />
                      ) : (
                        <div className="font-bold text-gray-800">{String(user.profile?.teacherCode || '')}</div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-600 mb-1">班主任班別</div>
                      {isEdit ? (
                        <Input value={form.homeroomClass} onChange={(e) => setForm((s) => ({ ...s, homeroomClass: e.target.value }))} />
                      ) : (
                        <div className="font-bold text-gray-800">{String(user.profile?.homeroomClass || '')}</div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {learningStats && !isEdit && (
                <div className="border border-gray-200 rounded-2xl p-3 bg-gray-50">
                  <div className="text-sm font-black text-brand-brown mb-1">學習統計</div>
                  <pre className="text-xs overflow-auto">{JSON.stringify(learningStats, null, 2)}</pre>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                {!isEdit && (
                  <Button className="bg-[#B5D8F8] hover:bg-[#A1CCF0]" onClick={onRequestEdit}>
                    編輯
                  </Button>
                )}
                {isEdit && (
                  <>
                    <Button className="bg-gray-200 hover:bg-gray-300" onClick={onClose} disabled={!!saving}>
                      取消
                    </Button>
                    <Button
                      className="bg-[#B5F8CE] hover:bg-[#A1E5B8]"
                      onClick={() => {
                        const profile = {
                          ...(user.profile || {}),
                          name: form.name,
                          ...(form.role === 'student' ? { class: form.className, chineseGroup: form.chineseGroup, englishGroup: form.englishGroup, mathGroup: form.mathGroup } : {}),
                          ...(form.role === 'teacher' ? { teacherCode: form.teacherCode, homeroomClass: form.homeroomClass } : {})
                        };
                        void onSave({ username: form.username, role: form.role, isActive: form.isActive, profile });
                      }}
                      disabled={!!saving}
                    >
                      {saving ? '儲存中…' : '儲存'}
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

