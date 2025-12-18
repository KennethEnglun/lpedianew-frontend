import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { MathToken, Rational } from '../services/mathGame';
import { isPowerOfTen, normalizeRational, rationalKey } from '../services/mathGame';
import { authService } from '../services/authService';
import { MathExpressionView } from './MathExpressionView';

type StageQuestion =
  | { kind: 'calc'; numberMode: 'fraction' | 'decimal'; tokens: MathToken[]; answer: Rational }
  | { kind: 'eq'; numberMode: 'fraction' | 'decimal'; equation: string; leftTokens: MathToken[]; rightTokens: MathToken[]; answer: Rational };

type InputMode = 'int' | 'frac' | 'mixed' | 'dec';
type InputFocus = 'whole' | 'num' | 'den';

const clampDigits = (s: string, maxLen = 6) => String(s || '').replace(/[^\d]/g, '').slice(0, maxLen);

const clampDecimal = (s: string, maxLen = 10) => {
  const raw = String(s || '').replace(/[^\d.]/g, '');
  const parts = raw.split('.');
  const intPart = parts[0] || '';
  const fracPart = (parts[1] || '').replace(/\./g, '');
  const merged = fracPart.length > 0 ? `${intPart}.${fracPart}` : intPart;
  return merged.slice(0, maxLen);
};

const parseSafeInt = (s: string) => {
  const v = Number.parseInt(String(s || '').trim(), 10);
  if (!Number.isFinite(v)) return null;
  return v;
};

const buildRationalFromUi = (state: {
  sign: 1 | -1;
  mode: InputMode;
  whole: string;
  num: string;
  den: string;
}): { ok: true; value: Rational } | { ok: false; error: string } => {
  const sign = state.sign === -1 ? -1 : 1;
  const mode = state.mode;

  const wholeAbs = parseSafeInt(state.whole);
  const whole = wholeAbs === null ? 0 : Math.abs(wholeAbs);
  const numAbs = parseSafeInt(state.num);
  const num = numAbs === null ? 0 : Math.abs(numAbs);
  const denAbs = parseSafeInt(state.den);
  const den = denAbs === null ? 0 : Math.abs(denAbs);

  if (mode === 'int') {
    const w = parseSafeInt(state.whole);
    if (w === null) return { ok: false, error: '請輸入整數答案' };
    return { ok: true, value: normalizeRational({ n: sign * Math.abs(w), d: 1 }) };
  }

  if (mode === 'dec') {
    const raw = String(state.whole || '').trim();
    if (!raw) return { ok: false, error: '請輸入小數答案' };
    if (raw.includes('.')) {
      const m = raw.match(/^(\d*)\.(\d*)$/);
      if (!m) return { ok: false, error: '小數格式不正確' };
      const intText = m[1] || '0';
      const fracText = m[2] || '';
      if (!intText && !fracText) return { ok: false, error: '小數格式不正確' };
      const k = fracText.length;
      const d = k === 0 ? 1 : 10 ** k;
      const nInt = Number.parseInt(intText || '0', 10);
      const nFrac = fracText ? Number.parseInt(fracText, 10) : 0;
      if (!Number.isFinite(nInt) || !Number.isFinite(nFrac)) return { ok: false, error: '小數格式不正確' };
      const n = (nInt * d + nFrac) * sign;
      return { ok: true, value: normalizeRational({ n, d }) };
    }
    const w = parseSafeInt(raw);
    if (w === null) return { ok: false, error: '小數格式不正確' };
    return { ok: true, value: normalizeRational({ n: sign * Math.abs(w), d: 1 }) };
  }

  if (mode === 'frac') {
    const nRaw = parseSafeInt(state.num);
    if (nRaw === null) return { ok: false, error: '請輸入分子/整數' };
    if (!state.den.trim()) {
      return { ok: true, value: normalizeRational({ n: sign * Math.abs(nRaw), d: 1 }) };
    }
    if (den === 0) return { ok: false, error: '分母不可為 0' };
    return { ok: true, value: normalizeRational({ n: sign * Math.abs(nRaw), d: den }) };
  }

  // mixed
  if (!state.den.trim() && !state.num.trim()) {
    const w = parseSafeInt(state.whole);
    if (w === null) return { ok: false, error: '請輸入帶分數或切換成整數模式' };
    return { ok: true, value: normalizeRational({ n: sign * Math.abs(w), d: 1 }) };
  }

  if (den === 0) return { ok: false, error: '分母不可為 0' };
  if (num === 0 && whole === 0) return { ok: false, error: '請輸入答案' };

  const n = (whole * den + num) * sign;
  return { ok: true, value: normalizeRational({ n, d: den || 1 }) };
};

const KeypadButton: React.FC<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}> = ({ label, onClick, disabled, className }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={[
      'h-11 rounded-xl border-2 font-black text-lg shadow-sm',
      disabled
        ? 'bg-black/10 border-white/20 text-black/30 cursor-not-allowed'
        : 'bg-white/70 border-white/70 text-[#2F2A4A] hover:bg-white hover:-translate-y-[1px] active:translate-y-0 transition',
      className || ''
    ].join(' ')}
  >
    {label}
  </button>
);

const Battlefield: React.FC<{
  playerHp: number;
  enemyHp: number;
  intensity: number;
}> = ({ playerHp, enemyHp, intensity }) => {
  const t = Math.max(0, Math.min(1, intensity));
  const glow = 0.15 + t * 0.6;
  return (
    <Canvas
      camera={{ position: [0, 6, 10], fov: 50 }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[6, 10, 4]} intensity={1.0} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.75, 0]}>
        <planeGeometry args={[40, 10]} />
        <meshStandardMaterial color="#DFF6FF" roughness={0.9} metalness={0.05} />
      </mesh>

      <mesh position={[-16, 0, 0]}>
        <boxGeometry args={[2, 2 + Math.max(0, Math.min(1, playerHp / 20)) * 0.6, 2]} />
        <meshStandardMaterial color="#A1D9AE" emissive="#A1D9AE" emissiveIntensity={glow} />
      </mesh>
      <mesh position={[16, 0, 0]}>
        <boxGeometry args={[2, 2 + Math.max(0, Math.min(1, enemyHp / 20)) * 0.6, 2]} />
        <meshStandardMaterial color="#FFB5B5" emissive="#FFB5B5" emissiveIntensity={glow} />
      </mesh>
    </Canvas>
  );
};

export const RangerTdGame: React.FC<{
  game: any;
  gameId: string;
  onExit: () => void;
  onStart: () => void;
  onComplete: (result: { success: boolean; score: number; correctAnswers: number; totalQuestions: number; timeSpent: number; details?: any }) => void;
}> = ({ game, gameId, onExit, onStart, onComplete }) => {
  const cfg = (game?.rangerTd && typeof game.rangerTd === 'object') ? game.rangerTd : {};
  const allowNegative = Boolean(cfg?.constraints?.allowNegative);
  const wrongTowerDamage = Number(cfg?.wrongTowerDamage) || 2;
  const towerHpMax = Number(cfg?.towerHp) || 20;
  const timeLimitSeconds: number | null = typeof game?.timeLimitSeconds === 'number' ? game.timeLimitSeconds : 300;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stageIndex, setStageIndex] = useState(0);
  const [stageQuestions, setStageQuestions] = useState<StageQuestion[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [combo, setCombo] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [playerHp, setPlayerHp] = useState(towerHpMax);
  const [enemyHp, setEnemyHp] = useState(30);
  const [skillLevel, setSkillLevel] = useState(1);

  const [remaining, setRemaining] = useState<number | null>(timeLimitSeconds);
  const startedRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  const [inputMode, setInputMode] = useState<InputMode>('int');
  const [inputSign, setInputSign] = useState<1 | -1>(1);
  const [inputWhole, setInputWhole] = useState('');
  const [inputNum, setInputNum] = useState('');
  const [inputDen, setInputDen] = useState('');
  const [inputFocus, setInputFocus] = useState<InputFocus>('whole');

  const current: StageQuestion | null = stageQuestions[qIndex] || null;
  const answer: Rational | null = current?.answer ? normalizeRational(current.answer) : null;
  const configuredNumberMode: 'fraction' | 'decimal' | null = current?.numberMode || null;

  const answerNumberType: 'int' | 'frac' | 'dec' = useMemo(() => {
    if (!answer) return 'int';
    if (configuredNumberMode === 'decimal') return 'dec';
    if (answer.d === 1) return 'int';
    if (configuredNumberMode === 'fraction') return 'frac';
    const d = Number(answer.d);
    if (Number.isInteger(d) && d > 0 && isPowerOfTen(d)) return 'dec';
    return 'frac';
  }, [answer?.n, answer?.d, configuredNumberMode]);

  const resetInput = (mode: InputMode) => {
    setInputMode(mode);
    setInputFocus(mode === 'frac' ? 'num' : 'whole');
    setInputSign(1);
    setInputWhole('');
    setInputNum('');
    setInputDen('');
  };

  const fetchStage = async (nextStageIndex: number) => {
    try {
      setError('');
      setLoading(true);
      const resp = await authService.generateRangerMathStage(gameId, { stageIndex: nextStageIndex });
      const qs = Array.isArray(resp?.questions) ? resp.questions : [];
      setStageQuestions(qs);
      setQIndex(0);
      setEnemyHp(30 + nextStageIndex * 5);
    } catch (e: any) {
      setError(e?.message || '載入關卡失敗');
      setStageQuestions([]);
      setQIndex(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startTimeRef.current = Date.now();
    onStart();
    fetchStage(0);
  }, [onStart]);

  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 0) return;
    const id = window.setInterval(() => setRemaining((s) => (s === null ? null : Math.max(0, s - 1))), 1000);
    return () => window.clearInterval(id);
  }, [remaining]);

  useEffect(() => {
    if (completedRef.current) return;
    if (playerHp <= 0) {
      completedRef.current = true;
      const timeSpent = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : 0;
      const score = answered > 0 ? Math.round((correct / answered) * 100) : 0;
      onComplete({
        success: false,
        score,
        correctAnswers: correct,
        totalQuestions: answered,
        timeSpent,
        details: { type: 'ranger-td', stageIndex, comboMax: undefined }
      });
    }
  }, [playerHp, correct, answered, stageIndex, onComplete]);

  useEffect(() => {
    if (completedRef.current) return;
    if (remaining !== null && remaining <= 0) {
      completedRef.current = true;
      const timeSpent = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : 0;
      const score = answered > 0 ? Math.round((correct / answered) * 100) : 0;
      onComplete({
        success: playerHp > 0,
        score,
        correctAnswers: correct,
        totalQuestions: answered,
        timeSpent,
        details: { type: 'ranger-td', stageIndex, enemyHp }
      });
    }
  }, [remaining, playerHp, correct, answered, stageIndex, enemyHp, onComplete]);

  useEffect(() => {
    if (!answer) return;
    if (loading) return;
    const nextMode: InputMode = answerNumberType === 'dec' ? 'dec' : (answerNumberType === 'frac' ? 'frac' : 'int');
    resetInput(nextMode);
  }, [qIndex, answerNumberType, loading, answer?.n, answer?.d]);

  const applyKey = (key: string) => {
    const setTargetInt = (setter: (v: string) => void, currentValue: string) => {
      if (key === '⌫' || key === '<') return setter(currentValue.slice(0, -1));
      if (key === '清除') return setter('');
      if (isNaN(Number(key))) return;
      setter(clampDigits(currentValue + key));
    };
    const setTargetDec = (setter: (v: string) => void, currentValue: string) => {
      if (key === '⌫' || key === '<') return setter(currentValue.slice(0, -1));
      if (key === '清除') return setter('');
      if (key === '.' || key === '．') {
        if (currentValue.includes('.')) return;
        return setter(clampDecimal(currentValue + '.', 10));
      }
      if (isNaN(Number(key))) return;
      setter(clampDecimal(currentValue + key, 10));
    };

    if (key === '+') {
      setInputSign(1);
      return;
    }
    if (key === '−' || key === '-') {
      setInputSign(-1);
      return;
    }
    if (key === '±') {
      if (!allowNegative) return;
      setInputSign((s) => (s === 1 ? -1 : 1));
      return;
    }

    if (inputMode === 'int') return setTargetInt(setInputWhole, inputWhole);
    if (inputMode === 'dec') return setTargetDec(setInputWhole, inputWhole);
    if (inputMode === 'frac') {
      const focus: InputFocus = inputFocus === 'whole' ? 'num' : inputFocus;
      if (focus === 'num') setTargetInt(setInputNum, inputNum);
      if (focus === 'den') setTargetInt(setInputDen, inputDen);
      return;
    }
    if (inputFocus === 'whole') setTargetInt(setInputWhole, inputWhole);
    if (inputFocus === 'num') setTargetInt(setInputNum, inputNum);
    if (inputFocus === 'den') setTargetInt(setInputDen, inputDen);
  };

  const submit = () => {
    if (!answer) return;
    const built = buildRationalFromUi({ sign: inputSign, mode: inputMode, whole: inputWhole, num: inputNum, den: inputDen });
    if (!built.ok) return alert(built.error);

    const ok = rationalKey(built.value) === rationalKey(answer);
    setAnswered((n) => n + 1);
    if (ok) {
      setCorrect((n) => n + 1);
      setCombo((c) => c + 1);
      setEnemyHp((hp) => Math.max(0, hp - (2 + skillLevel)));
    } else {
      setCombo(0);
      setPlayerHp((hp) => Math.max(0, hp - Math.max(1, Math.floor(wrongTowerDamage))));
    }

    const next = qIndex + 1;
    if (next >= stageQuestions.length) {
      // stage clear -> simple skill upgrade
      setSkillLevel((lv) => lv + 1);
      setStageIndex((s) => {
        const ns = s + 1;
        fetchStage(ns);
        return ns;
      });
      return;
    }
    setQIndex(next);
  };

  if (loading && stageQuestions.length === 0) {
    return (
      <div className="text-white">
        <div className="text-2xl font-black mb-2">載入關卡中…</div>
        <button onClick={onExit} className="px-4 py-2 rounded-xl bg-[#A1D9AE] text-brand-brown font-black">返回</button>
      </div>
    );
  }

  if (!current || !answer) {
    return (
      <div className="text-white">
        <div className="text-2xl font-black mb-2">題目資料不完整</div>
        {error && <div className="text-red-200 font-bold mb-3">{error}</div>}
        <button onClick={onExit} className="px-4 py-2 rounded-xl bg-[#A1D9AE] text-brand-brown font-black">返回</button>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap text-white">
        <div className="font-black">關卡 {stageIndex + 1}・第 {qIndex + 1}/{stageQuestions.length} 題</div>
        <div className="flex items-center gap-3 flex-wrap">
          {remaining !== null && <div className="px-3 py-1 rounded-full bg-white/10 border border-white/20 font-black">⏳ {remaining}s</div>}
          <div className="px-3 py-1 rounded-full bg-white/10 border border-white/20 font-black">❤️ {playerHp}</div>
          <div className="px-3 py-1 rounded-full bg-white/10 border border-white/20 font-black">🏰 {enemyHp}</div>
          <div className="px-3 py-1 rounded-full bg-white/10 border border-white/20 font-black">🔥 Combo {combo}</div>
          <button
            type="button"
            onClick={() => { if (confirm('確定要退出遊戲嗎？')) onExit(); }}
            className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 font-black"
          >
            離開
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-[320px] rounded-3xl overflow-hidden border-4 border-white/20 bg-black/10">
        <Battlefield playerHp={playerHp} enemyHp={enemyHp} intensity={skillLevel} />
      </div>

      <div className="bg-white/10 border-4 border-white/15 rounded-3xl p-4 text-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="font-black">{current.kind === 'eq' ? '請解方程式：' : '請計算：'}</div>
          <div className="text-sm text-white/80">技能等級：{skillLevel}</div>
        </div>

        <div className="mt-2 text-2xl font-black">
          {current.kind === 'eq' ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <MathExpressionView tokens={current.leftTokens as any} />
              <span className="px-0.5 font-black">=</span>
              <MathExpressionView tokens={current.rightTokens as any} />
            </div>
          ) : (
            <MathExpressionView tokens={current.tokens as any} />
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => resetInput('int')}
              disabled={configuredNumberMode === 'decimal' || (answerNumberType !== 'int' && configuredNumberMode !== null)}
              className={`px-3 py-1 rounded-full border-2 font-black ${inputMode === 'int' ? 'bg-[#B5F8CE] border-[#4FBF7A] text-[#2F2A4A]' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              整數
            </button>
            <button
              type="button"
              onClick={() => resetInput('frac')}
              disabled={configuredNumberMode === 'decimal'}
              className={`px-3 py-1 rounded-full border-2 font-black ${inputMode === 'frac' ? 'bg-[#B5D8F8] border-[#4B87BF] text-[#2F2A4A]' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              分數
            </button>
            <button
              type="button"
              onClick={() => resetInput('mixed')}
              disabled={configuredNumberMode === 'decimal'}
              className={`px-3 py-1 rounded-full border-2 font-black ${inputMode === 'mixed' ? 'bg-[#FDEEAD] border-[#B98B4F] text-[#2F2A4A]' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              帶分數
            </button>
            <button
              type="button"
              onClick={() => resetInput('dec')}
              disabled={configuredNumberMode === 'fraction' || (answerNumberType !== 'dec' && configuredNumberMode !== null)}
              className={`px-3 py-1 rounded-full border-2 font-black ${inputMode === 'dec' ? 'bg-[#FFD4B5] border-[#B97A4F] text-[#2F2A4A]' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              小數
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setInputWhole('');
                setInputNum('');
                setInputDen('');
                setInputSign(1);
              }}
              className="px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black border-2 border-white/20"
            >
              清除
            </button>
            <button
              type="button"
              onClick={submit}
              className="px-6 py-2 rounded-2xl bg-[#FFD4B5] text-[#2F2A4A] font-black text-lg border-2 border-white/20 hover:bg-[#FFF6D6]"
            >
              提交
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setInputSign(1)}
              className={`px-3 py-1 rounded-full border-2 font-black ${inputSign === 1 ? 'bg-white text-[#2F2A4A]' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setInputSign(-1)}
              disabled={!allowNegative}
              className={`px-3 py-1 rounded-full border-2 font-black ${inputSign === -1 ? 'bg-white text-[#2F2A4A]' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              −
            </button>

            {inputMode === 'dec' && (
              <input
                value={inputWhole}
                onChange={(e) => setInputWhole(clampDecimal(e.target.value, 10))}
                className="w-56 px-3 py-2 rounded-2xl bg-white/20 border-2 border-white/20 font-black text-white focus:outline-none"
                placeholder="輸入小數"
                inputMode="decimal"
              />
            )}

            {(inputMode === 'int') && (
              <input
                value={inputWhole}
                onChange={(e) => setInputWhole(clampDigits(e.target.value))}
                className="w-56 px-3 py-2 rounded-2xl bg-white/20 border-2 border-white/20 font-black text-white focus:outline-none"
                placeholder="輸入整數"
                inputMode="numeric"
              />
            )}

            {inputMode === 'frac' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInputFocus('num')}
                  className={`w-32 px-3 py-2 rounded-2xl border-2 font-black ${inputFocus === 'num' ? 'bg-white text-[#2F2A4A]' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
                >
                  {inputNum || '分子'}
                </button>
                <span className="font-black">/</span>
                <button
                  type="button"
                  onClick={() => setInputFocus('den')}
                  className={`w-32 px-3 py-2 rounded-2xl border-2 font-black ${inputFocus === 'den' ? 'bg-white text-[#2F2A4A]' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
                >
                  {inputDen || '分母'}
                </button>
              </div>
            )}

            {inputMode === 'mixed' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInputFocus('whole')}
                  className={`w-24 px-3 py-2 rounded-2xl border-2 font-black ${inputFocus === 'whole' ? 'bg-white text-[#2F2A4A]' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
                >
                  {inputWhole || '整數'}
                </button>
                <span className="font-black">^</span>
                <button
                  type="button"
                  onClick={() => setInputFocus('num')}
                  className={`w-24 px-3 py-2 rounded-2xl border-2 font-black ${inputFocus === 'num' ? 'bg-white text-[#2F2A4A]' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
                >
                  {inputNum || '分子'}
                </button>
                <span className="font-black">/</span>
                <button
                  type="button"
                  onClick={() => setInputFocus('den')}
                  className={`w-24 px-3 py-2 rounded-2xl border-2 font-black ${inputFocus === 'den' ? 'bg-white text-[#2F2A4A]' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
                >
                  {inputDen || '分母'}
                </button>
              </div>
            )}
          </div>

          <div className="text-sm text-white/80 font-black">答對獲得技能/召喚，答錯扣塔血</div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {(inputMode === 'dec'
            ? ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '⌫']
            : ['7', '8', '9', '4', '5', '6', '1', '2', '3', ...(allowNegative ? ['±'] : ['清除']), '0', '⌫']
          ).map((k) => (
            <KeypadButton
              key={k}
              label={k}
              onClick={() => applyKey(k)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
