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
  availableSubjects: string[];
  availableClasses: string[];
  onClose: () => void;
  onRequestEdit: () => void;
  onSave: (payload: { username: string; role: 'teacher' | 'student'; isActive: boolean; profile: Record<string, any>; newPassword?: string }) => Promise<void> | void;
}) {
  const { open, mode, loading, saving, error, user, learningStats, availableSubjects, availableClasses, onClose, onRequestEdit, onSave } = props;
  const isEdit = mode === 'edit';
  const isAdminUser = user?.role === 'admin';

  const initial = useMemo(() => {
    const profile = (user?.profile && typeof user.profile === 'object') ? user.profile : {};
    const subjects = Array.isArray(profile.subjectsTaught) ? profile.subjectsTaught.filter((s: any) => typeof s === 'string' && s.trim()).map((s: any) => s.trim()) : [];
    const subjectClasses = profile.subjectClasses && typeof profile.subjectClasses === 'object' ? profile.subjectClasses : {};
    return {
      username: String(user?.username || ''),
      role: (user?.role === 'teacher' || user?.role === 'student') ? user.role : 'student',
      isActive: !!user?.isActive,
      name: String(profile.name || ''),
      studentId: String((profile as any).studentId || ''),
      className: String(profile.class || ''),
      chineseGroup: String(profile.chineseGroup || ''),
      englishGroup: String(profile.englishGroup || ''),
      mathGroup: String(profile.mathGroup || ''),
      subjectsTaught: subjects,
      subjectClasses: subjectClasses && typeof subjectClasses === 'object' ? subjectClasses : {},
      newPassword: '',
      newPasswordConfirm: ''
    };
  }, [user]);

  const [form, setForm] = useState(initial);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(initial);
    setLocalError('');
  }, [initial, open]);

  if (!open) return null;

  const toggleSubject = (subject: string) => {
    const cur = Array.isArray(form.subjectsTaught) ? form.subjectsTaught : [];
    const nextSubjects = cur.includes(subject) ? cur.filter((s) => s !== subject) : [...cur, subject];
    const nextSubjectClasses = { ...(form.subjectClasses || {}) };
    if (!nextSubjects.includes(subject)) {
      delete nextSubjectClasses[subject];
    } else {
      if (!Array.isArray(nextSubjectClasses[subject])) nextSubjectClasses[subject] = [];
    }
    setForm((s) => ({ ...s, subjectsTaught: nextSubjects, subjectClasses: nextSubjectClasses }));
  };

  const toggleSubjectClass = (subject: string, className: string) => {
    const map = { ...(form.subjectClasses || {}) };
    const cur = Array.isArray(map[subject]) ? map[subject] : [];
    const next = cur.includes(className) ? cur.filter((c) => c !== className) : [...cur, className];
    map[subject] = next;
    setForm((s) => ({ ...s, subjectClasses: map }));
  };

  const teacherSummary = (profile: any) => {
    const subjects = Array.isArray(profile?.subjectsTaught) ? profile.subjectsTaught : [];
    const subjectClasses = profile?.subjectClasses && typeof profile.subjectClasses === 'object' ? profile.subjectClasses : {};
    if (subjects.length === 0) return '（未設定）';
    const parts = subjects.map((s: string) => {
      const classes = Array.isArray(subjectClasses?.[s]) ? subjectClasses[s] : [];
      return `${s}${classes.length > 0 ? `：${classes.join('、')}` : ''}`;
    });
    return parts.join('；');
  };

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
          {!loading && !error && localError && <div className="text-red-700 font-bold">{localError}</div>}

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
                      disabled={isAdminUser}
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
                      <div className="text-xs font-bold text-gray-600 mb-1">學號</div>
                      {isEdit ? (
                        <Input value={form.studentId} onChange={(e) => setForm((s) => ({ ...s, studentId: e.target.value }))} />
                      ) : (
                        <div className="font-bold text-gray-800">{String((user.profile as any)?.studentId || '')}</div>
                      )}
                    </div>
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
                      <div className="text-xs font-bold text-gray-600 mb-1">任教設定</div>
                      {isEdit ? (
                        <div className="border border-gray-200 rounded-2xl p-3 bg-gray-50 space-y-3">
                          <div>
                            <div className="text-xs font-bold text-gray-600 mb-2">任教科目</div>
                            <div className="flex flex-wrap gap-2">
                              {availableSubjects.map((s) => {
                                const active = Array.isArray(form.subjectsTaught) && form.subjectsTaught.includes(s);
                                return (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => toggleSubject(s)}
                                    className={[
                                      'px-3 py-1 rounded-xl border font-black',
                                      active ? 'bg-[#B5D8F8] border-brand-brown text-brand-brown' : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-100'
                                    ].join(' ')}
                                  >
                                    {s}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {Array.isArray(form.subjectsTaught) && form.subjectsTaught.length > 0 && (
                            <div>
                              <div className="text-xs font-bold text-gray-600 mb-2">任教班別（按科目）</div>
                              <div className="space-y-2">
                                {form.subjectsTaught.map((subject) => {
                                  const selected = new Set<string>(Array.isArray(form.subjectClasses?.[subject]) ? form.subjectClasses[subject] : []);
                                  return (
                                    <div key={subject} className="bg-white border border-gray-200 rounded-2xl p-3">
                                      <div className="font-black text-gray-800 mb-2">{subject}</div>
                                      {availableClasses.length === 0 ? (
                                        <div className="text-xs text-gray-600 font-bold">（未有班別資料，請先建立學生或從 CSV 匯入）</div>
                                      ) : (
                                        <div className="flex flex-wrap gap-2">
                                          {availableClasses.map((cls) => {
                                            const active = selected.has(cls);
                                            return (
                                              <button
                                                key={cls}
                                                type="button"
                                                onClick={() => toggleSubjectClass(subject, cls)}
                                                className={[
                                                  'px-3 py-1 rounded-xl border font-black',
                                                  active ? 'bg-[#B5F8CE] border-brand-brown text-brand-brown' : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-100'
                                                ].join(' ')}
                                              >
                                                {cls}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm font-bold text-gray-800">{teacherSummary(user.profile)}</div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {isEdit && !isAdminUser && (
                <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50">
                  <div className="text-sm font-black text-brand-brown mb-2">重設密碼（選填）</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      placeholder="新密碼（至少 6 個字元）"
                      type="password"
                      value={form.newPassword}
                      onChange={(e) => setForm((s) => ({ ...s, newPassword: e.target.value }))}
                    />
                    <Input
                      placeholder="確認新密碼"
                      type="password"
                      value={form.newPasswordConfirm}
                      onChange={(e) => setForm((s) => ({ ...s, newPasswordConfirm: e.target.value }))}
                    />
                  </div>
                  <div className="text-xs text-gray-600 font-bold mt-2">如留空則不更改密碼。</div>
                </div>
              )}

              {learningStats && !isEdit && (
                <div className="border border-gray-200 rounded-2xl p-3 bg-gray-50">
                  <div className="text-sm font-black text-brand-brown mb-1">學習統計</div>
                  <pre className="text-xs overflow-auto">{JSON.stringify(learningStats, null, 2)}</pre>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                {!isEdit && !isAdminUser && (
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
                        setLocalError('');
                        const pw = String(form.newPassword || '');
                        const pw2 = String(form.newPasswordConfirm || '');
                        if ((pw || pw2) && pw.length < 6) {
                          setLocalError('新密碼至少 6 個字元');
                          return;
                        }
                        if (pw || pw2) {
                          if (pw !== pw2) {
                            setLocalError('兩次輸入的新密碼不一致');
                            return;
                          }
                        }

                        const profile = {
                          ...(user.profile || {}),
                          name: form.name,
                          ...(form.role === 'student' ? { studentId: form.studentId, class: form.className, chineseGroup: form.chineseGroup, englishGroup: form.englishGroup, mathGroup: form.mathGroup } : {}),
                          ...(form.role === 'teacher'
                            ? {
                                subjectsTaught: Array.isArray(form.subjectsTaught) && form.subjectsTaught.length > 0 ? form.subjectsTaught : availableSubjects,
                                subjectClasses: form.subjectClasses && typeof form.subjectClasses === 'object' ? form.subjectClasses : {}
                              }
                            : {})
                        };
                        void onSave({
                          username: form.username,
                          role: form.role,
                          isActive: form.isActive,
                          profile,
                          ...(pw ? { newPassword: pw } : {})
                        });
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
