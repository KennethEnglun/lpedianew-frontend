import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Eye, Trash2, Download } from 'lucide-react';
import Button from '../Button';
import { getModerationLogs, clearModerationLogs } from '../../utils/contentModeration';

interface ModerationLog {
  timestamp: string;
  userId: string;
  prompt: string;
  riskLevel: string;
  blockedKeywords: string[];
  action: 'blocked' | 'warned' | 'bypassed';
  userAgent: string;
}

export default function ModerationLogsPanel() {
  const [logs, setLogs] = useState<ModerationLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ModerationLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [showDetails, setShowDetails] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    let filtered = logs;

    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.prompt.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.blockedKeywords.some(keyword =>
          keyword.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    if (filterAction !== 'all') {
      filtered = filtered.filter(log => log.action === filterAction);
    }

    setFilteredLogs(filtered);
  }, [logs, searchTerm, filterAction]);

  const loadLogs = () => {
    const moderationLogs = getModerationLogs();
    setLogs(moderationLogs);
  };

  const handleClearLogs = () => {
    if (window.confirm('確定要清除所有內容審核記錄？此操作無法復原！')) {
      clearModerationLogs();
      setLogs([]);
      setFilteredLogs([]);
    }
  };

  const exportLogs = () => {
    const csvContent = [
      ['時間', '用戶ID', '提示詞', '風險等級', '關鍵詞', '動作', '瀏覽器'],
      ...filteredLogs.map(log => [
        new Date(log.timestamp).toLocaleString('zh-TW'),
        log.userId,
        log.prompt,
        log.riskLevel,
        log.blockedKeywords.join(', '),
        log.action,
        log.userAgent
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `content_moderation_logs_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getRiskLevelIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'blocked':
        return <Shield className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Eye className="w-4 h-4 text-blue-500" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'blocked':
        return 'text-red-600 bg-red-50';
      case 'warned':
        return 'text-yellow-600 bg-yellow-50';
      case 'bypassed':
        return 'text-orange-600 bg-orange-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getActionText = (action: string) => {
    switch (action) {
      case 'blocked':
        return '已封鎖';
      case 'warned':
        return '已警告';
      case 'bypassed':
        return '已繞過';
      default:
        return action;
    }
  };

  return (
    <div className="space-y-6">
      {/* 標題和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#5D4037]">內容審核記錄</h2>
          <p className="text-gray-600">監控和管理 AI 圖片生成的內容安全</p>
        </div>
        <div className="flex gap-3">
          <Button
            className="bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-2"
            onClick={exportLogs}
            disabled={filteredLogs.length === 0}
          >
            <Download className="w-4 h-4" />
            匯出記錄
          </Button>
          <Button
            className="bg-red-500 hover:bg-red-600 text-white flex items-center gap-2"
            onClick={handleClearLogs}
            disabled={logs.length === 0}
          >
            <Trash2 className="w-4 h-4" />
            清除記錄
          </Button>
        </div>
      </div>

      {/* 統計概覽 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{logs.length}</div>
          <div className="text-sm text-gray-600">總審核次數</div>
        </div>
        <div className="bg-red-50 p-4 rounded-xl border border-red-200">
          <div className="text-2xl font-bold text-red-600">
            {logs.filter(log => log.action === 'blocked').length}
          </div>
          <div className="text-sm text-red-600">封鎖次數</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
          <div className="text-2xl font-bold text-yellow-600">
            {logs.filter(log => log.action === 'warned').length}
          </div>
          <div className="text-sm text-yellow-600">警告次數</div>
        </div>
        <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
          <div className="text-2xl font-bold text-orange-600">
            {logs.filter(log => log.action === 'bypassed').length}
          </div>
          <div className="text-sm text-orange-600">繞過次數</div>
        </div>
      </div>

      {/* 搜尋和篩選 */}
      <div className="flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="搜尋用戶ID或提示詞內容..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg"
        >
          <option value="all">全部動作</option>
          <option value="blocked">已封鎖</option>
          <option value="warned">已警告</option>
          <option value="bypassed">已繞過</option>
        </select>
      </div>

      {/* 記錄列表 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {logs.length === 0 ? '尚無內容審核記錄' : '找不到符合條件的記錄'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">時間</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">用戶</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">提示詞</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">風險等級</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">動作</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLogs.map((log, index) => (
                  <tr key={`${log.timestamp}-${index}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(log.timestamp).toLocaleString('zh-TW')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                      {log.userId}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="max-w-xs truncate" title={log.prompt}>
                        {log.prompt}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        {getRiskLevelIcon(log.riskLevel)}
                        <span className="capitalize">{log.riskLevel}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                        {getActionText(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => setShowDetails(showDetails === `${log.timestamp}-${index}` ? null : `${log.timestamp}-${index}`)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 詳細信息 */}
            {filteredLogs.map((log, index) => (
              showDetails === `${log.timestamp}-${index}` && (
                <div key={`detail-${log.timestamp}-${index}`} className="border-t border-gray-200 bg-gray-50 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="font-medium text-gray-700 mb-1">完整提示詞:</div>
                      <div className="bg-white p-3 rounded border break-words">{log.prompt}</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-700 mb-1">檢測到的關鍵詞:</div>
                      <div className="bg-white p-3 rounded border">
                        {log.blockedKeywords.length > 0 ? log.blockedKeywords.join(', ') : '無'}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-700 mb-1">瀏覽器信息:</div>
                      <div className="bg-white p-3 rounded border text-xs">{log.userAgent}</div>
                    </div>
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}