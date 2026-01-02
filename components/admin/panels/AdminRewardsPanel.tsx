import React, { useMemo, useState } from 'react';
import { Coins, Plus, Search, Trash2 } from 'lucide-react';
import Input from '../../Input';
import Button from '../../Button';
import type { RewardsOverview, StudentRewardsStatus } from '../types';
import { compareClassCode, compareStudentId } from '../../../utils/studentSort';

type Props = {
  students: StudentRewardsStatus[];
  overview: RewardsOverview;
  loading?: boolean;
  onReload: () => Promise<void>;
  onGrant: (userId: string, amount: number, description?: string) => Promise<void>;
  onBatchGrant: (studentIds: string[], amount: number, description?: string) => Promise<void>;
  onAdjust: (userId: string, newAmount: number, description?: string) => Promise<void>;
};

export default function AdminRewardsPanel(props: Props) {
  const { students, overview, loading, onReload, onGrant, onBatchGrant, onAdjust } = props;

  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentRewardsStatus | null>(null);

  const [batchAmount, setBatchAmount] = useState(10);
  const [batchDescription, setBatchDescription] = useState('');

  const [grantAmount, setGrantAmount] = useState(10);
  const [grantDescription, setGrantDescription] = useState('');

  const availableClasses = useMemo(() => {
    const list = Array.from(new Set(students.map((s) => String(s.class || '')).filter(Boolean)));
    return list.sort(compareClassCode);
  }, [students]);

  const filteredStudents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return students
      .filter((s) => {
        const matchesClass = classFilter === 'all' || String(s.class || '') === classFilter;
        if (!matchesClass) return false;
        if (!q) return true;
        return (
          String(s.name || '').toLowerCase().includes(q) ||
          String(s.username || '').toLowerCase().includes(q) ||
          String(s.studentId || '').toLowerCase().includes(q)
        );
      })
      .slice()
      .sort((a, b) =>
        compareClassCode(a.class, b.class) ||
        compareStudentId(a.studentId, b.studentId) ||
        String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant')
      );
  }, [students, searchTerm, classFilter]);

  const handleBatchGrant = async () => {
    const amt = Math.floor(Number(batchAmount));
    if (!Number.isFinite(amt) || amt <= 0) return;

    const targetStudents = classFilter === 'all'
      ? students.map((s) => s.userId)
      : students.filter((s) => String(s.class || '') === classFilter).map((s) => s.userId);

    if (targetStudents.length === 0) return;

    await onBatchGrant(targetStudents, amt, batchDescription || `管理員批次加分 ${amt}`);
    setShowBatchModal(false);
    setBatchAmount(10);
    setBatchDescription('');
    await onReload();
  };

  const handleGrantToStudent = async () => {
    if (!selectedStudent) return;
    const amt = Math.floor(Number(grantAmount));
    if (!Number.isFinite(amt) || amt <= 0) return;
    await onGrant(selectedStudent.userId, amt, grantDescription || `管理員加分 ${amt}`);
    setShowGrantModal(false);
    setSelectedStudent(null);
    setGrantAmount(10);
    setGrantDescription('');
    await onReload();
  };

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border-4 border-[#E6D2B5] shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Coins className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#5D4037]">{overview.totalStudents}</div>
              <div className="text-sm text-gray-600">總學生數</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border-4 border-[#E6D2B5] shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Plus className="w-6 h-6 text-green-700" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#5D4037]">{overview.totalPointsDistributed}</div>
              <div className="text-sm text-gray-600">總獲得</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border-4 border-[#E6D2B5] shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-red-700" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#5D4037]">{overview.totalPointsUsed}</div>
              <div className="text-sm text-gray-600">總消耗</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border-4 border-[#E6D2B5] shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <Coins className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#5D4037]">{Math.round(overview.averagePointsPerStudent)}</div>
              <div className="text-sm text-gray-600">平均積分</div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h3 className="text-xl font-bold text-[#5D4037]">學生獎勵積分管理</h3>
          <div className="flex gap-2">
            <Button
              className="bg-blue-100 hover:bg-blue-200 text-blue-800 flex items-center gap-2"
              onClick={() => setShowBatchModal(true)}
              disabled={!!loading}
            >
              <Plus className="w-4 h-4" />
              批次加分
            </Button>
            <Button
              className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-800"
              onClick={() => void onReload()}
              disabled={!!loading}
            >
              重新載入
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="搜尋學生姓名、帳號或學號..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-xl bg-white font-bold min-w-32"
          >
            <option value="all">所有班級</option>
            {availableClasses.map((cls) => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left p-3 font-bold text-[#5D4037]">學生姓名</th>
                <th className="text-left p-3 font-bold text-[#5D4037]">班級</th>
                <th className="text-left p-3 font-bold text-[#5D4037]">學號</th>
                <th className="text-left p-3 font-bold text-[#5D4037]">帳號</th>
                <th className="text-center p-3 font-bold text-[#5D4037]">目前積分</th>
                <th className="text-center p-3 font-bold text-[#5D4037]">總獲得</th>
                <th className="text-center p-3 font-bold text-[#5D4037]">總消耗</th>
                <th className="text-center p-3 font-bold text-[#5D4037]">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.userId} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium text-[#5D4037]">{student.name}</td>
                  <td className="p-3 text-gray-600">{student.class || '-'}</td>
                  <td className="p-3 text-gray-600">{student.studentId || '-'}</td>
                  <td className="p-3 font-mono text-gray-600">{student.username}</td>
                  <td className="p-3 text-center">
                    <span className={`font-bold ${student.currentPoints > 0 ? 'text-green-700' : 'text-gray-500'}`}>
                      {student.currentPoints}
                    </span>
                  </td>
                  <td className="p-3 text-center text-blue-700 font-medium">{student.totalReceived}</td>
                  <td className="p-3 text-center text-gray-600">{student.totalUsed}</td>
                  <td className="p-3 text-center">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button
                        className="bg-green-100 hover:bg-green-200 text-green-800"
                        onClick={() => {
                          setSelectedStudent(student);
                          setShowGrantModal(true);
                        }}
                        disabled={!!loading}
                      >
                        加分
                      </Button>
                      <Button
                        className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-800"
                        disabled={!!loading}
                        onClick={async () => {
                          const raw = window.prompt(`設定 ${student.name} 的獎勵積分為（目前 ${student.currentPoints}）`, String(student.currentPoints));
                          if (raw === null) return;
                          const next = Number(raw);
                          if (!Number.isFinite(next) || next < 0) {
                            window.alert('積分必須是 0 或以上數字');
                            return;
                          }
                          const desc = window.prompt('改分原因（可留空）', '管理員改分') || undefined;
                          await onAdjust(student.userId, Math.floor(next), desc);
                          await onReload();
                        }}
                      >
                        改分
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredStudents.length === 0 && (
            <div className="text-center py-8 text-gray-500 font-bold">
              沒有找到符合條件的學生
            </div>
          )}
        </div>
      </div>

      {/* Batch modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-[#5D4037] mb-4">批次加分（獎勵積分）</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">目標班級</label>
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                >
                  <option value="all">所有學生</option>
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">每人加分</label>
                <Input
                  type="number"
                  value={batchAmount}
                  onChange={(e) => setBatchAmount(Number((e.target as any).value))}
                  min={1}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">說明（可選）</label>
                <Input
                  value={batchDescription}
                  onChange={(e) => setBatchDescription(e.target.value)}
                  placeholder="例如：課堂表現優秀"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700"
                onClick={() => setShowBatchModal(false)}
                disabled={!!loading}
              >
                取消
              </Button>
              <Button
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                onClick={() => void handleBatchGrant()}
                disabled={!!loading}
              >
                確認加分
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Single grant modal */}
      {showGrantModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-[#5D4037] mb-2">加分（獎勵積分）</h3>
            <div className="text-sm text-gray-600 font-bold mb-4">
              {selectedStudent.name}（{selectedStudent.class || '-'} {selectedStudent.studentId || ''}）
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">加分數量</label>
                <Input
                  type="number"
                  value={grantAmount}
                  onChange={(e) => setGrantAmount(Number((e.target as any).value))}
                  min={1}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">說明（可選）</label>
                <Input
                  value={grantDescription}
                  onChange={(e) => setGrantDescription(e.target.value)}
                  placeholder="例如：功課表現優秀"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700"
                onClick={() => {
                  setShowGrantModal(false);
                  setSelectedStudent(null);
                }}
                disabled={!!loading}
              >
                取消
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => void handleGrantToStudent()}
                disabled={!!loading}
              >
                確認加分
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

