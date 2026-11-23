export type Direction = 'N' | 'E' | 'S' | 'W';

export type ColorMask = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type PrimaryColor = 1 | 2 | 4;

export type MirrorOrientation = 0 | 1; // 0 = '/', 1 = '\'

export type CellBase = {
  row: number;
  col: number;
};

export type EmptyCell = CellBase & {
  kind: 'empty';
};

export type BlockCell = CellBase & {
  kind: 'block';
};

export type EmitterCell = CellBase & {
  kind: 'emitter';
  dir: Direction;
  color: PrimaryColor;
};

export type ReceptorCell = CellBase & {
  kind: 'receptor';
  targetColor: ColorMask;
};

export type MirrorCell = CellBase & {
  kind: 'mirror';
  orientation: MirrorOrientation;
  locked?: boolean;
};

export type SplitterCell = CellBase & {
  kind: 'splitter';
  orientation: MirrorOrientation;
  locked?: boolean;
};

export type GridCell =
  | EmptyCell
  | BlockCell
  | EmitterCell
  | ReceptorCell
  | MirrorCell
  | SplitterCell;

export type BeamSegment = {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  dir: Direction;
  color: PrimaryColor;
};

export type ReceptorStatus = {
  row: number;
  col: number;
  targetColor: ColorMask;
  receivedColor: ColorMask;
  matched: boolean;
  overmixed: boolean;
};

export type TraceResult = {
  segments: BeamSegment[];
  cellColors: ColorMask[][];
  receptors: ReceptorStatus[];
  isSolved: boolean;
};

export type DailyPuzzle = {
  dateKey: string;
  puzzleNumber: number;
  title: string;
  difficulty: 'Warmup' | 'Standard' | 'Challenging';
  size: number;
  par: number;
  grid: GridCell[][];
  solutionOrientations: Record<string, MirrorOrientation>;
};

export type ColorMeta = {
  name: string;
  hex: string;
  glow: string;
  symbol: string;
  emoji: string;
  recipe: string;
};

export const GRID_SIZE = 6;

export const COLOR_META: Record<ColorMask, ColorMeta> = {
  0: {
    name: 'None',
    hex: '#334155',
    glow: 'rgba(51, 65, 85, 0.3)',
    symbol: '·',
    emoji: '⬛',
    recipe: '',
  },
  1: {
    name: 'Crimson',
    hex: '#f43f5e',
    glow: 'rgba(244, 63, 94, 0.7)',
    symbol: '●',
    emoji: '🟥',
    recipe: 'Red',
  },
  2: {
    name: 'Amber',
    hex: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.7)',
    symbol: '▲',
    emoji: '🟨',
    recipe: 'Yellow',
  },
  3: {
    name: 'Solar',
    hex: '#fb923c',
    glow: 'rgba(251, 146, 60, 0.75)',
    symbol: '★',
    emoji: '🟧',
    recipe: 'Red + Yellow',
  },
  4: {
    name: 'Cobalt',
    hex: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.7)',
    symbol: '■',
    emoji: '🟦',
    recipe: 'Blue',
  },
  5: {
    name: 'Violet',
    hex: '#c084fc',
    glow: 'rgba(192, 132, 252, 0.75)',
    symbol: '◆',
    emoji: '🟪',
    recipe: 'Red + Blue',
  },
  6: {
    name: 'Emerald',
    hex: '#34d399',
    glow: 'rgba(52, 211, 153, 0.75)',
    symbol: '✦',
    emoji: '🟩',
    recipe: 'Yellow + Blue',
  },
  7: {
    name: 'Prism',
    hex: '#f8fafc',
    glow: 'rgba(248, 250, 252, 0.85)',
    symbol: '❖',
    emoji: '⬜',
    recipe: 'Red + Yellow + Blue',
  },
};

const DIR_DELTA: Record<Direction, { dr: number; dc: number }> = {
  N: { dr: -1, dc: 0 },
  E: { dr: 0, dc: 1 },
  S: { dr: 1, dc: 0 },
  W: { dr: 0, dc: -1 },
};

const REFLECT_SLASH: Record<Direction, Direction> = {
  N: 'E',
  E: 'N',
  S: 'W',
  W: 'S',
};

const REFLECT_BACKSLASH: Record<Direction, Direction> = {
  N: 'W',
  W: 'N',
  S: 'E',
  E: 'S',
};

const ALL_DIRECTIONS: Direction[] = ['N', 'E', 'S', 'W'];

export const combineColorMask = (a: ColorMask, b: ColorMask): ColorMask => {
  const combined = a | b;
  if (combined === 1) return 1;
  if (combined === 2) return 2;
  if (combined === 3) return 3;
  if (combined === 4) return 4;
  if (combined === 5) return 5;
  if (combined === 6) return 6;
  if (combined === 7) return 7;
  return 0;
};

export const cellKey = (row: number, col: number): string => `${row},${col}`;

export const cloneGrid = (grid: GridCell[][]): GridCell[][] =>
  grid.map((row) => row.map((cell) => ({ ...cell })));

export const toggleTileAt = (
  grid: GridCell[][],
  row: number,
  col: number
): GridCell[][] | null => {
  const targetRow = grid[row];
  if (!targetRow) return null;
  const cell = targetRow[col];
  if (!cell) return null;
  if (
    (cell.kind !== 'mirror' && cell.kind !== 'splitter') ||
    cell.locked === true
  ) {
    return null;
  }

  const nextOrientation: MirrorOrientation = cell.orientation === 0 ? 1 : 0;
  return grid.map((r, rIdx) =>
    rIdx !== row
      ? r
      : r.map((c, cIdx) =>
          cIdx !== col
            ? c
            : c.kind === 'mirror'
              ? { ...c, orientation: nextOrientation }
              : c.kind === 'splitter'
                ? { ...c, orientation: nextOrientation }
                : c
        )
  );
};

export const reflectDirection = (
  dir: Direction,
  orientation: MirrorOrientation
): Direction => (orientation === 0 ? REFLECT_SLASH[dir] : REFLECT_BACKSLASH[dir]);

export const traceBeams = (grid: GridCell[][]): TraceResult => {
  const size = grid.length;
  const cellColors: ColorMask[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 0)
  );
  const segments: BeamSegment[] = [];
  const visited = new Set<string>();

  type Ray = {
    row: number;
    col: number;
    dir: Direction;
    color: PrimaryColor;
  };

  const queue: Ray[] = [];

  for (let r = 0; r < size; r++) {
    const rowCells = grid[r];
    if (!rowCells) continue;
    for (let c = 0; c < size; c++) {
      const cell = rowCells[c];
      if (cell && cell.kind === 'emitter') {
        const colorRow = cellColors[r];
        if (colorRow) {
          colorRow[c] = combineColorMask(colorRow[c] ?? 0, cell.color);
        }
        queue.push({ row: r, col: c, dir: cell.dir, color: cell.color });
      }
    }
  }

  let head = 0;
  while (head < queue.length) {
    const ray = queue[head];
    head += 1;
    if (!ray) continue;

    const visitKey = `${ray.row},${ray.col},${ray.dir},${ray.color}`;
    if (visited.has(visitKey)) continue;
    visited.add(visitKey);

    const delta = DIR_DELTA[ray.dir];
    const nextRow = ray.row + delta.dr;
    const nextCol = ray.col + delta.dc;

    if (nextRow < 0 || nextRow >= size || nextCol < 0 || nextCol >= size) {
      continue;
    }

    const nextCell = grid[nextRow]?.[nextCol];
    if (!nextCell || nextCell.kind === 'block' || nextCell.kind === 'emitter') {
      continue;
    }

    segments.push({
      fromRow: ray.row,
      fromCol: ray.col,
      toRow: nextRow,
      toCol: nextCol,
      dir: ray.dir,
      color: ray.color,
    });

    const nextColorRow = cellColors[nextRow];
    if (nextColorRow) {
      nextColorRow[nextCol] = combineColorMask(
        nextColorRow[nextCol] ?? 0,
        ray.color
      );
    }

    if (nextCell.kind === 'empty' || nextCell.kind === 'receptor') {
      queue.push({
        row: nextRow,
        col: nextCol,
        dir: ray.dir,
        color: ray.color,
      });
    } else if (nextCell.kind === 'mirror') {
      const outDir = reflectDirection(ray.dir, nextCell.orientation);
      queue.push({
        row: nextRow,
        col: nextCol,
        dir: outDir,
        color: ray.color,
      });
    } else if (nextCell.kind === 'splitter') {
      const reflectedDir = reflectDirection(ray.dir, nextCell.orientation);
      queue.push({
        row: nextRow,
        col: nextCol,
        dir: ray.dir,
        color: ray.color,
      });
      queue.push({
        row: nextRow,
        col: nextCol,
        dir: reflectedDir,
        color: ray.color,
      });
    }
  }

  const receptors: ReceptorStatus[] = [];
  for (let r = 0; r < size; r++) {
    const rowCells = grid[r];
    if (!rowCells) continue;
    for (let c = 0; c < size; c++) {
      const cell = rowCells[c];
      if (cell && cell.kind === 'receptor') {
        const received = cellColors[r]?.[c] ?? 0;
        const matched = received === cell.targetColor;
        const overmixed =
          received !== 0 && (received & ~cell.targetColor) !== 0;
        receptors.push({
          row: r,
          col: c,
          targetColor: cell.targetColor,
          receivedColor: received,
          matched,
          overmixed,
        });
      }
    }
  }

  const isSolved =
    receptors.length > 0 && receptors.every((rec) => rec.matched);

  return { segments, cellColors, receptors, isSolved };
};

// Seeded PRNG (mulberry32) for deterministic daily board synthesis
const createRng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pickInt = (rng: () => number, maxExclusive: number): number =>
  Math.floor(rng() * maxExclusive);

const makeEmptyGrid = (size: number): GridCell[][] =>
  Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col): EmptyCell => ({
      kind: 'empty',
      row,
      col,
    }))
  );

type RotatablePos = { row: number; col: number };

const collectRotatables = (grid: GridCell[][]): RotatablePos[] => {
  const list: RotatablePos[] = [];
  for (let r = 0; r < grid.length; r++) {
    const rowCells = grid[r];
    if (!rowCells) continue;
    for (let c = 0; c < rowCells.length; c++) {
      const cell = rowCells[c];
      if (
        cell &&
        (cell.kind === 'mirror' || cell.kind === 'splitter') &&
        cell.locked !== true
      ) {
        list.push({ row: r, col: c });
      }
    }
  }
  return list;
};

const applyBitmask = (
  baseGrid: GridCell[][],
  rotatables: RotatablePos[],
  mask: number
): GridCell[][] => {
  const next = cloneGrid(baseGrid);
  for (let i = 0; i < rotatables.length; i++) {
    const pos = rotatables[i];
    if (!pos) continue;
    const cell = next[pos.row]?.[pos.col];
    if (!cell || (cell.kind !== 'mirror' && cell.kind !== 'splitter')) continue;
    const orient: MirrorOrientation = (mask & (1 << i)) !== 0 ? 1 : 0;
    cell.orientation = orient;
  }
  return next;
};

const popcount = (n: number): number => {
  let x = n;
  let count = 0;
  while (x > 0) {
    count += x & 1;
    x >>>= 1;
  }
  return count;
};

export const solveMinimumFlips = (
  grid: GridCell[][]
): { minFlips: number; solutionOrientations: Record<string, MirrorOrientation> } | null => {
  const rotatables = collectRotatables(grid);
  if (rotatables.length === 0 || rotatables.length > 10) return null;

  let startMask = 0;
  for (let i = 0; i < rotatables.length; i++) {
    const pos = rotatables[i];
    if (!pos) continue;
    const cell = grid[pos.row]?.[pos.col];
    if (
      cell &&
      (cell.kind === 'mirror' || cell.kind === 'splitter') &&
      cell.orientation === 1
    ) {
      startMask |= 1 << i;
    }
  }

  let bestFlips = Number.POSITIVE_INFINITY;
  let bestMask = -1;
  const totalStates = 1 << rotatables.length;

  for (let mask = 0; mask < totalStates; mask++) {
    const flips = popcount(mask ^ startMask);
    if (flips >= bestFlips) continue;
    const candidate = applyBitmask(grid, rotatables, mask);
    if (traceBeams(candidate).isSolved) {
      bestFlips = flips;
      bestMask = mask;
      if (bestFlips === 0) break;
    }
  }

  if (bestMask === -1) return null;

  const solutionOrientations: Record<string, MirrorOrientation> = {};
  for (let i = 0; i < rotatables.length; i++) {
    const pos = rotatables[i];
    if (!pos) continue;
    solutionOrientations[cellKey(pos.row, pos.col)] =
      (bestMask & (1 << i)) !== 0 ? 1 : 0;
  }
  return { minFlips: bestFlips, solutionOrientations };
};

const DAILY_TITLES: string[] = [
  'Refraction Dawn',
  'Chromatic Crossroad',
  'Amber Convergence',
  'Split Spectrum',
  'Obsidian Corridor',
  'Violet Echo',
  'Solar Cascade',
  'Emerald Lattice',
  'Twin Prisms',
  'Mirror Meridian',
  'Luminous Vault',
  'Cobalt Crossing',
  'Tri-Beam Nexus',
  'Glass Labyrinth',
  'Spectrum Fold',
  'Helios Relay',
  'Aperture Shift',
  'Crystal Conduit',
  'Beam Resonance',
  'Optical Drift',
  'Radiant Fork',
  'Spectral Bridge',
  'Photon Weave',
  'Prism Horizon',
];

const PRIMARY_COLORS: PrimaryColor[] = [1, 2, 4];

const synthesizeVerifiedBoard = (
  puzzleNumber: number,
  dateKey: string
): DailyPuzzle => {
  const size = GRID_SIZE;
  const wantHard = puzzleNumber % 3 === 0;
  const wantWarmup = puzzleNumber % 3 === 1;
  const desiredMinPar = wantWarmup ? 3 : wantHard ? 5 : 4;
  const desiredMaxPar = wantWarmup ? 4 : wantHard ? 7 : 6;
  const mirrorCount = wantWarmup ? 5 : wantHard ? 8 : 7;
  const splitterCount = wantWarmup ? 1 : 2;
  const blockCount = wantWarmup ? 2 : 3;

  const rng = createRng((puzzleNumber * 2654435761) ^ 0x9e3779b9);

  for (let attempt = 0; attempt < 350; attempt++) {
    const grid = makeEmptyGrid(size);
    const occupied = new Set<string>();

    const placeFree = (
      edgeOnly: boolean
    ): { row: number; col: number } | null => {
      for (let tries = 0; tries < 40; tries++) {
        const row = pickInt(rng, size);
        const col = pickInt(rng, size);
        if (edgeOnly && row !== 0 && row !== size - 1 && col !== 0 && col !== size - 1) {
          continue;
        }
        const key = cellKey(row, col);
        if (!occupied.has(key)) {
          occupied.add(key);
          return { row, col };
        }
      }
      return null;
    };

    // Place 2 or 3 primary-color emitters along perimeter pointing inward
    const emitterCount = wantHard ? 3 : 2;
    const colorOrder: PrimaryColor[] = [...PRIMARY_COLORS];
    for (let i = colorOrder.length - 1; i > 0; i--) {
      const j = pickInt(rng, i + 1);
      const tmp = colorOrder[i];
      const swap = colorOrder[j];
      if (tmp !== undefined && swap !== undefined) {
        colorOrder[i] = swap;
        colorOrder[j] = tmp;
      }
    }

    let emittersOk = true;
    for (let e = 0; e < emitterCount; e++) {
      const pos = placeFree(true);
      const color = colorOrder[e];
      if (!pos || !color) {
        emittersOk = false;
        break;
      }
      const inwardDirs: Direction[] = [];
      if (pos.row === 0) inwardDirs.push('S');
      if (pos.row === size - 1) inwardDirs.push('N');
      if (pos.col === 0) inwardDirs.push('E');
      if (pos.col === size - 1) inwardDirs.push('W');
      const dir = inwardDirs[pickInt(rng, inwardDirs.length)] ?? ALL_DIRECTIONS[0];
      if (!dir) {
        emittersOk = false;
        break;
      }
      const rowCells = grid[pos.row];
      if (rowCells) {
        rowCells[pos.col] = {
          kind: 'emitter',
          row: pos.row,
          col: pos.col,
          dir,
          color,
        };
      }
    }
    if (!emittersOk) continue;

    // Place obsidian blocks
    for (let b = 0; b < blockCount; b++) {
      const pos = placeFree(false);
      if (!pos) break;
      const rowCells = grid[pos.row];
      if (rowCells) {
        rowCells[pos.col] = { kind: 'block', row: pos.row, col: pos.col };
      }
    }

    // Place rotatable splitters & mirrors in their solved orientations first
    const totalRotatables = Math.min(8, mirrorCount + splitterCount);
    const placedRotatables: RotatablePos[] = [];
    for (let i = 0; i < totalRotatables; i++) {
      const pos = placeFree(false);
      if (!pos) break;
      const orient: MirrorOrientation = pickInt(rng, 2) === 0 ? 0 : 1;
      const rowCells = grid[pos.row];
      if (rowCells) {
        rowCells[pos.col] =
          i < splitterCount
            ? {
                kind: 'splitter',
                row: pos.row,
                col: pos.col,
                orientation: orient,
              }
            : {
                kind: 'mirror',
                row: pos.row,
                col: pos.col,
                orientation: orient,
              };
        placedRotatables.push(pos);
      }
    }

    // Trace solved beam network and pick rich mixed + primary empty cells as receptors
    const solvedTrace = traceBeams(grid);
    const mixedCandidates: { row: number; col: number; color: ColorMask }[] = [];
    const primaryCandidates: { row: number; col: number; color: ColorMask }[] = [];

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = grid[r]?.[c];
        const colMask = solvedTrace.cellColors[r]?.[c] ?? 0;
        if (!cell || cell.kind !== 'empty' || colMask === 0) continue;
        if (colMask === 3 || colMask === 5 || colMask === 6 || colMask === 7) {
          mixedCandidates.push({ row: r, col: c, color: colMask });
        } else {
          primaryCandidates.push({ row: r, col: c, color: colMask });
        }
      }
    }

    if (mixedCandidates.length < 1 || primaryCandidates.length < 1) {
      continue;
    }

    // Place 1–2 mixed receptors + 1–2 primary receptors (total 2–3 receptors)
    const chosenReceptors: { row: number; col: number; color: ColorMask }[] = [];
    const firstMix = mixedCandidates[pickInt(rng, mixedCandidates.length)];
    if (firstMix) chosenReceptors.push(firstMix);

    if (mixedCandidates.length >= 2 && !wantWarmup) {
      for (const cand of mixedCandidates) {
        if (
          cand.row !== firstMix?.row ||
          cand.col !== firstMix?.col
        ) {
          if (cand.color !== firstMix?.color || chosenReceptors.length < 2) {
            chosenReceptors.push(cand);
            break;
          }
        }
      }
    }

    const primaryPick = primaryCandidates[pickInt(rng, primaryCandidates.length)];
    if (primaryPick) chosenReceptors.push(primaryPick);

    for (const rec of chosenReceptors) {
      const rowCells = grid[rec.row];
      if (rowCells) {
        rowCells[rec.col] = {
          kind: 'receptor',
          row: rec.row,
          col: rec.col,
          targetColor: rec.color,
        };
      }
    }

    // Scramble a subset of rotatables and compute exact minimum flips via BFS/exhaustive solver
    const scrambled = cloneGrid(grid);
    const flipIndices = placedRotatables.map((_, idx) => idx);
    for (let i = flipIndices.length - 1; i > 0; i--) {
      const j = pickInt(rng, i + 1);
      const a = flipIndices[i];
      const b = flipIndices[j];
      if (a !== undefined && b !== undefined) {
        flipIndices[i] = b;
        flipIndices[j] = a;
      }
    }
    const flipsToScramble = Math.min(
      placedRotatables.length,
      desiredMinPar + 2
    );
    for (let k = 0; k < flipsToScramble; k++) {
      const idx = flipIndices[k];
      if (idx === undefined) continue;
      const pos = placedRotatables[idx];
      if (!pos) continue;
      const cell = scrambled[pos.row]?.[pos.col];
      if (cell && (cell.kind === 'mirror' || cell.kind === 'splitter')) {
        cell.orientation = cell.orientation === 0 ? 1 : 0;
      }
    }

    if (traceBeams(scrambled).isSolved) continue;

    const solved = solveMinimumFlips(scrambled);
    if (!solved) continue;
    if (solved.minFlips < desiredMinPar || solved.minFlips > desiredMaxPar) {
      continue;
    }

    const title =
      DAILY_TITLES[(puzzleNumber - 1) % DAILY_TITLES.length] ?? 'Prism Relay';
    const difficulty: DailyPuzzle['difficulty'] =
      solved.minFlips <= 3
        ? 'Warmup'
        : solved.minFlips <= 5
          ? 'Standard'
          : 'Challenging';

    return {
      dateKey,
      puzzleNumber,
      title,
      difficulty,
      size,
      par: solved.minFlips,
      grid: scrambled,
      solutionOrientations: solved.solutionOrientations,
    };
  }

  // Deterministic guaranteed fallback board (never reached in practice, proven solvable in 3 moves)
  return buildFallbackBoard(puzzleNumber, dateKey);
};

const buildFallbackBoard = (
  puzzleNumber: number,
  dateKey: string
): DailyPuzzle => {
  const grid = makeEmptyGrid(GRID_SIZE);
  const r0 = grid[0];
  const r1 = grid[1];
  const r2 = grid[2];
  const r4 = grid[4];
  const r5 = grid[5];
  if (r0 && r1 && r2 && r4 && r5) {
    r0[1] = { kind: 'emitter', row: 0, col: 1, dir: 'S', color: 1 };
    r2[5] = { kind: 'emitter', row: 2, col: 5, dir: 'W', color: 4 };
    r2[1] = { kind: 'splitter', row: 2, col: 1, orientation: 0 }; // solved: 1
    r2[3] = { kind: 'receptor', row: 2, col: 3, targetColor: 5 };
    r4[1] = { kind: 'mirror', row: 4, col: 1, orientation: 0 }; // solved: 1
    r4[4] = { kind: 'mirror', row: 4, col: 4, orientation: 1 }; // solved: 0
    r1[4] = { kind: 'receptor', row: 1, col: 4, targetColor: 1 };
  }
  const solved = solveMinimumFlips(grid);
  return {
    dateKey,
    puzzleNumber,
    title: 'Prism Relay Classic',
    difficulty: 'Warmup',
    size: GRID_SIZE,
    par: solved?.minFlips ?? 3,
    grid,
    solutionOrientations: solved?.solutionOrientations ?? {},
  };
};

const EPOCH_UTC_MS = Date.UTC(2026, 10, 1); // 2026-11-01 UTC => Puzzle #1

export const formatDateKeyUtc = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getPuzzleNumberForDateKey = (dateKey: string): number => {
  const parts = dateKey.split('-').map((p) => Number(p));
  const y = parts[0] ?? 2026;
  const m = (parts[1] ?? 11) - 1;
  const d = parts[2] ?? 1;
  const ms = Date.UTC(y, m, d);
  const diffDays = Math.floor((ms - EPOCH_UTC_MS) / 86_400_000);
  return Math.max(1, diffDays + 1);
};

export const getDateKeyForPuzzleNumber = (puzzleNumber: number): string => {
  const clamped = Math.max(1, Math.floor(puzzleNumber));
  const ms = EPOCH_UTC_MS + (clamped - 1) * 86_400_000;
  return formatDateKeyUtc(new Date(ms));
};

export const getDailyPuzzle = (dateKey: string): DailyPuzzle => {
  const puzzleNumber = getPuzzleNumberForDateKey(dateKey);
  return synthesizeVerifiedBoard(puzzleNumber, dateKey);
};

export const getHintCell = (
  currentGrid: GridCell[][],
  solutionOrientations: Record<string, MirrorOrientation>
): { row: number; col: number } | null => {
  for (let r = 0; r < currentGrid.length; r++) {
    const rowCells = currentGrid[r];
    if (!rowCells) continue;
    for (let c = 0; c < rowCells.length; c++) {
      const cell = rowCells[c];
      if (!cell || (cell.kind !== 'mirror' && cell.kind !== 'splitter')) {
        continue;
      }
      const target = solutionOrientations[cellKey(r, c)];
      if (target !== undefined && cell.orientation !== target) {
        return { row: r, col: c };
      }
    }
  }
  return null;
};

export const formatDuration = (ms: number): string => {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

export const buildSpoilerFreeShareText = (params: {
  puzzleNumber: number;
  title: string;
  moves: number;
  par: number;
  timeMs: number;
  streak: number;
  grid: GridCell[][];
}): string => {
  const trace = traceBeams(params.grid);
  const parBadge =
    params.moves <= params.par
      ? '⚡ PAR'
      : params.moves <= params.par + 2
        ? '✨ CLEAR'
        : '✅ SOLVED';

  const rows: string[] = [];
  for (let r = 0; r < params.grid.length; r++) {
    let line = '';
    for (let c = 0; c < params.grid.length; c++) {
      const cell = params.grid[r]?.[c];
      const mask = trace.cellColors[r]?.[c] ?? 0;
      if (!cell || cell.kind === 'block') {
        line += '⬛';
      } else if (cell.kind === 'receptor') {
        line += '💎';
      } else {
        line += COLOR_META[mask].emoji;
      }
    }
    rows.push(line);
  }

  const streakPart = params.streak > 1 ? ` · 🔥 ${params.streak}-day streak` : '';
  return [
    `Prism Relay #${params.puzzleNumber} — ${params.title}`,
    `${parBadge} · ${params.moves} moves (Par ${params.par}) · ⏱️ ${formatDuration(params.timeMs)}${streakPart}`,
    '',
    ...rows,
  ].join('\n');
};
