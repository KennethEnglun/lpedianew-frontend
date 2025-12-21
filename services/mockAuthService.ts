interface LoginCredentials {
  username: string;
  password: string;
  role: 'admin' | 'teacher' | 'student';
}

interface User {
  id: string;
  username: string;
  role: 'admin' | 'teacher' | 'student';
  profile: {
    name: string;
    class?: string;
    teacherCode?: string;
    studentId?: string;
    email?: string;
    avatar?: string;
    chineseGroup?: string;
    englishGroup?: string;
    mathGroup?: string;
  };
  lastLogin?: string;
  isActive: boolean;
}

// 默認用戶數據
const defaultUsers: User[] = [
  {
    id: '1',
    username: 'admin',
    role: 'admin',
    profile: {
      name: '系統管理員'
    },
    isActive: true
  },
  {
    id: '2',
    username: 'teacher01',
    role: 'teacher',
    profile: {
      name: '李老師',
      teacherCode: 'T001'
    },
    isActive: true
  },
  {
    id: '3',
    username: 'teacher02',
    role: 'teacher',
    profile: {
      name: '王老師',
      teacherCode: 'T002'
    },
    isActive: true
  },
  {
    id: '4',
    username: 'student001',
    role: 'student',
    profile: {
      name: '張小明',
      class: '4A',
      chineseGroup: '高組',
      englishGroup: '中組',
      mathGroup: '高組'
    },
    isActive: true
  },
  {
    id: '5',
    username: 'student002',
    role: 'student',
    profile: {
      name: '李小華',
      class: '4A',
      chineseGroup: '中組',
      englishGroup: '低組',
      mathGroup: '中組'
    },
    isActive: true
  },
  {
    id: '6',
    username: 'student003',
    role: 'student',
    profile: {
      name: '陳小美',
      class: '4B',
      chineseGroup: '低組',
      englishGroup: '高組',
      mathGroup: '低組'
    },
    isActive: false
  }
];

// 默認密碼（實際應該加密）
const defaultPasswords: Record<string, string> = {
  'admin': 'admin123456',
  'teacher01': 'teacher123',
  'teacher02': 'teacher123',
  'student001': 'student123',
  'student002': 'student123',
  'student003': 'student123'
};

// 從 localStorage 載入或使用默認數據
const loadUsersFromStorage = (): User[] => {
  try {
    const stored = localStorage.getItem('lpedia_mock_users');
    return stored ? JSON.parse(stored) : [...defaultUsers];
  } catch {
    return [...defaultUsers];
  }
};

const loadPasswordsFromStorage = (): Record<string, string> => {
  try {
    const stored = localStorage.getItem('lpedia_mock_passwords');
    return stored ? JSON.parse(stored) : { ...defaultPasswords };
  } catch {
    return { ...defaultPasswords };
  }
};

// 保存到 localStorage
const saveUsersToStorage = (users: User[]) => {
  localStorage.setItem('lpedia_mock_users', JSON.stringify(users));
};

const savePasswordsToStorage = (passwords: Record<string, string>) => {
  localStorage.setItem('lpedia_mock_passwords', JSON.stringify(passwords));
};

// 使用持久化數據
let mockUsers: User[] = loadUsersFromStorage();
let mockPasswords: Record<string, string> = loadPasswordsFromStorage();

class MockAuthService {
  private readonly TOKEN_KEY = 'lpedia_auth_token';
  private readonly USER_KEY = 'lpedia_user';

  // 生成模擬JWT token
  private generateMockToken(userId: string): string {
    const payload = {
      userId,
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24小時後過期
    };
    return btoa(JSON.stringify(payload));
  }

  // 獲取儲存的token
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  // 獲取儲存的用戶資訊
  getUser(): User | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  // 檢查是否已登入
  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  // 用戶登入
  async login(credentials: LoginCredentials): Promise<User> {
    // 模擬網絡延遲
    await new Promise(resolve => setTimeout(resolve, 800));

    const user = mockUsers.find(u =>
      u.username === credentials.username &&
      u.role === credentials.role &&
      u.isActive
    );

    if (!user) {
      throw new Error('用戶不存在或帳號已停用');
    }

    const correctPassword = mockPasswords[credentials.username];
    if (correctPassword !== credentials.password) {
      throw new Error('密碼錯誤');
    }

    // 更新最後登入時間
    user.lastLogin = new Date().toISOString();

    // 生成token並儲存
    const token = this.generateMockToken(user.id);
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));

    return user;
  }

  // 用戶登出
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    window.location.href = '/';
  }

  // 獲取用戶列表（管理員專用）
  async getUsers(params?: {
    role?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    users: User[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    await new Promise(resolve => setTimeout(resolve, 500));

    let filteredUsers = [...mockUsers];

    if (params?.role && params.role !== 'all') {
      filteredUsers = filteredUsers.filter(user => user.role === params.role);
    }

    if (params?.search) {
      const search = params.search.toLowerCase();
      filteredUsers = filteredUsers.filter(user =>
        user.username.toLowerCase().includes(search) ||
        user.profile.name.toLowerCase().includes(search) ||
        (user.profile.studentId && user.profile.studentId.includes(search)) ||
        (user.profile.email && user.profile.email.toLowerCase().includes(search))
      );
    }

    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    return {
      users: filteredUsers.slice(startIndex, endIndex),
      pagination: {
        total: filteredUsers.length,
        page,
        limit,
        totalPages: Math.ceil(filteredUsers.length / limit)
      }
    };
  }

  // 創建用戶（管理員專用）
  async createUser(userData: {
    username: string;
    password: string;
    role: 'teacher' | 'student';
    profile: {
      name: string;
      class?: string;
      teacherCode?: string;
      chineseGroup?: string;
      englishGroup?: string;
      mathGroup?: string;
    };
  }): Promise<User> {
    await new Promise(resolve => setTimeout(resolve, 500));

    // 檢查用戶名是否已存在
    if (mockUsers.find(u => u.username === userData.username)) {
      throw new Error('用戶名已存在');
    }

    const newUser: User = {
      id: (mockUsers.length + 1).toString(),
      username: userData.username,
      role: userData.role,
      profile: userData.profile,
      isActive: true
    };

    mockUsers.push(newUser);
    mockPasswords[userData.username] = userData.password;

    // 保存到 localStorage
    saveUsersToStorage(mockUsers);
    savePasswordsToStorage(mockPasswords);

    return newUser;
  }

  // 更新用戶（管理員專用）
  async updateUser(userId: string, updateData: Partial<User>): Promise<User> {
    await new Promise(resolve => setTimeout(resolve, 500));

    const userIndex = mockUsers.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      throw new Error('用戶不存在');
    }

    mockUsers[userIndex] = { ...mockUsers[userIndex], ...updateData };

    // 保存到 localStorage
    saveUsersToStorage(mockUsers);

    return mockUsers[userIndex];
  }

  // 刪除/停用用戶（管理員專用）
  async deleteUser(userId: string, permanent = false): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));

    const userIndex = mockUsers.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      throw new Error('用戶不存在');
    }

    if (permanent) {
      const username = mockUsers[userIndex].username;
      mockUsers.splice(userIndex, 1);
      delete mockPasswords[username];
    } else {
      mockUsers[userIndex].isActive = false;
    }

    // 保存到 localStorage
    saveUsersToStorage(mockUsers);
    savePasswordsToStorage(mockPasswords);
  }

  // 啟用用戶（管理員專用）
  async activateUser(userId: string): Promise<User> {
    await new Promise(resolve => setTimeout(resolve, 500));

    const userIndex = mockUsers.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      throw new Error('用戶不存在');
    }

    mockUsers[userIndex].isActive = true;

    // 保存到 localStorage
    saveUsersToStorage(mockUsers);

    return mockUsers[userIndex];
  }

  // 匯出用戶CSV（管理員專用）
  async exportUsersCSV(): Promise<Blob> {
    await new Promise(resolve => setTimeout(resolve, 500));

    const headers = ['用戶名', '密碼', '角色', '姓名', '班級', '教師代碼', '中文分組', '英文分組', '數學分組', '狀態'];
    const csvData = mockUsers.map(user => [
      user.username,
      mockPasswords[user.username] || '',
      user.role === 'teacher' ? '教師' : user.role === 'student' ? '學生' : '管理員',
      user.profile.name,
      user.profile.class || '',
      user.profile.teacherCode || '',
      user.profile.chineseGroup || '',
      user.profile.englishGroup || '',
      user.profile.mathGroup || '',
      user.isActive ? '啟用' : '停用'
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\\n');

    // 添加 UTF-8 BOM 以確保中文正確顯示
    const bom = '\uFEFF';
    return new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  }

  // 匯入用戶CSV（管理員專用）
  async importUsersCSV(file: File): Promise<{ imported: number; errors: string[] }> {
    await new Promise(resolve => setTimeout(resolve, 1000));

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\\n');
          const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));

          let imported = 0;
          const errors: string[] = [];

          for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            try {
              const values = lines[i].split(',').map(v => v.replace(/"/g, ''));
              const userData = {
                username: values[0],
                password: values[1] || 'temp123456',
                role: values[2] === '教師' ? 'teacher' : 'student' as 'teacher' | 'student',
                profile: {
                  name: values[3],
                  class: values[4] || undefined,
                  teacherCode: values[5] || undefined,
                  chineseGroup: values[6] || undefined,
                  englishGroup: values[7] || undefined,
                  mathGroup: values[8] || undefined
                }
              };

              if (mockUsers.find(u => u.username === userData.username)) {
                errors.push(`第${i}行：用戶名 "${userData.username}" 已存在`);
                continue;
              }

              const newUser: User = {
                id: (mockUsers.length + 1).toString(),
                username: userData.username,
                role: userData.role,
                profile: userData.profile,
                isActive: true
              };

              mockUsers.push(newUser);
              mockPasswords[userData.username] = userData.password;
              imported++;

            } catch (error) {
              errors.push(`第${i}行：資料格式錯誤`);
            }
          }

          // 保存到 localStorage
          saveUsersToStorage(mockUsers);
          savePasswordsToStorage(mockPasswords);

          resolve({ imported, errors });
        } catch (error) {
          reject(new Error('CSV文件解析失敗'));
        }
      };
      reader.readAsText(file);
    });
  }

  // 獲取用戶詳細資訊
  async getUserDetails(userId: string): Promise<{
    user: User;
    learningStats?: any;
  }> {
    await new Promise(resolve => setTimeout(resolve, 300));

    const user = mockUsers.find(u => u.id === userId);
    if (!user) {
      throw new Error('用戶不存在');
    }

    return { user };
  }

  // 重置數據到默認狀態（測試用）
  resetToDefault(): void {
    mockUsers.splice(0, mockUsers.length, ...defaultUsers);
    Object.keys(mockPasswords).forEach(key => delete mockPasswords[key]);
    Object.assign(mockPasswords, { ...defaultPasswords });

    // 清除 localStorage
    localStorage.removeItem('lpedia_mock_users');
    localStorage.removeItem('lpedia_mock_passwords');
  }

  // 手動保存當前狀態（調試用）
  saveCurrentState(): void {
    saveUsersToStorage(mockUsers);
    savePasswordsToStorage(mockPasswords);
  }
}

export const authService = new MockAuthService();
export type { User, LoginCredentials };
