import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Subject, SUBJECT_CONFIG } from '../types';
import GameLeaderboardModal from './GameLeaderboardModal';

type Difficulty = 'easy' | 'medium' | 'hard';
type TowerType = 'soldier' | 'archer' | 'cannon' | 'mage-ice' | 'mage-lightning';
type EnemyKind = 'slime' | 'runner' | 'tank' | 'shooter';

type TowerDefenseQuestionRaw =
  | { type: 'mcq'; prompt: string; options: string[]; correctIndex: number }
  | { type: 'match'; left: string; options: string[]; correctIndex: number; prompt?: string }
  | { question: string; answer: string; wrongOptions?: string[] }; // legacy

type NormalizedQuestion = { kind: 'mcq' | 'match'; stem: string; options: string[]; correctIndex: number };

interface Props {
  gameId: string;
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
  slowUntil?: number;
  slowFactor?: number;
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
  lastX?: number;
  lastY?: number;
  vx: number;
  vy: number;
  damage: number;
  color: string;
  life: number;
  targetId: number;
  effect?: 'ice' | 'lightning';
  chainRadius?: number;
  chainMax?: number;
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

interface Shockwave {
  id: number;
  x: number;
  y: number;
  r: number;
  vr: number;
  life: number;
  color: string;
  thickness: number;
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
  // Classroom / chalkboard theme
  bgTop: '#0B1F1B',
  bgBottom: '#071413',

  buildTop: '#2C8C7A',
  buildLeft: '#236F62',
  buildRight: '#1C5C52',

  pathTop: '#B58E5A',
  pathLeft: '#8E6F46',
  pathRight: '#725639',

  border: '#5E4C40',
  shadow: 'rgba(0,0,0,0.28)'
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

function shuffleArrayWithRand<T>(items: T[], rand01: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand01() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function hash01(a: number, b: number, c = 0) {
  // deterministic 0..1 pseudo random
  const n = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function mixColor(hexA: string, hexB: string, t: number) {
  const a = hexA.replace('#', '');
  const b = hexB.replace('#', '');
  const ar = parseInt(a.slice(0, 2), 16);
  const ag = parseInt(a.slice(2, 4), 16);
  const ab = parseInt(a.slice(4, 6), 16);
  const br = parseInt(b.slice(0, 2), 16);
  const bg = parseInt(b.slice(2, 4), 16);
  const bb = parseInt(b.slice(4, 6), 16);
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return `rgb(${rr},${rg},${rb})`;
}

function drawCuteFace(ctx: CanvasRenderingContext2D, size: number, mood: 'smile' | 'grit' | 'wink') {
  ctx.save();
  ctx.fillStyle = 'rgba(30,20,16,0.9)';
  ctx.beginPath();
  ctx.arc(-size * 0.35, -size * 0.15, size * 0.17, 0, Math.PI * 2);
  ctx.arc(size * 0.35, -size * 0.15, size * 0.17, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(30,20,16,0.85)';
  ctx.lineWidth = Math.max(2, size * 0.08);
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (mood === 'wink') {
    ctx.moveTo(size * 0.22, -size * 0.15);
    ctx.lineTo(size * 0.46, -size * 0.15);
  }
  ctx.stroke();

  ctx.beginPath();
  if (mood === 'grit') {
    ctx.moveTo(-size * 0.25, size * 0.25);
    ctx.lineTo(size * 0.25, size * 0.25);
  } else {
    ctx.arc(0, size * 0.18, size * 0.28, 0, Math.PI);
  }
  ctx.stroke();
  ctx.restore();
}

function drawInkMinionFace(
  ctx: CanvasRenderingContext2D,
  size: number,
  mood: 'smile' | 'grit' | 'wink',
  seed: number
) {
  ctx.save();

  // eye whites (helps on dark ink body)
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(-size * 0.34, -size * 0.16, size * 0.18, 0, Math.PI * 2);
  ctx.arc(size * 0.34, -size * 0.16, size * 0.18, 0, Math.PI * 2);
  ctx.fill();

  // pupils
  ctx.fillStyle = 'rgba(20,12,10,0.95)';
  const pupilJitter = (hash01(seed, 1, 99) - 0.5) * size * 0.05;
  ctx.beginPath();
  ctx.arc(-size * 0.34 + pupilJitter, -size * 0.14, size * 0.08, 0, Math.PI * 2);
  ctx.arc(size * 0.34 + pupilJitter, -size * 0.14, size * 0.08, 0, Math.PI * 2);
  ctx.fill();

  // wink line
  if (mood === 'wink') {
    ctx.strokeStyle = 'rgba(20,12,10,0.95)';
    ctx.lineWidth = Math.max(2, size * 0.085);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(size * 0.18, -size * 0.16);
    ctx.lineTo(size * 0.48, -size * 0.16);
    ctx.stroke();
  }

  // eyebrows (mischievous)
  ctx.strokeStyle = 'rgba(20,12,10,0.8)';
  ctx.lineWidth = Math.max(2, size * 0.07);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-size * 0.5, -size * 0.38);
  ctx.lineTo(-size * 0.2, -size * 0.44);
  ctx.moveTo(size * 0.2, -size * 0.44);
  ctx.lineTo(size * 0.5, -size * 0.38);
  ctx.stroke();

  // mouth
  ctx.strokeStyle = 'rgba(20,12,10,0.85)';
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (mood === 'grit') {
    ctx.moveTo(-size * 0.28, size * 0.2);
    ctx.lineTo(size * 0.28, size * 0.2);
  } else {
    ctx.arc(0, size * 0.17, size * 0.32, 0, Math.PI);
  }
  ctx.stroke();

  // tiny tooth
  if (mood !== 'grit') {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.moveTo(size * 0.06, size * 0.2);
    ctx.lineTo(size * 0.16, size * 0.2);
    ctx.lineTo(size * 0.11, size * 0.28);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawInkMinion(
  ctx: CanvasRenderingContext2D,
  opts: {
    kind: EnemyKind;
    size: number;
    seed: number;
    simNow: number;
  }
) {
  const outline = COLORS.border;
  const baseInk = '#374151'; // slate 700
  const deepInk = '#1F2937'; // slate 800
  const accent = (() => {
    if (opts.kind === 'runner') return '#FDE68A';
    if (opts.kind === 'tank') return '#93C5FD';
    if (opts.kind === 'shooter') return '#FBCFE8';
    return '#9CA3AF';
  })();
  const mood: 'smile' | 'grit' | 'wink' = (() => {
    if (opts.kind === 'tank') return 'grit';
    if (opts.kind === 'runner') return 'wink';
    return 'smile';
  })();

  const wobble = Math.sin(opts.simNow * 0.003 + opts.seed * 0.01) * 0.04;

  // Body
  ctx.save();
  ctx.fillStyle = baseInk;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 3;

  if (opts.kind === 'tank') {
    drawRoundRect(ctx, -opts.size * 1.05, -opts.size * 0.95, opts.size * 2.1, opts.size * 1.95, 14);
  } else if (opts.kind === 'runner') {
    ctx.save();
    ctx.scale(1.08, 0.9 + wobble);
    drawBlob(ctx, opts.size * 0.96, opts.seed + 11);
    ctx.restore();
  } else if (opts.kind === 'shooter') {
    drawBlob(ctx, opts.size * 0.98, opts.seed + 5);
  } else {
    // slime
    drawBlob(ctx, opts.size, opts.seed);
  }

  ctx.fill();
  ctx.stroke();

  // ink shine
  const shine = ctx.createRadialGradient(-opts.size * 0.35, -opts.size * 0.45, opts.size * 0.15, -opts.size * 0.1, -opts.size * 0.2, opts.size * 1.3);
  shine.addColorStop(0, 'rgba(255,255,255,0.30)');
  shine.addColorStop(0.35, 'rgba(255,255,255,0.10)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fill();

  // ink speckles
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = deepInk;
  for (let i = 0; i < 6; i++) {
    const a = hash01(opts.seed, i, 77) * Math.PI * 2;
    const rr = (0.2 + hash01(opts.seed, i, 78) * 0.75) * opts.size * 0.65;
    const x = Math.cos(a) * rr * 0.9;
    const y = Math.sin(a) * rr * 0.75;
    const r = (0.06 + hash01(opts.seed, i, 79) * 0.08) * opts.size;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // slime drips
  if (opts.kind === 'slime') {
    ctx.save();
    ctx.fillStyle = deepInk;
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 3; i++) {
      const x = (-0.55 + i * 0.55) * opts.size;
      const y = opts.size * (0.55 + hash01(opts.seed, i, 91) * 0.15);
      const r = opts.size * (0.12 + hash01(opts.seed, i, 92) * 0.08);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Face (white eyes so it reads on ink)
  drawInkMinionFace(ctx, opts.size, mood, opts.seed);

  // Type accessories
  if (opts.kind === 'runner') {
    // scarf + shoes + speed lines
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-opts.size * 0.35, opts.size * 0.06);
    ctx.lineTo(opts.size * 0.45, opts.size * 0.12);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(-opts.size * 1.15, -opts.size * 0.25 + k * 10);
      ctx.lineTo(-opts.size * 0.62, -opts.size * 0.35 + k * 10);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#5E4C40';
    drawRoundRect(ctx, -opts.size * 0.55, opts.size * 0.55, opts.size * 0.45, opts.size * 0.22, 6);
    ctx.fill();
    drawRoundRect(ctx, opts.size * 0.1, opts.size * 0.55, opts.size * 0.45, opts.size * 0.22, 6);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.55;
    drawRoundRect(ctx, -opts.size * 0.5, opts.size * 0.58, opts.size * 0.35, opts.size * 0.1, 6);
    ctx.fill();
    drawRoundRect(ctx, opts.size * 0.15, opts.size * 0.58, opts.size * 0.35, opts.size * 0.1, 6);
    ctx.fill();
    ctx.restore();
  } else if (opts.kind === 'tank') {
    // shield plate + helmet cap
    ctx.save();
    ctx.fillStyle = accent;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    drawRoundRect(ctx, -opts.size * 0.6, -opts.size * 0.15, opts.size * 1.2, opts.size * 0.92, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = deepInk;
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(-opts.size * 0.3 + i * opts.size * 0.3, opts.size * 0.2, opts.size * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.fillStyle = deepInk;
    ctx.globalAlpha = 0.9;
    drawRoundRect(ctx, -opts.size * 0.55, -opts.size * 1.02, opts.size * 1.1, opts.size * 0.35, 12);
    ctx.fill();
    ctx.restore();
  } else if (opts.kind === 'shooter') {
    // pencil tip hat + tiny satchel
    ctx.save();
    ctx.fillStyle = '#FBBF24';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -opts.size * 1.18);
    ctx.lineTo(opts.size * 0.58, -opts.size * 0.58);
    ctx.lineTo(-opts.size * 0.58, -opts.size * 0.58);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#E5E7EB';
    ctx.globalAlpha = 0.9;
    drawRoundRect(ctx, opts.size * 0.35, opts.size * 0.28, opts.size * 0.48, opts.size * 0.26, 8);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawBlob(ctx: CanvasRenderingContext2D, size: number, seed: number) {
  const bumps = 7;
  ctx.beginPath();
  for (let i = 0; i <= bumps; i++) {
    const t = (i / bumps) * Math.PI * 2;
    const b = 0.88 + hash01(seed, i, 21) * 0.22;
    const r = size * b;
    const x = Math.cos(t) * r;
    const y = Math.sin(t) * r * 0.95;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function drawCuteCat(
  ctx: CanvasRenderingContext2D,
  opts: {
    fur: string;
    furShadow: string;
    outfit?: string;
    hat?: string;
    accent?: string;
    staff?: { color: string; gem: string; side: 'left' | 'right' };
    weapon?: { type: 'sword'; color: string };
    mood?: 'smile' | 'wink' | 'grit';
    levelText?: string;
  }
) {
  const outline = COLORS.border;
  const mood = opts.mood || 'smile';

  // proportions (tower coordinate space)
  // Emphasize "bean-eye cute cat": big head, small body, simple facial features.
  const headR = 20;
  const bodyW = 32;
  const bodyH = 24;
  const headY = -26;
  const bodyY = -4;

  // tail (behind) - thick curled tail
  ctx.save();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-14, 12);
  ctx.quadraticCurveTo(-34, 6, -26, -12);
  ctx.quadraticCurveTo(-18, -26, -34, -30);
  ctx.stroke();
  ctx.strokeStyle = opts.furShadow;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-14, 12);
  ctx.quadraticCurveTo(-33, 6, -26, -12);
  ctx.stroke();
  ctx.restore();

  // body
  ctx.save();
  ctx.fillStyle = opts.furShadow;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 5;
  drawRoundRect(ctx, -bodyW / 2, bodyY, bodyW, bodyH, 14);
  ctx.fill();
  ctx.stroke();

  // belly
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#FFFFFF';
  drawRoundRect(ctx, -10, bodyY + 8, 20, 14, 10);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  // outfit/robe overlay (front)
  if (opts.outfit) {
    ctx.save();
    ctx.fillStyle = opts.outfit;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 4;
    drawRoundRect(ctx, -bodyW / 2, bodyY + 4, bodyW, bodyH - 4, 14);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // paws (with toe beans)
  ctx.save();
  ctx.fillStyle = opts.fur;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 5;
  const paw = (x: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, bodyY + bodyH + 2, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // toe beans
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#F8B5E0';
    ctx.beginPath();
    ctx.arc(x - 2.8, bodyY + bodyH + 1, 1.6, 0, Math.PI * 2);
    ctx.arc(x + 2.8, bodyY + bodyH + 1, 1.6, 0, Math.PI * 2);
    ctx.arc(x, bodyY + bodyH + 4, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  paw(-10);
  paw(10);
  ctx.restore();

  // head
  ctx.save();
  ctx.translate(0, headY);
  ctx.fillStyle = opts.fur;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // ears (bigger + inner pink)
  const ear = (sx: number) => {
    ctx.save();
    ctx.fillStyle = opts.fur;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(sx * 8, -12);
    ctx.lineTo(sx * 20, -26);
    ctx.lineTo(sx * 22, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F8B5E0';
    ctx.beginPath();
    ctx.moveTo(sx * 10, -11);
    ctx.lineTo(sx * 18, -20);
    ctx.lineTo(sx * 19, -6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  ear(-1);
  ear(1);

  // eyes (bean eyes)
  const eye = (x: number, wink = false) => {
    ctx.save();
    ctx.fillStyle = 'rgba(20,16,14,0.92)';
    if (wink) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(20,16,14,0.85)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.moveTo(x - 6, 0);
      ctx.lineTo(x + 6, 0);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(x, 0, 3.6, 4.2, 0, 0, Math.PI * 2);
      ctx.fill();
      // tiny highlight
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(x - 1.2, -1.6, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };
  if (mood === 'wink') {
    eye(-7, false);
    eye(8, true);
  } else {
    eye(-7.5, false);
    eye(7.5, false);
  }

  // blush
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#FCA5A5';
  ctx.beginPath();
  ctx.arc(-13, 9, 4.8, 0, Math.PI * 2);
  ctx.arc(13, 9, 4.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // nose + mouth (cat "w")
  ctx.save();
  ctx.fillStyle = '#F472B6';
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(-3.2, 9.2);
  ctx.lineTo(3.2, 9.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = 'rgba(20,16,14,0.85)';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (mood === 'grit') {
    ctx.moveTo(-7, 12);
    ctx.lineTo(7, 12);
  } else {
    ctx.moveTo(-2, 12);
    ctx.quadraticCurveTo(-7, 14, -10, 11);
    ctx.moveTo(2, 12);
    ctx.quadraticCurveTo(7, 14, 10, 11);
  }
  ctx.stroke();
  ctx.restore();

  // whiskers
  ctx.save();
  ctx.strokeStyle = 'rgba(20,16,14,0.65)';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  for (const side of [-1, 1] as const) {
    const sx = side;
    ctx.beginPath();
    ctx.moveTo(sx * 9, 10);
    ctx.lineTo(sx * 20, 8);
    ctx.moveTo(sx * 9, 12);
    ctx.lineTo(sx * 20, 12);
    ctx.moveTo(sx * 9, 14);
    ctx.lineTo(sx * 20, 16);
    ctx.stroke();
  }
  ctx.restore();

  ctx.restore(); // head translate

  // hat
  if (opts.hat) {
    ctx.save();
    ctx.translate(0, headY);
    ctx.fillStyle = opts.hat;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(18, -10);
    ctx.lineTo(-18, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // brim
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000000';
    drawRoundRect(ctx, -20, -12, 40, 10, 8);
    ctx.fill();
    ctx.restore();
  }

  // staff
  if (opts.staff) {
    const dir = opts.staff.side === 'left' ? -1 : 1;
    ctx.save();
    ctx.strokeStyle = '#2B1E12';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(dir * 22, 20);
    ctx.lineTo(dir * 10, -8);
    ctx.stroke();
    ctx.fillStyle = opts.staff.gem;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(dir * 10, -8, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // weapon
  if (opts.weapon?.type === 'sword') {
    ctx.save();
    ctx.strokeStyle = opts.weapon.color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(18, 8);
    ctx.lineTo(30, -10);
    ctx.stroke();
    ctx.fillStyle = '#2B1E12';
    ctx.beginPath();
    ctx.arc(18, 8, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // level badge
  if (opts.levelText) {
    ctx.save();
    ctx.fillStyle = opts.accent || '#FDE68A';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 12, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1F2937';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(opts.levelText, 0, 12);
    ctx.restore();
  }
}

function drawCuteCatHead(
  ctx: CanvasRenderingContext2D,
  opts: {
    fur: string;
    furShadow: string;
    accent?: string;
    hat?: string;
    staff?: { color: string; gem: string; side: 'left' | 'right' };
    headband?: string;
    goggles?: { frame: string; lens: string };
    icon?: 'arrow' | 'bomb';
    mood?: 'smile' | 'wink' | 'grit';
    levelText?: string;
  }
) {
  const outline = COLORS.border;
  const mood = opts.mood || 'smile';

  // size tuned to be closer to enemy units
  const headR = 18;

  ctx.save();

  // small magic aura (optional)
  if (opts.accent) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = opts.accent;
    ctx.beginPath();
    ctx.ellipse(0, headR * 0.9, headR * 1.25, headR * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // head base
  ctx.fillStyle = opts.fur;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // subtle shadow patch (bottom)
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = opts.furShadow;
  ctx.beginPath();
  ctx.ellipse(0, headR * 0.35, headR * 0.75, headR * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ears
  const ear = (sx: number) => {
    ctx.save();
    ctx.fillStyle = opts.fur;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(sx * 6, -10);
    ctx.lineTo(sx * 18, -24);
    ctx.lineTo(sx * 20, -1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F8B5E0';
    ctx.beginPath();
    ctx.moveTo(sx * 8, -10);
    ctx.lineTo(sx * 16, -18);
    ctx.lineTo(sx * 17, -6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  ear(-1);
  ear(1);

  // headband (archer)
  if (opts.headband) {
    ctx.save();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-headR * 0.95, -headR * 0.2);
    ctx.quadraticCurveTo(0, -headR * 0.7, headR * 0.95, -headR * 0.2);
    ctx.stroke();
    ctx.strokeStyle = opts.headband;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-headR * 0.95, -headR * 0.2);
    ctx.quadraticCurveTo(0, -headR * 0.7, headR * 0.95, -headR * 0.2);
    ctx.stroke();
    ctx.restore();
  }

  // eyes
  const eye = (x: number, wink = false) => {
    ctx.save();
    if (wink) {
      ctx.strokeStyle = 'rgba(20,16,14,0.85)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - 6, -1);
      ctx.lineTo(x + 6, -1);
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(20,16,14,0.92)';
      ctx.beginPath();
      ctx.ellipse(x, -1, 3.4, 4.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(x - 1.1, -2.4, 1.05, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };
  if (mood === 'wink') {
    eye(-7, false);
    eye(8, true);
  } else {
    eye(-7.5, false);
    eye(7.5, false);
  }

  // goggles (bomber)
  if (opts.goggles) {
    ctx.save();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-headR * 1.05, -2);
    ctx.lineTo(headR * 1.05, -2);
    ctx.stroke();

    ctx.strokeStyle = opts.goggles.frame;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-headR * 1.05, -2);
    ctx.lineTo(headR * 1.05, -2);
    ctx.stroke();

    ctx.fillStyle = opts.goggles.lens;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 4;
    // left lens
    ctx.beginPath();
    ctx.ellipse(-7.8, -2.5, 8.2, 6.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // right lens
    ctx.beginPath();
    ctx.ellipse(7.8, -2.5, 8.2, 6.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // lens shine
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-10, -5.5, 2.2, 0, Math.PI * 2);
    ctx.arc(6.5, -5.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // blush
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#FCA5A5';
  ctx.beginPath();
  ctx.arc(-12, 8, 4.4, 0, Math.PI * 2);
  ctx.arc(12, 8, 4.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // nose + mouth (cat "w")
  ctx.save();
  ctx.fillStyle = '#F472B6';
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(0, 5.5);
  ctx.lineTo(-3, 8.5);
  ctx.lineTo(3, 8.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = 'rgba(20,16,14,0.85)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (mood === 'grit') {
    ctx.moveTo(-7, 11);
    ctx.lineTo(7, 11);
  } else {
    ctx.moveTo(-2, 11);
    ctx.quadraticCurveTo(-7, 13, -10, 10.5);
    ctx.moveTo(2, 11);
    ctx.quadraticCurveTo(7, 13, 10, 10.5);
  }
  ctx.stroke();
  ctx.restore();

  // whiskers
  ctx.save();
  ctx.strokeStyle = 'rgba(20,16,14,0.6)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const side of [-1, 1] as const) {
    const sx = side;
    ctx.beginPath();
    ctx.moveTo(sx * 8.5, 9);
    ctx.lineTo(sx * 19, 7);
    ctx.moveTo(sx * 8.5, 11);
    ctx.lineTo(sx * 19, 11);
    ctx.moveTo(sx * 8.5, 13);
    ctx.lineTo(sx * 19, 15);
    ctx.stroke();
  }
  ctx.restore();

  // hat (mage)
  if (opts.hat) {
    ctx.save();
    ctx.fillStyle = opts.hat;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, -headR - 16);
    ctx.lineTo(16, -headR + 2);
    ctx.lineTo(-16, -headR + 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // brim
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000000';
    drawRoundRect(ctx, -18, -headR + 4, 36, 9, 8);
    ctx.fill();
    ctx.restore();
  }

  // staff (mage) - behind head
  if (opts.staff) {
    const dir = opts.staff.side === 'left' ? -1 : 1;
    ctx.save();
    ctx.strokeStyle = opts.staff.color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(dir * 22, 18);
    ctx.lineTo(dir * 10, -10);
    ctx.stroke();
    ctx.fillStyle = opts.staff.gem;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(dir * 10, -10, 7.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // icon mark (role identifier)
  if (opts.icon) {
    ctx.save();
    ctx.translate(0, -headR - 6);
    ctx.fillStyle = opts.accent || '#FDE68A';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 9.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#1F2937';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#1F2937';
    if (opts.icon === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(-4, 2);
      ctx.lineTo(4, -2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(2, -3);
      ctx.lineTo(5, -2);
      ctx.lineTo(4, 1);
      ctx.closePath();
      ctx.fill();
    } else {
      // bomb
      ctx.beginPath();
      ctx.arc(0, 1.5, 4.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1F2937';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(2, -2);
      ctx.quadraticCurveTo(6, -6, 8, -8);
      ctx.stroke();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(8, -8);
      ctx.lineTo(10, -10);
      ctx.moveTo(8, -10);
      ctx.lineTo(10, -8);
      ctx.stroke();
    }
    ctx.restore();
  }

  // level badge
  if (opts.levelText) {
    ctx.save();
    ctx.fillStyle = opts.accent || '#FDE68A';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 16, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1F2937';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(opts.levelText, 0, 16);
    ctx.restore();
  }

  ctx.restore();
}

export const TowerDefenseGame: React.FC<Props> = ({ gameId, questions, subject, difficulty, durationSeconds, livesLimit, onExit, onStart, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastTimeRef = useRef<number>(0);
  const animationRef = useRef<number | null>(null);

  // Per-run RNG so every game session has a different deployment/skill "director" plan.
  const runRngStateRef = useRef<number>(0);
  const rand01 = () => {
    // xorshift32
    let x = runRngStateRef.current | 0;
    if (x === 0) x = (Date.now() | 0) ^ ((Math.random() * 0x7fffffff) | 0);
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    runRngStateRef.current = x | 0;
    return ((x >>> 0) / 4294967296);
  };
  const reseedRunRng = () => {
    try {
      const a = new Uint32Array(1);
      window.crypto.getRandomValues(a);
      runRngStateRef.current = (a[0] || 1) | 0;
    } catch {
      runRngStateRef.current = ((Date.now() ^ ((Math.random() * 0x7fffffff) | 0)) || 1) | 0;
    }
  };

  const comboSkillPlanRef = useRef<Record<number, 'slow' | 'freeze' | 'frenzy'>>({});

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
  const [shockwaves, setShockwaves] = useState<Shockwave[]>([]);

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
  const shockwavesRef = useRef<Shockwave[]>([]);
  const gameOverRef = useRef<boolean>(false);
  const isRunningRef = useRef<boolean>(false);
  const speedRef = useRef<number>(1);

  useEffect(() => { enemiesRef.current = enemies; }, [enemies]);
  useEffect(() => { towersRef.current = towers; }, [towers]);
  useEffect(() => { projectilesRef.current = projectiles; }, [projectiles]);
  useEffect(() => { particlesRef.current = particles; }, [particles]);
  useEffect(() => { shockwavesRef.current = shockwaves; }, [shockwaves]);
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
      { type: 'soldier' as const, label: '貓守衛', cost: 25, range: 125, damage: 8.2, fireRate: 0.85, projectileSpeed: 350, maxHp: 38, color: '#F59E0B' },
      { type: 'mage-ice' as const, label: '冰法師貓', cost: 40, range: 185, damage: 5.6, fireRate: 0.65, projectileSpeed: 420, maxHp: 28, color: '#93C5FD' },
      { type: 'mage-lightning' as const, label: '雷法師貓', cost: 55, range: 200, damage: 8.8, fireRate: 0.95, projectileSpeed: 520, maxHp: 26, color: '#A78BFA' },
      { type: 'archer' as const, label: '弓箭貓', cost: 35, range: 170, damage: 6.2, fireRate: 0.55, projectileSpeed: 440, maxHp: 30, color: '#34D399' },
      { type: 'cannon' as const, label: '爆破貓', cost: 50, range: 195, damage: 14.5, fireRate: 1.2, projectileSpeed: 270, maxHp: 44, color: '#F472B6' }
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

  function drawTile(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, isPath: boolean, seed: number) {
    const top = { x: centerX, y: centerY - TILE_H / 2 };
    const right = { x: centerX + TILE_W / 2, y: centerY };
    const bottom = { x: centerX, y: centerY + TILE_H / 2 };
    const left = { x: centerX - TILE_W / 2, y: centerY };

    const topColor = isPath ? COLORS.pathTop : COLORS.buildTop;
    const leftColor = isPath ? COLORS.pathLeft : COLORS.buildLeft;
    const rightColor = isPath ? COLORS.pathRight : COLORS.buildRight;

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

    // subtle texture + highlight
    const grain = hash01(seed, 1, 9);
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = isPath ? mixColor(COLORS.pathTop, '#FFFFFF', 0.55) : mixColor(COLORS.buildTop, '#FFFFFF', 0.5);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(top.x + (grain - 0.5) * 10, top.y + 6);
    ctx.lineTo(right.x - 8, right.y - 2);
    ctx.stroke();
    ctx.restore();

    // dotted chalk specks (cheap)
    ctx.save();
    ctx.globalAlpha = isPath ? 0.08 : 0.06;
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 3; i++) {
      const rx = (hash01(seed, i, 3) - 0.5) * (TILE_W * 0.55);
      const ry = (hash01(seed, i, 7) - 0.5) * (TILE_H * 0.45);
      ctx.beginPath();
      ctx.arc(centerX + rx, centerY + ry - 2, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // path markings
    if (isPath) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#2B1E12';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo((left.x + top.x) / 2, (left.y + top.y) / 2);
      ctx.lineTo((right.x + bottom.x) / 2, (right.y + bottom.y) / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
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
	    reseedRunRng();
	    // Randomize combo-skill order per run (3/5/8 combo thresholds stay, but skill order changes).
	    const combos = [3, 5, 8];
	    const skills = shuffleArrayWithRand(['slow', 'freeze', 'frenzy'] as const, rand01);
	    comboSkillPlanRef.current = { [combos[0]]: skills[0], [combos[1]]: skills[1], [combos[2]]: skills[2] };

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
	    setEffectUi({ slow: 0, freeze: 0, frenzy: 0 });
	    setQuestionIndex(0);
	    setCurrentQuestion(null);
	    setCurrentOptions([]);
	    setCurrentCorrectIndex(0);
	    setQuestionOpen(false);
	    setTowers([]);
	    setProjectiles([]);
	    setParticles([]);
	    setShockwaves([]);
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
	  const slowUiWindowRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
	  const freezeUiWindowRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
	  const frenzyUiWindowRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  const [effectUi, setEffectUi] = useState<{ slow: number; freeze: number; frenzy: number }>({ slow: 0, freeze: 0, frenzy: 0 });
  const lastEffectUiUpdateRef = useRef<number>(0);

  const shakeRef = useRef<{ until: number; amp: number }>({ until: 0, amp: 0 });

  const questionTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (questionTimeoutRef.current) window.clearTimeout(questionTimeoutRef.current);
    };
  }, []);

  const startShake = (amp: number, durationSeconds: number) => {
    const until = simTimeRef.current + Math.max(0, durationSeconds);
    shakeRef.current = { until, amp: Math.max(shakeRef.current.amp, amp) };
  };

  const spawnShockwave = (x: number, y: number, color: string, initialR = 6, vr = 180, life = 0.35, thickness = 5) => {
    const wave: Shockwave = {
      id: Date.now() + Math.random(),
      x,
      y,
      r: initialR,
      vr,
      life,
      color,
      thickness
    };
    setShockwaves((prev) => {
      const next = [...prev, wave];
      return next.length > 18 ? next.slice(next.length - 18) : next;
    });
  };

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
	    const pick = list[Math.floor(rand01() * list.length)];
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
	    if (list.length === 0) return rand01() < 0.65 ? 'soldier' : 'archer';

	    const counts = { runner: 0, tank: 0, shooter: 0, slime: 0 };
	    list.forEach(e => { (counts as any)[e.kind] = ((counts as any)[e.kind] || 0) + 1; });
	    const total = Math.max(1, list.length);

	    // Weighted randomness (still "smart", but not always the same).
	    const weights: Record<TowerType, number> = {
	      soldier: 1.0,
	      archer: 1.0,
	      cannon: 1.0,
	      'mage-ice': 1.0,
	      'mage-lightning': 1.0
	    };

	    if (list.length >= 12) weights['mage-lightning'] += 2.2;
	    if (list.length >= 9) weights.archer += 0.8;
	    if (counts.runner / total >= 0.28) weights['mage-ice'] += 2.0;
	    if (counts.tank / total >= 0.22) weights.cannon += 2.0;
	    if (counts.shooter / total >= 0.18) weights.archer += 0.7;

	    // Prefer variety: dampen types already heavily used or repeated recently.
	    const towerCounts = towersRef.current.reduce<Record<string, number>>((acc, t) => {
	      acc[t.type] = (acc[t.type] || 0) + 1;
	      return acc;
	    }, {});
	    const recent = recentTowerTypesRef.current;
	    for (const type of Object.keys(weights) as TowerType[]) {
	      const c = towerCounts[type] || 0;
	      weights[type] *= 1 / (1 + c * 0.4);
	      if (recent.length > 0 && recent[recent.length - 1] === type) weights[type] *= 0.45;
	      else if (recent.includes(type)) weights[type] *= 0.72;
	      // tiny noise to break ties
	      weights[type] *= 0.98 + rand01() * 0.08;
	    }

	    let sum = 0;
	    for (const v of Object.values(weights)) sum += v;
	    if (sum <= 0) return 'soldier';
	    let r = rand01() * sum;
	    for (const [k, v] of Object.entries(weights) as Array<[TowerType, number]>) {
	      r -= v;
	      if (r <= 0) return k;
	    }
	    return 'soldier';
	  };

	  const recentTowerTypesRef = useRef<TowerType[]>([]);

	  const findBestBuildCell = (type: TowerType) => {
	    const spec = towerCatalog.find(t => t.type === type);
	    if (!spec) return null;
	    const occupied = new Set(towersRef.current.map(t => `${t.gridX},${t.gridY}`));
	    const scored: Array<{ x: number; y: number; score: number }> = [];
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
	      score += rand01() * 0.12; // stronger randomness to avoid identical placements
	      scored.push({ x: cell.x, y: cell.y, score });
	    }
	    if (scored.length === 0) return null;
	    scored.sort((a, b) => b.score - a.score);
	    const topK = Math.min(4, scored.length);
	    const top = scored.slice(0, topK);
	    // pick one of top cells with weighted randomness by score
	    const minScore = top[topK - 1].score;
	    const w = top.map((c) => Math.pow(Math.max(0.001, c.score - minScore + 0.15), 1.35));
	    const wSum = w.reduce((a, b) => a + b, 0);
	    let r = rand01() * wSum;
	    for (let i = 0; i < top.length; i++) {
	      r -= w[i];
	      if (r <= 0) return { x: top[i].x, y: top[i].y };
	    }
	    return { x: top[0].x, y: top[0].y };
	  };

	  const autoDeployOnce = () => {
	    const type = pickTowerTypeForBattle();
	    recentTowerTypesRef.current = [...recentTowerTypesRef.current.slice(-2), type];
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
	    const now = simTimeRef.current;
	    slowUntilRef.current = Math.max(slowUntilRef.current, now + seconds);
	    slowUiWindowRef.current = { start: now, end: slowUntilRef.current };
	    setBattleHint(`連對 ${comboRef.current}：全場減速 ${seconds}s`);
	    const c = isoToScreen(4, 3);
	    spawnParticles(c.x, c.y - 40, 20, '#B5D8F8');
	    spawnShockwave(c.x, c.y - 40, '#B5D8F8', 12, 180, 0.28, 5);
	  };

	  const applyFreeze = (seconds: number) => {
	    const now = simTimeRef.current;
	    freezeUntilRef.current = Math.max(freezeUntilRef.current, now + seconds);
	    freezeUiWindowRef.current = { start: now, end: freezeUntilRef.current };
	    setBattleHint(`連對 ${comboRef.current}：全場冰凍 ${seconds}s`);
	    const c = isoToScreen(4, 3);
	    spawnParticles(c.x, c.y - 40, 26, '#C7D2FE');
	    spawnShockwave(c.x, c.y - 40, '#C7D2FE', 14, 220, 0.3, 6);
	    startShake(3, 0.18);
	  };

	  const applyFrenzy = (seconds: number) => {
	    const now = simTimeRef.current;
	    frenzyUntilRef.current = Math.max(frenzyUntilRef.current, now + seconds);
	    frenzyUiWindowRef.current = { start: now, end: frenzyUntilRef.current };
	    setBattleHint(`連對 ${comboRef.current}：狂熱 ${seconds}s（射速提升）`);
	    const c = isoToScreen(4, 3);
	    spawnParticles(c.x, c.y - 40, 26, '#FDE68A');
	    spawnShockwave(c.x, c.y - 40, '#FDE68A', 10, 240, 0.26, 5);
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
	      startShake(1.4, 0.08);
	    } else {
	      setScore(v => Math.max(0, v - 50));
	      spawnParticles(160, 120, 12, '#F8C5C5');
	      startShake(2.2, 0.12);
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

	    if (isCorrect) {
	      const planned = comboSkillPlanRef.current[nextCombo];
	      if (planned === 'slow') applySlow(2);
	      if (planned === 'freeze') applyFreeze(2);
	      if (planned === 'frenzy') applyFrenzy(6);
	    }

	    setAnswerResult({
	      selectedIndex,
	      isCorrect,
	      correctIndex: currentCorrectIndex,
	      correctText,
	      effectText: isCorrect ? '✅ 正確！' : `❌ 錯誤 -50分（正確：${correctText}）`
	    });

	    questionTimeoutRef.current = window.setTimeout(() => {
	      const next = (questionIndex + 1) % Math.max(1, normalizedQuestions.length);
	      openQuestionAt(next);
	    }, 900);
	  }

  function pickEnemyKind(currentWave: number): EnemyKind {
    const r = rand01();
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
    const meta = (() => {
      switch (tower.type) {
        case 'mage-ice':
          return { color: '#93C5FD', effect: 'ice' as const };
        case 'mage-lightning':
          return { color: '#A78BFA', effect: 'lightning' as const, chainRadius: 86, chainMax: 3 };
        case 'cannon':
          return { color: '#F472B6' };
        case 'archer':
          return { color: '#34D399' };
        default:
          return { color: '#F59E0B' };
      }
    })();

    tower.lastShotAt = now;
    return {
      id: Date.now() + Math.random(),
      x: towerPos.x,
      y: towerPos.y - 8,
      vx,
      vy,
      damage: tower.damage * damageFactor,
      color: meta.color,
      life: 2.0,
      targetId: target.id,
      effect: meta.effect,
      chainRadius: meta.chainRadius,
      chainMax: meta.chainMax
    };
  }

  function updateGame(frameDeltaSeconds: number, simDeltaSeconds: number, simNow: number) {
    if (gameOverRef.current) return;

    const enemiesSnapshot = enemiesRef.current;
    const towersSnapshot = towersRef.current;
    const projectilesSnapshot = projectilesRef.current;
    const particlesSnapshot = particlesRef.current;
    const shockwavesSnapshot = shockwavesRef.current;

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

    if (shockwavesSnapshot.length > 0) {
      setShockwaves(() => {
        const updated: Shockwave[] = [];
        for (const wave of shockwavesSnapshot) {
          const newLife = wave.life - frameDeltaSeconds * 1.4;
          if (newLife <= 0) continue;
          updated.push({ ...wave, r: wave.r + wave.vr * frameDeltaSeconds, life: newLife });
        }
        return updated;
      });
    }

		    if (simDeltaSeconds <= 0) return;
		
		    const frozen = simNow < freezeUntilRef.current;
		    const slowFactor = simNow < slowUntilRef.current ? 0.72 : 1;
		    const moveFactor = frozen ? 0 : slowFactor;
		    const frenzy = simNow < frenzyUntilRef.current;
		    const frenzyFireRateFactor = frenzy ? 0.78 : 1;
		    const frenzyDamageFactor = frenzy ? 1.18 : 1;

		    if (simNow - lastEffectUiUpdateRef.current >= 0.2) {
		      lastEffectUiUpdateRef.current = simNow;
		      const slowRem = Math.max(0, slowUntilRef.current - simNow);
		      const freezeRem = Math.max(0, freezeUntilRef.current - simNow);
		      const frenzyRem = Math.max(0, frenzyUntilRef.current - simNow);
		      setEffectUi({ slow: slowRem, freeze: freezeRem, frenzy: frenzyRem });
		    }

	    const movedEnemies: Enemy[] = [];
	    const pathLen = pathCellsRef.current.length || DEFAULT_PATH.length;
    for (const enemy of enemiesSnapshot) {
	      const personalSlow = enemy.slowUntil && simNow < enemy.slowUntil ? (enemy.slowFactor ?? 1) : 1;
	      const nextIndex = enemy.pathIndex + enemy.speed * personalSlow * moveFactor * simDeltaSeconds;
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
      updatedProjectiles.push({ ...projectile, lastX: projectile.x, lastY: projectile.y, x: newX, y: newY, life: newLife });
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
          spawnShockwave(targetPos.x, targetPos.y - 6, projectile.color, 6, 220, 0.22, 4);

          if (projectile.effect === 'ice') {
            target.slowUntil = Math.max(target.slowUntil || 0, simNow + 1.6);
            target.slowFactor = 0.6;
            spawnParticles(targetPos.x, targetPos.y - 6, 8, '#93C5FD');
          }

          if (projectile.effect === 'lightning') {
            const radius = projectile.chainRadius ?? 86;
            const max = projectile.chainMax ?? 3;
            let chained = 0;
            for (const other of enemyMap.values()) {
              if (other.id === target.id) continue;
              if (other.hp <= 0) continue;
              if (chained >= max) break;
              const p = getEnemyPosition(other);
              const d2 = Math.hypot(p.x - targetPos.x, p.y - targetPos.y);
              if (d2 > radius) continue;
              other.hp -= projectile.damage * 0.55;
              chained++;
              spawnShockwave(p.x, p.y - 6, '#A78BFA', 6, 260, 0.18, 3);
              spawnParticles(p.x, p.y - 6, 10, '#A78BFA');
            }
            if (chained > 0) startShake(2.2, 0.1);
          }
          continue;
        }
        afterCollision.push(projectile);
      }

      remainingProjectiles = afterCollision;
      if (anyHit) {
        const survivors = updatedEnemies.filter(e => e.hp > 0);
        if (survivors.length !== updatedEnemies.length) {
          setScore(v => v + (updatedEnemies.length - survivors.length) * 4);
          startShake(2.5, 0.12);
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
          spawnShockwave(boom.x, boom.y - 10, '#F8C5C5', 10, 260, 0.28, 6);
          startShake(4, 0.2);
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

    // Defensive resize: avoid canvas accidentally stuck at 1x1 which looks like a black screen.
    const dpr = window.devicePixelRatio || 1;
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      const cssW = Math.max(1, Math.floor(container.clientWidth || rect.width || 1));
      const cssH = Math.max(1, Math.floor(container.clientHeight || rect.height || 1));
      const wantW = Math.max(1, Math.floor(cssW * dpr));
      const wantH = Math.max(1, Math.floor(cssH * dpr));
      if (canvas.width !== wantW || canvas.height !== wantH) {
        canvas.width = wantW;
        canvas.height = wantH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    ctx.clearRect(0, 0, width, height);

    // Chalkboard background + vignette
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, COLORS.bgTop);
    bg.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.2, width / 2, height / 2, Math.max(width, height) * 0.7);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    const simNow = simTimeRef.current;
    const frozen = simNow < freezeUntilRef.current;
    const slow = simNow < slowUntilRef.current;
    const frenzy = simNow < frenzyUntilRef.current;

    // screen shake (battlefield only)
    const shake = shakeRef.current;
    if (simNow < shake.until && shake.amp > 0) {
      const a = shake.amp;
      ctx.save();
      ctx.translate((Math.random() - 0.5) * a * 2, (Math.random() - 0.5) * a * 2);
    } else {
      shakeRef.current = { until: 0, amp: 0 };
    }

    const sortedCells = [...grid].sort((a, b) => (a.x + a.y) - (b.x + b.y));
    for (const cell of sortedCells) {
      const center = isoToScreen(cell.x, cell.y);
      const seed = Math.floor(hash01(cell.x, cell.y, 11) * 100000);
      drawTile(ctx, center.x, center.y, cell.isPath, seed);

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
      const seed = Math.floor(hash01(enemy.id, enemy.kind.length, 17) * 100000);

      ctx.save();
      ctx.translate(pos.x, pos.y - TILE_H / 2);
      ctx.fillStyle = COLORS.shadow;
      ctx.beginPath();
      ctx.ellipse(0, size * 0.85, size * 0.95, size * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();

      if (slow) {
        ctx.save();
        ctx.strokeStyle = 'rgba(181,216,248,0.75)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, size * 0.95, size * 1.08, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      drawInkMinion(ctx, { kind: enemy.kind, size, seed, simNow });

      if (frozen) {
        ctx.save();
        ctx.strokeStyle = 'rgba(199,210,254,0.9)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, size * 1.02, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(239,246,255,0.85)';
        ctx.lineWidth = 2;
        for (let k = 0; k < 6; k++) {
          const ang = (k / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * (size * 0.35), Math.sin(ang) * (size * 0.35));
          ctx.lineTo(Math.cos(ang) * (size * 0.9), Math.sin(ang) * (size * 0.9));
          ctx.stroke();
        }
        ctx.restore();
      }

      const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
      ctx.fillStyle = '#ffefc2';
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 2;
      ctx.fillRect(-size, -size * 1.4, size * 2, 7);
      ctx.strokeRect(-size, -size * 1.4, size * 2, 7);
      ctx.fillStyle = '#34d399';
      ctx.fillRect(-size, -size * 1.4, size * 2 * hpRatio, 7);

      if (frozen || slow) {
        ctx.save();
        ctx.translate(0, -size * 1.65);
        ctx.fillStyle = frozen ? 'rgba(199,210,254,0.95)' : 'rgba(181,216,248,0.95)';
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 2;
        // rounded rect (no roundRect dependency)
        const x = -10, y = -10, w = 20, h = 18, r = 6;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = COLORS.border;
        ctx.font = 'bold 12px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(frozen ? 'ICE' : 'SLOW', 0, -1);
        ctx.restore();
      }

      ctx.restore();
    }

    const sortedTowers = [...towersRef.current].sort((a, b) => (a.gridX + a.gridY) - (b.gridX + b.gridY));
    for (const tower of sortedTowers) {
      const pos = isoToScreen(tower.gridX, tower.gridY);
      const baseY = pos.y - TILE_H / 2 - 4;
      const level = tower.level || 1;

      ctx.save();
      ctx.translate(pos.x, baseY);

      if (frenzy) {
        ctx.save();
        ctx.shadowColor = 'rgba(253,230,138,0.95)';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = 'rgba(253,230,138,0.8)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 8, 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = COLORS.shadow;
      ctx.beginPath();
      ctx.ellipse(0, 22, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 4;

      if (tower.type === 'soldier') {
        ctx.save();
        ctx.translate(0, -10);
        drawCuteCatHead(ctx, {
          fur: '#F59E0B',
          furShadow: '#FDE68A',
          mood: 'smile',
          levelText: String(level),
          accent: '#FDE68A'
        });
        ctx.restore();
      } else if (tower.type === 'mage-ice') {
        ctx.save();
        ctx.translate(0, -10);
        drawCuteCatHead(ctx, {
          fur: '#FDE68A',
          furShadow: '#F59E0B',
          hat: '#1E3A8A',
          staff: { color: '#2B1E12', gem: '#93C5FD', side: 'left' },
          mood: 'wink',
          levelText: String(level),
          accent: '#93C5FD'
        });
        ctx.restore();
      } else if (tower.type === 'mage-lightning') {
        ctx.save();
        ctx.translate(0, -10);
        drawCuteCatHead(ctx, {
          fur: '#FDE68A',
          furShadow: '#F59E0B',
          hat: '#4C1D95',
          staff: { color: '#2B1E12', gem: '#A78BFA', side: 'right' },
          mood: 'smile',
          levelText: String(level),
          accent: '#A78BFA'
        });
        ctx.restore();
      } else if (tower.type === 'archer') {
        ctx.save();
        ctx.translate(0, -10);
        drawCuteCatHead(ctx, {
          fur: '#FDE68A',
          furShadow: '#F59E0B',
          headband: '#34D399',
          icon: 'arrow',
          mood: 'smile',
          levelText: String(level),
          accent: '#34D399'
        });
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(0, -10);
        drawCuteCatHead(ctx, {
          fur: '#FDE68A',
          furShadow: '#F59E0B',
          goggles: { frame: '#F472B6', lens: 'rgba(251,191,36,0.55)' },
          icon: 'bomb',
          mood: 'grit',
          levelText: String(level),
          accent: '#F472B6'
        });
        ctx.restore();
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

    // Skill overlays
    if (slow) {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, 'rgba(181,216,248,0.00)');
      grad.addColorStop(0.45, 'rgba(181,216,248,0.08)');
      grad.addColorStop(1, 'rgba(181,216,248,0.00)');
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
    if (frozen) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(199,210,254,0.12)';
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
    if (frenzy) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(253,230,138,0.07)';
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    for (const projectile of projectilesRef.current) {
      ctx.save();
      if (typeof projectile.lastX === 'number' && typeof projectile.lastY === 'number') {
        ctx.globalAlpha = Math.max(0.15, Math.min(0.7, projectile.life));
        ctx.strokeStyle = projectile.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = projectile.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(projectile.lastX, projectile.lastY);
        ctx.lineTo(projectile.x, projectile.y);
        ctx.stroke();
      }
      ctx.fillStyle = projectile.color;
      ctx.shadowColor = projectile.color;
      ctx.shadowBlur = 10;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Shockwaves (hit impact)
    for (const wave of shockwavesRef.current) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, wave.life));
      ctx.strokeStyle = wave.color;
      ctx.lineWidth = wave.thickness;
      ctx.shadowColor = wave.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.r, 0, Math.PI * 2);
      ctx.stroke();
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

    if (simNow < shake.until && shake.amp > 0) {
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
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const cssW = Math.max(1, Math.floor(container.clientWidth || rect.width || 1));
      const cssH = Math.max(1, Math.floor(container.clientHeight || rect.height || 1));
      const nextW = Math.max(1, Math.floor(cssW * dpr));
      const nextH = Math.max(1, Math.floor(cssH * dpr));
      if (canvas.width === nextW && canvas.height === nextH) return;
      canvas.width = nextW;
      canvas.height = nextH;
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
    const finalScore = Math.max(0, Math.round(score + wave * 12 + correctAnswers * 4));
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

	      <div ref={containerRef} className="relative flex-1 min-h-0 rounded-2xl border-4 border-brand-brown bg-[#101418] overflow-hidden shadow-comic-xl">
	        <canvas
	          ref={canvasRef}
	          className="w-full h-full"
	        />
	        {(effectUi.freeze > 0 || effectUi.slow > 0 || effectUi.frenzy > 0) && (
	          <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col gap-2">
	            {(() => {
	              const items: Array<{ key: 'freeze' | 'slow' | 'frenzy'; label: string; color: string; border: string; window: { start: number; end: number } }> = [
	                { key: 'freeze', label: '冰凍', color: 'bg-indigo-100 text-indigo-900', border: 'border-indigo-300', window: freezeUiWindowRef.current },
	                { key: 'slow', label: '減速', color: 'bg-sky-100 text-sky-900', border: 'border-sky-300', window: slowUiWindowRef.current },
	                { key: 'frenzy', label: '狂熱', color: 'bg-amber-100 text-amber-900', border: 'border-amber-300', window: frenzyUiWindowRef.current }
	              ];
	              const getRem = (k: 'freeze' | 'slow' | 'frenzy') => (k === 'freeze' ? effectUi.freeze : k === 'slow' ? effectUi.slow : effectUi.frenzy);
	              return items
	                .map((it) => {
	                  const rem = getRem(it.key);
	                  if (rem <= 0) return null;
	                  const denom = Math.max(0.001, it.window.end - it.window.start);
	                  const pct = Math.max(0, Math.min(1, rem / denom));
	                  return (
	                    <div key={it.key} className={`flex items-center gap-2 px-3 py-2 rounded-2xl border-2 ${it.color} ${it.border} font-black shadow-comic`}>
	                      <span>{it.label}</span>
	                      <div className="w-20 h-2 rounded-full bg-white/70 border border-black/10 overflow-hidden">
	                        <div className="h-full bg-black/55" style={{ width: `${pct * 100}%` }} />
	                      </div>
	                      <span className="text-xs opacity-80">{Math.ceil(rem)}s</span>
	                    </div>
	                  );
	                })
	                .filter(Boolean);
	            })()}
	          </div>
	        )}
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
