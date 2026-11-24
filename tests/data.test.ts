/** 수집·가공 데이터 검증 — 매일 자동 수집되는 파일이 앱이 기대하는 모양인지 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import shows from "@/data/shows.json";
import events from "@/data/events.json";
import lost from "@/data/lost.json";
import validation from "@/data/validation.json";
import report from "../pipeline/model_report.json";
import { arrivalAdvice, getShows } from "@/lib/data";
import { lostItems } from "@/lib/lost";
import { DEFAULT_STAGE, generateSeats, seatVisibility, stageObstacles, stageTargets } from "@/lib/venue";
import type { Show } from "@/lib/types";

const LEVELS = ["원활", "보통", "혼잡", "만차"];

describe("공연 데이터 (올림픽공원 공식 일정안내 → 회차별 예측)", () => {
  const list = getShows();
  test("공식 일정에서 가져온 실제 공연이다", () => {
    expect(shows.source).toBe("official");
    expect(list.length).toBeGreaterThan(0);
  });
  test("회차마다 날짜·시각·공연장·원문 링크가 있다", () => {
    for (const s of list) {
      expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.start).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      expect(["KSPO DOME", "올림픽홀", "우리금융아트홀", "티켓링크 라이브 아레나", "뮤즈라이브", "핸드볼경기장", "SK핸드볼경기장"]).toContain(s.venue);
      expect(s.official?.url).toMatch(/^https:\/\/www\.ksponco\.or\.kr\//);
    }
  });
  test("시간대별 예측: 0~100%, 단계 이름이 정해진 네 가지, 위쪽 범위 ≥ 예측", () => {
    for (const s of list)
      for (const h of s.forecast.hours) {
        expect(h.occ).toBeGreaterThanOrEqual(0);
        expect(h.occ).toBeLessThanOrEqual(100);
        expect(LEVELS).toContain(h.level);
        if (h.hi !== undefined) expect(h.hi).toBeGreaterThanOrEqual(h.occ);
      }
  });
  test("도착 권장 시각은 공연 시작보다 이르다", () => {
    for (const s of list) {
      const { arrive } = arrivalAdvice(s as Show);
      expect(arrive < s.start).toBe(true);
    }
  });
  test("같은 회차 ID가 두 번 나오지 않는다", () => {
    expect(new Set(list.map((s) => s.id)).size).toBe(list.length);
  });
  test("수집 원본: 공연마다 원문 링크와 기간", () => {
    for (const e of events.events) {
      expect(e.url).toMatch(/^https:\/\/www\.ksponco\.or\.kr\//);
      expect(e.start_date <= e.end_date).toBe(true);
    }
  });
});

describe("혼잡 예측 모델 (2025 연계 데이터, 주 단위 5-겹 교차검증)", () => {
  test("기획서 수치: 전체 R² 0.805, 평균 오차 399 → 182대(55% 감소)", () => {
    expect(report.all.r2_model).toBeCloseTo(0.805, 3);
    expect(report.all.mae_baseline).toBeCloseTo(399.1, 1);
    expect(Math.round(report.all.mae_model)).toBe(182);
    expect(Math.round((1 - report.all.mae_model / report.all.mae_baseline) * 100)).toBe(55);
  });
  test("예측 모델이 요일·시간 평균보다 낫다 (전체·공연일 모두)", () => {
    expect(report.all.mae_model).toBeLessThan(report.all.mae_baseline);
    expect(report.show_days.mae_model).toBeLessThan(report.show_days.mae_baseline);
  });
  test("앱 기준 검증: 공연일 혼잡 단계 90% 일치, 실제 혼잡일 11일 중 8일 사전 경고", () => {
    expect(report.checks.level_match_show_days).toBeGreaterThanOrEqual(0.9);
    expect(report.checks.busy_day_upper.busy_days).toBe(11);
    expect(report.checks.busy_day_upper.caught).toBe(8);
    expect(report.checks.busy_day_upper.caught).toBeGreaterThan(report.checks.busy_day_mean.caught);
  });
  test("앱의 '예측 vs 실제' 화면 데이터는 같은 검증 결과에서 나온다", () => {
    expect(validation.report.all.r2_model).toBe(report.all.r2_model);
    expect(validation.days.length).toBeGreaterThan(0);
  });
});

describe("유실물 (유실물센터 습득 공고 → 물품 단위)", () => {
  test("공식 공고에서 가져왔고 물품마다 날짜·이름·원문 링크", () => {
    expect(lost.source).toBe("official");
    const items = lostItems();
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) {
      expect(it.name.length).toBeGreaterThan(0);
      expect(it.url).toMatch(/^https:\/\/www\.ksponco\.or\.kr\//);
    }
  });
});

describe("가공 데이터 재공개 파일", () => {
  const csv = readFileSync("public/open/kspo_dome_seat_visibility.csv", "utf8").replace(/^﻿/, "").split("\n");
  test("좌석별 시야 CSV 16,127행", () => expect(csv.length - 1).toBe(16127));
  test("CSV 값이 현재 시야 엔진 결과와 같다 (공개 파일이 낡지 않았는지)", () => {
    const st = DEFAULT_STAGE;
    const seats = generateSeats(st);
    const T = stageTargets(st), O = stageObstacles(st);
    const byId = new Map(csv.slice(1).map((l) => [l.split(",")[0], l.split(",")]));
    for (const s of seats.filter((_, i) => i % 97 === 0)) {
      const row = byId.get(s.id)!;
      expect(row, s.id).toBeDefined();
      expect(Number(row[11])).toBe(Math.round(seatVisibility(s, st, { standing: false }, T, O).ratio * 100));
      expect(Number(row[12])).toBe(Math.round(seatVisibility(s, st, { standing: true }, T, O).ratio * 100));
    }
  });
});
