import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildSpoilerFreeShareText,
  cellKey,
  cloneGrid,
  getDailyPuzzle,
  getDateKeyForPuzzleNumber,
  getHintCell,
  solveMinimumFlips,
  toggleTileAt,
  traceBeams,
} from '../shared/puzzleEngine.ts';

void describe('Prism Relay puzzleEngine', () => {
  void it('generates 30 consecutive deterministic, unsolved, color-mixing daily puzzles with exact par', () => {
    for (let num = 1; num <= 30; num++) {
      const dateKey = getDateKeyForPuzzleNumber(num);
      const puzzle = getDailyPuzzle(dateKey);
      assert.equal(puzzle.puzzleNumber, num);
      assert.equal(puzzle.dateKey, dateKey);
      assert.ok(puzzle.par >= 3, `Puzzle #${num} par too low: ${puzzle.par}`);

      const initialTrace = traceBeams(puzzle.grid);
      assert.equal(
        initialTrace.isSolved,
        false,
        `Puzzle #${num} must start unsolved`
      );

      const hasMixedReceptor = initialTrace.receptors.some(
        (rec) =>
          rec.targetColor === 3 ||
          rec.targetColor === 5 ||
          rec.targetColor === 6 ||
          rec.targetColor === 7
      );
      assert.equal(
        hasMixedReceptor,
        true,
        `Puzzle #${num} must require color mixing`
      );

      const openingHint = getHintCell(puzzle.grid, puzzle.solutionOrientations);
      assert.ok(openingHint, `Puzzle #${num} must provide an opening hint`);
      assert.ok(
        (initialTrace.cellColors[openingHint.row]?.[openingHint.col] ?? 0) !== 0,
        `Puzzle #${num} opening hint must be actively hit by a beam`
      );

      let working = cloneGrid(puzzle.grid);
      let flipsApplied = 0;
      for (let r = 0; r < working.length; r++) {
        for (let c = 0; c < working.length; c++) {
          const cell = working[r]?.[c];
          if (!cell || (cell.kind !== 'mirror' && cell.kind !== 'splitter')) {
            continue;
          }
          const target = puzzle.solutionOrientations[cellKey(r, c)];
          if (target !== undefined && cell.orientation !== target) {
            const next = toggleTileAt(working, r, c);
            if (!next) {
              assert.fail('toggleTileAt should succeed on rotatable tile');
            }
            working = next;
            flipsApplied += 1;
          }
        }
      }

      assert.equal(
        flipsApplied,
        puzzle.par,
        `Puzzle #${num} solution should match exact par (${puzzle.par})`
      );
      const solvedTrace = traceBeams(working);
      assert.equal(
        solvedTrace.isSolved,
        true,
        `Puzzle #${num} must be solved after applying solution flips`
      );
      for (let r = 0; r < working.length; r++) {
        for (let c = 0; c < working.length; c++) {
          const cell = working[r]?.[c];
          if (cell && (cell.kind === 'mirror' || cell.kind === 'splitter')) {
            assert.ok(
              (solvedTrace.cellColors[r]?.[c] ?? 0) !== 0,
              `Puzzle #${num} tile (${r},${c}) should not be an unused dead mirror`
            );
          }
        }
      }
    }
  });

  void it('provides accurate hints and terminates cleanly with zero infinite loops', () => {
    const puzzle = getDailyPuzzle('2026-11-22');
    const hint = getHintCell(puzzle.grid, puzzle.solutionOrientations);
    if (!hint) {
      assert.fail('Unsolved puzzle should return a misaligned hint cell');
    }

    const afterHint = toggleTileAt(puzzle.grid, hint.row, hint.col);
    if (!afterHint) {
      assert.fail('Hint cell must be rotatable');
    }
    const reSolved = solveMinimumFlips(afterHint);
    if (!reSolved) {
      assert.fail('Board after hint must remain solvable');
    }
    assert.equal(reSolved.minFlips, puzzle.par - 1);
  });

  void it('builds a clean spoiler-free Reddit comment share card', () => {
    const puzzle = getDailyPuzzle('2026-11-22');
    const text = buildSpoilerFreeShareText({
      puzzleNumber: puzzle.puzzleNumber,
      title: puzzle.title,
      moves: puzzle.par,
      par: puzzle.par,
      timeMs: 42_000,
      streak: 4,
      grid: puzzle.grid,
    });
    assert.ok(text.includes(`Prism Relay #${puzzle.puzzleNumber}`));
    assert.ok(text.includes('⚡ PAR'));
    assert.ok(text.includes('🔥 4-day streak'));
    assert.ok(text.includes('💎'));
  });

  void it('validates and auto-scrambles community UGC boards accurately', async () => {
    const { validateCustomGrid, autoScrambleCustomGrid } = await import(
      '../shared/puzzleEngine.ts'
    );
    const puzzle = getDailyPuzzle('2026-11-22');
    const check = validateCustomGrid(puzzle.grid);
    assert.equal(check.valid, true);
    if (check.valid) {
      assert.equal(check.par, puzzle.par);
    }

    // Solve the board first, verify validateCustomGrid rejects already-solved boards,
    // then verify autoScrambleCustomGrid produces a fresh unsolved valid board!
    let solvedGrid = cloneGrid(puzzle.grid);
    for (let r = 0; r < solvedGrid.length; r++) {
      for (let c = 0; c < solvedGrid.length; c++) {
        const cell = solvedGrid[r]?.[c];
        if (!cell || (cell.kind !== 'mirror' && cell.kind !== 'splitter')) {
          continue;
        }
        const target = puzzle.solutionOrientations[cellKey(r, c)];
        if (target !== undefined && cell.orientation !== target) {
          const next = toggleTileAt(solvedGrid, r, c);
          if (next) solvedGrid = next;
        }
      }
    }
    const alreadySolvedCheck = validateCustomGrid(solvedGrid);
    assert.equal(alreadySolvedCheck.valid, false);

    const scrambled = autoScrambleCustomGrid(solvedGrid);
    if (!scrambled) {
      assert.fail('autoScrambleCustomGrid should find a valid scrambled state');
    }
    const scrambledCheck = validateCustomGrid(scrambled.grid);
    assert.equal(scrambledCheck.valid, true);
  });
});

