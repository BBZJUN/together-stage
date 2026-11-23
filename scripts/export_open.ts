/** 가공 데이터 재공개용 정적 파일: KSPO DOME 좌석별 시야 (끝무대 기본 배치) */
import { writeFileSync } from "node:fs";
import { DEFAULT_STAGE, generateSeats, seatVisibility, stageObstacles, stageTargets } from "../src/lib/venue";

const st = DEFAULT_STAGE;
const seats = generateSeats(st);
const T = stageTargets(st);
const O = stageObstacles(st);
const head = ["좌석ID", "층", "블록", "구역", "열", "번호", "휠체어석", "x_m", "y_m", "z_m", "무대까지_m", "앉아서_보임(%)", "일어서서_보임(%)", "일어섬_주원인"];
const rows = seats.map((s) => {
  const a = seatVisibility(s, st, { standing: false }, T, O);
  const b = seatVisibility(s, st, { standing: true }, T, O);
  return [s.id, s.tier, s.block ?? s.section.replace("플로어 ", ""), s.section, s.row, s.num, s.wheelchair ? "Y" : "N", s.pos[0].toFixed(2), s.pos[1].toFixed(2), s.pos[2].toFixed(2), Math.round(Math.hypot(s.pos[0] + 13, s.pos[2])), Math.round(a.ratio * 100), Math.round(b.ratio * 100), b.blockedBy ?? ""];
});
writeFileSync("public/open/kspo_dome_seat_visibility.csv", "﻿" + [head, ...rows].map((r) => r.join(",")).join("\n"));
console.log("rows", rows.length);
