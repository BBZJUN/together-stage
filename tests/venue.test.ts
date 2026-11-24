/** KSPO DOME 좌석·시야 엔진 검증 — 실감형 콘텐츠(삼각형 263만 개) → 0.5m 높이지도 */
import { describe, expect, test } from "vitest";
import {
  DEFAULT_STAGE, STAGE_PRESETS, blockOf, describeSeat, generateSeats, seatVisibility, sectionAngle, sectionNo, stageObstacles, stageTargets,
  type StageConfig,
} from "@/lib/venue";

const avg = (xs: number[]) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100);
function wheel(stage: StageConfig, o: { standing: boolean; platform?: number; fence?: number }) {
  const seats = generateSeats(stage);
  const T = stageTargets(stage), O = stageObstacles(stage);
  const vs = seats.filter((s) => s.wheelchair).map((s) => seatVisibility(s, stage, o, T, O).ratio);
  return { avg: avg(vs), poor: vs.filter((v) => v < 0.6).length, n: vs.length };
}

describe("좌석 생성", () => {
  const seats = generateSeats(DEFAULT_STAGE);
  test("끝무대 기본 배치 16,127석", () => expect(seats.length).toBe(16127));
  test("좌석 ID가 겹치지 않는다", () => expect(new Set(seats.map((s) => s.id)).size).toBe(seats.length));
  test("휠체어석 22석 — 국내 기준(2천 석 이상이면 20석 이상) 충족", () => {
    expect(seats.filter((s) => s.wheelchair).length).toBe(22);
  });
  test("휠체어석은 공식 배치도대로 C블록(정면 5~11구역) 뒤편", () => {
    for (const s of seats.filter((x) => x.wheelchair)) expect(blockOf(parseInt(s.section))).toBe("C");
  });
  test("구역 번호 ↔ 각도 변환이 서로 맞다", () => {
    for (let n = 1; n <= 22; n++) expect(sectionNo("2층", sectionAngle(n))).toBe(n);
  });
});

describe("시야 계산의 성질 (모든 좌석)", () => {
  const st = DEFAULT_STAGE;
  const seats = generateSeats(st);
  const T = stageTargets(st), O = stageObstacles(st);
  const sample = seats.filter((_, i) => i % 7 === 0); // 2,304석
  test("앞사람이 일어서면 보임이 같거나 줄어든다", () => {
    for (const s of sample) {
      const sit = seatVisibility(s, st, { standing: false }, T, O).ratio;
      const up = seatVisibility(s, st, { standing: true, seated: true }, T, O).ratio;
      expect(up).toBeLessThanOrEqual(sit);
    }
  });
  test("휠체어석: 단상을 높이면 같거나 늘고, 펜스를 높이면 같거나 준다", () => {
    for (const s of seats.filter((x) => x.wheelchair)) {
      const base = seatVisibility(s, st, { standing: true }, T, O).ratio;
      expect(seatVisibility(s, st, { standing: true, platform: 0.6 }, T, O).ratio).toBeGreaterThanOrEqual(base);
      expect(seatVisibility(s, st, { standing: true, fence: 1.2 }, T, O).ratio).toBeLessThanOrEqual(base);
    }
  });
  test("보임 비율은 0~1, 가린 원인은 보임 100%일 때 없음", () => {
    for (const s of sample) {
      const v = seatVisibility(s, st, { standing: true }, T, O);
      expect(v.ratio).toBeGreaterThanOrEqual(0);
      expect(v.ratio).toBeLessThanOrEqual(1);
      if (v.ratio === 1) expect(v.blockedBy).toBeNull();
    }
  });
});

describe("기획서 수치 재현 — 휠체어석 22석 평균 시야", () => {
  test("끝무대: 앉음 100% / 일어섬 72%(8석 많이 가림) / 단상 60cm 100%", () => {
    expect(wheel(DEFAULT_STAGE, { standing: false })).toMatchObject({ avg: 100, n: 22 });
    expect(wheel(DEFAULT_STAGE, { standing: true })).toMatchObject({ avg: 72, poor: 8 });
    expect(wheel(DEFAULT_STAGE, { standing: true, platform: 0.6 }).avg).toBe(100);
  });
  test("펜스·표지판 1.2m: 앞사람이 앉아도 23%, 일어서면 20%, 단상 60cm면 100%", () => {
    expect(wheel(DEFAULT_STAGE, { standing: false, fence: 1.2 }).avg).toBe(23);
    expect(wheel(DEFAULT_STAGE, { standing: true, fence: 1.2 }).avg).toBe(20);
    expect(wheel(DEFAULT_STAGE, { standing: true, fence: 1.2, platform: 0.6 }).avg).toBe(100);
  });
  test("돌출무대: 일어섬 72% → 단상 100%", () => {
    const th = STAGE_PRESETS.thrust.stage;
    expect(wheel(th, { standing: true }).avg).toBe(72);
    expect(wheel(th, { standing: true, platform: 0.6 }).avg).toBe(100);
  });
});

describe("자리 음성 설명", () => {
  test("휠체어석 설명에 위치·방향·거리·보임·난간·통로가 모두 들어간다", () => {
    const seats = generateSeats(DEFAULT_STAGE);
    const s = seats.find((x) => x.wheelchair)!;
    const text = describeSeat(s, seats, 1, 0.72, 1.0);
    for (const k of ["휠체어석", "무대", "미터", "%", "난간", "통로"]) expect(text).toContain(k);
  });
});
