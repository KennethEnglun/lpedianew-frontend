import React, { useState, useEffect } from 'react';
import { Coins, Users, TrendingUp, TrendingDown, Plus, Search, Filter } from 'lucide-react';
import Button from '../../Button';
import Input from '../../Input';
import { StudentPointsStatus, PointsOverview, PointTransaction } from '../types';

interface AdminPointsPanelProps {
  // 這些props將來會連接到實際的API
  studentsPoints: StudentPointsStatus[];
  overview: PointsOverview;
  transactions: PointTransaction[];
  onGrantPoints: (userId: string, amount: number, description?: string) => Promise<void>;
  onBatchGrantPoints: (studentIds: string[], amount: number, description?: string) => Promise<void>;
  onAdjustPoints: (userId: string, newAmount: number, description?: string) => Promise<void>;
}

export default function AdminPointsPanel(props: AdminPointsPanelProps) {
  const { studentsPoints = [], overview, transactions = [], onGrantPoints, onBatchGrantPoints } = props;

  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentPointsStatus | null>(null);
  const [batchAmount, setBatchAmount] = useState(10);
  const [batchDescription, setBatchDescription] = useState('');
  const [grantAmount, setGrantAmount] = useState(5);
  const [grantDescription, setGrantDescription] = useState('');

  // 篩選和搜尋學生
  const filteredStudents = studentsPoints.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.username.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = classFilter === 'all' || student.class === classFilter;
    return matchesSearch && matchesClass;
  });

  // 獲取所有班級選項
  const availableClasses = Array.from(new Set(studentsPoints.map(s => s.class).filter(Boolean)));

  const handleBatchGrant = async () => {
    if (batchAmount <= 0) return;

    const targetStudents = classFilter === 'all'
      ? studentsPoints.map(s => s.userId)
      : studentsPoints.filter(s => s.class === classFilter).map(s => s.userId);

    try {
      await onBatchGrantPoints(targetStudents, batchAmount, batchDescription || `批次分配${batchAmount}點數`);
      setShowBatchModal(false);
      setBatchAmount(10);
      setBatchDescription('');
    } catch (error) {
      console.error('Batch grant failed:', error);
    }
  };

  const handleGrantToStudent = async () => {
    if (!selectedStudent || grantAmount <= 0) return;

    try {
      await onGrantPoints(selectedStudent.userId, grantAmount, grantDescription || `分配${grantAmount}點數`);
      setShowGrantModal(false);
      setSelectedStudent(null);
      setGrantAmount(5);
      setGrantDescription('');
    } catch (error) {
      console.error('Grant failed:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* 點數總覽 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border-4 border-[#E6D2B5] shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#5D4037]">{overview?.totalStudents || 0}</div>
              <div className="text-sm text-gray-600">總學生數</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border-4 border-[#E6D2B5] shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#5D4037]">{overview?.totalPointsDistributed || 0}</div>
              <div className="text-sm text-gray-600">總分配點數</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border-4 border-[#E6D2B5] shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#5D4037]">{overview?.totalPointsUsed || 0}</div>
              <div className="text-sm text-gray-600">總使用點數</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border-4 border-[#E6D2B5] shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <Coins className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#5D4037]">
                {overview?.totalStudents ? Math.round(overview.averagePointsPerStudent || 0) : 0}
              </div>
              <div className="text-sm text-gray-600">平均持有點數</div>
            </div>
          </div>
        </div>
      </div>

      {/* 操作區域 */}
      <div className="bg-white rounded-2xl p-6 border-4 border-[#E6D2B5] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h3 className="text-xl font-bold text-[#5D4037]">學生點數管理</h3>
          <div className="flex gap-2">
            <Button
              className="bg-blue-100 hover:bg-blue-200 text-blue-800 flex items-center gap-2"
              onClick={() => setShowBatchModal(true)}
            >
              <Plus className="w-4 h-4" />
              批次分配
            </Button>
          </div>
        </div>

        {/* 搜尋和篩選 */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="搜尋學生姓名或帳號..."
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
            {availableClasses.map(cls => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        </div>

        {/* 學生點數表格 */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left p-3 font-bold text-[#5D4037]">學生姓名</th>
                <th className="text-left p-3 font-bold text-[#5D4037]">班級</th>
                <th className="text-left p-3 font-bold text-[#5D4037]">帳號</th>
                <th className="text-center p-3 font-bold text-[#5D4037]">可用點數</th>
                <th className="text-center p-3 font-bold text-[#5D4037]">總獲得</th>
                <th className="text-center p-3 font-bold text-[#5D4037]">已使用</th>
                <th className="text-center p-3 font-bold text-[#5D4037]">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.userId} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium text-[#5D4037]">{student.name}</td>
                  <td className="p-3 text-gray-600">{student.class || '-'}</td>
                  <td className="p-3 font-mono text-gray-600">{student.username}</td>
                  <td className="p-3 text-center">
                    <span className={`font-bold ${student.currentPoints > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {student.currentPoints}
                    </span>
                  </td>
                  <td className="p-3 text-center text-blue-600 font-medium">{student.totalReceived}</td>
                  <td className="p-3 text-center text-gray-600">{student.totalUsed}</td>
                  <td className="p-3 text-center">
                    <Button
                      className="bg-green-100 hover:bg-green-200 text-green-800"
                      onClick={() => {
                        setSelectedStudent(student);
                        setShowGrantModal(true);
                      }}
                    >
                      分配
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredStudents.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              沒有找到符合條件的學生
            </div>
          )}
        </div>
      </div>

      {/* 批次分配模態框 */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-[#5D4037] mb-4">批次分配點數</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">目標對象</label>
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                >
                  <option value="all">所有學生</option>
                  {availableClasses.map(cls => (
                    <option key={cls} value={cls}>{cls} 班級</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">每人分配點數</label>
                <Input
                  type="number"
                  min="1"
                  value={batchAmount}
                  onChange={(e) => setBatchAmount(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">分配說明（選填）</label>
                <Input
                  placeholder="例如：月度獎勵點數"
                  value={batchDescription}
                  onChange={(e) => setBatchDescription(e.target.value)}
                />
              </div>

              <div className="text-sm text-gray-600">
                將為 {classFilter === 'all' ? `所有 ${studentsPoints.length}` : `${classFilter} 班級`} 學生分配點數
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                className="flex-1 bg-gray-200 hover:bg-gray-300"
                onClick={() => setShowBatchModal(false)}
              >
                取消
              </Button>
              <Button
                className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                onClick={handleBatchGrant}
              >
                確認分配
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 個別分配模態框 */}
      {showGrantModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-[#5D4037] mb-4">分配點數給學生</h3>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-sm text-gray-600">學生資訊</div>
                <div className="font-bold text-[#5D4037]">{selectedStudent.name}</div>
                <div className="text-sm text-gray-600">{selectedStudent.class} - {selectedStudent.username}</div>
                <div className="text-sm text-blue-600 mt-1">目前持有：{selectedStudent.currentPoints} 點數</div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">分配點數</label>
                <Input
                  type="number"
                  min="1"
                  value={grantAmount}
                  onChange={(e) => setGrantAmount(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">分配說明（選填）</label>
                <Input
                  placeholder="例如：作業表現優秀獎勵"
                  value={grantDescription}
                  onChange={(e) => setGrantDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                className="flex-1 bg-gray-200 hover:bg-gray-300"
                onClick={() => {
                  setShowGrantModal(false);
                  setSelectedStudent(null);
                }}
              >
                取消
              </Button>
              <Button
                className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                onClick={handleGrantToStudent}
              >
                確認分配
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}