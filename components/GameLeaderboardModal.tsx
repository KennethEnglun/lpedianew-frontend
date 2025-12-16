import React, { useEffect, useState } from 'react';
import { GameLeaderboard, GameType, GAME_TYPE_CONFIG, SUBJECT_CONFIG } from '../types';
import authService from '../services/authService';

interface Props {
  gameId: string;
  onClose: () => void;
  onStartGame: () => void;
}

const GameLeaderboardModal: React.FC<Props> = ({ gameId, onClose, onStartGame }) => {
  const [leaderboard, setLeaderboard] = useState<GameLeaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLeaderboard();
  }, [gameId]);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await authService.getGameLeaderboard(gameId);
      setLeaderboard(data);
    } catch (err) {
      console.error('載入排行榜失敗:', err);
      setError('載入排行榜失敗');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}秒`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `${rank}`;
  };

  const getAccuracyPercentage = (correct: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((correct / total) * 100);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 m-4 max-w-2xl w-full max-h-[90vh] flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">載入排行榜中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !leaderboard) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 m-4 max-w-2xl w-full max-h-[90vh]">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error || '無法載入排行榜'}</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={loadLeaderboard}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                重試
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const gameTypeConfig = GAME_TYPE_CONFIG[leaderboard.gameType as GameType] || GAME_TYPE_CONFIG[GameType.MATH];
  const subjectConfig = SUBJECT_CONFIG[leaderboard.subject];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 m-4 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 頭部 */}
        <div className="flex-shrink-0 border-b pb-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              🏆 遊戲排行榜
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ✕
            </button>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2"
                 style={{ backgroundColor: gameTypeConfig.color + '40' }}
                 className="px-3 py-1 rounded-full">
              <span>{gameTypeConfig.icon}</span>
              <span>{gameTypeConfig.name}</span>
            </div>
            <div className="flex items-center gap-2"
                 style={{ backgroundColor: subjectConfig.color + '40' }}
                 className="px-3 py-1 rounded-full">
              <span>{subjectConfig.icon}</span>
              <span>{leaderboard.subject}</span>
            </div>
          </div>

          <h3 className="text-lg font-semibold mt-2">{leaderboard.gameTitle}</h3>
        </div>

        {/* 排行榜內容 */}
        <div className="flex-1 overflow-y-auto">
          {leaderboard.entries.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎮</div>
              <p className="text-gray-500 text-lg">暫無排行榜記錄</p>
              <p className="text-gray-400 text-sm">成為第一個完成遊戲的人吧！</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.entries.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`p-4 rounded-lg border transition-all ${
                    index < 3
                      ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200'
                      : 'bg-gray-50 border-gray-200'
                  } hover:shadow-md`}
                >
                  <div className="flex items-center justify-between">
                    {/* 左側：排名和用戶信息 */}
                    <div className="flex items-center gap-4">
                      <div className="text-2xl font-bold min-w-[3rem] text-center">
                        {getRankDisplay(entry.rank || index + 1)}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">
                          {entry.userName}
                        </div>
                        {entry.userClass && (
                          <div className="text-sm text-gray-500">
                            {entry.userClass}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 右側：成績信息 */}
                    <div className="text-right">
                      <div className="text-xl font-bold text-blue-600">
                        {entry.score}分
                      </div>
                      <div className="text-sm text-gray-600">
                        正確率: {getAccuracyPercentage(entry.correctAnswers, entry.totalQuestions)}%
                        ({entry.correctAnswers}/{entry.totalQuestions})
                      </div>
                      <div className="text-sm text-gray-500">
                        用時: {formatTime(entry.timeSpent)}
                      </div>
                      {entry.extraData?.wavesSurvived && (
                        <div className="text-sm text-purple-600">
                          存活波數: {entry.extraData.wavesSurvived}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部按鈕 */}
        <div className="flex-shrink-0 border-t pt-4 mt-4">
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              返回
            </button>
            <button
              onClick={onStartGame}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
            >
              <span>🎮</span>
              開始遊戲
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameLeaderboardModal;