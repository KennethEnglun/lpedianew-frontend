import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import Button from '../Button';

interface ResetDataConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

const ResetDataConfirmModal: React.FC<ResetDataConfirmModalProps> = ({
  open,
  onClose,
  onConfirm,
  loading = false
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [understood, setUnderstood] = useState(false);
  const requiredText = '重設所有資料';

  const canProceed = confirmText === requiredText && understood;

  const handleConfirm = () => {
    if (canProceed && !loading) {
      onConfirm();
    }
  };

  const handleClose = () => {
    if (!loading) {
      setConfirmText('');
      setUnderstood(false);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <h2 className="text-xl font-black text-red-700">危險操作：重設後端資料</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-bold text-red-800 mb-2">⚠️ 此操作將永久刪除以下所有資料：</h3>
            <ul className="list-disc list-inside text-red-700 space-y-1 text-sm">
              <li>所有已派出的作業、測驗、遊戲、比賽</li>
              <li>所有學生的提交記錄和成績</li>
              <li>所有已封存的班級資料夾</li>
              <li>所有教師和學生的帳號（管理員帳號除外）</li>
              <li>所有聊天記錄和 AI 對話</li>
              <li>所有共享的教材和範本</li>
              <li>所有學生筆記和作品</li>
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-bold text-yellow-800 mb-2">📋 注意事項：</h3>
            <ul className="list-disc list-inside text-yellow-700 space-y-1 text-sm">
              <li>此操作無法復原</li>
              <li>建議在學年結束後才執行</li>
              <li>執行前請確保已備份重要資料</li>
              <li>重設後需重新創建教師和學生帳號</li>
            </ul>
          </div>

          {/* Confirmation Checkbox */}
          <div className="flex items-start gap-3">
            <input
              id="understand-checkbox"
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              disabled={loading}
              className="mt-1"
            />
            <label htmlFor="understand-checkbox" className="text-sm font-medium text-gray-700 cursor-pointer">
              我明白此操作的後果，並確認要繼續進行
            </label>
          </div>

          {/* Confirmation Text Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              請輸入 "<span className="font-bold text-red-600">{requiredText}</span>" 以確認：
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="請輸入確認文字..."
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-6 border-t border-gray-200">
          <Button
            onClick={handleClose}
            disabled={loading}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canProceed || loading}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            {loading ? '重設中...' : '確認重設'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ResetDataConfirmModal;