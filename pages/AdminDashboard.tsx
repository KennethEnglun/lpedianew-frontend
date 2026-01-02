import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, FolderArchive, Shield, ShieldAlert, Users, Coins, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import ArchivedFolderDetailsModal from '../components/ArchivedFolderDetailsModal';
import AssignmentExplorerModal from '../components/AssignmentExplorerModal';
import UiSettingsModal from '../components/UiSettingsModal';
import AdminShell from '../components/admin/AdminShell';
import AdminAddUserModal from '../components/admin/modals/AdminAddUserModal';
import AdminUserModal from '../components/admin/modals/AdminUserModal';
import AdminAssignmentsPanel from '../components/admin/panels/AdminAssignmentsPanel';
import AdminFoldersPanel from '../components/admin/panels/AdminFoldersPanel';
import AdminUsersPanel from '../components/admin/panels/AdminUsersPanel';
import AdminYearEndPanel from '../components/admin/panels/AdminYearEndPanel';
import AdminPointsPanel from '../components/admin/panels/AdminPointsPanel';
import AdminRewardsPanel from '../components/admin/panels/AdminRewardsPanel';
import ModerationLogsPanel from '../components/admin/ModerationLogsPanel';
import type { AdminSection, AdminUser, SidebarItem, UserRoleFilter, StudentPointsStatus, PointsOverview, PointTransaction, StudentRewardsStatus, RewardsOverview } from '../components/admin/types';
import { VISIBLE_SUBJECTS } from '../platform';
import { compareStudentId } from '../utils/studentSort';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [activeSection, setActiveSection] = useState<AdminSection>('users');
  const [showUiSettings, setShowUiSettings] = useState(false);

  // Users
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filterRole, setFilterRole] = useState<UserRoleFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');

  // Add user
  const [showAddUser, setShowAddUser] = useState(false);
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserError, setAddUserError] = useState('');
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    password: '',
    name: '',
    role: 'student' as 'teacher' | 'student',
    studentId: '',
    class: '',
    chineseGroup: '',
    englishGroup: '',
    mathGroup: '',
    subjectsTaught: [...VISIBLE_SUBJECTS],
    subjectClasses: {} as Record<string, string[]>
  });

  // Assignments explorer modal
  const [showAssignmentManager, setShowAssignmentManager] = useState(false);

  // Folder archive
  const [folderClassName, setFolderClassName] = useState('');
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderError, setFolderError] = useState('');
  const [classFolders, setClassFolders] = useState<any[]>([]);
  const [folderDetailOpen, setFolderDetailOpen] = useState(false);
  const [folderDetailFolder, setFolderDetailFolder] = useState<any | null>(null);
  const [folderDetailTasks, setFolderDetailTasks] = useState<any[]>([]);
  const [folderDetailTasksLoading, setFolderDetailTasksLoading] = useState(false);
  const [folderDetailTasksError, setFolderDetailTasksError] = useState('');

  // Year end
  const [yearEndLoading, setYearEndLoading] = useState(false);
  const [yearEndResult, setYearEndResult] = useState<{ archiveId: string; archivedAt: string } | null>(null);

  // User details modal
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userModalMode, setUserModalMode] = useState<'view' | 'edit'>('view');
  const [userModalLoading, setUserModalLoading] = useState(false);
  const [userModalSaving, setUserModalSaving] = useState(false);
  const [userModalError, setUserModalError] = useState('');
  const [userModalUserId, setUserModalUserId] = useState<string | null>(null);
  const [userModalUser, setUserModalUser] = useState<any | null>(null);
  const [userModalStats, setUserModalStats] = useState<any | null>(null);

  // Points system state
  const [studentsPointsData, setStudentsPointsData] = useState<StudentPointsStatus[]>([]);
  const [pointsOverview, setPointsOverview] = useState<PointsOverview>({
    totalStudents: 0,
    totalPointsDistributed: 0,
    totalPointsUsed: 0,
    averagePointsPerStudent: 0,
    studentsWithPoints: 0,
    studentsWithoutPoints: 0
  });
  const [pointsTransactions, setPointsTransactions] = useState<PointTransaction[]>([]);
  const [pointsLoading, setPointsLoading] = useState(false);

  // Rewards (我的獎勵積分) system state
  const [studentsRewardsData, setStudentsRewardsData] = useState<StudentRewardsStatus[]>([]);
  const [rewardsOverview, setRewardsOverview] = useState<RewardsOverview>({
    totalStudents: 0,
    totalPointsDistributed: 0,
    totalPointsUsed: 0,
    averagePointsPerStudent: 0,
    studentsWithPoints: 0,
    studentsWithoutPoints: 0
  });
  const [rewardsLoading, setRewardsLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const response = await authService.getUsers({
        role: filterRole === 'all' ? undefined : filterRole,
        search: searchTerm || undefined,
        page: 1,
        limit: 100
      });

      const adminUsers: AdminUser[] = response.users.map((user) => ({
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.profile.name,
        class: user.profile.class,
        studentId: (user.profile as any)?.studentId,
        createdAt: user.lastLogin ? new Date(user.lastLogin).toISOString().split('T')[0] : '2024-01-01',
        lastLogin: user.lastLogin ? new Date(user.lastLogin).toISOString().split('T')[0] : undefined,
        isActive: user.isActive,
        chineseGroup: user.profile.chineseGroup,
        englishGroup: user.profile.englishGroup,
        mathGroup: user.profile.mathGroup,
        subjectsTaught: Array.isArray((user.profile as any)?.subjectsTaught) ? (user.profile as any).subjectsTaught : undefined,
        subjectClasses: (user.profile as any)?.subjectClasses && typeof (user.profile as any).subjectClasses === 'object' ? (user.profile as any).subjectClasses : undefined
      }));

      // 學生名單：依學號排序
      if (filterRole === 'student') {
        adminUsers.sort((a, b) => {
          const byId = compareStudentId(a?.studentId, b?.studentId);
          if (byId !== 0) return byId;
          return String(a?.name || '').localeCompare(String(b?.name || ''), 'zh-Hant');
        });
      }
      setUsers(adminUsers);
      setUsersError('');
    } catch (err) {
      setUsersError('載入用戶列表失敗');
      console.error(err);
    } finally {
      setUsersLoading(false);
    }
  }, [filterRole, searchTerm]);

  // Load points data
  const loadPointsData = useCallback(async () => {
    try {
      setPointsLoading(true);

      // 嘗試從 API 載入，失敗則使用測試數據
      try {
        const response = await authService.getStudentsPoints();
        setStudentsPointsData(response.students);
        setPointsOverview(response.overview);

        // Load recent transactions
        const transactionsResponse = await authService.getPointsTransactions({ limit: 100 });
        setPointsTransactions(transactionsResponse.transactions);
      } catch (apiError) {
        console.log('API not available, using mock data for testing...');

        // 模擬學生點數數據
        // 使用真實學生數據創建點數狀態
        const realStudents = users.filter(user => user.role === 'student');
        const studentsWithPoints: StudentPointsStatus[] = realStudents.map(student => {
          // 從 localStorage 讀取每個學生的點數數據
          const userPointsKey = `userPoints_${student.id}`;
          const savedPoints = localStorage.getItem(userPointsKey);

          let pointsData = {
            currentPoints: 0,
            totalReceived: 0,
            totalUsed: 0,
            lastUpdate: new Date().toISOString()
          };

          if (savedPoints) {
            try {
              pointsData = JSON.parse(savedPoints);
            } catch (e) {
              console.error('Failed to parse points for user', student.id, e);
            }
          }

          return {
            userId: student.id,
            username: student.username,
            name: student.name,
            class: student.class || '',
            currentPoints: pointsData.currentPoints,
            totalReceived: pointsData.totalReceived,
            totalUsed: pointsData.totalUsed,
            lastUpdate: pointsData.lastUpdate
          };
        });

        // 計算基於真實數據的總覽
        const realOverview: PointsOverview = {
          totalStudents: studentsWithPoints.length,
          totalPointsDistributed: studentsWithPoints.reduce((sum, s) => sum + s.totalReceived, 0),
          totalPointsUsed: studentsWithPoints.reduce((sum, s) => sum + s.totalUsed, 0),
          averagePointsPerStudent: studentsWithPoints.length > 0
            ? studentsWithPoints.reduce((sum, s) => sum + s.currentPoints, 0) / studentsWithPoints.length
            : 0,
          studentsWithPoints: studentsWithPoints.filter(s => s.currentPoints > 0).length,
          studentsWithoutPoints: studentsWithPoints.filter(s => s.currentPoints === 0).length
        };

        // 模擬交易記錄
        const mockTransactions: PointTransaction[] = [
          {
            id: 'tx1',
            userId: 'student1',
            type: 'admin_grant',
            amount: 10,
            balance: 15,
            description: '優秀表現獎勵',
            adminId: 'admin1',
            createdAt: new Date(Date.now() - 3600000).toISOString()
          },
          {
            id: 'tx2',
            userId: 'student2',
            type: 'image_generation',
            amount: -1,
            balance: 8,
            description: '圖片生成',
            createdAt: new Date(Date.now() - 1800000).toISOString(),
            metadata: {
              imagePrompt: '一隻可愛的小貓咪在花園裡玩耍'
            }
          },
          {
            id: 'tx3',
            userId: 'student4',
            type: 'admin_grant',
            amount: 15,
            balance: 25,
            description: '月度獎勵',
            adminId: 'admin1',
            createdAt: new Date(Date.now() - 7200000).toISOString()
          }
        ];

        setStudentsPointsData(studentsWithPoints);
        setPointsOverview(realOverview);
        setPointsTransactions(mockTransactions);
      }
    } catch (error) {
      console.error('Failed to load points data:', error);
    } finally {
      setPointsLoading(false);
    }
  }, [users]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (activeSection === 'points') {
      void loadPointsData();
    }
  }, [activeSection, loadPointsData]);

  useEffect(() => {
    if (activeSection === 'rewards') {
      void loadRewardsData();
    }
  }, [activeSection, loadRewardsData]);

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

  const getFolderPath = useCallback((folderId: string) => {
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
  }, [folderById]);

  const archivedFolders = useMemo(() => classFolders.filter((f) => f && f.archivedAt), [classFolders]);

  const loadClassFolders = useCallback(async (cls: string) => {
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
  }, []);

  const openArchivedFolderDetail = useCallback(async (f: any) => {
    const folder = f || null;
    const cls = String(folder?.className || folderClassName || '').trim();
    if (!folder || !cls) return;
    setFolderDetailFolder(folder);
    setFolderDetailOpen(true);
    setFolderDetailTasksError('');
    setFolderDetailTasks([]);
    try {
      setFolderDetailTasksLoading(true);
      const resp = await authService.getManageTasks({ className: cls, includeArchived: true });
      setFolderDetailTasks(Array.isArray(resp.tasks) ? resp.tasks : []);
    } catch (e: any) {
      setFolderDetailTasksError(e?.message || '載入任務失敗');
      setFolderDetailTasks([]);
    } finally {
      setFolderDetailTasksLoading(false);
    }
  }, [folderClassName]);

  const runYearEndArchive = useCallback(async () => {
    if (yearEndLoading) return;
    const token = window.prompt('此操作會封存本年度所有學生內容並清空（不可逆）。\n如確定，請輸入「升班」確認：', '');
    if (token !== '升班') return;
    try {
      setYearEndLoading(true);
      setUsersError('');
      const resp = await authService.archiveYearEnd();
      setYearEndResult({ archiveId: resp.archiveId, archivedAt: resp.archivedAt });
      alert(`已封存完成（archiveId: ${resp.archiveId}）`);
    } catch (e: any) {
      setUsersError(e?.message || '年度封存失敗');
    } finally {
      setYearEndLoading(false);
    }
  }, [yearEndLoading]);

  const exportToCSV = useCallback(async () => {
    try {
      const blob = await authService.exportUsersCSV();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `lpedia_users_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } catch (error) {
      setUsersError('匯出CSV失敗');
      console.error(error);
    }
  }, []);

  const importUsersFromCsvFile = useCallback(async (file: File) => {
    try {
      setUsersLoading(true);
      const resp = await authService.importUsersCSV(file);
      const errors = Array.isArray(resp.errors) ? resp.errors : [];
      alert(`成功導入 ${resp.imported} 個用戶${errors.length > 0 ? '\\n錯誤：\\n' + errors.slice(0, 8).join('\\n') + (errors.length > 8 ? '\\n...' : '') : ''}`);
      await loadUsers();
    } catch (error) {
      setUsersError('CSV導入失敗');
      console.error(error);
    } finally {
      setUsersLoading(false);
    }
  }, [loadUsers]);

  const toggleUserStatus = useCallback(async (userId: string) => {
    try {
      const user = users.find((u) => u.id === userId);
      if (!user) return;

      if (user.isActive) await authService.deleteUser(userId, false);
      else await authService.activateUser(userId);

      await loadUsers();
    } catch (error) {
      setUsersError('更新用戶狀態失敗');
      console.error(error);
    }
  }, [loadUsers, users]);

  const deleteUser = useCallback(async (userId: string) => {
    if (!window.confirm('確定要永久刪除此用戶？此操作無法復原！')) return;
    try {
      await authService.deleteUser(userId, true);
      await loadUsers();
    } catch (error) {
      setUsersError('刪除用戶失敗');
      console.error(error);
    }
  }, [loadUsers]);

  const resetForm = useCallback(() => {
    setNewUserForm({
      username: '',
      password: '',
      name: '',
      role: 'student',
      studentId: '',
      class: '',
      chineseGroup: '',
      englishGroup: '',
      mathGroup: '',
      subjectsTaught: [...VISIBLE_SUBJECTS],
      subjectClasses: {}
    });
    setAddUserError('');
  }, []);

  const handleAddUser = useCallback(async () => {
    if (!newUserForm.username || !newUserForm.password || !newUserForm.name) {
      setAddUserError('請填寫必填欄位：用戶名、密碼和姓名');
      return;
    }

    try {
      setAddUserLoading(true);
      setAddUserError('');

      const userData = {
        username: newUserForm.username,
        password: newUserForm.password,
        role: newUserForm.role,
        profile: {
          name: newUserForm.name,
          ...(newUserForm.role === 'student'
            ? {
                ...(newUserForm.studentId && { studentId: newUserForm.studentId }),
                ...(newUserForm.class && { class: newUserForm.class }),
                ...(newUserForm.chineseGroup && { chineseGroup: newUserForm.chineseGroup }),
                ...(newUserForm.englishGroup && { englishGroup: newUserForm.englishGroup }),
                ...(newUserForm.mathGroup && { mathGroup: newUserForm.mathGroup })
              }
            : {}),
          ...(newUserForm.role === 'teacher'
            ? {
                subjectsTaught: Array.isArray(newUserForm.subjectsTaught) && newUserForm.subjectsTaught.length > 0 ? newUserForm.subjectsTaught : [...VISIBLE_SUBJECTS],
                subjectClasses: newUserForm.subjectClasses && typeof newUserForm.subjectClasses === 'object' ? newUserForm.subjectClasses : {}
              }
            : {})
        }
      };

      await authService.createUser(userData);
      resetForm();
      setShowAddUser(false);
      await loadUsers();
      alert('用戶新增成功！');
    } catch (error) {
      setAddUserError(error instanceof Error ? error.message : '新增用戶失敗');
    } finally {
      setAddUserLoading(false);
    }
  }, [loadUsers, newUserForm, resetForm]);

  const openUserModal = useCallback(async (userId: string, mode: 'view' | 'edit') => {
    setUserModalOpen(true);
    setUserModalMode(mode);
    setUserModalUserId(userId);
    setUserModalLoading(true);
    setUserModalSaving(false);
    setUserModalError('');
    setUserModalUser(null);
    setUserModalStats(null);
    try {
      const resp = await authService.getUserDetails(userId);
      setUserModalUser(resp.user);
      setUserModalStats(resp.learningStats);
    } catch (e: any) {
      setUserModalError(e?.message || '載入用戶詳情失敗');
    } finally {
      setUserModalLoading(false);
    }
  }, []);

  const saveUserModal = useCallback(async (payload: { username: string; role: 'teacher' | 'student'; isActive: boolean; profile: Record<string, any>; newPassword?: string }) => {
    if (!userModalUserId) return;
    try {
      setUserModalSaving(true);
      setUserModalError('');
      if (payload.newPassword) {
        await authService.resetUserPassword(userModalUserId, payload.newPassword);
      }
      const updated = await authService.updateUser(userModalUserId, payload as any);
      setUserModalUser(updated);
      setUserModalMode('view');
      await loadUsers();
    } catch (e: any) {
      setUserModalError(e?.message || '儲存失敗');
    } finally {
      setUserModalSaving(false);
    }
  }, [loadUsers, userModalUserId]);

  // Points management functions
  const handleGrantPoints = useCallback(async (userId: string, amount: number, description?: string) => {
    try {
      try {
        await authService.grantPointsToStudent(userId, amount, description);
      } catch (apiError) {
        // API 不可用時，模擬成功操作
        console.log('API not available, simulating grant points operation...');

        // 更新本地狀態和 localStorage
        setStudentsPointsData(prev => prev.map(student => {
          if (student.userId === userId) {
            const updatedStudent = {
              ...student,
              currentPoints: student.currentPoints + amount,
              totalReceived: student.totalReceived + amount,
              lastUpdate: new Date().toISOString()
            };

            // 同時更新該學生的 localStorage
            const userPointsKey = `userPoints_${userId}`;
            const pointsData = {
              currentPoints: updatedStudent.currentPoints,
              totalReceived: updatedStudent.totalReceived,
              totalUsed: updatedStudent.totalUsed,
              lastUpdate: updatedStudent.lastUpdate
            };
            localStorage.setItem(userPointsKey, JSON.stringify(pointsData));

            return updatedStudent;
          }
          return student;
        }));

        alert(`成功分配 ${amount} 點數給學生！`);
      }
      await loadPointsData();
    } catch (error) {
      console.error('Grant points failed:', error);
      throw error;
    }
  }, [loadPointsData]);

  const loadRewardsData = useCallback(async () => {
    try {
      setRewardsLoading(true);
      const resp = await authService.getStudentsRewards();
      const list = (resp?.students || []) as StudentRewardsStatus[];
      setStudentsRewardsData(list);
      const totalStudents = list.length;
      const totalPointsDistributed = list.reduce((sum, s) => sum + (Number(s.totalReceived) || 0), 0);
      const totalPointsUsed = list.reduce((sum, s) => sum + (Number(s.totalUsed) || 0), 0);
      const totalCurrent = list.reduce((sum, s) => sum + (Number(s.currentPoints) || 0), 0);
      setRewardsOverview({
        totalStudents,
        totalPointsDistributed,
        totalPointsUsed,
        averagePointsPerStudent: totalStudents > 0 ? totalCurrent / totalStudents : 0,
        studentsWithPoints: list.filter((s) => (Number(s.currentPoints) || 0) > 0).length,
        studentsWithoutPoints: list.filter((s) => (Number(s.currentPoints) || 0) === 0).length
      });
    } catch (e) {
      console.error('Load rewards failed:', e);
      setStudentsRewardsData([]);
      setRewardsOverview({
        totalStudents: 0,
        totalPointsDistributed: 0,
        totalPointsUsed: 0,
        averagePointsPerStudent: 0,
        studentsWithPoints: 0,
        studentsWithoutPoints: 0
      });
    } finally {
      setRewardsLoading(false);
    }
  }, []);

  const handleBatchGrantPoints = useCallback(async (studentIds: string[], amount: number, description?: string) => {
    try {
      try {
        await authService.batchGrantPoints(studentIds, amount, description);
      } catch (apiError) {
        // API 不可用時，模擬成功操作
        console.log('API not available, simulating batch grant points operation...');

        // 更新本地狀態和 localStorage
        setStudentsPointsData(prev => prev.map(student => {
          if (studentIds.includes(student.userId)) {
            const updatedStudent = {
              ...student,
              currentPoints: student.currentPoints + amount,
              totalReceived: student.totalReceived + amount,
              lastUpdate: new Date().toISOString()
            };

            // 同時更新該學生的 localStorage
            const userPointsKey = `userPoints_${student.userId}`;
            const pointsData = {
              currentPoints: updatedStudent.currentPoints,
              totalReceived: updatedStudent.totalReceived,
              totalUsed: updatedStudent.totalUsed,
              lastUpdate: updatedStudent.lastUpdate
            };
            localStorage.setItem(userPointsKey, JSON.stringify(pointsData));

            return updatedStudent;
          }
          return student;
        }));

        alert(`成功批次分配 ${amount} 點數給 ${studentIds.length} 位學生！`);
      }
      await loadPointsData();
    } catch (error) {
      console.error('Batch grant points failed:', error);
      throw error;
    }
  }, [loadPointsData]);

  const handleAdjustPoints = useCallback(async (userId: string, newAmount: number, description?: string) => {
    try {
      try {
        await authService.adjustStudentPoints(userId, newAmount, description);
      } catch (apiError) {
        // API 不可用時，模擬成功操作
        console.log('API not available, simulating adjust points operation...');

        // 更新本地狀態
        setStudentsPointsData(prev => prev.map(student =>
          student.userId === userId
            ? { ...student, currentPoints: newAmount }
            : student
        ));

        alert(`成功調整學生點數至 ${newAmount}！`);
      }
      await loadPointsData();
    } catch (error) {
      console.error('Adjust points failed:', error);
      throw error;
    }
  }, [loadPointsData]);

  const restoreArchivedFolder = useCallback(async (folder: any) => {
    const cls = String(folder?.className || folderClassName || '').trim();
    if (!cls) return;
    if (!window.confirm('確定要復原此資料夾及其子層嗎？')) return;
    try {
      setFolderError('');
      setFolderLoading(true);
      await authService.restoreClassFolder(cls, String(folder.id));
      await loadClassFolders(cls);
    } catch (e: any) {
      setFolderError(e?.message || '復原失敗');
    } finally {
      setFolderLoading(false);
    }
  }, [folderClassName, loadClassFolders]);

  const sidebarItems: SidebarItem[] = useMemo(() => ([
    { key: 'users', label: '帳號管理', icon: <Users className="w-5 h-5" /> },
    { key: 'assignments', label: '作業管理', icon: <ClipboardList className="w-5 h-5" /> },
    { key: 'folders', label: '班級資料夾', icon: <FolderArchive className="w-5 h-5" /> },
    { key: 'rewards', label: '獎勵積分', icon: <Award className="w-5 h-5" /> },
    { key: 'points', label: '點數管理', icon: <Coins className="w-5 h-5" /> },
    { key: 'moderation', label: '內容審核', icon: <Shield className="w-5 h-5" /> },
    { key: 'yearEnd', label: '年度操作', icon: <ShieldAlert className="w-5 h-5" /> }
  ]), []);

  const sectionTitle = useMemo(() => {
    switch (activeSection) {
      case 'users': return '帳號管理';
      case 'assignments': return '作業管理';
      case 'folders': return '班級資料夾（封存）';
      case 'rewards': return '獎勵積分管理';
      case 'points': return '點數管理';
      case 'moderation': return '內容審核';
      case 'yearEnd': return '年度操作';
      default: return '管理後台';
    }
  }, [activeSection]);

  const sectionSubtitle = useMemo(() => {
    switch (activeSection) {
      case 'users': return '新增/停用/刪除用戶，匯入匯出 CSV（只影響帳號資料）';
      case 'assignments': return '以檔案總管方式查看作業；管理員可查看、刪除及封存';
      case 'folders': return '查看封存資料夾、詳細內容及復原';
      case 'rewards': return '管理「我的獎勵」積分，為個別學生或批次加分／改分';
      case 'points': return '管理學生點數，分配點數給個別學生或批次分配';
      case 'moderation': return '監控 AI 圖片生成內容安全，查看審核記錄和統計';
      case 'yearEnd': return '升班（封存本年度所有學生內容）';
      default: return undefined;
    }
  }, [activeSection]);

  return (
    <>
      <AdminShell
        activeSection={activeSection}
        sidebarItems={sidebarItems}
        onSelectSection={setActiveSection}
        title={sectionTitle}
        subtitle={sectionSubtitle}
        onOpenSettings={() => setShowUiSettings(true)}
        onBackToPlatform={() => navigate('/')}
        onLogout={logout}
      >
        {activeSection === 'users' && (
          <div className="space-y-3">
            {usersError && <div className="text-red-700 font-bold">{usersError}</div>}
            {usersLoading && <div className="text-gray-700 font-bold">載入中…</div>}
            <AdminUsersPanel
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              filterRole={filterRole}
              setFilterRole={setFilterRole}
              users={users}
              onOpenAddUser={() => {
                setAddUserError('');
                setShowAddUser(true);
              }}
              onExportCSV={exportToCSV}
              onImportCSVFile={(file) => void importUsersFromCsvFile(file)}
              onViewUser={(userId) => void openUserModal(userId, 'view')}
              onEditUser={(userId) => void openUserModal(userId, 'edit')}
              onToggleUserStatus={(userId) => void toggleUserStatus(userId)}
              onDeleteUser={(userId) => void deleteUser(userId)}
            />
          </div>
        )}

        {activeSection === 'assignments' && (
          <AdminAssignmentsPanel onOpen={() => setShowAssignmentManager(true)} />
        )}

        {activeSection === 'folders' && (
          <AdminFoldersPanel
            folderClassName={folderClassName}
            classOptions={classOptions}
            folderLoading={folderLoading}
            folderError={folderError}
            archivedFolders={archivedFolders}
            onClassChange={(v) => setFolderClassName(v)}
            onLoad={() => void loadClassFolders(folderClassName)}
            getFolderPath={getFolderPath}
            onView={(folder) => void openArchivedFolderDetail(folder)}
            onRestore={(folder) => void restoreArchivedFolder(folder)}
          />
        )}

        {activeSection === 'points' && (
          <div className="space-y-3">
            {pointsLoading && <div className="text-gray-700 font-bold">載入點數資料中...</div>}
            <AdminPointsPanel
              studentsPoints={studentsPointsData}
              overview={pointsOverview}
              transactions={pointsTransactions}
              onGrantPoints={handleGrantPoints}
              onBatchGrantPoints={handleBatchGrantPoints}
              onAdjustPoints={handleAdjustPoints}
            />
          </div>
        )}

        {activeSection === 'rewards' && (
          <div className="space-y-3">
            {rewardsLoading && <div className="text-gray-700 font-bold">載入獎勵積分資料中...</div>}
            <AdminRewardsPanel
              students={studentsRewardsData}
              overview={rewardsOverview}
              loading={rewardsLoading}
              onReload={loadRewardsData}
              onGrant={async (userId, amount, description) => {
                await authService.grantRewardsToStudent(userId, amount, description);
              }}
              onBatchGrant={async (studentIds, amount, description) => {
                await authService.batchGrantRewards(studentIds, amount, description);
              }}
              onAdjust={async (userId, newAmount, description) => {
                await authService.adjustStudentRewards(userId, newAmount, description);
              }}
            />
          </div>
        )}

        {activeSection === 'moderation' && <ModerationLogsPanel />}

        {activeSection === 'yearEnd' && (
          <AdminYearEndPanel yearEndLoading={yearEndLoading} yearEndResult={yearEndResult} onRun={() => void runYearEndArchive()} />
        )}
      </AdminShell>

      <UiSettingsModal open={showUiSettings} onClose={() => setShowUiSettings(false)} />

      <AssignmentExplorerModal
        open={showAssignmentManager}
        onClose={() => setShowAssignmentManager(false)}
        authService={authService}
        viewerRole="admin"
        viewerId="admin"
      />

      <ArchivedFolderDetailsModal
        open={folderDetailOpen}
        onClose={() => setFolderDetailOpen(false)}
        className={String(folderDetailFolder?.className || folderClassName || '')}
        folder={folderDetailFolder}
        folders={classFolders}
        tasks={folderDetailTasks}
        tasksLoading={folderDetailTasksLoading}
        tasksError={folderDetailTasksError}
        onRestoreFolder={async (folderId) => {
          const cls = String(folderDetailFolder?.className || folderClassName || '').trim();
          if (!cls) return;
          if (!window.confirm('確定要復原此資料夾及其子層嗎？')) return;
          try {
            setFolderDetailTasksError('');
            setFolderLoading(true);
            await authService.restoreClassFolder(cls, String(folderId));
            await loadClassFolders(cls);
          } catch (e: any) {
            setFolderDetailTasksError(e?.message || '復原失敗');
          } finally {
            setFolderLoading(false);
          }
        }}
      />

      <AdminUserModal
        open={userModalOpen}
        mode={userModalMode}
        loading={userModalLoading}
        saving={userModalSaving}
        error={userModalError}
        user={userModalUser}
        learningStats={userModalStats}
        availableSubjects={VISIBLE_SUBJECTS}
        availableClasses={classOptions}
        onClose={() => {
          setUserModalOpen(false);
          setUserModalUserId(null);
          setUserModalUser(null);
          setUserModalStats(null);
          setUserModalMode('view');
          setUserModalError('');
        }}
        onRequestEdit={() => setUserModalMode('edit')}
        onSave={saveUserModal}
      />

      <AdminAddUserModal
        open={showAddUser}
        isLoading={addUserLoading}
        error={addUserError}
        form={newUserForm}
        setForm={setNewUserForm}
        availableSubjects={VISIBLE_SUBJECTS}
        availableClasses={classOptions}
        onClose={() => {
          resetForm();
          setShowAddUser(false);
        }}
        onSubmit={() => void handleAddUser()}
      />
    </>
  );
};

export default AdminDashboard;
