import './index.css';

import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { showToast } from '@devvit/web/client';
import type {
  DailyStats,
  InitResponse,
  PlayerDailyRecord,
  SubmitSolveResponse,
} from '../shared/api';
import type { GridCell } from '../shared/puzzleEngine';
import {
  COLOR_META,
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
import { playCrystalLock, playMirrorClick, playSolveChord } from './sound';

export const App = () => {
  const todayFallback = useMemo(() => formatDateKeyUtc(new Date()), []);
  const [todayDateKey, setTodayDateKey] = useState<string>(todayFallback);
  const [activeDateKey, setActiveDateKey] = useState<string>(todayFallback);
  const [username, setUsername] = useState<string>('player');
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [playerRecord, setPlayerRecord] = useState<PlayerDailyRecord | null>(
    null
  );
  const [percentile, setPercentile] = useState<number | null>(null);

  const puzzle = useMemo(() => getDailyPuzzle(activeDateKey), [activeDateKey]);
  const isDailyMode = activeDateKey === todayDateKey;

  const [grid, setGrid] = useState<GridCell[][]>(() => cloneGrid(puzzle.grid));
  const [history, setHistory] = useState<GridCell[][][]>([]);
  const [moves, setMoves] = useState<number>(0);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [muted, setMuted] = useState<boolean>(false);
  const [hintCell, setHintCell] = useState<{ row: number; col: number } | null>(
    null
  );
  const [showVictory, setShowVictory] = useState<boolean>(false);

  const startTimeRef = useRef<number>(0);
  const solvedSubmittedRef = useRef<boolean>(false);
  const prevMatchedCountRef = useRef<number>(0);

  const trace = useMemo(() => traceBeams(grid), [grid]);
  const matchedCount = useMemo(
    () => trace.receptors.filter((r) => r.matched).length,
    [trace.receptors]
  );

  const switchToDateKey = (nextDateKey: string) => {
    const nextPuzzle = getDailyPuzzle(nextDateKey);
    setActiveDateKey(nextDateKey);
    setGrid(cloneGrid(nextPuzzle.grid));
    setHistory([]);
    setMoves(0);
    setElapsedMs(0);
    setHintCell(null);
    setShowVictory(false);
    startTimeRef.current = Date.now();
    solvedSubmittedRef.current = false;
    prevMatchedCountRef.current = traceBeams(nextPuzzle.grid).receptors.filter(
      (r) => r.matched
    ).length;
  };

  // Load Reddit user & community Redis stats
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
        if (data.dateKey !== todayFallback) {
          const syncedPuzzle = getDailyPuzzle(data.dateKey);
          setActiveDateKey(data.dateKey);
          setGrid(cloneGrid(syncedPuzzle.grid));
          setHistory([]);
          setMoves(0);
          setElapsedMs(0);
          startTimeRef.current = Date.now();
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
    if (trace.isSolved) return;
    if (startTimeRef.current === 0) {
      startTimeRef.current = Date.now();
    }
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 250);
    return () => window.clearInterval(id);
  }, [trace.isSolved, activeDateKey]);

  const submitDailySolve = (finalMoves: number, finalMs: number) => {
    if (!isDailyMode) return;
    fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateKey: activeDateKey,
        moves: Math.max(1, finalMoves),
        timeMs: finalMs,
        par: puzzle.par,
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
    return getHintCell(grid, puzzle.solutionOrientations);
  }, [moves, trace.isSolved, grid, puzzle.solutionOrientations]);

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

  const handleTileTap = (row: number, col: number) => {
    if (trace.isSolved) return;
    const next = toggleTileAt(grid, row, col);
    if (!next) return;
    const nextMoves = moves + 1;
    const nextTrace = traceBeams(next);
    const nextMatched = nextTrace.receptors.filter((r) => r.matched).length;

    setHistory((prev) => [...prev, grid]);
    setGrid(next);
    setMoves(nextMoves);
    setHintCell(null);

    if (nextTrace.isSolved) {
      solvedSubmittedRef.current = true;
      const startMs = startTimeRef.current || Date.now();
      const finalMs = Math.max(500, Date.now() - startMs);
      setElapsedMs(finalMs);
      playSolveChord(muted);
      setShowVictory(true);
      submitDailySolve(nextMoves, finalMs);
    } else if (nextMatched > prevMatchedCountRef.current) {
      playCrystalLock(muted);
    } else {
      playMirrorClick(muted);
    }
    prevMatchedCountRef.current = nextMatched;
  };

  const handleUndo = () => {
    if (history.length === 0 || trace.isSolved) return;
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((prev) => prev.slice(0, -1));
    setGrid(previous);
    setMoves((m) => Math.max(0, m - 1));
    setHintCell(null);
    prevMatchedCountRef.current = traceBeams(previous).receptors.filter(
      (r) => r.matched
    ).length;
  };

  const handleReset = () => {
    switchToDateKey(activeDateKey);
  };

  const handleHint = () => {
    if (trace.isSolved) return;
    const cell = getHintCell(grid, puzzle.solutionOrientations);
    if (cell) {
      setHintCell(cell);
      showToast('Highlighted a mirror to rotate!');
    }
  };

  const handleCopyShare = async () => {
    const shareText = buildSpoilerFreeShareText({
      puzzleNumber: puzzle.puzzleNumber,
      title: puzzle.title,
      moves: Math.max(1, moves),
      par: puzzle.par,
      timeMs: elapsedMs,
      streak,
      grid,
    });
    try {
      await navigator.clipboard.writeText(shareText);
      showToast('Copied spoiler-free result — paste it in the comments!');
    } catch {
      showToast('Result ready! Share your score in the comments.');
    }
  };

  const handleSwitchPractice = () => {
    const nextNum = puzzle.puzzleNumber > 1 ? puzzle.puzzleNumber - 1 : 24;
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
    <div className="h-dvh w-full bg-[#0b101b] text-slate-100 flex flex-col justify-between overflow-hidden px-3 py-2.5 sm:px-5 sm:py-3.5">
      {/* Top HUD */}
      <header className="w-full max-w-lg mx-auto flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
            <span>{isDailyMode ? 'Daily' : 'Archive'}</span>
            <span>·</span>
            <span>#{puzzle.puzzleNumber}</span>
            {streak > 0 ? (
              <span className="ml-1 text-orange-300">🔥 {streak}</span>
            ) : null}
          </div>
          <h1 className="text-base sm:text-lg font-bold truncate text-white">
            {puzzle.title}
          </h1>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
            <span className="text-slate-400">Moves </span>
            <span
              className={
                moves <= puzzle.par
                  ? 'text-emerald-300 font-bold'
                  : 'text-amber-300 font-bold'
              }
            >
              {moves}
            </span>
            <span className="text-slate-500">/{puzzle.par}</span>
          </div>
          <div className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
            {formatDuration(elapsedMs)}
          </div>
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-center justify-center cursor-pointer hover:bg-slate-800"
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>

      {/* Main Optical Board */}
      <main className="w-full max-w-lg mx-auto flex-1 flex flex-col items-center justify-center min-h-0 py-1.5 gap-2">
        <OpticalBoard
          grid={grid}
          trace={trace}
          interactive={!trace.isSolved}
          hintCell={hintCell}
          onboardingCell={onboardingCell}
          onTileTap={handleTileTap}
        />

        {/* Compact Color Mix Key & Crystal Progress */}
        <div className="w-full max-w-[420px] flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-300">
          <div className="flex flex-wrap items-center gap-1.5">
            {activeRecipes.map(({ mask, recipe }) => {
              const meta = COLOR_META[mask];
              return (
                <span
                  key={mask}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800"
                >
                  <span style={{ color: meta.hex }} className="font-bold">
                    {meta.symbol}
                  </span>
                  <span className="text-slate-400">{recipe}</span>
                </span>
              );
            })}
          </div>

          <div className="font-semibold text-slate-200">
            Crystals:{' '}
            <span
              className={
                trace.isSolved ? 'text-emerald-400' : 'text-amber-300'
              }
            >
              {matchedCount}/{trace.receptors.length}
            </span>
          </div>
        </div>
      </main>

      {/* Bottom Action Bar */}
      <footer className="w-full max-w-[420px] mx-auto flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleUndo}
            disabled={history.length === 0 || trace.isSolved}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-200 disabled:opacity-40 cursor-pointer hover:bg-slate-800"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-200 cursor-pointer hover:bg-slate-800"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleHint}
            disabled={trace.isSolved}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500/15 border border-amber-400/40 text-amber-300 disabled:opacity-40 cursor-pointer hover:bg-amber-500/25"
          >
            Hint
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {trace.isSolved ? (
            <button
              type="button"
              onClick={() => setShowVictory(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-400 text-slate-950 cursor-pointer"
            >
              Results
            </button>
          ) : isDailyMode ? (
            <button
              type="button"
              onClick={handleSwitchPractice}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-400 cursor-pointer hover:text-slate-200"
            >
              Archive
            </button>
          ) : (
            <button
              type="button"
              onClick={handleBackToDaily}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-sky-500/20 border border-sky-400/40 text-sky-300 cursor-pointer"
            >
              Today's Daily
            </button>
          )}
        </div>
      </footer>

      {/* Focused Single Victory / Community Result Card */}
      {showVictory ? (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#11192c] border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                  {moves <= puzzle.par ? '⚡ PAR CLEAR' : '✨ RELAY SOLVED'}
                </span>
                <h2 className="text-lg font-bold text-white mt-1">
                  Prism Relay #{puzzle.puzzleNumber}
                </h2>
                <p className="text-xs text-slate-400">
                  {puzzle.title} · u/{username}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowVictory(false)}
                aria-label="Close results"
                className="text-slate-400 hover:text-white text-sm px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Key Stats Grid */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-2.5">
                <div className="text-lg font-bold font-mono text-white">
                  {moves}
                </div>
                <div className="text-[11px] text-slate-400">
                  Par {puzzle.par}
                </div>
              </div>
              <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-2.5">
                <div className="text-lg font-bold font-mono text-white">
                  {formatDuration(elapsedMs)}
                </div>
                <div className="text-[11px] text-slate-400">Time</div>
              </div>
              <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-2.5">
                <div className="text-lg font-bold font-mono text-amber-300">
                  🔥 {streak || 1}
                </div>
                <div className="text-[11px] text-slate-400">
                  Best {Math.max(bestStreak, streak, 1)}
                </div>
              </div>
            </div>

            {/* Community Distribution + Leaderboard */}
            {stats && stats.totalSolvers > 0 ? (
              <div className="space-y-2 rounded-xl bg-slate-900/70 border border-slate-800 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">
                    Community Today ({stats.totalSolvers})
                  </span>
                  {percentile !== null ? (
                    <span className="text-emerald-300 font-semibold">
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
                      <span className="w-8 text-slate-400">{row.label}</span>
                      <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-400"
                          style={{
                            width: `${Math.max(6, Math.round((row.count / distTotal) * 100))}%`,
                          }}
                        />
                      </div>
                      <span className="w-6 text-right font-mono text-slate-300">
                        {row.count}
                      </span>
                    </div>
                  ))}
                </div>
                {stats.leaderboard.length > 0 ? (
                  <div className="pt-2 border-t border-slate-800 space-y-1">
                    {stats.leaderboard.slice(0, 3).map((entry) => (
                      <div
                        key={entry.username}
                        className="flex items-center justify-between text-[11px]"
                      >
                        <span className="text-slate-300 truncate">
                          #{entry.rank} u/{entry.username}
                        </span>
                        <span className="font-mono text-slate-400">
                          {entry.moves}m · {formatDuration(entry.timeMs)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : playerRecord ? (
              <div className="text-xs text-center text-slate-400">
                Best today: {playerRecord.moves} moves ({formatDuration(playerRecord.timeMs)})
              </div>
            ) : null}

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleCopyShare();
                }}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 hover:brightness-110 cursor-pointer"
              >
                Copy Spoiler-Free Result for Comments
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleSwitchPractice}
                  className="py-2 px-3 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 cursor-pointer"
                >
                  Play Archive Board
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="py-2 px-3 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 cursor-pointer"
                >
                  Replay for Par
                </button>
              </div>
            </div>
          </div>
        </div>
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
