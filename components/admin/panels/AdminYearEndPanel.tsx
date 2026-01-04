import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, Eye, RefreshCw } from 'lucide-react';
import Button from '../../Button';
import ResetDataConfirmModal from '../ResetDataConfirmModal';
import { authService } from '../../../services/authService';
import AssignmentExplorerModal from '../../AssignmentExplorerModal';
import YearArchiveStudentContentModal from '../YearArchiveStudentContentModal';

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

  const [archivesLoading, setArchivesLoading] = useState(false);
  const [archivesError, setArchivesError] = useState('');
  const [archives, setArchives] = useState<any[]>([]);
  const [archiveExplorerOpen, setArchiveExplorerOpen] = useState(false);
  const [selectedArchiveId, setSelectedArchiveId] = useState('');
  const [studentContentOpen, setStudentContentOpen] = useState(false);
  const [selectedStudentContentArchiveId, setSelectedStudentContentArchiveId] = useState('');

  const loadArchives = async () => {
    try {
      setArchivesLoading(true);
      setArchivesError('');
      const resp = await authService.listYearArchives();
      setArchives(Array.isArray(resp.archives) ? resp.archives : []);
    } catch (e: any) {
      setArchivesError(e?.message || '載入封存列表失敗');
      setArchives([]);
    } finally {
      setArchivesLoading(false);
    }
  };

  useEffect(() => {
    void loadArchives();
  }, []);

  useEffect(() => {
    if (!yearEndResult?.archiveId) return;
    void loadArchives();
  }, [yearEndResult?.archiveId]);

  const archiveAuth = useMemo(() => {
    const archiveId = String(selectedArchiveId || '').trim();
    if (!archiveId) return authService;
    return {
      getManageTasks: (params?: any) => authService.getYearArchiveManageTasks(archiveId, params),
      getAssignmentResponses: (assignmentId: string) => authService.getYearArchiveAssignmentResponses(archiveId, assignmentId),
      getQuizResults: (quizId: string) => authService.getYearArchiveQuizResults(archiveId, quizId),
      getGameResults: (gameId: string) => authService.getYearArchiveGameResults(archiveId, gameId),
      getContestResults: (contestId: string) => authService.getYearArchiveContestResults(archiveId, contestId),
      getContestAttemptDetail: (attemptId: string) => authService.getYearArchiveContestAttemptDetail(archiveId, attemptId),
      getBotTaskThreads: (taskId: string) => authService.getYearArchiveBotTaskThreads(archiveId, taskId),
      getBotTaskThreadMessages: (taskId: string, threadId: string) => authService.getYearArchiveBotTaskThreadMessages(archiveId, taskId, threadId),
      getReviewPackageResults: (packageId: string) => authService.getYearArchiveReviewPackageResults(archiveId, packageId),
      getNoteDetail: (noteId: string) => authService.getYearArchiveNoteDetail(archiveId, noteId),
      listNoteSubmissions: (noteId: string) => authService.listYearArchiveNoteSubmissions(archiveId, noteId),
      getNoteSubmissionDetail: (noteId: string, studentId: string) => authService.getYearArchiveNoteSubmissionDetail(archiveId, noteId, studentId)
    };
  }, [selectedArchiveId]);

  const downloadArchive = async (archiveId: string) => {
    const id = String(archiveId || '').trim();
    if (!id) return;
    try {
      const blob = await authService.downloadYearArchive(id);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `year_archive_${id}.tar.gz`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e: any) {
      alert(e?.message || '下載失敗');
    }
  };

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

      {/* Archives list */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-lg font-black text-brand-brown">年度封存列表</div>
            <div className="text-sm text-gray-600 font-bold mt-1">可查看封存作業（只讀）或打包下載。</div>
          </div>
          <Button
            className="bg-white hover:bg-gray-50 flex items-center gap-2 border border-brand-brown text-brand-brown"
            onClick={() => void loadArchives()}
            disabled={archivesLoading}
          >
            <RefreshCw className={`w-4 h-4 ${archivesLoading ? 'animate-spin' : ''}`} />
            重新載入
          </Button>
        </div>

        {archivesError && <div className="text-red-700 font-bold mb-2">{archivesError}</div>}
        {archivesLoading ? (
          <div className="text-gray-700 font-bold">載入中...</div>
        ) : archives.length === 0 ? (
          <div className="text-gray-600 font-bold">目前沒有封存紀錄</div>
        ) : (
          <div className="space-y-2">
            {archives.map((a: any) => {
              const id = String(a.archiveId || '');
              const at = String(a.archivedAt || '');
              return (
                <div key={id} className="p-3 rounded-2xl border border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-black text-gray-900">{id}</div>
                    <div className="text-xs text-gray-600 font-bold break-words">{at}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      className="bg-white hover:bg-gray-100 flex items-center gap-2 border border-gray-300 text-gray-800"
                      onClick={() => {
                        setSelectedArchiveId(id);
                        setArchiveExplorerOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                      查看
                    </Button>
                    <Button
                      className="bg-white hover:bg-gray-100 flex items-center gap-2 border border-gray-300 text-gray-800"
                      onClick={() => {
                        setSelectedStudentContentArchiveId(id);
                        setStudentContentOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                      學生內容
                    </Button>
                    <Button
                      className="bg-[#E8F5E9] hover:bg-[#C8E6C9] flex items-center gap-2"
                      onClick={() => void downloadArchive(id)}
                    >
                      <Download className="w-4 h-4" />
                      下載
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

      <AssignmentExplorerModal
        open={archiveExplorerOpen}
        onClose={() => {
          setArchiveExplorerOpen(false);
          setSelectedArchiveId('');
        }}
        authService={archiveAuth}
        viewerRole="admin"
        viewerId="admin"
        readOnly
        title={selectedArchiveId ? `封存作業管理（${selectedArchiveId}）` : '封存作業管理'}
      />

      <YearArchiveStudentContentModal
        open={studentContentOpen}
        onClose={() => {
          setStudentContentOpen(false);
          setSelectedStudentContentArchiveId('');
        }}
        archiveId={selectedStudentContentArchiveId}
        authService={authService}
      />
    </>
  );
}
