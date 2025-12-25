/**
 * 內容審核和NSFW過濾工具
 * 用於檢測和防止不當內容的圖片生成
 */

// 敏感詞庫 - 基礎版本
const NSFW_KEYWORDS = {
  // 身體部位相關
  body: [
    'nude', 'naked', 'breast', 'penis', 'vagina', 'ass', 'butt', 'boob', 'nipple',
    '裸體', '裸', '胸部', '乳房', '生殖器', '屁股', '臀部', '乳頭', '陰莖', '陰道'
  ],

  // 性相關內容
  sexual: [
    'sex', 'porn', 'erotic', 'sexual', 'orgasm', 'masturbate', 'fuck', 'dick',
    '性', '色情', '情色', '性行為', '做愛', '自慰', '高潮', '性感', '誘惑'
  ],

  // 暴力相關
  violence: [
    'kill', 'murder', 'blood', 'gore', 'torture', 'weapon', 'gun', 'knife',
    '殺', '謀殺', '血', '暴力', '折磨', '武器', '槍', '刀', '死', '血腥'
  ],

  // 不當行為
  inappropriate: [
    'drugs', 'alcohol', 'smoking', 'gambling', 'suicide', 'self-harm',
    '毒品', '酒精', '抽煙', '賭博', '自殺', '自殘', '吸毒', '喝酒'
  ]
};

// 風險等級
export enum RiskLevel {
  SAFE = 'safe',
  WARNING = 'warning',
  BLOCKED = 'blocked'
}

export interface ModerationResult {
  riskLevel: RiskLevel;
  blockedKeywords: string[];
  suggestions: string[];
  message: string;
}

/**
 * 檢查提示詞是否包含不當內容
 */
export function moderateContent(prompt: string): ModerationResult {
  const lowerPrompt = prompt.toLowerCase();
  const blockedKeywords: string[] = [];

  // 檢查所有分類的敏感詞
  Object.entries(NSFW_KEYWORDS).forEach(([category, keywords]) => {
    keywords.forEach(keyword => {
      if (lowerPrompt.includes(keyword.toLowerCase())) {
        blockedKeywords.push(keyword);
      }
    });
  });

  // 根據檢測結果決定風險等級
  if (blockedKeywords.length === 0) {
    return {
      riskLevel: RiskLevel.SAFE,
      blockedKeywords: [],
      suggestions: [],
      message: '內容安全，可以生成圖片'
    };
  }

  // 檢查是否為高風險內容
  const highRiskKeywords = [
    ...NSFW_KEYWORDS.body,
    ...NSFW_KEYWORDS.sexual,
    ...NSFW_KEYWORDS.violence
  ];

  const hasHighRiskContent = blockedKeywords.some(keyword =>
    highRiskKeywords.some(highRisk =>
      highRisk.toLowerCase() === keyword.toLowerCase()
    )
  );

  if (hasHighRiskContent) {
    return {
      riskLevel: RiskLevel.BLOCKED,
      blockedKeywords,
      suggestions: generateSafeSuggestions(prompt),
      message: '檢測到不當內容，無法生成圖片。請修改您的描述。'
    };
  }

  return {
    riskLevel: RiskLevel.WARNING,
    blockedKeywords,
    suggestions: generateSafeSuggestions(prompt),
    message: '檢測到可能不當的內容，請確認您的描述是否合適。'
  };
}

/**
 * 生成安全的替代建議
 */
function generateSafeSuggestions(originalPrompt: string): string[] {
  const suggestions: string[] = [];

  // 基於原始提示詞生成安全替代方案
  if (originalPrompt.length > 0) {
    suggestions.push('一幅美麗的風景畫');
    suggestions.push('可愛的動物插圖');
    suggestions.push('彩色的花朵圖案');
    suggestions.push('卡通風格的角色設計');
    suggestions.push('抽象藝術作品');
  }

  return suggestions;
}

/**
 * 檢查用戶是否有繞過權限（教師/管理員）
 */
export function hasContentModerationBypass(userRole: string): boolean {
  return userRole === 'teacher' || userRole === 'admin';
}

/**
 * 記錄內容審核日誌
 */
export function logModerationAttempt(
  userId: string,
  prompt: string,
  result: ModerationResult,
  action: 'blocked' | 'warned' | 'bypassed'
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    userId,
    prompt,
    riskLevel: result.riskLevel,
    blockedKeywords: result.blockedKeywords,
    action,
    userAgent: navigator.userAgent
  };

  // 儲存到 localStorage 供管理員檢視
  const logs = getModerationLogs();
  logs.unshift(logEntry);

  // 保留最近 1000 條記錄
  const recentLogs = logs.slice(0, 1000);
  localStorage.setItem('contentModerationLogs', JSON.stringify(recentLogs));

  console.log('Content moderation log:', logEntry);
}

/**
 * 獲取內容審核日誌
 */
export function getModerationLogs(): any[] {
  try {
    const logs = localStorage.getItem('contentModerationLogs');
    return logs ? JSON.parse(logs) : [];
  } catch (e) {
    console.error('Failed to parse moderation logs:', e);
    return [];
  }
}

/**
 * 清理審核日誌
 */
export function clearModerationLogs(): void {
  localStorage.removeItem('contentModerationLogs');
}