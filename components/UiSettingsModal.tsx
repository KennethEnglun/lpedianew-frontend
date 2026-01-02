import React from 'react';
import { X } from 'lucide-react';
import Button from './Button';
import { DensityMode, useUi } from '../contexts/UiContext';

interface UiSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const OPTIONS: Array<{ value: DensityMode; label: string; desc: string }> = [
  { value: 'auto', label: '自動', desc: '按畫面大小 + 觸控/滑鼠自動調整' },
  { value: 'comfortable', label: '舒適', desc: '按鈕/字體較大，適合 iPad/手機' },
  { value: 'standard', label: '標準', desc: '平衡尺寸與密度' },
  { value: 'compact', label: '緊湊', desc: '資訊密度較高，適合桌面滑鼠' }
];

const UiSettingsModal: React.FC<UiSettingsModalProps> = ({ open, onClose }) => {
  const { densityMode, setDensityMode, density, formFactor, inputMode } = useUi();

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-comic">
        <div className="p-6 border-b-4 border-brand-brown bg-[#D2EFFF]">
          <div className="flex justify-between items-center gap-4">
            <div>
              <h2 className="text-2xl font-black text-brand-brown">介面顯示設定</h2>
              <div className="text-sm text-brand-brown/80 font-bold mt-1">
                偵測：{formFactor} / {inputMode}（套用：{density}）
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
              aria-label="關閉"
            >
              <X className="w-6 h-6 text-brand-brown" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-3">
            {OPTIONS.map((opt) => {
              const checked = densityMode === opt.value;
              return (
                <label
                  key={opt.value}
                  className={`block p-4 rounded-2xl border-4 cursor-pointer transition-colors ${
                    checked ? 'border-brand-brown bg-brand-cream' : 'border-gray-200 bg-white hover:border-brand-brown/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="densityMode"
                      className="mt-1"
                      checked={checked}
                      onChange={() => setDensityMode(opt.value)}
                    />
                    <div className="flex-1">
                      <div className="text-lg font-black text-brand-brown">{opt.label}</div>
                      <div className="text-sm text-gray-600 font-bold mt-1">{opt.desc}</div>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              完成
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UiSettingsModal;

