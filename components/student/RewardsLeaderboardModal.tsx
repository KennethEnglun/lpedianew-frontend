import React from 'react';
import { X } from 'lucide-react';

export function RewardsLeaderboardModal(props: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string;
  data: null | {
    gradeKey: string | null;
    meUserId: string;
    myRank: number | null;
    students: Array<{ userId: string; name: string; username: string; className: string; points: number; rank: number }>;
  };
}) {
  const { open, onClose, loading, error, data } = props;
  if (!open) return null;

  const title = (() => {
    const k = data?.gradeKey;
    if (!k) return '獎勵排行榜';
    return `${k}年級獎勵排行榜`;
  })();

  const rows = Array.isArray(data?.students) ? data!.students : [];
  const me = data?.meUserId ? String(data.meUserId) : '';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-comic flex flex-col">
        <div className="p-6 border-b-4 border-brand-brown bg-[#FDEEAD] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-2xl font-black text-brand-brown truncate">{title}</div>
            <div className="text-sm font-bold text-gray-600">只顯示同級同學的獎勵積分排行</div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center flex-shrink-0"
            aria-label="關閉"
          >
            <X className="w-6 h-6 text-brand-brown" />
          </button>
        </div>

        <div className="p-6 bg-brand-cream overflow-y-auto">
          {error && (
            <div className="mb-4 bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-red-800 font-bold">
              {error}
            </div>
          )}
          {loading ? (
            <div className="text-center py-10 text-gray-600 font-bold">載入中...</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-10 text-gray-500 font-bold">暫時沒有資料</div>
          ) : (
            <div className="bg-white border-4 border-brand-brown rounded-3xl overflow-hidden shadow-comic">
              <table className="w-full text-left">
                <thead className="bg-white/80">
                  <tr className="text-sm text-gray-600">
                    <th className="px-4 py-3 font-black w-16">名次</th>
                    <th className="px-4 py-3 font-black">姓名</th>
                    <th className="px-4 py-3 font-black w-28">班別</th>
                    <th className="px-4 py-3 font-black w-24 text-right">分數</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const isMe = me && String(r.userId) === me;
                    return (
                      <tr key={`${r.userId}-${idx}`} className={isMe ? 'bg-[#D2EFFF]' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 font-black text-brand-brown">{r.rank}</td>
                        <td className="px-4 py-3 font-bold text-gray-800">{r.name || r.username || '—'}</td>
                        <td className="px-4 py-3 font-bold text-gray-600">{r.className || '—'}</td>
                        <td className="px-4 py-3 font-black text-right text-gray-800">{Number(r.points) || 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

