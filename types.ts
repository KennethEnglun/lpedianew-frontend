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
  type: 'quiz' | 'ai-bot' | 'discussion';
  subject: Subject;
  teacherName: string;
  teacherAvatar: string;
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