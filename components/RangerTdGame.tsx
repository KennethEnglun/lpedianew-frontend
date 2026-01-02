import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { MathToken, Rational } from '../services/mathGame';
import { isPowerOfTen, normalizeRational, rationalKey } from '../services/mathGame';
import { authService } from '../services/authService';
import { MathExpressionView } from './MathExpressionView';

type StageQuestion =
  | { kind: 'calc'; numberMode: 'fraction' | 'decimal'; tokens: MathToken[]; answer: Rational }
  | { kind: 'eq'; numberMode: 'fraction' | 'decimal'; equation: string; leftTokens: MathToken[]; rightTokens: MathToken[]; answer: Rational }
  | { kind: 'mcq'; prompt: string; options: string[]; correctIndex: number };

type InputMode = 'int' | 'frac' | 'mixed' | 'dec';
type InputFocus = 'whole' | 'num' | 'den';

type UnitSide = 'player' | 'enemy';
type UnitType = 'knight' | 'archer' | 'slime';

type UnitState = {
  id: string;
  side: UnitSide;
  type: UnitType;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  speed: number;
  range: number;
  atk: number;
  atkCd: number;
  cdLeft: number;
  hitFlash: number;
};

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

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

const nowId = () => `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;

const shuffleInPlace = <T,>(arr: T[]) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const normalizeBankQuestions = (raw: any): Array<{ prompt: string; options: string[]; correctIndex: number }> => {
  const list = Array.isArray(raw) ? raw : [];
  const out: Array<{ prompt: string; options: string[]; correctIndex: number }> = [];
  for (const q of list) {
    if (!q || typeof q !== 'object') continue;
    const type = String((q as any).type || '').trim();
    if (type === 'mcq') {
      const prompt = String((q as any).prompt || '').trim();
      const options = Array.isArray((q as any).options) ? (q as any).options.map((x: any) => String(x ?? '').trim()) : [];
      const correctIndex = Number.isInteger((q as any).correctIndex) ? Number((q as any).correctIndex) : 0;
      if (!prompt) continue;
      if (options.length !== 4 || options.some((o: string) => !o)) continue;
      out.push({ prompt, options, correctIndex: Math.max(0, Math.min(3, correctIndex)) });
      continue;
    }
    if (type === 'match') {
      const prompt = String((q as any).left || (q as any).prompt || '').trim();
      const options = Array.isArray((q as any).options) ? (q as any).options.map((x: any) => String(x ?? '').trim()) : [];
      const correctIndex = Number.isInteger((q as any).correctIndex) ? Number((q as any).correctIndex) : 0;
      if (!prompt) continue;
      if (options.length !== 4 || options.some((o: string) => !o)) continue;
      out.push({ prompt, options, correctIndex: Math.max(0, Math.min(3, correctIndex)) });
      continue;
    }
    // legacy: { question, answer, wrongOptions? }
    if (typeof (q as any).question === 'string' && typeof (q as any).answer === 'string') {
      const prompt = String((q as any).question || '').trim();
      const correct = String((q as any).answer || '').trim();
      const wrong = Array.isArray((q as any).wrongOptions) ? (q as any).wrongOptions.map((x: any) => String(x ?? '').trim()) : [];
      const options = [correct, ...wrong].filter(Boolean).slice(0, 4);
      while (options.length < 4) options.push('');
      if (!prompt) continue;
      if (options.length !== 4 || options.some((o) => !o)) continue;
      out.push({ prompt, options, correctIndex: 0 });
    }
  }
  return out;
};

const shuffleMcq = (q: { prompt: string; options: string[]; correctIndex: number }) => {
  const order = [0, 1, 2, 3];
  shuffleInPlace(order);
  const options = order.map((i) => q.options[i]);
  const correctIndex = order.indexOf(q.correctIndex);
  return { ...q, options, correctIndex: correctIndex >= 0 ? correctIndex : 0 };
};

const unitPreset = (type: UnitType, side: UnitSide, stageIndex: number, skillLevel: number) => {
  const stageMul = 1 + Math.min(2, stageIndex * 0.08);
  const skillMul = 1 + Math.min(2, (skillLevel - 1) * 0.08);
  if (type === 'archer') {
    return {
      maxHp: Math.round(8 * stageMul),
      speed: 2.4,
      range: 3.2,
      atk: Math.round((side === 'player' ? 2.0 * skillMul : 1.8) * stageMul),
      atkCd: 0.9
    };
  }
  if (type === 'slime') {
    return {
      maxHp: Math.round(10 * stageMul),
      speed: 2.1,
      range: 1.1,
      atk: Math.round(2.0 * stageMul),
      atkCd: 0.95
    };
  }
  // knight
  return {
    maxHp: Math.round(14 * stageMul),
    speed: 2.0,
    range: 1.2,
    atk: Math.round((side === 'player' ? 3.0 * skillMul : 2.5) * stageMul),
    atkCd: 1.05
  };
};

const UnitMesh: React.FC<{ u: UnitState }> = ({ u }) => {
  const ref = useRef<any>(null);
  useFrame((_s, dt) => {
    if (!ref.current) return;
    // tiny idle bounce + hit flash squash
    const t = Date.now() / 1000;
    const bounce = 0.03 * Math.sin(t * 6 + (u.id.length % 10));
    const hit = clamp01(u.hitFlash);
    ref.current.position.set(u.x, 0.05 + bounce, u.z);
    ref.current.scale.set(1 + hit * 0.08, 1 - hit * 0.05, 1 + hit * 0.08);
  });

  const isPlayer = u.side === 'player';
  const isSlime = u.type === 'slime';
  const bodyColor = isPlayer ? '#A1D9AE' : '#FFB5B5';
  const accent = isPlayer ? '#2F5E3A' : '#7A1F1F';
  const slimeColor = isPlayer ? '#B5F8CE' : '#F8B5E0';

  const hpPct = u.maxHp > 0 ? clamp01(u.hp / u.maxHp) : 0;
  const hpColor = hpPct > 0.66 ? '#B5F8CE' : hpPct > 0.33 ? '#FDEEAD' : '#FF9BB8';

  return (
    <group ref={ref}>
      {isSlime ? (
        <>
          <mesh castShadow>
            <sphereGeometry args={[0.55, 20, 20]} />
            <meshPhysicalMaterial
              color={slimeColor}
              roughness={0.25}
              metalness={0}
              transmission={0.7}
              thickness={0.6}
              ior={1.25}
              clearcoat={0.3}
            />
          </mesh>
          <mesh position={[0, 0.1, 0]} castShadow>
            <sphereGeometry args={[0.18, 16, 16]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.4} />
          </mesh>
        </>
      ) : (
        <>
          <mesh castShadow>
            <capsuleGeometry args={[0.33, 0.7, 8, 16]} />
            <meshStandardMaterial color={bodyColor} roughness={0.8} metalness={0.05} />
          </mesh>
          <mesh position={[0, 0.55, 0]} castShadow>
            <sphereGeometry args={[0.28, 16, 16]} />
            <meshStandardMaterial color="#FFE6F1" roughness={0.7} metalness={0.02} />
          </mesh>
          {/* simple helmet/hat */}
          <mesh position={[0, 0.62, 0]} castShadow>
            <coneGeometry args={[0.3, 0.35, 10]} />
            <meshStandardMaterial color={accent} roughness={0.4} metalness={0.2} emissive={accent} emissiveIntensity={u.type === 'knight' ? 0.25 : 0.08} />
          </mesh>
          {/* weapon hint */}
          {u.type === 'archer' ? (
            <mesh position={[0.35, 0.15, 0]} rotation={[0, 0, Math.PI / 6]} castShadow>
              <boxGeometry args={[0.06, 0.6, 0.06]} />
              <meshStandardMaterial color="#B98B4F" roughness={0.85} />
            </mesh>
          ) : (
            <mesh position={[0.4, 0.15, 0]} rotation={[0, 0, Math.PI / 5]} castShadow>
              <boxGeometry args={[0.08, 0.5, 0.08]} />
              <meshStandardMaterial color="#777" roughness={0.35} metalness={0.4} />
            </mesh>
          )}
        </>
      )}

      {/* hp bar */}
      <group position={[0, 1.05, 0]}>
        <mesh>
          <planeGeometry args={[0.9, 0.12]} />
          <meshBasicMaterial color="#000000" opacity={0.35} transparent />
        </mesh>
        <mesh position={[-0.45 + 0.45 * hpPct, 0, 0.001]}>
          <planeGeometry args={[0.9 * hpPct, 0.08]} />
          <meshBasicMaterial color={hpColor} />
        </mesh>
      </group>
    </group>
  );
};

const Battlefield: React.FC<{
  playerHp: number;
  enemyHp: number;
  intensity: number;
  units: UnitState[];
}> = ({ playerHp, enemyHp, intensity, units }) => {
  const t = Math.max(0, Math.min(1, intensity));
  const glow = 0.15 + t * 0.6;
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas camera={{ position: [0, 6, 10], fov: 50 }}>
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

        {/* units */}
        {units.map((u) => (
          <UnitMesh key={u.id} u={u} />
        ))}
      </Canvas>
    </div>
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
  const answerMode: 'mcq' | 'input' = String(cfg?.answerMode || 'mcq').trim() === 'input' ? 'input' : 'mcq';
  const allowNegative = answerMode === 'input' ? Boolean(cfg?.constraints?.allowNegative) : false;
  const wrongTowerDamage = Number(cfg?.wrongTowerDamage) || 2;
  const towerHpMax = Number(cfg?.towerHp) || 20;
  const perStageQuestionCount = Number(cfg?.perStageQuestionCount) || 10;
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
  const [units, setUnits] = useState<UnitState[]>([]);
  const unitsRef = useRef<UnitState[]>([]);
  const playerHpRef = useRef(playerHp);
  const enemyHpRef = useRef(enemyHp);
  const stageIndexRef = useRef(stageIndex);
  const skillLevelRef = useRef(skillLevel);
  const enemySpawnAccRef = useRef(0);

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

  const [mcqLocked, setMcqLocked] = useState(false);
  const [mcqFeedback, setMcqFeedback] = useState<null | { ok: boolean; correctIndex: number; pickedIndex: number }>(null);

  const bankQuestions = useMemo(() => normalizeBankQuestions(game?.questions), [game?.questions]);

  const current: StageQuestion | null = stageQuestions[qIndex] || null;
  const isMcqQuestion = current?.kind === 'mcq';
  const answer: Rational | null = (!current || isMcqQuestion || !('answer' in current)) ? null : normalizeRational((current as any).answer);
  const configuredNumberMode: 'fraction' | 'decimal' | null = (!current || isMcqQuestion || !('numberMode' in current)) ? null : (current as any).numberMode || null;

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

  useEffect(() => {
    setMcqLocked(false);
    setMcqFeedback(null);
  }, [stageIndex, qIndex]);

  useEffect(() => { playerHpRef.current = playerHp; }, [playerHp]);
  useEffect(() => { enemyHpRef.current = enemyHp; }, [enemyHp]);
  useEffect(() => { stageIndexRef.current = stageIndex; }, [stageIndex]);
  useEffect(() => { skillLevelRef.current = skillLevel; }, [skillLevel]);

  const setUnitsBoth = (next: UnitState[]) => {
    unitsRef.current = next;
    setUnits(next);
  };

  const spawnUnit = (side: UnitSide, type: UnitType | null = null) => {
    if (completedRef.current) return;
    const stage = stageIndexRef.current;
    const skill = skillLevelRef.current;
    const laneZ = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.35);
    const spawnX = side === 'player' ? -14.2 : 14.2;
    const unitType: UnitType = type || (side === 'enemy'
      ? (Math.random() < 0.85 ? 'slime' : 'knight')
      : (Math.random() < 0.6 ? 'knight' : 'archer'));
    const p = unitPreset(unitType, side, stage, skill);
    const u: UnitState = {
      id: nowId(),
      side,
      type: unitType,
      x: spawnX,
      z: laneZ,
      hp: p.maxHp,
      maxHp: p.maxHp,
      speed: p.speed,
      range: p.range,
      atk: p.atk,
      atkCd: p.atkCd,
      cdLeft: Math.random() * p.atkCd,
      hitFlash: 0
    };
    const next = [...unitsRef.current, u];
    // cap units to avoid runaway
    const cap = 36;
    if (next.length > cap) next.splice(0, next.length - cap);
    setUnitsBoth(next);
  };

  const enemySpawnIntervalSeconds = (stage: number) => Math.max(1.2, 3.2 - stage * 0.12);

  const simulateStep = (dt: number) => {
    if (completedRef.current) return;
    let nextPlayerHp = playerHpRef.current;
    let nextEnemyHp = enemyHpRef.current;
    const list = unitsRef.current.map((u) => ({
      ...u,
      cdLeft: Math.max(0, u.cdLeft - dt),
      hitFlash: Math.max(0, u.hitFlash - dt * 4)
    }));

    const players = list.filter((u) => u.side === 'player');
    const enemies = list.filter((u) => u.side === 'enemy');

    const findTarget = (u: UnitState) => {
      const candidates = u.side === 'player' ? enemies : players;
      if (candidates.length === 0) return null;
      // nearest in front direction
      let best: UnitState | null = null;
      let bestDist = Infinity;
      for (const e of candidates) {
        const dx = e.x - u.x;
        const inFront = u.side === 'player' ? dx >= -0.1 : dx <= 0.1;
        if (!inFront) continue;
        const dist = Math.abs(dx);
        if (dist < bestDist) {
          best = e;
          bestDist = dist;
        }
      }
      return best ? { id: best.id, dist: bestDist } : null;
    };

    const damageUnit = (id: string, amount: number) => {
      const idx = list.findIndex((x) => x.id === id);
      if (idx < 0) return;
      const tgt = list[idx];
      list[idx] = { ...tgt, hp: Math.max(0, tgt.hp - amount), hitFlash: 1 };
    };

    const canAttackTower = (u: UnitState) => {
      if (u.side === 'player') return u.x >= 15.0;
      return u.x <= -15.0;
    };

    // movement + attacks
    for (let i = 0; i < list.length; i++) {
      const u = list[i];
      if (u.hp <= 0) continue;
      const target = findTarget(u);
      const engaged = target && target.dist <= u.range;

      if (engaged) {
        if (u.cdLeft <= 0) {
          damageUnit(target!.id, u.atk);
          list[i] = { ...u, cdLeft: u.atkCd };
        }
        continue;
      }

      if (canAttackTower(u)) {
        if (u.cdLeft <= 0) {
          if (u.side === 'player') nextEnemyHp = Math.max(0, nextEnemyHp - u.atk);
          else nextPlayerHp = Math.max(0, nextPlayerHp - u.atk);
          list[i] = { ...u, cdLeft: u.atkCd };
        }
        continue;
      }

      const dir = u.side === 'player' ? 1 : -1;
      const move = u.speed * dt * dir;
      // simple collision: don't overlap with closest opposing unit
      if (target && target.dist < 0.95) continue;
      list[i] = { ...u, x: u.x + move };
    }

    const filtered = list.filter((u) => u.hp > 0 && u.x > -20 && u.x < 20);

    // enemy auto spawn
    enemySpawnAccRef.current += dt;
    const interval = enemySpawnIntervalSeconds(stageIndexRef.current);
    if (enemySpawnAccRef.current >= interval) {
      enemySpawnAccRef.current = enemySpawnAccRef.current % interval;
      // apply HP changes first
      unitsRef.current = filtered;
      setUnits(filtered);
      if (nextPlayerHp !== playerHpRef.current) {
        playerHpRef.current = nextPlayerHp;
        setPlayerHp(nextPlayerHp);
      }
      if (nextEnemyHp !== enemyHpRef.current) {
        enemyHpRef.current = nextEnemyHp;
        setEnemyHp(nextEnemyHp);
      }
      spawnUnit('enemy', Math.random() < 0.9 ? 'slime' : 'knight');
      return;
    }

    unitsRef.current = filtered;
    setUnits(filtered);
    if (nextPlayerHp !== playerHpRef.current) {
      playerHpRef.current = nextPlayerHp;
      setPlayerHp(nextPlayerHp);
    }
    if (nextEnemyHp !== enemyHpRef.current) {
      enemyHpRef.current = nextEnemyHp;
      setEnemyHp(nextEnemyHp);
    }
  };

  const fetchStage = async (nextStageIndex: number) => {
    try {
      setError('');
      setLoading(true);
      stageIndexRef.current = nextStageIndex;
      if (answerMode === 'mcq') {
        if (bankQuestions.length === 0) {
          setError('題庫為空（請教師先建立四選一題目）');
          setStageQuestions([]);
          setQIndex(0);
          return;
        }
        const total = Math.max(1, Math.min(50, Math.floor(perStageQuestionCount)));
        const start = (nextStageIndex * total) % bankQuestions.length;
        const qs: StageQuestion[] = Array.from({ length: total }, (_, i) => {
          const src = bankQuestions[(start + i) % bankQuestions.length];
          const shuffled = shuffleMcq(src);
          return { kind: 'mcq', prompt: shuffled.prompt, options: shuffled.options, correctIndex: shuffled.correctIndex };
        });
        setStageQuestions(qs);
      } else {
        const resp = await authService.generateRangerMathStage(gameId, { stageIndex: nextStageIndex });
        const qs = Array.isArray(resp?.questions) ? resp.questions : [];
        setStageQuestions(qs);
      }
      setQIndex(0);
      setEnemyHp(30 + nextStageIndex * 5);
      enemyHpRef.current = 30 + nextStageIndex * 5;
      enemySpawnAccRef.current = 0;
      setUnitsBoth([]);
      setMcqLocked(false);
      setMcqFeedback(null);
      // initial units so battle starts immediately
      window.setTimeout(() => {
        spawnUnit('player');
        spawnUnit('enemy', 'slime');
      }, 0);
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
    if (loading) return;
    if (completedRef.current) return;
    const tickMs = 50;
    const id = window.setInterval(() => simulateStep(tickMs / 1000), tickMs);
    return () => window.clearInterval(id);
  }, [loading]);

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
    if (answerMode !== 'input') return;
    const nextMode: InputMode = answerNumberType === 'dec' ? 'dec' : (answerNumberType === 'frac' ? 'frac' : 'int');
    resetInput(nextMode);
  }, [qIndex, answerMode, answerNumberType, loading, answer?.n, answer?.d]);

  const mcqPack = useMemo(() => {
    if (answerMode !== 'mcq') return null;
    if (!current || current.kind !== 'mcq') return null;
    const options = Array.isArray(current.options) ? current.options : [];
    if (options.length !== 4) return null;
    return { choices: options, correctIndex: Math.max(0, Math.min(3, Number(current.correctIndex) || 0)) };
  }, [answerMode, current]);

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

  const applyAnswerEffects = (ok: boolean) => {
    setAnswered((n) => n + 1);
    if (ok) {
      setCorrect((n) => n + 1);
      spawnUnit('player');
      setCombo((c) => {
        const next = c + 1;
        if (next % 3 === 0) spawnUnit('player', 'archer');
        return next;
      });
      return;
    }
    setCombo(0);
    setPlayerHp((hp) => Math.max(0, hp - Math.max(1, Math.floor(wrongTowerDamage))));
  };

  const advanceAfterAnswer = () => {
    const next = qIndex + 1;
    if (next >= stageQuestions.length) {
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

  const submit = () => {
    if (!answer) return;
    if (answerMode !== 'input') return;
    const built = buildRationalFromUi({ sign: inputSign, mode: inputMode, whole: inputWhole, num: inputNum, den: inputDen });
    if ('error' in built) return alert(built.error);
    const ok = rationalKey(built.value) === rationalKey(answer);
    applyAnswerEffects(ok);
    advanceAfterAnswer();
  };

  const pickMcq = (pickedIndex: number) => {
    if (answerMode !== 'mcq') return;
    if (!mcqPack) return;
    if (loading || mcqLocked || completedRef.current) return;
    const ok = pickedIndex === mcqPack.correctIndex;
    setMcqLocked(true);
    setMcqFeedback({ ok, correctIndex: mcqPack.correctIndex, pickedIndex });
    applyAnswerEffects(ok);
    window.setTimeout(() => {
      if (completedRef.current) return;
      setMcqFeedback(null);
      setMcqLocked(false);
      advanceAfterAnswer();
    }, 450);
  };

  if (loading && stageQuestions.length === 0) {
    return (
      <div className="text-white">
        <div className="text-2xl font-black mb-2">載入關卡中…</div>
        <button onClick={onExit} className="px-4 py-2 rounded-xl bg-[#A1D9AE] text-brand-brown font-black">返回</button>
      </div>
    );
  }

  if (!current || (answerMode === 'input' && !answer)) {
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
        <Battlefield playerHp={playerHp} enemyHp={enemyHp} intensity={skillLevel} units={units} />
      </div>

      <div className="bg-white/10 border-4 border-white/15 rounded-3xl p-4 text-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="font-black">
            {current.kind === 'mcq' ? '請回答：' : (current.kind === 'eq' ? '請解方程式：' : '請計算：')}
          </div>
          <div className="text-sm text-white/80">技能等級：{skillLevel}</div>
        </div>

        <div className="mt-2 text-2xl font-black">
          {current.kind === 'mcq' ? (
            <div className="whitespace-pre-wrap leading-snug">{current.prompt}</div>
          ) : current.kind === 'eq' ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <MathExpressionView tokens={current.leftTokens as any} />
              <span className="px-0.5 font-black">=</span>
              <MathExpressionView tokens={current.rightTokens as any} />
            </div>
          ) : (
            <MathExpressionView tokens={current.tokens as any} />
          )}
        </div>

        {answerMode === 'mcq' ? (
          <div className="mt-4">
            {!mcqPack ? (
              <div className="text-white/80 font-black">載入選項中…</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {mcqPack.choices.map((c, idx) => {
                  const isCorrect = mcqFeedback ? idx === mcqFeedback.correctIndex : false;
                  const isWrongPick = mcqFeedback ? (!mcqFeedback.ok && idx === mcqFeedback.pickedIndex) : false;
                  const baseCls = 'w-full min-h-14 rounded-2xl border-2 font-black text-lg shadow-sm transition';
                  const cls = mcqFeedback
                    ? (isCorrect
                      ? `${baseCls} bg-[#B5F8CE]/80 border-[#4FBF7A] text-[#2F2A4A]`
                      : isWrongPick
                        ? `${baseCls} bg-[#FFB5B5]/80 border-[#7A1F1F] text-[#2F2A4A]`
                        : `${baseCls} bg-white/10 border-white/20 text-white/60`)
                    : `${baseCls} bg-white/10 border-white/20 text-white hover:bg-white/20 hover:-translate-y-[1px] active:translate-y-0`;
                  return (
                    <button
                      key={`mcq-${stageIndex}-${qIndex}-${idx}`}
                      type="button"
                      disabled={loading || mcqLocked || completedRef.current}
                      onClick={() => pickMcq(idx)}
                      className={cls}
                    >
                      <span className="inline-flex items-center gap-2">
                        <span className="opacity-80">{String.fromCharCode(65 + idx)}.</span>
                        <span className="text-left whitespace-pre-wrap break-words leading-snug">{String(c)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-3 text-sm text-white/80 font-black">答對獲得技能/召喚，答錯扣塔血</div>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
};
