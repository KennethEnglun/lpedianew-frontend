import React, { useState } from 'react';
import { Coins, History, AlertCircle } from 'lucide-react';
import Button from '../Button';
import { PointTransaction } from '../admin/types';

interface PointsBalanceProps {
  currentPoints: number;
  totalReceived: number;
  totalUsed: number;
  lastUpdate?: string;
  transactions?: PointTransaction[];
  onRefresh?: () => void;
}

export default function PointsBalance(props: PointsBalanceProps) {
  const { currentPoints = 0, totalReceived = 0, totalUsed = 0, lastUpdate, transactions = [], onRefresh } = props;
  const [showHistory, setShowHistory] = useState(false);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'admin_grant':
        return '⬆️';
      case 'image_generation':
        return '🎨';
      case 'admin_adjust':
        return '⚙️';
      default:
        return '📝';
    }
  };

  const getTransactionDescription = (transaction: PointTransaction) => {
    switch (transaction.type) {
      case 'admin_grant':
        return transaction.description || '管理員分配點數';
      case 'image_generation':
        return `圖片生成: ${transaction.metadata?.imagePrompt?.substring(0, 30) || ''}...`;
      case 'admin_adjust':
        return transaction.description || '管理員調整點數';
      default:
        return transaction.description || '未知操作';
    }
  };

  return (
    <div className="space-y-4">
      {/* 點數餘額卡片 - 縮短高度版本 */}
      <div className="bg-white/60 rounded-xl p-3 border-2 border-[#E6D2B5] mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-yellow-600" />
            <span className="font-bold text-[#5D4037] text-sm">圖片生成點數</span>
          </div>
          {onRefresh && (
            <Button
              className="bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs px-2 py-1"
              onClick={onRefresh}
            >
              刷新
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center mb-2">
          <div>
            <div className={`text-lg font-bold ${currentPoints > 0 ? 'text-green-600' : 'text-red-500'}`}>
              {currentPoints}
            </div>
            <div className="text-xs text-gray-600">可用點數</div>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-600">{totalReceived}</div>
            <div className="text-xs text-gray-600">總獲得</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-600">{totalUsed}</div>
            <div className="text-xs text-gray-600">已使用</div>
          </div>
        </div>

        {currentPoints === 0 && (
          <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-3 h-3 text-yellow-600" />
            <span className="text-xs text-yellow-700">
              點數不足，請聯繫老師獲取更多點數
            </span>
          </div>
        )}

        <Button
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center gap-1 text-xs py-1"
          onClick={() => setShowHistory(true)}
        >
          <History className="w-3 h-3" />
          查看使用記錄
        </Button>

        {lastUpdate && (
          <div className="text-xs text-gray-500 mt-1 text-center">
            最後更新：{formatDate(lastUpdate)}
          </div>
        )}
      </div>

      {/* 使用記錄模態框 */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="bg-[#A1D9AE] border-b border-gray-200 px-5 py-4 flex items-center justify-between">
              <div className="text-xl font-black text-brand-brown">點數使用記錄</div>
              <button
                onClick={() => setShowHistory(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[60vh]">
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  暂无使用记录
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="bg-gray-50 rounded-xl p-4 flex items-start justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-xl">{getTransactionIcon(transaction.type)}</div>
                        <div className="flex-1">
                          <div className="font-medium text-[#5D4037]">
                            {getTransactionDescription(transaction)}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {formatDate(transaction.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${transaction.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                        </div>
                        <div className="text-xs text-gray-500">
                          餘額: {transaction.balance}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}