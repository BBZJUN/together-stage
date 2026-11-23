"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Accessibility, Building2, Eye, Maximize2 } from "lucide-react";
import {
  distanceToStage,
  generateSeats,
  seatVisibility,
  STAGE_PRESETS,
  stageObstacles,
  stageTargets,
  visibilityLabel,
  type Seat,
  type Visibility,
} from "@/lib/venue";
import type { ViewMode } from "./Venue3D";
import { BottomSheet } from "./BottomSheet";
import { IconTile, Segmented } from "./ui";

const Venue3D = dynamic(() => import("./Venue3D"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-[0.875rem] text-ink-3">공연장을 불러오고 있어요</div>,
});

const TONE_RGB: Record<string, [number, number, number]> = {
  good: [0.19, 0.51, 0.96],
  mid: [0.56, 0.72, 0.97],
  bad: [1.0, 0.7, 0.48],
  worst: [0.83, 0.17, 0.24],
  pending: [0.82, 0.84, 0.86],
};
const TONE_TEXT: Record<string, string> = { good: "text-blue", mid: "text-[#3b6fc4]", bad: "text-[#c4500c]", worst: "text-[#d42c3c]" };
const TONE_LABEL = { good: "잘 보임", mid: "조금 가림", bad: "많이 가림", worst: "거의 안 보임" } as const;

type StageKey = keyof typeof STAGE_PRESETS;

function wheelStats(seats: Seat[], stageKey: StageKey, standing: boolean, platform: number) {
  const st = STAGE_PRESETS[stageKey].stage;
  const T = stageTargets(st);
  const O = stageObstacles(st);
  const vs = seats.filter((s) => s.wheelchair).map((s) => seatVisibility(s, st, { standing, platform }, T, O).ratio);
  return { avg: Math.round((vs.reduce((a, b) => a + b, 0) / Math.max(1, vs.length)) * 100), poor: vs.filter((v) => v < 0.6).length, n: vs.length };
}

export default function SeatViewer() {
  const [stageKey, setStageKey] = useState<StageKey>("end");
  const stage = STAGE_PRESETS[stageKey].stage;
  const seats = useMemo(() => generateSeats(stage), [stage]);
  const [standing, setStanding] = useState(true);
  const [platform, setPlatform] = useState(0);
  const [onlyWheel, setOnlyWheel] = useState(false);
  const [vis, setVis] = useState<(Visibility | null)[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  // 무대 배치가 바뀌어도 같은 좌석 id로 다시 찾음
  const selected = useMemo(() => (selId ? seats.find((s) => s.id === selId) ?? null : null), [selId, seats]);
  const [mode, setMode] = useState<ViewMode>("overview");
  const [snap, setSnap] = useState(0);
  const [boxH, setBoxH] = useState(640);
  const box = useRef<HTMLDivElement>(null);
  const job = useRef(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const snaps = useMemo(() => [150, Math.max(330, Math.round(boxH * 0.52)), boxH - 12], [boxH]);

  // 시야 계산은 잘게 나눠서 (휠체어석 먼저)
  useEffect(() => {
    const id = ++job.current;
    const T = stageTargets(stage);
    const O = stageObstacles(stage);
    const out: (Visibility | null)[] = seats.map(() => null);
    const order = seats.map((_, i) => i).sort((a, b) => Number(seats[b].wheelchair) - Number(seats[a].wheelchair));
    let k = 0;
    const tick = () => {
      if (id !== job.current) return;
      const end = Math.min(order.length, k + 1200);
      for (; k < end; k++) {
        const i = order[k];
        if (!seats[i].wheelchair && i % 3 !== 0 && out[i - (i % 3)]) {
          out[i] = out[i - (i % 3)];
          continue;
        }
        out[i] = seatVisibility(seats[i], stage, { standing, platform }, T, O);
      }
      setVis([...out]);
      if (k < order.length) setTimeout(tick, 0);
    };
    tick();
  }, [seats, stage, standing, platform]);

  const colors = useMemo(() => {
    const c = new Float32Array(seats.length * 3);
    seats.forEach((s, i) => {
      let rgb = TONE_RGB.pending;
      const v = vis[i];
      if (onlyWheel && !s.wheelchair) rgb = [0.9, 0.91, 0.93];
      else if (v) rgb = TONE_RGB[visibilityLabel(v.ratio).tone];
      c.set(rgb, i * 3);
    });
    return c;
  }, [seats, vis, onlyWheel]);

  const compare = useMemo(
    () => [
      { label: "앞사람이 앉았을 때", ...wheelStats(seats, stageKey, false, 0) },
      { label: "앞사람이 일어섰을 때", ...wheelStats(seats, stageKey, true, 0) },
      { label: "일어섬 + 휠체어석 단상 60cm", ...wheelStats(seats, stageKey, true, 0.6) },
    ],
    [seats, stageKey],
  );
  const cur = compare[platform ? 2 : standing ? 1 : 0];

  const wheelSeats = seats.filter((s) => s.wheelchair);
  const selIdx = selected ? seats.findIndex((s) => s.id === selected.id) : -1;
  const sv = selIdx >= 0 ? vis[selIdx] : null;
  const label = sv ? visibilityLabel(sv.ratio) : null;
  const done = vis.filter(Boolean).length;

  const pick = useCallback((s: Seat) => {
    setSelId(s.id);
    setSnap((i) => Math.max(i, 1));
  }, []);

  const header =
    selected && sv && label ? (
      <div className="pb-4">
        <p className="text-[0.875rem] text-ink-3">
          {selected.tier} {selected.section} {selected.row}열 {selected.num}번{selected.wheelchair ? " · 휠체어석" : ""}
        </p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <p className={`text-[1.625rem] font-bold leading-tight tracking-tight ${TONE_TEXT[label.tone]}`}>{label.text}</p>
          <button
            onClick={() => setMode(mode === "seat" ? "overview" : "seat")}
            className="press flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-blue px-4 text-[0.875rem] font-semibold text-white"
          >
            {mode === "seat" ? <Maximize2 size={15} /> : <Eye size={15} />}
            {mode === "seat" ? "전체 보기" : "이 자리에서 보기"}
          </button>
        </div>
      </div>
    ) : (
      <div className="pb-4">
        <p className="text-[0.875rem] text-ink-3">
          KSPO DOME · {STAGE_PRESETS[stageKey].label} · 앞사람이 {standing ? "일어섰을 때" : "앉았을 때"}
          {platform ? " · 단상 60cm" : ""}
        </p>
        <p className="mt-1 text-[1.25rem] font-bold leading-snug tracking-tight">
          휠체어석 {cur.n}석 평균 <span className="text-blue">{cur.avg}%</span> 보여요
        </p>
      </div>
    );

  return (
    <div ref={box} className="relative h-[calc(100dvh-7rem-env(safe-area-inset-bottom))] min-h-[520px] overflow-hidden bg-grey-100">
      <div className="absolute inset-x-0 top-0" style={{ bottom: snaps[0] - 28 }}>
        <Venue3D seats={seats} colors={colors} stage={stage} selected={selected} mode={mode} standing={standing} onSelect={pick} />
      </div>

      <div className="pointer-events-none absolute inset-x-4 top-3 z-10 flex items-start justify-between gap-2">
        <span className="rounded-xl bg-bg/90 px-3 py-1.5 text-[0.8125rem] font-semibold text-ink-2 shadow-sm">
          {done < seats.length ? `시야 계산 중 ${Math.round((done / Math.max(1, seats.length)) * 100)}%` : "좌석을 눌러보세요"}
        </span>
        <button
          onClick={() => setOnlyWheel(!onlyWheel)}
          aria-pressed={onlyWheel}
          className={`press pointer-events-auto flex h-9 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-semibold shadow-[0_2px_10px_rgba(0,0,0,0.12)] ${
            onlyWheel ? "bg-ink text-white" : "bg-bg text-ink-2"
          }`}
        >
          <Accessibility size={15} /> 휠체어석만
        </button>
      </div>

      <BottomSheet snaps={snaps} index={snap} onIndexChange={setSnap} header={header} label="시야 정보">
        <div className="flex flex-wrap gap-1.5 pb-4">
          {(["good", "mid", "bad", "worst"] as const).map((t) => (
            <span key={t} className="flex items-center gap-1 rounded-lg bg-grey-50 px-2 py-1 text-[0.75rem] font-semibold text-ink-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: `rgb(${TONE_RGB[t].map((x) => x * 255).join(",")})` }} />
              {TONE_LABEL[t]}
            </span>
          ))}
        </div>

        {selected && sv && (
          <p className="mb-4 rounded-2xl bg-grey-50 px-4 py-3 text-[0.9375rem] leading-relaxed text-ink-2">
            무대의 <b className="text-ink">{Math.round(sv.ratio * 100)}%</b>가 보여요. 무대까지 약 {distanceToStage(selected)}m
            {sv.blockedBy ? `, 주로 ${sv.blockedBy} 때문에 가려요.` : "."}
          </p>
        )}

        <p className="text-[0.8125rem] font-semibold text-ink-3">앞사람이</p>
        <div className="mt-1.5">
          <Segmented
            label="앞사람 자세"
            value={standing ? "stand" : "sit"}
            onChange={(v) => setStanding(v === "stand")}
            options={[
              { value: "sit", label: "앉아서 볼 때" },
              { value: "stand", label: "일어서서 볼 때" },
            ]}
          />
        </div>

        <section className="mt-6 rounded-3xl border border-grey-200 p-4">
          <div className="flex items-center gap-3">
            <IconTile icon={Building2} tone="purple" size="sm" />
            <div>
              <h2 className="text-[1.0625rem] font-bold">무대 배치 점검</h2>
              <p className="text-[0.8125rem] text-ink-3">기관·기획사용 · 실감형 콘텐츠(3D) 기반</p>
            </div>
          </div>
          <p className="mt-4 text-[0.8125rem] font-semibold text-ink-3">무대 배치</p>
          <div className="mt-1.5">
            <Segmented
              label="무대 배치"
              value={stageKey}
              onChange={(v) => setStageKey(v)}
              options={(Object.keys(STAGE_PRESETS) as StageKey[]).map((k) => ({ value: k, label: STAGE_PRESETS[k].label }))}
            />
          </div>
          <p className="mt-3 text-[0.8125rem] font-semibold text-ink-3">휠체어석 단상</p>
          <div className="mt-1.5">
            <Segmented
              label="휠체어석 단상 높이"
              value={platform ? "60" : "0"}
              onChange={(v) => setPlatform(v === "60" ? 0.6 : 0)}
              options={[
                { value: "0", label: "없음" },
                { value: "60", label: "60cm 높이기" },
              ]}
            />
          </div>
          <ul className="mt-4 flex flex-col gap-3">
            {compare.map((c, i) => {
              const on = c === cur;
              return (
                <li key={c.label}>
                  <div className="flex items-baseline justify-between text-[0.875rem]">
                    <span className={on ? "font-bold text-ink" : "text-ink-2"}>{c.label}</span>
                    <span className="num">
                      <b className={i === 1 ? "text-[#d42c3c]" : i === 2 ? "text-[#0a8550]" : "text-ink"}>{c.avg}%</b>
                      <span className="ml-1.5 text-[0.75rem] text-ink-3">많이 가림 {c.poor}석</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-grey-100">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${c.avg}%`, background: i === 1 ? "#d42c3c" : i === 2 ? "#0a8550" : "#3182f6" }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 rounded-2xl bg-[#e6f7ee] px-3.5 py-3 text-[0.875rem] leading-relaxed text-[#075c38]">
            휠체어석 바닥을 60cm 높이면 앞사람이 일어서도 평균 시야가 {compare[1].avg}% → {compare[2].avg}%로 돌아와요.
          </p>
        </section>

        <h2 className="mt-6 text-[1.125rem] font-bold">휠체어석 {wheelSeats.length}석</h2>
        <ul className="mt-1">
          {wheelSeats.map((s) => {
            const v = vis[seats.indexOf(s)];
            const l = v ? visibilityLabel(v.ratio) : null;
            const on = selected?.id === s.id;
            return (
              <li key={s.id}>
                <button
                  onClick={() => {
                    pick(s);
                    setMode("seat");
                  }}
                  className={`press flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left ${on ? "bg-blue-soft" : ""}`}
                >
                  <IconTile icon={Accessibility} tone="blue" size="sm" />
                  <span className="flex-1">
                    <span className="block text-[0.9375rem] font-semibold">
                      {s.tier} {s.section} {s.row}열 {s.num}번
                    </span>
                    <span className="block text-[0.8125rem] text-ink-3">무대까지 약 {distanceToStage(s)}m</span>
                  </span>
                  {l && v && <span className={`num text-[0.9375rem] font-bold ${TONE_TEXT[l.tone]}`}>{Math.round(v.ratio * 100)}%</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-[0.75rem] leading-relaxed text-ink-3">
          공연장 형상은 한국체육산업개발이 공개한 KSPO DOME 실감형 콘텐츠(3D)에서 가져왔어요. 휠체어석은 올림픽공원 공식 좌석배치도의 ‘C블록 뒤편 장애인석’ 위치를 따랐어요(세부 좌석 번호는 추정). 무대 배치는 공연마다 달라요.
        </p>
      </BottomSheet>
    </div>
  );
}
