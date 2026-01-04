interface LoginCredentials {
  username: string;
  password: string;
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
    homeroomClass?: string;
    subjectsTaught?: string[];
    subjectGroups?: Record<string, string[]>;
    subjectClasses?: Record<string, string[]>;
  };
  lastLogin?: string;
  isActive: boolean;
}

interface AuthResponse {
  token: string;
  user: User;
}

const normalizeApiBase = (raw: string) => {
  const input = String(raw || '').trim();
  if (!input) return '';
  const base = input.replace(/\/+$/, '');
  if (base.endsWith('/api')) return base;
  return `${base}/api`;
};

class AuthService {
  // 預設使用生產後端，避免未設定環境變數時仍指向 localhost
  private readonly API_BASE = normalizeApiBase(
    import.meta.env.VITE_API_BASE_URL || 'https://lpedianew-backend-production.up.railway.app/api'
  );
  private readonly TOKEN_KEY = 'lpedia_auth_token';
  private readonly USER_KEY = 'lpedia_user';

  // 獲取儲存的token
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  // 給需要 <video>/<img> 等無法自訂 Authorization header 的場景使用
  getApiBase(): string {
    return this.API_BASE;
  }

  // 獲取儲存的用戶資訊
  getUser(): User | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  // 解碼 JWT payload（支援 base64url / 無 padding）
  private decodeBase64Url(input: string): string {
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padding);
    return atob(padded);
  }

  // 檢查是否已登入
  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      const parts = token.split('.');
      const payloadPart = parts.length >= 2 ? parts[1] : parts[0];
      if (!payloadPart) return false;

      const payloadJson = this.decodeBase64Url(payloadPart);
      const payload = JSON.parse(payloadJson);

      if (typeof payload.exp !== 'number') return false;
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  // 設置認證資料
  private setAuthData(authData: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, authData.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(authData.user));
  }

  // 清除認證資料
  private clearAuthData(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  // 獲取HTTP請求標頭
  private getAuthHeaders(): HeadersInit {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  // 處理HTTP錯誤
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '網絡錯誤' }));
      const message =
        (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string' && (error as any).message)
        || (error && typeof error === 'object' && 'error' in error && typeof (error as any).error === 'string' && (error as any).error)
        || `HTTP Error: ${response.status}`;
      throw new Error(message);
    }
    return response.json();
  }

  // 用戶登入
  async login(credentials: LoginCredentials): Promise<User> {
    try {
      const response = await fetch(`${this.API_BASE}/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: '網絡錯誤' }));
        throw new Error(error.message || `HTTP Error: ${response.status}`);
      }

      const authData = await response.json();
      this.setAuthData(authData);
      return authData.user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // 用戶登出
  logout(): void {
    this.clearAuthData();
    // 可以調用後端登出API（如果需要）
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
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const response = await fetch(`${this.API_BASE}/users?${searchParams}`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // 獲取學生名單（教師/管理員可用）
  async getStudentRoster(params?: {
    search?: string;
    class?: string;
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
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value).length > 0) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/users/students${query}`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // 更新自己的教師設定（教師/管理員）
  async updateMyTeacherSettings(settings: {
    homeroomClass?: string;
    subjectsTaught?: string[];
    subjectGroups?: Record<string, string[]>;
  }): Promise<User> {
    const response = await fetch(`${this.API_BASE}/users/me/teacher-settings`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(settings)
    });

    const result = await this.handleResponse<{ message: string; user: User }>(response);
    const current = this.getUser();
    const nextUser = {
      ...(current || result.user),
      ...result.user,
      profile: {
        ...(current?.profile || {}),
        ...(result.user.profile || {})
      }
    } as User;
    localStorage.setItem(this.USER_KEY, JSON.stringify(nextUser));
    return nextUser;
  }

  // === AI 對話（通用 Bot）===
  async sendChatMessage(payload: {
    subject?: string;
    threadId?: string | null;
    botId?: string;
    taskId?: string;
    message: string;
    ephemeral?: boolean;
  }): Promise<{
    threadId: string;
    userMessage: any;
    assistantMessage: any;
  }> {
    const response = await fetch(`${this.API_BASE}/chats/send`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async sendChatMessageStream(payload: {
    subject?: string;
    threadId?: string | null;
    botId?: string;
    taskId?: string;
    message: string;
    ephemeral?: boolean;
  }, options?: { signal?: AbortSignal }): Promise<Response> {
    return fetch(`${this.API_BASE}/chats/send-stream`, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(payload),
      signal: options?.signal
    });
  }

  async getMyChatThreads(params?: { subject?: string; botId?: string }): Promise<{ threads: any[] }> {
    const searchParams = new URLSearchParams();
    if (params?.subject) searchParams.append('subject', params.subject);
    if (params?.botId) searchParams.append('botId', params.botId);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/chats/me/threads${query}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async createMyChatThread(payload: { subject?: string; botId?: string }): Promise<{ thread: any }> {
    const response = await fetch(`${this.API_BASE}/chats/me/threads`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload || {})
    });
    return this.handleResponse(response);
  }

  async updateMyChatThread(threadId: string, patch: { title?: string; folderId?: string | null }): Promise<{ thread: any }> {
    const response = await fetch(`${this.API_BASE}/chats/me/threads/${threadId}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(patch || {})
    });
    return this.handleResponse(response);
  }

  async deleteMyChatThread(threadId: string): Promise<void> {
    const response = await fetch(`${this.API_BASE}/chats/me/threads/${threadId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    await this.handleResponse(response);
  }

  async getMyChatFolders(): Promise<{ folders: any[] }> {
    const response = await fetch(`${this.API_BASE}/chats/me/folders`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async createMyChatFolder(payload: { name: string }): Promise<{ folder: any }> {
    const response = await fetch(`${this.API_BASE}/chats/me/folders`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async updateMyChatFolder(folderId: string, payload: { name: string }): Promise<{ folder: any }> {
    const response = await fetch(`${this.API_BASE}/chats/me/folders/${folderId}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async deleteMyChatFolder(folderId: string): Promise<void> {
    const response = await fetch(`${this.API_BASE}/chats/me/folders/${folderId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    await this.handleResponse(response);
  }

  async getMyChatBots(): Promise<{ bots: any[] }> {
    const response = await fetch(`${this.API_BASE}/chats/me/bots`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async createMyChatBot(payload: { name: string; prompt?: string }): Promise<{ bot: any }> {
    const response = await fetch(`${this.API_BASE}/chats/me/bots`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async updateMyChatBot(botId: string, payload: { name?: string; prompt?: string }): Promise<{ bot: any }> {
    const response = await fetch(`${this.API_BASE}/chats/me/bots/${botId}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async deleteMyChatBot(botId: string): Promise<void> {
    const response = await fetch(`${this.API_BASE}/chats/me/bots/${botId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    await this.handleResponse(response);
  }

  async generateImage(payload: { prompt: string; n?: number; size?: '256x256' | '512x512' | '1024x1024' }): Promise<{ images: string[] }> {
    const response = await fetch(`${this.API_BASE}/ai/image-generate`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload || {})
    });
    return this.handleResponse(response);
  }

  async generateMindmap(payload: { prompt: string; maxNodes?: number }): Promise<{ nodes: Array<{ id: string; label: string }>; edges: Array<{ from: string; to: string; label?: string }> }> {
    const response = await fetch(`${this.API_BASE}/ai/mindmap`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload || {})
    });
    return this.handleResponse(response);
  }

  async generateAiNotes(payload: { text: string; locale?: 'zh-HK' | 'zh-CN' | 'en'; maxNodes?: number; grade?: string }): Promise<{
    topic: string;
    corrections: Array<{ claim: string; issue: string; correction: string; needsVerification: boolean }>;
    notesMarkdown: string;
    enrichment: string[];
    selfCheck: Array<{ question: string; answer: string }>;
    mindmap: { nodes: Array<{ id: string; label: string }>; edges: Array<{ from: string; to: string; label?: string }> };
  }> {
    const response = await fetch(`${this.API_BASE}/ai/notes`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload || {})
    });
    return this.handleResponse(response);
  }

  // === AI小助手任務（派發自建 AI小助手）===
  async createBotTask(payload: { botId: string; subject: string; targetClasses?: string[]; targetGroups?: string[]; targetClass?: string; classFolderId?: string }): Promise<{ task: any }> {
    const response = await fetch(`${this.API_BASE}/bot-tasks`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async getTeacherBotTasks(subject?: string, targetClass?: string, groups?: string): Promise<{ tasks: any[]; total: number }> {
    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);
    if (targetClass) params.append('targetClass', targetClass);
    if (groups) params.append('groups', groups);
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/bot-tasks${query}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async deleteBotTask(taskId: string): Promise<void> {
    const response = await fetch(`${this.API_BASE}/bot-tasks/${taskId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    await this.handleResponse(response);
  }

  async getStudentBotTasks(): Promise<{ tasks: any[]; total: number }> {
    const response = await fetch(`${this.API_BASE}/bot-tasks/student`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getBotTaskMyThread(taskId: string): Promise<{ task: any; bot: any; thread: any; messages: any[] }> {
    const response = await fetch(`${this.API_BASE}/bot-tasks/${taskId}/my-thread`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getBotTaskThreads(taskId: string): Promise<{ task: any; threads: any[] }> {
    const response = await fetch(`${this.API_BASE}/bot-tasks/${taskId}/threads`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getBotTaskThreadMessages(taskId: string, threadId: string): Promise<{ task: any; thread: any; student: any; messages: any[] }> {
    const response = await fetch(`${this.API_BASE}/bot-tasks/${taskId}/threads/${threadId}/messages`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getMyChatMessages(threadId: string, params?: { limit?: number }): Promise<{ thread: any; messages: any[] }> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', String(params.limit));
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/chats/me/threads/${threadId}/messages${query}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getTeacherChatThreads(params: { subject?: string; class?: string; search?: string }): Promise<{ threads: any[] }> {
    const searchParams = new URLSearchParams();
    if (params.subject) searchParams.append('subject', params.subject);
    if (params.class) searchParams.append('class', params.class);
    if (params.search) searchParams.append('search', params.search);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/chats/teacher/threads${query}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getTeacherChatMessages(threadId: string, params?: { limit?: number }): Promise<{ thread: any; student: any; messages: any[] }> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', String(params.limit));
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/chats/teacher/threads/${threadId}/messages${query}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  // 創建用戶（管理員專用）
  async createUser(userData: {
    username: string;
    password: string;
    role: 'teacher' | 'student';
    profile: {
      name: string;
      class?: string;
      studentId?: string;
      teacherCode?: string;
      chineseGroup?: string;
      englishGroup?: string;
      mathGroup?: string;
      subjectsTaught?: string[];
      subjectClasses?: Record<string, string[]>;
    };
  }): Promise<User> {
    const response = await fetch(`${this.API_BASE}/users`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(userData)
    });

    const result = await this.handleResponse<{ user: User }>(response);
    return result.user;
  }

  // 更新用戶（管理員專用）
  async updateUser(userId: string, updateData: Partial<User>): Promise<User> {
    const response = await fetch(`${this.API_BASE}/users/${userId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(updateData)
    });

    const result = await this.handleResponse<{ user: User }>(response);
    return result.user;
  }

  // 重設用戶密碼（管理員專用）
  async resetUserPassword(userId: string, password: string): Promise<User> {
    const response = await fetch(`${this.API_BASE}/users/${userId}/password`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ password })
    });

    const result = await this.handleResponse<{ user: User }>(response);
    return result.user;
  }

  // 更新自己的密碼（教師/管理員）
  async updateMyPassword(password: string): Promise<User> {
    const response = await fetch(`${this.API_BASE}/users/me/password`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ password })
    });

    const result = await this.handleResponse<{ user: User }>(response);
    return result.user;
  }

  // 刪除/停用用戶（管理員專用）
  async deleteUser(userId: string, permanent = false): Promise<void> {
    const response = await fetch(`${this.API_BASE}/users/${userId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ permanent })
    });

    await this.handleResponse(response);
  }

  // 啟用用戶（管理員專用）
  async activateUser(userId: string): Promise<User> {
    const response = await fetch(`${this.API_BASE}/users/${userId}/activate`, {
      method: 'PATCH',
      headers: this.getAuthHeaders()
    });

    const result = await this.handleResponse<{ user: User }>(response);
    return result.user;
  }

  // 匯出用戶CSV（管理員專用）
  async exportUsersCSV(): Promise<Blob> {
    const response = await fetch(`${this.API_BASE}/users/export/csv`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('匯出失敗');
    }

    return response.blob();
  }

  // 匯入用戶CSV（管理員專用）
  async importUsersCSV(file: File): Promise<{ imported: number; errors: string[] }> {
    const formData = new FormData();
    formData.append('csvFile', file);

    const response = await fetch(`${this.API_BASE}/users/import/csv`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`
      },
      body: formData
    });

    return this.handleResponse(response);
  }

  // 獲取用戶詳細資訊
  async getUserDetails(userId: string): Promise<{
    user: User;
    learningStats?: any;
  }> {
    const response = await fetch(`${this.API_BASE}/users/${userId}`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // 創建討論串（教師專用）
  async createDiscussion(discussionData: {
    title: string;
    content: { type: 'text' | 'image' | 'link' | 'html'; value: string }[];
    subject: string;
    targetClasses: string[];
    targetGroups?: string[];
    classFolderId?: string;
  }): Promise<any> {
    const response = await fetch(`${this.API_BASE}/discussions`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(discussionData)
    });

    return this.handleResponse(response);
  }

  // 獲取學生的討論串
  async getStudentDiscussions(): Promise<{ discussions: any[] }> {
    const response = await fetch(`${this.API_BASE}/discussions/student`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // 獲取討論串詳情（學生/教師）
  async getDiscussionDetails(discussionId: string): Promise<{ discussion: any }> {
    const response = await fetch(`${this.API_BASE}/discussions/${encodeURIComponent(discussionId)}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  // 獲取教師的討論串
  async getTeacherDiscussions(): Promise<{ discussions: any[] }> {
    const response = await fetch(`${this.API_BASE}/discussions/teacher`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // === 作業管理相關API ===

  // 獲取教師的所有作業（可篩選）
  async getTeacherAssignments(subject?: string, targetClass?: string, groups?: string): Promise<{ assignments: any[], total: number }> {
    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);
    if (targetClass) params.append('targetClass', targetClass);
    if (groups) params.append('groups', groups);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/assignments${queryString}`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // 同科同級其他教師作業（討論串）
  async getSharedAssignments(params: {
    subject: string;
    grade: string;
    targetClass?: string;
    groups?: string[];
  }): Promise<{ assignments: any[]; total: number }> {
    const searchParams = new URLSearchParams();
    searchParams.append('subject', params.subject);
    searchParams.append('grade', params.grade);
    if (params.targetClass) searchParams.append('targetClass', params.targetClass);
    if (params.groups && params.groups.length > 0) searchParams.append('groups', params.groups.join(','));

    const response = await fetch(`${this.API_BASE}/assignments/shared?${searchParams.toString()}`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // 獲取特定作業的學生回應
  async getAssignmentResponses(assignmentId: string): Promise<{ assignment: any, responses: any[], total: number }> {
    const response = await fetch(`${this.API_BASE}/assignments/${assignmentId}/responses`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // 刪除單個學生回應
  async deleteResponse(responseId: string): Promise<void> {
    const response = await fetch(`${this.API_BASE}/assignments/responses/${responseId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });

    await this.handleResponse(response);
  }

  // 刪除整個作業及其所有回應
  async deleteAssignment(assignmentId: string): Promise<void> {
    const response = await fetch(`${this.API_BASE}/assignments/${assignmentId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });

    await this.handleResponse(response);
  }

  // 獲取可用的科目列表
  async getAvailableSubjects(): Promise<{ subjects: string[] }> {
    const response = await fetch(`${this.API_BASE}/assignments/filters/subjects`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // 獲取可用的班級列表和分組
  async getAvailableClasses(subject?: string): Promise<{ classes: string[], groups: string[], subject?: string }> {
    const params = new URLSearchParams();
    if (subject) {
      params.append('subject', subject);
    }

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/assignments/filters/classes${queryString}`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // 學生提交回應
  async submitStudentResponse(assignmentId: string, content: string): Promise<{ message: string, response: any }> {
    const response = await fetch(`${this.API_BASE}/assignments/${assignmentId}/responses`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ content })
    });

    return this.handleResponse(response);
  }

  // 檢查學生是否已回應特定討論串
  async checkStudentResponse(assignmentId: string): Promise<{ hasResponded: boolean, response?: any }> {
    const response = await fetch(`${this.API_BASE}/assignments/${assignmentId}/student-response`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // 獲取作業的所有回應（學生可查看）
  async getAllResponsesForStudents(assignmentId: string): Promise<{ assignment: any, responses: any[], total: number }> {
    const response = await fetch(`${this.API_BASE}/assignments/${assignmentId}/all-responses`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // === 題目庫 / 模板 / 班級資料夾（新） ===

  // 題目庫資料夾：私有
  async listMyLibraryFolders(grade: string): Promise<{ scope: 'my'; grade: string; folders: any[] }> {
    const params = new URLSearchParams();
    params.append('grade', grade);
    const response = await fetch(`${this.API_BASE}/library/my/folders?${params.toString()}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async createMyLibraryFolder(payload: { grade: string; name: string; parentId?: string | null; order?: number }): Promise<{ folder: any }> {
    const response = await fetch(`${this.API_BASE}/library/my/folders`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async updateMyLibraryFolder(folderId: string, patch: { name?: string; order?: number; parentId?: string | null }): Promise<{ folder: any }> {
    const response = await fetch(`${this.API_BASE}/library/my/folders/${folderId}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(patch)
    });
    return this.handleResponse(response);
  }

  async deleteMyLibraryFolder(folderId: string): Promise<{ folder: any }> {
    const response = await fetch(`${this.API_BASE}/library/my/folders/${folderId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  // 題目庫資料夾：教師共用空間
  async listSharedLibraryFolders(grade: string): Promise<{ scope: 'shared'; grade: string; folders: any[] }> {
    const params = new URLSearchParams();
    params.append('grade', grade);
    const response = await fetch(`${this.API_BASE}/library/shared/folders?${params.toString()}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async createSharedLibraryFolder(payload: { grade: string; name: string; parentId?: string | null; order?: number }): Promise<{ folder: any }> {
    const response = await fetch(`${this.API_BASE}/library/shared/folders`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async updateSharedLibraryFolder(folderId: string, patch: { name?: string; order?: number; parentId?: string | null }): Promise<{ folder: any }> {
    const response = await fetch(`${this.API_BASE}/library/shared/folders/${folderId}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(patch)
    });
    return this.handleResponse(response);
  }

  async deleteSharedLibraryFolder(folderId: string): Promise<{ folder: any }> {
    const response = await fetch(`${this.API_BASE}/library/shared/folders/${folderId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  // 模板：私有
  async listMyTemplates(params: { grade: string; folderId?: string | null }): Promise<{ templates: any[]; total: number }> {
    const search = new URLSearchParams();
    search.append('grade', params.grade);
    if (params.folderId !== undefined) search.append('folderId', params.folderId ? params.folderId : '');
    const response = await fetch(`${this.API_BASE}/templates/my?${search.toString()}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async createMyTemplate(payload: {
    grade: string;
    subject: string;
    title: string;
    type?: string;
    content: any;
    folderId?: string | null;
  }): Promise<{ template: any }> {
    const response = await fetch(`${this.API_BASE}/templates/my`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async createTemplateFromTask(payload: { type: string; id: string; grade?: string; folderId?: string | null }): Promise<{ template: any }> {
    const response = await fetch(`${this.API_BASE}/templates/from-task`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  // 模板：共用
  async listSharedTemplates(params: { grade: string; folderId?: string | null }): Promise<{ templates: any[]; total: number }> {
    const search = new URLSearchParams();
    search.append('grade', params.grade);
    if (params.folderId !== undefined) search.append('folderId', params.folderId ? params.folderId : '');
    const response = await fetch(`${this.API_BASE}/templates/shared?${search.toString()}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getTemplate(templateId: string, versionId?: string): Promise<{ template: any; version: any }> {
    const search = new URLSearchParams();
    if (versionId) search.append('versionId', versionId);
    const qs = search.toString() ? `?${search.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/templates/${templateId}${qs}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async updateTemplateLocation(templateId: string, payload: { scope: 'my' | 'shared'; folderId: string | null }): Promise<{ template: any }> {
    const response = await fetch(`${this.API_BASE}/templates/${templateId}/location`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async shareTemplate(templateId: string): Promise<{ template: any }> {
    const response = await fetch(`${this.API_BASE}/templates/${templateId}/share`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async unshareTemplate(templateId: string): Promise<{ template: any }> {
    const response = await fetch(`${this.API_BASE}/templates/${templateId}/unshare`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async createTemplateVersion(templateId: string, payload: { title?: string; content: any }): Promise<{ template: any; version: any }> {
    const response = await fetch(`${this.API_BASE}/templates/${templateId}/versions`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async copyTemplateToMyLibrary(templateId: string, payload?: { versionId?: string; folderId?: string | null }): Promise<{ template: any }> {
    const response = await fetch(`${this.API_BASE}/templates/${templateId}/copy`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload || {})
    });
    return this.handleResponse(response);
  }

  async assignTemplateToClass(templateId: string, payload: { className: string; classFolderId: string; versionId?: string; draftOnly?: boolean }): Promise<any> {
    const response = await fetch(`${this.API_BASE}/templates/${templateId}/assign`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  // 班級資料夾：教師端管理
  async getClassFolders(className: string): Promise<{ className: string; folders: any[] }> {
    const response = await fetch(`${this.API_BASE}/class-folders/${encodeURIComponent(className)}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  // 班級資料夾：管理員（可查看封存 + 復原）
  async getClassFoldersAdmin(className: string, opts?: { includeArchived?: boolean }): Promise<{ className: string; folders: any[] }> {
    const params = new URLSearchParams();
    if (opts?.includeArchived) params.append('includeArchived', '1');
    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/class-folders/${encodeURIComponent(className)}${qs}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async restoreClassFolder(className: string, folderId: string): Promise<{ result: any }> {
    const response = await fetch(`${this.API_BASE}/class-folders/${encodeURIComponent(className)}/${encodeURIComponent(folderId)}/restore`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async deleteArchivedClassFolderPermanently(className: string, folderId: string): Promise<{ result: { deleted: string[]; deletedCount: number } }> {
    const response = await fetch(`${this.API_BASE}/class-folders/${encodeURIComponent(className)}/${encodeURIComponent(folderId)}/hard`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  // 年度封存（升班）：管理員專用
  async archiveYearEnd(): Promise<{ message: string; archiveId: string; archivedAt: string; files?: any[]; cleared?: any[] }> {
    const response = await fetch(`${this.API_BASE}/admin/year-end/archive`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  // 年度封存：封存列表 / 下載 / 查看（管理員）
  async listYearArchives(): Promise<{ archives: any[] }> {
    const response = await fetch(`${this.API_BASE}/admin/year-end/archives`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getYearArchive(archiveId: string): Promise<{ archiveId: string; manifest: any }> {
    const response = await fetch(`${this.API_BASE}/admin/year-end/archives/${encodeURIComponent(archiveId)}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async downloadYearArchive(archiveId: string): Promise<Blob> {
    const response = await fetch(`${this.API_BASE}/admin/year-end/archives/${encodeURIComponent(archiveId)}/download`, {
      headers: this.getAuthHeaders()
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: '下載失敗' }));
      throw new Error(err?.message || err?.error || '下載失敗');
    }
    return response.blob();
  }

  // 封存作業管理（只讀）：沿用 AssignmentExplorerModal 的資料結構
  async getYearArchiveManageTasks(archiveId: string, params?: { subject?: string; className?: string }): Promise<{ tasks: any[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.subject) searchParams.append('subject', params.subject);
    if (params?.className) searchParams.append('className', params.className);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/admin/year-end/archives/${encodeURIComponent(archiveId)}/manage/tasks${qs}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getYearArchiveAssignmentResponses(archiveId: string, assignmentId: string): Promise<{ assignment: any; responses: any[]; total: number }> {
    const response = await fetch(`${this.API_BASE}/admin/year-end/archives/${encodeURIComponent(archiveId)}/assignments/${encodeURIComponent(assignmentId)}/responses`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getYearArchiveQuizResults(archiveId: string, quizId: string): Promise<{ quiz: any; results: any[]; total: number; statistics: any }> {
    const response = await fetch(`${this.API_BASE}/admin/year-end/archives/${encodeURIComponent(archiveId)}/quizzes/${encodeURIComponent(quizId)}/results`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getYearArchiveGameResults(archiveId: string, gameId: string): Promise<{ game: any; scores: any[] }> {
    const response = await fetch(`${this.API_BASE}/admin/year-end/archives/${encodeURIComponent(archiveId)}/games/${encodeURIComponent(gameId)}/results`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getYearArchiveContestResults(archiveId: string, contestId: string): Promise<{ contest: any; attempts: any[]; leaderboards: any }> {
    const response = await fetch(`${this.API_BASE}/admin/year-end/archives/${encodeURIComponent(archiveId)}/contests/${encodeURIComponent(contestId)}/results`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getYearArchiveContestAttemptDetail(archiveId: string, attemptId: string): Promise<any> {
    const response = await fetch(`${this.API_BASE}/admin/year-end/archives/${encodeURIComponent(archiveId)}/contests/attempts/${encodeURIComponent(attemptId)}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getYearArchiveBotTaskThreads(archiveId: string, taskId: string): Promise<{ task: any; threads: any[] }> {
    const response = await fetch(`${this.API_BASE}/admin/year-end/archives/${encodeURIComponent(archiveId)}/bot-tasks/${encodeURIComponent(taskId)}/threads`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getYearArchiveBotTaskThreadMessages(archiveId: string, taskId: string, threadId: string): Promise<{ task: any; thread: any; student: any; messages: any[] }> {
    const response = await fetch(`${this.API_BASE}/admin/year-end/archives/${encodeURIComponent(archiveId)}/bot-tasks/${encodeURIComponent(taskId)}/threads/${encodeURIComponent(threadId)}/messages`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getYearArchiveReviewPackageResults(archiveId: string, packageId: string): Promise<any> {
    const response = await fetch(`${this.API_BASE}/admin/year-end/archives/${encodeURIComponent(archiveId)}/review-packages/${encodeURIComponent(packageId)}/results`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getYearArchiveNoteDetail(archiveId: string, noteId: string): Promise<{ note: any }> {
    const response = await fetch(`${this.API_BASE}/admin/year-end/archives/${encodeURIComponent(archiveId)}/notes/${encodeURIComponent(noteId)}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async listYearArchiveNoteSubmissions(archiveId: string, noteId: string): Promise<{ note: any; submissions: any[]; total: number }> {
    const response = await fetch(`${this.API_BASE}/admin/year-end/archives/${encodeURIComponent(archiveId)}/notes/${encodeURIComponent(noteId)}/submissions`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  // 年度封存：學生內容（AI 對話 / AI 筆記 / 自學天地 / AppStudio）
  async listYearArchiveChatThreads(
    archiveId: string,
    params?: { subject?: string; className?: string; search?: string; includeTaskThreads?: boolean }
  ): Promise<{ threads: any[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.subject) searchParams.append('subject', params.subject);
    if (params?.className) searchParams.append('className', params.className);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.includeTaskThreads) searchParams.append('includeTaskThreads', '1');
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/admin/year-end/archives/${encodeURIComponent(archiveId)}/chats/threads${qs}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getYearArchiveChatThreadMessages(archiveId: string, threadId: string): Promise<{ thread: any; student: any; messages: any[] }> {
    const response = await fetch(`${this.API_BASE}/admin/year-end/archives/${encodeURIComponent(archiveId)}/chats/threads/${encodeURIComponent(threadId)}/messages`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async listYearArchiveAiNotes(archiveId: string, params?: { studentId?: string; className?: string; search?: string }): Promise<{ notes: any[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.studentId) searchParams.append('studentId', params.studentId);
    if (params?.className) searchParams.append('className', params.className);
    if (params?.search) searchParams.append('search', params.search);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/admin/year-end/archives/${encodeURIComponent(archiveId)}/ai-notes${qs}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getYearArchiveAiNote(archiveId: string, noteId: string): Promise<{ note: any; student: any }> {
    const response = await fetch(`${this.API_BASE}/admin/year-end/archives/${encodeURIComponent(archiveId)}/ai-notes/${encodeURIComponent(noteId)}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async listYearArchiveSelfStudyTransactions(archiveId: string, params?: { studentId?: string; className?: string }): Promise<{ transactions: any[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.studentId) searchParams.append('studentId', params.studentId);
    if (params?.className) searchParams.append('className', params.className);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/admin/year-end/archives/${encodeURIComponent(archiveId)}/self-study/transactions${qs}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async listYearArchiveAppStudioApps(archiveId: string, params?: { studentId?: string; className?: string; search?: string }): Promise<{ apps: any[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.studentId) searchParams.append('studentId', params.studentId);
    if (params?.className) searchParams.append('className', params.className);
    if (params?.search) searchParams.append('search', params.search);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/admin/year-end/archives/${encodeURIComponent(archiveId)}/app-studio/apps${qs}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getYearArchiveAppStudioAppDetail(archiveId: string, appId: string): Promise<{ app: any; owner: any; versions: any[]; submissions: any[] }> {
    const response = await fetch(`${this.API_BASE}/admin/year-end/archives/${encodeURIComponent(archiveId)}/app-studio/apps/${encodeURIComponent(appId)}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  // 作業管理（檔案總管）
  async getManageTasks(params?: { subject?: string; className?: string; includeArchived?: boolean }): Promise<{ tasks: any[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.subject) searchParams.append('subject', params.subject);
    if (params?.className) searchParams.append('className', params.className);
    if (params?.includeArchived) searchParams.append('includeArchived', '1');
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/manage/tasks${qs}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async archiveManageTask(type: 'assignment' | 'quiz' | 'game' | 'contest' | 'ai-bot' | 'note', id: string): Promise<{ message: string; task: any }> {
    const response = await fetch(`${this.API_BASE}/manage/tasks/${encodeURIComponent(type)}/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async restoreManageTask(type: 'assignment' | 'quiz' | 'game' | 'contest' | 'ai-bot' | 'note', id: string): Promise<{ message: string; task: any }> {
    const response = await fetch(`${this.API_BASE}/manage/tasks/${encodeURIComponent(type)}/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async renameManageTaskTitle(type: 'assignment' | 'quiz' | 'game' | 'contest' | 'ai-bot' | 'note', id: string, title: string): Promise<{ message: string; task: any }> {
    const response = await fetch(`${this.API_BASE}/manage/tasks/${encodeURIComponent(type)}/${encodeURIComponent(id)}/title`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ title })
    });
    return this.handleResponse(response);
  }

  // === 教師草稿（d r a f t s）===
  async listMyDrafts(params: { grade: string; folderId?: string | null }): Promise<{ drafts: any[]; total: number }> {
    const search = new URLSearchParams();
    search.append('grade', params.grade);
    if (params.folderId !== undefined) search.append('folderId', params.folderId ? params.folderId : '');
    const response = await fetch(`${this.API_BASE}/drafts/my?${search.toString()}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async listSharedDrafts(params: { grade: string; folderId?: string | null }): Promise<{ drafts: any[]; total: number }> {
    const search = new URLSearchParams();
    search.append('grade', params.grade);
    if (params.folderId !== undefined) search.append('folderId', params.folderId ? params.folderId : '');
    const response = await fetch(`${this.API_BASE}/drafts/shared?${search.toString()}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async createDraft(payload: {
    toolType: string;
    title: string;
    subject: string;
    grade: string;
    scope?: 'my' | 'shared';
    folderId?: string | null;
    contentSnapshot?: any;
  }): Promise<{ draft: any }> {
    const response = await fetch(`${this.API_BASE}/drafts`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async getDraft(draftId: string): Promise<{ draft: any }> {
    const response = await fetch(`${this.API_BASE}/drafts/${encodeURIComponent(draftId)}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async updateDraftMeta(draftId: string, patch: { title?: string; subject?: string; grade?: string; scope?: 'my' | 'shared'; folderId?: string | null }): Promise<{ draft: any }> {
    const response = await fetch(`${this.API_BASE}/drafts/${encodeURIComponent(draftId)}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(patch)
    });
    return this.handleResponse(response);
  }

  async updateDraftContent(draftId: string, contentSnapshot: any): Promise<{ draft: any }> {
    const response = await fetch(`${this.API_BASE}/drafts/${encodeURIComponent(draftId)}/content`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ contentSnapshot })
    });
    return this.handleResponse(response);
  }

  async deleteDraft(draftId: string): Promise<{ result: any }> {
    const response = await fetch(`${this.API_BASE}/drafts/${encodeURIComponent(draftId)}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async copyDraftToMy(draftId: string): Promise<{ draft: any }> {
    const response = await fetch(`${this.API_BASE}/drafts/${encodeURIComponent(draftId)}/copy-to-my`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async publishDraft(draftId: string, payload: { className: string; classFolderId: string; keepDraft?: boolean }): Promise<any> {
    const response = await fetch(`${this.API_BASE}/drafts/${encodeURIComponent(draftId)}/publish`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  // === 派發筆記（notes）===
  async createDraftNote(payload: { title: string; subject: string; className: string; classFolderId: string; targetClasses?: string[]; targetGroups?: string[] }): Promise<{ note: any }> {
    const response = await fetch(`${this.API_BASE}/notes`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async getNoteDetail(noteId: string): Promise<{ note: any }> {
    const response = await fetch(`${this.API_BASE}/notes/${encodeURIComponent(noteId)}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async updateNoteTemplate(noteId: string, templateSnapshot: any): Promise<{ note: any }> {
    const response = await fetch(`${this.API_BASE}/notes/${encodeURIComponent(noteId)}/template`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ templateSnapshot })
    });
    return this.handleResponse(response);
  }

  async publishNote(noteId: string): Promise<{ note: any; assignedStudents: number }> {
    const response = await fetch(`${this.API_BASE}/notes/${encodeURIComponent(noteId)}/publish`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async deleteNote(noteId: string): Promise<{ message: string }> {
    const response = await fetch(`${this.API_BASE}/notes/${encodeURIComponent(noteId)}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async uploadNoteAsset(noteId: string, file: File): Promise<{ asset: { id: string; mime: string; size: number; url: string } }> {
    const formData = new FormData();
    formData.append('noteId', noteId);
    formData.append('file', file);
    const response = await fetch(`${this.API_BASE}/notes/assets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`
      },
      body: formData
    });
    return this.handleResponse(response);
  }

  // Student notes
  async getStudentNotes(): Promise<{ notes: any[]; total: number }> {
    const response = await fetch(`${this.API_BASE}/notes/student`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getMyNote(noteId: string): Promise<{ note: any; submission: any }> {
    const response = await fetch(`${this.API_BASE}/notes/${encodeURIComponent(noteId)}/my`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async saveMyNoteDraft(noteId: string, snapshot: any): Promise<{ message: string; submission: any }> {
    const response = await fetch(`${this.API_BASE}/notes/${encodeURIComponent(noteId)}/my`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ snapshot })
    });
    return this.handleResponse(response);
  }

  async submitMyNote(noteId: string): Promise<{ message: string; submission: any }> {
    const response = await fetch(`${this.API_BASE}/notes/${encodeURIComponent(noteId)}/my/submit`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  // Teacher/Admin notes
  async listNoteSubmissions(noteId: string): Promise<{ note: any; submissions: any[]; total: number }> {
    const response = await fetch(`${this.API_BASE}/notes/${encodeURIComponent(noteId)}/submissions`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getNoteSubmissionDetail(noteId: string, studentId: string): Promise<{ submission: any }> {
    const response = await fetch(`${this.API_BASE}/notes/${encodeURIComponent(noteId)}/submissions/${encodeURIComponent(studentId)}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async saveNoteSubmissionSnapshot(noteId: string, studentId: string, snapshot: any): Promise<{ message: string; submission: any }> {
    const response = await fetch(
      `${this.API_BASE}/notes/${encodeURIComponent(noteId)}/submissions/${encodeURIComponent(studentId)}/snapshot`,
      {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ snapshot })
      }
    );
    return this.handleResponse(response);
  }

  async saveNoteAnnotations(
    noteId: string,
    studentId: string,
    annotations: any,
    opts?: { needsRevision?: boolean }
  ): Promise<{ message: string; submission: any }> {
    const response = await fetch(`${this.API_BASE}/notes/${encodeURIComponent(noteId)}/submissions/${encodeURIComponent(studentId)}/annotations`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ annotations, needsRevision: !!opts?.needsRevision })
    });
    return this.handleResponse(response);
  }

  async createClassFolder(className: string, payload: { parentId: string; level: 2 | 3; name: string; order?: number }): Promise<{ folder: any }> {
    const response = await fetch(`${this.API_BASE}/class-folders/${encodeURIComponent(className)}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async batchCreateClassFolders(className: string, payload: { parentId: string; level: 2 | 3; names: string[] }): Promise<{ folders: any[]; total: number }> {
    const response = await fetch(`${this.API_BASE}/class-folders/${encodeURIComponent(className)}/batch`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async updateClassFolder(className: string, folderId: string, patch: { name?: string; order?: number }): Promise<{ folder: any }> {
    const response = await fetch(`${this.API_BASE}/class-folders/${encodeURIComponent(className)}/${encodeURIComponent(folderId)}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(patch)
    });
    return this.handleResponse(response);
  }

  async archiveClassFolder(className: string, folderId: string): Promise<{ result: any }> {
    const response = await fetch(`${this.API_BASE}/class-folders/${encodeURIComponent(className)}/${encodeURIComponent(folderId)}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  // 班級資料夾：學生端（只可隱藏）
  async getMyClassFolders(): Promise<{ className: string; folders: any[]; hiddenFolderIds: string[] }> {
    const response = await fetch(`${this.API_BASE}/class-folders/me`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async hideMyClassFolder(folderId: string): Promise<{ hidden: boolean; pref: any }> {
    const response = await fetch(`${this.API_BASE}/class-folders/me/${encodeURIComponent(folderId)}/hide`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async unhideMyClassFolder(folderId: string): Promise<{ hidden: boolean; result: any }> {
    const response = await fetch(`${this.API_BASE}/class-folders/me/${encodeURIComponent(folderId)}/hide`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  // === AI筆記（儲存/資料夾）===
  async listMyAiNotes(params?: { folderId?: string | null }): Promise<{ notes: any[] }> {
    const search = new URLSearchParams();
    if (params?.folderId !== undefined) search.append('folderId', params.folderId ? String(params.folderId) : '');
    const qs = search.toString() ? `?${search.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/ai-notes/me${qs}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async createMyAiNote(payload: {
    folderId?: string | null;
    title?: string;
    sourceText?: string;
    aiResult: any;
  }): Promise<{ note: any }> {
    const response = await fetch(`${this.API_BASE}/ai-notes/me`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload || {})
    });
    return this.handleResponse(response);
  }

  async updateMyAiNote(noteId: string, patch: { folderId?: string | null; title?: string }): Promise<{ note: any }> {
    const response = await fetch(`${this.API_BASE}/ai-notes/me/${encodeURIComponent(noteId)}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(patch || {})
    });
    return this.handleResponse(response);
  }

  async deleteMyAiNote(noteId: string): Promise<{ deleted: boolean }> {
    const response = await fetch(`${this.API_BASE}/ai-notes/me/${encodeURIComponent(noteId)}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async listStudentAiNotes(studentId: string, params?: { folderId?: string | null }): Promise<{ notes: any[] }> {
    const search = new URLSearchParams();
    if (params?.folderId !== undefined) search.append('folderId', params.folderId ? String(params.folderId) : '');
    const qs = search.toString() ? `?${search.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/ai-notes/teacher/${encodeURIComponent(studentId)}${qs}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  // === 圖表生成器（儲存/資料夾）===
  async listMyCharts(): Promise<{ charts: any[] }> {
    const response = await fetch(`${this.API_BASE}/charts/me`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async createMyChart(payload: { grade?: string; folderId?: string | null; title?: string; chartSpec: any }): Promise<{ chart: any }> {
    const response = await fetch(`${this.API_BASE}/charts/me`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload || {})
    });
    return this.handleResponse(response);
  }

  async deleteMyChart(chartId: string): Promise<{ deleted: boolean }> {
    const response = await fetch(`${this.API_BASE}/charts/me/${encodeURIComponent(chartId)}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async listStudentCharts(studentId: string): Promise<{ charts: any[] }> {
    const response = await fetch(`${this.API_BASE}/charts/teacher/${encodeURIComponent(studentId)}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  // === 小測驗相關API ===

  // 創建小測驗（教師專用）
  async createQuiz(quizData: {
    title: string;
    description?: string;
    scopeText?: string;
    subject: string;
    targetClasses: string[];
    targetGroups?: string[];
    questions: Array<{
      question: string;
      image?: string;
      options: string[];
      correctAnswer: number;
    }>;
    timeLimit?: number;
    classFolderId?: string;
  }): Promise<{ message: string, quiz: any }> {
    const response = await fetch(`${this.API_BASE}/quizzes`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(quizData)
    });

    return this.handleResponse(response);
  }

  // 獲取教師的所有小測驗（可篩選）
  async getTeacherQuizzes(subject?: string, targetClass?: string, groups?: string): Promise<{ quizzes: any[], total: number }> {
    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);
    if (targetClass) params.append('targetClass', targetClass);
    if (groups) params.append('groups', groups);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/quizzes/teacher${queryString}`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // 同科同級其他教師小測驗
  async getSharedQuizzes(params: {
    subject: string;
    grade: string;
    targetClass?: string;
    groups?: string[];
  }): Promise<{ quizzes: any[]; total: number }> {
    const searchParams = new URLSearchParams();
    searchParams.append('subject', params.subject);
    searchParams.append('grade', params.grade);
    if (params.targetClass) searchParams.append('targetClass', params.targetClass);
    if (params.groups && params.groups.length > 0) searchParams.append('groups', params.groups.join(','));

    const response = await fetch(`${this.API_BASE}/quizzes/shared?${searchParams.toString()}`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // 獲取學生的小測驗列表
  async getStudentQuizzes(): Promise<{ quizzes: any[], total: number }> {
    const response = await fetch(`${this.API_BASE}/quizzes/student`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // 獲取特定小測驗詳情（學生答題用）
  async getQuizForStudent(quizId: string): Promise<{ quiz: any; mode?: string; studentResult?: any }> {
    const response = await fetch(`${this.API_BASE}/quizzes/${quizId}/take`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // 提交小測驗答案
  async submitQuizAnswer(quizId: string, answers: number[], timeSpent?: number, shuffleSeed?: string | null): Promise<{ message: string, result: any }> {
    const response = await fetch(`${this.API_BASE}/quizzes/${quizId}/submit`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ answers, timeSpent, shuffleSeed })
    });

    return this.handleResponse(response);
  }

  // AI 報告（小測驗）
  async getQuizAiReport(quizId: string, params?: { scope?: 'overall' | 'student'; studentId?: string; refresh?: boolean }): Promise<{ report: any; cached: boolean }> {
    const searchParams = new URLSearchParams();
    if (params?.scope) searchParams.append('scope', params.scope);
    if (params?.studentId) searchParams.append('studentId', params.studentId);
    if (params?.refresh) searchParams.append('refresh', '1');
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/quizzes/${quizId}/ai-report${query}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async regenerateQuizAiReport(quizId: string, params?: { scope?: 'overall' | 'student'; studentId?: string }): Promise<{ report: any; cached: boolean }> {
    const searchParams = new URLSearchParams();
    if (params?.scope) searchParams.append('scope', params.scope);
    if (params?.studentId) searchParams.append('studentId', params.studentId);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/quizzes/${quizId}/ai-report/regenerate${query}`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  // 獲取小測驗結果（教師查看）
  async getQuizResults(quizId: string): Promise<{ quiz: any, results: any[], total: number, statistics: any }> {
    const response = await fetch(`${this.API_BASE}/quizzes/${quizId}/results`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // 刪除小測驗
  async deleteQuiz(quizId: string): Promise<void> {
    const response = await fetch(`${this.API_BASE}/quizzes/${quizId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });

    await this.handleResponse(response);
  }

  // 重置所有資料（管理員專用）
  async resetAllData(): Promise<{ message: string; resetTime: string; resetBy: string }> {
    const response = await fetch(`${this.API_BASE}/users/reset-all-data`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // === 遊戲相關 API ===

  // 創建遊戲（教師專用）
  async createGame(gameData: {
    title: string;
    description?: string;
    gameType: 'maze' | 'matching' | 'tower-defense' | 'math' | 'ranger-td';
    subject: string;
    targetClasses: string[];
    targetGroups?: string[];
    questions: any[];
    difficulty?: 'easy' | 'medium' | 'hard';
    timeLimitSeconds?: number;
    livesLimit?: number | null;
    math?: any;
    rangerTd?: any;
    classFolderId?: string;
  }): Promise<{ message: string; game: any }> {
    const response = await fetch(`${this.API_BASE}/games`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(gameData)
    });

    return this.handleResponse(response);
  }

  // 獲取教師的遊戲列表
  async getTeacherGames(subject?: string, targetClass?: string, gameType?: string, groups?: string): Promise<{ games: any[]; total: number }> {
    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);
    if (targetClass) params.append('targetClass', targetClass);
    if (gameType) params.append('gameType', gameType);
    if (groups) params.append('groups', groups);

    const response = await fetch(`${this.API_BASE}/games/teacher?${params.toString()}`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // 同科同級其他教師遊戲
  async getSharedGames(params: {
    subject: string;
    grade: string;
    targetClass?: string;
    groups?: string[];
    gameType?: string;
  }): Promise<{ games: any[]; total: number }> {
    const searchParams = new URLSearchParams();
    searchParams.append('subject', params.subject);
    searchParams.append('grade', params.grade);
    if (params.targetClass) searchParams.append('targetClass', params.targetClass);
    if (params.gameType) searchParams.append('gameType', params.gameType);
    if (params.groups && params.groups.length > 0) searchParams.append('groups', params.groups.join(','));

    const response = await fetch(`${this.API_BASE}/games/shared?${searchParams.toString()}`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // 獲取學生的遊戲列表
  async getStudentGames(): Promise<{ games: any[] }> {
    const response = await fetch(`${this.API_BASE}/games/student`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // 獲取遊戲詳情（學生遊玩用）
  async getGameForStudent(gameId: string): Promise<{ game: any; completed: boolean; bestScore: number | null; attempts: number }> {
    const response = await fetch(`${this.API_BASE}/games/${gameId}/play`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // Ranger 塔防：生成某一關的數學題（學生/教師皆可用）
  async generateRangerMathStage(gameId: string, payload: {
    stageIndex: number;
  }): Promise<{ stageIndex: number; questions: any[] }> {
    const response = await fetch(`${this.API_BASE}/games/${gameId}/ranger-math-stage`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    return this.handleResponse(response);
  }

  // 提交遊戲成績
  async submitGameScore(gameId: string, scoreData: {
    score: number;
    correctAnswers: number;
    totalQuestions: number;
    timeSpent: number;
    details?: any;
  }): Promise<{ message: string; result: any }> {
    const response = await fetch(`${this.API_BASE}/games/${gameId}/score`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(scoreData)
    });

    return this.handleResponse(response);
  }

  // 獲取遊戲結果（教師查看）
  async getGameResults(gameId: string): Promise<{ game: any; scores: any[] }> {
    const response = await fetch(`${this.API_BASE}/games/${gameId}/results`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // 獲取遊戲排行榜
  async getGameLeaderboard(gameId: string, limit?: number): Promise<any> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());

    const response = await fetch(`${this.API_BASE}/games/${gameId}/leaderboard?${params.toString()}`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // 刪除遊戲
  async deleteGame(gameId: string): Promise<void> {
    const response = await fetch(`${this.API_BASE}/games/${gameId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });

    await this.handleResponse(response);
  }

  // === 問答比賽（即時 AI 生成）===

  async createContest(payload: {
    title: string;
    topic?: string;
    scopeText?: string;
    advancedOnly?: boolean;
    subject: string;
    grade: '小一' | '小二' | '小三' | '小四' | '小五' | '小六';
    questionCount: number;
    timeLimitSeconds?: number | null;
    targetClasses: string[];
    targetGroups?: string[];
    classFolderId?: string;
  }): Promise<{ message: string; contest: any }> {
    const response = await fetch(`${this.API_BASE}/contests`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async getTeacherContests(subject?: string, targetClass?: string, groups?: string): Promise<{ contests: any[]; total: number }> {
    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);
    if (targetClass) params.append('targetClass', targetClass);
    if (groups) params.append('groups', groups);
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/contests/teacher${query}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getTeacherReviewPackages(subject?: string, targetClass?: string): Promise<{ packages: any[]; total: number }> {
    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);
    if (targetClass) params.append('targetClass', targetClass);
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/review-packages/teacher${query}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getReviewPackageResults(packageId: string): Promise<any> {
    const response = await fetch(`${this.API_BASE}/review-packages/${encodeURIComponent(packageId)}/results`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async deleteReviewPackage(packageId: string): Promise<{ message: string }> {
    const response = await fetch(`${this.API_BASE}/review-packages/${encodeURIComponent(packageId)}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  // AI 報告（温習套件）
  async getReviewPackageAiReport(packageId: string, params?: { scope?: 'overall' | 'student'; studentId?: string; refresh?: boolean }): Promise<{ report: any; cached: boolean }> {
    const searchParams = new URLSearchParams();
    if (params?.scope) searchParams.append('scope', params.scope);
    if (params?.studentId) searchParams.append('studentId', params.studentId);
    if (params?.refresh) searchParams.append('refresh', '1');
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/review-packages/${encodeURIComponent(packageId)}/ai-report${query}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async regenerateReviewPackageAiReport(packageId: string, params?: { scope?: 'overall' | 'student'; studentId?: string }): Promise<{ report: any; cached: boolean }> {
    const searchParams = new URLSearchParams();
    if (params?.scope) searchParams.append('scope', params.scope);
    if (params?.studentId) searchParams.append('studentId', params.studentId);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/review-packages/${encodeURIComponent(packageId)}/ai-report/regenerate${query}`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getSharedContests(params: {
    subject: string;
    grade: string;
    targetClass?: string;
    groups?: string[];
  }): Promise<{ contests: any[]; total: number }> {
    const searchParams = new URLSearchParams();
    searchParams.append('subject', params.subject);
    searchParams.append('grade', params.grade);
    if (params.targetClass) searchParams.append('targetClass', params.targetClass);
    if (params.groups && params.groups.length > 0) searchParams.append('groups', params.groups.join(','));
    const response = await fetch(`${this.API_BASE}/contests/shared?${searchParams.toString()}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getStudentContests(): Promise<{ contests: any[]; total: number }> {
    const response = await fetch(`${this.API_BASE}/contests/student`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  // === 温習套件（review-packages）===
  async getStudentReviewPackages(): Promise<{ packages: any[]; total: number }> {
    const response = await fetch(`${this.API_BASE}/review-packages/student`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getReviewPackageForStudent(packageId: string): Promise<{ package: any; attempt: any | null }> {
    const response = await fetch(`${this.API_BASE}/review-packages/${encodeURIComponent(packageId)}/take`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async reportReviewPackageProgress(packageId: string, payload: { maxReachedSec: number; lastPositionSec: number; ended?: boolean }): Promise<{ attempt: any }> {
    const response = await fetch(`${this.API_BASE}/review-packages/${encodeURIComponent(packageId)}/progress`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async submitReviewPackageCheckpoint(packageId: string, checkpointId: string, selectedIndex: number): Promise<any> {
    const response = await fetch(`${this.API_BASE}/review-packages/${encodeURIComponent(packageId)}/checkpoints/${encodeURIComponent(checkpointId)}/submit`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ selectedIndex })
    });
    return this.handleResponse(response);
  }

  async submitReviewPackage(packageId: string): Promise<any> {
    const response = await fetch(`${this.API_BASE}/review-packages/${encodeURIComponent(packageId)}/submit`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async startContest(contestId: string): Promise<{
    contest: any;
    attempt: { id: string; startedAt: string; timeLimitSeconds: number | null; questions: Array<{ id: number; question: string; options: string[] }> };
  }> {
    const response = await fetch(`${this.API_BASE}/contests/${contestId}/start`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async submitContestAttempt(attemptId: string, payload: { answers: number[]; timeSpentSeconds?: number | null }): Promise<{ message: string; result: any }> {
    const response = await fetch(`${this.API_BASE}/contests/attempts/${attemptId}/submit`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async answerContestQuestion(attemptId: string, payload: { questionIndex: number; answerIndex: number }): Promise<{
    questionIndex: number;
    answerIndex: number;
    correctIndex: number;
    isCorrect: boolean;
    answeredCount: number;
    totalQuestions: number;
  }> {
    const response = await fetch(`${this.API_BASE}/contests/attempts/${attemptId}/answer`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  // AI 報告（問答比賽）
  async getContestAiReport(contestId: string, params?: { scope?: 'overall' | 'student'; studentId?: string; refresh?: boolean }): Promise<{ report: any; cached: boolean }> {
    const searchParams = new URLSearchParams();
    if (params?.scope) searchParams.append('scope', params.scope);
    if (params?.studentId) searchParams.append('studentId', params.studentId);
    if (params?.refresh) searchParams.append('refresh', '1');
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/contests/${contestId}/ai-report${query}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async regenerateContestAiReport(contestId: string, params?: { scope?: 'overall' | 'student'; studentId?: string }): Promise<{ report: any; cached: boolean }> {
    const searchParams = new URLSearchParams();
    if (params?.scope) searchParams.append('scope', params.scope);
    if (params?.studentId) searchParams.append('studentId', params.studentId);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/contests/${contestId}/ai-report/regenerate${query}`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  // 範圍卡（學習卡）分析：按 folderSnapshot + scopeText 聚合
  async getScopeCards(params?: { subject?: string; className?: string }): Promise<{ scopeCards: any[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.subject) searchParams.append('subject', params.subject);
    if (params?.className) searchParams.append('className', params.className);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/scope-cards${query}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getScopeCardAiReport(cardId: string, params?: { scope?: 'overall' | 'student'; studentId?: string; refresh?: boolean }): Promise<{ report: any; cached: boolean }> {
    const searchParams = new URLSearchParams();
    if (params?.scope) searchParams.append('scope', params.scope);
    if (params?.studentId) searchParams.append('studentId', params.studentId);
    if (params?.refresh) searchParams.append('refresh', '1');
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/scope-cards/${encodeURIComponent(cardId)}/ai-report${query}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async regenerateScopeCardAiReport(cardId: string, params?: { scope?: 'overall' | 'student'; studentId?: string }): Promise<{ report: any; cached: boolean }> {
    const searchParams = new URLSearchParams();
    if (params?.scope) searchParams.append('scope', params.scope);
    if (params?.studentId) searchParams.append('studentId', params.studentId);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/scope-cards/${encodeURIComponent(cardId)}/ai-report/regenerate${query}`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getContestLeaderboard(contestId: string): Promise<{ contest: any; leaderboards: any }> {
    const response = await fetch(`${this.API_BASE}/contests/${contestId}/leaderboard`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getContestResults(contestId: string): Promise<{ contest: any; attempts: any[]; leaderboards: any }> {
    const response = await fetch(`${this.API_BASE}/contests/${contestId}/results`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getContestAttemptDetail(attemptId: string): Promise<{ contest: any; attempt: any }> {
    const response = await fetch(`${this.API_BASE}/contests/attempts/${attemptId}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async deleteContest(contestId: string): Promise<void> {
    const response = await fetch(`${this.API_BASE}/contests/${contestId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    await this.handleResponse(response);
  }

  // === AI (Grok) ===
  async getAiSettings(): Promise<{ provider: string; model: string; hasApiKey: boolean; updatedAt: string | null }> {
    const response = await fetch(`${this.API_BASE}/ai/settings`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async updateAiSettings(payload: { apiKey: string }): Promise<{ provider: string; model: string; hasApiKey: boolean; updatedAt: string | null }> {
    const response = await fetch(`${this.API_BASE}/ai/settings`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async generateQuizQuestions(payload: {
    subject: string;
    grade?: '小一' | '小二' | '小三' | '小四' | '小五' | '小六';
    topic: string;
    count: number;
    scopeText?: string;
    advancedOnly?: boolean;
  }): Promise<{ questions: Array<{ question: string; options: string[]; correctIndex: number }> }> {
    const response = await fetch(`${this.API_BASE}/ai/quiz-generate`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async generateMatchingPairs(payload: {
    subject: string;
    grade?: '小一' | '小二' | '小三' | '小四' | '小五' | '小六';
    topic: string;
    count: number;
    scopeText?: string;
    advancedOnly?: boolean;
  }): Promise<{ pairs: Array<{ question: string; answer: string }> }> {
    const response = await fetch(`${this.API_BASE}/ai/pairs-generate`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async generateMathQuestions(payload: {
    grade?: '小一' | '小二' | '小三' | '小四' | '小五' | '小六';
    count: number;
    allowedOps: Array<'add' | 'sub' | 'mul' | 'div'>;
    allowParentheses: boolean;
    answerMode: 'mcq' | 'input';
    numberMode?: 'fraction' | 'decimal';
    allowNegative?: boolean;
    minValue?: number;
    maxValue?: number;
    maxDen?: number;
    maxDecimalPlaces?: number;
    promptText?: string;
  }): Promise<{ questions: any[]; answerMode: 'mcq' | 'input' }> {
    const response = await fetch(`${this.API_BASE}/ai/math-generate`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async generateMathEquationQuestions(payload: {
    grade?: '小一' | '小二' | '小三' | '小四' | '小五' | '小六';
    count: number;
    allowedOps: Array<'add' | 'sub' | 'mul' | 'div'>;
    allowParentheses: boolean;
    numberMode?: 'fraction' | 'decimal';
    allowNegative?: boolean;
    minValue?: number;
    maxValue?: number;
    maxDen?: number;
    maxDecimalPlaces?: number;
    equationSteps?: 1 | 2;
    equationAnswerType?: 'any' | 'int' | 'properFraction' | 'decimal';
    promptText?: string;
  }): Promise<{ questions: Array<{ equation: string }> }> {
    const response = await fetch(`${this.API_BASE}/ai/math-equation-generate`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  // === App Studio (WebSim-like) ===
  async generateAppStudio(payload: { prompt: string; baseIndexHtml?: string; baseTitle?: string; mode?: 'new' | 'edit' }): Promise<{ title: string; indexHtml: string; externalScripts: string[]; externalStyles: string[]; notes?: string }> {
    const response = await fetch(`${this.API_BASE}/app-studio/generate`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async listAppStudioApps(params?: { scope?: 'my' | 'public' | 'all'; sort?: 'updated' | 'popular' | 'forks' | 'submits'; includeStats?: boolean }): Promise<{ apps: any[] }> {
    const sp = new URLSearchParams();
    if (params?.scope) sp.append('scope', params.scope);
    if (params?.sort) sp.append('sort', params.sort);
    if (params?.includeStats) sp.append('includeStats', '1');
    const query = sp.toString() ? `?${sp.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/app-studio/apps${query}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async createAppStudioApp(payload?: { title?: string; visibility?: 'private' | 'public' }): Promise<{ app: any }> {
    const response = await fetch(`${this.API_BASE}/app-studio/apps`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload || {})
    });
    return this.handleResponse(response);
  }

  async getAppStudioApp(appId: string): Promise<{ app: any }> {
    const response = await fetch(`${this.API_BASE}/app-studio/apps/${appId}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async updateAppStudioApp(appId: string, patch: { title?: string; visibility?: 'private' | 'public'; folderId?: string | null }): Promise<{ app: any }> {
    const response = await fetch(`${this.API_BASE}/app-studio/apps/${appId}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(patch || {})
    });
    return this.handleResponse(response);
  }

  async forkAppStudioApp(appId: string, payload?: { versionId?: string }): Promise<{ app: any; version: any }> {
    const response = await fetch(`${this.API_BASE}/app-studio/apps/${appId}/fork`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload || {})
    });
    return this.handleResponse(response);
  }

  async listAppStudioVersions(appId: string): Promise<{ versions: any[] }> {
    const response = await fetch(`${this.API_BASE}/app-studio/apps/${appId}/versions`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getAppStudioVersion(appId: string, versionId: string): Promise<{ version: any }> {
    const response = await fetch(`${this.API_BASE}/app-studio/apps/${appId}/versions/${versionId}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async createAppStudioVersion(appId: string, payload: { title?: string; prompt?: string; indexHtml: string }): Promise<{ version: any }> {
    const response = await fetch(`${this.API_BASE}/app-studio/apps/${appId}/versions`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async submitAppStudio(appId: string, payload?: { versionId?: string; teacherId?: string }): Promise<{ submission: any }> {
    const response = await fetch(`${this.API_BASE}/app-studio/apps/${appId}/submit`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload || {})
    });
    return this.handleResponse(response);
  }

  async listAppStudioSubmissions(appId: string): Promise<{ submissions: any[] }> {
    const response = await fetch(`${this.API_BASE}/app-studio/apps/${appId}/submissions`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async listAppStudioFolders(): Promise<{ folders: any[] }> {
    const response = await fetch(`${this.API_BASE}/app-studio/me/folders`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async createAppStudioFolder(payload: { name: string }): Promise<{ folder: any }> {
    const response = await fetch(`${this.API_BASE}/app-studio/me/folders`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async updateAppStudioFolder(folderId: string, payload: { name: string }): Promise<{ folder: any }> {
    const response = await fetch(`${this.API_BASE}/app-studio/me/folders/${folderId}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  async deleteAppStudioFolder(folderId: string): Promise<any> {
    const response = await fetch(`${this.API_BASE}/app-studio/me/folders/${folderId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async listAppStudioForks(appId: string): Promise<{ forks: any[] }> {
    const response = await fetch(`${this.API_BASE}/app-studio/apps/${appId}/forks`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async listTeachers(): Promise<{ users: any[] }> {
    const response = await fetch(`${this.API_BASE}/users/teachers`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async deleteAppStudioApp(appId: string): Promise<any> {
    const response = await fetch(`${this.API_BASE}/app-studio/apps/${appId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async listAppStudioInbox(): Promise<{ submissions: any[] }> {
    const response = await fetch(`${this.API_BASE}/app-studio/submissions/inbox`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async listAppStudioMySubmissions(): Promise<{ submissions: any[] }> {
    const response = await fetch(`${this.API_BASE}/app-studio/submissions/mine`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async reviewAppStudioSubmission(submissionId: string, payload: { status?: 'pending' | 'reviewed'; rating?: number | null; comment?: string | null }): Promise<{ submission: any }> {
    const response = await fetch(`${this.API_BASE}/app-studio/submissions/${submissionId}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return this.handleResponse(response);
  }

  // === 點數系統相關API ===

  // Student端圖片生成點數方法
  async getUserPoints(): Promise<{
    currentPoints: number;
    totalReceived: number;
    totalUsed: number;
    lastUpdate: string;
  }> {
    const response = await fetch(`${this.API_BASE}/student/points/balance`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getPointsHistory(limit: number = 50): Promise<any[]> {
    const response = await fetch(`${this.API_BASE}/student/points/history?limit=${limit}`, {
      headers: this.getAuthHeaders()
    });
    const result = await this.handleResponse<{ transactions: any[] }>(response);
    return result.transactions || [];
  }

  async generateImageWithPoints(prompt: string): Promise<{
    success: boolean;
    imageUrl?: string;
    remainingPoints?: number;
    error?: string;
  }> {
    const response = await fetch(`${this.API_BASE}/student/image-generation/create`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ prompt })
    });
    return this.handleResponse(response);
  }

  // Student端獎勵積分方法
  async getRewardsBalance(): Promise<{
    currentPoints: number;
    totalReceived: number;
    totalUsed: number;
    lastUpdate: string;
    dayKey?: string;
    selfStudyDoubleUsed?: number;
    selfStudyDoubleRemaining?: number;
  }> {
    const response = await fetch(`${this.API_BASE}/student/rewards/balance`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getRewardsHistory(limit: number = 50): Promise<any[]> {
    const response = await fetch(`${this.API_BASE}/student/rewards/history?limit=${limit}`, {
      headers: this.getAuthHeaders()
    });
    const result = await this.handleResponse<{ transactions: any[] }>(response);
    return result.transactions || [];
  }

  async getRewardsLeaderboard(): Promise<{
    gradeKey: string | null;
    meUserId: string;
    myRank: number | null;
    students: Array<{ userId: string; name: string; username: string; className: string; points: number; rank: number }>;
  }> {
    const response = await fetch(`${this.API_BASE}/student/rewards/leaderboard`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async submitRewardsSelfStudyCompletion(payload: {
    sessionId: string;
    correctCount: number;
    questionCount: number;
    score?: number;
    scope?: any;
  }): Promise<{
    success: boolean;
    transaction?: any;
    created?: boolean;
    dayKey?: string;
    selfStudyDoubleUsed?: number;
    selfStudyDoubleRemaining?: number;
  }> {
    const response = await fetch(`${this.API_BASE}/student/rewards/self-study/complete`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload || {})
    });
    return this.handleResponse(response);
  }

  // Teacher/Admin 端獎勵積分管理
  async getStudentsRewards(): Promise<{ students: any[] }> {
    const response = await fetch(`${this.API_BASE}/admin/students/rewards`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async grantRewardsToStudent(userId: string, amount: number, description?: string): Promise<{ transaction: any; newBalance: number }> {
    const response = await fetch(`${this.API_BASE}/admin/students/${userId}/rewards/grant`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ amount, description })
    });
    return this.handleResponse(response);
  }

  async batchGrantRewards(studentIds: string[], amount: number, description?: string): Promise<{ transactions: any[]; affectedStudents: number }> {
    const response = await fetch(`${this.API_BASE}/admin/students/rewards/batch-grant`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ studentIds, amount, description })
    });
    return this.handleResponse(response);
  }

  async adjustStudentRewards(userId: string, newAmount: number, description?: string): Promise<{ transaction: any; newBalance: number }> {
    const response = await fetch(`${this.API_BASE}/admin/students/${userId}/rewards/adjust`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ newAmount, description })
    });
    return this.handleResponse(response);
  }

  // Admin端點數管理方法
  async getStudentsPoints(): Promise<{
    students: Array<{
      userId: string;
      username: string;
      name: string;
      class?: string;
      currentPoints: number;
      totalReceived: number;
      totalUsed: number;
      lastUpdate?: string;
    }>;
    overview: {
      totalStudents: number;
      totalPointsDistributed: number;
      totalPointsUsed: number;
      averagePointsPerStudent: number;
      studentsWithPoints: number;
      studentsWithoutPoints: number;
    };
  }> {
    const response = await fetch(`${this.API_BASE}/admin/students/points`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async grantPointsToStudent(userId: string, amount: number, description?: string): Promise<{
    transaction: any;
    newBalance: number;
  }> {
    const response = await fetch(`${this.API_BASE}/admin/students/${userId}/points/grant`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ amount, description })
    });
    return this.handleResponse(response);
  }

  async batchGrantPoints(studentIds: string[], amount: number, description?: string): Promise<{
    transactions: any[];
    affectedStudents: number;
  }> {
    const response = await fetch(`${this.API_BASE}/admin/students/points/batch-grant`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ studentIds, amount, description })
    });
    return this.handleResponse(response);
  }

  async adjustStudentPoints(userId: string, newAmount: number, description?: string): Promise<{
    transaction: any;
    newBalance: number;
  }> {
    const response = await fetch(`${this.API_BASE}/admin/students/${userId}/points/adjust`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ newAmount, description })
    });
    return this.handleResponse(response);
  }

  async getPointsTransactions(filters?: {
    userId?: string;
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    transactions: any[];
    total: number;
  }> {
    const searchParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/admin/points/transactions${query}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }
}

export const authService = new AuthService();
export type { User, LoginCredentials };
