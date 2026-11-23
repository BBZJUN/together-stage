/**
 * KSPO DOME 좌석·시야 엔진 — 실측 3D 형상 기반
 *
 * 한국체육산업개발_올림픽공원 공연장 실감형 콘텐츠(KSPO DOME, DAE 2,635,561 삼각형)를
 * 0.5m 격자 높이지도(src/data/kspo_height.json)로 변환해 좌석 배치와 시야 계산에 사용한다.
 * 좌표계: 돔 중심 원점, y 위쪽, 단위 m. 공연 무대는 -x 쪽 플로어 끝(설정값).
 */
import hf from "@/data/kspo_height.json";

export type Vec3 = [number, number, number];

export interface StageConfig {
  type: "end" | "thrust" | "center";
  width: number;
  depth: number;
  height: number;
  thrustLength: number;
  speakers: boolean;
  ledHeight: number;
}

export interface Seat {
  id: string;
  tier: string; // 공식 표기: "플로어"(1층) | "2층"(하단 스탠드) | "3층"(상단 스탠드)
  /** 공식 블록: 2층 B(1~4)·C(5~11, 무대 정면)·D(12~15)·A(16~22) */
  block?: string;
  section: string;
  row: number;
  num: number;
  pos: Vec3;
  wheelchair: boolean;
  aisleAccess: boolean;
}

/* ───────────── 높이지도 ───────────── */

const R = hf.R;
const RES = hf.res;
const N = hf.n;
const H: Int16Array = (() => {
  const bin = typeof atob === "function" ? atob(hf.cm) : Buffer.from(hf.cm, "base64").toString("binary");
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Int16Array(buf.buffer);
})();

/** (x,z) 지점 구조물 최고 높이(m). 비어 있으면 -1 */
export function heightAt(x: number, z: number): number {
  const ix = Math.floor((x + R) / RES);
  const iz = Math.floor((z + R) / RES);
  if (ix < 0 || iz < 0 || ix >= N || iz >= N) return -1;
  const v = H[iz * N + ix];
  return v < 0 ? -1 : v / 100;
}

/** 주변 1m 안의 최대값 (격자 빈칸 보정) */
function heightNear(x: number, z: number, r = 0.75): number {
  let m = -1;
  for (let dx = -r; dx <= r; dx += RES) for (let dz = -r; dz <= r; dz += RES) m = Math.max(m, heightAt(x + dx, z + dz));
  return m;
}

export const FLOOR_R = 23.5; // 플로어 반경
export const STAND_R0 = 24.6; // 첫 줄
export const STAND_R1 = 57.0; // 마지막 줄
export const ROW_DEPTH = 0.85;
const UPPER_START = 40.5; // 이 반경부터 2층

export const STAGE_PRESETS: Record<"end" | "thrust", { label: string; desc: string; stage: StageConfig }> = {
  end: {
    label: "끝무대",
    desc: "플로어 한쪽 끝에 무대",
    stage: { type: "end", width: 22, depth: 8, height: 1.8, thrustLength: 0, speakers: true, ledHeight: 9 },
  },
  thrust: {
    label: "돌출무대",
    desc: "무대가 객석 쪽으로 14m 뻗음",
    stage: { type: "thrust", width: 22, depth: 8, height: 1.8, thrustLength: 14, speakers: true, ledHeight: 9 },
  },
};

export const DEFAULT_STAGE: StageConfig = {
  type: "end",
  width: 22,
  depth: 8,
  height: 1.8,
  thrustLength: 0,
  speakers: true,
  ledHeight: 9,
};

const STAGE_FRONT_X = -13; // 메인 무대 앞선 (플로어 서쪽 끝 무대)
export const stageFrontX = () => STAGE_FRONT_X;

/**
 * 공식 구역 번호: 2층 1~22구역(무대 정면 C블록 5~11, 가운데 8구역), 3층은 같은 방향으로 23구역부터.
 * 출처: 올림픽공원 공식 좌석배치도(블록 구분). 구역 경계 각도는 22등분 추정.
 */
const SECTION_DEG = 360 / 22;
export function sectionNo(tier: string, angle: number) {
  const deg = (angle * 180) / Math.PI;
  const k = ((((Math.round(deg / SECTION_DEG) + 7) % 22) + 22) % 22) + 1;
  return tier === "2층" ? k : k + 22;
}
export function blockOf(no: number) {
  const k = no > 22 ? no - 22 : no;
  return k <= 4 ? "B" : k <= 11 ? "C" : k <= 15 ? "D" : "A";
}
function sectionLabel(tier: string, angle: number) {
  return `${sectionNo(tier, angle)}구역`;
}
/** 구역 번호 → 그 구역 가운데 각도(라디안) */
export function sectionAngle(no: number) {
  const k = no > 22 ? no - 22 : no;
  return ((k - 8) * SECTION_DEG * Math.PI) / 180;
}

/**
 * 휠체어석: 올림픽공원 공식 좌석배치도 기준 "C블록(무대 정면, 5~11구역) 뒤편 장애인석"
 * (ksponco.or.kr 일정안내 좌석배치도). 정면 스탠드 하단 구역 끝줄에 배치. 세부 좌석 번호는 추정.
 */
// 국내 기준: 관람석 1% 이상, 2천 석 이상이면 20석 이상 (공연장안전지원센터 「객석 설계 안전 가이드」 재인용) → 20석 내외로 배치
const WHEEL_ANGLES = [-36, -27, -18, -9, 0, 9, 18, 27, 36].map((d) => (d * Math.PI) / 180);
/** 휠체어석 앞 난간(펜스) 기본 높이: 객석통로 난간 기준 900~1,000mm의 상단 (실측값 아님) */
export const DEFAULT_FENCE = 1.0;

/** 무대 뒤로 시야가 막히는 각도(무대 뒤편 스탠드)는 좌석 판매 안 함 */
function behindStage(a: number) {
  const d = Math.abs(((a - Math.PI + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  return d < (32 * Math.PI) / 180;
}

export function generateSeats(stage: StageConfig = DEFAULT_STAGE): Seat[] {
  const seats: Seat[] = [];
  let lowerRows = 0;
  let row = 0;
  for (let rn = STAND_R0; rn <= STAND_R1; rn += ROW_DEPTH) {
    const tier = rn < UPPER_START ? "2층" : "3층";
    if (tier === "2층") lowerRows++;
    row = tier === "2층" ? lowerRows : Math.round((rn - UPPER_START) / ROW_DEPTH) + 1;
    const n = Math.floor((2 * Math.PI * rn) / 0.55);
    const counter: Record<string, number> = {};
    const lastLower = rn + ROW_DEPTH >= UPPER_START && tier === "2층";
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (behindStage(a)) continue;
      const x = Math.cos(a) * rn;
      const z = Math.sin(a) * rn;
      const h = heightAt(x, z);
      const hn = heightNear(x, z, 0.5);
      if (hn < 0.3) continue; // 통로·출입구(빈칸)
      // 가로 통로: 앞뒤 줄보다 확 꺼진 곳은 좌석 없음
      const ahead = heightNear(Math.cos(a) * (rn + 0.9), Math.sin(a) * (rn + 0.9), 0.4);
      if (ahead >= 0 && ahead - hn > 1.2) continue;
      const section = sectionLabel(tier, a);
      counter[section] = (counter[section] ?? 0) + 1;
      const num = counter[section];
      const wheelchair = lastLower && WHEEL_ANGLES.some((w) => Math.abs(Math.atan2(Math.sin(a - w), Math.cos(a - w))) < 0.05) && num % 2 === 0;
      seats.push({
        id: `${tier}-${section}-${row}-${num}`,
        tier,
        block: blockOf(parseInt(section)),
        section,
        row,
        num,
        pos: [x, Math.max(h, hn - 0.35), z],
        wheelchair,
        aisleAccess: lastLower || row === 1,
      });
    }
  }
  // 플로어 스탠딩
  if (stage.type !== "center") {
    let fr = 0;
    for (let x = STAGE_FRONT_X + 1.5; x < FLOOR_R - 2; x += 0.75) {
      fr++;
      let num = 0;
      for (let z = -FLOOR_R; z <= FLOOR_R; z += 0.6) {
        if (Math.hypot(x, z) > FLOOR_R - 1.5) continue;
        if (Math.abs(z) > 16) continue;
        if (stage.type === "thrust" && x < STAGE_FRONT_X + stage.thrustLength + 1.5 && Math.abs(z) < 3) continue;
        if (x > 6 && x < 10.5 && Math.abs(z) < 3.5) continue; // 음향 콘솔
        num++;
        const block = z < -5.5 ? "A" : z > 5.5 ? "C" : "B";
        seats.push({
          id: `플로어-${block}-${fr}-${num}`,
          tier: "플로어",
          section: `플로어 ${block}`,
          row: fr,
          num,
          pos: [x, 0, z],
          wheelchair: false, // 공식 배치도상 플로어 장애인석 없음
          aisleAccess: true,
        });
      }
    }
  }
  return seats;
}

/* ───────────── 시야 계산 ───────────── */

interface Box {
  min: Vec3;
  max: Vec3;
  /** 가림 원인 이름 */
  kind?: BlockCause;
}

export function stageObstacles(stage: StageConfig): Box[] {
  const boxes: Box[] = [];
  if (stage.speakers) {
    const zOff = stage.width / 2 + 1.8;
    for (const s of [-1, 1]) boxes.push({ min: [STAGE_FRONT_X - 2, 6, s * zOff - 1.1], max: [STAGE_FRONT_X + 0.4, 13, s * zOff + 1.1], kind: "스피커" });
  }
  boxes.push({ min: [6, 0, -3.5], max: [10.5, 2.6, 3.5], kind: "구조물" }); // 음향·조명 콘솔(FOH)
  return boxes;
}

export function stageTargets(stage: StageConfig): Vec3[] {
  const pts: Vec3[] = [];
  const top = stage.height;
  for (const z of [-0.4, -0.2, 0, 0.2, 0.4].map((k) => k * stage.width)) {
    for (const h of [1.0, 1.7]) pts.push([STAGE_FRONT_X - 2, top + h, z]);
  }
  for (const z of [-0.3, 0, 0.3].map((k) => k * stage.width)) pts.push([STAGE_FRONT_X - stage.depth + 0.5, top + stage.ledHeight * 0.6, z]);
  if (stage.type === "thrust" && stage.thrustLength > 0) {
    for (const k of [0.5, 1]) pts.push([STAGE_FRONT_X + stage.thrustLength * k, top + 1.2, 0]);
  }
  return pts;
}

function inBox(p: Vec3, b: Box) {
  return p[0] >= b.min[0] && p[0] <= b.max[0] && p[1] >= b.min[1] && p[1] <= b.max[1] && p[2] >= b.min[2] && p[2] <= b.max[2];
}

function hash(ix: number, iz: number, salt: number) {
  const h = Math.sin(ix * 127.1 + iz * 311.7 + salt * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
/** 시야 계산과 1인칭 화면이 같은 관객 배치를 쓰도록 공개 */
export const headAt = (x: number, z: number) => hash(Math.floor(x / 0.5), Math.floor(z / 0.5), 0) < 0.6;
export const headVar = (x: number, z: number) => hash(Math.floor(x / 0.5), Math.floor(z / 0.5), 1) * 0.25 - 0.15;

type BlockKind = "관객" | "구조물";

function blockAt(x: number, z: number, standing: boolean, stage: StageConfig): { h: number; kind: BlockKind } {
  const head = standing ? 1.75 : 1.2;
  const thrustEnd = STAGE_FRONT_X + (stage.type === "thrust" ? stage.thrustLength : 0);
  if (x < STAGE_FRONT_X && x > STAGE_FRONT_X - stage.depth && Math.abs(z) < stage.width / 2) return { h: stage.height, kind: "구조물" };
  if (stage.type === "thrust" && x >= STAGE_FRONT_X && x < thrustEnd && Math.abs(z) < 2.5) return { h: stage.height, kind: "구조물" };
  const r = Math.hypot(x, z);
  if (r < FLOOR_R) {
    if (x > STAGE_FRONT_X && Math.abs(z) <= 16) return { h: headAt(x, z) ? head + headVar(x, z) : 0.9, kind: "관객" };
    return { h: 0, kind: "구조물" };
  }
  // 스탠드: 실측 구조물 높이 + (좌석이면) 관객 머리
  const g = heightAt(x, z);
  if (g < 0) return { h: 0, kind: "구조물" };
  if (r >= STAND_R0 - 0.3 && r <= STAND_R1 && headAt(x, z)) return { h: g + head + headVar(x, z) - 0.4, kind: "관객" };
  return { h: g, kind: "구조물" };
}

export type BlockCause = "앞사람" | "구조물" | "스피커" | "펜스";

export interface Visibility {
  ratio: number;
  blockedBy: BlockCause | null;
}

export function seatVisibility(
  seat: Seat,
  stage: StageConfig,
  opts: { standing: boolean; seated?: boolean; platform?: number; fence?: number },
  targets = stageTargets(stage),
  obstacles = stageObstacles(stage),
): Visibility {
  const sitting = seat.wheelchair || opts.seated || !opts.standing;
  const eyeH = seat.wheelchair ? 1.2 + (opts.platform ?? 0) : sitting ? 1.15 : 1.6;
  const eye: Vec3 = [seat.pos[0], seat.pos[1] + eyeH, seat.pos[2]];
  let ok = 0;
  const cause: Record<BlockCause, number> = { 앞사람: 0, 구조물: 0, 스피커: 0, 펜스: 0 };
  // 휠체어석 앞 0.4~0.7m 난간: 원래 바닥 기준 높이 (단상을 올리면 눈높이만 올라감)
  const fenceTop = seat.wheelchair ? seat.pos[1] + (opts.fence ?? DEFAULT_FENCE) : -Infinity;
  for (const t of targets) {
    const d: Vec3 = [t[0] - eye[0], t[1] - eye[1], t[2] - eye[2]];
    const len = Math.hypot(d[0], d[1], d[2]);
    const steps = Math.ceil(len / 0.4);
    let blocked: BlockCause | null = null;
    // 눈앞 0.55m 난간 윗선보다 시선이 낮으면 펜스에 가림
    const hl = Math.hypot(d[0], d[2]);
    if (hl > 0 && eye[1] + d[1] * (0.55 / hl) < fenceTop) blocked = "펜스";
    for (let i = 1; i < steps - 1 && !blocked; i++) {
      const k = i / steps;
      const p: Vec3 = [eye[0] + d[0] * k, eye[1] + d[1] * k, eye[2] + d[2] * k];
      if (Math.hypot(p[0] - eye[0], p[2] - eye[2]) < 0.7) continue;
      const ob = obstacles.find((b) => inBox(p, b));
      if (ob) {
        blocked = ob.kind ?? "구조물";
        break;
      }
      const b = blockAt(p[0], p[2], opts.standing, stage);
      if (p[1] < b.h) {
        blocked = b.kind === "관객" ? "앞사람" : "구조물";
        break;
      }
    }
    if (blocked) cause[blocked]++;
    else ok++;
  }
  const ratio = ok / targets.length;
  const top = (Object.entries(cause) as [BlockCause, number][]).sort((a, b) => b[1] - a[1])[0];
  return { ratio, blockedBy: ratio < 1 && top[1] > 0 ? top[0] : null };
}

export function visibilityLabel(r: number) {
  if (r >= 0.85) return { text: "잘 보여요", tone: "good" as const };
  if (r >= 0.6) return { text: "조금 가려요", tone: "mid" as const };
  if (r >= 0.3) return { text: "많이 가려요", tone: "bad" as const };
  return { text: "거의 안 보여요", tone: "worst" as const };
}

export function distanceToStage(seat: Seat) {
  return Math.round(Math.hypot(seat.pos[0] - STAGE_FRONT_X, seat.pos[2]));
}
