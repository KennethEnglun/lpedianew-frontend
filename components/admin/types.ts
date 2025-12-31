import type React from 'react';

export type AdminSection = 'users' | 'assignments' | 'folders' | 'yearEnd' | 'points' | 'moderation';
export type UserRoleFilter = 'all' | 'teacher' | 'student';

export interface AdminUser {
  id: string;
  username: string;
  role: 'teacher' | 'student' | 'admin';
  name: string;
  email?: string;
  class?: string;
  studentId?: string;
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
  chineseGroup?: string;
  englishGroup?: string;
  mathGroup?: string;
  subjectsTaught?: string[];
  subjectClasses?: Record<string, string[]>;
}

export type SidebarItem = { key: AdminSection; label: string; icon: React.ReactNode };

// Points System Types
export interface PointTransaction {
  id: string;
  userId: string;
  type: 'admin_grant' | 'image_generation' | 'admin_adjust' | 'task_completion' | 'quiz_score' | 'contest_score' | 'self_study_score';
  amount: number;  // 正數=獲得，負數=消耗
  balance: number; // 交易後餘額
  description?: string;
  adminId?: string; // 執行操作的管理員ID
  createdAt: string;
  metadata?: {
    imagePrompt?: string;  // 如果是圖片生成，記錄prompt
    imageId?: string;      // 生成的圖片ID
    batchId?: string;      // 批次操作ID
    dayKey?: string;
    rawScore?: number;
    multiplier?: number;
  };
}

export interface StudentPointsStatus {
  userId: string;
  username: string;
  name: string;
  class?: string;
  currentPoints: number;
  totalReceived: number;
  totalUsed: number;
  lastUpdate?: string;
}

export interface PointsOverview {
  totalStudents: number;
  totalPointsDistributed: number;
  totalPointsUsed: number;
  averagePointsPerStudent: number;
  studentsWithPoints: number;
  studentsWithoutPoints: number;
}
