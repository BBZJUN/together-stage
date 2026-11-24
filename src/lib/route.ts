import walk from "@/data/walk.json";
import type { Need } from "./mode";

export const F = { STEPS: 1, ROUGH: 2, ROAD: 4, COVERED: 8, NO_WHEEL: 16, INCLINE: 32 } as const;

export type Pt = [number, number];
export interface Place {
  id: string;
  kind: "venue" | "parking" | "exit" | "toilet";
  name: string;
  x: number;
  y: number;
  nodes: number[];
  station?: string;
  ref?: string;
  wheelchair?: string | null;
}

export const graph = walk as unknown as {
  source: string;
  nodes: Pt[];
  edges: [number, number, number, number][];
  places: Place[];
  ways: { f: number; p: Pt[] }[];
  buildings: { p: Pt[]; name: string | null; venue: string | null }[];
};

export interface Profile {
  wheelchair: boolean;
  mobility: boolean; // 계단이 힘듦
  lowvision: boolean;
  companion: boolean;
  rain: boolean;
}

export function profileFrom(needs: Need[] | null, rain: boolean): Profile {
  const n = needs ?? [];
  return {
    wheelchair: n.includes("wheelchair"),
    mobility: n.includes("mobility"),
    lowvision: n.includes("lowvision"),
    companion: n.includes("companion"),
    rain,
  };
}

/** 엣지 비용(가중 거리). Infinity = 이용 불가 */
export function edgeCost(len: number, f: number, p: Profile): number {
  let c = len;
  if (f & F.STEPS) {
    if (p.wheelchair) return Infinity;
    if (p.mobility) c = c * 8 + 60;
    else if (p.companion || p.lowvision) c = c * 3 + 20;
    if (p.rain) c *= 1.5;
  }
  if (f & F.NO_WHEEL && p.wheelchair) return Infinity;
  if (f & F.ROUGH) {
    if (p.wheelchair) c *= 3;
    else if (p.mobility || p.companion) c *= 1.8;
    if (p.rain) c *= 2.2; // 비 오면 나무데크·자갈·박석은 미끄러움
  }
  if (f & F.INCLINE) {
    if (p.wheelchair) c *= 3;
    if (p.rain) c *= 1.6;
  }
  if (f & F.ROAD) c *= p.lowvision ? 1.8 : 1.25; // 차가 다니는 길
  if (f & F.COVERED && p.rain) c *= 0.5;
  return c;
}

const adj: [number, number, number, number][][] = graph.nodes.map(() => []);
graph.edges.forEach(([a, b, l, f], i) => {
  adj[a].push([b, l, f, i]);
  adj[b].push([a, l, f, i]);
});

/** 다익스트라: 출발 노드들 → 도착 노드 집합 중 가장 가까운 곳 */
function dijkstra(from: number[], to: Set<number>, p: Profile | null) {
  const n = graph.nodes.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const prevEdge = new Int32Array(n).fill(-1);
  const heap: [number, number][] = [];
  const push = (d: number, v: number) => {
    heap.push([d, v]);
    let i = heap.length - 1;
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (heap[j][0] <= heap[i][0]) break;
      [heap[i], heap[j]] = [heap[j], heap[i]];
      i = j;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m], heap[i]];
        i = m;
      }
    }
    return top;
  };
  for (const s of from) {
    dist[s] = 0;
    push(0, s);
  }
  while (heap.length) {
    const [d, u] = pop();
    if (d > dist[u]) continue;
    if (to.has(u)) {
      const path: number[] = [];
      const es: number[] = [];
      for (let v = u; v !== -1; v = prev[v]) {
        path.push(v);
        if (prevEdge[v] >= 0) es.push(prevEdge[v]);
      }
      return { path: path.reverse(), edges: es.reverse(), cost: d };
    }
    for (const [v, l, f, ei] of adj[u]) {
      const w = p ? edgeCost(l, f, p) : l;
      if (!isFinite(w)) continue;
      if (d + w < dist[v]) {
        dist[v] = d + w;
        prev[v] = u;
        prevEdge[v] = ei;
        push(d + w, v);
      }
    }
  }
  return null;
}

export interface Step {
  icon: string;
  text: string;
  meters: number;
  warn?: boolean;
  at?: Pt; // 이 단계가 끝나는 지점
}

export interface RouteResult {
  points: Pt[];
  meters: number;
  minutes: number;
  stepsCount: number; // 경로에 포함된 계단 구간 수
  avoidedSteps: number; // 최단 경로 대비 피한 계단 구간 수
  extraMeters: number; // 최단 경로 대비 더 걷는 거리
  roughMeters: number;
  roadMeters: number;
  coveredMeters: number;
  steps: Step[];
}

function summarize(edges: number[]) {
  let m = 0,
    st = 0,
    rough = 0,
    road = 0,
    cov = 0;
  for (const ei of edges) {
    const [, , l, f] = graph.edges[ei];
    m += l;
    if (f & F.STEPS) st++;
    if (f & F.ROUGH) rough += l;
    if (f & F.ROAD) road += l;
    if (f & F.COVERED) cov += l;
  }
  return { m, st, rough, road, cov };
}

function bearing(a: Pt, b: Pt) {
  return (Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180) / Math.PI; // 0 = 북쪽(화면 위)
}

const LANDMARK_RE = /경기장|홀|센터|박물관|기념관|역사관|수영|안내|테니스|컨벤션|무대|체조|도서관|미술관|광장|문$/;
const LANDMARKS = graph.buildings
  .filter((b) => b.name && LANDMARK_RE.test(b.name))
  .map((b) => ({
    name: b.name as string,
    x: b.p.reduce((s, q) => s + q[0], 0) / b.p.length,
    y: b.p.reduce((s, q) => s + q[1], 0) / b.p.length,
  }));

function landmarkNear(pt: Pt, max = 120) {
  let best: { name: string; d: number } | null = null;
  for (const l of LANDMARKS) {
    const d = Math.hypot(l.x - pt[0], l.y - pt[1]);
    if (d < max && (!best || d < best.d)) best = { name: l.name, d };
  }
  const alias: Record<string, string> = { 올림픽체조경기장: "KSPO DOME", SK올림픽핸드볼경기장: "티켓링크 라이브 아레나(핸드볼경기장)" };
  return best ? alias[best.name] ?? best.name : undefined;
}

/** 경로를 사람이 읽는 안내 문장으로: 방향이 크게 바뀌거나 길의 성격이 바뀔 때 끊고, 짧은 구간은 합친다 */
function directions(path: number[], edges: number[], dest: string): Step[] {
  type Seg = { kind: number; m: number; turn: string; end: number };
  const kindOf = (f: number) => (f & F.STEPS ? 1 : f & F.ROUGH ? 2 : f & F.ROAD ? 3 : 0);
  const segs: Seg[] = [];
  let cur: Seg | null = null;
  for (let i = 0; i < edges.length; i++) {
    const [, , l, f] = graph.edges[edges[i]];
    const k = kindOf(f);
    let turn = "";
    if (i > 0) {
      const a = graph.nodes[path[i - 1]];
      const b = graph.nodes[path[i]];
      const c = graph.nodes[path[i + 1]];
      let dθ = bearing(b, c) - bearing(a, b);
      dθ = ((dθ + 540) % 360) - 180;
      if (Math.abs(dθ) > 50) turn = dθ > 0 ? "오른쪽으로" : "왼쪽으로";
    }
    if (!cur || k !== cur.kind || (turn && cur.m > 30)) {
      if (cur) segs.push(cur);
      cur = { kind: k, m: 0, turn, end: path[i + 1] };
    }
    cur.m += l;
    cur.end = path[i + 1];
  }
  if (cur) segs.push(cur);

  // 30m 미만의 일반 구간은 앞 구간에 합침 (경고 구간은 짧아도 남김)
  const merged: Seg[] = [];
  for (const sg of segs) {
    const prev = merged[merged.length - 1];
    if (prev && sg.m < 30 && sg.kind === 0 && prev.kind !== 1) {
      prev.m += sg.m;
      prev.end = sg.end;
    } else if (prev && prev.kind === sg.kind && !sg.turn) {
      prev.m += sg.m;
      prev.end = sg.end;
    } else merged.push({ ...sg });
  }

  const out: Step[] = merged.map((sg, i): Step => ({ ...stepOf(sg, i), at: graph.nodes[sg.end] }));
  out.push({ icon: "📍", text: `${dest} 도착`, meters: 0, at: graph.nodes[path[path.length - 1]] });
  return out;

  function stepOf(sg: Seg, i: number): Step {
    const m = Math.round(sg.m / 5) * 5 || Math.round(sg.m);
    const lm = landmarkNear(graph.nodes[sg.end]);
    const until = lm && !dest.includes(lm) ? `${lm} 쪽으로 ` : "";
    const turn = i === 0 ? "" : sg.turn ? `${sg.turn} 돌아 ` : "";
    if (sg.kind === 1) return { icon: "⚠️", text: `${turn}계단 구간 (약 ${m}m)`, meters: m, warn: true };
    if (sg.kind === 2) return { icon: "🪨", text: `${turn}${until}바닥이 고르지 않은 길 ${m}m — 비 오면 미끄러워요`, meters: m, warn: true };
    if (sg.kind === 3) return { icon: "🚗", text: `${turn}${until}차가 다닐 수 있는 길 ${m}m, 차 조심`, meters: m };
    const icon = sg.turn === "오른쪽으로" && i ? "↱" : sg.turn === "왼쪽으로" && i ? "↰" : "⬆️";
    return { icon, text: `${turn}${until}${m}m 가요`, meters: m };
  }
}

/**
 * 걷는 속도(m/s) — 경찰청 「교통신호기 설치·운영·관리 업무편람」(2022)의 보행신호 기준:
 * 일반 1.0m/s, 교통약자(노인·어린이 보호구역) 0.7m/s.
 * (지팡이·휠체어를 쓰는 고령자 하위 15% 속도 0.73m/s — 한국ITS학회논문지 2020 연구와도 맞음)
 */
export const SPEED = (p: Profile) => (p.wheelchair || p.mobility || p.companion || p.lowvision ? 0.7 : 1.0);

export function findRoute(origin: Place, dest: Place, p: Profile): RouteResult | null {
  const to = new Set(dest.nodes);
  const r = dijkstra(origin.nodes, to, p);
  if (!r) return null;
  const base = dijkstra(origin.nodes, to, null);
  const s = summarize(r.edges);
  const sb = base ? summarize(base.edges) : s;
  const points: Pt[] = [[origin.x, origin.y], ...r.path.map((i) => graph.nodes[i]), [dest.x, dest.y]];
  return {
    points,
    meters: Math.round(s.m),
    minutes: Math.max(1, Math.round(s.m / SPEED(p) / 60)),
    stepsCount: s.st,
    avoidedSteps: Math.max(0, sb.st - s.st),
    extraMeters: Math.max(0, Math.round(s.m - sb.m)),
    roughMeters: Math.round(s.rough),
    roadMeters: Math.round(s.road),
    coveredMeters: Math.round(s.cov),
    steps: directions(r.path, r.edges, dest.name),
  };
}

export const places = graph.places;
export const venues = places.filter((p) => p.kind === "venue");
export const exits = places.filter((p) => p.kind === "exit");
export const parkings = places
  .filter((p) => p.kind === "parking")
  .sort((a, b) => (parseInt(a.name.replace(/\D/g, "") || "99", 10) - parseInt(b.name.replace(/\D/g, "") || "99", 10)) || a.name.localeCompare(b.name));
export const toilets = places.filter((p) => p.kind === "toilet");
export const stations = [...new Set(exits.map((e) => e.station!))];

/** 역을 고르면 사용자 조건에 가장 맞는 출구를 골라준다 */
export function bestExit(station: string, dest: Place, p: Profile) {
  const cands = exits.filter((e) => e.station === station);
  let best: { exit: Place; route: RouteResult; score: number } | null = null;
  for (const e of cands) {
    if (p.wheelchair && e.wheelchair === "no") continue;
    const r = findRoute(e, dest, p);
    if (!r) continue;
    const score = r.meters + r.stepsCount * 200 + (e.wheelchair === "yes" ? -50 : 0);
    if (!best || score < best.score) best = { exit: e, route: r, score };
  }
  return best;
}
