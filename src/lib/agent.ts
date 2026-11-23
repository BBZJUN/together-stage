import lost from "@/data/lost.json";
import { endTime, fmtDate, getShow, getShows, occAtStart, peakOf } from "./data";
import { getParking } from "./parking";
import type { Show } from "./types";
import type { Need } from "./mode";
import { bestExit, findRoute, parkings, profileFrom, stations, toilets, venues } from "./route";
import { DEFAULT_STAGE, generateSeats, seatVisibility, stageObstacles, stageTargets } from "./venue";

/* ───────────── 툴 정의 (LLM 툴콜링용) ───────────── */

export const TOOLS = [
  {
    name: "find_route",
    description:
      "올림픽공원 안 보행 경로를 찾는다. 출발지는 지하철역(몽촌토성역/한성백제역/올림픽공원역) 또는 주차장 이름, 도착지는 공연장(KSPO DOME/티켓링크 라이브 아레나/올림픽홀/우리금융아트홀). 휠체어면 계단을 제외하고, 비가 오면 미끄러운 바닥을 피한다. 추천 출구, 거리, 소요시간, 계단 수, 단계별 안내를 돌려준다.",
    input_schema: {
      type: "object" as const,
      properties: {
        origin: { type: "string", description: "역 이름 또는 주차장 이름" },
        venue: { type: "string" },
        rain: { type: "boolean" },
      },
      required: ["origin", "venue"],
    },
  },
  {
    name: "wheelchair_seat_view",
    description: "휠체어석의 무대 시야(앞사람이 앉았을 때/일어섰을 때)를 실측 3D 형상으로 계산해 요약한다. 현재 KSPO DOME만 지원하므로 공연장을 묻지 말고 바로 호출한다.",
    input_schema: { type: "object" as const, properties: { venue: { type: "string" } } },
  },
  {
    name: "find_toilets",
    description: "공연장 주변 화장실(장애인 화장실 여부 포함)을 가까운 순으로 찾는다.",
    input_schema: { type: "object" as const, properties: { venue: { type: "string" } }, required: ["venue"] },
  },
  {
    name: "search_shows",
    description: "올림픽공원 공연 일정을 검색한다. 공연명·공연장·장르 키워드나 날짜(YYYY-MM-DD)로 찾는다. 인자가 없으면 다가오는 공연 전체.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "공연명/공연장/장르 키워드" },
        date: { type: "string", description: "YYYY-MM-DD" },
      },
    },
  },
  {
    name: "get_show_forecast",
    description: "특정 공연의 시간대별 주차 혼잡 예측, 추천 도착 시각, 만차 예상 시각, 출차 대기시간, 날씨를 가져온다.",
    input_schema: {
      type: "object" as const,
      properties: { show_id: { type: "string" } },
      required: ["show_id"],
    },
  },
  {
    name: "get_parking_now",
    description: "올림픽공원 주차구역(동2문/남2문/북2문)별 지금 주차 현황을 가져온다.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "search_lost_items",
    description: "올림픽공원 유실물 습득 목록을 키워드로 검색한다.",
    input_schema: {
      type: "object" as const,
      properties: { keyword: { type: "string" } },
      required: ["keyword"],
    },
  },
];

function brief(s: Show) {
  return {
    id: s.id,
    title: s.title,
    venue: s.venue,
    date: s.date,
    dateLabel: fmtDate(s.date),
    start: s.start,
    end: endTime(s),
    audience: s.audience,
  };
}

function venueOf(q = "") {
  const t = q.replace(/\s/g, "").toLowerCase();
  if (/kspo|돔|체조/.test(t)) return venues.find((v) => v.id === "kspo");
  if (/핸드볼|티켓링크|라이브아레나/.test(t)) return venues.find((v) => v.id === "handball");
  if (/올림픽홀/.test(t)) return venues.find((v) => v.id === "olympichall");
  if (/아트홀|우리금융/.test(t)) return venues.find((v) => v.id === "artHall");
  return undefined;
}

function stationOf(q = "") {
  const t = q.replace(/\s/g, "");
  return stations.find((s) => t.includes(s.split(" ")[0]) || t.includes(s.split(" ")[0].replace("역", "")));
}

let currentNeeds: Need[] = [];

export async function runTool(name: string, input: Record<string, string>) {
  switch (name) {
    case "find_route": {
      const v = venueOf(input.venue);
      if (!v) return { error: "공연장을 찾지 못함" };
      const p = profileFrom(currentNeeds, String(input.rain) === "true");
      const st = stationOf(input.origin);
      if (st) {
        const b = bestExit(st, v, p);
        if (!b) return { error: "조건에 맞는 경로 없음" };
        return { from: b.exit.name, exitWheelchairTag: b.exit.wheelchair ?? "미확인", to: v.name, ...b.route, points: undefined };
      }
      const pk = parkings.find((x) => (input.origin ?? "").includes(x.name.replace("주차장", ""))) ?? parkings[0];
      const r = findRoute(pk, v, p);
      return r ? { from: pk.name, to: v.name, ...r, points: undefined } : { error: "경로 없음" };
    }
    case "wheelchair_seat_view": {
      const seats = generateSeats(DEFAULT_STAGE).filter((x) => x.wheelchair);
      const T = stageTargets(DEFAULT_STAGE);
      const O = stageObstacles(DEFAULT_STAGE);
      const calc = (standing: boolean) => {
        const vs = seats.map((x) => seatVisibility(x, DEFAULT_STAGE, { standing }, T, O).ratio);
        return { avgVisible: Math.round((vs.reduce((a, b) => a + b, 0) / vs.length) * 100), poorSeats: vs.filter((x) => x < 0.6).length };
      };
      return { venue: "KSPO DOME (실감형 콘텐츠 3D 형상 기반)", wheelchairSeats: seats.length, seated: calc(false), standing: calc(true), note: "휠체어석 위치는 예시 배치" };
    }
    case "find_toilets": {
      const v = venueOf(input.venue) ?? venues[0];
      return toilets
        .map((t) => ({ wheelchair: t.wheelchair === "yes", meters: Math.round(Math.hypot(t.x - v.x, t.y - v.y)) }))
        .sort((a, b) => a.meters - b.meters)
        .slice(0, 3);
    }
    case "search_shows": {
      const q = (input.query ?? "").trim();
      return getShows()
        .filter((s) => !input.date || s.date === input.date)
        .filter((s) => !q || [s.title, s.venue, s.genre].some((t) => t.includes(q)))
        .map(brief);
    }
    case "get_show_forecast": {
      const s = getShow(input.show_id);
      if (!s) return { error: "해당 공연 없음" };
      const peak = peakOf(s);
      return {
        ...brief(s),
        weather: s.weather,
        peakHour: peak.h,
        peakOcc: peak.occ,
        occAtStart: occAtStart(s).occ,
        hourly: s.forecast.hours.map((p) => `${p.h}시 ${p.occ}% ${p.level}`).join(", "),
        ...s.reco,
      };
    }
    case "get_parking_now":
      return getParking();
    case "search_lost_items": {
      const k = input.keyword ?? "";
      const hits = lost.items.filter((i) => i.name.includes(k) || i.place.includes(k));
      return { source: lost.source, items: hits, contact: "올림픽공원 고객안내센터" };
    }
    default:
      return { error: "unknown tool" };
  }
}

/* ───────────── 시스템 프롬프트 ───────────── */

function toneFor(needs: Need[]) {
  const rules = ["존댓말로, 짧고 쉬운 문장으로 말한다. 한 문장에 정보 하나."];
  if (needs.includes("lowvision") || needs.includes("companion")) rules.push("전체 4문장 이내, 이모지 금지, 어려운 외래어 금지(고유명사는 그대로), 시각은 '오후 4시'처럼.");
  if (needs.includes("wheelchair")) rules.push("휠체어 이용자다. 계단·턱·경사·엘리베이터 정보를 가장 먼저 말한다.");
  if (needs.includes("mobility")) rules.push("계단이 힘든 사람이다. 계단과 오르막을 피하는 길을 우선한다.");
  if (needs.includes("hearing")) rules.push("청각장애인일 수 있다. 소리 안내 대신 글로 분명히, 방향은 랜드마크로 설명한다.");
  return rules.join(" ");
}

export function systemPrompt(needs: Need[], showId?: string) {
  currentNeeds = needs;
  const today = new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
  const focus = showId ? getShow(showId) : undefined;
  return `너는 '함께 보는 무대' 안내원이야. 휠체어 이용자, 계단이 힘든 사람, 저시력·고령 관객이 올림픽공원 공연장에 편하게 오가도록 돕는다.
오늘은 ${today}.
말투: ${toneFor(needs)}
규칙:
- 길은 반드시 find_route로 조회해서 답한다. 계단 수, 추천 출구, 소요시간을 말한다.
- 출구 엘리베이터 여부가 '미확인'이면 역 안내도에서 엘리베이터 위치를 확인하라고 덧붙인다.
- 화장실은 find_toilets, 휠체어석 시야는 wheelchair_seat_view로 조회한다. 공연장을 말하지 않았으면 KSPO DOME으로 보고 바로 조회한다.
- 출발지가 없으면 올림픽공원역을 기준으로 안내하고, 다른 역에서 오면 말해달라고 덧붙인다.
- 답은 5문장 이내. 마크다운 기호(**, #, -)를 쓰지 말고 평범한 문장으로.
- [가장 중요] 툴 결과에 없는 시설 정보(엘리베이터·경사로·휠체어석 동선·장애인 주차·셔틀 유무 등)는 절대 지어내거나 단정하지 않는다. 툴 결과에 없으면 "아직 확인되지 않았어요. 방문 전 공연장에 문의해 주세요"라고 말한다. 잘못된 안내는 이동이 어려운 사람에게 실제 위험이 된다.
- 공연장·역 이름은 바꾸지 않고 그대로 쓴다 (예: KSPO DOME).
- 공연 일정·혼잡·주차·유실물은 반드시 툴로 조회한 값만 말한다. 추측한 숫자를 만들지 않는다.
- 공연을 특정할 수 없으면 search_shows로 찾고, 여러 개면 짧게 되묻는다.
- 주차장이 넘칠 것으로 예측되면(overflowCars>0) 대중교통(5·9호선 올림픽공원역, 8호선 몽촌토성역)을 권한다.
- 막차·대중교통 정확한 시각은 데이터가 없으니 '따로 확인하세요'라고 안내한다.
- 데이터가 샘플(source: sample)이면 마지막에 '(현재 샘플 데이터 기준)'을 붙인다.
${focus ? `사용자는 지금 '${focus.title}'(id: ${focus.id}, ${focus.date} ${focus.start}) 화면에서 질문하고 있다.` : ""}`;
}

/* ───────────── LLM 없이 동작하는 규칙 기반 응답 (폴백) ───────────── */




export async function fallbackReply(text: string, needs: Need[], showId?: string): Promise<string> {
  currentNeeds = needs;
  const sample = " (현재 샘플 데이터 기준)";
  const show = showId ? getShow(showId) : undefined;
  const venue = venueOf(text) ?? (show ? venueOf(show.venue) : undefined);
  const rain = /비|우산|눈 와|눈와|비와|비 와/.test(text);

  if (/잃어|분실|유실|두고|놓고/.test(text)) {
    const kw = ["응원봉", "지갑", "목도리", "안경", "장갑", "에어팟", "카드"].find((k) => text.includes(k)) ?? "";
    const res = (await runTool("search_lost_items", { keyword: kw })) as { items: typeof lost.items };
    if (res.items.length === 0) return `아직 비슷한 습득물이 등록되지 않았어요. 올림픽공원 고객안내센터에 분실 신고를 남겨 두세요.${sample}`;
    const it = res.items[0];
    return `${it.date}에 '${it.name}'이(가) ${it.place}에서 습득됐어요. ${it.storage}에서 보관 중이에요.${sample}`;
  }

  if (/화장실/.test(text)) {
    const v = venue ?? venues[0];
    const list = (await runTool("find_toilets", { venue: v.name })) as { wheelchair: boolean; meters: number }[];
    const w = list.find((x) => x.wheelchair);
    return w
      ? `${v.name}에서 가장 가까운 장애인 화장실은 약 ${w.meters}m 떨어져 있어요. 길찾기 지도에서 ♿ 표시를 확인하세요.`
      : `${v.name}에서 가장 가까운 화장실은 약 ${list[0].meters}m 떨어져 있어요.`;
  }

  if (/시야|보여|보일|휠체어석|좌석/.test(text)) {
    const r = (await runTool("wheelchair_seat_view", {})) as { wheelchairSeats: number; seated: { avgVisible: number }; standing: { avgVisible: number; poorSeats: number } };
    return `KSPO DOME 휠체어석은 앞사람이 앉아 있으면 무대가 평균 ${r.seated.avgVisible}% 보여요. 하지만 앞사람이 일어서면 ${r.standing.avgVisible}%로 줄고, ${r.wheelchairSeats}석 중 ${r.standing.poorSeats}석은 많이 가려요. '좌석 시야' 탭에서 자리별로 직접 확인해 보세요. (실측 3D 형상 기준, 휠체어석 위치는 예시)`;
  }

  const st = stationOf(text);
  const pk = /주차|차 가져|자가용|운전/.test(text);
  if (venue && (st || pk || /가는|가요|길|어떻게|가려면|출구/.test(text))) {
    const origin = st ?? (pk ? parkings[0].name : "올림픽공원역");
    const r = (await runTool("find_route", { origin, venue: venue.name, rain: String(rain) })) as {
      from?: string;
      minutes?: number;
      meters?: number;
      stepsCount?: number;
      avoidedSteps?: number;
      roughMeters?: number;
      exitWheelchairTag?: string;
      error?: string;
      steps?: { text: string }[];
    };
    if (r.error) return `조건에 맞는 길을 찾지 못했어요. 다른 역이나 주차장을 말씀해 주세요.`;
    const wheel = needs.includes("wheelchair");
    const parts = [
      `${r.from}에서 ${venue.name}까지 약 ${r.minutes}분, ${r.meters}m예요.`,
      r.stepsCount ? `중간에 계단이 ${r.stepsCount}곳 있어요.` : wheel ? "계단 없는 길로 안내해요." : "계단은 없어요.",
    ];
    if (r.avoidedSteps) parts.push(`가장 짧은 길에 있는 계단 ${r.avoidedSteps}곳을 피했어요.`);
    if (rain && !r.roughMeters) parts.push("비가 와서 미끄러운 바닥 구간은 피했어요.");
    if (r.exitWheelchairTag && r.exitWheelchairTag !== "yes" && wheel) parts.push("출구 엘리베이터 위치는 역 안내도에서 꼭 확인하세요.");
    parts.push(`첫 안내: ${r.steps?.[0]?.text ?? ""}`);
    return parts.join(" ");
  }

  if (show || /공연|붐|혼잡|언제|몇 시/.test(text)) {
    const s = show ?? getShows()[0];
    const r = s.reco;
    return `${fmtDate(s.date)} ${s.start} ${s.title.replace("[샘플] ", "")} 공연은 ${r.fullAt ? `${r.fullAt}쯤 공원이 가장 붐벼요. 그 전에 도착하면 엘리베이터와 길이 한산해요.` : "크게 붐비지 않을 것 같아요."} 공연이 끝나면 인파가 빠지는 데 30분 정도 걸리니, 조금 기다렸다 나오시면 편해요.${sample}`;
  }

  return `어디서 출발해서 어느 공연장에 가시는지 말씀해 주세요. 예: "올림픽공원역에서 KSPO DOME 가는 길", "휠체어석 시야 어때요?", "장애인 화장실 어디예요?"`;
}
