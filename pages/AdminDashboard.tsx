import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, FolderArchive, ShieldAlert, Users } from 'lucide-react';
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
import type { AdminSection, AdminUser, SidebarItem, UserRoleFilter } from '../components/admin/types';
import { VISIBLE_SUBJECTS } from '../platform';

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
        createdAt: user.lastLogin ? new Date(user.lastLogin).toISOString().split('T')[0] : '2024-01-01',
        lastLogin: user.lastLogin ? new Date(user.lastLogin).toISOString().split('T')[0] : undefined,
        isActive: user.isActive,
        chineseGroup: user.profile.chineseGroup,
        englishGroup: user.profile.englishGroup,
        mathGroup: user.profile.mathGroup,
        subjectsTaught: Array.isArray((user.profile as any)?.subjectsTaught) ? (user.profile as any).subjectsTaught : undefined,
        subjectClasses: (user.profile as any)?.subjectClasses && typeof (user.profile as any).subjectClasses === 'object' ? (user.profile as any).subjectClasses : undefined
      }));

      setUsers(adminUsers);
      setUsersError('');
    } catch (err) {
      setUsersError('載入用戶列表失敗');
      console.error(err);
    } finally {
      setUsersLoading(false);
    }
  }, [filterRole, searchTerm]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

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
    { key: 'yearEnd', label: '年度操作', icon: <ShieldAlert className="w-5 h-5" /> }
  ]), []);

  const sectionTitle = useMemo(() => {
    switch (activeSection) {
      case 'users': return '帳號管理';
      case 'assignments': return '作業管理';
      case 'folders': return '班級資料夾（封存）';
      case 'yearEnd': return '年度操作';
      default: return '管理後台';
    }
  }, [activeSection]);

  const sectionSubtitle = useMemo(() => {
    switch (activeSection) {
      case 'users': return '新增/停用/刪除用戶，匯入匯出 CSV（只影響帳號資料）';
      case 'assignments': return '以檔案總管方式查看作業；管理員可查看、刪除及封存';
      case 'folders': return '查看封存資料夾、詳細內容及復原';
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
