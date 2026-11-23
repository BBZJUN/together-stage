"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_STAGE,
  distanceToStage,
  generateSeats,
  seatVisibility,
  stageObstacles,
  stageTargets,
  visibilityLabel,
  type Seat,
  type StageConfig,
  type Visibility,
} from "@/lib/venue";
import type { ViewMode } from "./Venue3D";
import { Accessibility } from "lucide-react";
import { IconTile } from "./ui";

const Venue3D = dynamic(() => import("./Venue3D"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-[0.875rem] text-ink-3">공연장을 불러오고 있어요</div>,
});

const TONE_RGB: Record<string, [number, number, number]> = {
  good: [0.19, 0.51, 0.96],
  mid: [0.56, 0.72, 0.97],
  bad: [1.0, 0.7, 0.48],
  worst: [0.94, 0.27, 0.32],
  pending: [0.82, 0.84, 0.86],
};
const TONE_TEXT: Record<string, string> = {
  good: "text-blue",
  mid: "text-[#4a7fd4]",
  bad: "text-[#d9741f]",
  worst: "text-[#f04452]",
};

export default function SeatViewer({ stage = DEFAULT_STAGE, venueName = "KSPO DOME" }: { stage?: StageConfig; venueName?: string }) {
  const seats = useMemo(() => generateSeats(stage), [stage]);
  const [standing, setStanding] = useState(true);
  const [onlyWheel, setOnlyWheel] = useState(false);
  const [vis, setVis] = useState<(Visibility | null)[]>(() => seats.map(() => null));
  const [selected, setSelected] = useState<Seat | null>(null);
  const [mode, setMode] = useState<ViewMode>("overview");
  const job = useRef(0);

  // 시야는 좌석이 많아 잘게 나눠 계산 (화면 멈춤 방지). 휠체어석을 먼저 계산.
  useEffect(() => {
    const id = ++job.current;
    const targets = stageTargets(stage);
    const obstacles = stageObstacles(stage);
    const out: (Visibility | null)[] = seats.map(() => null);
    const order = seats.map((_, i) => i).sort((a, b) => Number(seats[b].wheelchair) - Number(seats[a].wheelchair));
    let k = 0;
    const tick = () => {
      if (id !== job.current) return;
      const end = Math.min(order.length, k + 1200);
      for (; k < end; k++) {
        const i = order[k];
        // 일반석은 3석마다 계산하고 옆자리는 같은 값 사용
        if (!seats[i].wheelchair && i % 3 !== 0 && out[i - (i % 3)]) {
          out[i] = out[i - (i % 3)];
          continue;
        }
        out[i] = seatVisibility(seats[i], stage, { standing }, targets, obstacles);
      }
      setVis([...out]);
      if (k < order.length) setTimeout(tick, 0);
    };
    tick();
  }, [seats, stage, standing]);

  const colors = useMemo(() => {
    const c = new Float32Array(seats.length * 3);
    seats.forEach((s, i) => {
      let rgb = TONE_RGB.pending;
      const v = vis[i];
      if (onlyWheel && !s.wheelchair) rgb = [0.88, 0.9, 0.92];
      else if (v) rgb = TONE_RGB[visibilityLabel(v.ratio).tone];
      c.set(rgb, i * 3);
    });
    return c;
  }, [seats, vis, onlyWheel]);

  const wheelSeats = seats.filter((s) => s.wheelchair);
  const selIdx = selected ? seats.findIndex((s) => s.id === selected.id) : -1;
  const sv = selIdx >= 0 ? vis[selIdx] : null;
  const label = sv ? visibilityLabel(sv.ratio) : null;
  const done = vis.filter(Boolean).length;

  const wheelStats = useMemo(() => {
    const vs = seats.map((s, i) => (s.wheelchair ? vis[i] : null)).filter(Boolean) as Visibility[];
    if (vs.length === 0) return null;
    return { avg: vs.reduce((a, v) => a + v.ratio, 0) / vs.length, poor: vs.filter((v) => v.ratio < 0.6).length, n: vs.length };
  }, [seats, vis]);

  return (
    <div className="flex flex-col">
      <div className="relative h-[52vh] min-h-[320px] bg-grey-100">
        <Venue3D
          seats={seats}
          colors={colors}
          stage={stage}
          selected={selected}
          mode={mode}
          standing={standing}
          onSelect={(s) => setSelected(s)}
        />
        <div className="pointer-events-none absolute left-4 top-3 rounded-xl bg-white/90 px-3 py-1.5 text-[0.8125rem] font-semibold text-ink-2">
          {venueName} {done < seats.length ? `시야 계산 중 ${Math.round((done / seats.length) * 100)}%` : ""}
        </div>
        {mode === "seat" && (
          <button
            onClick={() => setMode("overview")}
            className="press absolute right-4 top-3 rounded-xl bg-white px-3 py-1.5 text-[0.8125rem] font-semibold text-ink"
          >
            전체 보기
          </button>
        )}
        <div className="pointer-events-none absolute bottom-3 left-4 flex gap-2 text-[0.75rem] font-semibold">
          {(["good", "mid", "bad", "worst"] as const).map((t) => (
            <span key={t} className="flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-ink-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: `rgb(${TONE_RGB[t].map((x) => x * 255).join(",")})` }} />
              {{ good: "잘 보임", mid: "조금 가림", bad: "많이 가림", worst: "거의 안 보임" }[t]}
            </span>
          ))}
        </div>
      </div>

      <section className="band px-5 py-5">
        <div className="flex gap-2">
          <button
            onClick={() => setStanding(!standing)}
            aria-pressed={standing}
            className={`press flex-1 rounded-2xl px-4 py-3 text-left ${standing ? "bg-blue-soft" : "bg-grey-100"}`}
          >
            <span className="block text-[0.8125rem] text-ink-3">앞사람이</span>
            <span className={`block text-[1rem] font-bold ${standing ? "text-blue" : "text-ink"}`}>{standing ? "일어서서 볼 때" : "앉아서 볼 때"}</span>
          </button>
          <button
            onClick={() => setOnlyWheel(!onlyWheel)}
            aria-pressed={onlyWheel}
            className={`press flex-1 rounded-2xl px-4 py-3 text-left ${onlyWheel ? "bg-blue-soft" : "bg-grey-100"}`}
          >
            <span className="block text-[0.8125rem] text-ink-3">표시</span>
            <span className={`block text-[1rem] font-bold ${onlyWheel ? "text-blue" : "text-ink"}`}>{onlyWheel ? "휠체어석만" : "모든 좌석"}</span>
          </button>
        </div>

        {selected && sv && label ? (
          <div className="rise mt-5">
            <p className="text-[0.9375rem] text-ink-3">
              {selected.tier} {selected.section} {selected.row}열 {selected.num}번 {selected.wheelchair && "· 휠체어석"}
            </p>
            <p className={`mt-1 text-[1.75rem] font-bold tracking-tight ${TONE_TEXT[label.tone]}`}>{label.text}</p>
            <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">
              무대의 {Math.round(sv.ratio * 100)}%가 보여요. 무대까지 약 {distanceToStage(selected)}m
              {sv.blockedBy && `, 주로 ${sv.blockedBy} 때문에 가려요`}.
            </p>
            <button
              onClick={() => setMode(mode === "seat" ? "overview" : "seat")}
              className="press mt-4 h-14 w-full rounded-2xl bg-blue text-[1.0625rem] font-semibold text-white"
            >
              {mode === "seat" ? "전체 공연장 보기" : "이 자리에서 무대 보기"}
            </button>
          </div>
        ) : (
          <p className="mt-5 text-[0.9375rem] text-ink-3">3D에서 좌석을 누르거나, 아래 휠체어석 목록에서 골라보세요.</p>
        )}
      </section>

      <section className="band px-5 py-5">
        <h2 className="text-[1.25rem] font-bold leading-snug tracking-tight">
          {wheelStats ? (
            <>
              앞사람이 {standing ? "일어서면" : "앉아 있으면"} 휠체어석 {wheelStats.n}석 중
              <br />
              {wheelStats.poor}석은 무대가 많이 가려요
            </>
          ) : (
            "휠체어석 시야를 계산하고 있어요"
          )}
        </h2>
        <ul className="mt-3">
          {wheelSeats.slice(0, 40).map((s) => {
            const i = seats.indexOf(s);
            const v = vis[i];
            const l = v ? visibilityLabel(v.ratio) : null;
            return (
              <li key={s.id}>
                <button
                  onClick={() => {
                    setSelected(s);
                    setMode("seat");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="press flex w-full items-center gap-3 py-2.5 text-left"
                >
                  <IconTile icon={Accessibility} tone="blue" />
                  <span className="flex-1">
                    <span className="block text-[0.9375rem] font-semibold">
                      {s.tier} {s.section} {s.row}열 {s.num}번
                    </span>
                    <span className="block text-[0.8125rem] text-ink-3">무대까지 약 {distanceToStage(s)}m</span>
                  </span>
                  {l && v && (
                    <span className={`num text-[0.9375rem] font-bold ${TONE_TEXT[l.tone]}`}>{Math.round(v.ratio * 100)}%</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-3">
          공연장 형상은 한국체육산업개발이 공개한 KSPO DOME 실감형 콘텐츠(3D)에서 가져왔어요. 휠체어석 위치와 무대 배치는 예시라 공연마다 달라질 수 있어요.
        </p>
      </section>
    </div>
  );
}
