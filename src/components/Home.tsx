"use client";

import Link from "next/link";
import LiveParking from "./LiveParking";
import QuickTour from "./QuickTour";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Armchair, Building2, Clock3, MessageCircle, Navigation, Route, Hand } from "lucide-react";
import { arrivalAdvice, peakOf, timeKo } from "@/lib/data";
import { bestExit, profileFrom, venues } from "@/lib/route";
import { NEED_META, useNeeds, type Need } from "@/lib/mode";
import type { Show } from "@/lib/types";
import { Chevron, IconTile, LevelPill, SampleNotice, type Tone } from "./ui";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const dayOf = (iso: string) => new Date(iso + "T00:00:00+09:00");

function NeedPicker({ initial, onDone }: { initial: Need[]; onDone: (n: Need[]) => void }) {
  const [sel, setSel] = useState<Need[]>(initial);
  const toggle = (n: Need) => setSel(sel.includes(n) ? sel.filter((x) => x !== n) : [...sel, n]);
  return (
    <div className="flex flex-1 flex-col bg-bg px-5 pb-32 pt-8">
      <h1 className="rise text-[1.625rem] font-bold leading-[1.35] tracking-tight">
        공연 보러 가는 길,
        <br />
        어떤 도움이 필요하세요?
      </h1>
      <p className="mt-2 text-[0.9375rem] text-ink-3">여러 개 골라도 돼요. 나중에 바꿀 수 있어요.</p>
      <div className="mt-8 flex flex-col gap-2">
        {(Object.keys(NEED_META) as Need[]).map((n) => {
          const on = sel.includes(n);
          return (
            <button
              key={n}
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(n)}
              className={`press flex items-center gap-4 rounded-2xl p-4 text-left ${on ? "bg-blue-soft" : "bg-bg"}`}
            >
              <IconTile icon={NEED_META[n].icon} tone={NEED_META[n].tone} size="lg" />
              <span className="flex-1">
                <span className="block text-[1.0625rem] font-semibold">{NEED_META[n].label}</span>
                <span className="mt-0.5 block text-[0.875rem] text-ink-3">{NEED_META[n].desc}</span>
              </span>
              <span
                aria-hidden
                className={`grid h-6 w-6 place-items-center rounded-full text-white transition-colors ${on ? "bg-blue" : "bg-grey-200"}`}
              >
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
            </button>
          );
        })}
      </div>
      <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 bg-gradient-to-t from-white via-white to-white/0 px-5 pb-6 pt-6">
        <button onClick={() => onDone(sel)} className="press h-14 w-full rounded-2xl bg-blue text-[1.0625rem] font-semibold text-white">
          {sel.length === 0 ? "도움 없이 둘러볼게요" : "시작하기"}
        </button>
      </div>
    </div>
  );
}

function ShowRow({ show }: { show: Show }) {
  const d = dayOf(show.date);
  const weekend = d.getDay() === 0 || d.getDay() === 6;
  return (
    <li>
      <Link href={`/shows/${show.id}`} className="press flex items-center gap-4 px-5 py-3.5 active:bg-grey-50">
        <span className="flex w-10 shrink-0 flex-col items-center">
          <span className="num text-[1.25rem] font-bold leading-tight">{d.getDate()}</span>
          <span className={`text-[0.75rem] font-semibold ${weekend ? "text-blue" : "text-ink-3"}`}>{DOW[d.getDay()]}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1rem] font-semibold">{show.title.replace("[샘플] ", "")}</span>
          <span className="mt-0.5 block truncate text-[0.875rem] text-ink-3">
            {show.venue}, {timeKo(show.start)}
          </span>
        </span>
        <LevelPill level={peakOf(show).level} />
      </Link>
    </li>
  );
}

const QUICK: { href: string; icon: typeof Route; tone: Tone; title: string; desc: string }[] = [
  { href: "/route", icon: Navigation, tone: "blue", title: "계단 없는 길", desc: "역·주차장 → 입구" },
  { href: "/seats", icon: Armchair, tone: "purple", title: "좌석 시야", desc: "휠체어석 3D" },
  { href: "/chat", icon: MessageCircle, tone: "green", title: "말로 물어보기", desc: "음성으로 질문" },
  { href: "/card", icon: Hand, tone: "red", title: "보여주기 카드", desc: "직원에게 큰 글씨로" },
  { href: "/insight", icon: Building2, tone: "orange", title: "기관·공연장용", desc: "무대 점검·리포트·데이터" },
];

const VENUE_ID: Record<string, string> = { "KSPO DOME": "kspo", "티켓링크 라이브 아레나": "handball", 올림픽홀: "olympichall", 뮤즈라이브: "olympichall", 우리금융아트홀: "artHall" };

function NextShowCard({ show }: { show: Show }) {
  const { needs, has } = useNeeds();
  const d = dayOf(show.date);
  const venue = venues.find((v) => v.id === VENUE_ID[show.venue]);
  const route = useMemo(() => (venue ? bestExit("올림픽공원역 (5·9호선)", venue, profileFrom(needs, show.weather.precip)) : null), [venue, needs, show.weather.precip]);
  const peak = peakOf(show);
  const { arrive } = arrivalAdvice(show);
  const rows = [
    route && {
      icon: Navigation,
      text: `${route.exit.name.replace(" (5·9호선)", "")}에서 ${route.route.stepsCount ? `계단 ${route.route.stepsCount}곳, ` : has("wheelchair") ? "계단 없이 " : ""}${route.route.minutes}분`,
    },
    { icon: Clock3, text: `${timeKo(arrive)} 전에 도착하면 덜 붐벼요` },
    show.venue === "KSPO DOME" && { icon: Armchair, text: "휠체어석 시야를 3D로 미리 볼 수 있어요" },
  ].filter(Boolean) as { icon: typeof Route; text: string }[];
  return (
    <Link href={`/shows/${show.id}`} className="press mt-5 block rounded-3xl bg-grey-100 p-5">
      <div className="flex items-center justify-between">
        <span className="rounded-lg bg-bg px-2 py-1 text-[0.8125rem] font-semibold text-blue">
          {d.getMonth() + 1}월 {d.getDate()}일 {DOW[d.getDay()]}요일 {timeKo(show.start)}
        </span>
        <LevelPill level={peak.level} />
      </div>
      <p className="mt-3 text-[1.1875rem] font-bold leading-snug tracking-tight">{show.title.replace("[샘플] ", "")}</p>
      <p className="mt-0.5 text-[0.875rem] text-ink-3">{show.venue}</p>
      <ul className="mt-4 flex flex-col gap-2.5 border-t border-grey-200 pt-4">
        {rows.map((r) => {
          const I = r.icon;
          return (
            <li key={r.text} className="flex items-center gap-2.5 text-[0.9375rem] text-ink-2">
              <I size={18} className="shrink-0 text-blue" aria-hidden />
              {r.text}
            </li>
          );
        })}
      </ul>
      <span className="mt-4 flex items-center justify-end gap-0.5 text-[0.875rem] font-semibold text-ink-2">
        자세히 보기 <Chevron />
      </span>
    </Link>
  );
}

function HomeInner({ shows, source }: { shows: Show[]; source: string }) {
  const { needs, setNeeds } = useNeeds();
  const params = useSearchParams();
  const router = useRouter();
  const [all, setAll] = useState(false);
  const [tour, setTour] = useState(false);

  if (needs === null || params.get("pick")) {
    return (
      <NeedPicker
        initial={needs ?? []}
        onDone={(n) => {
          const first = needs === null;
          setNeeds(n);
          router.replace("/");
          // 처음 설정을 마친 사람에게 한 번만 둘러보기
          let seen = false;
          try {
            seen = localStorage.getItem("together-tour") === "done";
          } catch {
            /* 저장 불가 */
          }
          if (first && !seen) setTour(true);
        }}
      />
    );
  }

  const shown = all ? shows : shows.slice(0, 5);
  return (
    <div className="pb-24">
      <section className="band px-5 pb-6 pt-3">
        <h1 className="rise text-[1.5rem] font-bold leading-[1.4] tracking-tight">
          도착부터 내 자리까지
          <br />
          함께 갈게요
        </h1>
        <button
          onClick={() => setTour(true)}
          className="press mt-4 flex w-full items-center gap-3 rounded-2xl bg-blue/10 px-4 py-3 text-left"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue text-[0.9375rem] font-bold text-white" aria-hidden>
            1분
          </span>
          <span className="flex-1">
            <span className="block text-[0.9375rem] font-bold text-ink">처음이세요? 1분 둘러보기</span>
            <span className="block text-[0.8125rem] text-ink-2">길찾기부터 내 자리 시야까지 한눈에</span>
          </span>
          <Chevron />
        </button>
        {tour && <QuickTour onClose={() => setTour(false)} />}
        <NextShowCard show={shows[0]} />
        <LiveParking />
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {QUICK.map((q, i) => (
            <li key={q.href} className={i === QUICK.length - 1 && QUICK.length % 2 ? "col-span-2" : ""}>
              <Link href={q.href} className="press flex h-full flex-col gap-3 rounded-2xl bg-grey-50 p-4">
                <IconTile icon={q.icon} tone={q.tone} size="sm" />
                <span>
                  <span className="block text-[0.9375rem] font-bold">{q.title}</span>
                  <span className="block text-[0.8125rem] text-ink-3">{q.desc}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="band py-5">
        <div className="flex items-baseline justify-between px-5 pb-2">
          <h2 className="text-[1.125rem] font-bold">다가오는 공연</h2>
          <span className="text-[0.8125rem] text-ink-3">혼잡도는 가장 붐빌 때 기준</span>
        </div>
        <ul>
          {shown.map((s) => (
            <ShowRow key={s.id} show={s} />
          ))}
        </ul>
        {!all && shows.length > 5 && (
          <div className="px-5 pt-2">
            <button onClick={() => setAll(true)} className="press h-12 w-full rounded-xl bg-grey-100 text-[0.9375rem] font-semibold text-ink-2">
              공연 {shows.length - 5}개 더 보기
            </button>
          </div>
        )}
      </section>

      {source === "sample" && (
        <section className="band px-5 py-5">
          <SampleNotice />
        </section>
      )}
    </div>
  );
}

export default function Home(props: { shows: Show[]; source: string }) {
  return (
    <Suspense>
      <HomeInner {...props} />
    </Suspense>
  );
}
