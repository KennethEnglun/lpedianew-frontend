import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Subject, SUBJECT_CONFIG } from '../types';

type Difficulty = 'easy' | 'medium' | 'hard';
type TowerType = 'soldier' | 'archer' | 'cannon';
type EnemyKind = 'slime' | 'runner' | 'tank' | 'shooter';

interface QuestionItem {
  question: string;
  answer: string;
  wrongOptions?: string[];
}

interface Props {
  questions: QuestionItem[];
  subject: Subject;
  difficulty: Difficulty;
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
const GAME_DURATION_SECONDS = 60;

const PATH_CELLS: Array<{ x: number; y: number }> = [
  { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 2, y: 2 }, { x: 2, y: 1 },
  { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 5, y: 3 },
  { x: 6, y: 3 }, { x: 6, y: 4 }, { x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 }
];

const BUILDABLE_CELLS = new Set(PATH_CELLS.map(p => `${p.x},${p.y}`));

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

export const TowerDefenseGame: React.FC<Props> = ({ questions, subject, difficulty, onExit, onStart, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastTimeRef = useRef<number>(0);
  const animationRef = useRef<number | null>(null);

  const [grid] = useState<GridCell[]>(() => {
    const pathSet = new Set(PATH_CELLS.map(p => `${p.x},${p.y}`));
    const cells: GridCell[] = [];
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const isPath = pathSet.has(`${x},${y}`);
        cells.push({ x, y, isPath, isBuildable: !isPath });
      }
    }
    return cells;
  });

  const [gold, setGold] = useState(difficulty === 'easy' ? 80 : difficulty === 'medium' ? 60 : 45);
  const [lives, setLives] = useState(10);
  const [wave, setWave] = useState(1);
  const [score, setScore] = useState(0);
  const [selectedTowerType, setSelectedTowerType] = useState<TowerType | null>(null);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);

  const [questionOpen, setQuestionOpen] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);
  const [correctOption, setCorrectOption] = useState<string>('');
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_SECONDS);
  const [endReason, setEndReason] = useState<'time' | 'lives' | null>(null);

  const startTimeRef = useRef<Date>(new Date());
  const runStartAtMsRef = useRef<number | null>(null);
  const lastTimeLeftRef = useRef<number>(GAME_DURATION_SECONDS);
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

  const requiredQuestions = questions.filter(q => q.question && q.answer);
  const hasQuestions = requiredQuestions.length > 0;

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
    const maxIndex = PATH_CELLS.length - 1;
    const pathIndex = enemy.pathIndex;
    const clampedIndex = Math.min(pathIndex, maxIndex);

    if (pathIndex < 0) {
      const startCell = PATH_CELLS[0];
      const nextCell = PATH_CELLS[1];
      const start = isoToScreen(startCell.x, startCell.y);
      const next = isoToScreen(nextCell.x, nextCell.y);
      const vx = next.x - start.x;
      const vy = next.y - start.y;
      return { x: start.x + vx * pathIndex, y: start.y + vy * pathIndex };
    }
    const baseIndex = Math.floor(clampedIndex);
    const nextIndex = Math.min(baseIndex + 1, maxIndex);
    const t = clampedIndex - baseIndex;

    const cell0 = PATH_CELLS[baseIndex];
    const cell1 = PATH_CELLS[nextIndex];
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
    setEndReason(reason);
    setGameOver(true);
    setIsRunning(false);
  }

  function startGame() {
    if (gameOverRef.current || isRunningRef.current) return;
    gameOverRef.current = false;
    isRunningRef.current = true;
    setEndReason(null);
    setGameOver(false);
    setIsRunning(true);
    onStart?.();

    runStartAtMsRef.current = Date.now();
    lastTimeLeftRef.current = GAME_DURATION_SECONDS;
    setTimeLeft(GAME_DURATION_SECONDS);
    simTimeRef.current = 0;
    startTimeRef.current = new Date();

    setWave(1);
    setProjectiles([]);
    spawnWave(1, true);
  }

  function openNextQuestion() {
    if (!hasQuestions || questionOpen || gameOver || !isRunningRef.current) return;
    const next = requiredQuestions[questionIndex % requiredQuestions.length];
    const wrongOptions = (next.wrongOptions || []).map(o => o.trim()).filter(Boolean);
    const options = shuffleArray([next.answer, ...wrongOptions]).slice(0, 4);
    setCorrectOption(next.answer);
    setCurrentOptions(options);
    setQuestionOpen(true);
  }

  function answerQuestion(option: string) {
    setTotalAnswered(v => v + 1);
    const isCorrect = option === correctOption;
    if (isCorrect) {
      const reward = difficulty === 'easy' ? 16 : difficulty === 'medium' ? 14 : 12;
      setGold(v => v + reward);
      setCorrectAnswers(v => v + 1);
      setScore(v => v + reward);
      spawnParticles(140, 120, 18, '#F8E2B5');
    } else {
      setGold(v => Math.max(0, v - 3));
      spawnParticles(140, 120, 10, '#F8C5C5');
    }
    setQuestionOpen(false);
    setQuestionIndex(v => (v + 1) % requiredQuestions.length);
  }

  function tryPlaceTower(gridX: number, gridY: number) {
    if (!selectedTowerType || gameOver) return;
    if (BUILDABLE_CELLS.has(`${gridX},${gridY}`)) return;
    if (towers.some(t => t.gridX === gridX && t.gridY === gridY)) return;

    const spec = towerCatalog.find(t => t.type === selectedTowerType);
    if (!spec) return;
    if (gold < spec.cost) return;

    setGold(v => v - spec.cost);
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
      hp: spec.maxHp
    };
    setTowers(prev => [...prev, newTower]);
    const pos = isoToScreen(gridX, gridY);
    spawnParticles(pos.x, pos.y, 20, spec.color);
    setSelectedTowerType(null);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    let bestCell: GridCell | null = null;
    let bestDistance = Infinity;

    for (const cell of grid) {
      const center = isoToScreen(cell.x, cell.y);
      const dx = clickX - center.x;
      const dy = clickY - center.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 46 && dist < bestDistance) {
        bestDistance = dist;
        bestCell = cell;
      }
    }

    if (bestCell && bestCell.isBuildable) {
      tryPlaceTower(bestCell.x, bestCell.y);
    }
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

  function createProjectile(tower: Tower, target: Enemy, now: number): Projectile | null {
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
      damage: tower.damage,
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

    const movedEnemies: Enemy[] = [];
    for (const enemy of enemiesSnapshot) {
      const nextIndex = enemy.pathIndex + enemy.speed * simDeltaSeconds;
      if (nextIndex >= PATH_CELLS.length - 0.2) {
        setLives(v => {
          const newLives = v - 1;
          if (newLives <= 0) finishGame('lives');
          return newLives;
        });
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

    // Shooter enemies can attack towers
    if (enemiesToUpdate.length > 0 && towersToUpdate.length > 0) {
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

        if (inRange.length > 0 && simNow - tower.lastShotAt >= tower.fireRate) {
          const projectile = createProjectile(tower, inRange[inRange.length - 1].enemy, simNow);
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
          const remaining = Math.max(0, GAME_DURATION_SECONDS - Math.floor(elapsedSeconds));
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
    if (!gameOver || !endReason) return;
    const success = endReason === 'time' && lives > 0;
    const timeSpent = endReason === 'time'
      ? GAME_DURATION_SECONDS
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
          金幣: <span className="text-yellow-300">{gold}</span>
        </div>
        <div className="bg-[#111] border-2 border-[#444] rounded-xl px-4 py-2 text-white font-bold">
          生命: <span className="text-red-300">{lives}</span>
        </div>
        <div className="bg-[#111] border-2 border-[#444] rounded-xl px-4 py-2 text-white font-bold">
          波次: {wave}
        </div>
        <div className="bg-[#111] border-2 border-[#444] rounded-xl px-4 py-2 text-white font-bold">
          分數: {score}
        </div>
        <div className="bg-[#111] border-2 border-[#444] rounded-xl px-4 py-2 text-white font-bold">
          剩餘時間: <span className={`${timeLeft <= 10 ? 'text-red-300' : 'text-emerald-300'}`}>{timeLeft}s</span>
        </div>

        <button
          onClick={openNextQuestion}
          disabled={!isRunning || questionOpen || gameOver}
          className="ml-auto px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-brand-brown font-black rounded-xl border-2 border-brand-brown shadow-comic disabled:opacity-50"
        >
          {isRunning ? '答下一題賺金幣' : '按開始後才能答題'}
        </button>
      </div>

      <div className="flex gap-4 mb-4">
        {towerCatalog.map(spec => (
          <button
            key={spec.type}
            onClick={() => setSelectedTowerType(spec.type)}
            disabled={gold < spec.cost || gameOver}
            className={`px-4 py-3 rounded-2xl border-4 font-black transition-all shadow-comic ${
              selectedTowerType === spec.type
                ? 'bg-white border-yellow-400 scale-105'
                : 'bg-[#FDEFCB] border-brand-brown hover:scale-105'
            } disabled:opacity-50`}
          >
            <div className="text-lg">{spec.label}</div>
            <div className="text-sm">💰 {spec.cost}</div>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#111] border-2 border-[#444] rounded-xl px-3 py-2 text-white font-bold">
            <span className="text-xs opacity-80">速度</span>
            <select
              value={speedMultiplier}
              onChange={(e) => setSpeedMultiplier(Number(e.target.value))}
              className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-white font-bold"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
            </select>
          </div>
          <div className="flex items-center gap-2 bg-[#111] border-2 border-[#444] rounded-xl px-3 py-2 text-white font-bold">
            <span className="text-2xl">{SUBJECT_CONFIG[subject]?.icon}</span>
            <span>{subject}</span>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="relative flex-1 rounded-2xl border-4 border-brand-brown bg-[#101418] overflow-hidden shadow-comic-xl">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          onPointerDown={handlePointerDown}
        />
        {!isRunning && !gameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35">
            <div className="bg-white/95 border-4 border-brand-brown rounded-3xl px-6 py-5 shadow-comic-xl text-center max-w-md">
              <div className="text-2xl font-black text-brand-brown mb-2">準備階段</div>
              <div className="text-sm text-gray-700 mb-4">
                先用初始金幣放置士兵，準備好後按「開始」進入戰鬥。
              </div>
              <button
                onClick={startGame}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl border-2 border-brand-brown shadow-comic"
              >
                開始
              </button>
            </div>
          </div>
        )}
        {selectedTowerType && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center pointer-events-none">
            <div className="bg-white/90 border-2 border-brand-brown rounded-full px-4 py-2 text-brand-brown font-black shadow-comic">
              點擊地面放置「{towerCatalog.find(t => t.type === selectedTowerType)?.label}」
            </div>
          </div>
        )}
      </div>

      {questionOpen && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-40 p-4">
          <div className="bg-white border-4 border-brand-brown rounded-3xl w-full max-w-2xl p-6 shadow-comic-xl">
            <h3 className="text-2xl font-black text-brand-brown mb-4">
              {requiredQuestions[questionIndex % requiredQuestions.length].question}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentOptions.map(option => (
                <button
                  key={option}
                  onClick={() => answerQuestion(option)}
                  className="px-4 py-3 bg-[#FEF7EC] hover:bg-[#FDEFCB] border-4 border-brand-brown rounded-2xl font-black text-brand-brown shadow-comic transition-transform hover:scale-105"
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="mt-4 text-center">
              <button
                onClick={() => { setQuestionOpen(false); setQuestionIndex(v => (v + 1) % requiredQuestions.length); }}
                className="text-sm text-gray-500 underline"
              >
                先跳過
              </button>
            </div>
          </div>
        </div>
      )}

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
