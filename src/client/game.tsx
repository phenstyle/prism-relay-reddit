import './index.css';

import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { showToast } from '@devvit/web/client';
import type {
  CustomPuzzlePayload,
  DailyStats,
  InitResponse,
  PlayerDailyRecord,
  SubmitSolveResponse,
} from '../shared/api';
import type {
  GridCell,
  MirrorOrientation,
  ReplayStep,
} from '../shared/puzzleEngine';
import {
  COLOR_META,
  buildOptimalParReplay,
  buildSpoilerFreeShareText,
  cloneGrid,
  formatDateKeyUtc,
  formatDuration,
  getDailyPuzzle,
  getDateKeyForPuzzleNumber,
  getHintCell,
  toggleTileAt,
  traceBeams,
} from '../shared/puzzleEngine';
import { OpticalBoard } from './components/OpticalBoard';
import { PuzzleCreatorModal } from './components/PuzzleCreatorModal';
import { playCrystalLock, playMirrorClick, playSolveChord } from './sound';

type ActiveBoardMeta = {
  boardKey: string;
  puzzleNumber: number;
  title: string;
  par: number;
  initialGrid: GridCell[][];
  solutionOrientations: Record<string, MirrorOrientation>;
  author?: string;
  isDaily: boolean;
};

export const App = () => {
  const todayFallback = useMemo(() => formatDateKeyUtc(new Date()), []);
  const [todayDateKey, setTodayDateKey] = useState<string>(todayFallback);
  const [activeDateKey, setActiveDateKey] = useState<string>(todayFallback);
  const [customPuzzle, setCustomPuzzle] = useState<CustomPuzzlePayload | null>(
    null
  );
  const [playingCustom, setPlayingCustom] = useState<boolean>(false);

  const [username, setUsername] = useState<string>('player');
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [playerRecord, setPlayerRecord] = useState<PlayerDailyRecord | null>(
    null
  );
  const [percentile, setPercentile] = useState<number | null>(null);

  const dailyPuzzle = useMemo(
    () => getDailyPuzzle(activeDateKey),
    [activeDateKey]
  );

  const boardMeta: ActiveBoardMeta = useMemo(() => {
    if (playingCustom && customPuzzle) {
      return {
        boardKey: `custom:${customPuzzle.id}`,
        puzzleNumber: dailyPuzzle.puzzleNumber,
        title: customPuzzle.title,
        par: customPuzzle.par,
        initialGrid: customPuzzle.grid,
        solutionOrientations: customPuzzle.solutionOrientations,
        author: customPuzzle.author,
        isDaily: false,
      };
    }
    return {
      boardKey: activeDateKey,
      puzzleNumber: dailyPuzzle.puzzleNumber,
      title: dailyPuzzle.title,
      par: dailyPuzzle.par,
      initialGrid: dailyPuzzle.grid,
      solutionOrientations: dailyPuzzle.solutionOrientations,
      isDaily: activeDateKey === todayDateKey,
    };
  }, [playingCustom, customPuzzle, dailyPuzzle, activeDateKey, todayDateKey]);

  const [grid, setGrid] = useState<GridCell[][]>(() =>
    cloneGrid(dailyPuzzle.grid)
  );
  const [history, setHistory] = useState<GridCell[][][]>([]);
  const [moveSteps, setMoveSteps] = useState<ReplayStep[]>(() => [
    { grid: cloneGrid(dailyPuzzle.grid), tappedCell: null },
  ]);
  const [moves, setMoves] = useState<number>(0);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [muted, setMuted] = useState<boolean>(false);
  const [hintCell, setHintCell] = useState<{ row: number; col: number } | null>(
    null
  );
  const [showVictory, setShowVictory] = useState<boolean>(false);
  const [showCreator, setShowCreator] = useState<boolean>(false);
  const [isReviewing, setIsReviewing] = useState<boolean>(false);
  const [reviewSource, setReviewSource] = useState<'yours' | 'par'>('yours');
  const [reviewIndex, setReviewIndex] = useState<number>(0);
  const [reviewPlaying, setReviewPlaying] = useState<boolean>(false);

  const startTimeRef = useRef<number>(0);
  const solvedSubmittedRef = useRef<boolean>(false);
  const prevMatchedCountRef = useRef<number>(0);
  const victoryTimerRef = useRef<number | null>(null);

  const optimalParSteps = useMemo(
    () =>
      buildOptimalParReplay(
        boardMeta.initialGrid,
        boardMeta.solutionOrientations
      ),
    [boardMeta.initialGrid, boardMeta.solutionOrientations]
  );

  const activeReplaySteps = useMemo(
    () => (reviewSource === 'par' ? optimalParSteps : moveSteps),
    [reviewSource, optimalParSteps, moveSteps]
  );

  const trace = useMemo(() => traceBeams(grid), [grid]);
  const displayGrid = useMemo(() => {
    if (!isReviewing) return grid;
    const clamped = Math.min(reviewIndex, activeReplaySteps.length - 1);
    return activeReplaySteps[Math.max(0, clamped)]?.grid ?? grid;
  }, [isReviewing, reviewIndex, activeReplaySteps, grid]);
  const displayTrace = useMemo(() => traceBeams(displayGrid), [displayGrid]);
  const matchedCount = useMemo(
    () => displayTrace.receptors.filter((r) => r.matched).length,
    [displayTrace.receptors]
  );
  const reviewHighlight = useMemo(() => {
    if (!isReviewing || reviewIndex <= 0) return null;
    const step = activeReplaySteps[reviewIndex];
    if (!step?.tappedCell) return null;
    return {
      row: step.tappedCell.row,
      col: step.tappedCell.col,
      moveNumber: reviewIndex,
    };
  }, [isReviewing, reviewIndex, activeReplaySteps]);

  const resetWithGrid = (nextGrid: GridCell[][]) => {
    if (victoryTimerRef.current !== null) {
      window.clearTimeout(victoryTimerRef.current);
      victoryTimerRef.current = null;
    }
    setGrid(cloneGrid(nextGrid));
    setHistory([]);
    setMoveSteps([{ grid: cloneGrid(nextGrid), tappedCell: null }]);
    setMoves(0);
    setElapsedMs(0);
    setHintCell(null);
    setShowVictory(false);
    setIsReviewing(false);
    setReviewSource('yours');
    setReviewIndex(0);
    setReviewPlaying(false);
    startTimeRef.current = Date.now();
    solvedSubmittedRef.current = false;
    prevMatchedCountRef.current = traceBeams(nextGrid).receptors.filter(
      (r) => r.matched
    ).length;
  };

  const switchToDateKey = (nextDateKey: string) => {
    const nextPuzzle = getDailyPuzzle(nextDateKey);
    setPlayingCustom(false);
    setActiveDateKey(nextDateKey);
    resetWithGrid(nextPuzzle.grid);
  };

  // Load Reddit user, custom post payload (if community relay), & community Redis stats
  useEffect(() => {
    startTimeRef.current = Date.now();
    let mounted = true;
    fetch('/api/init')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: InitResponse | null) => {
        if (!mounted || !data || data.type !== 'init') return;
        setTodayDateKey(data.dateKey);
        setUsername(data.username);
        setStreak(data.streak);
        setBestStreak(data.bestStreak);
        setStats(data.stats);
        setPlayerRecord(data.playerRecord);

        if (data.customPuzzle) {
          setCustomPuzzle(data.customPuzzle);
          setPlayingCustom(true);
          resetWithGrid(data.customPuzzle.grid);
        } else if (data.dateKey !== todayFallback) {
          const syncedPuzzle = getDailyPuzzle(data.dateKey);
          setActiveDateKey(data.dateKey);
          resetWithGrid(syncedPuzzle.grid);
        }
      })
      .catch(() => {
        // Standalone local preview fallback
      });
    return () => {
      mounted = false;
    };
  }, [todayFallback]);

  // Tick timer while unsolved
  useEffect(() => {
    if (trace.isSolved || showCreator) return;
    if (startTimeRef.current === 0) {
      startTimeRef.current = Date.now();
    }
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 250);
    return () => window.clearInterval(id);
  }, [trace.isSolved, showCreator, boardMeta.boardKey]);

  const submitBoardSolve = (finalMoves: number, finalMs: number) => {
    if (!boardMeta.isDaily && !playingCustom) return;
    fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateKey: todayDateKey,
        boardKey: boardMeta.boardKey,
        moves: Math.max(1, finalMoves),
        timeMs: finalMs,
        par: boardMeta.par,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SubmitSolveResponse | null) => {
        if (!data || data.type !== 'submit') return;
        setStreak(data.streak);
        setBestStreak(data.bestStreak);
        setStats(data.stats);
        setPlayerRecord(data.playerRecord);
        setPercentile(data.percentile);
      })
      .catch(() => {
        // Keep local victory card even if offline
      });
  };

  // Subtle first-move onboarding cue pointing to one misaligned mirror
  const onboardingCell = useMemo(() => {
    if (moves > 0 || trace.isSolved) return null;
    return getHintCell(grid, boardMeta.solutionOrientations);
  }, [moves, trace.isSolved, grid, boardMeta.solutionOrientations]);

  // Show only the mixing recipes relevant to this board's mixed receptors
  const activeRecipes = useMemo(() => {
    const seen = new Set<number>();
    const list: { mask: 3 | 5 | 6 | 7; recipe: string }[] = [];
    for (const rec of trace.receptors) {
      const m = rec.targetColor;
      if ((m === 3 || m === 5 || m === 6 || m === 7) && !seen.has(m)) {
        seen.add(m);
        list.push({ mask: m, recipe: COLOR_META[m].recipe });
      }
    }
    return list;
  }, [trace.receptors]);

  // Auto-play Move Review playback
  useEffect(() => {
    if (!isReviewing || !reviewPlaying) return;
    const maxIdx = activeReplaySteps.length - 1;
    const id = window.setInterval(() => {
      setReviewIndex((prev) => {
        if (prev >= maxIdx) {
          setReviewPlaying(false);
          return prev;
        }
        const nextIdx = prev + 1;
        const nextStep = activeReplaySteps[nextIdx];
        if (nextStep) {
          const stepTrace = traceBeams(nextStep.grid);
          if (stepTrace.isSolved) {
            playSolveChord(muted);
          } else {
            playMirrorClick(muted);
          }
        }
        if (nextIdx >= maxIdx) {
          setReviewPlaying(false);
        }
        return nextIdx;
      });
    }, 750);
    return () => window.clearInterval(id);
  }, [isReviewing, reviewPlaying, activeReplaySteps, muted]);

  const enterMoveReview = (autoPlay: boolean, source: 'yours' | 'par' = 'yours') => {
    const steps = source === 'par' ? optimalParSteps : moveSteps;
    setShowVictory(false);
    setReviewSource(source);
    setIsReviewing(true);
    setReviewIndex(autoPlay ? 0 : Math.max(0, steps.length - 1));
    setReviewPlaying(autoPlay);
  };

  const handleTileTap = (row: number, col: number) => {
    if (trace.isSolved || isReviewing) return;
    const next = toggleTileAt(grid, row, col);
    if (!next) return;
    const nextMoves = moves + 1;
    const nextTrace = traceBeams(next);
    const nextMatched = nextTrace.receptors.filter((r) => r.matched).length;

    setHistory((prev) => [...prev, grid]);
    setMoveSteps((prev) => [
      ...prev,
      { grid: cloneGrid(next), tappedCell: { row, col } },
    ]);
    setGrid(next);
    setMoves(nextMoves);
    setHintCell(null);

    if (nextTrace.isSolved) {
      solvedSubmittedRef.current = true;
      const startMs = startTimeRef.current || Date.now();
      const finalMs = Math.max(500, Date.now() - startMs);
      setElapsedMs(finalMs);
      playSolveChord(muted);
      submitBoardSolve(nextMoves, finalMs);
      if (victoryTimerRef.current !== null) {
        window.clearTimeout(victoryTimerRef.current);
      }
      victoryTimerRef.current = window.setTimeout(() => {
        setShowVictory(true);
        victoryTimerRef.current = null;
      }, 1100);
    } else if (nextMatched > prevMatchedCountRef.current) {
      playCrystalLock(muted);
    } else {
      playMirrorClick(muted);
    }
    prevMatchedCountRef.current = nextMatched;
  };

  const handleUndo = () => {
    if (history.length === 0 || trace.isSolved || isReviewing) return;
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((prev) => prev.slice(0, -1));
    setMoveSteps((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
    setGrid(previous);
    setMoves((m) => Math.max(0, m - 1));
    setHintCell(null);
    prevMatchedCountRef.current = traceBeams(previous).receptors.filter(
      (r) => r.matched
    ).length;
  };

  const handleReset = () => {
    resetWithGrid(boardMeta.initialGrid);
  };

  const handleHint = () => {
    if (trace.isSolved) return;
    const cell = getHintCell(grid, boardMeta.solutionOrientations);
    if (cell) {
      setHintCell(cell);
      showToast('Highlighted an optical tile to rotate.');
    }
  };

  const handleCopyShare = async () => {
    const shareText = buildSpoilerFreeShareText({
      puzzleNumber: boardMeta.puzzleNumber,
      title: boardMeta.title,
      moves: Math.max(1, moves),
      par: boardMeta.par,
      timeMs: elapsedMs,
      streak,
      grid,
      author: boardMeta.author,
    });
    try {
      await navigator.clipboard.writeText(shareText);
      showToast('Copied spoiler-free result — paste it in the comments!');
    } catch {
      showToast('Result ready! Share your score in the comments.');
    }
  };

  const handleSwitchPractice = () => {
    const nextNum = boardMeta.puzzleNumber > 1 ? boardMeta.puzzleNumber - 1 : 24;
    switchToDateKey(getDateKeyForPuzzleNumber(nextNum));
  };

  const handleBackToDaily = () => {
    switchToDateKey(todayDateKey);
  };

  const distTotal = Math.max(
    1,
    (stats?.distribution.par ?? 0) +
      (stats?.distribution.near ?? 0) +
      (stats?.distribution.over ?? 0)
  );

  return (
    <div className="h-dvh w-full atelier-paper text-stone-900 flex flex-col justify-between overflow-hidden px-3 py-2.5 sm:px-5 sm:py-3.5">
      {/* Editorial Header */}
      <header className="w-full max-w-lg mx-auto flex items-center justify-between gap-2 border-b border-stone-300/80 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8c6220]">
            <span>
              {boardMeta.author
                ? `Community · u/${boardMeta.author}`
                : boardMeta.isDaily
                  ? `Daily · #${boardMeta.puzzleNumber}`
                  : `Archive · #${boardMeta.puzzleNumber}`}
            </span>
            {streak > 0 ? (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                🔥 {streak}
              </span>
            ) : null}
          </div>
          <h1 className="font-editorial text-lg sm:text-xl font-bold truncate text-stone-900 leading-tight">
            {boardMeta.title}
          </h1>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="px-2.5 py-1 rounded-lg bg-white/90 border border-stone-300 text-xs font-mono shadow-xs">
            <span className="text-stone-500">Moves </span>
            <span
              className={
                moves <= boardMeta.par
                  ? 'text-emerald-700 font-bold'
                  : 'text-amber-700 font-bold'
              }
            >
              {moves}
            </span>
            <span className="text-stone-400">/{boardMeta.par}</span>
          </div>
          <div className="px-2 py-1 rounded-lg bg-white/90 border border-stone-300 text-xs font-mono text-stone-700 shadow-xs">
            {formatDuration(elapsedMs)}
          </div>
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            className="w-8 h-8 rounded-lg bg-white/90 border border-stone-300 text-xs flex items-center justify-center cursor-pointer hover:bg-white shadow-xs"
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>

      {/* Main Optical Board */}
      <main className="w-full max-w-lg mx-auto flex-1 flex flex-col items-center justify-center min-h-0 py-1.5 gap-2">
        <OpticalBoard
          grid={displayGrid}
          trace={displayTrace}
          interactive={!trace.isSolved && !isReviewing}
          hintCell={isReviewing ? null : hintCell}
          onboardingCell={isReviewing ? null : onboardingCell}
          reviewHighlight={reviewHighlight}
          onTileTap={handleTileTap}
        />

        {/* Compact Color Mix Key or Move Review Step Readout + Crystal Counter */}
        <div className="w-full max-w-[412px] flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-stone-700">
          <div className="flex flex-wrap items-center gap-1.5">
            {isReviewing ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-950 font-semibold">
                {reviewSource === 'par' ? '⚡ Optimal Par' : 'Move Review'} ·{' '}
                {reviewIndex === 0
                  ? 'Start'
                  : `Move ${reviewIndex}/${Math.max(1, activeReplaySteps.length - 1)}`}
              </span>
            ) : (
              activeRecipes.map(({ mask, recipe }) => {
                const meta = COLOR_META[mask];
                return (
                  <span
                    key={mask}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/90 border border-stone-300 shadow-xs"
                  >
                    <span className="text-stone-600 font-medium">{recipe} =</span>
                    <span style={{ color: meta.hex }} className="font-bold">
                      {meta.symbol} {meta.name}
                    </span>
                  </span>
                );
              })
            )}
          </div>

          <div className="font-semibold text-stone-800">
            Crystals:{' '}
            <span
              className={
                displayTrace.isSolved ? 'text-emerald-700' : 'text-[#8c6220]'
              }
            >
              {matchedCount}/{displayTrace.receptors.length}
            </span>
          </div>
        </div>
      </main>

      {/* Bottom Craft Control Dock (Switches to Chess-style Move Review scrubber after solve) */}
      <footer className="w-full max-w-[412px] mx-auto flex items-center justify-between gap-1.5 pt-1">
        {isReviewing ? (
          <>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Jump to start"
                disabled={reviewIndex <= 0}
                onClick={() => {
                  setReviewPlaying(false);
                  setReviewIndex(0);
                }}
                className="px-2 py-2 rounded-xl text-xs font-bold bg-white/90 border border-stone-300 text-stone-800 disabled:opacity-35 cursor-pointer hover:bg-white shadow-xs"
              >
                ⏮
              </button>
              <button
                type="button"
                aria-label="Previous move"
                disabled={reviewIndex <= 0}
                onClick={() => {
                  setReviewPlaying(false);
                  setReviewIndex((i) => Math.max(0, i - 1));
                }}
                className="px-2.5 py-2 rounded-xl text-xs font-bold bg-white/90 border border-stone-300 text-stone-800 disabled:opacity-35 cursor-pointer hover:bg-white shadow-xs"
              >
                ◀
              </button>
              <button
                type="button"
                aria-label={reviewPlaying ? 'Pause replay' : 'Play replay'}
                onClick={() => {
                  if (reviewPlaying) {
                    setReviewPlaying(false);
                  } else {
                    if (reviewIndex >= activeReplaySteps.length - 1) {
                      setReviewIndex(0);
                    }
                    setReviewPlaying(true);
                  }
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-100 border border-amber-300 text-amber-950 cursor-pointer hover:bg-amber-200/70"
              >
                {reviewPlaying ? '⏸' : '▶'}
              </button>
              <button
                type="button"
                aria-label="Next move"
                disabled={reviewIndex >= activeReplaySteps.length - 1}
                onClick={() => {
                  setReviewPlaying(false);
                  setReviewIndex((i) =>
                    Math.min(activeReplaySteps.length - 1, i + 1)
                  );
                }}
                className="px-2.5 py-2 rounded-xl text-xs font-bold bg-white/90 border border-stone-300 text-stone-800 disabled:opacity-35 cursor-pointer hover:bg-white shadow-xs"
              >
                ▶|
              </button>
            </div>
            <div className="flex items-center gap-1">
              {moves > boardMeta.par ? (
                <button
                  type="button"
                  onClick={() => {
                    const nextSrc = reviewSource === 'yours' ? 'par' : 'yours';
                    enterMoveReview(false, nextSrc);
                  }}
                  className="px-2.5 py-2 rounded-xl text-xs font-bold bg-white/90 border border-amber-400 text-amber-900 cursor-pointer hover:bg-amber-50"
                >
                  {reviewSource === 'yours' ? `⚡ Par (${boardMeta.par})` : 'Your Moves'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setReviewPlaying(false);
                  setShowVictory(true);
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-700 text-white cursor-pointer hover:bg-emerald-800"
              >
                Results
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleUndo}
                disabled={history.length === 0 || trace.isSolved}
                className="px-2.5 py-2 rounded-xl text-xs font-semibold bg-white/90 border border-stone-300 text-stone-800 disabled:opacity-40 cursor-pointer hover:bg-white shadow-xs"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-2.5 py-2 rounded-xl text-xs font-semibold bg-white/90 border border-stone-300 text-stone-800 cursor-pointer hover:bg-white shadow-xs"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleHint}
                disabled={trace.isSolved}
                className="px-2.5 py-2 rounded-xl text-xs font-semibold bg-amber-100 border border-amber-300 text-amber-900 disabled:opacity-40 cursor-pointer hover:bg-amber-200/70"
              >
                Hint
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowCreator(true)}
                className="px-2.5 py-2 rounded-xl text-xs font-bold bg-[#1c1917] text-[#f5efe4] border border-[#b8893a] cursor-pointer hover:bg-stone-800"
              >
                + Create
              </button>
              {trace.isSolved ? (
                <button
                  type="button"
                  onClick={() => enterMoveReview(false, 'yours')}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-700 text-white cursor-pointer hover:bg-emerald-800"
                >
                  Review
                </button>
              ) : boardMeta.isDaily ? (
                <button
                  type="button"
                  onClick={handleSwitchPractice}
                  className="px-2.5 py-2 rounded-xl text-xs font-semibold bg-white/80 border border-stone-300 text-stone-600 cursor-pointer hover:text-stone-900"
                >
                  Archive
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleBackToDaily}
                  className="px-2.5 py-2 rounded-xl text-xs font-semibold bg-sky-100 border border-sky-300 text-sky-900 cursor-pointer"
                >
                  Daily
                </button>
              )}
            </div>
          </>
        )}
      </footer>

      {/* Focused Editorial Victory Card */}
      {showVictory ? (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#f5efe4] border-2 border-[#b8893a] p-5 shadow-2xl space-y-4 text-stone-900">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300">
                  {moves <= boardMeta.par ? '⚡ Par Clear' : '✨ Relay Solved'}
                </span>
                <h2 className="font-editorial text-xl font-bold text-stone-900 mt-1">
                  {boardMeta.title}
                </h2>
                <p className="text-xs text-stone-500">
                  {boardMeta.author
                    ? `Community Relay by u/${boardMeta.author}`
                    : `Edition #${boardMeta.puzzleNumber}`}{' '}
                  · u/{username}
                </p>
              </div>
              <button
                type="button"
                onClick={() => enterMoveReview(false, 'yours')}
                aria-label="Close results and review moves"
                className="text-stone-500 hover:text-stone-900 text-sm px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Score Cards */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white/90 border border-stone-300 p-2.5">
                <div className="text-lg font-bold font-mono text-stone-900">
                  {moves}
                </div>
                <div className="text-[11px] text-stone-500">
                  Par {boardMeta.par}
                </div>
              </div>
              <div className="rounded-xl bg-white/90 border border-stone-300 p-2.5">
                <div className="text-lg font-bold font-mono text-stone-900">
                  {formatDuration(elapsedMs)}
                </div>
                <div className="text-[11px] text-stone-500">Time</div>
              </div>
              <div className="rounded-xl bg-white/90 border border-stone-300 p-2.5">
                <div className="text-lg font-bold font-mono text-amber-700">
                  🔥 {streak || 1}
                </div>
                <div className="text-[11px] text-stone-500">
                  Best {Math.max(bestStreak, streak, 1)}
                </div>
              </div>
            </div>

            {/* Subreddit Histogram + Top 3 */}
            {stats && stats.totalSolvers > 0 ? (
              <div className="space-y-2 rounded-xl bg-white/85 border border-stone-300 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-stone-800">
                    Subreddit Board ({stats.totalSolvers})
                  </span>
                  {percentile !== null ? (
                    <span className="text-emerald-700 font-bold">
                      Top {percentile}%
                    </span>
                  ) : null}
                </div>
                <div className="space-y-1 text-[11px]">
                  {[
                    { key: 'par', label: 'Par', count: stats.distribution.par ?? 0 },
                    { key: 'near', label: '+1–2', count: stats.distribution.near ?? 0 },
                    { key: 'over', label: '+3+', count: stats.distribution.over ?? 0 },
                  ].map((row) => (
                    <div key={row.key} className="flex items-center gap-2">
                      <span className="w-8 text-stone-500">{row.label}</span>
                      <div className="flex-1 h-2 rounded-full bg-stone-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#b8893a]"
                          style={{
                            width: `${Math.max(6, Math.round((row.count / distTotal) * 100))}%`,
                          }}
                        />
                      </div>
                      <span className="w-6 text-right font-mono text-stone-700">
                        {row.count}
                      </span>
                    </div>
                  ))}
                </div>
                {stats.leaderboard.length > 0 ? (
                  <div className="pt-2 border-t border-stone-200 space-y-1">
                    {stats.leaderboard.slice(0, 3).map((entry) => (
                      <div
                        key={entry.username}
                        className="flex items-center justify-between text-[11px]"
                      >
                        <span className="text-stone-700 truncate font-medium">
                          #{entry.rank} u/{entry.username}
                        </span>
                        <span className="font-mono text-stone-500">
                          {entry.moves}m · {formatDuration(entry.timeMs)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : playerRecord ? (
              <div className="text-xs text-center text-stone-600">
                Best recorded: {playerRecord.moves} moves ({formatDuration(playerRecord.timeMs)})
              </div>
            ) : null}

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleCopyShare();
                }}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-[#f5efe4] bg-[#1c1917] border border-[#b8893a] hover:bg-stone-800 cursor-pointer"
              >
                Copy Spoiler-Free Result for Comments
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => enterMoveReview(true, 'yours')}
                  className="py-2 px-3 rounded-xl text-xs font-bold bg-amber-100 border border-amber-300 text-amber-950 hover:bg-amber-200/70 cursor-pointer"
                >
                  ▶ Review Moves
                </button>
                <button
                  type="button"
                  onClick={handleSwitchPractice}
                  className="py-2 px-3 rounded-xl text-xs font-semibold bg-white border border-stone-300 text-stone-800 hover:bg-stone-100 cursor-pointer"
                >
                  Next Archive Board
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowVictory(false);
                  setShowCreator(true);
                }}
                className="w-full py-1.5 px-3 rounded-xl text-[11px] font-semibold bg-white/70 border border-stone-300 text-stone-700 hover:bg-white cursor-pointer"
              >
                + Build &amp; Post Your Own Puzzle
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Community UGC Puzzle Creator */}
      {showCreator ? (
        <PuzzleCreatorModal onClose={() => setShowCreator(false)} />
      ) : null}
    </div>
  );
};

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
