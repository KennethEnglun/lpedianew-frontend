import React from 'react';
import { Coins, Image, AlertTriangle } from 'lucide-react';
import Button from '../Button';

interface ImageGenerationConfirmModalProps {
  open: boolean;
  currentPoints: number;
  costPerGeneration: number;
  prompt: string;
  onConfirm: () => void;
  onCancel: () => void;
  isGenerating?: boolean;
}

export default function ImageGenerationConfirmModal(props: ImageGenerationConfirmModalProps) {
  const {
    open,
    currentPoints,
    costPerGeneration,
    prompt,
    onConfirm,
    onCancel,
    isGenerating = false
  } = props;

  if (!open) return null;

  const hasEnoughPoints = currentPoints >= costPerGeneration;
  const remainingPoints = currentPoints - costPerGeneration;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <Image className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#5D4037]">確認生成圖片</h3>
            <p className="text-sm text-gray-600">使用AI生成圖片需要消耗點數</p>
          </div>
        </div>

        {/* 點數資訊 */}
        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">目前點數</span>
            <span className="font-bold text-blue-600">{currentPoints}</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">消耗點數</span>
            <span className="font-bold text-red-600">-{costPerGeneration}</span>
          </div>
          <div className="border-t pt-2 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700">剩餘點數</span>
            <span className={`font-bold ${hasEnoughPoints ? 'text-green-600' : 'text-red-500'}`}>
              {hasEnoughPoints ? remainingPoints : '不足'}
            </span>
          </div>
        </div>

        {/* 圖片描述 */}
        <div className="bg-blue-50 rounded-xl p-4 mb-4">
          <div className="text-sm font-medium text-gray-700 mb-2">圖片描述</div>
          <div className="text-sm text-gray-900 break-words">
            {prompt || '無描述'}
          </div>
        </div>

        {/* 警告訊息 */}
        {!hasEnoughPoints && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <div className="font-bold text-red-700">點數不足</div>
              <div className="text-sm text-red-600">
                您需要 {costPerGeneration} 點數才能生成圖片，目前只有 {currentPoints} 點數。
                請聯繫老師獲取更多點數。
              </div>
              <div className="text-xs text-red-500 mt-1">
                💡 您可以通過完成作業或參加活動獲得更多點數
              </div>
            </div>
          </div>
        )}

        {/* 操作按鈕 */}
        <div className="flex gap-3">
          <Button
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700"
            onClick={onCancel}
            disabled={isGenerating}
          >
            取消
          </Button>
          <Button
            className={`flex-1 flex items-center justify-center gap-2 ${
              hasEnoughPoints
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            onClick={onConfirm}
            disabled={!hasEnoughPoints || isGenerating}
          >
            <Coins className="w-4 h-4" />
            {isGenerating ? '生成中...' : `使用 ${costPerGeneration} 點數生成`}
          </Button>
        </div>

        {hasEnoughPoints && (
          <div className="text-xs text-gray-500 text-center mt-3">
            💡 提示：圖片生成需要一些時間，請耐心等候
          </div>
        )}
      </div>
    </div>
  );
}