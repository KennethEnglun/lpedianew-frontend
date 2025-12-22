export enum Subject {
  CHINESE = '中文',
  ENGLISH = '英文',
  MATH = '數學',
  SCIENCE = '科學',
  HUMANITIES = '人文',
  STEAM = 'STEAM',
  PUTONGHUA = '普通話',
  VISUAL_ARTS = '視藝',
  MUSIC = '音樂',
  LIBRARY = '圖書',
  PE = '體育',
}

export interface Task {
  id: string;
  title: string;
  type: 'quiz' | 'ai-bot' | 'discussion' | 'game' | 'contest' | 'note';
  subject: Subject;
  teacherName: string;
  teacherAvatar: string;
  createdAt?: string;
  folderId?: string | null;
  folderSnapshot?: any;
  completed?: boolean;
  score?: number | null;
}

export interface Discussion {
  id: string;
  title: string;
  content: {
    type: 'text' | 'image' | 'link' | 'html';
    value: string;
  }[];
  subject: Subject;
  targetClasses: string[];
  teacherId: string;
  teacherName: string;
  createdAt: string;
  updatedAt: string;
}

// 遊戲類型定義
export enum GameType {
  MATH = 'math',
  TOWER_DEFENSE = 'tower-defense',
  MAZE = 'maze',
  MATCHING = 'matching',
  RANGER_TD = 'ranger-td'
}

// 遊戲排行榜條目
export interface GameLeaderboardEntry {
  id: string;
  gameId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userClass?: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  timeSpent: number; // 秒
  completedAt: string;
  rank?: number;
  // 遊戲特定數據
  extraData?: {
    wavesSurvived?: number; // 塔防遊戲
    mathLevel?: string; // 數學遊戲
    matchingAccuracy?: number; // 配對遊戲
    mazeCompletionTime?: number; // 迷宮遊戲
  };
}

// 遊戲排行榜
export interface GameLeaderboard {
  gameId: string;
  gameTitle: string;
  gameType: GameType;
  subject: Subject;
  entries: GameLeaderboardEntry[];
  lastUpdated: string;
}

export const SUBJECT_CONFIG: Record<Subject, { color: string; icon: string }> = {
  [Subject.CHINESE]: { color: '#F8C5C5', icon: '📖' },
  [Subject.ENGLISH]: { color: '#F8E2B5', icon: '🔤' },
  [Subject.MATH]: { color: '#B5D8F8', icon: '🧮' },
  [Subject.SCIENCE]: { color: '#B5F8CE', icon: '🔬' },
  [Subject.HUMANITIES]: { color: '#D2B5F8', icon: '🌍' },
  [Subject.STEAM]: { color: '#FFD4B5', icon: '⚙️' },
  [Subject.PUTONGHUA]: { color: '#F5B5B5', icon: '🗣️' },
  [Subject.VISUAL_ARTS]: { color: '#F8B5E0', icon: '🎨' },
  [Subject.MUSIC]: { color: '#E5B5F8', icon: '🎵' },
  [Subject.LIBRARY]: { color: '#C5D8F8', icon: '📚' },
  [Subject.PE]: { color: '#B5F8B5', icon: '⚽' },
};

// 遊戲類型配置
export const GAME_TYPE_CONFIG: Record<GameType, { name: string; icon: string; color: string }> = {
  [GameType.MATH]: { name: '數學遊戲', icon: '🧮', color: '#B5D8F8' },
  [GameType.TOWER_DEFENSE]: { name: '塔防遊戲', icon: '🏰', color: '#FFB5B5' },
  [GameType.MAZE]: { name: '迷宮遊戲', icon: '🌀', color: '#B5F8CE' },
  [GameType.MATCHING]: { name: '配對遊戲', icon: '🔗', color: '#F8B5E0' },
  [GameType.RANGER_TD]: { name: 'Ranger 塔防', icon: '🧸', color: '#FDEEAD' }
};
