"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useNeeds } from "@/lib/mode";
import { bestExit, findRoute, parkings, profileFrom, stations, toilets, venues, type Place, type RouteResult } from "@/lib/route";
import { ParkMap } from "./ParkMap";
import { Accessibility, ArrowUp, Car, CloudRain, CornerUpLeft, CornerUpRight, Footprints, MapPin, Sun, Toilet, TrainFront, TriangleAlert } from "lucide-react";
import { Segmented } from "./ui";

const STEP_ICON: Record<string, typeof ArrowUp> = { "⚠️": TriangleAlert, "🪨": TriangleAlert, "🚗": Car, "↱": CornerUpRight, "↰": CornerUpLeft, "⬆️": ArrowUp, "📍": MapPin };

type From = "subway" | "car";

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`press shrink-0 rounded-full px-3.5 py-2 text-[0.875rem] font-semibold ${on ? "bg-ink text-white" : "bg-grey-100 text-ink-2"}`}
    >
      {children}
    </button>
  );
}

function Toggle({ on, onClick, label, sub }: { on: boolean; onClick: () => void; label: React.ReactNode; sub: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`press flex-1 rounded-2xl px-4 py-3 text-left ${on ? "bg-blue-soft" : "bg-grey-100"}`}
    >
      <span className="block text-[0.8125rem] text-ink-3">{sub}</span>
      <span className={`flex items-center gap-1.5 text-[1rem] font-bold ${on ? "text-blue" : "text-ink"}`}>{label}</span>
    </button>
  );
}

function nearestToilet(dest: Place, wheel: boolean) {
  const list = toilets.filter((t) => !wheel || t.wheelchair === "yes");
  return list
    .map((t) => ({ t, d: Math.round(Math.hypot(t.x - dest.x, t.y - dest.y)) }))
    .sort((a, b) => a.d - b.d)[0];
}

export default function RouteFinder() {
  const params = useSearchParams();
  const { needs, has } = useNeeds();
  const [destId, setDestId] = useState(params.get("to") ?? "kspo");
  const [from, setFrom] = useState<From>("subway");
  const [station, setStation] = useState(stations.find((s) => s.startsWith("올림픽공원")) ?? stations[0]);
  const [parkingId, setParkingId] = useState(parkings[0]?.id);
  const [rain, setRain] = useState(false);
  const [wheel, setWheel] = useState<boolean | null>(null); // null = 온보딩 설정 따름
  const wheelchair = wheel ?? has("wheelchair");

  const dest = venues.find((v) => v.id === destId) ?? venues[0];
  const profile = useMemo(() => {
    const p = profileFrom(needs, rain);
    p.wheelchair = wheelchair;
    return p;
  }, [needs, rain, wheelchair]);

  const result = useMemo((): { origin: Place; route: RouteResult } | null => {
    if (from === "subway") {
      const b = bestExit(station, dest, profile);
      return b ? { origin: b.exit, route: b.route } : null;
    }
    const pk = parkings.find((p) => p.id === parkingId) ?? parkings[0];
    const r = findRoute(pk, dest, profile);
    return r ? { origin: pk, route: r } : null;
  }, [from, station, parkingId, dest, profile]);

  const wc = nearestToilet(dest, wheelchair);
  const r = result?.route;

  return (
    <div className="pb-24">
      <section className="band px-5 pb-5 pt-4">
        <h1 className="text-[1.5rem] font-bold leading-[1.4] tracking-tight">
          {dest.name}까지
          <br />
          {wheelchair ? "계단 없는 길로" : profile.mobility ? "계단을 피해서" : "편한 길로"} 안내할게요
        </h1>

        <p className="mt-5 text-[0.8125rem] font-semibold text-ink-3">어디로 가세요?</p>
        <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1">
          {venues.map((v) => (
            <Chip key={v.id} on={v.id === dest.id} onClick={() => setDestId(v.id)}>
              {v.name}
            </Chip>
          ))}
        </div>

        <p className="mt-4 text-[0.8125rem] font-semibold text-ink-3">어떻게 오세요?</p>
        <div className="mt-2">
          <Segmented
            label="오는 방법"
            value={from}
            onChange={setFrom}
            options={[
              { value: "subway", label: <span className="flex items-center justify-center gap-1.5"><TrainFront size={16} />지하철</span> },
              { value: "car", label: <span className="flex items-center justify-center gap-1.5"><Car size={16} />자가용·택시</span> },
            ]}
          />
        </div>
        <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1">
          {from === "subway"
            ? stations.map((s) => (
                <Chip key={s} on={s === station} onClick={() => setStation(s)}>
                  {s}
                </Chip>
              ))
            : parkings.map((p) => (
                <Chip key={p.id} on={p.id === parkingId} onClick={() => setParkingId(p.id)}>
                  {p.name}
                </Chip>
              ))}
        </div>

        <div className="mt-4 flex gap-2">
          <Toggle on={wheelchair} onClick={() => setWheel(!wheelchair)} sub="이동 방법" label={wheelchair ? <><Accessibility size={17} /> 휠체어</> : <><Footprints size={17} /> 걸어서</>} />
          <Toggle on={rain} onClick={() => setRain(!rain)} sub="날씨" label={rain ? <><CloudRain size={17} /> 비 오는 날</> : <><Sun size={17} /> 맑은 날</>} />
        </div>
      </section>

      <section className="band">
        <div className="aspect-[4/3] w-full">
          <ParkMap route={r?.points} origin={result?.origin} dest={dest} />
        </div>
        <div className="flex flex-wrap gap-3 px-5 pt-3 text-[0.75rem] text-ink-3">
          <span className="flex items-center gap-1">
            <span className="inline-block h-1 w-5 rounded bg-blue" /> 추천 경로
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1 w-5 rounded border-t-2 border-dashed border-[#f04452]" /> 계단
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1 w-5 rounded border-t-2 border-dashed border-[#e8a10c]" /> 고르지 않은 바닥
          </span>
          <span>♿ 장애인 화장실 위치</span>
        </div>

        {result && r ? (
          <div className="px-5 pb-6 pt-5">
            <p className="text-[0.9375rem] text-ink-3">{result.origin.name}에서</p>
            <p className="mt-0.5 text-[1.75rem] font-bold tracking-tight">
              <span className="num text-blue">{r.minutes}분</span>
              <span className="ml-2 text-[1.125rem] font-semibold text-ink-2">{r.meters.toLocaleString()}m</span>
            </p>

            <ul className="mt-4 grid grid-cols-2 gap-2">
              <li className="rounded-2xl bg-grey-50 p-3.5">
                <p className="text-[0.8125rem] text-ink-3">계단</p>
                <p className={`text-[1.0625rem] font-bold ${r.stepsCount ? "text-[#f04452]" : "text-ink"}`}>
                  {r.stepsCount ? `${r.stepsCount}곳 있어요` : "없어요"}
                </p>
              </li>
              <li className="rounded-2xl bg-grey-50 p-3.5">
                <p className="text-[0.8125rem] text-ink-3">고르지 않은 바닥</p>
                <p className={`text-[1.0625rem] font-bold ${r.roughMeters ? "text-[#d9741f]" : "text-ink"}`}>
                  {r.roughMeters ? `${r.roughMeters}m` : "없어요"}
                </p>
              </li>
              {(r.avoidedSteps > 0 || r.extraMeters > 0) && (
                <li className="col-span-2 rounded-2xl bg-blue-soft p-3.5 text-[0.9375rem] text-ink-2">
                  {r.avoidedSteps > 0 ? `계단 ${r.avoidedSteps}곳을 피하려고 ` : rain ? "미끄러운 길을 피하려고 " : "더 편한 길로 가려고 "}
                  가장 짧은 길보다 <b className="text-blue">{r.extraMeters}m</b> 더 돌아가요.
                </li>
              )}
            </ul>

            {result.origin.kind === "exit" && (
              <p className="mt-3 rounded-2xl bg-grey-50 p-3.5 text-[0.875rem] leading-relaxed text-ink-2">
                {result.origin.wheelchair === "yes"
                  ? `${result.origin.ref}번 출구는 휠체어로 이용할 수 있다고 표시된 출구예요.`
                  : `${result.origin.ref}번 출구의 엘리베이터 여부는 아직 확인되지 않았어요. 역 안내도에서 엘리베이터 위치를 꼭 확인하세요.`}
              </p>
            )}

            <h2 className="mt-6 text-[1.125rem] font-bold">가는 길</h2>
            <ol className="relative mt-3">
              <span aria-hidden className="absolute bottom-5 left-[17px] top-5 w-0.5 rounded bg-grey-200" />
              {r.steps.map((s, i) => {
                const I = STEP_ICON[s.icon] ?? ArrowUp;
                const last = i === r.steps.length - 1;
                return (
                  <li key={i} className="relative flex items-start gap-3 py-2">
                    <span
                      aria-hidden
                      className={`relative z-[1] grid h-9 w-9 shrink-0 place-items-center rounded-full ring-4 ring-bg ${
                        last ? "bg-blue text-white" : s.warn ? "bg-[#fff1e6] text-[#c4500c]" : "bg-grey-100 text-ink-2"
                      }`}
                    >
                      <I size={17} strokeWidth={2.4} />
                    </span>
                    <span className={`pt-1.5 text-[0.9375rem] leading-relaxed ${s.warn ? "font-semibold text-[#c4500c]" : last ? "font-bold" : "text-ink"}`}>{s.text}</span>
                  </li>
                );
              })}
            </ol>

            {wc && (
              <p className="mt-4 flex items-center gap-2.5 rounded-2xl bg-grey-50 p-3.5 text-[0.875rem] text-ink-2">
                <Toilet size={18} className="shrink-0 text-ink-3" aria-hidden />
                {wheelchair ? "장애인 화장실" : "화장실"}이 {dest.name}에서 약 {wc.d}m 떨어져 있어요.
              </p>
            )}
          </div>
        ) : (
          <p className="px-5 py-6 text-[0.9375rem] text-ink-3">
            조건에 맞는 길을 찾지 못했어요. 다른 출구나 주차장을 골라보세요.
          </p>
        )}
        <p className="px-5 pb-6 text-[0.75rem] leading-relaxed text-ink-3">
          길 정보: OpenStreetMap 기여자 (ODbL). 계단·바닥 정보는 지도에 표시된 곳 기준이라 실제와 다를 수 있어요.
        </p>
      </section>
    </div>
  );
}
