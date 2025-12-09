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

  // 檢查是否已登入
  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      // 檢查token是否過期
      const payload = JSON.parse(atob(token.split('.')[1]));
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
    questions: Array<{
      question: string;
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

  // 獲取學生的小測驗列表
  async getStudentQuizzes(): Promise<{ quizzes: any[], total: number }> {
    const response = await fetch(`${this.API_BASE}/quizzes/student`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // 獲取特定小測驗詳情（學生答題用）
  async getQuizForStudent(quizId: string): Promise<{ quiz: any }> {
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
}

export const authService = new AuthService();
export type { User, LoginCredentials };