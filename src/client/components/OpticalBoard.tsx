import type {
  BeamSegment,
  Direction,
  GridCell,
  TraceResult,
} from '../../shared/puzzleEngine';
import { COLOR_META } from '../../shared/puzzleEngine';

type OpticalBoardProps = {
  grid: GridCell[][];
  trace: TraceResult;
  interactive: boolean;
  editorMode?: boolean;
  hintCell?: { row: number; col: number } | null;
  onboardingCell?: { row: number; col: number } | null;
  onTileTap?: (row: number, col: number) => void;
};

const CELL_UNIT = 100;

const centerOf = (index: number): number => index * CELL_UNIT + CELL_UNIT / 2;

const dirArrowPoints = (dir: Direction, cx: number, cy: number): string => {
  if (dir === 'N')
    return `${cx},${cy - 26} ${cx - 12},${cy - 8} ${cx + 12},${cy - 8}`;
  if (dir === 'S')
    return `${cx},${cy + 26} ${cx - 12},${cy + 8} ${cx + 12},${cy + 8}`;
  if (dir === 'E')
    return `${cx + 26},${cy} ${cx + 8},${cy - 12} ${cx + 8},${cy + 12}`;
  return `${cx - 26},${cy} ${cx - 8},${cy - 12} ${cx - 8},${cy + 12}`;
};

const buildBeamStrokeColor = (
  seg: BeamSegment,
  cellColors: TraceResult['cellColors']
): string => {
  const fromMask = cellColors[seg.fromRow]?.[seg.fromCol] ?? seg.color;
  const toMask = cellColors[seg.toRow]?.[seg.toCol] ?? seg.color;
  const shared = fromMask & toMask;
  if (shared === 3) return COLOR_META[3].hex;
  if (shared === 5) return COLOR_META[5].hex;
  if (shared === 6) return COLOR_META[6].hex;
  if (shared === 7) return COLOR_META[7].hex;
  return COLOR_META[seg.color].hex;
};

export const OpticalBoard = ({
  grid,
  trace,
  interactive,
  editorMode = false,
  hintCell,
  onboardingCell,
  onTileTap,
}: OpticalBoardProps) => {
  const size = grid.length;
  const viewBoxSize = size * CELL_UNIT;

  const receptorMap = new Map<string, TraceResult['receptors'][number]>();
  for (const rec of trace.receptors) {
    receptorMap.set(`${rec.row},${rec.col}`, rec);
  }

  return (
    <div className="relative w-full aspect-square max-w-[412px] mx-auto select-none rounded-[20px] bg-gradient-to-b from-[#2b2520] to-[#1a1613] border-2 border-[#b8893a]/80 shadow-[0_18px_40px_rgba(28,25,23,0.28),inset_0_1px_0_rgba(245,215,150,0.35)] p-2.5">
      {/* Subtle brass corner pins */}
      <span className="pointer-events-none absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-[#d4a957]/80" />
      <span className="pointer-events-none absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#d4a957]/80" />
      <span className="pointer-events-none absolute bottom-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-[#d4a957]/80" />
      <span className="pointer-events-none absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#d4a957]/80" />

      {/* Optical slate stage + luminous SVG rays */}
      <svg
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        className="w-full h-full block rounded-xl bg-[#131110]"
        role="img"
        aria-label="Prism Relay 6 by 6 optical board"
      >
        <defs>
          <filter id="beam-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="brass-bevel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e5c17a" />
            <stop offset="50%" stopColor="#b8893a" />
            <stop offset="100%" stopColor="#7c5b22" />
          </linearGradient>
        </defs>

        {/* Base inlaid slate tiles */}
        {grid.map((rowCells, r) =>
          rowCells.map((cell, c) => {
            const x = c * CELL_UNIT;
            const y = r * CELL_UNIT;
            const isRotatable =
              (cell.kind === 'mirror' || cell.kind === 'splitter') &&
              cell.locked !== true;
            const isHint = hintCell?.row === r && hintCell?.col === c;
            const isOnboard =
              onboardingCell?.row === r && onboardingCell?.col === c;

            return (
              <g key={`tile-${r}-${c}`}>
                <rect
                  x={x + 4}
                  y={y + 4}
                  width={CELL_UNIT - 8}
                  height={CELL_UNIT - 8}
                  rx={12}
                  fill={
                    cell.kind === 'block'
                      ? '#27221f'
                      : isRotatable
                        ? '#1f1b18'
                        : '#171412'
                  }
                  stroke={
                    isHint
                      ? '#f59e0b'
                      : isOnboard
                        ? '#38bdf8'
                        : isRotatable
                          ? '#443c35'
                          : '#26211d'
                  }
                  strokeWidth={isHint || isOnboard ? 3 : 1.5}
                />
                {cell.kind === 'block' ? (
                  <g>
                    <rect
                      x={x + 17}
                      y={y + 17}
                      width={CELL_UNIT - 34}
                      height={CELL_UNIT - 34}
                      rx={8}
                      fill="#141210"
                      stroke="#574d44"
                      strokeWidth={2}
                    />
                    <line
                      x1={x + 26}
                      y1={y + 26}
                      x2={x + CELL_UNIT - 26}
                      y2={y + CELL_UNIT - 26}
                      stroke="#3d3630"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                    />
                    <line
                      x1={x + CELL_UNIT - 26}
                      y1={y + 26}
                      x2={x + 26}
                      y2={y + CELL_UNIT - 26}
                      stroke="#3d3630"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                    />
                  </g>
                ) : null}
              </g>
            );
          })
        )}

        {/* Luminous animated laser beams */}
        <g filter="url(#beam-glow)" opacity={0.96}>
          {trace.segments.map((seg, idx) => {
            const x1 = centerOf(seg.fromCol);
            const y1 = centerOf(seg.fromRow);
            const x2 = centerOf(seg.toCol);
            const y2 = centerOf(seg.toRow);
            const colorHex = buildBeamStrokeColor(seg, trace.cellColors);
            return (
              <g key={`seg-${idx}`}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={colorHex}
                  strokeWidth={11}
                  strokeLinecap="round"
                  opacity={0.45}
                />
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={colorHex}
                  strokeWidth={4.5}
                  strokeLinecap="round"
                  opacity={0.92}
                />
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#fffdf7"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  className="beam-flow"
                  opacity={0.9}
                />
              </g>
            );
          })}
        </g>

        {/* Emitters, faceted receptors, brass mirrors & splitters */}
        {grid.map((rowCells, r) =>
          rowCells.map((cell, c) => {
            const cx = centerOf(c);
            const cy = centerOf(r);

            if (cell.kind === 'emitter') {
              const meta = COLOR_META[cell.color];
              return (
                <g key={`el-${r}-${c}`}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={31}
                    fill="#1c1815"
                    stroke="url(#brass-bevel)"
                    strokeWidth={3.5}
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={24}
                    fill="#12100e"
                    stroke={meta.hex}
                    strokeWidth={2.5}
                  />
                  <polygon
                    points={dirArrowPoints(cell.dir, cx, cy)}
                    fill={meta.hex}
                  />
                  <text
                    x={cx}
                    y={cy + 6}
                    textAnchor="middle"
                    fontSize={15}
                    fontWeight={800}
                    fill="#fffdf7"
                  >
                    {meta.symbol}
                  </text>
                </g>
              );
            }

            if (cell.kind === 'receptor') {
              const status = receptorMap.get(`${r},${c}`);
              const meta = COLOR_META[cell.targetColor];
              const matched = status?.matched === true;
              const overmixed = status?.overmixed === true;
              return (
                <g key={`el-${r}-${c}`}>
                  {matched ? (
                    <polygon
                      points={`${cx},${cy - 39} ${cx + 37},${cy} ${cx},${cy + 39} ${cx - 37},${cy}`}
                      fill="none"
                      stroke={meta.hex}
                      strokeWidth={2.5}
                      className="crystal-ring"
                    />
                  ) : null}
                  <polygon
                    points={`${cx},${cy - 33} ${cx + 31},${cy} ${cx},${cy + 33} ${cx - 31},${cy}`}
                    fill={matched ? meta.hex : '#151210'}
                    fillOpacity={matched ? 0.34 : 0.96}
                    stroke={overmixed ? '#ef4444' : meta.hex}
                    strokeWidth={matched ? 4.5 : 3}
                    strokeDasharray={overmixed ? '6 4' : undefined}
                  />
                  <polygon
                    points={`${cx},${cy - 20} ${cx + 18},${cy} ${cx},${cy + 20} ${cx - 18},${cy}`}
                    fill={matched ? meta.hex : 'transparent'}
                    stroke={meta.hex}
                    strokeWidth={2}
                  />
                  <text
                    x={cx}
                    y={cy + 6}
                    textAnchor="middle"
                    fontSize={16}
                    fontWeight={800}
                    fill={matched ? '#141210' : meta.hex}
                  >
                    {meta.symbol}
                  </text>
                  {matched ? (
                    <circle
                      cx={cx + 24}
                      cy={cy - 24}
                      r={9}
                      fill="#10b981"
                      stroke="#141210"
                      strokeWidth={2}
                    />
                  ) : null}
                </g>
              );
            }

            if (cell.kind === 'mirror') {
              const angle = cell.orientation === 0 ? -45 : 45;
              const litMask = trace.cellColors[r]?.[c] ?? 0;
              const accent = litMask !== 0 ? COLOR_META[litMask].hex : '#e5c17a';
              return (
                <g
                  key={`el-${r}-${c}`}
                  transform={`rotate(${angle} ${cx} ${cy})`}
                  style={{ transition: 'transform 140ms cubic-bezier(0.22, 1, 0.36, 1)' }}
                >
                  <rect
                    x={cx - 35}
                    y={cy - 6}
                    width={70}
                    height={12}
                    rx={6}
                    fill="#2e2721"
                    stroke={accent}
                    strokeWidth={2.5}
                  />
                  <line
                    x1={cx - 26}
                    y1={cy}
                    x2={cx + 26}
                    y2={cy}
                    stroke="#fffdf7"
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                  <circle cx={cx} cy={cy} r={4.5} fill="url(#brass-bevel)" />
                </g>
              );
            }

            if (cell.kind === 'splitter') {
              const angle = cell.orientation === 0 ? -45 : 45;
              const litMask = trace.cellColors[r]?.[c] ?? 0;
              const accent = litMask !== 0 ? COLOR_META[litMask].hex : '#e5c17a';
              return (
                <g
                  key={`el-${r}-${c}`}
                  transform={`rotate(${angle} ${cx} ${cy})`}
                  style={{ transition: 'transform 140ms cubic-bezier(0.22, 1, 0.36, 1)' }}
                >
                  <rect
                    x={cx - 31}
                    y={cy - 10}
                    width={62}
                    height={20}
                    rx={10}
                    fill="#26201a"
                    fillOpacity={0.78}
                    stroke={accent}
                    strokeWidth={2.5}
                    strokeDasharray="7 4"
                  />
                  <polygon
                    points={`${cx},${cy - 8} ${cx + 8},${cy} ${cx},${cy + 8} ${cx - 8},${cy}`}
                    fill={accent}
                  />
                </g>
              );
            }

            return null;
          })
        )}
      </svg>

      {/* Accessible interactive hit targets */}
      {interactive ? (
        <div
          className="absolute inset-2.5 grid"
          style={{
            gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
          }}
        >
          {grid.map((rowCells, r) =>
            rowCells.map((cell, c) => {
              const isRotatable =
                (cell.kind === 'mirror' || cell.kind === 'splitter') &&
                cell.locked !== true;
              const isTappable = editorMode || isRotatable;
              const isHint = hintCell?.row === r && hintCell?.col === c;
              const isOnboard =
                onboardingCell?.row === r && onboardingCell?.col === c;

              if (!isTappable) {
                return (
                  <div key={`hit-${r}-${c}`} className="pointer-events-none" />
                );
              }

              const kindLabel =
                editorMode
                  ? `Edit cell row ${r + 1}, column ${c + 1}`
                  : `Rotate ${cell.kind === 'splitter' ? 'beam splitter' : 'mirror'} at row ${r + 1}, column ${c + 1}`;
              return (
                <button
                  key={`hit-${r}-${c}`}
                  type="button"
                  onClick={() => onTileTap?.(r, c)}
                  aria-label={kindLabel}
                  className={`relative rounded-xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-95 transition-transform ${
                    isHint
                      ? 'ring-2 ring-amber-400 animate-pulse'
                      : isOnboard
                        ? 'ring-2 ring-sky-400/90 animate-pulse'
                        : 'hover:bg-white/5'
                  }`}
                >
                  {isOnboard ? (
                    <span className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-stone-950 shadow">
                      TAP
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
};
