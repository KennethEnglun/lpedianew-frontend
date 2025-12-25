/**
 * 学习系统工具函数
 * 包含数据验证、分析计算、存储管理等功能
 */

import type {
  StudyScope,
  StudyQuestion,
  StudySession,
  StudentAnswer,
  StudyAnalytics,
  TopicMastery,
  StudyOverview,
  STUDY_CONTENT_LIMITS
} from '../types/study';

// 内容验证函数
export const validateStudyContent = {
  /**
   * 验证自定义学习内容
   */
  customContent: (content: string): { isValid: boolean; error?: string } => {
    if (!content || content.trim().length === 0) {
      return { isValid: false, error: '学习内容不能为空' };
    }

    const trimmedContent = content.trim();

    if (trimmedContent.length > 2000) {
      return {
        isValid: false,
        error: `学习内容过长，当前 ${trimmedContent.length} 字，最多允许 2000 字`
      };
    }

    if (trimmedContent.length < 10) {
      return {
        isValid: false,
        error: '学习内容太短，至少需要 10 个字符来生成有意义的题目'
      };
    }

    return { isValid: true };
  },

  /**
   * 验证题目数量
   */
  questionCount: (count: number): { isValid: boolean; error?: string } => {
    if (count < 5) {
      return { isValid: false, error: '题目数量至少为 5 题' };
    }
    if (count > 50) {
      return { isValid: false, error: '题目数量最多为 50 题' };
    }
    return { isValid: true };
  },

  /**
   * 验证学习范围配置
   */
  studyScope: (scope: Partial<StudyScope>): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!scope.subject?.trim()) {
      errors.push('请选择学习科目');
    }

    if (!scope.difficulty) {
      errors.push('请选择难度级别');
    }

    if (scope.questionCount !== undefined) {
      const countValidation = validateStudyContent.questionCount(scope.questionCount);
      if (!countValidation.isValid) {
        errors.push(countValidation.error!);
      }
    }

    if (scope.contentSource === 'custom' && scope.customContent) {
      const contentValidation = validateStudyContent.customContent(scope.customContent);
      if (!contentValidation.isValid) {
        errors.push(contentValidation.error!);
      }
    } else if (scope.contentSource === 'chapters' && (!scope.chapters || scope.chapters.length === 0)) {
      errors.push('请至少选择一个学习章节');
    }

    return { isValid: errors.length === 0, errors };
  }
};

// 学习数据存储管理
export const studyStorage = {
  /**
   * 保存学习会话
   */
  saveSession: (session: StudySession): void => {
    const sessions = studyStorage.getAllSessions(session.studentId);
    const existingIndex = sessions.findIndex(s => s.id === session.id);

    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.unshift(session); // 新会话放在最前面
    }

    // 保留最近100次记录
    const trimmedSessions = sessions.slice(0, 100);
    localStorage.setItem(`studySessions_${session.studentId}`, JSON.stringify(trimmedSessions));
  },

  /**
   * 获取所有学习会话
   */
  getAllSessions: (studentId: string): StudySession[] => {
    try {
      const stored = localStorage.getItem(`studySessions_${studentId}`);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load study sessions:', e);
      return [];
    }
  },

  /**
   * 获取特定科目的学习会话
   */
  getSessionsBySubject: (studentId: string, subject: string): StudySession[] => {
    const allSessions = studyStorage.getAllSessions(studentId);
    return allSessions.filter(session => session.scope.subject === subject);
  },

  /**
   * 删除学习会话
   */
  deleteSession: (studentId: string, sessionId: string): void => {
    const sessions = studyStorage.getAllSessions(studentId);
    const filteredSessions = sessions.filter(s => s.id !== sessionId);
    localStorage.setItem(`studySessions_${studentId}`, JSON.stringify(filteredSessions));
  },

  /**
   * 清空所有学习记录
   */
  clearAllSessions: (studentId: string): void => {
    localStorage.removeItem(`studySessions_${studentId}`);
  }
};

// 学习数据分析函数
export const studyAnalytics = {
  /**
   * 计算会话得分
   */
  calculateSessionScore: (answers: StudentAnswer[]): number => {
    if (answers.length === 0) return 0;
    const correctCount = answers.filter(answer => answer.isCorrect).length;
    return Math.round((correctCount / answers.length) * 100);
  },

  /**
   * 计算正确率
   */
  calculateAccuracy: (answers: StudentAnswer[]): number => {
    if (answers.length === 0) return 0;
    const correctCount = answers.filter(answer => answer.isCorrect).length;
    return correctCount / answers.length;
  },

  /**
   * 生成知识点掌握情况分析
   */
  generateTopicMastery: (sessions: StudySession[]): TopicMastery[] => {
    const topicStats = new Map<string, {
      total: number;
      correct: number;
      totalTime: number;
      lastPracticed: string;
    }>();

    sessions.forEach(session => {
      session.questions.forEach((question, index) => {
        const answer = session.answers[index];
        if (!answer) return;

        const stats = topicStats.get(question.topic) || {
          total: 0,
          correct: 0,
          totalTime: 0,
          lastPracticed: session.createdAt
        };

        stats.total++;
        if (answer.isCorrect) stats.correct++;
        stats.totalTime += answer.timeSpent;

        // 更新最后练习时间
        if (new Date(session.createdAt) > new Date(stats.lastPracticed)) {
          stats.lastPracticed = session.createdAt;
        }

        topicStats.set(question.topic, stats);
      });
    });

    return Array.from(topicStats.entries()).map(([topic, stats]) => {
      const accuracy = stats.total > 0 ? stats.correct / stats.total : 0;
      return {
        topic,
        totalQuestions: stats.total,
        correctAnswers: stats.correct,
        accuracy,
        averageTime: stats.total > 0 ? stats.totalTime / stats.total : 0,
        lastPracticed: stats.lastPracticed,
        masteryLevel: (accuracy >= 0.8 ? 'strong' : accuracy >= 0.6 ? 'average' : 'weak') as 'strong' | 'average' | 'weak'
      };
    }).sort((a, b) => b.accuracy - a.accuracy); // 按正确率排序
  },

  /**
   * 生成学习分析报告
   */
  generateStudyAnalytics: (studentId: string, studentName: string, subject?: string): StudyAnalytics => {
    const allSessions = studyStorage.getAllSessions(studentId);
    const sessions = subject
      ? allSessions.filter(s => s.scope.subject === subject)
      : allSessions;

    const completedSessions = sessions.filter(s => s.completed);

    if (completedSessions.length === 0) {
      return {
        id: `analytics_${studentId}_${Date.now()}`,
        studentId,
        studentName,
        subject: subject || '全部科目',
        analysisDate: new Date().toISOString(),
        totalSessions: 0,
        totalQuestions: 0,
        overallAccuracy: 0,
        averageScore: 0,
        topicMasteries: [],
        strengths: [],
        weaknesses: [],
        needsPractice: [],
        progressTrend: [],
        accuracyTrend: [],
        recommendations: ['开始学习练习以获得个性化分析报告'],
        suggestedTopics: [],
        estimatedStudyTime: 0
      };
    }

    const totalQuestions = completedSessions.reduce((sum, s) => sum + s.questions.length, 0);
    const totalCorrect = completedSessions.reduce((sum, s) =>
      sum + s.answers.filter(a => a.isCorrect).length, 0
    );
    const overallAccuracy = totalQuestions > 0 ? totalCorrect / totalQuestions : 0;
    const averageScore = completedSessions.reduce((sum, s) => sum + s.score, 0) / completedSessions.length;

    const topicMasteries = studyAnalytics.generateTopicMastery(completedSessions);
    const strengths = topicMasteries.filter(t => t.masteryLevel === 'strong').map(t => t.topic);
    const weaknesses = topicMasteries.filter(t => t.masteryLevel === 'weak').map(t => t.topic);
    const needsPractice = topicMasteries.filter(t => t.accuracy < 0.7).map(t => t.topic);

    // 最近10次练习的趋势
    const recentSessions = completedSessions.slice(0, 10).reverse();
    const progressTrend = recentSessions.map(s => s.score);
    const accuracyTrend = recentSessions.map(s => s.accuracy);

    return {
      id: `analytics_${studentId}_${Date.now()}`,
      studentId,
      studentName,
      subject: subject || '全部科目',
      analysisDate: new Date().toISOString(),
      totalSessions: completedSessions.length,
      totalQuestions,
      overallAccuracy,
      averageScore,
      topicMasteries,
      strengths,
      weaknesses,
      needsPractice,
      progressTrend,
      accuracyTrend,
      recommendations: studyAnalytics.generateRecommendations(topicMasteries, overallAccuracy),
      suggestedTopics: needsPractice.slice(0, 5), // 推荐前5个需要练习的知识点
      estimatedStudyTime: Math.ceil(weaknesses.length * 0.5) // 每个弱项估计0.5小时
    };
  },

  /**
   * 生成学习建议
   */
  generateRecommendations: (topicMasteries: TopicMastery[], overallAccuracy: number): string[] => {
    const recommendations: string[] = [];

    if (overallAccuracy >= 0.8) {
      recommendations.push('🎉 太棒了！你的整体掌握度很好，建议挑战更高难度的题目');
    } else if (overallAccuracy >= 0.6) {
      recommendations.push('💪 你的基础不错，继续加油！重点复习薄弱知识点');
    } else {
      recommendations.push('📚 建议加强基础知识的学习，多做练习巩固');
    }

    const weakTopics = topicMasteries.filter(t => t.masteryLevel === 'weak');
    if (weakTopics.length > 0) {
      recommendations.push(`🎯 重点关注：${weakTopics.slice(0, 3).map(t => t.topic).join('、')}`);
    }

    const strongTopics = topicMasteries.filter(t => t.masteryLevel === 'strong');
    if (strongTopics.length > 0) {
      recommendations.push(`⭐ 你的优势：${strongTopics.slice(0, 3).map(t => t.topic).join('、')}`);
    }

    return recommendations;
  }
};

// 格式化工具函数
export const formatUtils = {
  /**
   * 格式化学习时长
   */
  formatDuration: (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分${secs}秒`;
    } else {
      return `${secs}秒`;
    }
  },

  /**
   * 格式化分数显示
   */
  formatScore: (score: number): string => {
    return `${Math.round(score)}分`;
  },

  /**
   * 格式化正确率
   */
  formatAccuracy: (accuracy: number): string => {
    return `${Math.round(accuracy * 100)}%`;
  },

  /**
   * 格式化日期
   */
  formatDate: (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  /**
   * 截断文本并添加省略号
   */
  truncateText: (text: string, maxLength: number = 50): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  },

  /**
   * 获取掌握度颜色
   */
  getMasteryColor: (level: 'weak' | 'average' | 'strong'): string => {
    switch (level) {
      case 'weak': return 'text-red-600 bg-red-50';
      case 'average': return 'text-yellow-600 bg-yellow-50';
      case 'strong': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  }
};

// ID生成工具
export const generateId = {
  session: () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  question: () => `question_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  answer: () => `answer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  scope: () => `scope_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
};