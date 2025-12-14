import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Subject, SUBJECT_CONFIG } from '../types';

type Difficulty = 'easy' | 'medium' | 'hard';
type TowerType = 'soldier' | 'archer' | 'cannon';
type EnemyKind = 'slime' | 'runner' | 'tank' | 'shooter';

type TowerDefenseQuestionRaw =
  | { type: 'mcq'; prompt: string; options: string[]; correctIndex: number }
  | { type: 'match'; left: string; options: string[]; correctIndex: number; prompt?: string }
  | { question: string; answer: string; wrongOptions?: string[] }; // legacy

type NormalizedQuestion = { kind: 'mcq' | 'match'; stem: string; options: string[]; correctIndex: number };

interface Props {
  questions: TowerDefenseQuestionRaw[];
  subject: Subject;
  difficulty: Difficulty;
  durationSeconds?: number;
  livesLimit?: number | null;
  onExit: () => void;
  onStart?: () => void;
  onComplete: (result: {
    success: boolean;
    score: number;
    correctAnswers: number;
    totalQuestions: number;
    timeSpent: number;
    wavesSurvived: number;
  }) => void;
}

interface GridCell {
  x: number;
  y: number;
  isPath: boolean;
  isBuildable: boolean;
}

interface Enemy {
  id: number;
  kind: EnemyKind;
  pathIndex: number;
  speed: number;
  maxHp: number;
  hp: number;
  size: number;
  color: string;
  attackDamage?: number;
  attackRange?: number;
  attackCooldown?: number;
  lastAttackAt?: number;
}

interface Tower {
  id: number;
  gridX: number;
  gridY: number;
  type: TowerType;
  level: number;
  range: number;
  damage: number;
  fireRate: number;
  lastShotAt: number;
  projectileSpeed: number;
  maxHp: number;
  hp: number;
}

interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  color: string;
  life: number;
  targetId: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  color: string;
  shape: 'circle' | 'spark';
}

const GRID_WIDTH = 9;
const GRID_HEIGHT = 7;
const TILE_W = 76;
const TILE_H = 38;
const TILE_DEPTH = 18;
const DEFAULT_GAME_DURATION_SECONDS = 60;
const DEFAULT_PATH: Array<{ x: number; y: number }> = [
  { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 2, y: 2 }, { x: 2, y: 1 },
  { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 5, y: 3 },
  { x: 6, y: 3 }, { x: 6, y: 4 }, { x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 }
];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomPath(): Array<{ x: number; y: number }> {
  const maxAttempts = 60;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let x = 0;
    let y = randInt(0, GRID_HEIGHT - 1);
    const visited = new Set<string>();
    visited.add(`${x},${y}`);
    const path: Array<{ x: number; y: number }> = [{ x, y }];

    const maxSteps = GRID_WIDTH * GRID_HEIGHT * 3;
    for (let step = 0; step < maxSteps; step++) {
      if (x === GRID_WIDTH - 1) return path;

      const candidates: Array<{ x: number; y: number; w: number }> = [];
      const tryAdd = (nx: number, ny: number, w: number) => {
        if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT) return;
        const key = `${nx},${ny}`;
        if (visited.has(key)) return;
        candidates.push({ x: nx, y: ny, w });
      };

      tryAdd(x + 1, y, 5); // bias to the right
      tryAdd(x, y - 1, 2);
      tryAdd(x, y + 1, 2);

      if (candidates.length === 0) break;

      const total = candidates.reduce((sum, c) => sum + c.w, 0);
      let r = Math.random() * total;
      let chosen = candidates[0];
      for (const c of candidates) {
        r -= c.w;
        if (r <= 0) {
          chosen = c;
          break;
        }
      }

      x = chosen.x;
      y = chosen.y;
      visited.add(`${x},${y}`);
      path.push({ x, y });
    }
  }

  return DEFAULT_PATH;
}

const COLORS = {
  grassTop: '#CFEFCA',
  grassLeft: '#9DD9A8',
  grassRight: '#7DC48D',
  pathTop: '#C8C9CF',
  pathLeft: '#8B8E97',
  pathRight: '#6E717A',
  border: '#5E4C40',
  shadow: 'rgba(0,0,0,0.25)'
};

const PARTICLE_COLORS = ['#F8B5E0', '#B5D8F8', '#B5F8CE', '#F8E2B5', '#D2B5F8', '#A1D9AE'];

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const TowerDefenseGame: React.FC<Props> = ({ questions, subject, difficulty, durationSeconds, livesLimit, onExit, onStart, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastTimeRef = useRef<number>(0);
  const animationRef = useRef<number | null>(null);

  const [pathCells, setPathCells] = useState<Array<{ x: number; y: number }>>(() => generateRandomPath());
  const pathCellsRef = useRef(pathCells);
  useEffect(() => { pathCellsRef.current = pathCells; }, [pathCells]);

  const grid = useMemo<GridCell[]>(() => {
    const pathSet = new Set(pathCells.map(p => `${p.x},${p.y}`));
    const cells: GridCell[] = [];
    for (let yy = 0; yy < GRID_HEIGHT; yy++) {
      for (let xx = 0; xx < GRID_WIDTH; xx++) {
        const isPath = pathSet.has(`${xx},${yy}`);
        cells.push({ x: xx, y: yy, isPath, isBuildable: !isPath });
      }
    }
    return cells;
  }, [pathCells]);

  const pathSet = useMemo(() => new Set(pathCells.map(p => `${p.x},${p.y}`)), [pathCells]);

  const livesEnabled = useMemo(() => livesLimit !== null && livesLimit !== undefined, [livesLimit]);
  const initialLives = useMemo(() => {
    if (!livesEnabled) return 10;
    const n = Number(livesLimit);
    if (!Number.isFinite(n)) return 10;
    return Math.max(1, Math.min(99, Math.floor(n)));
  }, [livesEnabled, livesLimit]);

  const [lives, setLives] = useState(initialLives);
  const [wave, setWave] = useState(1);
  const [score, setScore] = useState(0);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);

  const [questionOpen, setQuestionOpen] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<NormalizedQuestion | null>(null);
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);
  const [currentCorrectIndex, setCurrentCorrectIndex] = useState<number>(0);
  const [answerResult, setAnswerResult] = useState<null | { selectedIndex: number; isCorrect: boolean; correctIndex: number; correctText: string; effectText: string }>(null);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [buildPoints, setBuildPoints] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [combo, setCombo] = useState(0);
  const [battleHint, setBattleHint] = useState('');

  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const durationSecondsValue = useMemo(() => {
    const n = Number(durationSeconds);
    if (!Number.isFinite(n)) return DEFAULT_GAME_DURATION_SECONDS;
    return Math.max(10, Math.min(600, Math.floor(n)));
  }, [durationSeconds]);

  const durationSecondsRef = useRef<number>(durationSecondsValue);
  useEffect(() => { durationSecondsRef.current = durationSecondsValue; }, [durationSecondsValue]);

  const [timeLeft, setTimeLeft] = useState(durationSecondsValue);
  const [endReason, setEndReason] = useState<'time' | 'lives' | null>(null);
  const completedOnceRef = useRef(false);
  const reportedResultRef = useRef(false);

  const startTimeRef = useRef<Date>(new Date());
  const runStartAtMsRef = useRef<number | null>(null);
  const lastTimeLeftRef = useRef<number>(durationSecondsValue);

  useEffect(() => {
    if (isRunningRef.current || gameOverRef.current) return;
    lastTimeLeftRef.current = durationSecondsValue;
    setTimeLeft(durationSecondsValue);
  }, [durationSecondsValue]);
  const simTimeRef = useRef<number>(0);

  const enemiesRef = useRef<Enemy[]>([]);
  const towersRef = useRef<Tower[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const gameOverRef = useRef<boolean>(false);
  const isRunningRef = useRef<boolean>(false);
  const speedRef = useRef<number>(1);

  useEffect(() => { enemiesRef.current = enemies; }, [enemies]);
  useEffect(() => { towersRef.current = towers; }, [towers]);
  useEffect(() => { projectilesRef.current = projectiles; }, [projectiles]);
  useEffect(() => { particlesRef.current = particles; }, [particles]);
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { speedRef.current = speedMultiplier; }, [speedMultiplier]);

  const normalizedQuestions = useMemo<NormalizedQuestion[]>(() => {
    const list: NormalizedQuestion[] = [];
    for (const raw of questions || []) {
      if (!raw || typeof raw !== 'object') continue;

      if ('type' in raw && (raw as any).type === 'mcq') {
        const prompt = String((raw as any).prompt || '').trim();
        const options = Array.isArray((raw as any).options) ? (raw as any).options.map((x: any) => String(x ?? '').trim()) : [];
        const correctIndex = Number((raw as any).correctIndex ?? 0);
        if (!prompt) continue;
        if (options.length !== 4 || options.some((o: string) => !o)) continue;
        if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) continue;
        list.push({ kind: 'mcq', stem: prompt, options, correctIndex });
        continue;
      }

      if ('type' in raw && (raw as any).type === 'match') {
        const left = String((raw as any).left || '').trim();
        const options = Array.isArray((raw as any).options) ? (raw as any).options.map((x: any) => String(x ?? '').trim()) : [];
        const correctIndex = Number((raw as any).correctIndex ?? 0);
        if (!left) continue;
        if (options.length !== 4 || options.some((o: string) => !o)) continue;
        if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) continue;
        list.push({ kind: 'match', stem: left, options, correctIndex });
        continue;
      }

      // legacy: {question, answer, wrongOptions}
      if ('question' in raw && 'answer' in raw) {
        const question = String((raw as any).question || '').trim();
        const answer = String((raw as any).answer || '').trim();
        const wrongOptions = Array.isArray((raw as any).wrongOptions) ? (raw as any).wrongOptions.map((x: any) => String(x ?? '').trim()) : [];
        if (!question || !answer) continue;
        const options = [answer, ...wrongOptions].filter(Boolean).slice(0, 4);
        while (options.length < 4) options.push('（選項缺失）');
        const shuffled = shuffleArray(options);
        const correctIndex = Math.max(0, shuffled.indexOf(answer));
        list.push({ kind: 'mcq', stem: question, options: shuffled, correctIndex });
      }
    }
    return list;
  }, [questions]);
  const hasQuestions = normalizedQuestions.length > 0;

  const towerCatalog = useMemo(() => {
    return [
      { type: 'soldier' as const, label: '劍士', cost: 25, range: 120, damage: 8, fireRate: 0.9, projectileSpeed: 320, maxHp: 36, color: '#60a5fa' },
      { type: 'archer' as const, label: '弓箭手', cost: 35, range: 160, damage: 6, fireRate: 0.55, projectileSpeed: 420, maxHp: 30, color: '#34d399' },
      { type: 'cannon' as const, label: '炮兵', cost: 50, range: 190, damage: 14, fireRate: 1.2, projectileSpeed: 260, maxHp: 44, color: '#f472b6' }
    ];
  }, []);

  function isoToScreen(gridX: number, gridY: number) {
    const canvas = canvasRef.current;
    const width = canvas?.width ? canvas.width / (window.devicePixelRatio || 1) : 900;
    const originX = width / 2;
    const originY = 80;
    return {
      x: originX + (gridX - gridY) * (TILE_W / 2),
      y: originY + (gridX + gridY) * (TILE_H / 2)
    };
  }

  function drawTile(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, isPath: boolean) {
    const top = { x: centerX, y: centerY - TILE_H / 2 };
    const right = { x: centerX + TILE_W / 2, y: centerY };
    const bottom = { x: centerX, y: centerY + TILE_H / 2 };
    const left = { x: centerX - TILE_W / 2, y: centerY };

    const topColor = isPath ? COLORS.pathTop : COLORS.grassTop;
    const leftColor = isPath ? COLORS.pathLeft : COLORS.grassLeft;
    const rightColor = isPath ? COLORS.pathRight : COLORS.grassRight;

    ctx.beginPath();
    ctx.moveTo(bottom.x, bottom.y);
    ctx.lineTo(right.x, right.y);
    ctx.lineTo(right.x, right.y + TILE_DEPTH);
    ctx.lineTo(bottom.x, bottom.y + TILE_DEPTH);
    ctx.closePath();
    ctx.fillStyle = rightColor;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(bottom.x, bottom.y);
    ctx.lineTo(left.x, left.y);
    ctx.lineTo(left.x, left.y + TILE_DEPTH);
    ctx.lineTo(bottom.x, bottom.y + TILE_DEPTH);
    ctx.closePath();
    ctx.fillStyle = leftColor;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(right.x, right.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.lineTo(left.x, left.y);
    ctx.closePath();
    ctx.fillStyle = topColor;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = COLORS.border;
    ctx.stroke();
  }

  function spawnParticles(x: number, y: number, count: number, color?: string) {
    const list: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1.5;
      list.push({
        id: Date.now() + Math.random(),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        size: Math.random() * 4 + 2,
        life: 1,
        color: color || PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
        shape: Math.random() > 0.6 ? 'spark' : 'circle'
      });
    }
    setParticles(prev => [...prev, ...list]);
  }

  function getEnemyPosition(enemy: Enemy) {
    const path = pathCellsRef.current;
    const maxIndex = path.length - 1;
    const pathIndex = enemy.pathIndex;
    const clampedIndex = Math.min(pathIndex, maxIndex);

    if (pathIndex < 0) {
      const startCell = path[0] || DEFAULT_PATH[0];
      const nextCell = path[1] || DEFAULT_PATH[1];
      const start = isoToScreen(startCell.x, startCell.y);
      const next = isoToScreen(nextCell.x, nextCell.y);
      const vx = next.x - start.x;
      const vy = next.y - start.y;
      return { x: start.x + vx * pathIndex, y: start.y + vy * pathIndex };
    }
    const baseIndex = Math.floor(clampedIndex);
    const nextIndex = Math.min(baseIndex + 1, maxIndex);
    const t = clampedIndex - baseIndex;

    const cell0 = path[baseIndex] || DEFAULT_PATH[baseIndex] || DEFAULT_PATH[0];
    const cell1 = path[nextIndex] || DEFAULT_PATH[nextIndex] || DEFAULT_PATH[1];
    const p0 = isoToScreen(cell0.x, cell0.y);
    const p1 = isoToScreen(cell1.x, cell1.y);
    const x = p0.x + (p1.x - p0.x) * t;
    const y = p0.y + (p1.y - p0.y) * t;
    return { x, y };
  }

  function finishGame(reason: 'time' | 'lives') {
    if (gameOverRef.current) return;
    gameOverRef.current = true;
    isRunningRef.current = false;
    completedOnceRef.current = true;
    setEndReason(reason);
    setGameOver(true);
    setIsRunning(false);
  }

	  function startGame() {
	    if (gameOverRef.current || isRunningRef.current) return;
	    gameOverRef.current = false;
	    isRunningRef.current = true;
	    completedOnceRef.current = false;
	    reportedResultRef.current = false;
	    setEndReason(null);
	    setGameOver(false);
	    setIsRunning(true);
	    onStart?.();

	    runStartAtMsRef.current = Date.now();
	    const dur = durationSecondsRef.current;
	    lastTimeLeftRef.current = dur;
	    setTimeLeft(dur);
	    simTimeRef.current = 0;
	    startTimeRef.current = new Date();

	    setLives(initialLives);
	    setWave(1);
	    setScore(0);
	    setBuildPoints(0);
	    setEnergy(0);
	    setCombo(0);
	    setBattleHint('');
	    setAnswerResult(null);
	    setQuestionIndex(0);
	    setCurrentQuestion(null);
	    setCurrentOptions([]);
	    setCurrentCorrectIndex(0);
	    setQuestionOpen(false);
	    setTowers([]);
	    setProjectiles([]);
	    setParticles([]);
	    spawnWave(1, true);

	    // start asking immediately; battle continues in background
	    window.setTimeout(() => {
	      if (!gameOverRef.current && isRunningRef.current) openNextQuestion();
	    }, 500);
	  }

	  const buildRef = useRef<number>(0);
	  const energyRef = useRef<number>(0);
	  const comboRef = useRef<number>(0);
	  useEffect(() => { buildRef.current = buildPoints; }, [buildPoints]);
	  useEffect(() => { energyRef.current = energy; }, [energy]);
	  useEffect(() => { comboRef.current = combo; }, [combo]);

	  const slowUntilRef = useRef<number>(0);
	  const freezeUntilRef = useRef<number>(0);
	  const frenzyUntilRef = useRef<number>(0);

	  const questionTimeoutRef = useRef<number | null>(null);
	  useEffect(() => {
	    return () => {
	      if (questionTimeoutRef.current) window.clearTimeout(questionTimeoutRef.current);
	    };
	  }, []);

	  const placeTowerAt = (gridX: number, gridY: number, type: TowerType) => {
	    if (gameOverRef.current) return false;
	    if (pathSet.has(`${gridX},${gridY}`)) return false;
	    if (towersRef.current.some(t => t.gridX === gridX && t.gridY === gridY)) return false;

	    const spec = towerCatalog.find(t => t.type === type);
	    if (!spec) return false;

	    const newTower: Tower = {
	      id: Date.now() + Math.random(),
	      gridX,
	      gridY,
	      type: spec.type,
	      range: spec.range,
	      damage: spec.damage,
	      fireRate: spec.fireRate,
	      lastShotAt: 0,
	      projectileSpeed: spec.projectileSpeed,
	      maxHp: spec.maxHp,
	      hp: spec.maxHp,
	      level: 1
	    };
	    setTowers(prev => [...prev, newTower]);
	    const pos = isoToScreen(gridX, gridY);
	    spawnParticles(pos.x, pos.y, 22, spec.color);
	    return true;
	  };

	  const upgradeRandomTower = () => {
	    const list = towersRef.current;
	    if (list.length === 0) return false;
	    const pick = list[Math.floor(Math.random() * list.length)];
	    setTowers(prev => prev.map(t => {
	      if (t.id !== pick.id) return t;
	      const nextLevel = (t.level || 1) + 1;
	      return {
	        ...t,
	        level: nextLevel,
	        damage: t.damage * 1.12,
	        range: t.range + 8,
	        fireRate: Math.max(0.28, t.fireRate * 0.94),
	        maxHp: t.maxHp + 6,
	        hp: t.hp + 6
	      };
	    }));
	    const pos = isoToScreen(pick.gridX, pick.gridY);
	    spawnParticles(pos.x, pos.y - 12, 26, '#F8E2B5');
	    return true;
	  };

	  const pickTowerTypeForBattle = (): TowerType => {
	    const list = enemiesRef.current;
	    if (list.length === 0) return 'soldier';
	    const counts = { runner: 0, tank: 0, shooter: 0, slime: 0 };
	    list.forEach(e => { (counts as any)[e.kind] = ((counts as any)[e.kind] || 0) + 1; });
	    const total = Math.max(1, list.length);
	    if (counts.tank / total >= 0.28) return 'cannon';
	    if (counts.runner / total >= 0.35) return 'archer';
	    return 'soldier';
	  };

	  const findBestBuildCell = (type: TowerType) => {
	    const spec = towerCatalog.find(t => t.type === type);
	    if (!spec) return null;
	    const occupied = new Set(towersRef.current.map(t => `${t.gridX},${t.gridY}`));
	    let best: { x: number; y: number; score: number } | null = null;
	    const path = pathCellsRef.current;
	    const pathLen = Math.max(1, path.length);
	    for (const cell of grid) {
	      if (!cell.isBuildable) continue;
	      const key = `${cell.x},${cell.y}`;
	      if (occupied.has(key)) continue;
	      const cPos = isoToScreen(cell.x, cell.y);
	      let score = 0;
	      for (let i = 0; i < path.length; i++) {
	        const p = path[i];
	        const pPos = isoToScreen(p.x, p.y);
	        const d = Math.hypot(pPos.x - cPos.x, pPos.y - cPos.y);
	        if (d <= spec.range) score += 1 + i / pathLen;
	      }
	      score += Math.random() * 0.05;
	      if (!best || score > best.score) best = { x: cell.x, y: cell.y, score };
	    }
	    return best ? { x: best.x, y: best.y } : null;
	  };

	  const autoDeployOnce = () => {
	    const type = pickTowerTypeForBattle();
	    const cell = findBestBuildCell(type);
	    if (cell) {
	      placeTowerAt(cell.x, cell.y, type);
	      setBattleHint(`自動部署：${towerCatalog.find(t => t.type === type)?.label || '塔'}`);
	      return true;
	    }
	    if (upgradeRandomTower()) {
	      setBattleHint('自動升級：防禦塔強化');
	      return true;
	    }
	    return false;
	  };

	  const applySlow = (seconds: number) => {
	    slowUntilRef.current = Math.max(slowUntilRef.current, simTimeRef.current + seconds);
	    setBattleHint(`連對 ${comboRef.current}：全場減速 ${seconds}s`);
	    spawnParticles(180, 120, 20, '#B5D8F8');
	  };

	  const applyFreeze = (seconds: number) => {
	    freezeUntilRef.current = Math.max(freezeUntilRef.current, simTimeRef.current + seconds);
	    setBattleHint(`連對 ${comboRef.current}：全場冰凍 ${seconds}s`);
	    spawnParticles(180, 120, 26, '#C7D2FE');
	  };

	  const applyFrenzy = (seconds: number) => {
	    frenzyUntilRef.current = Math.max(frenzyUntilRef.current, simTimeRef.current + seconds);
	    setBattleHint(`連對 ${comboRef.current}：狂熱 ${seconds}s（射速提升）`);
	    spawnParticles(180, 120, 26, '#FDE68A');
	  };

	  const openQuestionAt = (index: number) => {
	    if (!hasQuestions || gameOverRef.current || !isRunningRef.current) return;
	    if (normalizedQuestions.length === 0) return;
	    const safeIndex = ((index % normalizedQuestions.length) + normalizedQuestions.length) % normalizedQuestions.length;
	    const q = normalizedQuestions[safeIndex];
	    const correctText = q.options[q.correctIndex];
	    const options = shuffleArray(q.options);
	    const correctIndex = options.indexOf(correctText);
	    setQuestionIndex(safeIndex);
	    setCurrentQuestion(q);
	    setCurrentOptions(options);
	    setCurrentCorrectIndex(Math.max(0, correctIndex));
	    setAnswerResult(null);
	    setQuestionOpen(true);
	  };

	  function openNextQuestion() {
	    openQuestionAt(questionIndex);
	  }

	  function answerQuestion(selectedIndex: number) {
	    if (!isRunningRef.current || gameOverRef.current) return;
	    if (!currentQuestion) return;
	    if (answerResult) return;

	    setTotalAnswered(v => v + 1);
	    const isCorrect = selectedIndex === currentCorrectIndex;
	    const correctText = currentOptions[currentCorrectIndex] || '';

	    if (isCorrect) {
	      setCorrectAnswers(v => v + 1);
	      setScore(v => v + 10 + (currentQuestion.kind === 'match' ? 2 : 0));
	      spawnParticles(160, 120, 18, '#F8E2B5');
	    } else {
	      spawnParticles(160, 120, 12, '#F8C5C5');
	    }

	    const energyDelta = isCorrect ? (currentQuestion.kind === 'match' ? 12 : 10) : -5;
	    const prevCombo = comboRef.current;
	    const nextCombo = isCorrect ? prevCombo + 1 : 0;

	    const prevBuild = buildRef.current;
	    const nextBuildRaw = prevBuild + (isCorrect ? 1 : 0);
	    const deployments = Math.floor(nextBuildRaw / 2);
	    const nextBuild = nextBuildRaw % 2;

	    setCombo(nextCombo);
	    setEnergy(v => Math.max(0, v + energyDelta));
	    setBuildPoints(nextBuild);

	    if (deployments > 0) {
	      for (let i = 0; i < deployments; i++) autoDeployOnce();
	    }

	    if (isCorrect && nextCombo === 3) applySlow(2);
	    if (isCorrect && nextCombo === 5) applyFreeze(2);
	    if (isCorrect && nextCombo === 8) applyFrenzy(6);

	    setAnswerResult({
	      selectedIndex,
	      isCorrect,
	      correctIndex: currentCorrectIndex,
	      correctText,
	      effectText: isCorrect ? '✅ 正確！' : `❌ 錯誤（正確：${correctText}）`
	    });

	    questionTimeoutRef.current = window.setTimeout(() => {
	      const next = (questionIndex + 1) % Math.max(1, normalizedQuestions.length);
	      openQuestionAt(next);
	    }, 900);
	  }

  function pickEnemyKind(currentWave: number): EnemyKind {
    const r = Math.random();
    if (currentWave >= 7 && r < 0.22) return 'shooter';
    if (currentWave >= 4 && r < 0.42) return 'tank';
    if (currentWave >= 2 && r < 0.68) return 'runner';
    return 'slime';
  }

  function createEnemy(kind: EnemyKind, currentWave: number, initialPathIndex: number): Enemy {
    const difficultyHp = difficulty === 'easy' ? 1.0 : difficulty === 'medium' ? 1.25 : 1.55;
    const difficultySpeed = difficulty === 'easy' ? 1.0 : difficulty === 'medium' ? 1.08 : 1.16;
    const hpMultiplier = (1 + currentWave * 0.16) * difficultyHp;
    const speedMultiplier = (1 + currentWave * 0.02) * difficultySpeed;

    const base = (() => {
      switch (kind) {
        case 'runner':
          return { hp: 24, speed: 0.95, size: 14, color: '#FDE68A' };
        case 'tank':
          return { hp: 70, speed: 0.48, size: 20, color: '#C7D2FE' };
        case 'shooter':
          return { hp: 40, speed: 0.58, size: 16, color: '#FBCFE8' };
        default:
          return { hp: 42, speed: 0.68, size: 16, color: '#F8C5C5' };
      }
    })();

    const maxHp = base.hp * hpMultiplier;
    const speed = base.speed * speedMultiplier;
    const enemy: Enemy = {
      id: Date.now() + Math.random(),
      kind,
      pathIndex: initialPathIndex,
      speed,
      maxHp,
      hp: maxHp,
      size: base.size + Math.min(10, currentWave * 0.55),
      color: base.color
    };

    if (kind === 'shooter') {
      enemy.attackDamage = 7 + currentWave * 0.4;
      enemy.attackRange = 150;
      enemy.attackCooldown = 1.1;
      enemy.lastAttackAt = -999;
    }

    return enemy;
  }

  function spawnWave(currentWave: number, replace = false) {
    const enemyCount = Math.min(22, 6 + currentWave * 2);
    const list: Enemy[] = [];
    for (let i = 0; i < enemyCount; i++) {
      const kind = pickEnemyKind(currentWave);
      list.push(createEnemy(kind, currentWave, -i * 1.35));
    }
    setEnemies(prev => (replace ? list : [...prev, ...list]));
  }

  function createProjectile(tower: Tower, target: Enemy, now: number, damageFactor = 1): Projectile | null {
    const towerPos = isoToScreen(tower.gridX, tower.gridY);
    const targetPos = getEnemyPosition(target);
    const dx = targetPos.x - towerPos.x;
    const dy = targetPos.y - towerPos.y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return null;
    const vx = (dx / dist) * tower.projectileSpeed;
    const vy = (dy / dist) * tower.projectileSpeed;
    const color = tower.type === 'cannon' ? '#f472b6' : tower.type === 'archer' ? '#34d399' : '#60a5fa';

    tower.lastShotAt = now;
    return {
      id: Date.now() + Math.random(),
      x: towerPos.x,
      y: towerPos.y - 8,
      vx,
      vy,
      damage: tower.damage * damageFactor,
      color,
      life: 2.0,
      targetId: target.id
    };
  }

  function updateGame(frameDeltaSeconds: number, simDeltaSeconds: number, simNow: number) {
    if (gameOverRef.current) return;

    const enemiesSnapshot = enemiesRef.current;
    const towersSnapshot = towersRef.current;
    const projectilesSnapshot = projectilesRef.current;
    const particlesSnapshot = particlesRef.current;

    if (particlesSnapshot.length > 0) {
      setParticles(() => {
        const updatedParticles: Particle[] = [];
        for (const particle of particlesSnapshot) {
          const newLife = particle.life - frameDeltaSeconds * 1.4;
          if (newLife <= 0) continue;
          updatedParticles.push({
            ...particle,
            x: particle.x + particle.vx * frameDeltaSeconds * 60,
            y: particle.y + particle.vy * frameDeltaSeconds * 60,
            vy: particle.vy + 0.03 * frameDeltaSeconds * 60,
            life: newLife
          });
        }
        return updatedParticles;
      });
    }

	    if (simDeltaSeconds <= 0) return;
	
	    const frozen = simNow < freezeUntilRef.current;
	    const slowFactor = simNow < slowUntilRef.current ? 0.72 : 1;
	    const moveFactor = frozen ? 0 : slowFactor;
	    const frenzy = simNow < frenzyUntilRef.current;
	    const frenzyFireRateFactor = frenzy ? 0.78 : 1;
	    const frenzyDamageFactor = frenzy ? 1.18 : 1;

	    const movedEnemies: Enemy[] = [];
	    const pathLen = pathCellsRef.current.length || DEFAULT_PATH.length;
	    for (const enemy of enemiesSnapshot) {
	      const nextIndex = enemy.pathIndex + enemy.speed * moveFactor * simDeltaSeconds;
      if (nextIndex >= pathLen - 0.2) {
        if (livesEnabled) {
          setLives(v => {
            const newLives = v - 1;
            if (newLives <= 0) finishGame('lives');
            return newLives;
          });
        }
        continue;
      }
      movedEnemies.push({ ...enemy, pathIndex: nextIndex });
    }

    const updatedProjectiles: Projectile[] = [];
    for (const projectile of projectilesSnapshot) {
      const newX = projectile.x + projectile.vx * simDeltaSeconds;
      const newY = projectile.y + projectile.vy * simDeltaSeconds;
      const newLife = projectile.life - simDeltaSeconds;
      if (newLife <= 0) continue;
      updatedProjectiles.push({ ...projectile, x: newX, y: newY, life: newLife });
    }

    let finalEnemies: Enemy[] = movedEnemies;
    let remainingProjectiles: Projectile[] = updatedProjectiles;

    if (updatedProjectiles.length > 0 && movedEnemies.length > 0) {
      const enemyMap = new Map(movedEnemies.map(e => [e.id, { ...e }]));
      const updatedEnemies = movedEnemies.map(e => enemyMap.get(e.id)!);
      let anyHit = false;

      const afterCollision: Projectile[] = [];
      for (const projectile of updatedProjectiles) {
        const target = enemyMap.get(projectile.targetId);
        if (!target) {
          afterCollision.push(projectile);
          continue;
        }
        const targetPos = getEnemyPosition(target);
        const dist = Math.hypot(projectile.x - targetPos.x, projectile.y - targetPos.y);
        if (dist < target.size * 0.9) {
          target.hp -= projectile.damage;
          anyHit = true;
          spawnParticles(targetPos.x, targetPos.y - 6, 8, projectile.color);
          continue;
        }
        afterCollision.push(projectile);
      }

      remainingProjectiles = afterCollision;
      if (anyHit) {
        const survivors = updatedEnemies.filter(e => e.hp > 0);
        if (survivors.length !== updatedEnemies.length) {
          setScore(v => v + (updatedEnemies.length - survivors.length) * 4);
        }
        finalEnemies = survivors;
      } else {
        finalEnemies = updatedEnemies;
      }
    }

    const enemiesToUpdate = finalEnemies.map(e => ({ ...e }));
    let towersToUpdate = towersSnapshot.map(t => ({ ...t }));

    // Shooter enemies can attack towers (disabled when frozen)
    if (!frozen && enemiesToUpdate.length > 0 && towersToUpdate.length > 0) {
      for (const enemy of enemiesToUpdate) {
        if (enemy.kind !== 'shooter') continue;
        const cooldown = enemy.attackCooldown ?? 1.1;
        const lastAt = enemy.lastAttackAt ?? -999;
        if (simNow - lastAt < cooldown) continue;
        const range = enemy.attackRange ?? 150;
        const dmg = enemy.attackDamage ?? 8;

        const enemyPos = getEnemyPosition(enemy);
        let bestTower: Tower | null = null;
        let bestDist = Infinity;
        for (const tower of towersToUpdate) {
          const towerPos = isoToScreen(tower.gridX, tower.gridY);
          const d = Math.hypot(towerPos.x - enemyPos.x, towerPos.y - enemyPos.y);
          if (d <= range && d < bestDist) {
            bestDist = d;
            bestTower = tower;
          }
        }
        if (!bestTower) continue;

        enemy.lastAttackAt = simNow;
        bestTower.hp = Math.max(0, bestTower.hp - dmg);
        spawnParticles(enemyPos.x, enemyPos.y - 6, 6, '#FBCFE8');
        if (bestTower.hp <= 0) {
          const boom = isoToScreen(bestTower.gridX, bestTower.gridY);
          spawnParticles(boom.x, boom.y - 10, 20, '#F8C5C5');
        }
      }
      towersToUpdate = towersToUpdate.filter(t => t.hp > 0);
    }

    const newProjectiles: Projectile[] = [];
    if (enemiesToUpdate.length > 0 && towersToUpdate.length > 0) {
      for (const tower of towersToUpdate) {
        const towerPos = isoToScreen(tower.gridX, tower.gridY);
        const inRange = enemiesToUpdate
          .map(enemy => ({ enemy, pos: getEnemyPosition(enemy) }))
          .filter(item => Math.hypot(item.pos.x - towerPos.x, item.pos.y - towerPos.y) <= tower.range)
          .sort((a, b) => a.enemy.pathIndex - b.enemy.pathIndex);

        if (inRange.length > 0 && simNow - tower.lastShotAt >= tower.fireRate * frenzyFireRateFactor) {
          const projectile = createProjectile(tower, inRange[inRange.length - 1].enemy, simNow, frenzyDamageFactor);
          if (projectile) newProjectiles.push(projectile);
        }
      }
    }

    if (remainingProjectiles.length > 0 || newProjectiles.length > 0 || projectilesSnapshot.length > 0) {
      setProjectiles([...remainingProjectiles, ...newProjectiles]);
    }

    setTowers(towersToUpdate);
    if (enemiesSnapshot.length > 0 || enemiesToUpdate.length > 0) {
      setEnemies(enemiesToUpdate);
    }

    if (enemiesToUpdate.length === 0 && enemiesSnapshot.length > 0) {
      setWave(w => {
        const nextWave = w + 1;
        spawnWave(nextWave);
        return nextWave;
      });
    }
  }

  function render() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, width, height);

    const sortedCells = [...grid].sort((a, b) => (a.x + a.y) - (b.x + b.y));
    for (const cell of sortedCells) {
      const center = isoToScreen(cell.x, cell.y);
      drawTile(ctx, center.x, center.y, cell.isPath);

      if (cell.isBuildable) {
        ctx.beginPath();
        ctx.moveTo(center.x, center.y - TILE_H / 2 + 3);
        ctx.lineTo(center.x + TILE_W / 2 - 3, center.y);
        ctx.lineTo(center.x, center.y + TILE_H / 2 - 3);
        ctx.lineTo(center.x - TILE_W / 2 + 3, center.y);
        ctx.closePath();
        ctx.strokeStyle = 'rgba(94,76,64,0.25)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    const enemySprites = [...enemiesRef.current].sort((a, b) => a.pathIndex - b.pathIndex);
    for (const enemy of enemySprites) {
      const pos = getEnemyPosition(enemy);
      const scale = 0.9 + Math.min(0.25, pos.y / height);
      const size = enemy.size * scale;

      ctx.save();
      ctx.translate(pos.x, pos.y - TILE_H / 2);
      ctx.fillStyle = COLORS.shadow;
      ctx.beginPath();
      ctx.ellipse(0, size * 0.8, size * 0.9, size * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = enemy.color;
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#5E4C40';
      ctx.beginPath();
      ctx.arc(-size * 0.35, -size * 0.15, size * 0.18, 0, Math.PI * 2);
      ctx.arc(size * 0.35, -size * 0.15, size * 0.18, 0, Math.PI * 2);
      ctx.fill();

      if (enemy.kind === 'shooter') {
        ctx.fillStyle = COLORS.border;
        ctx.beginPath();
        ctx.moveTo(0, -size * 1.05);
        ctx.lineTo(size * 0.38, -size * 0.55);
        ctx.lineTo(-size * 0.38, -size * 0.55);
        ctx.closePath();
        ctx.fill();
      } else if (enemy.kind === 'tank') {
        ctx.fillStyle = COLORS.border;
        ctx.beginPath();
        ctx.arc(0, size * 0.15, size * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }

      const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
      ctx.fillStyle = '#ffefc2';
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 2;
      ctx.fillRect(-size, -size * 1.4, size * 2, 7);
      ctx.strokeRect(-size, -size * 1.4, size * 2, 7);
      ctx.fillStyle = '#34d399';
      ctx.fillRect(-size, -size * 1.4, size * 2 * hpRatio, 7);

      ctx.restore();
    }

    const sortedTowers = [...towersRef.current].sort((a, b) => (a.gridX + a.gridY) - (b.gridX + b.gridY));
    for (const tower of sortedTowers) {
      const pos = isoToScreen(tower.gridX, tower.gridY);
      const baseY = pos.y - TILE_H / 2 - 4;

      ctx.save();
      ctx.translate(pos.x, baseY);

      ctx.fillStyle = COLORS.shadow;
      ctx.beginPath();
      ctx.ellipse(0, 22, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 4;

      if (tower.type === 'soldier') {
        ctx.fillStyle = '#60a5fa';
        ctx.beginPath();
        ctx.moveTo(0, -26);
        ctx.lineTo(18, 14);
        ctx.lineTo(-18, 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (tower.type === 'archer') {
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(0, -6, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#F8E2B5';
        ctx.beginPath();
        ctx.arc(0, -20, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = '#f472b6';
        ctx.beginPath();
        ctx.rect(-18, -20, 36, 34);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#5E4C40';
        ctx.beginPath();
        ctx.rect(-6, -34, 12, 14);
        ctx.fill();
      }

      const towerHpRatio = Math.max(0, tower.hp / tower.maxHp);
      ctx.fillStyle = '#ffefc2';
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 2;
      ctx.fillRect(-20, -44, 40, 6);
      ctx.strokeRect(-20, -44, 40, 6);
      ctx.fillStyle = '#34d399';
      ctx.fillRect(-20, -44, 40 * towerHpRatio, 6);

      ctx.restore();
    }

    for (const projectile of projectilesRef.current) {
      ctx.save();
      ctx.fillStyle = projectile.color;
      ctx.shadowColor = projectile.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const particle of particlesRef.current) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, particle.life);
      ctx.fillStyle = particle.color;
      if (particle.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(particle.x - particle.size, particle.y - particle.size, particle.size * 2, particle.size * 0.8);
      }
      ctx.restore();
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(container);

    const loop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const frameDeltaSeconds = Math.min(0.05, (timestamp - lastTimeRef.current) / 1000);
      lastTimeRef.current = timestamp;

      const running = isRunningRef.current && !gameOverRef.current;
      const simDeltaSeconds = running ? frameDeltaSeconds * speedRef.current : 0;
      if (running) simTimeRef.current += simDeltaSeconds;

      if (running) {
        const startMs = runStartAtMsRef.current;
        if (startMs != null) {
          const elapsedSeconds = (Date.now() - startMs) / 1000;
          const remaining = Math.max(0, durationSecondsRef.current - Math.floor(elapsedSeconds));
          if (remaining !== lastTimeLeftRef.current) {
            lastTimeLeftRef.current = remaining;
            setTimeLeft(remaining);
          }
          if (remaining <= 0) finishGame('time');
        }
      }

      updateGame(frameDeltaSeconds, simDeltaSeconds, simTimeRef.current);
      render();

      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);

    return () => {
      ro.disconnect();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    };
  }, [hasQuestions]);

  useEffect(() => {
    if (!gameOver || !endReason || reportedResultRef.current) return;
    reportedResultRef.current = true;
    const success = endReason === 'time' && lives > 0;
    const timeSpent = endReason === 'time'
      ? durationSecondsRef.current
      : Math.round((Date.now() - startTimeRef.current.getTime()) / 1000);
    const finalScore = Math.round(score + wave * 12 + correctAnswers * 4);
    onComplete({
      success,
      score: finalScore,
      correctAnswers,
      totalQuestions: totalAnswered,
      timeSpent,
      wavesSurvived: wave
    });
  }, [gameOver, endReason, lives, score, wave, correctAnswers, totalAnswered, onComplete]);

  if (!hasQuestions) {
    return (
      <div className="h-full flex items-center justify-center text-white">
        這個塔防遊戲沒有題目，請老師先建立題庫。
      </div>
    );
  }

	  return (
	    <div className="relative w-full h-full flex flex-col">
	      <div className="flex flex-wrap items-center gap-3 mb-4">
	        <div className="bg-[#111] border-2 border-[#444] rounded-xl px-4 py-2 text-white font-bold">
	          建造點: <span className="text-yellow-300">{buildPoints}/2</span>
	        </div>
	        <div className="bg-[#111] border-2 border-[#444] rounded-xl px-4 py-2 text-white font-bold">
	          能量: <span className="text-emerald-300">{energy}</span>
	        </div>
	        <div className="bg-[#111] border-2 border-[#444] rounded-xl px-4 py-2 text-white font-bold">
	          連對: <span className="text-yellow-200">{combo}</span>
	        </div>
	        {livesEnabled && (
	          <div className="bg-[#111] border-2 border-[#444] rounded-xl px-4 py-2 text-white font-bold">
	            生命: <span className="text-red-300">{lives}</span>
	          </div>
	        )}
	        <div className="bg-[#111] border-2 border-[#444] rounded-xl px-4 py-2 text-white font-bold">
	          波次: {wave}
	        </div>
	        <div className="bg-[#111] border-2 border-[#444] rounded-xl px-4 py-2 text-white font-bold">
	          分數: {score}
	        </div>
	        <div className="bg-[#111] border-2 border-[#444] rounded-xl px-4 py-2 text-white font-bold">
	          剩餘時間: <span className={`${timeLeft <= 10 ? 'text-red-300' : 'text-emerald-300'}`}>{timeLeft}s</span>
	        </div>
	        <div className="ml-auto flex items-center gap-2 bg-[#111] border-2 border-[#444] rounded-xl px-3 py-2 text-white font-bold">
	          <span className="text-2xl">{SUBJECT_CONFIG[subject]?.icon}</span>
	          <span>{subject}</span>
	        </div>
	      </div>

	      {battleHint && (
	        <div className="mb-3 text-sm text-emerald-200 font-bold">
	          {battleHint}
	        </div>
	      )}

	      <div ref={containerRef} className="flex-1 min-h-0 rounded-2xl border-4 border-brand-brown bg-[#101418] overflow-hidden shadow-comic-xl">
	        <canvas
	          ref={canvasRef}
	          className="w-full h-full"
	        />
	      </div>

	      <div className="mt-3 bg-white border-4 border-brand-brown rounded-3xl p-4 shadow-comic-xl">
	        {!isRunning && !gameOver ? (
	          <div className="flex flex-col md:flex-row md:items-center gap-3">
	            <div className="flex-1">
	              <div className="text-lg font-black text-brand-brown">準備階段</div>
	              <div className="text-sm text-gray-600 font-bold">
	                系統會自動部署防禦與技能；按「開始」後請專心答題。
	              </div>
	            </div>
	            <button
	              onClick={startGame}
	              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl border-2 border-brand-brown shadow-comic"
	            >
	              開始
	            </button>
	          </div>
	        ) : gameOver ? (
	          <div className="text-center text-gray-500 font-bold">遊戲已結束</div>
	        ) : !questionOpen || !currentQuestion ? (
	          <div className="text-center text-gray-500 font-bold">準備出題中…</div>
	        ) : (
	          <>
	            <div className="flex items-center gap-2 mb-3">
	              <span className={`px-2 py-0.5 rounded-full text-xs font-black border-2 ${currentQuestion.kind === 'match' ? 'bg-lime-100 border-lime-300 text-lime-900' : 'bg-blue-100 border-blue-300 text-blue-900'}`}>
	                {currentQuestion.kind === 'match' ? '配對' : '四選一'}
	              </span>
	              <span className="text-xs text-gray-500 font-bold">
	                已答：{totalAnswered}／正確：{correctAnswers}
	              </span>
	              <span className="ml-auto text-xs text-gray-400 font-bold">
	                連對：{combo}
	              </span>
	            </div>

	            <h3 className="text-xl md:text-2xl font-black text-brand-brown mb-3">
	              {currentQuestion.kind === 'match' ? `選出與「${currentQuestion.stem}」相符的答案` : currentQuestion.stem}
	            </h3>

	            {answerResult && (
	              <div className={`mb-3 px-4 py-3 rounded-2xl border-2 font-black ${answerResult.isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
	                {answerResult.effectText}
	              </div>
	            )}

	            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
	              {currentOptions.map((option, idx) => {
	                const locked = Boolean(answerResult);
	                const isCorrect = idx === currentCorrectIndex;
	                const isChosen = answerResult?.selectedIndex === idx;
	                const base = 'px-4 py-3 border-4 rounded-2xl font-black shadow-comic';
	                const state = (() => {
	                  if (!locked) return 'bg-[#FEF7EC] hover:bg-[#FDEFCB] border-brand-brown text-brand-brown';
	                  if (isCorrect) return 'bg-emerald-100 border-emerald-500 text-emerald-900';
	                  if (isChosen && !isCorrect) return 'bg-red-100 border-red-500 text-red-900';
	                  return 'bg-gray-100 border-gray-200 text-gray-400';
	                })();
	                return (
	                  <button
	                    key={`${idx}-${option}`}
	                    onClick={() => answerQuestion(idx)}
	                    disabled={locked}
	                    className={`${base} ${state}`}
	                  >
	                    {option}
	                  </button>
	                );
	              })}
	            </div>
	          </>
	        )}
	      </div>

      <div className="mt-3 text-xs text-gray-400 text-center">
        題庫會循環出題；每次選項隨機排列。
      </div>

      <button
        onClick={onExit}
        className="hidden"
        aria-hidden
      />
    </div>
  );
};

export default TowerDefenseGame;
