import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from '../../Button';
import ResetDataConfirmModal from '../ResetDataConfirmModal';
import { authService } from '../../../services/authService';

export default function AdminYearEndPanel(props: {
  yearEndLoading: boolean;
  yearEndResult: { archiveId: string; archivedAt: string } | null;
  onRun: () => void;
}) {
  const { yearEndLoading, yearEndResult, onRun } = props;

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState<{ message: string; resetTime: string; resetBy: string } | null>(null);
  const [resetError, setResetError] = useState('');

  const handleResetData = async () => {
    setResetLoading(true);
    setResetError('');

    try {
      const result = await authService.resetAllData();
      setResetResult(result);
      setShowResetModal(false);
      // 可選：顯示成功訊息或重新整理頁面
      alert(`資料重設成功！\n重設時間: ${result.resetTime}\n操作者: ${result.resetBy}`);
    } catch (error) {
      setResetError(error instanceof Error ? error.message : '重設失敗');
    } finally {
      setResetLoading(false);
    }
  };
  return (
    <>
      {/* Year End Archive Section */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-lg font-black text-brand-brown">升班（封存本年度）</div>
            <div className="text-sm text-gray-600 font-bold mt-1">
              「升班」會封存本年度所有學生內容並清空（可在後端 data/year_archives 找到封存檔）。
            </div>
            {yearEndResult && (
              <div className="text-xs text-gray-600 font-bold mt-2">
                最近一次封存：{yearEndResult.archiveId}（{yearEndResult.archivedAt}）
              </div>
            )}
          </div>
          <Button
            className="bg-red-100 hover:bg-red-200 text-red-800 flex items-center gap-2"
            onClick={onRun}
            disabled={yearEndLoading}
          >
            {yearEndLoading ? '封存中...' : '升班（封存本年度）'}
          </Button>
        </div>
      </div>

      {/* Reset All Data Section */}
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-lg font-black text-red-700">
              <AlertTriangle className="w-5 h-5" />
              重設後端資料
            </div>
            <div className="text-sm text-red-600 font-bold mt-1">
              ⚠️ 危險操作：將永久刪除所有任務、帳號、封存資料等。此操作無法復原！
            </div>
            <div className="text-xs text-red-500 mt-1">
              建議僅在學年結束且確認無需保留資料時使用此功能。
            </div>
            {resetResult && (
              <div className="text-xs text-gray-600 font-bold mt-2 p-2 bg-green-100 border border-green-200 rounded">
                最近一次重設：{resetResult.resetTime} 由 {resetResult.resetBy} 執行
              </div>
            )}
            {resetError && (
              <div className="text-xs text-red-600 font-bold mt-2 p-2 bg-red-100 border border-red-300 rounded">
                錯誤：{resetError}
              </div>
            )}
          </div>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
            onClick={() => setShowResetModal(true)}
            disabled={resetLoading || yearEndLoading}
          >
            <AlertTriangle className="w-4 h-4" />
            {resetLoading ? '重設中...' : '重設所有資料'}
          </Button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <ResetDataConfirmModal
        open={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={handleResetData}
        loading={resetLoading}
      />
    </>
  );
}

