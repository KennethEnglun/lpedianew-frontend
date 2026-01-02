import React from 'react';
import Button from '../../Button';

export default function AdminAssignmentsPanel(props: { onOpen: () => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-lg font-black text-brand-brown">作業管理（檔案總管）</div>
          <div className="text-sm text-gray-600 font-bold mt-1">
            以「科目 → 班別 → 學段 → 課題 → 任務」瀏覽；管理員可查看、刪除及封存。
          </div>
        </div>
        <Button className="bg-[#B5D8F8] hover:bg-[#A1CCF0]" onClick={props.onOpen}>
          開啟作業管理
        </Button>
      </div>
    </div>
  );
}

