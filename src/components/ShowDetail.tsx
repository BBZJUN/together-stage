"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { endTime, fmtDate, peakOf, shiftTime, timeKo } from "@/lib/data";
import { useNeeds } from "@/lib/mode";
import { bestExit, profileFrom, venues } from "@/lib/route";
import type { Show } from "@/lib/types";
import { ForecastChart } from "./ForecastChart";
import { Chevron, IconCircle, LevelPill } from "./ui";

const VENUE_ID: Record<string, string> = {
  "KSPO DOME": "kspo",
  "티켓링크 라이브 아레나": "handball",
  올림픽홀: "olympichall",
  우리금융아트홀: "artHall",
};

function prepList(show: Show, wheel: boolean, big: boolean) {
  const w = show.weather;
  const items: { icon: string; text: string }[] = [];
  if (w.temp <= 2) items.push({ icon: "🧤", text: wheel ? "무릎 담요와 장갑 (휠체어에선 손이 빨리 차가워요)" : "핫팩과 목도리" });
  if (w.precip) items.push(wheel ? { icon: "🌂", text: "휠체어용 우비나 판초" } : { icon: "☂️", text: "우산 (바닥이 미끄러워요)" });
  items.push({ icon: "🪪", text: "복지카드 (할인 확인용)" });
  if (wheel) items.push({ icon: "🔋", text: "전동휠체어 배터리 충전 확인" });
  if (big) items.push({ icon: "🎫", text: "종이로 뽑은 티켓" }, { icon: "💊", text: "평소 드시는 약" });
  return items;
}

export default function ShowDetail({ show }: { show: Show }) {
  const { needs, has, bigText } = useNeeds();
  const wheel = has("wheelchair");
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const r = show.reco;
  const peak = peakOf(show);
  const end = endTime(show);
  const fullHour = show.forecast.hours.find((p) => p.occ >= 95);
  const busyHour = show.forecast.hours.find((p) => p.occ >= 75);
  // 붐비기 30분 전 도착 권장 (없으면 공연 1시간 30분 전)
  const arrive = busyHour ? shiftTime(`${String(busyHour.h).padStart(2, "0")}:00`, -30) : shiftTime(show.start, -90);
  const best = r.exits.find((e) => e.waitMin <= 10) ?? r.exits[r.exits.length - 1];
  const venue = venues.find((v) => v.id === VENUE_ID[show.venue]);

  const route = useMemo(() => {
    if (!venue) return null;
    return bestExit("올림픽공원역 (5·9호선)", venue, profileFrom(needs, show.weather.precip));
  }, [venue, needs, show.weather.precip]);

  const share = async () => {
    const text = `[함께 보는 무대] ${fmtDate(show.date)} ${timeKo(show.start)} ${show.title.replace("[샘플] ", "")} (${show.venue})\n${timeKo(arrive)}까지 도착하면 덜 붐벼요.${
      route ? ` ${route.exit.name}로 나와서 약 ${route.route.minutes}분, 계단 ${route.route.stepsCount ? `${route.route.stepsCount}곳` : "없음"}.` : ""
    }`;
    try {
      if (navigator.share) await navigator.share({ title: "함께 보는 무대", text, url: location.href });
      else {
        await navigator.clipboard.writeText(`${text}\n${location.href}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }
    } catch {
      /* 공유 취소 */
    }
  };

  return (
    <div className="pb-32">
      <div className="sticky top-0 z-20 flex h-14 items-center bg-bg px-2">
        <button
          onClick={() => (history.length > 1 ? router.back() : router.push("/"))}
          aria-label="뒤로"
          className="press grid h-10 w-10 place-items-center rounded-full"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
            <path d="M15 5l-7 7 7 7" fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <section className="band px-5 pb-7">
        <p className="text-[0.9375rem] font-medium text-ink-3">
          {fmtDate(show.date)} {show.start}~{end}
        </p>
        <h1 className="mt-1 text-[1.375rem] font-bold leading-snug tracking-tight">{show.title}</h1>
        <p className="mt-1 text-[0.9375rem] text-ink-3">
          {show.venue}, {show.weather.sky} {show.weather.temp}°C
        </p>
        <div className="rise mt-7">
          <p className="text-[1rem] font-semibold text-ink-2">붐비기 전에 도착하려면</p>
          <p className={`num mt-1 font-bold leading-none tracking-tight text-blue ${bigText ? "text-[2.75rem]" : "text-[2.5rem]"}`}>{timeKo(arrive)}</p>
          <p className="mt-1.5 text-[1.375rem] font-bold tracking-tight">까지 오시면 편해요</p>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
            {busyHour ? `${busyHour.h}시부터 사람이 몰려서 엘리베이터와 입구 줄이 길어져요.` : "이날은 크게 붐비지 않을 것 같아요."}
          </p>
        </div>
      </section>

      {route && venue && (
        <section className="band px-5 py-6">
          <Link href={`/route?to=${venue.id}`} className="press block">
            <div className="flex items-center justify-between">
              <h2 className="text-[1.25rem] font-bold leading-snug tracking-tight">
                {route.exit.name.replace(" (5·9호선)", "")}로 나와서
                <br />
                {route.route.stepsCount ? `계단 ${route.route.stepsCount}곳, ` : wheel ? "계단 없이 " : ""}
                {route.route.minutes}분이면 가요
              </h2>
              <Chevron />
            </div>
            <p className="mt-1.5 text-[0.875rem] text-ink-3">
              {show.weather.precip ? "비 예보가 있어서 미끄러운 길은 피했어요. " : ""}다른 역·주차장에서 오시면 눌러서 바꿔보세요.
            </p>
          </Link>
        </section>
      )}

      {show.venue === "KSPO DOME" && (
        <section className="band px-5 py-6">
          <Link href="/seats" className="press flex items-center gap-3">
            <IconCircle tone="blue">🎭</IconCircle>
            <span className="flex-1">
              <span className="block text-[1.0625rem] font-semibold">휠체어석에서 무대가 보일까요?</span>
              <span className="block text-[0.875rem] text-ink-3">앞사람이 일어섰을 때 시야까지 3D로 확인</span>
            </span>
            <Chevron />
          </Link>
        </section>
      )}

      <section className="band px-5 py-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[1.25rem] font-bold leading-snug tracking-tight">
            {fullHour ? (
              <>
                {fullHour.h}시쯤
                <br />
                공원이 가장 붐벼요
              </>
            ) : (
              <>
                가장 붐빌 때도
                <br />
                여유가 있어요
              </>
            )}
          </h2>
          <LevelPill level={peak.level} big />
        </div>
        <p className="mt-1.5 text-[0.875rem] text-ink-3">올림픽공원 주차장 이용 기준, 시간대별 예상</p>
        <div className="mt-4">
          <ForecastChart hours={show.forecast.hours} start={show.start} end={end} />
        </div>
      </section>

      <section className="band px-5 py-6">
        <h2 className="text-[1.25rem] font-bold leading-snug tracking-tight">
          끝나고 {best.leaveMin ? `${best.leaveMin}분쯤` : "조금"} 기다렸다 나오면
          <br />
          인파가 빠져서 편해요
        </h2>
        <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-3">
          {end}에 공연이 끝나면 엘리베이터와 출구에 사람이 한꺼번에 몰려요. 실제 입출차 기록을 보면 큰 공연 뒤 1시간 안에 대부분 빠져나가요.
        </p>
      </section>

      <section className="band px-5 py-6">
        <h2 className="text-[1.25rem] font-bold tracking-tight">챙기면 좋아요</h2>
        <ul className="mt-3">
          {prepList(show, wheel, bigText).map((it) => (
            <li key={it.text} className="flex items-center gap-3 py-2.5">
              <IconCircle>{it.icon}</IconCircle>
              <span className="text-[0.9375rem]">{it.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="fixed bottom-0 left-1/2 z-30 flex w-full max-w-[480px] -translate-x-1/2 gap-2 bg-gradient-to-t from-white via-white to-white/0 px-5 pb-6 pt-6">
        <button onClick={share} className="press h-14 shrink-0 rounded-2xl bg-grey-100 px-5 text-[0.9375rem] font-semibold text-ink-2">
          {copied ? "복사했어요" : "가족에게 보내기"}
        </button>
        <Link
          href={venue ? `/route?to=${venue.id}` : "/route"}
          className="press grid h-14 flex-1 place-items-center rounded-2xl bg-blue text-[1.0625rem] font-semibold text-white"
        >
          가는 길 보기
        </Link>
      </div>
    </div>
  );
}
