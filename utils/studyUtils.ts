/**
 * 学习系统工具函数
 * 包含数据验证、分析计算、存储管理等功能
 */

import type {
  StudyScope,
  StudyQuestion,
  StudySession,
  StudentAnswer,
  StudyCard,
  StudyAnalytics,
  TopicMastery,
  StudyOverview,
  STUDY_CONTENT_LIMITS
} from '../types/study';

const normalizeString = (value: unknown) => String(value ?? '').trim();
const normalizeStringList = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value.map(v => normalizeString(v)).filter(Boolean);
};

const computeScopeFingerprint = (scope: Partial<StudyScope>): string => {
  const subject = normalizeString(scope.subject);
  const contentSource = scope.contentSource === 'custom' ? 'custom' : 'chapters';
  const difficulty = scope.difficulty ? String(scope.difficulty) : '';
  const chapters = contentSource === 'chapters' ? normalizeStringList(scope.chapters).sort() : [];
  const topics = contentSource === 'chapters' ? normalizeStringList(scope.topics).sort() : [];
  const customContent = contentSource === 'custom' ? normalizeString(scope.customContent) : '';
  return JSON.stringify({ subject, contentSource, difficulty, chapters, topics, customContent });
};

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
   * 驗證學習範圍配置
   */
  studyScope: (scope: Partial<StudyScope>): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!scope.subject?.trim()) {
      errors.push('請選擇學習科目');
    }

    if (!scope.difficulty) {
      errors.push('請選擇難度級別');
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
      errors.push('請至少選擇一個學習章節');
    }

    return { isValid: errors.length === 0, errors };
  }
};

// 學習數據存儲管理
export const studyStorage = {
  /**
   * 保存学习会话
   */
  saveSession: (session: StudySession): void => {
    // 對舊資料相容：確保每次練習都歸屬到一張「學習卡」
    if (!session.cardId) {
      const card = studyCardStorage.ensureCardForScope(session.studentId, session.scope);
      session.cardId = card.id;
    }
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

// 學習卡存儲：把相同範圍的練習「聚合」到同一張卡
export const studyCardStorage = {
  getAllCards: (studentId: string): StudyCard[] => {
    try {
      const stored = localStorage.getItem(`studyCards_${studentId}`);
      const cards = stored ? JSON.parse(stored) : [];
      return Array.isArray(cards) ? cards : [];
    } catch (e) {
      console.error('Failed to load study cards:', e);
      return [];
    }
  },

  saveAllCards: (studentId: string, cards: StudyCard[]): void => {
    localStorage.setItem(`studyCards_${studentId}`, JSON.stringify(cards));
  },

  upsertCard: (studentId: string, card: StudyCard): StudyCard => {
    const cards = studyCardStorage.getAllCards(studentId);
    const idx = cards.findIndex(c => c.id === card.id);
    if (idx >= 0) cards[idx] = card;
    else cards.unshift(card);
    studyCardStorage.saveAllCards(studentId, cards);
    return card;
  },

  ensureCardForScope: (studentId: string, scope: Partial<StudyScope>): StudyCard => {
    const now = new Date().toISOString();
    const subject = normalizeString(scope.subject);
    const contentSource = scope.contentSource === 'custom' ? 'custom' : 'chapters';
    const difficulty = (scope.difficulty as StudyScope['difficulty']) || '小三';
    const questionCount = Number(scope.questionCount) || 10;
    const chapters = contentSource === 'chapters' ? normalizeStringList(scope.chapters) : [];
    const topics = contentSource === 'chapters' ? normalizeStringList(scope.topics) : [];
    const customContent = contentSource === 'custom' ? normalizeString(scope.customContent) : '';

    const scopeFingerprint = computeScopeFingerprint({
      subject,
      contentSource,
      difficulty,
      chapters,
      topics,
      customContent
    });

    const cards = studyCardStorage.getAllCards(studentId);
    const existing = cards.find(c => c && c.scopeFingerprint === scopeFingerprint && !c.archivedAt);
    if (existing) {
      const next: StudyCard = {
        ...existing,
        updatedAt: now,
        scope: {
          ...existing.scope,
          subject,
          contentSource,
          difficulty,
          chapters,
          topics,
          customContent: contentSource === 'custom' ? customContent : undefined,
          questionCount
        }
      };
      return studyCardStorage.upsertCard(studentId, next);
    }

    const cardId = generateId.card();
    const fullScope: StudyScope = {
      id: cardId,
      subject,
      chapters,
      topics,
      difficulty,
      questionCount,
      ...(contentSource === 'custom' ? { customContent } : {}),
      contentSource,
      createdAt: now
    };

    const card: StudyCard = {
      id: cardId,
      studentId,
      name: studyAnalytics.getScopeDescription(fullScope),
      scope: fullScope,
      scopeFingerprint,
      createdAt: now,
      updatedAt: now,
      lastStudiedAt: null,
      archivedAt: null
    };

    return studyCardStorage.upsertCard(studentId, card);
  },

  touchCardStudiedAt: (studentId: string, cardId: string, studiedAt: string): void => {
    const cards = studyCardStorage.getAllCards(studentId);
    const idx = cards.findIndex(c => c.id === cardId);
    if (idx === -1) return;
    cards[idx] = {
      ...cards[idx],
      updatedAt: new Date().toISOString(),
      lastStudiedAt: studiedAt
    };
    studyCardStorage.saveAllCards(studentId, cards);
  },

  // 將舊的 session（沒有 cardId）補齊，並建立對應學習卡
  ensureCardsForExistingSessions: (studentId: string): void => {
    const sessions = studyStorage.getAllSessions(studentId);
    if (sessions.length === 0) return;

    let changed = false;
    const next = sessions.map((s) => {
      if (s?.cardId) return s;
      const card = studyCardStorage.ensureCardForScope(studentId, s.scope);
      changed = true;
      return { ...s, cardId: card.id };
    });

    if (changed) {
      localStorage.setItem(`studySessions_${studentId}`, JSON.stringify(next));
    }
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
  generateStudyAnalytics: (studentId: string, studentName: string, scope?: Partial<StudyScope>): StudyAnalytics => {
    const allSessions = studyStorage.getAllSessions(studentId);
    const sessions = scope
      ? allSessions.filter(s => studyAnalytics.isSimilarScope(s.scope, scope))
      : allSessions;

    const completedSessions = sessions.filter(s => s.completed);

    if (completedSessions.length === 0) {
      return {
        id: `analytics_${studentId}_${Date.now()}`,
        studentId,
        studentName,
        subject: scope ? studyAnalytics.getScopeDescription(scope) : '全部學習記錄',
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
      subject: scope ? studyAnalytics.getScopeDescription(scope) : '全部學習記錄',
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
      recommendations.push('🎉 太棒了！你的整體掌握度很好，建議挑戰更高難度的題目。');
    } else if (overallAccuracy >= 0.6) {
      recommendations.push('💪 你的基礎不錯，繼續加油！建議重點複習較薄弱的知識點。');
    } else {
      recommendations.push('📚 建議加強基礎知識的學習，多做練習以鞏固。');
    }

    const weakTopics = topicMasteries.filter(t => t.masteryLevel === 'weak');
    if (weakTopics.length > 0) {
      recommendations.push(`🎯 重點關注：${weakTopics.slice(0, 3).map(t => t.topic).join('、')}`);
    }

    const strongTopics = topicMasteries.filter(t => t.masteryLevel === 'strong');
    if (strongTopics.length > 0) {
      recommendations.push(`⭐ 你的優勢：${strongTopics.slice(0, 3).map(t => t.topic).join('、')}`);
    }

    return recommendations;
  },

  /**
   * 判斷兩個學習範圍是否相似（用於分析分組）
   */
  isSimilarScope: (scope1: StudyScope, scope2: Partial<StudyScope>): boolean => {
    // 科目必須相同
    if (scope1.subject !== scope2.subject) return false;

    // 若有指定難度，必須相同
    if (scope2.difficulty && scope1.difficulty !== scope2.difficulty) return false;

    // 允許只用 subject（或 subject+difficulty）來做粗粒度篩選
    const inferredSource = scope2.contentSource
      || (scope2.customContent ? 'custom' : ((scope2.chapters && scope2.chapters.length > 0) || (scope2.topics && scope2.topics.length > 0) ? 'chapters' : null));
    if (!inferredSource) return true;

    // 如果是自定義內容，比較內容
    if (inferredSource === 'custom') {
      if (scope1.contentSource !== 'custom') return false;
      return normalizeString(scope1.customContent) === normalizeString(scope2.customContent);
    }

    // 如果是章節內容，比較章節和知識點
    if (inferredSource === 'chapters') {
      if (scope1.contentSource !== 'chapters') return false;
      const chapters1 = scope1.chapters?.sort().join(',') || '';
      const chapters2 = Array.isArray(scope2.chapters) ? [...scope2.chapters].sort().join(',') : '';
      const topics1 = scope1.topics?.sort().join(',') || '';
      const topics2 = Array.isArray(scope2.topics) ? [...scope2.topics].sort().join(',') : '';

      return chapters1 === chapters2 && topics1 === topics2;
    }

    return false;
  },

  /**
   * 生成學習範圍的描述文字
   */
  getScopeDescription: (scope: Partial<StudyScope>): string => {
    if (!scope.subject) return '未指定學習範圍';

    let description = scope.subject;

    if (scope.contentSource === 'custom') {
      description += ' - 自定義內容';
    } else if (scope.chapters && scope.chapters.length > 0) {
      description += ` - ${scope.chapters.join('、')}`;
      if (scope.topics && scope.topics.length > 0) {
        description += ` (${scope.topics.join('、')})`;
      }
    } else if (scope.topics && scope.topics.length > 0) {
      description += ` - ${scope.topics.join('、')}`;
    }

    return description;
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
      return `${hours}小時${minutes}分鐘`;
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
    return new Date(dateString).toLocaleDateString('zh-HK', {
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
  scope: () => `scope_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  card: () => `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
};
