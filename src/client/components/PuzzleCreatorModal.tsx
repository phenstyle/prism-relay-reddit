import { useMemo, useState } from 'react';
import { navigateTo, showToast } from '@devvit/web/client';
import type { CreateCustomPuzzleResponse } from '../../shared/api';
import type {
  ColorMask,
  Direction,
  GridCell,
  PrimaryColor,
} from '../../shared/puzzleEngine';
import {
  GRID_SIZE,
  autoScrambleCustomGrid,
  cloneGrid,
  traceBeams,
  validateCustomGrid,
} from '../../shared/puzzleEngine';
import { OpticalBoard } from './OpticalBoard';

type ToolKind = 'emitter' | 'receptor' | 'mirror' | 'splitter' | 'block' | 'erase';

type PuzzleCreatorModalProps = {
  onClose: () => void;
};

const DIRS: Direction[] = ['E', 'S', 'W', 'N'];
const PRIMARY_CYCLE: PrimaryColor[] = [1, 4, 2];
const TARGET_CYCLE: ColorMask[] = [5, 3, 6, 7, 1, 4, 2];

const makeStarterBlueprint = (): GridCell[][] => {
  const grid: GridCell[][] = Array.from({ length: GRID_SIZE }, (_, row) =>
    Array.from({ length: GRID_SIZE }, (_, col) => ({
      kind: 'empty' as const,
      row,
      col,
    }))
  );
  const r0 = grid[0];
  const r2 = grid[2];
  const r4 = grid[4];
  if (r0 && r2 && r4) {
    r0[1] = { kind: 'emitter', row: 0, col: 1, dir: 'S', color: 1 };
    r2[5] = { kind: 'emitter', row: 2, col: 5, dir: 'W', color: 4 };
    r2[1] = { kind: 'splitter', row: 2, col: 1, orientation: 0 };
    r2[3] = { kind: 'receptor', row: 2, col: 3, targetColor: 5 };
    r4[1] = { kind: 'mirror', row: 4, col: 1, orientation: 0 };
    r4[4] = { kind: 'mirror', row: 4, col: 4, orientation: 1 };
    r0[4] = { kind: 'receptor', row: 0, col: 4, targetColor: 1 };
  }
  return grid;
};

export const PuzzleCreatorModal = ({ onClose }: PuzzleCreatorModalProps) => {
  const [grid, setGrid] = useState<GridCell[][]>(() => makeStarterBlueprint());
  const [tool, setTool] = useState<ToolKind>('mirror');
  const [title, setTitle] = useState<string>('');
  const [publishing, setPublishing] = useState<boolean>(false);

  const trace = useMemo(() => traceBeams(grid), [grid]);
  const validation = useMemo(() => validateCustomGrid(grid), [grid]);

  const handleCellTap = (row: number, col: number) => {
    const next = cloneGrid(grid);
    const rowCells = next[row];
    const existing = rowCells?.[col];
    if (!rowCells || !existing) return;

    if (tool === 'erase') {
      rowCells[col] = { kind: 'empty', row, col };
      setGrid(next);
      return;
    }

    if (tool === 'emitter') {
      if (existing.kind === 'emitter') {
        const nextDirIdx = (DIRS.indexOf(existing.dir) + 1) % DIRS.length;
        const nextDir = DIRS[nextDirIdx] ?? 'E';
        const nextColor =
          nextDirIdx === 0
            ? PRIMARY_CYCLE[
                (PRIMARY_CYCLE.indexOf(existing.color) + 1) %
                  PRIMARY_CYCLE.length
              ] ?? 1
            : existing.color;
        rowCells[col] = {
          kind: 'emitter',
          row,
          col,
          dir: nextDir,
          color: nextColor,
        };
      } else {
        rowCells[col] = { kind: 'emitter', row, col, dir: 'E', color: 1 };
      }
      setGrid(next);
      return;
    }

    if (tool === 'receptor') {
      if (existing.kind === 'receptor') {
        const nextIdx =
          (TARGET_CYCLE.indexOf(existing.targetColor) + 1) %
          TARGET_CYCLE.length;
        rowCells[col] = {
          kind: 'receptor',
          row,
          col,
          targetColor: TARGET_CYCLE[nextIdx] ?? 5,
        };
      } else {
        rowCells[col] = { kind: 'receptor', row, col, targetColor: 5 };
      }
      setGrid(next);
      return;
    }

    if (tool === 'mirror') {
      if (existing.kind === 'mirror') {
        rowCells[col] = {
          kind: 'mirror',
          row,
          col,
          orientation: existing.orientation === 0 ? 1 : 0,
        };
      } else {
        rowCells[col] = { kind: 'mirror', row, col, orientation: 0 };
      }
      setGrid(next);
      return;
    }

    if (tool === 'splitter') {
      if (existing.kind === 'splitter') {
        rowCells[col] = {
          kind: 'splitter',
          row,
          col,
          orientation: existing.orientation === 0 ? 1 : 0,
        };
      } else {
        rowCells[col] = { kind: 'splitter', row, col, orientation: 0 };
      }
      setGrid(next);
      return;
    }

    rowCells[col] =
      existing.kind === 'block'
        ? { kind: 'empty', row, col }
        : { kind: 'block', row, col };
    setGrid(next);
  };

  const handleAutoScramble = () => {
    const scrambled = autoScrambleCustomGrid(grid);
    if (!scrambled) {
      showToast('Make sure at least one mirror setup lights all crystals first!');
      return;
    }
    setGrid(scrambled.grid);
    showToast(`Scrambled cleanly! Verified Par ${scrambled.par}.`);
  };

  const handlePublish = async () => {
    if (!validation.valid || publishing) return;
    setPublishing(true);
    try {
      const res = await fetch('/api/custom-puzzle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || 'Atelier Challenge',
          grid,
        }),
      });
      const data: CreateCustomPuzzleResponse | { message?: string } =
        await res.json();
      if (!res.ok || !('type' in data) || data.type !== 'custom-created') {
        const msg =
          'message' in data && data.message
            ? data.message
            : 'Could not publish puzzle';
        showToast(msg);
        setPublishing(false);
        return;
      }
      showToast(`Published "${data.title}" (Par ${data.par}) to subreddit!`);
      navigateTo(data.postUrl);
      onClose();
    } catch {
      showToast('Failed to publish — try again from inside Reddit!');
      setPublishing(false);
    }
  };

  const tools: { id: ToolKind; label: string }[] = [
    { id: 'mirror', label: 'Mirror' },
    { id: 'splitter', label: 'Splitter' },
    { id: 'emitter', label: 'Emitter' },
    { id: 'receptor', label: 'Crystal' },
    { id: 'block', label: 'Pillar' },
    { id: 'erase', label: 'Erase' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/75 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="w-full max-w-md max-h-[96dvh] overflow-y-auto rounded-2xl bg-[#f5efe4] border-2 border-[#b8893a]/70 p-4 shadow-2xl space-y-3 text-stone-900">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8c6220]">
              Community Blueprint Studio
            </span>
            <h2 className="font-editorial text-lg font-bold text-stone-900">
              Create &amp; Post a Relay
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close creator"
            className="text-stone-500 hover:text-stone-900 text-sm px-2 py-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Title + Live Exact Solver Verification Pill */}
        <div className="flex flex-col gap-1.5">
          <input
            type="text"
            maxLength={48}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Name your puzzle (e.g., Twin Violet Crossing)"
            className="w-full px-3 py-1.5 rounded-lg text-xs bg-white/90 border border-stone-300 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#b8893a]"
          />
          <div
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
              validation.valid
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}
          >
            {validation.valid
              ? `✅ Solver Verified · Par ${validation.par} moves · Ready to post!`
              : validation.reason}
          </div>
        </div>

        {/* Tool Palette */}
        <div className="grid grid-cols-6 gap-1">
          {tools.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTool(item.id)}
              className={`py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer border transition ${
                tool === item.id
                  ? 'bg-stone-900 text-[#f5efe4] border-stone-900'
                  : 'bg-white/80 text-stone-700 border-stone-300 hover:bg-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Interactive 6x6 Editor Board */}
        <div className="max-w-[310px] mx-auto">
          <OpticalBoard
            grid={grid}
            trace={trace}
            interactive={true}
            editorMode={true}
            onTileTap={handleCellTap}
          />
        </div>

        <p className="text-[11px] text-center text-stone-500">
          Tap a cell to place; tap again to rotate or cycle color.
        </p>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleAutoScramble}
            className="py-2 px-3 rounded-xl text-xs font-semibold bg-white border border-stone-300 text-stone-800 hover:bg-stone-100 cursor-pointer"
          >
            Auto-Scramble
          </button>
          <button
            type="button"
            disabled={!validation.valid || publishing}
            onClick={() => {
              void handlePublish();
            }}
            className="py-2 px-3 rounded-xl text-xs font-bold bg-[#1c1917] text-[#f5efe4] border border-[#b8893a] disabled:opacity-40 hover:bg-stone-800 cursor-pointer"
          >
            {publishing ? 'Publishing...' : 'Post to Subreddit'}
          </button>
        </div>
      </div>
    </div>
  );
};
