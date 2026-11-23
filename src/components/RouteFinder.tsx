"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Accessibility,
  ArrowUp,
  ArrowUpDown,
  Car,
  Check,
  ChevronDown,
  CloudRain,
  CornerUpLeft,
  CornerUpRight,
  MapPin,
  ParkingSquare,
  Toilet,
  TrainFront,
  TriangleAlert,
  X,
} from "lucide-react";
import { useNeeds } from "@/lib/mode";
import { bestExit, findRoute, parkings, profileFrom, stations, toilets, venues, type Place, type RouteResult } from "@/lib/route";
import { ParkMap } from "./ParkMap";
import { IconTile } from "./ui";

const STEP_ICON: Record<string, typeof ArrowUp> = { "⚠️": TriangleAlert, "🪨": TriangleAlert, "🚗": Car, "↱": CornerUpRight, "↰": CornerUpLeft, "⬆️": ArrowUp, "📍": MapPin };

type Origin = { kind: "station"; id: string } | { kind: "parking"; id: string };

function nearestToilet(dest: Place, wheel: boolean) {
  return toilets
    .filter((t) => !wheel || t.wheelchair === "yes")
    .map((t) => ({ t, d: Math.round(Math.hypot(t.x - dest.x, t.y - dest.y)) }))
    .sort((a, b) => a.d - b.d)[0];
}

/** 아래에서 올라오는 선택 시트 */
function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div onClick={onClose} className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute bottom-0 left-1/2 w-full max-w-[480px] -translate-x-1/2 rounded-t-[28px] bg-bg pb-[max(20px,env(safe-area-inset-bottom))] transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-grey-200" />
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="text-[1.25rem] font-bold">{title}</h2>
          <button onClick={onClose} aria-label="닫기" className="press grid h-9 w-9 place-items-center rounded-full bg-grey-100">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[62vh] overflow-y-auto px-3 pb-2">{children}</div>
      </div>
    </div>
  );
}

function SheetItem({ icon, tone, title, sub, on, onClick }: { icon: typeof MapPin; tone: "blue" | "green" | "orange" | "purple" | "grey"; title: string; sub?: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`press flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left ${on ? "bg-blue-soft" : ""}`}>
      <IconTile icon={icon} tone={tone} />
      <span className="flex-1">
        <span className="block text-[1rem] font-semibold">{title}</span>
        {sub && <span className="block text-[0.8125rem] text-ink-3">{sub}</span>}
      </span>
      {on && <Check size={20} className="text-blue" />}
    </button>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex-1 rounded-2xl bg-grey-50 px-3.5 py-3">
      <p className="text-[0.75rem] text-ink-3">{label}</p>
      <p className={`mt-0.5 text-[1rem] font-bold ${warn ? "text-[#c4500c]" : "text-ink"}`}>{value}</p>
    </div>
  );
}

export default function RouteFinder() {
  const params = useSearchParams();
  const { needs, has } = useNeeds();
  const [destId, setDestId] = useState(params.get("to") ?? "kspo");
  const [origin, setOrigin] = useState<Origin>({ kind: "station", id: stations.find((s) => s.startsWith("올림픽공원")) ?? stations[0] });
  const [rain, setRain] = useState(false);
  const [wheel, setWheel] = useState<boolean | null>(null);
  const [sheet, setSheet] = useState<null | "from" | "to">(null);
  const [allSteps, setAllSteps] = useState(false);
  const wheelchair = wheel ?? has("wheelchair");

  const dest = venues.find((v) => v.id === destId) ?? venues[0];
  const profile = useMemo(() => ({ ...profileFrom(needs, rain), wheelchair }), [needs, rain, wheelchair]);

  const result = useMemo((): { origin: Place; route: RouteResult } | null => {
    if (origin.kind === "station") {
      const b = bestExit(origin.id, dest, profile);
      return b ? { origin: b.exit, route: b.route } : null;
    }
    const pk = parkings.find((p) => p.id === origin.id) ?? parkings[0];
    const r = findRoute(pk, dest, profile);
    return r ? { origin: pk, route: r } : null;
  }, [origin, dest, profile]);

  const r = result?.route;
  const wc = nearestToilet(dest, wheelchair);
  const steps = r ? (allSteps || r.steps.length <= 5 ? r.steps : [...r.steps.slice(0, 4), r.steps[r.steps.length - 1]]) : [];
  const originLabel = origin.kind === "station" ? origin.id.replace(/ \(.+\)/, "") : parkings.find((p) => p.id === origin.id)?.name ?? "";
  const originSub = result?.origin.kind === "exit" ? `${result.origin.ref}번 출구로 안내해요` : origin.kind === "parking" ? "올림픽공원 주차장" : "";
  const km = r ? (r.meters >= 1000 ? `${(r.meters / 1000).toFixed(1)}km` : `${r.meters}m`) : "";

  return (
    <div className="pb-24">
      {/* 지도 + 출발·도착 카드 */}
      <section className="relative">
        <div className="h-[46vh] min-h-[300px] w-full bg-[#eef3ec]">
          <ParkMap route={r?.points} origin={result?.origin} dest={dest} aspect={1} topInset={0.36} />
        </div>
        <div className="absolute inset-x-4 top-3 rounded-2xl bg-bg p-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.12)]">
          <button onClick={() => setSheet("from")} className="press flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full border-[2.5px] border-ink" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[0.75rem] text-ink-3">출발</span>
              <span className="block truncate text-[1rem] font-semibold">{originLabel}</span>
            </span>
            <ChevronDown size={18} className="text-ink-3" />
          </button>
          <div className="mx-3 flex items-center gap-3">
            <span className="h-px flex-1 bg-grey-100" />
            <ArrowUpDown size={14} className="text-grey-300" aria-hidden />
            <span className="h-px flex-1 bg-grey-100" />
          </div>
          <button onClick={() => setSheet("to")} className="press flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[0.75rem] text-ink-3">도착</span>
              <span className="block truncate text-[1rem] font-semibold">{dest.name}</span>
            </span>
            <ChevronDown size={18} className="text-ink-3" />
          </button>
        </div>
        <div className="absolute bottom-9 left-4 flex gap-2">
          <button
            onClick={() => setWheel(!wheelchair)}
            aria-pressed={wheelchair}
            className={`press flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[0.875rem] font-semibold shadow-[0_2px_10px_rgba(0,0,0,0.12)] ${wheelchair ? "bg-ink text-white" : "bg-bg text-ink-2"}`}
          >
            <Accessibility size={16} /> 휠체어
          </button>
          <button
            onClick={() => setRain(!rain)}
            aria-pressed={rain}
            className={`press flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[0.875rem] font-semibold shadow-[0_2px_10px_rgba(0,0,0,0.12)] ${rain ? "bg-ink text-white" : "bg-bg text-ink-2"}`}
          >
            <CloudRain size={16} /> 비 오는 날
          </button>
        </div>
      </section>

      {/* 결과 시트 */}
      <section className="relative z-10 -mt-6 rounded-t-[28px] bg-bg px-5 pb-6 pt-3">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-grey-200" aria-hidden />
        {result && r ? (
          <>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[0.875rem] text-ink-3">{result.origin.name.replace(/ \(.+?\)/, "")}에서</p>
                <p className="mt-0.5 flex items-baseline gap-2">
                  <span className="num text-[2rem] font-bold leading-none tracking-tight">{r.minutes}분</span>
                  <span className="num text-[1rem] font-semibold text-ink-3">{km}</span>
                </p>
              </div>
              <span className={`rounded-lg px-2.5 py-1 text-[0.8125rem] font-bold ${r.stepsCount ? "bg-[#fff1e6] text-[#c4500c]" : "bg-[#e6f7ee] text-[#0a8550]"}`}>
                {r.stepsCount ? `계단 ${r.stepsCount}곳` : "계단 없는 길"}
              </span>
            </div>

            <div className="mt-4 flex gap-2">
              <Stat label="계단" value={r.stepsCount ? `${r.stepsCount}곳` : "없음"} warn={r.stepsCount > 0} />
              <Stat label="고르지 않은 바닥" value={r.roughMeters ? `${r.roughMeters}m` : "없음"} warn={r.roughMeters > 0} />
              <Stat label="차 다니는 길" value={r.roadMeters ? `${r.roadMeters}m` : "없음"} />
            </div>

            {(r.avoidedSteps > 0 || r.extraMeters > 0) && (
              <p className="mt-3 rounded-2xl bg-blue-soft px-4 py-3 text-[0.9375rem] leading-relaxed text-ink-2">
                {r.avoidedSteps > 0 ? `계단 ${r.avoidedSteps}곳을 피하려고` : rain ? "미끄러운 길을 피하려고" : "더 편한 길로 가려고"} 가장 짧은 길보다{" "}
                <b className="text-blue">{r.extraMeters}m</b> 더 돌아가요.
              </p>
            )}
            {result.origin.kind === "exit" && result.origin.wheelchair !== "yes" && (
              <p className="mt-2 flex items-start gap-2 rounded-2xl bg-grey-50 px-4 py-3 text-[0.875rem] leading-relaxed text-ink-2">
                <TriangleAlert size={16} className="mt-0.5 shrink-0 text-[#c4500c]" aria-hidden />
                {result.origin.ref}번 출구의 엘리베이터 여부는 아직 확인되지 않았어요. 역 안내도에서 엘리베이터 위치를 꼭 확인하세요.
              </p>
            )}

            <div className="mt-6 flex items-baseline justify-between">
              <h2 className="text-[1.125rem] font-bold">가는 길</h2>
              <span className="text-[0.8125rem] text-ink-3">{originSub}</span>
            </div>
            <ol className="relative mt-2">
              <span aria-hidden className="absolute bottom-6 left-[17px] top-6 w-0.5 rounded bg-grey-200" />
              {steps.map((s, i) => {
                const I = STEP_ICON[s.icon] ?? ArrowUp;
                const last = i === steps.length - 1;
                const hiddenBefore = !allSteps && r.steps.length > 5 && last;
                return (
                  <li key={i}>
                    {hiddenBefore && (
                      <button
                        onClick={() => setAllSteps(true)}
                        className="press relative z-[1] my-1 ml-[50px] rounded-full bg-grey-100 px-3 py-1.5 text-[0.8125rem] font-semibold text-ink-2"
                      >
                        {r.steps.length - 5}단계 더 보기
                      </button>
                    )}
                    <div className="relative flex items-start gap-3 py-2">
                      <span
                        aria-hidden
                        className={`relative z-[1] grid h-9 w-9 shrink-0 place-items-center rounded-full ring-4 ring-bg ${
                          last ? "bg-blue text-white" : s.warn ? "bg-[#fff1e6] text-[#c4500c]" : "bg-grey-100 text-ink-2"
                        }`}
                      >
                        <I size={17} strokeWidth={2.4} />
                      </span>
                      <span className={`pt-1.5 text-[0.9375rem] leading-relaxed ${s.warn ? "font-semibold text-[#c4500c]" : last ? "font-bold" : "text-ink"}`}>{s.text}</span>
                    </div>
                  </li>
                );
              })}
            </ol>

            {wc && (
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-grey-50 px-4 py-3">
                <IconTile icon={Toilet} tone="grey" size="sm" />
                <p className="text-[0.875rem] text-ink-2">
                  {wheelchair ? "장애인 화장실" : "화장실"}이 {dest.name}에서 약 <b className="text-ink">{wc.d}m</b> 거리에 있어요.
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="py-6 text-[0.9375rem] text-ink-3">조건에 맞는 길을 찾지 못했어요. 다른 역이나 주차장을 골라보세요.</p>
        )}
        <p className="mt-5 text-[0.75rem] leading-relaxed text-ink-3">
          길 정보: OpenStreetMap 기여자 (ODbL). 계단·바닥 정보는 지도에 표시된 곳 기준이라 실제와 다를 수 있어요.
        </p>
      </section>

      <Sheet open={sheet === "from"} title="어디서 출발하세요?" onClose={() => setSheet(null)}>
        <p className="px-3 pb-1 pt-2 text-[0.8125rem] font-semibold text-ink-3">지하철 — 조건에 맞는 출구를 골라드려요</p>
        {stations.map((s) => (
          <SheetItem
            key={s}
            icon={TrainFront}
            tone="blue"
            title={s.replace(/ \(.+\)/, "")}
            sub={s.match(/\((.+)\)/)?.[1]}
            on={origin.kind === "station" && origin.id === s}
            onClick={() => {
              setOrigin({ kind: "station", id: s });
              setSheet(null);
              setAllSteps(false);
            }}
          />
        ))}
        <p className="px-3 pb-1 pt-4 text-[0.8125rem] font-semibold text-ink-3">자가용·택시 — 올림픽공원 주차장</p>
        {parkings.map((p) => (
          <SheetItem
            key={p.id}
            icon={ParkingSquare}
            tone="grey"
            title={p.name}
            on={origin.kind === "parking" && origin.id === p.id}
            onClick={() => {
              setOrigin({ kind: "parking", id: p.id });
              setSheet(null);
              setAllSteps(false);
            }}
          />
        ))}
      </Sheet>

      <Sheet open={sheet === "to"} title="어느 공연장에 가세요?" onClose={() => setSheet(null)}>
        {venues.map((v) => (
          <SheetItem
            key={v.id}
            icon={MapPin}
            tone="purple"
            title={v.name}
            on={v.id === dest.id}
            onClick={() => {
              setDestId(v.id);
              setSheet(null);
              setAllSteps(false);
            }}
          />
        ))}
      </Sheet>
    </div>
  );
}
