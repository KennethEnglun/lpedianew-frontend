import type React from 'react';

export type AdminSection = 'users' | 'assignments' | 'folders' | 'yearEnd';
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
}

export type SidebarItem = { key: AdminSection; label: string; icon: React.ReactNode };

