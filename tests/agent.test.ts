/** AI 안내(규칙 기반 폴백) 검증 — LLM이 없거나 한도를 넘어도 같은 원칙으로 답하는지 */
import { beforeAll, describe, expect, test, vi } from "vitest";
import { fallbackReply, runTool } from "@/lib/agent";

beforeAll(() => {
  // 실시간 API는 테스트에서 끊어 둔다 (끊겨도 답이 깨지지 않아야 함)
  vi.stubGlobal("fetch", async () => {
    throw new Error("offline");
  });
});
const ask = (q: string) => fallbackReply(q, ["wheelchair"]);

describe("데이터에 없는 시설 정보는 지어내지 않는다", () => {
  for (const q of ["KSPO DOME 엘리베이터 어디 있어요?", "경사로 있나요?", "셔틀버스 있어요?", "장애인 주차 되나요?", "수어 통역 있어요?"])
    test(q, async () => {
      const a = await ask(q);
      expect(a).toContain("확인되지 않았어요");
      expect(a).toContain("02-410-1114");
    });
});

describe("데이터로 답할 수 있는 질문", () => {
  test("휠체어 길 안내: 계단 없는 길 + 출구 엘리베이터 확인 당부", async () => {
    const a = await ask("몽촌토성역에서 KSPO DOME 휠체어로 어떻게 가요?");
    expect(a).toContain("계단 없는 길");
    expect(a).not.toMatch(/계단이 \d+곳/);
  });
  test("휠체어석 시야: 엔진 계산값 그대로 (100% / 85%, 22석 중 4석)", async () => {
    const a = await ask("휠체어석에서 무대 잘 보여요?");
    expect(a).toContain("100%");
    expect(a).toContain("85%");
    expect(a).toContain("22석 중 4석");
  });
  test("공연 혼잡: 앱 화면과 같은 도착 권장 시각", async () => {
    expect(await ask("이번 주 공연 뭐 있어요?")).toMatch(/까지 도착하시면 편해요/);
  });
  test("분실물: 공식 습득 공고에서 찾아 보관처 안내", async () => {
    expect(await ask("지갑 잃어버렸어요")).toMatch(/공고|분실 신고/);
  });
  test("실시간 주차를 못 불러와도 숫자를 지어내지 않는다", async () => {
    const a = await ask("주차 자리 있어요?");
    expect(a).toContain("불러오지 못했어요");
    expect(a).not.toMatch(/\d+대가 주차/);
  });
  test("화장실: 공연장을 안 말하면 공연장별 거리", async () => {
    const a = await ask("장애인 화장실 어디예요?");
    for (const v of ["KSPO DOME", "올림픽홀", "우리금융아트홀"]) expect(a).toContain(v);
  });
});

describe("툴", () => {
  test("find_route: 휠체어 경로는 계단 0곳", async () => {
    const r = (await runTool("find_route", { origin: "올림픽공원역", venue: "KSPO DOME" })) as { stepsCount: number };
    expect(r.stepsCount).toBe(0);
  });
  test("알 수 없는 툴은 오류로 답한다", async () => {
    expect(await runTool("nope", {})).toEqual({ error: "unknown tool" });
  });
});
