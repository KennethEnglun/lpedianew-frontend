/**
 * AI 題目生成服務
 * 根據學習範圍生成個人化題目
 */

import type {
  StudyScope,
  StudyQuestion,
  QuestionGenerationConfig,
  StudyApiResponse
} from '../types/study';
import { authService } from './authService';
import { generateId } from '../utils/studyUtils';

const createNonce = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const shuffleInPlace = <T,>(arr: T[]): T[] => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const shuffleQuestionOptions = (q: StudyQuestion): StudyQuestion => {
  const options = Array.isArray(q.options) ? q.options.slice() : [];
  if (options.length !== 4) return q;
  const correct = Number(q.correctAnswer);
  if (!Number.isInteger(correct) || correct < 0 || correct > 3) return q;
  const tagged = options.map((opt, idx) => ({ opt, idx }));
  shuffleInPlace(tagged);
  const nextCorrect = tagged.findIndex((t) => t.idx === correct);
  return {
    ...q,
    options: tagged.map((t) => t.opt),
    correctAnswer: nextCorrect >= 0 ? nextCorrect : 0
  };
};

// 題目生成服務類
export class QuestionGeneratorService {
  /**
   * 根據學習範圍生成題目
   */
  static async generateQuestions(scope: StudyScope): Promise<StudyApiResponse<StudyQuestion[]>> {
    try {
      const nonce = createNonce();
      const prompt = QuestionGeneratorService.buildGenerationPrompt(scope, nonce);

      // 調用現有的聊天服務生成題目
      const response = await authService.sendChatMessage({
        message: prompt,
        subject: scope.subject, // 添加科目參數
        // 可以建立一個專門的機器人來生成題目，或使用全局聊天
        botId: undefined, // 使用全局聊天
        ephemeral: true // 不寫入 AI 對話紀錄（避免污染學生的聊天記錄）
      });

      if (!response.assistantMessage?.content) {
        throw new Error('AI 回應為空');
      }

      const questions = QuestionGeneratorService.parseAIResponse(
        response.assistantMessage.content,
        scope
      );

      return {
        success: true,
        data: questions,
        message: `成功生成 ${questions.length} 道題目`
      };

    } catch (error) {
      console.error('題目生成失敗:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '題目生成失敗'
      };
    }
  }

  /**
   * 構建 AI 生成題目的提示詞
   */
  private static buildGenerationPrompt(scope: StudyScope, nonce: string): string {
    const difficultyText = `${scope.difficulty}程度`;

    let contentSection = '';
    if (scope.contentSource === 'custom' && scope.customContent) {
      contentSection = `
學習內容：
${scope.customContent}

請根據以上學習內容生成題目。`;
    } else {
      contentSection = `
學習範圍：
- 科目：${scope.subject}
- 章節：${scope.chapters.join('、')}
- 知識點：${scope.topics.join('、')}`;
    }

    return `你是一位香港小學教育專家，需要為學生生成 ${scope.questionCount} 道${difficultyText}的選擇題。

${contentSection}

請嚴格按照以下要求生成題目：

【語言要求（必須嚴格遵守）】
- 只使用「香港繁體中文」書面語（不得出現簡體字／內地用語）
- 用詞清晰、正式，適合香港小學生理解

1. 每道題目必須包含：
   - 題目內容（清晰、準確、適合小學生理解）
   - 4 個選項（A、B、C、D）
   - 正確答案（用 correctAnswer 的數字索引表示：0=A, 1=B, 2=C, 3=D）
   - 詳細解釋（用小學生能懂的語言說明為什麼這個答案正確；請不要寫「答案是A/B/C/D」這類字樣，改用「正確選項的內容」來解釋，避免選項順序調整後解釋不一致）

2. 題目要求：
   - ${difficultyText}，適合小學生認知水平與語言習慣
   - 覆蓋不同知識點，避免重複
   - 題目表述清晰簡單，避免歧義和複雜詞彙
   - 選項長度適中，干擾項合理但不混淆
   - 選項順序與正確答案位置要隨機分散，避免每題都把正確答案放在同一個位置
   - 本次出題隨機碼：${nonce}（請確保與上一次不完全相同）

3. 輸出格式（嚴格按照 JSON 格式）：
\`\`\`json
[
  {
    "question": "題目內容",
    "options": ["A選項", "B選項", "C選項", "D選項"],
    "correctAnswer": 0,
    "explanation": "詳細解釋",
    "topic": "知識點名稱"
  }
]
\`\`\`

注意：
- correctAnswer 使用數字索引（0=A, 1=B, 2=C, 3=D）
- 確保 JSON 格式正確，可以被程式解析
- 題目內容要有教育價值，符合學習目標

請立即開始生成 ${scope.questionCount} 道題目：`;
  }

  /**
   * 解析 AI 回應，提取題目資料
   */
  private static parseAIResponse(content: string, scope: StudyScope): StudyQuestion[] {
    try {
      // 嘗試提取 JSON 內容
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
                       content.match(/\[[\s\S]*?\]/);

      if (!jsonMatch) {
        throw new Error('無法找到有效的 JSON 格式題目資料');
      }

      const jsonContent = jsonMatch[1] || jsonMatch[0];
      const questionsData = JSON.parse(jsonContent);

      if (!Array.isArray(questionsData)) {
        throw new Error('題目資料格式不正確');
      }

      // 轉換為 StudyQuestion 格式
      const questions: StudyQuestion[] = questionsData.map((item: any, index: number) => {
        // 驗證必要欄位
        if (!item.question || !Array.isArray(item.options) || item.options.length !== 4) {
          throw new Error(`第 ${index + 1} 道題目格式不完整`);
        }

        if (typeof item.correctAnswer !== 'number' || item.correctAnswer < 0 || item.correctAnswer > 3) {
          throw new Error(`第 ${index + 1} 道題目的正確答案格式錯誤`);
        }

        return {
          id: generateId.question(),
          content: String(item.question || '').trim(),
          options: item.options.map((opt: any) => String(opt || '').trim()),
          correctAnswer: Number(item.correctAnswer),
          explanation: String(item.explanation || '').trim(),
          topic: String(item.topic || scope.topics[0] || '一般知識').trim(),
          difficulty: scope.difficulty,
          source: scope.contentSource === 'custom' ? '自定义内容' : scope.chapters.join('、'),
          generatedAt: new Date().toISOString()
        };
      });

      // 強制隨機化：題目順序 + 選項順序（修正 correctAnswer）
      const randomized = questions.map(shuffleQuestionOptions);
      shuffleInPlace(randomized);

      // 驗證生成的題目數量
      if (randomized.length === 0) {
        throw new Error('沒有生成任何題目');
      }

      console.log(`成功解析 ${randomized.length} 道題目`);
      return randomized;

    } catch (error) {
      console.error('解析 AI 回應失敗:', error);

      // 如果解析失敗，生成備用題目
      return QuestionGeneratorService.generateFallbackQuestions(scope);
    }
  }

  /**
   * 生成備用題目（當 AI 生成失敗時）
   */
  private static generateFallbackQuestions(scope: StudyScope): StudyQuestion[] {
    const fallbackQuestions: StudyQuestion[] = [];
    const questionCount = Math.min(scope.questionCount, 5); // 最多生成 5 道備用題目

    for (let i = 0; i < questionCount; i++) {
      const topic = scope.topics[i % scope.topics.length] || '基礎知識';
      const correctAnswer = Math.floor(Math.random() * 4);

      fallbackQuestions.push({
        id: generateId.question(),
        content: `關於「${topic}」的選擇題 ${i + 1}`,
        options: [
          '選項 A',
          '選項 B',
          '選項 C',
          '選項 D'
        ],
        correctAnswer,
        explanation: '這是一道示例題目，請重新生成題目。',
        topic: topic,
        difficulty: scope.difficulty,
        source: scope.contentSource === 'custom' ? '自定义内容' : scope.chapters.join('、'),
        generatedAt: new Date().toISOString()
      });
    }

    const randomized = fallbackQuestions.map(shuffleQuestionOptions);
    shuffleInPlace(randomized);
    return randomized;
  }

  /**
   * 驗證生成的題目品質
   */
  static validateQuestions(questions: StudyQuestion[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    questions.forEach((question, index) => {
      const questionNum = index + 1;

      if (!question.content || question.content.trim().length < 5) {
        errors.push(`第 ${questionNum} 題：題目內容太短`);
      }

      if (question.options.length !== 4) {
        errors.push(`第 ${questionNum} 題：選項數量不正確（需要 4 個）`);
      }

      if (question.correctAnswer < 0 || question.correctAnswer > 3) {
        errors.push(`第 ${questionNum} 題：正確答案索引無效`);
      }

      if (question.options.some(opt => !opt || opt.trim().length === 0)) {
        errors.push(`第 ${questionNum} 題：存在空選項`);
      }

      if (!question.explanation || question.explanation.trim().length < 5) {
        errors.push(`第 ${questionNum} 題：解釋內容太短`);
      }
    });

    return { isValid: errors.length === 0, errors };
  }

  /**
   * 生成題目預覽（不調用 AI，用於 UI 測試）
   */
  static generatePreviewQuestions(scope: StudyScope): StudyQuestion[] {
    const previewQuestions: StudyQuestion[] = [];
    const sampleTopics = scope.topics.length > 0 ? scope.topics : ['基礎概念', '應用技能', '綜合分析'];

    for (let i = 0; i < Math.min(scope.questionCount, 3); i++) {
      const topic = sampleTopics[i % sampleTopics.length];

      previewQuestions.push({
        id: generateId.question(),
        content: `這是關於「${topic}」的${scope.difficulty}程度題目示例`,
        options: [
          '這是選項 A',
          '這是選項 B',
          '這是選項 C',
          '這是選項 D'
        ],
        correctAnswer: i % 4, // 輪換正確答案
        explanation: `這是第 ${i + 1} 題的解釋說明，會詳細說明為什麼選擇這個答案。`,
        topic: topic,
        difficulty: scope.difficulty,
        source: scope.contentSource === 'custom' ? '自訂內容預覽' : scope.chapters.join('、'),
        generatedAt: new Date().toISOString()
      });
    }

    return previewQuestions;
  }
}

// 匯出服務實例
export const questionGenerator = QuestionGeneratorService;
