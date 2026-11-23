export type Audience = "mz" | "senior" | "family";
export type Level = "원활" | "보통" | "혼잡" | "만차";

export interface HourPoint {
  h: number;
  occ: number;
  cars: number;
  level: Level;
}

export interface Show {
  id: string;
  title: string;
  venue: string;
  date: string;
  start: string;
  runtime: number;
  genre: string;
  audience: Audience;
  capacity: number;
  weather: { temp: number; sky: string; precip: boolean };
  forecast: { hours: HourPoint[] };
  reco: {
    carArrive: string | null;
    fullAt: string | null;
    transitTip: string;
    bestGate: string;
    exits: { leaveMin: number; waitMin: number }[];
    expectedCars: number;
    overflowCars: number;
  };
}

export interface ShowData {
  generatedAt: string;
  source: "sample" | "model";
  calibration?: {
    source: string;
    records: number;
    maxConcurrent: number;
    exitThroughputPerHour: number;
    normalDailyPeakMedian: number;
  };
  gates: Record<string, number>;
  shows: Show[];
}

/** 사용자가 고른 관람 모드 */
export type Mode = "mz" | "senior" | "family";
