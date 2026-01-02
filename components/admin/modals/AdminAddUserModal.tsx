import React from 'react';
import { X } from 'lucide-react';
import Button from '../../Button';
import Input from '../../Input';

export default function AdminAddUserModal(props: {
  open: boolean;
  isLoading?: boolean;
  error?: string;
  availableSubjects: string[];
  availableClasses: string[];
  form: {
    username: string;
    password: string;
    name: string;
    role: 'teacher' | 'student';
    studentId: string;
    class: string;
    chineseGroup: string;
    englishGroup: string;
    mathGroup: string;
    subjectsTaught: string[];
    subjectClasses: Record<string, string[]>;
  };
  setForm: (next: any) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { open, isLoading, error, availableSubjects, availableClasses, form, setForm, onClose, onSubmit } = props;
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
    setForm({ ...form, subjectsTaught: nextSubjects, subjectClasses: nextSubjectClasses });
  };

  const toggleSubjectClass = (subject: string, className: string) => {
    const map = { ...(form.subjectClasses || {}) };
    const cur = Array.isArray(map[subject]) ? map[subject] : [];
    const next = cur.includes(className) ? cur.filter((c) => c !== className) : [...cur, className];
    map[subject] = next;
    setForm({ ...form, subjectClasses: map });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[90] flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md shadow-lg relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 w-10 h-10 rounded-full bg-white border border-gray-300 hover:bg-gray-100 flex items-center justify-center"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-brand-brown" />
        </button>

        <h3 className="text-xl font-black text-brand-brown mb-4">新增用戶</h3>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-xl font-bold">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <Input
            placeholder="用戶名"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <Input
            placeholder="密碼"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <Input
            placeholder="姓名"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select
            className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white font-bold"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as 'teacher' | 'student' })}
          >
            <option value="student">學生</option>
            <option value="teacher">教師</option>
          </select>

          {form.role === 'student' && (
            <>
              <Input
                placeholder="學號"
                value={form.studentId}
                onChange={(e) => setForm({ ...form, studentId: e.target.value })}
              />
              <Input
                placeholder="班級"
                value={form.class}
                onChange={(e) => setForm({ ...form, class: e.target.value })}
              />
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="中文分組"
                  value={form.chineseGroup}
                  onChange={(e) => setForm({ ...form, chineseGroup: e.target.value })}
                />
                <Input
                  placeholder="英文分組"
                  value={form.englishGroup}
                  onChange={(e) => setForm({ ...form, englishGroup: e.target.value })}
                />
                <Input
                  placeholder="數學分組"
                  value={form.mathGroup}
                  onChange={(e) => setForm({ ...form, mathGroup: e.target.value })}
                />
              </div>
            </>
          )}

          {form.role === 'teacher' && (
            <div className="space-y-3">
              <div className="border border-gray-200 rounded-2xl p-3 bg-gray-50">
                <div className="text-xs font-black text-brand-brown mb-2">任教科目</div>
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
                <div className="border border-gray-200 rounded-2xl p-3 bg-gray-50">
                  <div className="text-xs font-black text-brand-brown mb-2">任教班別（按科目）</div>
                  <div className="space-y-3">
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
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            fullWidth
            className="bg-gray-200 hover:bg-gray-300"
            onClick={onClose}
            disabled={!!isLoading}
          >
            取消
          </Button>
          <Button
            fullWidth
            className="bg-[#B5F8CE] hover:bg-[#A1E5B8]"
            onClick={onSubmit}
            disabled={!!isLoading}
          >
            {isLoading ? '新增中...' : '新增'}
          </Button>
        </div>
      </div>
    </div>
  );
}
