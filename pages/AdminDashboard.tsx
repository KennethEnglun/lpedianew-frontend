import React, { useMemo, useState, useEffect } from 'react';
import { Download, Upload, Users, UserPlus, Settings, Eye, Edit3, Trash2, LogOut, ArchiveRestore } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import Button from '../components/Button';
import Input from '../components/Input';
import UiSettingsModal from '../components/UiSettingsModal';
import AssignmentExplorerModal from '../components/AssignmentExplorerModal';
import { useNavigate } from 'react-router-dom';

interface AdminUser {
  id: string;
  username: string;
  role: 'teacher' | 'student' | 'admin';
  name: string;
  email?: string;
  class?: string;
  studentId?: string;
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
  chineseGroup?: string;
  englishGroup?: string;
  mathGroup?: string;
}

const mockUsers: AdminUser[] = [
  {
    id: '1',
    username: 'teacher01',
    role: 'teacher',
    name: '李老師',
    email: 'lee.teacher@school.edu.hk',
    createdAt: '2024-01-15',
    lastLogin: '2024-12-07',
    isActive: true
  },
  {
    id: '2',
    username: 'teacher02',
    role: 'teacher',
    name: '王老師',
    email: 'wang.teacher@school.edu.hk',
    createdAt: '2024-01-15',
    lastLogin: '2024-12-06',
    isActive: true
  },
  {
    id: '3',
    username: 'student001',
    role: 'student',
    name: '張小明',
    class: '4A',
    studentId: '2024001',
    createdAt: '2024-02-01',
    lastLogin: '2024-12-07',
    isActive: true
  },
  {
    id: '4',
    username: 'student002',
    role: 'student',
    name: '李小華',
    class: '4A',
    studentId: '2024002',
    createdAt: '2024-02-01',
    lastLogin: '2024-12-05',
    isActive: true
  },
  {
    id: '5',
    username: 'student003',
    role: 'student',
    name: '陳小美',
    class: '4B',
    studentId: '2024003',
    createdAt: '2024-02-01',
    lastLogin: '2024-12-04',
    isActive: false
  }
];

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [showUiSettings, setShowUiSettings] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filterRole, setFilterRole] = useState<'all' | 'teacher' | 'student'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [folderClassName, setFolderClassName] = useState('');
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderError, setFolderError] = useState('');
  const [classFolders, setClassFolders] = useState<any[]>([]);
  const [yearEndLoading, setYearEndLoading] = useState(false);
  const [yearEndResult, setYearEndResult] = useState<{ archiveId: string; archivedAt: string } | null>(null);
  const [showAssignmentManager, setShowAssignmentManager] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    password: '',
    name: '',
    role: 'student' as 'teacher' | 'student',
    class: '',
    teacherCode: '',
    chineseGroup: '',
    englishGroup: '',
    mathGroup: ''
  });

  // 載入用戶列表
  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const response = await authService.getUsers({
        role: filterRole === 'all' ? undefined : filterRole,
        search: searchTerm || undefined,
        page: 1,
        limit: 100
      });
      // Transform User to AdminUser format
      const adminUsers: AdminUser[] = response.users.map(user => ({
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.profile.name,
        class: user.profile.class,
        createdAt: user.lastLogin ? new Date(user.lastLogin).toISOString().split('T')[0] : '2024-01-01',
        lastLogin: user.lastLogin ? new Date(user.lastLogin).toISOString().split('T')[0] : undefined,
        isActive: user.isActive,
        chineseGroup: user.profile.chineseGroup,
        englishGroup: user.profile.englishGroup,
        mathGroup: user.profile.mathGroup
      }));
      setUsers(adminUsers);
      setError('');
    } catch (err) {
      setError('載入用戶列表失敗');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // 初始載入和搜尋/篩選改變時重新載入
  useEffect(() => {
    loadUsers();
  }, [filterRole, searchTerm]);

  const filteredUsers = users;

  const classOptions = useMemo(() => {
    const set = new Set<string>();
    for (const u of users) {
      if (u.role !== 'student') continue;
      const c = String(u.class || '').trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  }, [users]);

  useEffect(() => {
    if (folderClassName) return;
    if (classOptions.length > 0) setFolderClassName(classOptions[0]);
  }, [classOptions, folderClassName]);

  const folderById = useMemo(() => {
    const map = new Map<string, any>();
    for (const f of classFolders) {
      if (!f) continue;
      map.set(String(f.id), f);
    }
    return map;
  }, [classFolders]);

  const getFolderPath = (folderId: string) => {
    const fid = String(folderId || '').trim();
    if (!fid) return '';
    const path: string[] = [];
    let cur = folderById.get(fid);
    while (cur) {
      path.push(String(cur.name || ''));
      if (!cur.parentId) break;
      cur = folderById.get(String(cur.parentId));
    }
    path.reverse();
    return path.join(' / ');
  };

  const archivedFolders = useMemo(() => {
    return classFolders.filter((f) => f && f.archivedAt);
  }, [classFolders]);

  const loadClassFolders = async (cls: string) => {
    const c = String(cls || '').trim();
    if (!c) return;
    setFolderLoading(true);
    setFolderError('');
    try {
      const resp = await authService.getClassFoldersAdmin(c, { includeArchived: true });
      setClassFolders(Array.isArray(resp.folders) ? resp.folders : []);
    } catch (e: any) {
      setFolderError(e?.message || '載入失敗');
      setClassFolders([]);
    } finally {
      setFolderLoading(false);
    }
  };

  const runYearEndArchive = async () => {
    if (yearEndLoading) return;
    const token = window.prompt('此操作會封存本年度所有學生內容並清空（不可逆）。\n如確定，請輸入「升班」確認：', '');
    if (token !== '升班') return;
    try {
      setYearEndLoading(true);
      setError('');
      const resp = await authService.archiveYearEnd();
      setYearEndResult({ archiveId: resp.archiveId, archivedAt: resp.archivedAt });
      alert(`已封存完成（archiveId: ${resp.archiveId}）`);
    } catch (e: any) {
      setError(e?.message || '年度封存失敗');
    } finally {
      setYearEndLoading(false);
    }
  };

  const exportToCSV = async () => {
    try {
      const headers = ['用戶名', '密碼', '角色', '姓名', '班級', '教師代碼', '中文分組', '英文分組', '數學分組', '狀態'];

      // 使用當前載入的用戶數據而不是靜態數據
      const csvData = users.map(user => [
        user.username,
        '******', // 密碼不顯示實際內容
        user.role === 'teacher' ? '教師' : user.role === 'student' ? '學生' : '管理員',
        user.name,
        user.class || '',
        '', // 教師代碼（如果需要可以添加到 AdminUser 接口）
        user.chineseGroup || '',
        user.englishGroup || '',
        user.mathGroup || '',
        user.isActive ? '啟用' : '停用'
      ]);

      const csvContent = [headers, ...csvData]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      // 添加 UTF-8 BOM 以確保中文正確顯示
      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `lpedia_users_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } catch (error) {
      setError('匯出CSV失敗');
      console.error(error);
    }
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);

      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsText(file, 'utf-8');
      });

      // 移除 BOM 如果存在
      const cleanText = text.replace(/^\uFEFF/, '');
      const lines = cleanText.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        throw new Error('CSV 文件格式無效');
      }

      // 跳過標題行
      const dataLines = lines.slice(1);
      let imported = 0;
      const errors: string[] = [];

      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i].trim();
        if (!line) continue;

        try {
          // 解析CSV行（處理引號包圍的字段）
          const values: string[] = [];
          let currentValue = '';
          let inQuotes = false;
          let j = 0;

          while (j < line.length) {
            const char = line[j];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(currentValue.trim());
              currentValue = '';
            } else {
              currentValue += char;
            }
            j++;
          }
          values.push(currentValue.trim());

          if (values.length < 9) {
            errors.push(`第${i + 2}行：欄位數量不足`);
            continue;
          }

          const [username, password, roleText, name, className, teacherCode, chineseGroup, englishGroup, mathGroup] = values;

          if (!username || !name) {
            errors.push(`第${i + 2}行：用戶名和姓名不能為空`);
            continue;
          }

          const role: 'teacher' | 'student' | null = roleText === '教師' ? 'teacher' : roleText === '學生' ? 'student' : null;
          if (!role) {
            errors.push(`第${i + 2}行：無效的角色 "${roleText}"`);
            continue;
          }

          // 創建新用戶數據
          const userData = {
            username,
            password: password || 'temp123456',
            role,
            profile: {
              name,
              ...(className && { class: className }),
              ...(teacherCode && { teacherCode }),
              ...(chineseGroup && { chineseGroup }),
              ...(englishGroup && { englishGroup }),
              ...(mathGroup && { mathGroup })
            }
          };

          await authService.createUser(userData);
          imported++;

        } catch (error) {
          errors.push(`第${i + 2}行：${error instanceof Error ? error.message : '處理失敗'}`);
        }
      }

      alert(`成功導入 ${imported} 個用戶${errors.length > 0 ? '\\n錯誤：\\n' + errors.slice(0, 5).join('\\n') + (errors.length > 5 ? '\\n...' : '') : ''}`);
      loadUsers(); // 重新載入用戶列表

    } catch (error) {
      setError('CSV導入失敗');
      console.error(error);
    } finally {
      setIsLoading(false);
      // 清除文件輸入
      event.target.value = '';
    }
  };

  const toggleUserStatus = async (userId: string) => {
    try {
      const user = users.find(u => u.id === userId);
      if (!user) return;

      if (user.isActive) {
        await authService.deleteUser(userId, false); // 停用
      } else {
        await authService.activateUser(userId); // 啟用
      }

      loadUsers(); // 重新載入用戶列表
    } catch (error) {
      setError('更新用戶狀態失敗');
      console.error(error);
    }
  };

  const deleteUser = async (userId: string) => {
    if (window.confirm('確定要永久刪除此用戶？此操作無法復原！')) {
      try {
        await authService.deleteUser(userId, true);
        loadUsers(); // 重新載入用戶列表
      } catch (error) {
        setError('刪除用戶失敗');
        console.error(error);
      }
    }
  };

  const handleAddUser = async () => {
    // 驗證必填欄位
    if (!newUserForm.username || !newUserForm.password || !newUserForm.name) {
      setError('請填寫必填欄位：用戶名、密碼和姓名');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      // 準備用戶資料
      const userData = {
        username: newUserForm.username,
        password: newUserForm.password,
        role: newUserForm.role,
        profile: {
          name: newUserForm.name,
          ...(newUserForm.class && { class: newUserForm.class }),
          ...(newUserForm.teacherCode && { teacherCode: newUserForm.teacherCode }),
          ...(newUserForm.chineseGroup && { chineseGroup: newUserForm.chineseGroup }),
          ...(newUserForm.englishGroup && { englishGroup: newUserForm.englishGroup }),
          ...(newUserForm.mathGroup && { mathGroup: newUserForm.mathGroup })
        }
      };

      await authService.createUser(userData);

      // 成功後重置表單和關閉模態框
      setNewUserForm({
        username: '',
        password: '',
        name: '',
        role: 'student',
        class: '',
        teacherCode: '',
        chineseGroup: '',
        englishGroup: '',
        mathGroup: ''
      });
      setShowAddUser(false);
      loadUsers(); // 重新載入用戶列表

      alert('用戶新增成功！');

    } catch (error) {
      setError(error instanceof Error ? error.message : '新增用戶失敗');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setNewUserForm({
      username: '',
      password: '',
      name: '',
      role: 'student',
      class: '',
      teacherCode: '',
      chineseGroup: '',
      englishGroup: '',
      mathGroup: ''
    });
    setError('');
  };

  return (
    <div className="min-h-full bg-gray-50 font-sans">
      {/* Background */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: `url('/teacherpagebg.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />

      {/* Header */}
      <header className="relative z-10 bg-[#A1D9AE] border-b-4 border-brand-brown py-4 px-6 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-4">
          <h1 className="text-4xl font-black text-brand-brown font-rounded">LPedia Admin</h1>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setShowUiSettings(true)}
            className="w-12 h-12 bg-white rounded-full border-2 border-brand-brown shadow-comic flex items-center justify-center hover:scale-105 transition-transform"
            title="介面顯示設定"
          >
            <Settings className="text-brand-brown w-6 h-6" />
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-12 h-12 bg-white rounded-full border-2 border-brand-brown shadow-comic flex items-center justify-center hover:scale-105 transition-transform"
          >
            <Users className="text-brand-brown w-6 h-6" />
          </button>
          <button
            onClick={logout}
            className="w-12 h-12 bg-white rounded-full border-2 border-brand-brown shadow-comic flex items-center justify-center hover:scale-105 transition-transform"
            title="登出"
          >
            <LogOut className="text-brand-brown w-6 h-6" />
          </button>
        </div>
      </header>

      <UiSettingsModal open={showUiSettings} onClose={() => setShowUiSettings(false)} />
      <AssignmentExplorerModal
        open={showAssignmentManager}
        onClose={() => setShowAssignmentManager(false)}
        authService={authService}
        viewerRole="admin"
        viewerId="admin"
      />

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto p-6">

        {/* Control Panel */}
        <div className="bg-white border-4 border-brand-brown rounded-3xl p-6 mb-6 shadow-comic">
          <h2 className="text-2xl font-bold text-brand-brown mb-4">帳號管理中心</h2>

          <div className="flex flex-wrap gap-4 items-end">
            {/* Search */}
            <div className="flex-1 min-w-64">
              <Input
                placeholder="搜尋用戶名、姓名或學生號..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Role Filter */}
            <div>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value as any)}
                className="px-4 py-2 border-4 border-brand-brown rounded-2xl bg-white font-bold"
              >
                <option value="all">所有用戶</option>
                <option value="teacher">教師</option>
                <option value="student">學生</option>
              </select>
            </div>

            {/* Action Buttons */}
            <Button
              className="bg-[#B5F8CE] hover:bg-[#A1E5B8] flex items-center gap-2"
              onClick={() => setShowAddUser(true)}
            >
              <UserPlus className="w-4 h-4" />
              新增用戶
            </Button>

            <Button
              className="bg-[#F8E2B5] hover:bg-[#F4D490] flex items-center gap-2"
              onClick={exportToCSV}
            >
              <Download className="w-4 h-4" />
              匯出CSV
            </Button>

            <div className="relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleImportCSV}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button className="bg-[#D2B5F8] hover:bg-[#C4A1F0] flex items-center gap-2">
                <Upload className="w-4 h-4" />
                匯入CSV
              </Button>
            </div>
          </div>
        </div>

        {/* Year End */}
        <div className="bg-white border-4 border-brand-brown rounded-3xl p-6 mb-6 shadow-comic">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-brand-brown">年度操作</h2>
              <div className="text-sm text-gray-600 font-bold mt-1">
                「升班」會封存本年度所有學生內容並清空（可在後端 data/year_archives 找到封存檔）。
              </div>
              {yearEndResult && (
                <div className="text-xs text-gray-600 font-bold mt-2">
                  最近一次封存：{yearEndResult.archiveId}（{yearEndResult.archivedAt}）
                </div>
              )}
            </div>
            <Button
              className="bg-red-100 hover:bg-red-200 text-red-800 flex items-center gap-2"
              onClick={() => void runYearEndArchive()}
              disabled={yearEndLoading}
            >
              {yearEndLoading ? '封存中...' : '升班（封存本年度）'}
            </Button>
          </div>
        </div>

        {/* Assignment Management */}
        <div className="bg-white border-4 border-brand-brown rounded-3xl p-6 mb-6 shadow-comic">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-brand-brown">作業管理</h2>
              <div className="text-sm text-gray-600 font-bold mt-1">
                以「科目 → 班別 → 學段 → 課題 → 任務」瀏覽；管理員可查看、刪除及封存。
              </div>
            </div>
            <Button
              className="bg-[#B5D8F8] hover:bg-[#A1CCF0] flex items-center gap-2"
              onClick={() => setShowAssignmentManager(true)}
            >
              開啟作業管理
            </Button>
          </div>
        </div>

        {/* Archived Class Folders */}
        <div className="bg-white border-4 border-brand-brown rounded-3xl p-6 mb-6 shadow-comic">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-2xl font-bold text-brand-brown">班級資料夾（封存）</h2>
            <div className="flex items-center gap-3">
              <label className="font-bold text-brand-brown">班別</label>
              <select
                className="px-4 py-2 border-4 border-brand-brown rounded-2xl bg-white font-bold"
                value={folderClassName}
                onChange={(e) => setFolderClassName(e.target.value)}
                disabled={classOptions.length === 0}
              >
                {classOptions.length === 0 ? (
                  <option value="">（未有班別）</option>
                ) : (
                  classOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))
                )}
              </select>
              <Button
                className="bg-[#E8F5E9] hover:bg-[#C8E6C9] flex items-center gap-2"
                onClick={() => void loadClassFolders(folderClassName)}
                disabled={!folderClassName || folderLoading}
              >
                <ArchiveRestore className="w-4 h-4" />
                {folderLoading ? '載入中...' : '載入封存資料夾'}
              </Button>
            </div>
          </div>

          {folderError && (
            <div className="mb-3 text-red-700 font-bold">{folderError}</div>
          )}

          {archivedFolders.length === 0 ? (
            <div className="text-gray-600 font-bold">
              目前沒有封存資料夾
            </div>
          ) : (
            <div className="space-y-2">
              {archivedFolders
                .slice()
                .sort((a, b) => {
                  const la = Number(a.level) || 0;
                  const lb = Number(b.level) || 0;
                  if (la !== lb) return la - lb;
                  return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
                })
                .map((f: any) => {
                  const level = Number(f.level);
                  const label = level === 1 ? '學段' : level === 2 ? '課題' : level === 3 ? '子folder' : '資料夾';
                  const path = getFolderPath(String(f.id));
                  return (
                    <div key={String(f.id)} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border-2 border-gray-200 bg-gray-50">
                      <div className="min-w-0">
                        <div className="font-black text-brand-brown">
                          {label}：{String(f.name || '')}
                        </div>
                        <div className="text-xs text-gray-600 font-bold break-words">
                          路徑：{path || String(f.name || '')}
                        </div>
                        <div className="text-xs text-gray-500 font-bold">
                          封存時間：{String(f.archivedAt || '')}
                        </div>
                      </div>
                      <Button
                        className="bg-[#B5D8F8] hover:bg-[#A1CCF0] flex items-center gap-2"
                        onClick={async () => {
                          if (!folderClassName) return;
                          if (!window.confirm('確定要復原此資料夾及其子層嗎？')) return;
                          try {
                            setFolderLoading(true);
                            await authService.restoreClassFolder(folderClassName, String(f.id));
                            await loadClassFolders(folderClassName);
                          } catch (e: any) {
                            setFolderError(e?.message || '復原失敗');
                          } finally {
                            setFolderLoading(false);
                          }
                        }}
                        disabled={folderLoading || !folderClassName}
                      >
                        <ArchiveRestore className="w-4 h-4" />
                        復原
                      </Button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Users Table */}
        <div className="bg-white border-4 border-brand-brown rounded-3xl p-6 shadow-comic">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-brand-brown">
              用戶列表 ({filteredUsers.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-brand-brown">
                  <th className="text-left py-3 px-4 font-bold text-brand-brown">用戶名</th>
                  <th className="text-left py-3 px-4 font-bold text-brand-brown">角色</th>
                  <th className="text-left py-3 px-4 font-bold text-brand-brown">姓名</th>
                  <th className="text-left py-3 px-4 font-bold text-brand-brown">班級</th>
                  <th className="text-left py-3 px-4 font-bold text-brand-brown">分組情況</th>
                  <th className="text-left py-3 px-4 font-bold text-brand-brown">最後登入</th>
                  <th className="text-left py-3 px-4 font-bold text-brand-brown">狀態</th>
                  <th className="text-left py-3 px-4 font-bold text-brand-brown">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user: AdminUser) => (
                  <tr key={user.id} className="border-b border-gray-200 hover:bg-gray-50">
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
                    <td className="py-3 px-4">
                      {user.class || 'N/A'}
                    </td>
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
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {user.lastLogin || '從未登入'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        user.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.isActive ? '啟用' : '停用'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button
                          className="p-1 hover:bg-gray-200 rounded"
                          title="查看詳情"
                        >
                          <Eye className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          className="p-1 hover:bg-gray-200 rounded"
                          title="編輯用戶"
                        >
                          <Edit3 className="w-4 h-4 text-blue-600" />
                        </button>
                        <button
                          onClick={() => toggleUserStatus(user.id)}
                          className="p-1 hover:bg-gray-200 rounded"
                          title={user.isActive ? '停用用戶' : '啟用用戶'}
                        >
                          <Settings className={`w-4 h-4 ${user.isActive ? 'text-orange-600' : 'text-green-600'}`} />
                        </button>
                        <button
                          onClick={() => deleteUser(user.id)}
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

          {filteredUsers.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              沒有找到符合條件的用戶
            </div>
          )}
        </div>

      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-brand-brown rounded-3xl p-6 w-full max-w-md shadow-comic">
            <h3 className="text-xl font-bold text-brand-brown mb-4">新增用戶</h3>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <Input
                placeholder="用戶名"
                value={newUserForm.username}
                onChange={(e) => setNewUserForm({...newUserForm, username: e.target.value})}
              />
              <Input
                placeholder="密碼"
                type="password"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})}
              />
              <Input
                placeholder="姓名"
                value={newUserForm.name}
                onChange={(e) => setNewUserForm({...newUserForm, name: e.target.value})}
              />
              <select
                className="w-full px-4 py-2 border-4 border-brand-brown rounded-2xl bg-white font-bold"
                value={newUserForm.role}
                onChange={(e) => setNewUserForm({...newUserForm, role: e.target.value as 'teacher' | 'student'})}
              >
                <option value="student">學生</option>
                <option value="teacher">教師</option>
              </select>
              {newUserForm.role === 'student' && (
                <>
                  <Input
                    placeholder="班級"
                    value={newUserForm.class}
                    onChange={(e) => setNewUserForm({...newUserForm, class: e.target.value})}
                  />
                  <Input
                    placeholder="中文分組"
                    value={newUserForm.chineseGroup}
                    onChange={(e) => setNewUserForm({...newUserForm, chineseGroup: e.target.value})}
                  />
                  <Input
                    placeholder="英文分組"
                    value={newUserForm.englishGroup}
                    onChange={(e) => setNewUserForm({...newUserForm, englishGroup: e.target.value})}
                  />
                  <Input
                    placeholder="數學分組"
                    value={newUserForm.mathGroup}
                    onChange={(e) => setNewUserForm({...newUserForm, mathGroup: e.target.value})}
                  />
                </>
              )}
              {newUserForm.role === 'teacher' && (
                <Input
                  placeholder="教師代碼"
                  value={newUserForm.teacherCode}
                  onChange={(e) => setNewUserForm({...newUserForm, teacherCode: e.target.value})}
                />
              )}
            </div>

            <div className="flex gap-4 mt-6">
              <Button
                fullWidth
                className="bg-gray-300 hover:bg-gray-400"
                onClick={() => {
                  resetForm();
                  setShowAddUser(false);
                }}
                disabled={isLoading}
              >
                取消
              </Button>
              <Button
                fullWidth
                className="bg-[#B5F8CE] hover:bg-[#A1E5B8]"
                onClick={handleAddUser}
                disabled={isLoading}
              >
                {isLoading ? '新增中...' : '新增'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
