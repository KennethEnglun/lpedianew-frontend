/**
 * AI 题目生成服务
 * 根据学习范围生成个性化题目
 */

import type {
  StudyScope,
  StudyQuestion,
  QuestionGenerationConfig,
  StudyApiResponse
} from '../types/study';
import { authService } from './authService';
import { generateId } from '../utils/studyUtils';

// 题目生成服务类
export class QuestionGeneratorService {
  /**
   * 根据学习范围生成题目
   */
  static async generateQuestions(scope: StudyScope): Promise<StudyApiResponse<StudyQuestion[]>> {
    try {
      const prompt = QuestionGeneratorService.buildGenerationPrompt(scope);

      // 调用现有的聊天服务生成题目
      const response = await authService.sendChatMessage({
        message: prompt,
        subject: scope.subject, // 添加科目参数
        // 可以创建一个专门的机器人来生成题目，或使用全局聊天
        botId: undefined // 使用全局聊天
      });

      if (!response.assistantMessage?.content) {
        throw new Error('AI 响应为空');
      }

      const questions = QuestionGeneratorService.parseAIResponse(
        response.assistantMessage.content,
        scope
      );

      return {
        success: true,
        data: questions,
        message: `成功生成 ${questions.length} 道题目`
      };

    } catch (error) {
      console.error('题目生成失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '题目生成失败'
      };
    }
  }

  /**
   * 构建AI生成题目的提示词
   */
  private static buildGenerationPrompt(scope: StudyScope): string {
    const difficultyText = `${scope.difficulty}程度`;

    let contentSection = '';
    if (scope.contentSource === 'custom' && scope.customContent) {
      contentSection = `
学习内容：
${scope.customContent}

请根据以上学习内容生成题目。`;
    } else {
      contentSection = `
学习范围：
- 科目：${scope.subject}
- 章节：${scope.chapters.join('、')}
- 知识点：${scope.topics.join('、')}`;
    }

    return `你是一位专业的小學教育专家，需要为学生生成 ${scope.questionCount} 道${difficultyText}的选择题。

${contentSection}

请严格按照以下要求生成题目：

1. 每道题目必须包含：
   - 题目内容（清晰、准确、适合小學生理解）
   - 4个选项（标记为A、B、C、D）
   - 正确答案（明确指出是A、B、C或D）
   - 详细解释（用小學生能懂的語言說明為什麼這個答案正確）

2. 题目要求：
   - ${difficultyText}，適合小學生認知水平和語言習慣
   - 覆盖不同知识点，避免重复
   - 题目表述清晰簡單，避免歧义和複雜詞彙
   - 選項長度適中，干擾項合理但不混淆

3. 输出格式（严格按照JSON格式）：
\`\`\`json
[
  {
    "question": "题目内容",
    "options": ["A选项", "B选项", "C选项", "D选项"],
    "correctAnswer": 0,
    "explanation": "详细解释",
    "topic": "知识点名称"
  }
]
\`\`\`

注意：
- correctAnswer 使用数字索引（0=A, 1=B, 2=C, 3=D）
- 确保JSON格式正确，可以被程序解析
- 题目内容要有教育价值，符合学习目标

请立即开始生成 ${scope.questionCount} 道题目：`;
  }

  /**
   * 解析AI响应，提取题目数据
   */
  private static parseAIResponse(content: string, scope: StudyScope): StudyQuestion[] {
    try {
      // 尝试提取JSON内容
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
                       content.match(/\[[\s\S]*?\]/);

      if (!jsonMatch) {
        throw new Error('无法找到有效的JSON格式题目数据');
      }

      const jsonContent = jsonMatch[1] || jsonMatch[0];
      const questionsData = JSON.parse(jsonContent);

      if (!Array.isArray(questionsData)) {
        throw new Error('题目数据格式不正确');
      }

      // 转换为 StudyQuestion 格式
      const questions: StudyQuestion[] = questionsData.map((item: any, index: number) => {
        // 验证必要字段
        if (!item.question || !Array.isArray(item.options) || item.options.length !== 4) {
          throw new Error(`第 ${index + 1} 道题目格式不完整`);
        }

        if (typeof item.correctAnswer !== 'number' || item.correctAnswer < 0 || item.correctAnswer > 3) {
          throw new Error(`第 ${index + 1} 道题目的正确答案格式错误`);
        }

        return {
          id: generateId.question(),
          content: String(item.question || '').trim(),
          options: item.options.map((opt: any) => String(opt || '').trim()),
          correctAnswer: Number(item.correctAnswer),
          explanation: String(item.explanation || '').trim(),
          topic: String(item.topic || scope.topics[0] || '一般知识').trim(),
          difficulty: scope.difficulty,
          source: scope.contentSource === 'custom' ? '自定义内容' : scope.chapters.join('、'),
          generatedAt: new Date().toISOString()
        };
      });

      // 验证生成的题目数量
      if (questions.length === 0) {
        throw new Error('没有生成任何题目');
      }

      console.log(`成功解析 ${questions.length} 道题目`);
      return questions;

    } catch (error) {
      console.error('解析AI响应失败:', error);

      // 如果解析失败，生成备用题目
      return QuestionGeneratorService.generateFallbackQuestions(scope);
    }
  }

  /**
   * 生成备用题目（当AI生成失败时）
   */
  private static generateFallbackQuestions(scope: StudyScope): StudyQuestion[] {
    const fallbackQuestions: StudyQuestion[] = [];
    const questionCount = Math.min(scope.questionCount, 5); // 最多生成5道备用题目

    for (let i = 0; i < questionCount; i++) {
      const topic = scope.topics[i % scope.topics.length] || '基础知识';

      fallbackQuestions.push({
        id: generateId.question(),
        content: `关于"${topic}"的选择题 ${i + 1}`,
        options: [
          '选项 A',
          '选项 B',
          '选项 C',
          '选项 D'
        ],
        correctAnswer: 0, // 默认A选项为正确答案
        explanation: '这是一道示例题目，请重新生成题目。',
        topic: topic,
        difficulty: scope.difficulty,
        source: scope.contentSource === 'custom' ? '自定义内容' : scope.chapters.join('、'),
        generatedAt: new Date().toISOString()
      });
    }

    return fallbackQuestions;
  }

  /**
   * 验证生成的题目质量
   */
  static validateQuestions(questions: StudyQuestion[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    questions.forEach((question, index) => {
      const questionNum = index + 1;

      if (!question.content || question.content.trim().length < 5) {
        errors.push(`第 ${questionNum} 题：题目内容太短`);
      }

      if (question.options.length !== 4) {
        errors.push(`第 ${questionNum} 题：选项数量不正确（需要4个）`);
      }

      if (question.correctAnswer < 0 || question.correctAnswer > 3) {
        errors.push(`第 ${questionNum} 题：正确答案索引无效`);
      }

      if (question.options.some(opt => !opt || opt.trim().length === 0)) {
        errors.push(`第 ${questionNum} 题：存在空选项`);
      }

      if (!question.explanation || question.explanation.trim().length < 5) {
        errors.push(`第 ${questionNum} 题：解释内容太短`);
      }
    });

    return { isValid: errors.length === 0, errors };
  }

  /**
   * 生成题目预览（不调用AI，用于UI测试）
   */
  static generatePreviewQuestions(scope: StudyScope): StudyQuestion[] {
    const previewQuestions: StudyQuestion[] = [];
    const sampleTopics = scope.topics.length > 0 ? scope.topics : ['基础概念', '应用技能', '综合分析'];

    for (let i = 0; i < Math.min(scope.questionCount, 3); i++) {
      const topic = sampleTopics[i % sampleTopics.length];

      previewQuestions.push({
        id: generateId.question(),
        content: `这是关于"${topic}"的${scope.difficulty}程度题目示例`,
        options: [
          '这是选项 A',
          '这是选项 B',
          '这是选项 C',
          '这是选项 D'
        ],
        correctAnswer: i % 4, // 轮换正确答案
        explanation: `这是第 ${i + 1} 题的解释说明，会详细说明为什么选择这个答案。`,
        topic: topic,
        difficulty: scope.difficulty,
        source: scope.contentSource === 'custom' ? '自定义内容预览' : scope.chapters.join('、'),
        generatedAt: new Date().toISOString()
      });
    }

    return previewQuestions;
  }
}

// 导出服务实例
export const questionGenerator = QuestionGeneratorService;