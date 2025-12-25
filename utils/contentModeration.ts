/**
 * 內容審核和NSFW過濾工具
 * 用於檢測和防止不當內容的圖片生成
 */

// 中英敏感詞翻譯映射表
const CHINESE_TO_ENGLISH_TRANSLATIONS = {
  // 身體相關
  '裸體': 'nude', '裸': 'naked', '胸部': 'breast', '乳房': 'boob',
  '生殖器': 'genital', '屁股': 'butt', '臀部': 'buttock', '乳頭': 'nipple',
  '陰莖': 'penis', '陰道': 'vagina', '下體': 'private parts',
  '私密處': 'intimate parts', '敏感部位': 'sensitive area',
  '沒穿衣服': 'without clothes', '脫光': 'naked', '光身': 'nude',
  '露點': 'exposed', '裸露': 'exposed', '春光': 'exposed body',

  // 性相關
  '性': 'sex', '色情': 'pornography', '情色': 'erotic', '性行為': 'sexual intercourse',
  '做愛': 'making love', '自慰': 'masturbate', '高潮': 'orgasm',
  '性感': 'sexy', '誘惑': 'seductive', '挑逗': 'teasing',
  '床戲': 'sex scene', '激情': 'passion', '慾望': 'lust',
  '性愛': 'sexual', '肉體': 'flesh', '性慾': 'sexual desire',

  // 暴力相關
  '殺': 'kill', '謀殺': 'murder', '血': 'blood', '暴力': 'violence',
  '折磨': 'torture', '武器': 'weapon', '槍': 'gun', '刀': 'knife',
  '死': 'death', '血腥': 'bloody', '殺害': 'killing', '傷害': 'harm',
  '打鬥': 'fighting', '攻擊': 'attack', '暴打': 'beating',

  // 不當行為
  '毒品': 'drugs', '酒精': 'alcohol', '抽煙': 'smoking', '賭博': 'gambling',
  '自殺': 'suicide', '自殘': 'self-harm', '吸毒': 'drug use', '喝酒': 'drinking',

  // 补充语义检测
  '沒有穿衣服': 'without clothes', '不穿衣服': 'without clothes',
  '脫掉衣服': 'remove clothes', '脫衣': 'undress', '全裸': 'fully naked',
  '一絲不掛': 'completely naked', '赤裸': 'naked', '光溜溜': 'nude',
  '身體暴露': 'body exposed', '完全暴露': 'fully exposed',
  '私密': 'private', '隱私': 'private', '不雅': 'inappropriate'
};

// 委婉表達和隱喻檢測
const EUPHEMISTIC_PATTERNS = [
  // 身體相關委婉說法
  /沒.*穿.*衣/gi,
  /不.*穿.*衣/gi,
  /脫.*光/gi,
  /光.*身/gi,
  /露.*點/gi,
  /春.*光/gi,
  /私.*密/gi,
  /敏.*感.*部/gi,

  // 性相關委婉說法
  /親.*密.*行/gi,
  /床.*上.*運/gi,
  /魚.*水.*歡/gi,
  /雲.*雨.*之/gi,
  /房.*事/gi,
  /做.*那.*種/gi,
  /那.*種.*事/gi,

  // 使用符號替代
  /[色性][*＊×]/gi,
  /[裸][*＊×]/gi,
  /[胸][*＊×]/gi
];

// 擴展的敏感詞庫
const NSFW_KEYWORDS = {
  // 身體部位相關
  body: [
    'nude', 'naked', 'breast', 'penis', 'vagina', 'ass', 'butt', 'boob', 'nipple',
    'genital', 'private parts', 'intimate', 'exposed', 'undressed', 'topless',
    '裸體', '裸', '胸部', '乳房', '生殖器', '屁股', '臀部', '乳頭', '陰莖', '陰道',
    '下體', '私密處', '敏感部位', '沒穿衣服', '脫光', '光身', '露點', '裸露', '春光',
    '私處', '隱私部位', '身體隱私', '不雅部位'
  ],

  // 性相關內容
  sexual: [
    'sex', 'porn', 'erotic', 'sexual', 'orgasm', 'masturbate', 'fuck', 'dick',
    'intercourse', 'making love', 'sexy', 'seductive', 'lust', 'passion',
    '性', '色情', '情色', '性行為', '做愛', '自慰', '高潮', '性感', '誘惑',
    '床戲', '激情', '慾望', '性愛', '肉體', '性慾', '挑逗', '親密行為',
    '床上運動', '魚水之歡', '雲雨之事', '房事', '做那種事', '那種事'
  ],

  // 暴力相關
  violence: [
    'kill', 'murder', 'blood', 'gore', 'torture', 'weapon', 'gun', 'knife',
    'death', 'bloody', 'violence', 'attack', 'fighting', 'beating', 'harm',
    '殺', '謀殺', '血', '暴力', '折磨', '武器', '槍', '刀', '死', '血腥',
    '殺害', '傷害', '打鬥', '攻擊', '暴打', '殺戮', '血淋淋', '致命'
  ],

  // 不當行為
  inappropriate: [
    'drugs', 'alcohol', 'smoking', 'gambling', 'suicide', 'self-harm',
    'drug use', 'drinking', 'substance abuse',
    '毒品', '酒精', '抽煙', '賭博', '自殺', '自殘', '吸毒', '喝酒',
    '藥物濫用', '酗酒', '菸草', '賭錢'
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
 * 將中文提示詞翻譯成英文進行檢測
 */
function translateChineseToEnglish(chineseText: string): string {
  let translatedText = chineseText;

  // 使用映射表進行基本翻譯
  Object.entries(CHINESE_TO_ENGLISH_TRANSLATIONS).forEach(([chinese, english]) => {
    const regex = new RegExp(chinese, 'gi');
    translatedText = translatedText.replace(regex, ` ${english} `);
  });

  return translatedText;
}

/**
 * 檢測委婉表達和隱喻
 */
function detectEuphemisms(text: string): string[] {
  const detectedPatterns: string[] = [];

  EUPHEMISTIC_PATTERNS.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      detectedPatterns.push(...matches);
    }
  });

  return detectedPatterns;
}

/**
 * 檢測字符替代（如色*情）
 */
function detectCharacterSubstitution(text: string): string[] {
  const detected: string[] = [];

  // 檢測常見符號替代
  const substitutionPatterns = [
    /色[*＊×]+情/gi,
    /性[*＊×]+愛/gi,
    /裸[*＊×]+體/gi,
    /胸[*＊×]+部/gi,
    /做[*＊×]*愛/gi
  ];

  substitutionPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      detected.push(...matches);
    }
  });

  return detected;
}

/**
 * 增強版內容檢測 - 多層檢測機制
 */
export function moderateContent(prompt: string): ModerationResult {
  const originalPrompt = prompt;
  const lowerPrompt = prompt.toLowerCase();
  const blockedKeywords: string[] = [];

  // 第一層：直接關鍵詞檢測
  Object.entries(NSFW_KEYWORDS).forEach(([category, keywords]) => {
    keywords.forEach(keyword => {
      if (lowerPrompt.includes(keyword.toLowerCase())) {
        blockedKeywords.push(keyword);
      }
    });
  });

  // 第二層：中文翻譯檢測
  const translatedText = translateChineseToEnglish(originalPrompt);
  const lowerTranslated = translatedText.toLowerCase();

  // 對翻譯後的文本進行英文敏感詞檢測
  Object.entries(NSFW_KEYWORDS).forEach(([category, keywords]) => {
    keywords.forEach(keyword => {
      // 只檢測英文關鍵詞
      if (keyword.match(/^[a-zA-Z\s]+$/) && lowerTranslated.includes(keyword.toLowerCase())) {
        if (!blockedKeywords.includes(keyword)) {
          blockedKeywords.push(keyword);
        }
      }
    });
  });

  // 第三層：委婉表達檢測
  const euphemisms = detectEuphemisms(originalPrompt);
  if (euphemisms.length > 0) {
    blockedKeywords.push(...euphemisms);
  }

  // 第四層：字符替代檢測
  const substitutions = detectCharacterSubstitution(originalPrompt);
  if (substitutions.length > 0) {
    blockedKeywords.push(...substitutions);
  }

  // 第五層：語義組合檢測
  const semanticPatterns = [
    /女.*子.*不.*穿/gi,
    /男.*子.*不.*穿/gi,
    /沒.*有.*衣.*服/gi,
    /脫.*掉.*衣.*服/gi,
    /身.*體.*暴.*露/gi,
    /親.*熱.*擁.*抱/gi,
    /激.*烈.*運.*動/gi,
  ];

  semanticPatterns.forEach(pattern => {
    if (pattern.test(originalPrompt)) {
      blockedKeywords.push(originalPrompt.match(pattern)?.[0] || '語義檢測');
    }
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

  // 如果檢測到委婉表達或字符替代，也視為高風險
  const hasEuphemismsOrSubstitutions = euphemisms.length > 0 || substitutions.length > 0;

  if (hasHighRiskContent || hasEuphemismsOrSubstitutions) {
    return {
      riskLevel: RiskLevel.BLOCKED,
      blockedKeywords,
      suggestions: generateSafeSuggestions(originalPrompt),
      message: '檢測到不當內容，無法生成圖片。請修改您的描述。'
    };
  }

  return {
    riskLevel: RiskLevel.WARNING,
    blockedKeywords,
    suggestions: generateSafeSuggestions(originalPrompt),
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