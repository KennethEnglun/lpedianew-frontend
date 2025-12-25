import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Shield, Lightbulb } from 'lucide-react';
import Button from '../Button';
import { ModerationResult, RiskLevel } from '../../utils/contentModeration';

interface ContentModerationModalProps {
  open: boolean;
  moderationResult: ModerationResult;
  originalPrompt: string;
  onCancel: () => void;
  onProceed?: () => void; // 只有警告級別才會有此選項
  onUseSuggestion: (suggestion: string) => void;
}

export default function ContentModerationModal(props: ContentModerationModalProps) {
  const {
    open,
    moderationResult,
    originalPrompt,
    onCancel,
    onProceed,
    onUseSuggestion
  } = props;

  if (!open) return null;

  const isBlocked = moderationResult.riskLevel === RiskLevel.BLOCKED;
  const isWarning = moderationResult.riskLevel === RiskLevel.WARNING;

  const modalContent = (
    <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            isBlocked ? 'bg-red-100' : 'bg-yellow-100'
          }`}>
            {isBlocked ? (
              <Shield className="w-6 h-6 text-red-600" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            )}
          </div>
          <div>
            <h3 className={`text-xl font-bold ${
              isBlocked ? 'text-red-700' : 'text-yellow-700'
            }`}>
              {isBlocked ? '內容不適當' : '內容提醒'}
            </h3>
            <p className="text-sm text-gray-600">AI 圖片生成安全檢查</p>
          </div>
        </div>

        {/* 原始提示詞 */}
        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <div className="text-sm font-medium text-gray-700 mb-2">您的描述</div>
          <div className="text-sm text-gray-900 break-words">
            "{originalPrompt}"
          </div>
        </div>

        {/* 檢測結果訊息 */}
        <div className={`rounded-xl p-4 mb-4 ${
          isBlocked ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <div className={`font-bold ${
            isBlocked ? 'text-red-700' : 'text-yellow-700'
          }`}>
            {moderationResult.message}
          </div>

          {moderationResult.blockedKeywords.length > 0 && (
            <div className="text-sm mt-2">
              <span className="text-gray-600">檢測到的關鍵詞：</span>
              <span className={`ml-1 ${
                isBlocked ? 'text-red-600' : 'text-yellow-600'
              }`}>
                {moderationResult.blockedKeywords.join(', ')}
              </span>
            </div>
          )}
        </div>

        {/* 安全建議 */}
        {moderationResult.suggestions.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-blue-600" />
              <span className="font-bold text-blue-700">安全建議</span>
            </div>
            <div className="space-y-2">
              {moderationResult.suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => onUseSuggestion(suggestion)}
                  className="w-full text-left p-2 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors text-sm"
                >
                  "{suggestion}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 教育訊息 */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
          <div className="text-sm text-green-700">
            <div className="font-bold mb-1">💡 學習小提醒</div>
            <div>
              AI 圖片生成是一個強大的學習工具！讓我們用它來創作正面、有創意且適合學習的內容。
              這樣不僅能幫助學習，還能培養良好的數位公民素養。
            </div>
          </div>
        </div>

        {/* 操作按鈕 */}
        <div className="flex gap-3">
          <Button
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700"
            onClick={onCancel}
          >
            {isBlocked ? '修改描述' : '取消'}
          </Button>

          {isWarning && onProceed && (
            <Button
              className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white"
              onClick={onProceed}
            >
              仍要繼續
            </Button>
          )}
        </div>

        {isBlocked && (
          <div className="text-xs text-gray-500 text-center mt-3">
            🛡️ 此限制是為了保護所有使用者，創造安全的學習環境
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}