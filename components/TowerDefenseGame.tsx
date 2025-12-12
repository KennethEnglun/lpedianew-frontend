import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Subject, SUBJECT_CONFIG } from '../types';

type Difficulty = 'easy' | 'medium' | 'hard';
type TowerType = 'soldier' | 'archer' | 'cannon';

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
  pathIndex: number;
  speed: number;
  maxHp: number;
  hp: number;
  size: number;
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

export const TowerDefenseGame: React.FC<Props> = ({ questions, subject, difficulty, onExit, onComplete }) => {
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
  const startTimeRef = useRef<Date>(new Date());

  const enemiesRef = useRef<Enemy[]>([]);
  const towersRef = useRef<Tower[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const gameOverRef = useRef<boolean>(false);

  useEffect(() => { enemiesRef.current = enemies; }, [enemies]);
  useEffect(() => { towersRef.current = towers; }, [towers]);
  useEffect(() => { projectilesRef.current = projectiles; }, [projectiles]);
  useEffect(() => { particlesRef.current = particles; }, [particles]);
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);

  const requiredQuestions = questions.filter(q => q.question && q.answer);
  const hasQuestions = requiredQuestions.length > 0;

  const towerCatalog = useMemo(() => {
    return [
      { type: 'soldier' as const, label: '劍士', cost: 25, range: 120, damage: 8, fireRate: 0.9, projectileSpeed: 320, color: '#60a5fa' },
      { type: 'archer' as const, label: '弓箭手', cost: 35, range: 160, damage: 6, fireRate: 0.55, projectileSpeed: 420, color: '#34d399' },
      { type: 'cannon' as const, label: '炮兵', cost: 50, range: 190, damage: 14, fireRate: 1.2, projectileSpeed: 260, color: '#f472b6' }
    ];
  }, []);

  const pathScreenPoints = useMemo(() => {
    return PATH_CELLS.map(cell => isoToScreen(cell.x, cell.y));
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
    const clampedIndex = Math.min(enemy.pathIndex, maxIndex);
    const baseIndex = Math.floor(clampedIndex);
    const nextIndex = Math.min(baseIndex + 1, maxIndex);
    const t = clampedIndex - baseIndex;

    const p0 = pathScreenPoints[baseIndex];
    const p1 = pathScreenPoints[nextIndex];
    const x = p0.x + (p1.x - p0.x) * t;
    const y = p0.y + (p1.y - p0.y) * t;
    return { x, y };
  }

  function openNextQuestion() {
    if (!hasQuestions || questionOpen || gameOver) return;
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
      projectileSpeed: spec.projectileSpeed
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

  function spawnWave(currentWave: number) {
    const baseHp = difficulty === 'easy' ? 22 : difficulty === 'medium' ? 28 : 34;
    const hpMultiplier = 1 + currentWave * 0.09;
    const speedBase = difficulty === 'easy' ? 0.55 : difficulty === 'medium' ? 0.65 : 0.75;
    const enemyCount = Math.min(12, 3 + currentWave);
    const list: Enemy[] = [];
    for (let i = 0; i < enemyCount; i++) {
      list.push({
        id: Date.now() + Math.random(),
        pathIndex: -i * 1.6,
        speed: speedBase + currentWave * 0.02,
        maxHp: baseHp * hpMultiplier,
        hp: baseHp * hpMultiplier,
        size: 16 + Math.min(8, currentWave * 0.6)
      });
    }
    setEnemies(prev => [...prev, ...list]);
  }

  function fireTower(tower: Tower, target: Enemy, now: number) {
    const towerPos = isoToScreen(tower.gridX, tower.gridY);
    const targetPos = getEnemyPosition(target);
    const dx = targetPos.x - towerPos.x;
    const dy = targetPos.y - towerPos.y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return;
    const vx = (dx / dist) * tower.projectileSpeed;
    const vy = (dy / dist) * tower.projectileSpeed;
    const color = tower.type === 'cannon' ? '#f472b6' : tower.type === 'archer' ? '#34d399' : '#60a5fa';

    setProjectiles(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        x: towerPos.x,
        y: towerPos.y - 8,
        vx,
        vy,
        damage: tower.damage,
        color,
        life: 2.0,
        targetId: target.id
      }
    ]);

    tower.lastShotAt = now;
  }

  function updateGame(deltaSeconds: number, now: number) {
    if (gameOverRef.current) return;

    const enemiesSnapshot = enemiesRef.current;
    const towersSnapshot = towersRef.current;
    const projectilesSnapshot = projectilesRef.current;
    const particlesSnapshot = particlesRef.current;

    const movedEnemies: Enemy[] = [];
    for (const enemy of enemiesSnapshot) {
      const nextIndex = enemy.pathIndex + enemy.speed * deltaSeconds;
      if (nextIndex >= PATH_CELLS.length - 0.2) {
        setLives(v => {
          const newLives = v - 1;
          if (newLives <= 0) setGameOver(true);
          return newLives;
        });
        continue;
      }
      movedEnemies.push({ ...enemy, pathIndex: nextIndex });
    }

    setProjectiles(() => {
      const updatedProjectiles: Projectile[] = [];
      for (const projectile of projectilesSnapshot) {
        const newX = projectile.x + projectile.vx * deltaSeconds;
        const newY = projectile.y + projectile.vy * deltaSeconds;
        const newLife = projectile.life - deltaSeconds;
        if (newLife <= 0) continue;

        updatedProjectiles.push({ ...projectile, x: newX, y: newY, life: newLife });
      }
      return updatedProjectiles;
    });

    setParticles(() => {
      const updatedParticles: Particle[] = [];
      for (const particle of particlesSnapshot) {
        const newLife = particle.life - deltaSeconds * 1.4;
        if (newLife <= 0) continue;
        updatedParticles.push({
          ...particle,
          x: particle.x + particle.vx * deltaSeconds * 60,
          y: particle.y + particle.vy * deltaSeconds * 60,
          vy: particle.vy + 0.03 * deltaSeconds * 60,
          life: newLife
        });
      }
      return updatedParticles;
    });

    if (movedEnemies.length > 0) {
      const towersToUpdate = towersSnapshot.map(t => ({ ...t }));
      for (const tower of towersToUpdate) {
        const towerPos = isoToScreen(tower.gridX, tower.gridY);
        const inRange = movedEnemies
          .map(enemy => ({ enemy, pos: getEnemyPosition(enemy) }))
          .filter(item => Math.hypot(item.pos.x - towerPos.x, item.pos.y - towerPos.y) <= tower.range)
          .sort((a, b) => a.enemy.pathIndex - b.enemy.pathIndex);

        if (inRange.length > 0 && now - tower.lastShotAt >= tower.fireRate) {
          fireTower(tower, inRange[inRange.length - 1].enemy, now);
        }
      }
      setTowers(towersToUpdate);
    }

    let finalEnemies = movedEnemies;
    if (projectilesSnapshot.length > 0 && movedEnemies.length > 0) {
      const enemyMap = new Map(movedEnemies.map(e => [e.id, { ...e }]));
      const updatedEnemies = movedEnemies.map(e => enemyMap.get(e.id)!);
      let anyHit = false;

      const remainingProjectiles: Projectile[] = [];
      for (const projectile of projectilesSnapshot) {
        const target = enemyMap.get(projectile.targetId);
        if (!target) {
          remainingProjectiles.push(projectile);
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
        remainingProjectiles.push(projectile);
      }

      if (anyHit) {
        const survivors = updatedEnemies.filter(e => e.hp > 0);
        if (survivors.length !== updatedEnemies.length) {
          setScore(v => v + (updatedEnemies.length - survivors.length) * 3);
        }
        finalEnemies = survivors;
      } else {
        finalEnemies = updatedEnemies;
      }
      setProjectiles(remainingProjectiles);
    }

    setEnemies(finalEnemies);

    if (finalEnemies.length === 0 && enemiesSnapshot.length > 0) {
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

      ctx.fillStyle = '#F8C5C5';
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
    if (!hasQuestions) return;
    spawnWave(1);
  }, [hasQuestions]);

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
      const deltaSeconds = Math.min(0.05, (timestamp - lastTimeRef.current) / 1000);
      lastTimeRef.current = timestamp;

      updateGame(deltaSeconds, timestamp / 1000);
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
    if (!gameOver) return;
    const timeSpent = Math.round((Date.now() - startTimeRef.current.getTime()) / 1000);
    const finalScore = Math.round(score + wave * 12 + correctAnswers * 4);
    onComplete({
      success: false,
      score: finalScore,
      correctAnswers,
      totalQuestions: totalAnswered,
      timeSpent,
      wavesSurvived: wave
    });
  }, [gameOver]);

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

        <button
          onClick={openNextQuestion}
          disabled={questionOpen || gameOver}
          className="ml-auto px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-brand-brown font-black rounded-xl border-2 border-brand-brown shadow-comic disabled:opacity-50"
        >
          答下一題賺金幣
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
        <div className="ml-auto flex items-center gap-2 bg-[#111] border-2 border-[#444] rounded-xl px-3 py-2 text-white font-bold">
          <span className="text-2xl">{SUBJECT_CONFIG[subject]?.icon}</span>
          <span>{subject}</span>
        </div>
      </div>

      <div ref={containerRef} className="relative flex-1 rounded-2xl border-4 border-brand-brown bg-[#101418] overflow-hidden shadow-comic-xl">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          onPointerDown={handlePointerDown}
        />
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
