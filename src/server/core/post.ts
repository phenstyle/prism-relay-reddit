import { reddit } from '@devvit/web/server';
import {
  formatDateKeyUtc,
  getDailyPuzzle,
} from '../../shared/puzzleEngine';

export const createPost = async () => {
  const dateKey = formatDateKeyUtc(new Date());
  const puzzle = getDailyPuzzle(dateKey);
  return await reddit.submitCustomPost({
    title: `Prism Relay #${puzzle.puzzleNumber} — ${puzzle.title} (Daily Optical Puzzle)`,
  });
};
