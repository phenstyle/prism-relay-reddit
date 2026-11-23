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
};

export type SubmitSolveRequest = {
  dateKey: string;
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
