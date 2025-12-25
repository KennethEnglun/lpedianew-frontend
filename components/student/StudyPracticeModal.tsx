/**
 * 學生自主學習練習主模態框
 * 包含範圍設置、題目生成、答題、結果展示等功能
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, BookOpen, Settings, Brain, Trophy, Clock, Target } from 'lucide-react';
import Button from '../Button';
import type {
  StudyScope,
  StudyQuestion,
  StudySession,
  StudentAnswer
} from '../../types/study';
import { useAuth } from '../../contexts/AuthContext';
import { questionGenerator } from '../../services/questionGenerator';
import { validateStudyContent, studyStorage, generateId } from '../../utils/studyUtils';

// 模态框步骤状态
type StudyStep = 'setup' | 'generating' | 'quiz' | 'results';

interface StudyPracticeModalProps {
  open: boolean;
  onClose: () => void;
}

export default function StudyPracticeModal({ open, onClose }: StudyPracticeModalProps) {
  const { user } = useAuth();

  // 主要狀態管理
  const [currentStep, setCurrentStep] = useState<StudyStep>('setup');
  const [scope, setScope] = useState<Partial<StudyScope>>({
    subject: '數學', // 預設科目
    chapters: [],
    topics: [],
    difficulty: 'medium',
    questionCount: 10,
    contentSource: 'chapters',
    customContent: ''
  });

  // 題目和答題狀態
  const [questions, setQuestions] = useState<StudyQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<StudentAnswer[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<string>('');
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);

  // UI狀態
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 重置狀態
  const resetStates = () => {
    setCurrentStep('setup');
    setQuestions([]);
    setAnswers([]);
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setError('');
    setStartTime('');
    setQuestionStartTime(0);
  };

  // 模态框打开时重置状态
  useEffect(() => {
    if (open) {
      resetStates();
    }
  }, [open]);

  // 設置題目開始時間
  useEffect(() => {
    if (currentStep === 'quiz') {
      setQuestionStartTime(Date.now());
    }
  }, [currentStep, currentQuestionIndex]);

  // 關閉模態框
  const handleClose = () => {
    resetStates();
    onClose();
  };

  // 開始生成題目
  const handleStartGeneration = async () => {
    // 驗證設置
    const validation = validateStudyContent.studyScope(scope);
    if (!validation.isValid) {
      setError(validation.errors.join('；'));
      return;
    }

    setLoading(true);
    setError('');
    setCurrentStep('generating');

    try {
      const fullScope: StudyScope = {
        id: generateId.scope(),
        subject: scope.subject!,
        chapters: scope.chapters || [],
        topics: scope.topics || [],
        difficulty: scope.difficulty!,
        questionCount: scope.questionCount!,
        customContent: scope.customContent,
        contentSource: scope.contentSource!,
        createdAt: new Date().toISOString()
      };

      const response = await questionGenerator.generateQuestions(fullScope);

      if (!response.success || !response.data) {
        throw new Error(response.error || '題目生成失敗');
      }

      setQuestions(response.data);
      setScope(fullScope);
      setStartTime(new Date().toISOString());
      setCurrentStep('quiz');

    } catch (error) {
      console.error('生成題目失敗:', error);
      setError(error instanceof Error ? error.message : '生成失敗，请重试');
      setCurrentStep('setup');
    } finally {
      setLoading(false);
    }
  };

  // 提交答案并移到下一題
  const handleAnswerSubmit = () => {
    if (selectedOption === null) return;

    const currentQuestion = questions[currentQuestionIndex];
    const timeSpent = Math.round((Date.now() - questionStartTime) / 1000);

    const answer: StudentAnswer = {
      questionId: currentQuestion.id,
      selectedOption,
      isCorrect: selectedOption === currentQuestion.correctAnswer,
      timeSpent,
      answeredAt: new Date().toISOString()
    };

    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);

    // 移到下一題或结束测验
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedOption(null);
      setQuestionStartTime(Date.now());
    } else {
      // 测验结束，保存结果
      finishQuiz(newAnswers);
    }
  };

  // 完成測驗
  const finishQuiz = (finalAnswers: StudentAnswer[]) => {
    if (!user?.id || !scope.id) return;

    const endTime = new Date().toISOString();
    const totalTimeSpent = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000);
    const correctCount = finalAnswers.filter(a => a.isCorrect).length;
    const score = Math.round((correctCount / questions.length) * 100);
    const accuracy = correctCount / questions.length;

    const session: StudySession = {
      id: generateId.session(),
      studentId: user.id,
      studentName: user.profile?.name || user.username || '學生',
      scope: scope as StudyScope,
      questions,
      answers: finalAnswers,
      score,
      accuracy,
      totalTimeSpent,
      startTime,
      endTime,
      completed: true,
      createdAt: new Date().toISOString()
    };

    // 保存学习记录
    studyStorage.saveSession(session);

    setCurrentStep('results');
  };

  // 获取当前題目
  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = answers.find(a => a.questionId === currentQuestion?.id);

  if (!open) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-comic-xl border-4 border-brand-brown">
        {/* 头部标題栏 */}
        <div className="bg-[#A1D9AE] border-b-4 border-brand-brown px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown flex items-center justify-center">
              {currentStep === 'setup' && <Settings className="w-5 h-5 text-brand-brown" />}
              {currentStep === 'generating' && <Brain className="w-5 h-5 text-brand-brown" />}
              {currentStep === 'quiz' && <BookOpen className="w-5 h-5 text-brand-brown" />}
              {currentStep === 'results' && <Trophy className="w-5 h-5 text-brand-brown" />}
            </div>
            <div>
              <div className="text-xl font-black text-brand-brown">
                {currentStep === 'setup' && '學習練習設置'}
                {currentStep === 'generating' && 'AI 題目生成中'}
                {currentStep === 'quiz' && '答題練習'}
                {currentStep === 'results' && '練習結果'}
              </div>
              {currentStep === 'quiz' && (
                <div className="text-sm text-brand-brown/80">
                  第 {currentQuestionIndex + 1} 題 / 共 {questions.length} 題
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleClose}
            className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
            aria-label="关闭"
          >
            <X className="w-5 h-5 text-brand-brown" />
          </button>
        </div>

        {/* 主要内容区域 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* 设置步骤 */}
          {currentStep === 'setup' && (
            <div className="space-y-6">
              {/* 内容来源选择 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">学习内容来源</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="contentSource"
                      value="chapters"
                      checked={scope.contentSource === 'chapters'}
                      onChange={(e) => setScope(prev => ({ ...prev, contentSource: e.target.value as 'chapters' }))}
                      className="w-4 h-4"
                    />
                    <span>按章节选择</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="contentSource"
                      value="custom"
                      checked={scope.contentSource === 'custom'}
                      onChange={(e) => setScope(prev => ({ ...prev, contentSource: e.target.value as 'custom' }))}
                      className="w-4 h-4"
                    />
                    <span>自定義內容</span>
                  </label>
                </div>
              </div>

              {/* 科目选择 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">學習科目</label>
                <select
                  value={scope.subject || '數學'}
                  onChange={(e) => setScope(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
                >
                  <option value="數學">數學</option>
                  <option value="中文">中文</option>
                  <option value="英文">英文</option>
                  <option value="常識">常識</option>
                  <option value="科學">科學</option>
                </select>
              </div>

              {/* 章节选择（按章节模式） */}
              {scope.contentSource === 'chapters' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">學習章節</label>
                  <textarea
                    value={scope.chapters?.join('，') || ''}
                    onChange={(e) => setScope(prev => ({
                      ...prev,
                      chapters: e.target.value.split('，').map(ch => ch.trim()).filter(Boolean)
                    }))}
                    placeholder="請輸入學習章節，用逗號分隔，例如：第一章 數字概念，第二章 加減運算"
                    className="w-full h-20 px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown resize-none"
                  />
                </div>
              )}

              {/* 自定義內容（自定义模式） */}
              {scope.contentSource === 'custom' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    自定義學習內容
                    <span className="text-xs text-gray-500 ml-2">
                      ({scope.customContent?.length || 0}/2000字)
                    </span>
                  </label>
                  <textarea
                    value={scope.customContent || ''}
                    onChange={(e) => setScope(prev => ({ ...prev, customContent: e.target.value }))}
                    placeholder="請輸入要學習的具體內容，可以是課本內容、筆記、或任何學習材料（最多2000字）"
                    maxLength={2000}
                    className="w-full h-40 px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown resize-none"
                  />
                  {scope.customContent && scope.customContent.length > 1800 && (
                    <div className="text-xs text-orange-600 mt-1">
                      內容即將達到字數限制 (2000字)
                    </div>
                  )}
                </div>
              )}

              {/* 知识点提示 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">重點知識點 (可選)</label>
                <input
                  type="text"
                  value={scope.topics?.join('，') || ''}
                  onChange={(e) => setScope(prev => ({
                    ...prev,
                    topics: e.target.value.split('，').map(t => t.trim()).filter(Boolean)
                  }))}
                  placeholder="例如：分數計算，小數點，百分比"
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
                />
              </div>

              {/* 难度和題目數量 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">難度級別</label>
                  <select
                    value={scope.difficulty || 'medium'}
                    onChange={(e) => setScope(prev => ({ ...prev, difficulty: e.target.value as any }))}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
                  >
                    <option value="easy">簡單</option>
                    <option value="medium">中等</option>
                    <option value="hard">困難</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">題目數量</label>
                  <select
                    value={scope.questionCount || 10}
                    onChange={(e) => setScope(prev => ({ ...prev, questionCount: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
                  >
                    <option value={5}>5 題</option>
                    <option value={10}>10 題</option>
                    <option value={15}>15 題</option>
                    <option value={20}>20 題</option>
                    <option value={30}>30 題</option>
                    <option value={50}>50 題</option>
                  </select>
                </div>
              </div>

              {/* 错误提示 */}
              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3">
                  <div className="text-red-700 font-bold text-sm">{error}</div>
                </div>
              )}

              {/* 开始按钮 */}
              <div className="flex justify-end">
                <Button
                  className="bg-[#A1D9AE] hover:bg-[#8BC7A1] text-brand-brown flex items-center gap-2"
                  onClick={handleStartGeneration}
                  disabled={loading}
                >
                  <Brain className="w-4 h-4" />
                  開始生成題目
                </Button>
              </div>
            </div>
          )}

          {/* 生成中步骤 */}
          {currentStep === 'generating' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="w-16 h-16 border-4 border-brand-brown border-t-transparent rounded-full animate-spin"></div>
              <div className="text-center">
                <div className="text-xl font-bold text-brand-brown mb-2">AI 正在為您生成題目</div>
                <div className="text-gray-600">
                  正在根據您的學習範圍生成 {scope.questionCount} 道{scope.difficulty === 'easy' ? '簡單' : scope.difficulty === 'medium' ? '中等' : '困難'}難度的題目...
                </div>
              </div>
            </div>
          )}

          {/* 答題步骤 */}
          {currentStep === 'quiz' && currentQuestion && (
            <div className="space-y-6">
              {/* 进度条 */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-[#A1D9AE] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                ></div>
              </div>

              {/* 題目內容 */}
              <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="text-lg font-bold text-gray-800">
                    {currentQuestion.content}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span>第 {currentQuestionIndex + 1} 題</span>
                  </div>
                </div>

                {/* 選項 */}
                <div className="space-y-3">
                  {currentQuestion.options.map((option, index) => (
                    <label
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedOption === index
                          ? 'bg-[#A1D9AE] border-brand-brown'
                          : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="answer"
                        value={index}
                        checked={selectedOption === index}
                        onChange={() => setSelectedOption(index)}
                        className="w-4 h-4"
                      />
                      <span className="font-bold text-gray-800">
                        {String.fromCharCode(65 + index)}.
                      </span>
                      <span className="flex-1">{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 題目資訊 */}
              <div className="flex items-center justify-between text-sm text-gray-600">
                <div className="flex items-center gap-4">
                  <span>📚 {currentQuestion.topic}</span>
                  <span>📊 {currentQuestion.difficulty === 'easy' ? '簡單' : currentQuestion.difficulty === 'medium' ? '中等' : '困難'}</span>
                </div>
                <div>
                  題目來源：{currentQuestion.source}
                </div>
              </div>

              {/* 提交按鈕 */}
              <div className="flex justify-center">
                <Button
                  className="bg-[#A1D9AE] hover:bg-[#8BC7A1] text-brand-brown px-8"
                  onClick={handleAnswerSubmit}
                  disabled={selectedOption === null}
                >
                  {currentQuestionIndex < questions.length - 1 ? '下一題' : '完成測驗'}
                </Button>
              </div>
            </div>
          )}

          {/* 結果步驟 */}
          {currentStep === 'results' && (
            <div className="text-center space-y-6">
              <div className="text-2xl font-bold text-brand-brown mb-4">🎉 練習完成！</div>

              {/* 成績展示 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                  <div className="text-2xl font-bold text-blue-600">
                    {answers.filter(a => a.isCorrect).length}/{questions.length}
                  </div>
                  <div className="text-sm text-blue-600">正確題數</div>
                </div>
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                  <div className="text-2xl font-bold text-green-600">
                    {Math.round((answers.filter(a => a.isCorrect).length / questions.length) * 100)}%
                  </div>
                  <div className="text-sm text-green-600">正確率</div>
                </div>
                <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round(answers.reduce((sum, a) => sum + a.timeSpent, 0) / 60)}分鐘
                  </div>
                  <div className="text-sm text-purple-600">用時</div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-3 justify-center">
                <Button
                  className="bg-[#A1D9AE] hover:bg-[#8BC7A1] text-brand-brown"
                  onClick={() => setCurrentStep('setup')}
                >
                  再次练习
                </Button>
                <Button
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700"
                  onClick={handleClose}
                >
                  查看详细分析
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}