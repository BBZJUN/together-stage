import raw from "@/data/shows.json";
import type { Level, Show, ShowData } from "./types";

export const data = raw as ShowData;

export const isOfficial = data.source === "official";

/** 한국 시간 기준 오늘(YYYY-MM-DD) */
export function todayKST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 다가오는 공연 (지난 회차 제외). 남은 게 없으면 전체를 보여줌 */
export function getShows(): Show[] {
  const all = [...data.shows].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const today = todayKST();
  const upcoming = all.filter((s) => s.date >= today);
  return upcoming.length ? upcoming : all;
}

export function weatherText(w: Show["weather"]) {
  return w.sky ? `${w.sky} ${w.temp}°C` : `평년 기온 ${w.temp}°C`;
}

export function getShow(id: string): Show | undefined {
  return data.shows.find((s) => s.id === id);
}

export function peakOf(show: Show) {
  return show.forecast.hours.reduce((a, b) => (b.occ > a.occ ? b : a));
}

/** 공연 시작 시각 기준 점유율 */
export function occAtStart(show: Show) {
  const h = parseInt(show.start.slice(0, 2), 10);
  return show.forecast.hours.find((p) => p.h === h) ?? peakOf(show);
}

export function endTime(show: Show) {
  const [h, m] = show.start.split(":").map(Number);
  const t = h * 60 + m + show.runtime;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
export function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00+09:00");
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`;
}

export const LEVEL_STYLE: Record<Level, { color: string; icon: string }> = {
  원활: { color: "var(--lv-ok)", icon: "●" },
  보통: { color: "var(--lv-mid)", icon: "▲" },
  혼잡: { color: "var(--lv-busy)", icon: "◆" },
  만차: { color: "var(--lv-full)", icon: "■" },
};

export const AUDIENCE_LABEL = {
  mz: "K-POP·2030 관객 많음",
  senior: "중장년 관객 많음",
  family: "가족 관객 많음",
} as const;

export function shiftTime(t: string, minutes: number) {
  const [h, m] = t.split(":").map(Number);
  const v = h * 60 + m + minutes;
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(((v % 60) + 60) % 60).padStart(2, "0")}`;
}

/** "14:30" → "오후 2:30", "14:00" → "오후 2시" */
export function timeKo(t: string) {
  const h = parseInt(t.slice(0, 2), 10);
  const m = parseInt(t.slice(3, 5), 10);
  const ap = h < 12 ? "오전" : "오후";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m ? `${ap} ${hh}:${String(m).padStart(2, "0")}` : `${ap} ${hh}시`;
}

/** 공연 전 4시간 안에서 사람이 몰리기 시작하는 시각과, 그보다 30분 이른 도착 권장 시각 */
export function arrivalAdvice(show: Show) {
  const startH = parseInt(show.start.slice(0, 2), 10);
  const win = show.forecast.hours.filter((p) => p.h >= startH - 4 && p.h <= startH);
  const top = win.reduce((a, b) => (b.cars > a.cars ? b : a), win[0] ?? show.forecast.hours[0]);
  const rise = win.find((p) => p.cars >= top.cars * 0.85 && p.cars > (win[0]?.cars ?? 0) * 1.05);
  const busyHour = rise && rise.h < startH ? rise.h : undefined;
  const arrive = busyHour !== undefined ? shiftTime(`${String(busyHour).padStart(2, "0")}:00`, -30) : shiftTime(show.start, -90);
  return { busyHour, arrive };
}
