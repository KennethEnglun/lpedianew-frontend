/**
 * 学生自主学习系统的类型定义
 * 支持AI题目生成、答题记录、学习分析等功能
 */

// 学习范围配置
export interface StudyScope {
  id: string;
  subject: string;           // 科目 (数学、英语、中文等)
  chapters: string[];        // 章节列表
  topics: string[];          // 具体主题/知识点
  difficulty: '小一' | '小二' | '小三' | '小四' | '小五' | '小六';  // 难度级别
  questionCount: number;     // 题目数量 (5-50题)
  customContent?: string;    // 自定义学习内容 (最多2000字)
  contentSource: 'chapters' | 'custom';  // 内容来源：章节选择或自定义内容
  createdAt: string;
}

// 學習卡（溫習卡）：用來把相同範圍的多次練習記錄在一起，並可重用
export interface StudyCard {
  id: string;
  studentId: string;
  name: string; // 顯示名稱（可後續改名）
  scope: StudyScope;
  scopeFingerprint: string; // 用於辨識「相同範圍」
  createdAt: string;
  updatedAt: string;
  lastStudiedAt: string | null;
  archivedAt?: string | null;
}

// 题目数据结构
export interface StudyQuestion {
  id: string;
  content: string;           // 题目内容
  options: string[];         // 选项数组 (通常4个选项)
  correctAnswer: number;     // 正确答案索引 (0-3)
  explanation: string;       // 答案解释
  topic: string;            // 所属知识点
  difficulty: '小一' | '小二' | '小三' | '小四' | '小五' | '小六';
  source: string;           // 题目来源 (章节名称或"自定义内容")
  generatedAt: string;      // 生成时间
}

// 学生答案记录
export interface StudentAnswer {
  questionId: string;
  selectedOption: number;    // 学生选择的选项索引
  isCorrect: boolean;        // 是否正确
  timeSpent: number;         // 答题用时(秒)
  answeredAt: string;        // 答题时间
}

// 学习会话(一次完整的练习)
export interface StudySession {
  id: string;
  studentId: string;
  studentName: string;
  cardId?: string;           // 對應學習卡；舊資料可能沒有
  scope: StudyScope;
  questions: StudyQuestion[];
  answers: StudentAnswer[];
  score: number;             // 得分 (0-100)
  accuracy: number;          // 正确率 (0-1)
  totalTimeSpent: number;    // 总用时(秒)
  startTime: string;
  endTime: string;
  completed: boolean;        // 是否完成
  createdAt: string;
}

// 知识点掌握情况
export interface TopicMastery {
  topic: string;
  totalQuestions: number;    // 该知识点总题数
  correctAnswers: number;    // 正确回答数
  accuracy: number;          // 正确率
  averageTime: number;       // 平均答题时间
  lastPracticed: string;     // 最后练习时间
  masteryLevel: 'weak' | 'average' | 'strong';  // 掌握程度
}

// 学习分析数据
export interface StudyAnalytics {
  id: string;
  studentId: string;
  studentName: string;
  subject: string;
  analysisDate: string;

  // 总体统计
  totalSessions: number;     // 总练习次数
  totalQuestions: number;    // 总题目数
  overallAccuracy: number;   // 总体正确率
  averageScore: number;      // 平均分数

  // 知识点分析
  topicMasteries: TopicMastery[];
  strengths: string[];       // 强项知识点 (正确率>80%)
  weaknesses: string[];      // 弱项知识点 (正确率<60%)
  needsPractice: string[];   // 需要练习的知识点

  // 学习趋势
  progressTrend: number[];   // 最近10次练习的分数趋势
  accuracyTrend: number[];   // 正确率趋势

  // AI建议
  recommendations: string[]; // AI生成的学习建议
  suggestedTopics: string[]; // 建议练习的知识点
  estimatedStudyTime: number; // 建议学习时间(小时)

  // 溫習筆記（AI 生成）
  revisionNotes?: {
    title?: string;
    sections: Array<{
      title: string;
      bullets: string[];
    }>;
  } | null;
}

// 学习统计概览
export interface StudyOverview {
  studentId: string;
  totalStudyTime: number;    // 总学习时间(小时)
  weeklyStudyTime: number;   // 本周学习时间
  sessionsThisWeek: number;  // 本周练习次数
  averageSessionScore: number; // 平均每次练习分数
  improvementRate: number;   // 进步率 (相比上周)
  currentStreak: number;     // 连续练习天数
  favoriteSubject: string;   // 最常练习的科目
}

// 内容限制配置
export const STUDY_CONTENT_LIMITS = {
  CUSTOM_CONTENT_MAX_LENGTH: 2000,  // 自定义内容最大字数
  QUESTION_COUNT_MIN: 5,            // 最少题目数
  QUESTION_COUNT_MAX: 50,           // 最多题目数
  SESSION_TIMEOUT_MINUTES: 60,     // 会话超时时间(分钟)
} as const;

// 题目生成配置
export interface QuestionGenerationConfig {
  scope: StudyScope;
  temperature: number;       // AI生成温度 (0-1, 控制创意度)
  includeExplanations: boolean; // 是否包含解释
  questionTypes: ('multiple_choice' | 'true_false' | 'fill_blank')[];
  ensureCoverage: boolean;   // 确保知识点覆盖均匀
}

// API响应类型
export interface StudyApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 学习记录查询参数
export interface StudyRecordQuery {
  studentId: string;
  subject?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'date' | 'score' | 'accuracy';
  sortOrder?: 'asc' | 'desc';
}
