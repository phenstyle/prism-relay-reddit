import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type {
  CreateCustomPuzzleRequest,
  CreateCustomPuzzleResponse,
  CustomPuzzlePayload,
  DailyStats,
  InitResponse,
  LeaderboardEntry,
  PlayerDailyRecord,
  SubmitSolveRequest,
  SubmitSolveResponse,
} from '../../shared/api';
import {
  formatDateKeyUtc,
  getPuzzleNumberForDateKey,
  validateCustomGrid,
} from '../../shared/puzzleEngine';

type ErrorResponse = {
  status: 'error';
  message: string;
};

type StreakRecord = {
  streak: number;
  bestStreak: number;
  lastSolvedDate: string;
};

const SCORE_MOVE_WEIGHT = 1_000_000;
const MAX_TRACKED_TIME_MS = 999_999;

const encodeScore = (moves: number, timeMs: number): number =>
  moves * SCORE_MOVE_WEIGHT +
  Math.min(Math.max(0, Math.round(timeMs)), MAX_TRACKED_TIME_MS);

const decodeScore = (score: number): { moves: number; timeMs: number } => {
  const moves = Math.floor(score / SCORE_MOVE_WEIGHT);
  const timeMs = Math.max(0, Math.round(score - moves * SCORE_MOVE_WEIGHT));
  return { moves, timeMs };
};

const getYesterdayDateKey = (dateKey: string): string => {
  const parts = dateKey.split('-').map((p) => Number(p));
  const y = parts[0] ?? 2026;
  const m = (parts[1] ?? 11) - 1;
  const d = parts[2] ?? 1;
  const prevMs = Date.UTC(y, m, d) - 86_400_000;
  return formatDateKeyUtc(new Date(prevMs));
};

const parseJsonObject = <T>(raw: string | undefined): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const loadBoardStats = async (
  boardKey: string,
  dateKey: string
): Promise<DailyStats> => {
  const lbKey = `pr:lb:${boardKey}`;
  const distKey = `pr:dist:${boardKey}`;
  const parKey = `pr:par:${boardKey}`;

  const [topEntries, totalSolvers, rawDist, rawParCount] = await Promise.all([
    redis.zRange(lbKey, 0, 7, { by: 'rank' }),
    redis.zCard(lbKey),
    redis.hGetAll(distKey),
    redis.get(parKey),
  ]);

  const distribution: Record<string, number> = {};
  for (const [bucket, countStr] of Object.entries(rawDist)) {
    const parsed = Number.parseInt(countStr, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      distribution[bucket] = parsed;
    }
  }

  const leaderboard: LeaderboardEntry[] = topEntries.map((entry, idx) => {
    const decoded = decodeScore(entry.score);
    return {
      username: entry.member,
      moves: decoded.moves,
      timeMs: decoded.timeMs,
      rank: idx + 1,
    };
  });

  const parCount = rawParCount ? Number.parseInt(rawParCount, 10) || 0 : 0;

  return {
    dateKey,
    puzzleNumber: getPuzzleNumberForDateKey(dateKey),
    totalSolvers,
    parCount,
    distribution,
    leaderboard,
  };
};

export const api = new Hono();

api.get('/init', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'postId is required but missing from context' },
      400
    );
  }

  try {
    const dateKey = formatDateKeyUtc(new Date());
    const [usernameRaw, rawCustom] = await Promise.all([
      reddit.getCurrentUsername(),
      redis.get(`pr:custom:${postId}`),
    ]);
    const username = usernameRaw ?? 'guest';
    const customPuzzle = parseJsonObject<CustomPuzzlePayload>(rawCustom);
    const boardKey = customPuzzle ? `custom:${postId}` : dateKey;

    const playerRecordKey = `pr:rec:${boardKey}:${username}`;
    const streakKey = `pr:streak:${username}`;

    const [rawRecord, rawStreak, stats] = await Promise.all([
      redis.get(playerRecordKey),
      redis.get(streakKey),
      loadBoardStats(boardKey, dateKey),
    ]);

    const playerRecord = parseJsonObject<PlayerDailyRecord>(rawRecord);
    const streakData = parseJsonObject<StreakRecord>(rawStreak);

    const yesterdayKey = getYesterdayDateKey(dateKey);
    const activeStreak =
      streakData &&
      (streakData.lastSolvedDate === dateKey ||
        streakData.lastSolvedDate === yesterdayKey)
        ? streakData.streak
        : 0;

    return c.json<InitResponse>({
      type: 'init',
      postId,
      username,
      dateKey,
      puzzleNumber: stats.puzzleNumber,
      streak: activeStreak,
      bestStreak: streakData?.bestStreak ?? activeStreak,
      playerRecord,
      stats,
      customPuzzle,
    });
  } catch (error) {
    console.error(`Prism Relay init error for post ${postId}:`, error);
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to initialize game',
      },
      500
    );
  }
});

api.post('/submit', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'postId is required' },
      400
    );
  }

  try {
    const body = await c.req.json<SubmitSolveRequest>();
    const dateKey =
      typeof body.dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dateKey)
        ? body.dateKey
        : formatDateKeyUtc(new Date());
    const boardKey =
      typeof body.boardKey === 'string' && body.boardKey.startsWith('custom:')
        ? body.boardKey
        : dateKey;
    const isCustomBoard = boardKey.startsWith('custom:');

    const moves = Math.max(1, Math.min(999, Math.round(Number(body.moves) || 1)));
    const timeMs = Math.max(
      100,
      Math.min(MAX_TRACKED_TIME_MS, Math.round(Number(body.timeMs) || 1000))
    );
    const par = Math.max(1, Math.min(50, Math.round(Number(body.par) || 3)));

    const username = (await reddit.getCurrentUsername()) ?? 'guest';
    const playerRecordKey = `pr:rec:${boardKey}:${username}`;
    const streakKey = `pr:streak:${username}`;
    const lbKey = `pr:lb:${boardKey}`;
    const distKey = `pr:dist:${boardKey}`;
    const parKey = `pr:par:${boardKey}`;

    const [rawExisting, rawStreak] = await Promise.all([
      redis.get(playerRecordKey),
      redis.get(streakKey),
    ]);

    const existing = parseJsonObject<PlayerDailyRecord>(rawExisting);
    const newScore = encodeScore(moves, timeMs);
    const existingScore = existing
      ? encodeScore(existing.moves, existing.timeMs)
      : Number.POSITIVE_INFINITY;
    const isFirstSolve = !existing;
    const isNewBest = newScore < existingScore;

    const finalRecord: PlayerDailyRecord = isNewBest
      ? { moves, timeMs, solvedAt: new Date().toISOString() }
      : existing ?? { moves, timeMs, solvedAt: new Date().toISOString() };

    if (isNewBest) {
      await Promise.all([
        redis.set(playerRecordKey, JSON.stringify(finalRecord)),
        redis.zAdd(lbKey, { member: username, score: newScore }),
      ]);
    }

    if (isFirstSolve) {
      const bucket = moves <= par ? 'par' : moves <= par + 2 ? 'near' : 'over';
      await redis.hIncrBy(distKey, bucket, 1);
      if (moves <= par) {
        await redis.incrBy(parKey, 1);
      }
    }

    // Update daily streak on daily solves
    const prevStreak = parseJsonObject<StreakRecord>(rawStreak);
    const yesterdayKey = getYesterdayDateKey(dateKey);
    let nextStreak = prevStreak?.streak ?? 0;
    let nextBest = prevStreak?.bestStreak ?? 0;

    if (!isCustomBoard && (!prevStreak || prevStreak.lastSolvedDate !== dateKey)) {
      nextStreak =
        prevStreak && prevStreak.lastSolvedDate === yesterdayKey
          ? prevStreak.streak + 1
          : 1;
      nextBest = Math.max(nextBest, nextStreak);
      await redis.set(
        streakKey,
        JSON.stringify({
          streak: nextStreak,
          bestStreak: nextBest,
          lastSolvedDate: dateKey,
        })
      );
    }

    const [stats, rank] = await Promise.all([
      loadBoardStats(boardKey, dateKey),
      redis.zRank(lbKey, username),
    ]);

    const total = Math.max(1, stats.totalSolvers);
    const effectiveRank = rank !== undefined ? rank + 1 : total;
    const percentile = Math.max(
      1,
      Math.min(100, Math.round((effectiveRank / total) * 100))
    );

    return c.json<SubmitSolveResponse>({
      type: 'submit',
      saved: true,
      isNewBest,
      streak: nextStreak,
      bestStreak: nextBest,
      percentile,
      playerRecord: finalRecord,
      stats,
    });
  } catch (error) {
    console.error(`Prism Relay submit error for post ${postId}:`, error);
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to record score',
      },
      500
    );
  }
});

api.post('/custom-puzzle', async (c) => {
  const { subredditName } = context;
  if (!subredditName) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'subredditName is required' },
      400
    );
  }

  try {
    const body = await c.req.json<CreateCustomPuzzleRequest>();
    const rawTitle =
      typeof body.title === 'string' ? body.title.trim() : '';
    const title = rawTitle.slice(0, 48) || 'Atelier Challenge';

    const validation = validateCustomGrid(body.grid);
    if (!validation.valid) {
      return c.json<ErrorResponse>(
        { status: 'error', message: validation.reason },
        400
      );
    }

    const author = (await reddit.getCurrentUsername()) ?? 'redditor';
    const post = await reddit.submitCustomPost({
      title: `Prism Relay [Community]: ${title} — by u/${author} (Par ${validation.par})`,
    });

    const payload: CustomPuzzlePayload = {
      id: post.id,
      title,
      author,
      par: validation.par,
      grid: body.grid,
      solutionOrientations: validation.solutionOrientations,
      createdAt: new Date().toISOString(),
    };

    await redis.set(`pr:custom:${post.id}`, JSON.stringify(payload));

    return c.json<CreateCustomPuzzleResponse>({
      type: 'custom-created',
      postId: post.id,
      postUrl: `https://www.reddit.com/r/${subredditName}/comments/${post.id}`,
      par: validation.par,
      title,
    });
  } catch (error) {
    console.error('Prism Relay custom-puzzle error:', error);
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to publish community puzzle',
      },
      500
    );
  }
});
