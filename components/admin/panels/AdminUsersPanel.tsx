import React from 'react';
import { Download, Edit3, Eye, Settings, Trash2, Upload, UserPlus } from 'lucide-react';
import Button from '../../Button';
import Input from '../../Input';
import type { AdminUser, UserRoleFilter } from '../types';

export default function AdminUsersPanel(props: {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filterRole: UserRoleFilter;
  setFilterRole: (v: UserRoleFilter) => void;
  users: AdminUser[];
  onOpenAddUser: () => void;
  onExportCSV: () => void;
  onImportCSVFile: (file: File) => void;
  onViewUser: (userId: string) => void;
  onEditUser: (userId: string) => void;
  onToggleUserStatus: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
}) {
  const {
    searchTerm,
    setSearchTerm,
    filterRole,
    setFilterRole,
    users,
    onOpenAddUser,
    onExportCSV,
    onImportCSVFile,
    onViewUser,
    onEditUser,
    onToggleUserStatus,
    onDeleteUser
  } = props;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="text-lg font-black text-brand-brown mb-3">帳號管理</div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-64">
            <Input
              placeholder="搜尋用戶名、姓名或學生號..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as UserRoleFilter)}
              className="px-4 py-2 border border-gray-300 rounded-xl bg-white font-bold"
            >
              <option value="all">所有用戶</option>
              <option value="teacher">教師</option>
              <option value="student">學生</option>
            </select>
          </div>

          <Button className="bg-[#B5F8CE] hover:bg-[#A1E5B8] flex items-center gap-2" onClick={onOpenAddUser}>
            <UserPlus className="w-4 h-4" />
            新增用戶
          </Button>

          <Button className="bg-[#F8E2B5] hover:bg-[#F4D490] flex items-center gap-2" onClick={onExportCSV}>
            <Download className="w-4 h-4" />
            匯出CSV
          </Button>

          <div className="relative">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                onImportCSVFile(file);
                e.target.value = '';
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Button className="bg-[#D2B5F8] hover:bg-[#C4A1F0] flex items-center gap-2">
              <Upload className="w-4 h-4" />
              匯入CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-black text-brand-brown">
            用戶列表 ({users.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-bold text-gray-700">用戶名</th>
                <th className="text-left py-3 px-4 font-bold text-gray-700">角色</th>
                <th className="text-left py-3 px-4 font-bold text-gray-700">姓名</th>
                <th className="text-left py-3 px-4 font-bold text-gray-700">班級</th>
                <th className="text-left py-3 px-4 font-bold text-gray-700">分組情況</th>
                <th className="text-left py-3 px-4 font-bold text-gray-700">最後登入</th>
                <th className="text-left py-3 px-4 font-bold text-gray-700">狀態</th>
                <th className="text-left py-3 px-4 font-bold text-gray-700">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono text-sm">{user.username}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      user.role === 'teacher'
                        ? 'bg-blue-100 text-blue-800'
                        : user.role === 'admin'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {user.role === 'teacher' ? '教師' : user.role === 'admin' ? '管理員' : '學生'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold">{user.name}</td>
                  <td className="py-3 px-4">{user.class || 'N/A'}</td>
                  <td className="py-3 px-4 text-sm">
                    {user.role === 'student' ? (
                      <div className="space-y-1">
                        {user.chineseGroup && <div>中文: {user.chineseGroup}</div>}
                        {user.englishGroup && <div>英文: {user.englishGroup}</div>}
                        {user.mathGroup && <div>數學: {user.mathGroup}</div>}
                        {!user.chineseGroup && !user.englishGroup && !user.mathGroup && 'N/A'}
                      </div>
                    ) : 'N/A'}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">{user.lastLogin || '從未登入'}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.isActive ? '啟用' : '停用'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button
                        className="p-1 hover:bg-gray-200 rounded"
                        title="查看詳情"
                        onClick={() => onViewUser(user.id)}
                      >
                        <Eye className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        className="p-1 hover:bg-gray-200 rounded"
                        title="編輯用戶"
                        onClick={() => onEditUser(user.id)}
                      >
                        <Edit3 className="w-4 h-4 text-blue-600" />
                      </button>
                      <button
                        onClick={() => onToggleUserStatus(user.id)}
                        className="p-1 hover:bg-gray-200 rounded"
                        title={user.isActive ? '停用用戶' : '啟用用戶'}
                      >
                        <Settings className={`w-4 h-4 ${user.isActive ? 'text-orange-600' : 'text-green-600'}`} />
                      </button>
                      <button
                        onClick={() => onDeleteUser(user.id)}
                        className="p-1 hover:bg-gray-200 rounded"
                        title="刪除用戶"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="text-center py-12 text-gray-500 font-bold">
            沒有找到符合條件的用戶
          </div>
        )}
      </div>
    </div>
  );
}

