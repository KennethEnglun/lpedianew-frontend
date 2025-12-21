import React from 'react';
import Button from '../../Button';

export default function AdminYearEndPanel(props: {
  yearEndLoading: boolean;
  yearEndResult: { archiveId: string; archivedAt: string } | null;
  onRun: () => void;
}) {
  const { yearEndLoading, yearEndResult, onRun } = props;
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
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
  );
}

