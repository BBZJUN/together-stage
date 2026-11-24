export type Audience = "mz" | "senior" | "family";
export type Level = "원활" | "보통" | "혼잡" | "만차";

export interface HourPoint {
  h: number;
  occ: number;
  /** 위쪽 범위(90% 분위수 모델) 점유율 — 붐빌 수 있는 최대치 */
  hi?: number;
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
  weather: { temp: number; sky: string | null; precip: boolean; source?: string };
  /** 올림픽공원 공식 일정안내 원문 정보 (실제 공연일 때만) */
  official?: { url: string; poster: string; age: string; price: string; host: string; contact: string; time_text: string; runDates?: (string | null)[]; moreCount?: number };
  forecast: { hours: HourPoint[] };
  reco: {
    carArrive: string | null;
    fullAt: string | null;
    transitTip: string;
    bestGate: string;
    exits: { leaveMin: number; waitMin: number }[];
    expectedCars: number;
    overflowCars: number;
    /** 위쪽 범위 피크가 2,800대 이상 → '붐빌 수 있는 날' */
    busyDay?: boolean;
  };
}

export interface ShowData {
  generatedAt: string;
  source: "sample" | "model" | "official";
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
