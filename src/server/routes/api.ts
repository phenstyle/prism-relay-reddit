import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type {
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
  moves * SCORE_MOVE_WEIGHT + Math.min(Math.max(0, Math.round(timeMs)), MAX_TRACKED_TIME_MS);

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

const loadDailyStats = async (dateKey: string): Promise<DailyStats> => {
  const lbKey = `pr:lb:${dateKey}`;
  const distKey = `pr:dist:${dateKey}`;
  const parKey = `pr:par:${dateKey}`;

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
    const username = (await reddit.getCurrentUsername()) ?? 'guest';

    const playerRecordKey = `pr:rec:${dateKey}:${username}`;
    const streakKey = `pr:streak:${username}`;

    const [rawRecord, rawStreak, stats] = await Promise.all([
      redis.get(playerRecordKey),
      redis.get(streakKey),
      loadDailyStats(dateKey),
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
    const moves = Math.max(1, Math.min(999, Math.round(Number(body.moves) || 1)));
    const timeMs = Math.max(
      100,
      Math.min(MAX_TRACKED_TIME_MS, Math.round(Number(body.timeMs) || 1000))
    );
    const par = Math.max(1, Math.min(50, Math.round(Number(body.par) || 3)));

    const username = (await reddit.getCurrentUsername()) ?? 'guest';
    const playerRecordKey = `pr:rec:${dateKey}:${username}`;
    const streakKey = `pr:streak:${username}`;
    const lbKey = `pr:lb:${dateKey}`;
    const distKey = `pr:dist:${dateKey}`;
    const parKey = `pr:par:${dateKey}`;

    const [rawExisting, rawStreak] = await Promise.all([
      redis.get(playerRecordKey),
      redis.get(streakKey),
    ]);

    const existing = parseJsonObject<PlayerDailyRecord>(rawExisting);
    const newScore = encodeScore(moves, timeMs);
    const existingScore = existing
      ? encodeScore(existing.moves, existing.timeMs)
      : Number.POSITIVE_INFINITY;
    const isFirstSolveToday = !existing;
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

    if (isFirstSolveToday) {
      const bucket = moves <= par ? 'par' : moves <= par + 2 ? 'near' : 'over';
      await redis.hIncrBy(distKey, bucket, 1);
      if (moves <= par) {
        await redis.incrBy(parKey, 1);
      }
    }

    // Update daily streak once per day
    const prevStreak = parseJsonObject<StreakRecord>(rawStreak);
    const yesterdayKey = getYesterdayDateKey(dateKey);
    let nextStreak = prevStreak?.streak ?? 0;
    let nextBest = prevStreak?.bestStreak ?? 0;

    if (!prevStreak || prevStreak.lastSolvedDate !== dateKey) {
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
      loadDailyStats(dateKey),
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
