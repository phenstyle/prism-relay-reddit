import type { GridCell, MirrorOrientation } from './puzzleEngine';

export type LeaderboardEntry = {
  username: string;
  moves: number;
  timeMs: number;
  rank: number;
};

export type PlayerDailyRecord = {
  moves: number;
  timeMs: number;
  solvedAt: string;
};

export type CustomPuzzlePayload = {
  id: string;
  title: string;
  author: string;
  par: number;
  grid: GridCell[][];
  solutionOrientations: Record<string, MirrorOrientation>;
  createdAt: string;
};

export type DailyStats = {
  dateKey: string;
  puzzleNumber: number;
  totalSolvers: number;
  parCount: number;
  distribution: Record<string, number>;
  leaderboard: LeaderboardEntry[];
};

export type InitResponse = {
  type: 'init';
  postId: string;
  username: string;
  dateKey: string;
  puzzleNumber: number;
  streak: number;
  bestStreak: number;
  playerRecord: PlayerDailyRecord | null;
  stats: DailyStats;
  customPuzzle: CustomPuzzlePayload | null;
};

export type SubmitSolveRequest = {
  dateKey: string;
  boardKey?: string;
  moves: number;
  timeMs: number;
  par: number;
};

export type SubmitSolveResponse = {
  type: 'submit';
  saved: boolean;
  isNewBest: boolean;
  streak: number;
  bestStreak: number;
  percentile: number;
  playerRecord: PlayerDailyRecord;
  stats: DailyStats;
};

export type CreateCustomPuzzleRequest = {
  title: string;
  grid: GridCell[][];
};

export type CreateCustomPuzzleResponse = {
  type: 'custom-created';
  postId: string;
  postUrl: string;
  par: number;
  title: string;
};
