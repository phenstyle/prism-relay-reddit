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
  hintCell?: { row: number; col: number } | null;
  onboardingCell?: { row: number; col: number } | null;
  onTileTap?: (row: number, col: number) => void;
};

const CELL_UNIT = 100;

const centerOf = (index: number): number => index * CELL_UNIT + CELL_UNIT / 2;

const dirArrowPoints = (dir: Direction, cx: number, cy: number): string => {
  if (dir === 'N') return `${cx},${cy - 22} ${cx - 12},${cy - 4} ${cx + 12},${cy - 4}`;
  if (dir === 'S') return `${cx},${cy + 22} ${cx - 12},${cy + 4} ${cx + 12},${cy + 4}`;
  if (dir === 'E') return `${cx + 22},${cy} ${cx + 4},${cy - 12} ${cx + 4},${cy + 12}`;
  return `${cx - 22},${cy} ${cx - 4},${cy - 12} ${cx - 4},${cy + 12}`;
};

const buildBeamStrokeColor = (seg: BeamSegment, cellColors: TraceResult['cellColors']): string => {
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
    <div className="relative w-full aspect-square max-w-[420px] mx-auto select-none rounded-2xl bg-[#0f172a] border border-slate-700/80 shadow-[0_20px_50px_rgba(0,0,0,0.65)] p-2">
      {/* Subtle optical workbench grid + SVG laser overlay */}
      <svg
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        className="w-full h-full block rounded-xl bg-[#0b1120]"
        role="img"
        aria-label="Prism Relay 6 by 6 optical board"
      >
        <defs>
          <filter id="beam-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Base cell tiles */}
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
                  rx={14}
                  fill={
                    cell.kind === 'block'
                      ? '#1e293b'
                      : isRotatable
                        ? '#131d35'
                        : '#0e1628'
                  }
                  stroke={
                    isHint
                      ? '#fbbf24'
                      : isOnboard
                        ? '#38bdf8'
                        : isRotatable
                          ? '#334155'
                          : '#1e293b'
                  }
                  strokeWidth={isHint || isOnboard ? 3 : 1.5}
                />
                {cell.kind === 'block' ? (
                  <g>
                    <rect
                      x={x + 18}
                      y={y + 18}
                      width={CELL_UNIT - 36}
                      height={CELL_UNIT - 36}
                      rx={8}
                      fill="#0f172a"
                      stroke="#475569"
                      strokeWidth={2}
                    />
                    <line
                      x1={x + 26}
                      y1={y + 26}
                      x2={x + CELL_UNIT - 26}
                      y2={y + CELL_UNIT - 26}
                      stroke="#334155"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                    />
                    <line
                      x1={x + CELL_UNIT - 26}
                      y1={y + 26}
                      x2={x + 26}
                      y2={y + CELL_UNIT - 26}
                      stroke="#334155"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                    />
                  </g>
                ) : null}
              </g>
            );
          })
        )}

        {/* Luminous laser beams */}
        <g filter="url(#beam-glow)" opacity={0.95}>
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
                  stroke="#ffffff"
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  opacity={0.9}
                />
              </g>
            );
          })}
        </g>

        {/* Emitters, receptors, mirrors, splitters */}
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
                    r={30}
                    fill="#0f172a"
                    stroke={meta.hex}
                    strokeWidth={4}
                  />
                  <polygon
                    points={dirArrowPoints(cell.dir, cx, cy)}
                    fill={meta.hex}
                  />
                  <text
                    x={cx}
                    y={cy + 6}
                    textAnchor="middle"
                    fontSize={16}
                    fontWeight={700}
                    fill="#ffffff"
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
                  <polygon
                    points={`${cx},${cy - 33} ${cx + 31},${cy} ${cx},${cy + 33} ${cx - 31},${cy}`}
                    fill={matched ? meta.hex : '#0b1222'}
                    fillOpacity={matched ? 0.32 : 0.95}
                    stroke={overmixed ? '#ef4444' : meta.hex}
                    strokeWidth={matched ? 5 : 3.5}
                    strokeDasharray={overmixed ? '6 4' : undefined}
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={16}
                    fill={matched ? meta.hex : 'transparent'}
                    stroke={meta.hex}
                    strokeWidth={2.5}
                  />
                  <text
                    x={cx}
                    y={cy + 6}
                    textAnchor="middle"
                    fontSize={18}
                    fontWeight={800}
                    fill={matched ? '#0b101b' : meta.hex}
                  >
                    {meta.symbol}
                  </text>
                  {matched ? (
                    <circle
                      cx={cx + 24}
                      cy={cy - 24}
                      r={9}
                      fill="#10b981"
                      stroke="#0b1120"
                      strokeWidth={2}
                    />
                  ) : null}
                </g>
              );
            }

            if (cell.kind === 'mirror') {
              const angle = cell.orientation === 0 ? -45 : 45;
              const litMask = trace.cellColors[r]?.[c] ?? 0;
              const accent = litMask !== 0 ? COLOR_META[litMask].hex : '#cbd5e1';
              return (
                <g
                  key={`el-${r}-${c}`}
                  transform={`rotate(${angle} ${cx} ${cy})`}
                  style={{ transition: 'transform 140ms ease-out' }}
                >
                  <rect
                    x={cx - 34}
                    y={cy - 6}
                    width={68}
                    height={12}
                    rx={6}
                    fill="#334155"
                    stroke={accent}
                    strokeWidth={2.5}
                  />
                  <line
                    x1={cx - 26}
                    y1={cy}
                    x2={cx + 26}
                    y2={cy}
                    stroke="#f8fafc"
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                </g>
              );
            }

            if (cell.kind === 'splitter') {
              const angle = cell.orientation === 0 ? -45 : 45;
              const litMask = trace.cellColors[r]?.[c] ?? 0;
              const accent = litMask !== 0 ? COLOR_META[litMask].hex : '#fbbf24';
              return (
                <g
                  key={`el-${r}-${c}`}
                  transform={`rotate(${angle} ${cx} ${cy})`}
                  style={{ transition: 'transform 140ms ease-out' }}
                >
                  <rect
                    x={cx - 30}
                    y={cy - 10}
                    width={60}
                    height={20}
                    rx={10}
                    fill="#1e293b"
                    fillOpacity={0.7}
                    stroke={accent}
                    strokeWidth={2.5}
                    strokeDasharray="8 4"
                  />
                  <circle cx={cx} cy={cy} r={6} fill={accent} />
                </g>
              );
            }

            return null;
          })
        )}
      </svg>

      {/* Accessible interactive hit targets layered cleanly over rotatable cells */}
      {interactive ? (
        <div
          className="absolute inset-2 grid"
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
              const isHint = hintCell?.row === r && hintCell?.col === c;
              const isOnboard =
                onboardingCell?.row === r && onboardingCell?.col === c;

              if (!isRotatable) {
                return <div key={`hit-${r}-${c}`} className="pointer-events-none" />;
              }

              const kindLabel = cell.kind === 'splitter' ? 'beam splitter' : 'mirror';
              const orientLabel = cell.orientation === 0 ? 'slash' : 'backslash';
              return (
                <button
                  key={`hit-${r}-${c}`}
                  type="button"
                  onClick={() => onTileTap?.(r, c)}
                  aria-label={`Rotate ${kindLabel} at row ${r + 1}, column ${c + 1} (currently ${orientLabel})`}
                  className={`relative rounded-xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-95 transition-transform ${
                    isHint
                      ? 'ring-2 ring-amber-400 animate-pulse'
                      : isOnboard
                        ? 'ring-2 ring-sky-400/90 animate-pulse'
                        : 'hover:bg-white/5'
                  }`}
                >
                  {isOnboard ? (
                    <span className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-sky-500 px-1.5 py-0.5 text-[10px] font-bold text-slate-950 shadow">
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
