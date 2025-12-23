import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { VISIBLE_SUBJECTS } from '../platform';

type Props = {
  open: boolean;
  onClose: () => void;
  authService: any;
  availableClasses: string[];
  onCreatedDraft: (payload: { toolType: string; draftId: string }) => void;
};

const parseGradeFromClassName = (className?: string) => {
  const match = String(className || '').match(/^(\d+)/);
  return match ? match[1] : '';
};

const CreateTaskModal: React.FC<Props> = ({ open, onClose, authService, availableClasses, onCreatedDraft }) => {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(VISIBLE_SUBJECTS[0] || '科學');
  const [grade, setGrade] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const gradeOptions = useMemo(() => {
    const grades = Array.from(new Set(availableClasses.map((c) => parseGradeFromClassName(c)).filter(Boolean)));
    grades.sort((a, b) => Number(a) - Number(b));
    return grades;
  }, [availableClasses]);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setSubject(VISIBLE_SUBJECTS[0] || '科學');
    setGrade(gradeOptions[0] || '');
    setLoading(false);
    setError('');
  }, [open, gradeOptions]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[80] flex items-center justify-center p-4">
      <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-comic">
        <div className="p-6 border-b-4 border-brand-brown bg-[#C0E2BE] flex items-center justify-between">
          <div>
            <div className="text-2xl font-black text-brand-brown">建立任務</div>
            <div className="text-sm text-brand-brown/80 font-bold">先建立草稿（存入教師資料夾），再儲存/派發</div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
          >
            <X className="w-6 h-6 text-brand-brown" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-sm font-black text-brand-brown">工具：討論（第一階段）</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-sm font-black text-brand-brown mb-2">年級</div>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-4 py-3 border-2 border-brand-brown rounded-2xl font-bold"
              >
                {gradeOptions.map((g) => (
                  <option key={g} value={g}>
                    {g}年級
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-sm font-black text-brand-brown mb-2">科目</div>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-3 border-2 border-brand-brown rounded-2xl font-bold"
              >
                {VISIBLE_SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="text-sm font-black text-brand-brown mb-2">標題</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 border-2 border-brand-brown rounded-2xl font-bold"
              placeholder="輸入標題..."
            />
          </div>

          {error && <div className="text-red-700 font-bold">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white border-2 border-gray-300 font-black text-gray-700 hover:border-blue-500"
              disabled={loading}
            >
              取消
            </button>
            <button
              onClick={async () => {
                const t = title.trim();
                if (!grade) return setError('請選擇年級');
                if (!subject) return setError('請選擇科目');
                if (!t) return setError('請輸入標題');
                setLoading(true);
                setError('');
                try {
                  const resp = await authService.createDraft({
                    toolType: 'discussion',
                    title: t,
                    subject,
                    grade,
                    scope: 'my',
                    contentSnapshot: { content: [{ type: 'html', value: '' }] }
                  });
                  const id = String(resp?.draft?.id || '');
                  if (!id) throw new Error('建立失敗（缺少 draftId）');
                  onCreatedDraft({ toolType: 'discussion', draftId: id });
                  onClose();
                } catch (e: any) {
                  setError(e?.message || '建立失敗');
                } finally {
                  setLoading(false);
                }
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white font-black border-2 border-blue-700 hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
              disabled={loading}
            >
              <MessageSquare className="w-4 h-4" />
              建立草稿並編輯
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateTaskModal;

