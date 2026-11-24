/** 계단 없는 길찾기 검증 — OSM 보행망(노드 4,020·구간 4,530) */
import { describe, expect, test } from "vitest";
import { F, bestExit, edgeCost, exits, findRoute, graph, parkings, profileFrom, venues } from "@/lib/route";

const wheel = profileFrom(["wheelchair"], false);
const wheelRain = profileFrom(["wheelchair"], true);
const anyone = profileFrom([], false);
const origins = [...exits, ...parkings];
const dome = venues.find((v) => v.name === "KSPO DOME")!;

describe("보행망 데이터", () => {
  test("규모가 기획서 수치와 같다", () => {
    expect(graph.nodes.length).toBe(4020);
    expect(graph.edges.length).toBe(4530);
  });
  test("모든 구간이 실제 노드를 잇고 길이가 양수", () => {
    for (const [a, b, len] of graph.edges) {
      expect(graph.nodes[a]).toBeDefined();
      expect(graph.nodes[b]).toBeDefined();
      expect(len).toBeGreaterThan(0);
    }
  });
  test("공연장 4곳·역 출구 13곳·주차장 8곳", () => {
    expect(venues.map((v) => v.name).sort()).toEqual(["KSPO DOME", "올림픽홀", "우리금융아트홀", "티켓링크 라이브 아레나"].sort());
    expect(exits.length).toBe(13);
    expect(parkings.length).toBe(8);
  });
});

describe("휠체어 경로", () => {
  test("모든 출발지(출구·주차장 21곳) → 모든 공연장(4곳) 84개 조합에서 경로가 있다", () => {
    for (const o of origins) for (const v of venues) expect(findRoute(o, v, wheel), `${o.name}→${v.name}`).not.toBeNull();
  });
  test("84개 경로 어디에도 계단·휠체어 불가 구간이 없다", () => {
    for (const o of origins)
      for (const v of venues) {
        const r = findRoute(o, v, wheel)!;
        expect(r.stepsCount, `${o.name}→${v.name}`).toBe(0);
      }
  });
  test("계단·휠체어 불가 구간 비용은 무한대", () => {
    expect(edgeCost(10, F.STEPS, wheel)).toBe(Infinity);
    expect(edgeCost(10, F.NO_WHEEL, wheel)).toBe(Infinity);
    expect(edgeCost(10, F.STEPS, anyone)).toBe(10);
  });
  test("비 오는 날엔 고르지 않은 바닥을 같거나 덜 지난다", () => {
    for (const o of exits)
      for (const v of venues) {
        const dry = findRoute(o, v, wheel)!;
        const wet = findRoute(o, v, wheelRain)!;
        expect(wet.roughMeters).toBeLessThanOrEqual(dry.roughMeters + 1);
      }
  });
  test("휠체어 이용 불가로 표시된 출구는 추천하지 않는다", () => {
    const st = [...new Set(exits.map((e) => e.station!))];
    for (const s of st)
      for (const v of venues) {
        const b = bestExit(s, v, wheel);
        if (b) expect(b.exit.wheelchair).not.toBe("no");
      }
  });
});

describe("기획서 예시 재현", () => {
  test("몽촌토성역 1번 → KSPO DOME: 일반 경로는 고르지 않은 바닥 294m, 휠체어·비 경로는 105m 더 돌아 0m", () => {
    const e1 = exits.find((e) => e.name.startsWith("몽촌토성역 (8호선) 1번"))!;
    const a = findRoute(e1, dome, anyone)!;
    const b = findRoute(e1, dome, wheelRain)!;
    expect(a.roughMeters).toBe(294);
    expect(b.roughMeters).toBe(0);
    expect(b.extraMeters).toBe(105);
  });
});
