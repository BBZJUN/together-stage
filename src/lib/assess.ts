/**
 * 무대 접근성 사전 점검 (기획사·기관용)
 * 무대 배치를 넣으면 KSPO DOME 실측 형상(실감형 콘텐츠) 위에서 모든 좌석의 시야를 계산해
 * 시야제한석·휠체어석 시야·단상 권고를 만든다.
 */
import {
  blockOf,
  generateSeats,
  seatVisibility,
  stageObstacles,
  stageTargets,
  type BlockCause,
  type Seat,
  type StageConfig,
} from "./venue";

export interface AssessOptions {
  /** 관객이 일어서서 보는 공연인지 (콘서트) */
  standing: boolean;
  /** 휠체어석 단상 높이(m) */
  platform: number;
}

export interface SeatResult {
  seat: Seat;
  ratio: number;
  cause: BlockCause | null;
}

export interface SectionRow {
  tier: string;
  section: string;
  block: string;
  seats: number;
  /** 시야제한석: 무대 장치·스피커·구조물 때문에 60% 미만 */
  limited: number;
  /** 앞사람이 일어서서 60% 미만 (스탠딩 플로어 제외) */
  crowd: number;
  avg: number;
  cause: BlockCause | null;
}

export interface Assessment {
  stage: StageConfig;
  opts: AssessOptions;
  results: SeatResult[];
  sections: SectionRow[];
  total: number;
  limited: number;
  crowd: number;
  wheel: { n: number; avg: number; poor: number; avgWithPlatform: number; poorWithPlatform: number; needPlatform: SeatResult[] };
  causes: Record<BlockCause, number>;
}

/** 무대가 60% 미만으로 보이면 제한으로 본다 (서비스 내 '많이 가려요' 이하와 같은 기준) */
export const LIMIT = 0.6;
/** 예매 시장의 '시야제한석' = 구조물·스피커 때문에 가리는 자리 */
export const isStructural = (r: SeatResult) => r.ratio < LIMIT && !!r.cause && r.cause !== "앞사람";
/** 앞사람이 일어서서 가리는 자리 (플로어는 원래 스탠딩이라 제외) */
export const isCrowd = (r: SeatResult) => r.ratio < LIMIT && r.cause === "앞사람" && r.seat.tier !== "플로어";

export async function assess(stage: StageConfig, opts: AssessOptions, onProgress?: (p: number) => void): Promise<Assessment> {
  const seats = generateSeats(stage);
  const T = stageTargets(stage);
  const O = stageObstacles(stage);
  const results: SeatResult[] = new Array(seats.length);
  const CHUNK = 900;
  for (let i = 0; i < seats.length; i += CHUNK) {
    for (let k = i; k < Math.min(seats.length, i + CHUNK); k++) {
      const v = seatVisibility(seats[k], stage, { standing: opts.standing, platform: opts.platform }, T, O);
      results[k] = { seat: seats[k], ratio: v.ratio, cause: v.blockedBy };
    }
    onProgress?.(Math.min(1, (i + CHUNK) / seats.length));
    await new Promise((r) => setTimeout(r, 0));
  }

  const causes: Record<BlockCause, number> = { 앞사람: 0, 구조물: 0, 스피커: 0 };
  const bySec = new Map<string, SeatResult[]>();
  for (const r of results) {
    const key = `${r.seat.tier}|${r.seat.section}`;
    if (!bySec.has(key)) bySec.set(key, []);
    bySec.get(key)!.push(r);
    if (r.ratio < LIMIT && r.cause && (r.cause !== "앞사람" || r.seat.tier !== "플로어")) causes[r.cause]++;
  }
  const tierOrder = (t: string) => (t === "플로어" ? 0 : t === "2층" ? 1 : 2);
  const sections: SectionRow[] = [...bySec.entries()]
    .map(([key, rs]) => {
      const [tier, section] = key.split("|");
      const limitedRs = rs.filter(isStructural);
      const crowdRs = rs.filter(isCrowd);
      const cc: Record<string, number> = {};
      for (const r of [...limitedRs, ...crowdRs]) if (r.cause) cc[r.cause] = (cc[r.cause] ?? 0) + 1;
      const top = Object.entries(cc).sort((a, b) => b[1] - a[1])[0];
      const n = parseInt(section);
      return {
        tier,
        section,
        block: tier === "플로어" ? section.replace("플로어 ", "") : blockOf(n),
        seats: rs.length,
        limited: limitedRs.length,
        crowd: crowdRs.length,
        avg: Math.round((rs.reduce((a, r) => a + r.ratio, 0) / rs.length) * 100),
        cause: (top?.[0] as BlockCause) ?? null,
      };
    })
    .sort((a, b) => tierOrder(a.tier) - tierOrder(b.tier) || a.section.localeCompare(b.section, "ko", { numeric: true }));

  const wheelRs = results.filter((r) => r.seat.wheelchair);
  // 단상을 올렸을 때도 같이 계산 (권고 근거)
  const withPlat = wheelRs.map((r) => seatVisibility(r.seat, stage, { standing: opts.standing, platform: 0.6 }, T, O).ratio);
  const avg = (xs: number[]) => Math.round((xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)) * 100);
  return {
    stage,
    opts,
    results,
    sections,
    total: results.length,
    limited: results.filter(isStructural).length,
    crowd: results.filter(isCrowd).length,
    wheel: {
      n: wheelRs.length,
      avg: avg(wheelRs.map((r) => r.ratio)),
      poor: wheelRs.filter((r) => r.ratio < LIMIT).length,
      avgWithPlatform: avg(withPlat),
      poorWithPlatform: withPlat.filter((v) => v < LIMIT).length,
      needPlatform: wheelRs.filter((r) => r.ratio < 0.85),
    },
    causes,
  };
}

export function toCSV(a: Assessment) {
  const head = ["좌석ID", "층", "블록", "구역", "열", "번호", "휠체어석", "무대보임(%)", "시야제한석(구조물)", "앞사람가림", "주요원인", "x(m)", "y(m)", "z(m)"];
  const rows = a.results.map((r) => [
    r.seat.id,
    r.seat.tier,
    r.seat.block ?? r.seat.section.replace("플로어 ", ""),
    r.seat.section,
    r.seat.row,
    r.seat.num,
    r.seat.wheelchair ? "Y" : "N",
    Math.round(r.ratio * 100),
    isStructural(r) ? "Y" : "N",
    isCrowd(r) ? "Y" : "N",
    r.cause ?? "",
    r.seat.pos[0].toFixed(2),
    r.seat.pos[1].toFixed(2),
    r.seat.pos[2].toFixed(2),
  ]);
  return "﻿" + [head, ...rows].map((r) => r.join(",")).join("\n");
}
