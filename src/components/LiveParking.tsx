"use client";

import { useEffect, useState } from "react";
import { CarFront } from "lucide-react";

/** 한국체육산업개발 실시간 주차현황 — 지금 공원 전체 주차대수 */
export default function LiveParking() {
  const [d, setD] = useState<{ total: number | null; source: string; at: string } | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/parking")
        .then((r) => r.json())
        .then((j) => alive && setD(j))
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  if (!d || d.source !== "live" || d.total == null) return null;
  const time = new Date(d.at).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Seoul" });
  return (
    <p className="mt-3 flex items-center gap-2 rounded-2xl bg-grey-50 px-4 py-3 text-[0.9375rem]">
      <CarFront size={18} className="text-ink-3" aria-hidden />
      <span>
        지금 올림픽공원 주차 <b className="num">{d.total.toLocaleString()}대</b>
      </span>
      <span className="ml-auto flex items-center gap-1 text-[0.75rem] text-ink-3">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0a8550]" aria-hidden /> 실시간 {time}
      </span>
    </p>
  );
}
