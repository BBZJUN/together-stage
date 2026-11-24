"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Accessibility, Bookmark, BookmarkCheck, Building2, ExternalLink, Eye, Hand, Maximize2, Search, Volume2, X } from "lucide-react";
import { saveSeat, useSaved, type MySeat } from "@/lib/offline";
import { useSearchParams } from "next/navigation";
import {
  describeSeat,
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
const TONE_TEXT: Record<string, string> = { good: "text-blue", mid: "text-[#3b6fc4]", bad: "text-[#ad4609]", worst: "text-[#c0222f]" };
const TONE_LABEL = { good: "잘 보임", mid: "조금 가림", bad: "많이 가림", worst: "거의 안 보임" } as const;

type StageKey = keyof typeof STAGE_PRESETS;

function wheelStats(seats: Seat[], stageKey: StageKey, standing: boolean, platform: number, fence: number) {
  const st = STAGE_PRESETS[stageKey].stage;
  const T = stageTargets(st);
  const O = stageObstacles(st);
  const vs = seats.filter((s) => s.wheelchair).map((s) => seatVisibility(s, st, { standing, platform, fence }, T, O).ratio);
  return { avg: Math.round((vs.reduce((a, b) => a + b, 0) / Math.max(1, vs.length)) * 100), poor: vs.filter((v) => v < 0.6).length, n: vs.length };
}

/** 예매한 자리(층·구역·열·번호)와 가장 가까운 좌석 */
function findSeat(seats: Seat[], tier: string, section: string, row: number, num: number) {
  const pool = seats.filter((s) => s.tier === tier && s.section === section);
  if (!pool.length) return null;
  const rows = [...new Set(pool.map((s) => s.row))];
  const r = rows.reduce((a, b) => (Math.abs(b - row) < Math.abs(a - row) ? b : a), rows[0]);
  const inRow = pool.filter((s) => s.row === r);
  return inRow.reduce((a, b) => (Math.abs(b.num - num) < Math.abs(a.num - num) ? b : a), inRow[0]);
}

function SeatFinder({ seats, onFind }: { seats: Seat[]; onFind: (s: Seat, exact: boolean) => void }) {
  const [tier, setTier] = useState("2층");
  const sections = useMemo(() => {
    const set = [...new Set(seats.filter((s) => s.tier === tier).map((s) => s.section))];
    return set.sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));
  }, [seats, tier]);
  const [section, setSection] = useState("8구역");
  const [row, setRow] = useState("10");
  const [num, setNum] = useState("5");
  const sec = sections.includes(section) ? section : sections[0];
  const field = "h-12 w-full rounded-xl bg-grey-50 px-3 text-[1rem] font-semibold outline-none focus:ring-2 focus:ring-blue";
  return (
    <form
      className="rounded-3xl border border-grey-200 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const s = findSeat(seats, tier, sec, Number(row) || 1, Number(num) || 1);
        if (s) onFind(s, s.row === Number(row) && s.num === Number(num));
      }}
    >
      <h2 className="text-[1.0625rem] font-bold">예매한 자리 찾기</h2>
      <p className="mt-0.5 text-[0.8125rem] text-ink-3">티켓에 적힌 층·구역·열·번호를 넣으면 그 자리 눈높이로 보여드려요.</p>
      <div className="mt-3">
        <Segmented
          label="층"
          value={tier}
          onChange={(v) => setTier(v)}
          options={[
            { value: "플로어", label: "플로어" },
            { value: "2층", label: "2층" },
            { value: "3층", label: "3층" },
          ]}
        />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <label className="text-[0.75rem] font-semibold text-ink-3">
          구역
          <select className={`${field} mt-1`} value={sec} onChange={(e) => setSection(e.target.value)}>
            {sections.map((x) => (
              <option key={x} value={x}>
                {x.replace("플로어 ", "")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[0.75rem] font-semibold text-ink-3">
          열
          <input className={`${field} mt-1`} inputMode="numeric" value={row} onChange={(e) => setRow(e.target.value.replace(/\D/g, ""))} />
        </label>
        <label className="text-[0.75rem] font-semibold text-ink-3">
          번호
          <input className={`${field} mt-1`} inputMode="numeric" value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, ""))} />
        </label>
      </div>
      <button className="press mt-3 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-blue py-3.5 text-[1rem] font-bold text-white">
        <Search size={18} aria-hidden /> 이 자리에서 무대 보기
      </button>
    </form>
  );
}

export default function SeatViewer() {
  const params = useSearchParams();
  const [stageKey, setStageKey] = useState<StageKey>("end");
  const stage = STAGE_PRESETS[stageKey].stage;
  const seats = useMemo(() => generateSeats(stage), [stage]);
  const [standing, setStanding] = useState(true);
  const [platform, setPlatform] = useState(0);
  const [fence, setFence] = useState(1.0);
  const [onlyWheel, setOnlyWheel] = useState(false);
  const [vis, setVis] = useState<(Visibility | null)[]>([]);
  const [selId, setSelId] = useState<string | null>(() => params.get("seat"));
  const [approx, setApprox] = useState(false);
  // 무대 배치가 바뀌어도 같은 좌석 id로 다시 찾음
  const selected = useMemo(() => (selId ? seats.find((s) => s.id === selId) ?? null : null), [selId, seats]);
  const [mode, setMode] = useState<ViewMode>(() => (params.get("seat") ? "seat" : "overview"));
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
        out[i] = seatVisibility(seats[i], stage, { standing, platform, fence }, T, O);
      }
      setVis([...out]);
      if (k < order.length) setTimeout(tick, 0);
    };
    tick();
  }, [seats, stage, standing, platform, fence]);

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
      { label: "앞사람이 앉았을 때", ...wheelStats(seats, stageKey, false, 0, fence) },
      { label: "앞사람이 일어섰을 때", ...wheelStats(seats, stageKey, true, 0, fence) },
      { label: "일어섬 + 휠체어석 단상 60cm", ...wheelStats(seats, stageKey, true, 0.6, fence) },
    ],
    [seats, stageKey, fence],
  );
  const cur = compare[platform ? 2 : standing ? 1 : 0];

  const wheelSeats = seats.filter((s) => s.wheelchair);
  const selIdx = selected ? seats.findIndex((s) => s.id === selected.id) : -1;
  const sv = selIdx >= 0 ? vis[selIdx] : null;
  const mySeat = useSaved<MySeat>("seat");
  // 자리 설명: 앞사람이 앉았을 때·일어섰을 때 둘 다 계산해 말로 풀어줌
  const desc = useMemo(() => {
    if (!selected) return "";
    const T = stageTargets(stage);
    const O = stageObstacles(stage);
    const a = seatVisibility(selected, stage, { standing: false, platform, fence }, T, O).ratio;
    const b = seatVisibility(selected, stage, { standing: true, platform, fence }, T, O).ratio;
    return describeSeat(selected, seats, a, b, fence);
  }, [selected, stage, seats, platform, fence]);
  const [said, setSaid] = useState("");
  const speak = () => {
    setSaid(desc);
    try {
      const u = new SpeechSynthesisUtterance(desc);
      u.lang = "ko-KR";
      u.rate = 0.95;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch {
      /* 음성 미지원 — 화면 글로만 */
    }
  };
  const label = sv ? visibilityLabel(sv.ratio) : null;
  const done = vis.filter(Boolean).length;

  const pick = useCallback((s: Seat) => {
    setSelId(s.id);
    setApprox(false);
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
    <div ref={box} className="relative h-[calc(100dvh-7rem-var(--tabs,0px)-env(safe-area-inset-bottom))] min-h-[520px] overflow-hidden bg-grey-100">
      <div className="absolute inset-x-0 top-0" style={{ bottom: snaps[0] - 28 }} role="img" aria-label="KSPO DOME 3D 좌석 화면. 화면을 보기 어렵다면 아래 시트의 '예매한 자리 찾기'와 자리 설명(글·소리)을 이용하세요.">
        <Venue3D seats={seats} colors={colors} stage={stage} selected={selected} mode={mode} standing={standing} platform={platform} fence={fence} onSelect={pick} />
      </div>

      {mode === "seat" && selected && (
        <div className="absolute inset-x-3 top-3 z-20 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="rounded-2xl bg-black/55 px-3.5 py-2.5 text-white backdrop-blur-md">
              <p className="text-[0.8125rem] opacity-80">
                {selected.tier} {selected.section}
                {selected.block ? ` (${selected.block}블록)` : ""} {selected.row}열 {selected.num}번{selected.wheelchair ? " · 휠체어석" : ""}
              </p>
              {sv && (
                <p className="text-[1.0625rem] font-bold">
                  무대 {Math.round(sv.ratio * 100)}% 보임 · {distanceToStage(selected)}m
                </p>
              )}
            </div>
            <button
              onClick={() => setMode("overview")}
              aria-label="1인칭 시점 닫기"
              className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStanding(!standing)}
              aria-pressed={standing}
              className="press h-10 rounded-full bg-black/55 px-3.5 text-[0.8125rem] font-semibold text-white backdrop-blur-md"
            >
              앞사람 {standing ? "일어섬" : "앉음"} ↔
            </button>
            {selected.wheelchair && (
              <button
                onClick={() => setPlatform(platform ? 0 : 0.6)}
                aria-pressed={!!platform}
                className={`press h-10 rounded-full px-3.5 text-[0.8125rem] font-semibold backdrop-blur-md ${platform ? "bg-[#077a49] text-white" : "bg-black/55 text-white"}`}
              >
                단상 60cm {platform ? "켬" : "끔"}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={speak} className="press flex h-10 items-center gap-1.5 rounded-full bg-white px-3.5 text-[0.8125rem] font-bold text-ink">
              <Volume2 size={16} aria-hidden /> 자리 설명 듣기
            </button>
            {(() => {
              const saved = mySeat?.id === selected.id;
              return (
                <button
                  onClick={() => {
                    const T = stageTargets(stage);
                    const O = stageObstacles(stage);
                    saveSeat({
                      id: selected.id,
                      label: `${selected.tier === "플로어" ? selected.section : `${selected.tier} ${selected.section}`} ${selected.row}열 ${selected.num}번${selected.wheelchair ? "(휠체어석)" : ""}`,
                      ratioSeated: seatVisibility(selected, stage, { standing: false, fence }, T, O).ratio,
                      ratioStanding: seatVisibility(selected, stage, { standing: true, fence }, T, O).ratio,
                      dist: distanceToStage(selected),
                      wheelchair: selected.wheelchair,
                      savedAt: new Date().toISOString(),
                    });
                  }}
                  aria-pressed={saved}
                  className={`press flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[0.8125rem] font-semibold backdrop-blur-md ${saved ? "bg-[#077a49] text-white" : "bg-black/55 text-white"}`}
                >
                  {saved ? <BookmarkCheck size={16} aria-hidden /> : <Bookmark size={16} aria-hidden />} {saved ? "내 자리로 저장됨" : "내 자리로 저장"}
                </button>
              );
            })()}
          </div>
          <p className="sr-only" aria-live="polite">
            {said}
          </p>
          {said && (
            <p className="max-w-[340px] rounded-2xl bg-black/60 px-3.5 py-2.5 text-[0.875rem] leading-relaxed text-white backdrop-blur-md">{desc}</p>
          )}
          <p className="flex items-center gap-1.5 self-start rounded-full bg-black/40 px-3 py-1 text-[0.75rem] text-white/85">
            <Hand size={13} aria-hidden /> 화면을 끌어서 둘러보세요
          </p>
          {approx && (
            <p className="self-start rounded-xl bg-[#fff4e5] px-3 py-1.5 text-[0.75rem] font-semibold text-[#8a4b00]">
              입력한 열·번호와 가장 가까운 자리를 보여드려요
            </p>
          )}
        </div>
      )}

      <div className={`pointer-events-none absolute inset-x-4 top-3 z-10 flex items-start justify-between gap-2 ${mode === "seat" && selected ? "hidden" : ""}`}>
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
        <div className="pb-5">
          <SeatFinder
            seats={seats}
            onFind={(s, exact) => {
              setSelId(s.id);
              setApprox(!exact);
              setMode("seat");
              setSnap(0);
            }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5 pb-4">
          {(["good", "mid", "bad", "worst"] as const).map((t) => (
            <span key={t} className="flex items-center gap-1 rounded-lg bg-grey-50 px-2 py-1 text-[0.75rem] font-semibold text-ink-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: `rgb(${TONE_RGB[t].map((x) => x * 255).join(",")})` }} />
              {TONE_LABEL[t]}
            </span>
          ))}
        </div>

        {selected && (
          <div className="mb-3 rounded-2xl bg-blue-soft px-4 py-3">
            <p className="text-[0.9375rem] leading-relaxed text-ink" aria-live="polite">
              {desc}
            </p>
            <button onClick={speak} className="press mt-2 flex h-10 items-center gap-1.5 rounded-full bg-bg px-3.5 text-[0.875rem] font-bold text-blue">
              <Volume2 size={16} aria-hidden /> 소리로 듣기
            </button>
          </div>
        )}
        {selected && (
          <a
            href="https://aviewfrommyseat.com/venue/KSPO+DOME/sections/"
            target="_blank"
            rel="noreferrer"
            className="press mb-3 flex items-center justify-between rounded-2xl border border-grey-200 px-4 py-3 text-[0.9375rem] font-semibold"
          >
            관람객이 직접 찍은 구역별 사진 보기
            <ExternalLink size={16} className="text-ink-3" aria-hidden />
          </a>
        )}
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
          <p className="mt-3 text-[0.8125rem] font-semibold text-ink-3">휠체어석 앞 펜스·표지판 높이</p>
          <div className="mt-1.5">
            <Segmented
              label="휠체어석 앞 펜스 높이"
              value={String(fence)}
              onChange={(v) => setFence(Number(v))}
              options={[
                { value: "1", label: "1.0m (난간 기준)" },
                { value: "1.2", label: "1.2m" },
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
                      <b className={i === 1 ? "text-[#c0222f]" : i === 2 ? "text-[#077a49]" : "text-ink"}>{c.avg}%</b>
                      <span className="ml-1.5 text-[0.75rem] text-ink-3">많이 가림 {c.poor}석</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-grey-100">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${c.avg}%`, background: i === 1 ? "#c0222f" : i === 2 ? "#077a49" : "#3182f6" }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 rounded-2xl bg-[#e6f7ee] px-3.5 py-3 text-[0.875rem] leading-relaxed text-[#075c38]">
            휠체어석 바닥을 60cm 높이면 {fence > 1.1 ? "1.2m 펜스와 " : ""}앞사람이 일어서도 평균 시야가 {Math.min(compare[0].avg, compare[1].avg)}% → {compare[2].avg}%로 돌아와요.
          </p>
          <a href="/check" className="press mt-3 flex items-center justify-between rounded-2xl bg-ink px-4 py-3.5 text-[0.9375rem] font-semibold text-white">
            전체 좌석 점검 리포트 만들기
            <span aria-hidden>›</span>
          </a>
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
          공연장 형상은 한국체육산업개발이 공개한 KSPO DOME 실감형 콘텐츠(3D)에서 가져왔어요. 구역 번호는 공식 배치도의 블록 구분(2층 B 1~4·C 5~11·D 12~15·A 16~22, 3층 23~)을 따랐고 열·번호 위치는 추정이라 예매처 배치도와 다를 수 있어요. 1인칭 화면의 관객·조명·전광판은 공연 당일을 재현한 연출이에요. 휠체어석은 올림픽공원 공식 좌석배치도의 ‘C블록 뒤편 장애인석’ 위치를 따랐어요(세부 좌석 번호는 추정). 무대 배치는 공연마다 달라요.
        </p>
      </BottomSheet>
    </div>
  );
}
