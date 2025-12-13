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
    avatar?: string;
    chineseGroup?: string;
    englishGroup?: string;
    mathGroup?: string;
    homeroomClass?: string;
    subjectsTaught?: string[];
    subjectGroups?: Record<string, string[]>;
  };
  lastLogin?: string;
  isActive: boolean;
}

interface AuthResponse {
  token: string;
  user: User;
}

class AuthService {
  // 預設使用生產後端，避免未設定環境變數時仍指向 localhost
  private readonly API_BASE = import.meta.env.VITE_API_BASE_URL
    || 'https://lpedianew-backend-production.up.railway.app/api';
  private readonly TOKEN_KEY = 'lpedia_auth_token';
  private readonly USER_KEY = 'lpedia_user';

  // 獲取儲存的token
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
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
      throw new Error(error.message || `HTTP Error: ${response.status}`);
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
    message: string;
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
    message: string;
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

  async getMyChatThreads(params?: { subject?: string }): Promise<{ threads: any[] }> {
    const searchParams = new URLSearchParams();
    if (params?.subject) searchParams.append('subject', params.subject);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await fetch(`${this.API_BASE}/chats/me/threads${query}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async createMyChatThread(payload: { subject?: string }): Promise<{ thread: any }> {
    const response = await fetch(`${this.API_BASE}/chats/me/threads`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload || {})
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
      teacherCode?: string;
      chineseGroup?: string;
      englishGroup?: string;
      mathGroup?: string;
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

  // 獲取教師的討論串
  async getTeacherDiscussions(): Promise<{ discussions: any[] }> {
    const response = await fetch(`${this.API_BASE}/discussions/teacher`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // === 作業管理相關API ===

  // 獲取教師的所有作業（可篩選）
  async getTeacherAssignments(subject?: string, targetClass?: string): Promise<{ assignments: any[], total: number }> {
    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);
    if (targetClass) params.append('targetClass', targetClass);

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

  // === 小測驗相關API ===

  // 創建小測驗（教師專用）
  async createQuiz(quizData: {
    title: string;
    description?: string;
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
  }): Promise<{ message: string, quiz: any }> {
    const response = await fetch(`${this.API_BASE}/quizzes`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(quizData)
    });

    return this.handleResponse(response);
  }

  // 獲取教師的所有小測驗（可篩選）
  async getTeacherQuizzes(subject?: string, targetClass?: string): Promise<{ quizzes: any[], total: number }> {
    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);
    if (targetClass) params.append('targetClass', targetClass);

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
  async submitQuizAnswer(quizId: string, answers: number[], timeSpent?: number): Promise<{ message: string, result: any }> {
    const response = await fetch(`${this.API_BASE}/quizzes/${quizId}/submit`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ answers, timeSpent })
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
    gameType: 'maze' | 'matching' | 'tower-defense';
    subject: string;
    targetClasses: string[];
    targetGroups?: string[];
    questions: Array<{
      question: string;
      answer: string;
      wrongOptions?: string[];
    }>;
    difficulty?: 'easy' | 'medium' | 'hard';
    timeLimitSeconds?: number;
  }): Promise<{ message: string; game: any }> {
    const response = await fetch(`${this.API_BASE}/games`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(gameData)
    });

    return this.handleResponse(response);
  }

  // 獲取教師的遊戲列表
  async getTeacherGames(subject?: string, targetClass?: string, gameType?: string): Promise<{ games: any[]; total: number }> {
    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);
    if (targetClass) params.append('targetClass', targetClass);
    if (gameType) params.append('gameType', gameType);

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

  // 提交遊戲成績
  async submitGameScore(gameId: string, scoreData: {
    score: number;
    correctAnswers: number;
    totalQuestions: number;
    timeSpent: number;
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

  // 刪除遊戲
  async deleteGame(gameId: string): Promise<void> {
    const response = await fetch(`${this.API_BASE}/games/${gameId}`, {
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
}

export const authService = new AuthService();
export type { User, LoginCredentials };
