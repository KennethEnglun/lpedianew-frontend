import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowLeft, RefreshCw, BrainCircuit, Trophy, Frown } from 'lucide-react';

// --- Types ---
export interface MazeQuestion {
    id: string;
    text: string;
    options: string[];
    correctIndex: number;
}

interface Cell {
    x: number;
    y: number;
    type: 'wall' | 'path';
    walls: { top: boolean; right: boolean; bottom: boolean; left: boolean };
    visited: boolean;
}

interface Particle {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
    size: number;
}

type Position = { x: number; y: number };

interface Props {
    questions: MazeQuestion[];
    onExit: () => void;
    onComplete: (score: number) => void;
}

// --- Config ---
const ROWS = 13;
const COLS = 13;
const CELL_SIZE = 45;
const WALL_THICKNESS = 6;
const TIME_PER_QUESTION = 30;

export const MazeGame: React.FC<Props> = ({ questions, onExit, onComplete }) => {
    // Game Logic State
    const [grid, setGrid] = useState<Cell[][]>([]);
    const [playerPos, setPlayerPos] = useState<Position>({ x: 0, y: 0 });
    const [questionNodes, setQuestionNodes] = useState<{ pos: Position, question: MazeQuestion }[]>([]);

    // Game Status
    const [answeredCount, setAnsweredCount] = useState(0);
    const [totalQuestions, setTotalQuestions] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
    const [score, setScore] = useState(0);

    // Visuals
    const [activeQuestion, setActiveQuestion] = useState<MazeQuestion | null>(null);
    const [message, setMessage] = useState<string>('');
    const [particles, setParticles] = useState<Particle[]>([]);
    const animationFrameRef = useRef<number>();
    const lastTimeRef = useRef<number>(0);

    // Touch Handling Refs
    const touchStartRef = useRef<{ x: number, y: number } | null>(null);

    // --- Particle System ---
    const createExplosion = (x: number, y: number, color: string = '#fbbf24') => {
        const newParticles: Particle[] = [];
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 2;
            newParticles.push({
                id: Math.random(),
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                color: ['#fbbf24', '#f472b6', '#34d399', '#60a5fa'][Math.floor(Math.random() * 4)],
                size: Math.random() * 4 + 2
            });
        }
        setParticles(prev => [...prev, ...newParticles]);
    };

    const updateParticles = () => {
        setParticles(prev => prev.map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.2, // Gravity
            life: p.life - 0.02
        })).filter(p => p.life > 0));
    };

    // --- Game Loop ---
    useEffect(() => {
        const loop = (timestamp: number) => {
            if (!lastTimeRef.current) lastTimeRef.current = timestamp;

            updateParticles();

            lastTimeRef.current = timestamp;
            animationFrameRef.current = requestAnimationFrame(loop);
        };
        animationFrameRef.current = requestAnimationFrame(loop);
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, []);

    // Timer
    useEffect(() => {
        if (gameState !== 'playing' || activeQuestion) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    setGameState('lost');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [gameState, activeQuestion]);


    // --- Initialization ---
    const initGame = useCallback(() => {
        // 1. Maze Gen
        const newGrid: Cell[][] = [];
        for (let y = 0; y < ROWS; y++) {
            const row: Cell[] = [];
            for (let x = 0; x < COLS; x++) {
                row.push({
                    x, y, type: 'wall', visited: false,
                    walls: { top: true, right: true, bottom: true, left: true }
                });
            }
            newGrid.push(row);
        }

        const stack: Cell[] = [];
        const startCell = newGrid[0][0];
        startCell.visited = true;
        stack.push(startCell);

        while (stack.length > 0) {
            const current = stack.pop()!;
            const neighbors: { cell: Cell; dir: 'top' | 'right' | 'bottom' | 'left' }[] = [];
            const directions = [
                { dx: 0, dy: -1, dir: 'top' },
                { dx: 1, dy: 0, dir: 'right' },
                { dx: 0, dy: 1, dir: 'bottom' },
                { dx: -1, dy: 0, dir: 'left' }
            ] as const;

            directions.forEach(({ dx, dy, dir }) => {
                const nx = current.x + dx;
                const ny = current.y + dy;
                if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && !newGrid[ny][nx].visited) {
                    neighbors.push({ cell: newGrid[ny][nx], dir });
                }
            });

            if (neighbors.length > 0) {
                stack.push(current);
                const chosen = neighbors[Math.floor(Math.random() * neighbors.length)];
                if (chosen.dir === 'top') { current.walls.top = false; chosen.cell.walls.bottom = false; }
                if (chosen.dir === 'bottom') { current.walls.bottom = false; chosen.cell.walls.top = false; }
                if (chosen.dir === 'left') { current.walls.left = false; chosen.cell.walls.right = false; }
                if (chosen.dir === 'right') { current.walls.right = false; chosen.cell.walls.left = false; }
                chosen.cell.visited = true;
                stack.push(chosen.cell);
            }
        }

        setGrid(newGrid);
        setPlayerPos({ x: 0, y: 0 });

        // 2. Setup Questions
        const validSpots: Position[] = [];
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                if (x === 0 && y === 0) continue;
                validSpots.push({ x, y });
            }
        }
        // Shuffle
        for (let i = validSpots.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [validSpots[i], validSpots[j]] = [validSpots[j], validSpots[i]];
        }

        const qNodes = [];
        const maxQ = Math.min(questions.length, 8); // Max 8 questions
        // Ensure we have questions to place
        if (questions.length > 0) {
            for (let i = 0; i < maxQ; i++) {
                // Use modulo if not enough distinct questions, though maxQ handles standard clamp
                const q = questions[i % questions.length];
                qNodes.push({ pos: validSpots[i], question: q });
            }
        }

        setQuestionNodes(qNodes);
        setTotalQuestions(maxQ);
        setAnsweredCount(0);

        // 3. Setup Time & State
        setTimeLeft(maxQ > 0 ? maxQ * TIME_PER_QUESTION : 60);
        setGameState('playing');
        setScore(0);
        setParticles([]);
        setMessage('挑戰開始！');

    }, [questions]);

    useEffect(() => {
        initGame();
    }, [initGame]);

    // --- Logic ---
    const handleMove = useCallback((dx: number, dy: number) => {
        if (gameState !== 'playing' || activeQuestion) return;

        setPlayerPos(prev => {
            const newX = prev.x + dx;
            const newY = prev.y + dy;
            if (newX < 0 || newX >= COLS || newY < 0 || newY >= ROWS) return prev;
            const currentCell = grid[prev.y][prev.x];
            // Wall Check
            if (dx === 1 && currentCell.walls.right) return prev;
            if (dx === -1 && currentCell.walls.left) return prev;
            if (dy === 1 && currentCell.walls.bottom) return prev;
            if (dy === -1 && currentCell.walls.top) return prev;

            // Check Questions
            const qIndex = questionNodes.findIndex(n => n.pos.x === newX && n.pos.y === newY);
            if (qIndex !== -1) {
                setActiveQuestion(questionNodes[qIndex].question);
            }
            return { x: newX, y: newY };
        });
    }, [grid, questionNodes, gameState, activeQuestion]);

    // Keyboard
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'ArrowUp': handleMove(0, -1); break;
                case 'ArrowDown': handleMove(0, 1); break;
                case 'ArrowLeft': handleMove(-1, 0); break;
                case 'ArrowRight': handleMove(1, 0); break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleMove]);

    // Touch / Swipe
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        };
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStartRef.current) return;

        const touchEnd = {
            x: e.changedTouches[0].clientX,
            y: e.changedTouches[0].clientY
        };

        const dx = touchEnd.x - touchStartRef.current.x;
        const dy = touchEnd.y - touchStartRef.current.y;
        const minSwipeDistance = 30;

        if (Math.abs(dx) > Math.abs(dy)) {
            if (Math.abs(dx) > minSwipeDistance) handleMove(dx > 0 ? 1 : -1, 0);
        } else {
            if (Math.abs(dy) > minSwipeDistance) handleMove(0, dy > 0 ? 1 : -1);
        }

        touchStartRef.current = null;
    };

    const handleAnswer = (optionIndex: number) => {
        if (!activeQuestion) return;

        if (optionIndex === activeQuestion.correctIndex) {
            // Correct
            const newAnsweredCount = answeredCount + 1;
            setAnsweredCount(newAnsweredCount);

            const basePoints = 100;
            setScore(prev => prev + basePoints);

            const qNode = questionNodes.find(n => n.question.id === activeQuestion.id);
            if (qNode) {
                const px = qNode.pos.x * CELL_SIZE + CELL_SIZE / 2;
                const py = qNode.pos.y * CELL_SIZE + CELL_SIZE / 2;
                createExplosion(px, py);
            }
            setMessage('答對了！');
            setQuestionNodes(prev => prev.filter(q => q.question.id !== activeQuestion.id));

            if (newAnsweredCount >= totalQuestions) {
                const timeBonus = timeLeft * 10;
                setScore(prev => prev + timeBonus);
                setGameState('won');
                createExplosion(COLS * CELL_SIZE / 2, ROWS * CELL_SIZE / 2);
                // Call onComplete when dismissed
            }
        } else {
            // Wrong
            setTimeLeft(prev => Math.max(0, prev - 10));
            setMessage('答錯了！-10秒');
        }
        setActiveQuestion(null);
    };

    const handleWinConfirm = () => {
        onComplete(score);
    };

    // --- Rendering 3D Maze ---
    const renderWalls3D = () => {
        const wallPaths: string[] = [];
        const shadows: string[] = [];

        grid.forEach(row => {
            row.forEach(cell => {
                const x = cell.x * CELL_SIZE;
                const y = cell.y * CELL_SIZE;
                if (cell.walls.top) {
                    wallPaths.push(`M${x},${y} h${CELL_SIZE}`);
                    shadows.push(`M${x + 4},${y + 4} h${CELL_SIZE}`);
                }
                if (cell.walls.right) {
                    wallPaths.push(`M${x + CELL_SIZE},${y} v${CELL_SIZE}`);
                    shadows.push(`M${x + CELL_SIZE + 4},${y + 4} v${CELL_SIZE}`);
                }
                if (cell.walls.bottom) {
                    wallPaths.push(`M${x},${y + CELL_SIZE} h${CELL_SIZE}`);
                    shadows.push(`M${x + 4},${y + CELL_SIZE + 4} h${CELL_SIZE}`);
                }
                if (cell.walls.left) {
                    wallPaths.push(`M${x},${y} v${CELL_SIZE}`);
                    shadows.push(`M${x + 4},${y + 4} v${CELL_SIZE}`);
                }
            });
        });

        return (
            <>
                <path d={shadows.join(' ')} stroke="rgba(0,0,0,0.2)" strokeWidth={WALL_THICKNESS} strokeLinecap="round" />
                <path d={wallPaths.join(' ')} stroke="#4338ca" strokeWidth={WALL_THICKNESS} strokeLinecap="round" />
                <path d={wallPaths.join(' ')} stroke="#818cf8" strokeWidth={2} strokeLinecap="round" strokeDasharray="5,5" opacity="0.5" />
            </>
        );
    };

    return (
        <div
            className="flex flex-col items-center justify-center w-full h-full bg-gradient-to-br from-indigo-100 to-amber-100 p-4 relative overflow-hidden rounded-3xl"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >

            {/* HUD */}
            <div className="absolute top-4 left-0 right-0 flex justify-center items-start z-10 pointer-events-none px-4">
                <div className="flex gap-4 items-center">
                    <button onClick={onExit} className="pointer-events-auto bg-white p-3 rounded-2xl shadow-xl text-gray-500 hover:text-red-500 hover:scale-105 transition-all">
                        <ArrowLeft size={24} />
                    </button>

                    <div className="bg-white/90 backdrop-blur-md px-6 py-3 rounded-2xl shadow-xl border-b-4 border-indigo-200 flex gap-6">
                        <div className="flex flex-col items-center">
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Time</div>
                            <div className={`text-2xl font-black font-mono ${timeLeft < 20 ? 'text-red-500 animate-pulse' : 'text-indigo-900'}`}>
                                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                            </div>
                        </div>
                        <div className="w-px bg-gray-200"></div>
                        <div className="flex flex-col items-center">
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Score</div>
                            <div className="text-2xl font-black text-amber-500">{score}</div>
                        </div>
                        <div className="w-px bg-gray-200"></div>
                        <div className="flex flex-col items-center">
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Progress</div>
                            <div className="text-2xl font-black text-green-600">{answeredCount}/{totalQuestions}</div>
                        </div>
                    </div>

                    <button onClick={initGame} className="pointer-events-auto bg-white p-3 rounded-2xl shadow-xl text-gray-500 hover:text-indigo-500 hover:scale-105 transition-all">
                        <RefreshCw size={24} />
                    </button>
                </div>
            </div>

            {/* Message Toast */}
            {message && (
                <div className="absolute top-28 z-20 pointer-events-none">
                    <div className="bg-indigo-900/90 text-white px-6 py-2 rounded-full shadow-2xl animate-bounce font-bold border border-indigo-500/50">
                        {message}
                    </div>
                </div>
            )}

            {/* 3D Game Canvas */}
            <div className="relative mt-12 transition-transform duration-500" style={{ transform: 'perspective(1000px) rotateX(20deg) scale(0.9)' }}>
                <div className="absolute inset-0 bg-indigo-900 rounded-3xl translate-y-4 blur-sm opacity-30"></div>
                <div className="relative bg-[#f8fafc] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-8 border-white p-4 overflow-visible">
                    <svg
                        width={COLS * CELL_SIZE}
                        height={ROWS * CELL_SIZE}
                        viewBox={`-5 -5 ${COLS * CELL_SIZE + 10} ${ROWS * CELL_SIZE + 10}`}
                        className="block"
                        style={{ overflow: 'visible' }}
                    >
                        <defs>
                            <pattern id="floorPattern" width={CELL_SIZE} height={CELL_SIZE} patternUnits="userSpaceOnUse">
                                <rect width={CELL_SIZE} height={CELL_SIZE} fill="#f1f5f9" />
                                <circle cx={CELL_SIZE / 2} cy={CELL_SIZE / 2} r={2} fill="#cbd5e1" />
                            </pattern>
                            <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
                                <feOffset dx="2" dy="2" result="offsetblur" />
                                <feFlood floodColor="#000000" floodOpacity="0.3" />
                                <feComposite in2="offsetblur" operator="in" />
                                <feMerge>
                                    <feMergeNode />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#floorPattern)" rx="8" />

                        {grid.length > 0 && renderWalls3D()}

                        {questionNodes.map((node) => (
                            <g key={node.question.id} transform={`translate(${node.pos.x * CELL_SIZE + CELL_SIZE / 2}, ${node.pos.y * CELL_SIZE + CELL_SIZE / 2})`}>
                                <animateTransform attributeName="transform" type="translate" values={`${node.pos.x * CELL_SIZE + CELL_SIZE / 2}, ${node.pos.y * CELL_SIZE + CELL_SIZE / 2 - 5}; ${node.pos.x * CELL_SIZE + CELL_SIZE / 2}, ${node.pos.y * CELL_SIZE + CELL_SIZE / 2 + 5}; ${node.pos.x * CELL_SIZE + CELL_SIZE / 2}, ${node.pos.y * CELL_SIZE + CELL_SIZE / 2 - 5}`} dur="3s" repeatCount="indefinite" additive="replace" />
                                <rect x="-14" y="-14" width="28" height="28" rx="6" fill="#fbbf24" stroke="#d97706" strokeWidth="3" filter="url(#dropShadow)" />
                                <text x="0" y="6" textAnchor="middle" fill="#92400e" fontSize="18" fontWeight="bold" style={{ pointerEvents: 'none' }}>?</text>
                            </g>
                        ))}

                        <g transform={`translate(${playerPos.x * CELL_SIZE + CELL_SIZE / 2}, ${playerPos.y * CELL_SIZE + CELL_SIZE / 2})`} className="transition-all duration-200 ease-in-out">
                            <circle r={CELL_SIZE / 2 - 4} fill="#6366f1" filter="url(#dropShadow)" />
                            <circle cx="-6" cy="-4" r="3" fill="white" />
                            <circle cx="6" cy="-4" r="3" fill="white" />
                            <circle cx="-6" cy="-4" r="1.5" fill="#1e1b4b" />
                            <circle cx="6" cy="-4" r="1.5" fill="#1e1b4b" />
                            <path d="M -4 6 Q 0 9 4 6" stroke="white" strokeWidth="2" fill="none" />
                        </g>

                        {particles.map(p => (
                            <circle key={p.id} cx={p.x} cy={p.y} r={p.size} fill={p.color} opacity={p.life} />
                        ))}

                    </svg>
                </div>
            </div>

            {/* Floating D-Pad */}
            <div className="absolute bottom-8 right-8 z-40 lg:hidden flex flex-col items-center gap-2 pointer-events-none">
                <div className="pointer-events-auto bg-white/30 backdrop-blur-md p-2 rounded-full border border-white/40 shadow-xl grid grid-cols-3 gap-1">
                    <div />
                    <button
                        className="w-16 h-16 bg-white/80 rounded-full flex items-center justify-center active:bg-white active:scale-90 transition-all shadow-sm"
                        onClick={(e) => { e.stopPropagation(); handleMove(0, -1); }}
                    >
                        <ArrowLeft className="rotate-90 text-indigo-600" size={32} />
                    </button>
                    <div />
                    <button
                        className="w-16 h-16 bg-white/80 rounded-full flex items-center justify-center active:bg-white active:scale-90 transition-all shadow-sm"
                        onClick={(e) => { e.stopPropagation(); handleMove(-1, 0); }}
                    >
                        <ArrowLeft className="text-indigo-600" size={32} />
                    </button>
                    <div className="w-16 h-16 flex items-center justify-center">
                        <div className="w-4 h-4 bg-white/40 rounded-full"></div>
                    </div>
                    <button
                        className="w-16 h-16 bg-white/80 rounded-full flex items-center justify-center active:bg-white active:scale-90 transition-all shadow-sm"
                        onClick={(e) => { e.stopPropagation(); handleMove(1, 0); }}
                    >
                        <ArrowLeft className="rotate-180 text-indigo-600" size={32} />
                    </button>
                    <div />
                    <button
                        className="w-16 h-16 bg-white/80 rounded-full flex items-center justify-center active:bg-white active:scale-90 transition-all shadow-sm"
                        onClick={(e) => { e.stopPropagation(); handleMove(0, 1); }}
                    >
                        <ArrowLeft className="-rotate-90 text-indigo-600" size={32} />
                    </button>
                    <div />
                </div>
            </div>

            {/* Question Modal */}
            {activeQuestion && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] p-8 max-w-lg w-full shadow-2xl border-4 border-amber-300 animate-[bounce_0.3s_ease-out]">
                        <div className="flex justify-center -mt-16 mb-4">
                            <div className="bg-amber-400 p-4 rounded-full border-4 border-white shadow-lg">
                                <BrainCircuit className="w-12 h-12 text-white" />
                            </div>
                        </div>

                        <div className="w-full bg-gray-200 h-2 rounded-full mb-6 overflow-hidden">
                            <div className="bg-amber-500 h-full w-full animate-[shrink_30s_linear_forwards]" style={{ width: '100%' }}></div>
                        </div>

                        <h3 className="text-2xl font-black text-center text-gray-800 mb-8 leading-relaxed">{activeQuestion.text}</h3>
                        <div className="grid grid-cols-1 gap-4">
                            {activeQuestion.options.map((opt, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleAnswer(idx)}
                                    className="w-full p-4 text-left rounded-xl border-2 border-indigo-100 bg-indigo-50 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all font-bold text-gray-700 shadow-sm group"
                                >
                                    <span className="inline-block w-8 h-8 bg-white text-indigo-600 rounded-full text-center leading-8 mr-3 text-sm font-black group-hover:bg-indigo-400 group-hover:text-white transition-colors">{String.fromCharCode(65 + idx)}</span>
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Game Over / Victory Modal */}
            {(gameState === 'won' || gameState === 'lost') && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className={`bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl border-8 text-center transform transition-all scale-100 ${gameState === 'won' ? 'border-yellow-400' : 'border-gray-300'}`}>

                        {gameState === 'won' ? (
                            <div className="relative">
                                <div className="absolute inset-0 bg-yellow-400 blur-3xl opacity-20 rounded-full"></div>
                                <Trophy className="w-32 h-32 text-yellow-400 mx-auto mb-6 animate-bounce relative z-10" />
                                <h2 className="text-5xl font-black text-indigo-900 mb-2 tracking-tight">恭喜通關!</h2>
                                <div className="text-amber-500 font-bold text-xl mb-6">PERFECT SCORE</div>
                            </div>
                        ) : (
                            <div>
                                <Frown className="w-32 h-32 text-gray-400 mx-auto mb-6" />
                                <h2 className="text-4xl font-black text-gray-700 mb-2">時間到!</h2>
                                <p className="text-gray-500 font-medium mb-6">差一點點！下次動作要快一點喔！</p>
                            </div>
                        )}

                        <div className="bg-gray-50 rounded-2xl p-6 mb-8 grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-gray-400 text-xs font-bold uppercase">答對題數</div>
                                <div className="text-2xl font-black text-indigo-600">{answeredCount} / {totalQuestions}</div>
                            </div>
                            <div>
                                <div className="text-gray-400 text-xs font-bold uppercase">最終得分</div>
                                <div className="text-2xl font-black text-amber-500">{score}</div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            {gameState === 'won' ? (
                                <button onClick={handleWinConfirm} className="w-full py-4 rounded-xl font-bold text-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all">
                                    領取獎勵並離開
                                </button>
                            ) : (
                                <button onClick={initGame} className="w-full py-4 rounded-xl font-bold text-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all">
                                    再玩一次
                                </button>
                            )}

                            <button onClick={onExit} className="w-full py-4 rounded-xl font-bold text-lg bg-white text-gray-600 hover:bg-gray-50 border-2 border-gray-100">
                                回到主選單
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
