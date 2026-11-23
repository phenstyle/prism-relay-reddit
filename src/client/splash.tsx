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
        // Gracefully render local deterministic daily puzzle preview
      });
    return () => {
      active = false;
    };
  }, []);

  const customPuzzle = initData?.customPuzzle ?? null;
  const dateKey = initData?.dateKey ?? fallbackDate;
  const dailyPuzzle = useMemo(() => getDailyPuzzle(dateKey), [dateKey]);

  const activeGrid = customPuzzle ? customPuzzle.grid : dailyPuzzle.grid;
  const activeTitle = customPuzzle ? customPuzzle.title : dailyPuzzle.title;
  const activePar = customPuzzle ? customPuzzle.par : dailyPuzzle.par;
  const trace = useMemo(() => traceBeams(activeGrid), [activeGrid]);

  const solvedToday = initData?.playerRecord ?? null;
  const totalSolvers = initData?.stats.totalSolvers ?? 0;
  const streak = initData?.streak ?? 0;

  return (
    <div className="h-full w-full atelier-paper text-stone-900 flex flex-col items-center justify-between px-4 py-4 overflow-hidden">
      {/* Editorial Atelier Masthead */}
      <div className="w-full max-w-md flex items-start justify-between gap-3 border-b border-stone-300/80 pb-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[#b8893a]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8c6220]">
              {customPuzzle
                ? `Community Relay · by u/${customPuzzle.author}`
                : `Prism Relay · Edition #${dailyPuzzle.puzzleNumber}`}
            </span>
          </div>
          <h1 className="font-editorial text-2xl font-bold tracking-tight text-stone-900 truncate mt-0.5">
            {activeTitle}
          </h1>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1c1917] text-[#f5efe4] border border-[#b8893a]">
            Par {activePar}
          </span>
          <span className="text-[10px] font-medium text-stone-500 mt-1">
            {customPuzzle ? 'Player Created' : dailyPuzzle.difficulty}
          </span>
        </div>
      </div>

      {/* Recessed Brass Optical Preview */}
      <div className="w-full max-w-[238px] my-1 pointer-events-none">
        <OpticalBoard grid={activeGrid} trace={trace} interactive={false} />
      </div>

      {/* Community Strip + Primary CTA */}
      <div className="w-full max-w-md space-y-2.5">
        <div className="flex items-center justify-center gap-2 text-xs text-stone-700">
          <span className="px-2.5 py-1 rounded-full bg-white/85 border border-stone-300/90 font-medium">
            {totalSolvers > 0
              ? `${totalSolvers} solved`
              : 'Rotate mirrors · Blend light'}
          </span>
          {streak > 0 ? (
            <span className="px-2.5 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 font-semibold">
              🔥 {streak}d streak
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={(e) => {
            void requestExpandedMode(e.nativeEvent, 'game');
          }}
          className="w-full py-3 px-5 rounded-xl font-bold text-sm tracking-wide text-[#f5efe4] bg-[#1c1917] border-2 border-[#b8893a] hover:bg-stone-800 active:scale-[0.99] transition cursor-pointer shadow-[0_8px_20px_rgba(28,25,23,0.22)]"
        >
          {solvedToday
            ? `Solved in ${solvedToday.moves} moves (${formatDuration(solvedToday.timeMs)}) · Open Board`
            : customPuzzle
              ? `Play u/${customPuzzle.author}'s Relay`
              : `Play Today's Relay${context.username ? ` · u/${context.username}` : ''}`}
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
