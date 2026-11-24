/**
 * 한국체육산업개발_올림픽공원 실시간 주차현황 (공공데이터포털, 기관 공개 API)
 * 응답: [{"parking_sum": 1627}] — 동2·남2·북2 주차장 전체 주차대수
 * 서비스키는 기관이 공개 명세에 함께 게시한 공개 키. 환경변수로 바꿀 수 있음.
 */
export interface ParkingSnapshot {
  at: string;
  source: "live" | "unavailable";
  /** 공원 전체 현재 주차대수 */
  total: number | null;
  note: string;
}

const DEFAULT_URL = "https://www.ksponco.or.kr/online/main/parkingorsApi.do?apiKey=PARKING21803504";

export async function getParking(): Promise<ParkingSnapshot> {
  const url = process.env.KSPO_PARKING_API_URL || DEFAULT_URL;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { "User-Agent": "together-stage (public data contest)" } });
    if (res.ok) {
      const body = await res.text();
      const m = body.match(/parking_sum["'\s:>]*?(\d+)/i);
      if (m) {
        return {
          at: new Date().toISOString(),
          source: "live",
          total: Number(m[1]),
          note: "올림픽공원 동2문·남2문·북2문 주차구역 실시간 주차대수 (한국체육산업개발). 기관 안내: 장기 주차는 출차일이 비어 실제와 다를 수 있음",
        };
      }
      if (/9999/.test(body)) return { at: new Date().toISOString(), source: "unavailable", total: null, note: "기관 서비스 점검 중" };
    }
  } catch {
    /* 아래로 */
  }
  return { at: new Date().toISOString(), source: "unavailable", total: null, note: "실시간 주차현황을 지금 불러올 수 없어요" };
}
