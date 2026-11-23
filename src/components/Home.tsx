"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { peakOf, timeKo } from "@/lib/data";
import { NEED_META, useNeeds, type Need } from "@/lib/mode";
import type { Show } from "@/lib/types";
import { Chevron, IconCircle, LevelPill, SampleNotice } from "./ui";

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
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-grey-100 text-2xl" aria-hidden>
                {NEED_META[n].emoji}
              </span>
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

const QUICK = [
  { href: "/route", icon: "🧭", title: "계단 없는 길 찾기", desc: "역·주차장에서 공연장 입구까지" },
  { href: "/seats", icon: "🎭", title: "내 자리 시야 미리보기", desc: "휠체어석에서 무대가 보일까?" },
  { href: "/chat", icon: "💬", title: "말로 물어보기", desc: "“올림픽공원역에서 KSPO DOME 어떻게 가요?”" },
];

function HomeInner({ shows, source }: { shows: Show[]; source: string }) {
  const { needs, setNeeds } = useNeeds();
  const params = useSearchParams();
  const router = useRouter();

  if (needs === null || params.get("pick")) {
    return (
      <NeedPicker
        initial={needs ?? []}
        onDone={(n) => {
          setNeeds(n);
          router.replace("/");
        }}
      />
    );
  }

  return (
    <div className="pb-24">
      <section className="band px-5 pb-5 pt-4">
        <h1 className="rise text-[1.5rem] font-bold leading-[1.4] tracking-tight">
          올림픽공원 공연,
          <br />
          도착부터 내 자리까지 함께 갈게요
        </h1>
        <ul className="mt-5 flex flex-col gap-1">
          {QUICK.map((q) => (
            <li key={q.href}>
              <Link href={q.href} className="press flex items-center gap-3 rounded-2xl px-1 py-2.5">
                <IconCircle tone="blue">{q.icon}</IconCircle>
                <span className="flex-1">
                  <span className="block text-[1rem] font-semibold">{q.title}</span>
                  <span className="block text-[0.8125rem] text-ink-3">{q.desc}</span>
                </span>
                <Chevron />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="band py-5">
        <h2 className="px-5 pb-2 text-[1.125rem] font-bold">다가오는 공연</h2>
        <ul>
          {shows.map((s) => (
            <ShowRow key={s.id} show={s} />
          ))}
        </ul>
        <p className="px-5 pt-3 text-[0.8125rem] text-ink-3">표시는 그날 공원이 가장 붐빌 때 기준이에요. 붐비는 날은 일찍 도착하면 편해요.</p>
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
