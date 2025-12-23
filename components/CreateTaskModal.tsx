import React, { useEffect } from 'react';
import { Calculator, FileText, Gamepad2, HelpCircle, MessageSquare, Trophy, X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  onSelectTool: (tool: 'discussion' | 'note' | 'quiz' | 'mathQuiz' | 'game' | 'contest') => void;
};

const CreateTaskModal: React.FC<Props> = ({ open, onClose, onSelectTool }) => {
  useEffect(() => {
    if (!open) return;
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[80] flex items-center justify-center p-4">
      <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-comic">
        <div className="p-6 border-b-4 border-brand-brown bg-[#C0E2BE] flex items-center justify-between">
          <div>
            <div className="text-2xl font-black text-brand-brown">建立任務</div>
            <div className="text-sm text-brand-brown/80 font-bold">選擇工具後，會開啟對應的編輯介面</div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
          >
            <X className="w-6 h-6 text-brand-brown" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => {
                onSelectTool('discussion');
                onClose();
              }}
              className="p-5 rounded-3xl border-4 border-brand-brown bg-[#F8C5C5] hover:bg-[#F0B5B5] text-left shadow-comic"
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="w-7 h-7 text-brand-brown" />
                <div className="text-xl font-black text-brand-brown">討論</div>
              </div>
              <div className="mt-2 text-sm font-bold text-brand-brown/80">建立討論串內容（文字 / 圖片 / 連結）</div>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectTool('note');
                onClose();
              }}
              className="p-5 rounded-3xl border-4 border-brand-brown bg-[#E9E6FF] hover:bg-[#DCD6FF] text-left shadow-comic"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-7 h-7 text-brand-brown" />
                <div className="text-xl font-black text-brand-brown">筆記</div>
              </div>
              <div className="mt-2 text-sm font-bold text-brand-brown/80">A4 筆記（文字 / 圖片 / 手寫）</div>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectTool('quiz');
                onClose();
              }}
              className="p-5 rounded-3xl border-4 border-brand-brown bg-[#FDEEAD] hover:bg-[#FCE690] text-left shadow-comic"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="w-7 h-7 text-brand-brown" />
                <div className="text-xl font-black text-brand-brown">小測驗</div>
              </div>
              <div className="mt-2 text-sm font-bold text-brand-brown/80">題目 + 選項 + 圖片</div>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectTool('mathQuiz');
                onClose();
              }}
              className="p-5 rounded-3xl border-4 border-brand-brown bg-[#DFF6FF] hover:bg-[#CDEFFF] text-left shadow-comic"
            >
              <div className="flex items-center gap-3">
                <Calculator className="w-7 h-7 text-brand-brown" />
                <div className="text-xl font-black text-brand-brown">數學測驗</div>
              </div>
              <div className="mt-2 text-sm font-bold text-brand-brown/80">算式 / 分數 / 進階設定</div>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectTool('game');
                onClose();
              }}
              className="p-5 rounded-3xl border-4 border-brand-brown bg-[#E8F5E9] hover:bg-[#C8E6C9] text-left shadow-comic"
            >
              <div className="flex items-center gap-3">
                <Gamepad2 className="w-7 h-7 text-brand-brown" />
                <div className="text-xl font-black text-brand-brown">小遊戲</div>
              </div>
              <div className="mt-2 text-sm font-bold text-brand-brown/80">以遊戲形式完成題目</div>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectTool('contest');
                onClose();
              }}
              className="p-5 rounded-3xl border-4 border-brand-brown bg-[#FFF2DC] hover:bg-[#FCEBCD] text-left shadow-comic"
            >
              <div className="flex items-center gap-3">
                <Trophy className="w-7 h-7 text-brand-brown" />
                <div className="text-xl font-black text-brand-brown">問答比賽</div>
              </div>
              <div className="mt-2 text-sm font-bold text-brand-brown/80">限時 / 排名 / 多題目</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateTaskModal;
