import React from 'react';
import { LogOut, Settings, Users } from 'lucide-react';
import type { AdminSection, SidebarItem } from './types';
import Button from '../Button';

export default function AdminShell(props: {
  activeSection: AdminSection;
  sidebarItems: SidebarItem[];
  onSelectSection: (section: AdminSection) => void;
  title: string;
  subtitle?: string;
  onOpenSettings: () => void;
  onBackToPlatform: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const { activeSection, sidebarItems, onSelectSection, title, subtitle, onOpenSettings, onBackToPlatform, onLogout, children } = props;

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-200">
          <div className="text-2xl font-black text-brand-brown font-rounded leading-tight">LP科樂園 Admin</div>
          <div className="text-xs font-bold text-gray-500 mt-1">管理後台</div>
        </div>

        <nav className="p-3 space-y-1">
          {sidebarItems.map((it) => {
            const active = it.key === activeSection;
            return (
              <button
                key={it.key}
                type="button"
                onClick={() => onSelectSection(it.key)}
                className={[
                  'w-full flex items-center gap-3 px-3 py-2 rounded-xl font-black text-left transition-colors',
                  active ? 'bg-[#E8F5E9] text-brand-brown' : 'bg-transparent text-gray-700 hover:bg-gray-100'
                ].join(' ')}
              >
                <span className={active ? 'text-brand-brown' : 'text-gray-500'}>{it.icon}</span>
                <span className="truncate">{it.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto p-4 border-t border-gray-200 space-y-2">
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl font-bold text-gray-700 hover:bg-gray-100"
          >
            <Settings className="w-5 h-5 text-gray-500" />
            介面顯示設定
          </button>
          <button
            type="button"
            onClick={onBackToPlatform}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl font-bold text-gray-700 hover:bg-gray-100"
          >
            <Users className="w-5 h-5 text-gray-500" />
            返回平台
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl font-bold text-red-700 hover:bg-red-50"
          >
            <LogOut className="w-5 h-5 text-red-600" />
            登出
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-2xl font-black text-brand-brown truncate">{title}</div>
            {subtitle && (
              <div className="text-xs font-bold text-gray-500 truncate">{subtitle}</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button className="bg-white hover:bg-gray-100 border border-gray-200 text-gray-800" onClick={onOpenSettings}>
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </header>

        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

