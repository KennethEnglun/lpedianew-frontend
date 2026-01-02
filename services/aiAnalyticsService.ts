/**
 * AI學習分析服務
 * 提供智能學習分析和個性化建議
 */

import type {
  StudyAnalytics,
  StudySession,
  TopicMastery,
  StudyApiResponse
} from '../types/study';
import { authService } from './authService';
import { studyStorage, studyAnalytics } from '../utils/studyUtils';

export class AIAnalyticsService {
  /**
   * 生成AI增強的學習分析報告
   */
  static async generateEnhancedAnalytics(
    studentId: string,
    studentName: string,
    subject?: string
  ): Promise<StudyApiResponse<StudyAnalytics>> {
    try {
      // 首先生成基礎分析
      const basicAnalytics = studyAnalytics.generateStudyAnalytics(
        studentId,
        studentName,
        subject ? { subject } : undefined
      );

      if (basicAnalytics.totalSessions === 0) {
        return {
          success: true,
          data: basicAnalytics,
          message: '暫無學習數據，建議開始練習以獲得分析報告'
        };
      }

      // 如果有學習數據，使用AI增強分析
      const enhancedAnalytics = await AIAnalyticsService.enhanceAnalyticsWithAI(basicAnalytics);

      return {
        success: true,
        data: enhancedAnalytics,
        message: `成功生成 ${enhancedAnalytics.studentName} 的AI學習分析報告`
      };

    } catch (error) {
      console.error('AI分析生成失敗:', error);

      // 降級到基礎分析
      const fallbackAnalytics = studyAnalytics.generateStudyAnalytics(
        studentId,
        studentName,
        subject ? { subject } : undefined
      );

      return {
        success: true,
        data: fallbackAnalytics,
        message: 'AI分析暫時不可用，已生成基礎分析報告'
      };
    }
  }

  /**
   * 使用AI增強分析報告
   */
  private static async enhanceAnalyticsWithAI(basicAnalytics: StudyAnalytics): Promise<StudyAnalytics> {
    try {
      const analysisPrompt = AIAnalyticsService.buildAnalysisPrompt(basicAnalytics);

      const response = await authService.sendChatMessage({
        message: analysisPrompt,
        botId: undefined // 使用全局聊天
      });

      if (!response.assistantMessage?.content) {
        throw new Error('AI分析響應為空');
      }

      const aiInsights = AIAnalyticsService.parseAIAnalysis(response.assistantMessage.content);

      // 合併AI見解到基礎分析中
      return {
        ...basicAnalytics,
        recommendations: [
          ...aiInsights.recommendations,
          ...basicAnalytics.recommendations
        ].slice(0, 8), // 限制建議數量
        strengths: aiInsights.strengths.length > 0 ? aiInsights.strengths : basicAnalytics.strengths,
        weaknesses: aiInsights.weaknesses.length > 0 ? aiInsights.weaknesses : basicAnalytics.weaknesses,
        suggestedTopics: [
          ...aiInsights.suggestedTopics,
          ...basicAnalytics.suggestedTopics
        ].slice(0, 6), // 限制推薦知識點數量
        estimatedStudyTime: aiInsights.estimatedStudyTime || basicAnalytics.estimatedStudyTime
      };

    } catch (error) {
      console.error('AI增強分析失敗:', error);
      return basicAnalytics; // 返回基礎分析
    }
  }

  /**
   * 構建AI分析提示詞
   */
  private static buildAnalysisPrompt(analytics: StudyAnalytics): string {
    const topicStats = analytics.topicMasteries.map(tm =>
      `${tm.topic}: ${(tm.accuracy * 100).toFixed(1)}% (${tm.totalQuestions}題, ${tm.masteryLevel})`
    ).join('\n');

    const progressData = analytics.progressTrend.length > 0
      ? `最近分數趨勢: ${analytics.progressTrend.join(', ')}`
      : '';

    const accuracyData = analytics.accuracyTrend.length > 0
      ? `最近正確率趨勢: ${analytics.accuracyTrend.map(a => (a * 100).toFixed(1) + '%').join(', ')}`
      : '';

    return `你是一位專業的教育顧問和學習分析專家，請為學生提供詳細的學習分析和建議。
請使用「繁體中文書面語」（香港），避免簡體中文、口語、潮語、網絡語。

學生學習數據分析：
- 學生姓名: ${analytics.studentName}
- 學習科目: ${analytics.subject}
- 總練習次數: ${analytics.totalSessions}次
- 總題目數量: ${analytics.totalQuestions}題
- 整體正確率: ${(analytics.overallAccuracy * 100).toFixed(1)}%
- 平均分數: ${analytics.averageScore.toFixed(1)}分

知識點掌握情況:
${topicStats}

學習趨勢:
${progressData}
${accuracyData}

當前優勢知識點: ${analytics.strengths.join('、') || '待識別'}
當前薄弱知識點: ${analytics.weaknesses.join('、') || '無'}

請基於以上數據，提供以下分析（嚴格按照 JSON 格式輸出；只輸出 JSON，不要解釋、不要 code block）：

{
  "recommendations": [
    "根據數據提供的具體學習建議 1",
    "根據數據提供的具體學習建議 2",
    "根據數據提供的具體學習建議 3",
    "根據數據提供的具體學習建議 4"
  ],
  "strengths": [
    "基於正確率識別的優勢知識點1",
    "基於正確率識別的優勢知識點2"
  ],
  "weaknesses": [
    "基於正確率識別的薄弱知識點1",
    "基於正確率識別的薄弱知識點2"
  ],
  "suggestedTopics": [
    "需要重點練習的知識點1",
    "需要重點練習的知識點2",
    "需要重點練習的知識點3"
  ],
  "estimatedStudyTime": 2.5
}

分析要求：
1. recommendations: 提供4-6條具體、可執行的學習建議
2. strengths: 基於正確率≥80%的知識點識別優勢
3. weaknesses: 基於正確率<60%的知識點識別弱項
4. suggestedTopics: 推薦需要加強練習的具體知識點
5. estimatedStudyTime: 預估提升薄弱知識點所需的學習時間（小時）

請確保分析客觀、專業，建議實用且針對性強。`;
  }

  /**
   * 解析AI分析響應
   */
  private static parseAIAnalysis(content: string): {
    recommendations: string[];
    strengths: string[];
    weaknesses: string[];
    suggestedTopics: string[];
    estimatedStudyTime: number;
  } {
    try {
      // 嘗試提取JSON內容
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
                       content.match(/\{[\s\S]*?\}/);

      if (!jsonMatch) {
        throw new Error('無法找到有效的JSON格式分析數據');
      }

      const jsonContent = jsonMatch[1] || jsonMatch[0];
      const analysisData = JSON.parse(jsonContent);

      return {
        recommendations: Array.isArray(analysisData.recommendations)
          ? analysisData.recommendations.slice(0, 6).filter(Boolean)
          : [],
        strengths: Array.isArray(analysisData.strengths)
          ? analysisData.strengths.slice(0, 5).filter(Boolean)
          : [],
        weaknesses: Array.isArray(analysisData.weaknesses)
          ? analysisData.weaknesses.slice(0, 5).filter(Boolean)
          : [],
        suggestedTopics: Array.isArray(analysisData.suggestedTopics)
          ? analysisData.suggestedTopics.slice(0, 6).filter(Boolean)
          : [],
        estimatedStudyTime: typeof analysisData.estimatedStudyTime === 'number'
          ? Math.max(0, Math.min(analysisData.estimatedStudyTime, 20))
          : 0
      };

    } catch (error) {
      console.error('解析AI分析響應失敗:', error);
      return {
        recommendations: [
          '建議定期複習錯誤題目，加深理解。',
          '針對較薄弱的知識點進行重點練習。',
          '保持每日練習的習慣，維持學習連續性。',
          '嘗試不同難度的題目，循序漸進地提升。'
        ],
        strengths: [],
        weaknesses: [],
        suggestedTopics: [],
        estimatedStudyTime: 2
      };
    }
  }

  /**
   * 生成學習建議總結
   */
  static generateStudySummary(analytics: StudyAnalytics): string {
    const { totalSessions, overallAccuracy, averageScore, strengths, weaknesses } = analytics;

    if (totalSessions === 0) {
      return '開始第一次自學練習，建立學習基礎！';
    }

    let summary = `完成了 ${totalSessions} 次練習，`;

    if (overallAccuracy >= 0.8) {
      summary += '表現優秀！';
    } else if (overallAccuracy >= 0.6) {
      summary += '表現良好，';
    } else {
      summary += '還有進步空間，';
    }

    summary += `平均分數 ${Math.round(averageScore)} 分，正確率 ${(overallAccuracy * 100).toFixed(1)}%。`;

    if (strengths.length > 0) {
      summary += ` 在 ${strengths.slice(0, 2).join('、')} 方面表現突出。`;
    }

    if (weaknesses.length > 0) {
      summary += ` 建議加強 ${weaknesses.slice(0, 2).join('、')} 的練習。`;
    }

    return summary;
  }

  /**
   * 獲取下次練習建議
   */
  static getNextPracticeRecommendation(studentId: string, subject?: string): {
    recommendedTopics: string[];
    recommendedDifficulty: 'easy' | 'medium' | 'hard';
    message: string;
  } {
    const sessions = studyStorage.getAllSessions(studentId);
    const filteredSessions = subject
      ? sessions.filter(s => s.scope.subject === subject)
      : sessions;

    const completedSessions = filteredSessions.filter(s => s.completed);

    if (completedSessions.length === 0) {
      return {
        recommendedTopics: [],
        recommendedDifficulty: 'easy',
        message: '建議從基礎題目開始練習，建立學習信心。'
      };
    }

    const analytics = studyAnalytics.generateStudyAnalytics(studentId, '', subject);
    const weakTopics = analytics.topicMasteries
      .filter(tm => tm.masteryLevel === 'weak')
      .map(tm => tm.topic)
      .slice(0, 3);

    const avgAccuracy = analytics.overallAccuracy;
    const recommendedDifficulty: 'easy' | 'medium' | 'hard' =
      avgAccuracy >= 0.8 ? 'hard' :
      avgAccuracy >= 0.6 ? 'medium' : 'easy';

    let message = '';
    if (weakTopics.length > 0) {
      message = `建議重點練習 ${weakTopics.join('、')} 等知識點，選擇${
        recommendedDifficulty === 'easy' ? '基礎' :
        recommendedDifficulty === 'medium' ? '中等' : '困難'
      }難度。`;
    } else {
      message = `表現優秀！建議挑戰${
        recommendedDifficulty === 'hard' ? '高難度' : '更高難度'
      }題目。`;
    }

    return {
      recommendedTopics: weakTopics,
      recommendedDifficulty,
      message
    };
  }
}

// 導出服務實例
export const aiAnalyticsService = AIAnalyticsService;
