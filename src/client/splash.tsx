import './index.css';

import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { context, requestExpandedMode } from '@devvit/web/client';
import type { InitResponse } from '../shared/api';
import {
  formatDateKeyUtc,
  formatDuration,
  getDailyPuzzle,
  traceBeams,
} from '../shared/puzzleEngine';
import { OpticalBoard } from './components/OpticalBoard';

export const Splash = () => {
  const fallbackDate = useMemo(() => formatDateKeyUtc(new Date()), []);
  const [initData, setInitData] = useState<InitResponse | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/init')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: InitResponse | null) => {
        if (active && data && data.type === 'init') {
          setInitData(data);
        }
      })
      .catch(() => {
        // Gracefully render local deterministic daily puzzle preview if offline
      });
    return () => {
      active = false;
    };
  }, []);

  const dateKey = initData?.dateKey ?? fallbackDate;
  const puzzle = useMemo(() => getDailyPuzzle(dateKey), [dateKey]);
  const trace = useMemo(() => traceBeams(puzzle.grid), [puzzle.grid]);

  const solvedToday = initData?.playerRecord ?? null;
  const totalSolvers = initData?.stats.totalSolvers ?? 0;
  const streak = initData?.streak ?? 0;

  return (
    <div className="h-full w-full bg-[#0b101b] text-slate-100 flex flex-col items-center justify-between px-4 py-4 overflow-hidden">
      {/* Header */}
      <div className="w-full max-w-md flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_#fbbf24]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
              Daily Optical Puzzle · #{puzzle.puzzleNumber}
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white mt-0.5">
            Prism Relay — {puzzle.title}
          </h1>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800/90 border border-slate-700 text-slate-200 whitespace-nowrap">
          Par {puzzle.par}
        </span>
      </div>

      {/* Live non-interactive optical preview (zero scroll traps!) */}
      <div className="w-full max-w-[235px] my-1 pointer-events-none">
        <OpticalBoard grid={puzzle.grid} trace={trace} interactive={false} />
      </div>

      {/* Stats + Primary CTA */}
      <div className="w-full max-w-md space-y-2.5">
        <div className="flex items-center justify-center gap-3 text-xs text-slate-300">
          <span className="px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800">
            {puzzle.difficulty}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800">
            {totalSolvers > 0
              ? `${totalSolvers} solved today`
              : `Tap mirrors to mix light`}
          </span>
          {streak > 0 ? (
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/40 text-amber-300 font-semibold">
              🔥 {streak}d streak
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={(e) => {
            void requestExpandedMode(e.nativeEvent, 'game');
          }}
          className="w-full py-3 px-5 rounded-xl font-bold text-sm tracking-wide text-slate-950 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 hover:brightness-110 active:scale-[0.99] transition cursor-pointer shadow-[0_10px_28px_rgba(251,146,60,0.35)]"
        >
          {solvedToday
            ? `Solved in ${solvedToday.moves} moves (${formatDuration(solvedToday.timeMs)}) · View Board`
            : `Play Today's Relay${context.username ? ` as u/${context.username}` : ''}`}
        </button>
      </div>
    </div>
  );
};

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <Splash />
    </StrictMode>
  );
}
