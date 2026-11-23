import { data } from "./data";

export interface GateStatus {
  gate: string;
  capacity: number;
  parked: number;
  occ: number;
}

export interface ParkingSnapshot {
  at: string;
  source: "live" | "sample";
  gates: GateStatus[];
}

/**
 * 한국체육산업개발_실시간 주차현황 (data.go.kr 15168686)
 * - 키와 엔드포인트가 환경변수에 있으면 실시간 호출
 * - 없거나 실패하면 오늘 예측값 기반 샘플로 대체 (서비스는 계속 동작)
 */
export async function getParking(): Promise<ParkingSnapshot> {
  const key = process.env.DATA_GO_KR_KEY;
  const url = process.env.KSPO_PARKING_API_URL;
  if (key && url) {
    try {
      const res = await fetch(`${url}?serviceKey=${encodeURIComponent(key)}&pageNo=1&numOfRows=100&type=json`, {
        next: { revalidate: 60 },
      });
      if (res.ok) {
        const parsed = parseLive(await res.text());
        if (parsed) return parsed;
      }
    } catch {
      /* 아래 샘플로 대체 */
    }
  }
  return sampleSnapshot();
}

/** 응답 스키마는 활용신청 승인 후 실제 응답을 보고 확정 */
function parseLive(body: string): ParkingSnapshot | null {
  try {
    const json = JSON.parse(body);
    const items: Record<string, unknown>[] = json?.response?.body?.items?.item ?? json?.data ?? [];
    if (!Array.isArray(items) || items.length === 0) return null;
    const counts: Record<string, number> = {};
    for (const it of items) {
      const zone = String(it["parkingArea"] ?? it["주차구역"] ?? it["zone"] ?? "");
      const out = it["outDt"] ?? it["출차일시"];
      if (!zone || out) continue; // 출차 기록이 없는 차량 = 현재 주차 중
      const gate = Object.keys(data.gates).find((g) => zone.includes(g.replace("문", ""))) ?? zone;
      counts[gate] = (counts[gate] ?? 0) + 1;
    }
    return {
      at: new Date().toISOString(),
      source: "live",
      gates: Object.entries(data.gates).map(([gate, capacity]) => {
        const parked = counts[gate] ?? 0;
        return { gate, capacity, parked, occ: Math.min(100, Math.round((parked / capacity) * 100)) };
      }),
    };
  } catch {
    return null;
  }
}

function sampleSnapshot(): ParkingSnapshot {
  const now = new Date(Date.now() + 9 * 3600 * 1000); // KST
  const hour = now.getUTCHours();
  const weights: Record<string, number> = { 동2문: 0.85, 남2문: 1.15, 북2문: 0.8 };
  const base = 0.12 + 0.3 * Math.exp(-((hour - 14) ** 2) / 18);
  return {
    at: new Date().toISOString(),
    source: "sample",
    gates: Object.entries(data.gates).map(([gate, capacity]) => {
      const occ = Math.min(100, Math.round(base * weights[gate] * 100));
      return { gate, capacity, parked: Math.round((capacity * occ) / 100), occ };
    }),
  };
}
