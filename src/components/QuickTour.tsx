"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, X } from "lucide-react";

const STEPS = [
  {
    img: "/tour/route.webp",
    alt: "지도 위에 역 출구에서 KSPO DOME 입구까지 계단 없는 경로가 파란 선으로 그려진 화면",
    title: "계단 없는 길",
    body: "역·주차장에서 공연장 입구까지 계단을 빼고 안내해요. 비 오는 날엔 미끄러운 길도 피하고, 한 단계씩 큰 글씨와 소리로 알려드려요.",
    href: "/route",
    cta: "길찾기 열기",
  },
  {
    img: "/tour/pov.webp",
    alt: "객석에서 바라본 공연 무대. 전광판과 조명, 앞 관객과 응원봉이 보이는 1인칭 화면",
    title: "내 자리에서 보이는 무대",
    body: "티켓에 적힌 층·구역·열·번호를 넣으면, 공연 당일 그 자리 눈높이에서 무대가 어떻게 보이는지 미리 볼 수 있어요.",
    href: "/seats",
    cta: "내 자리 찾기",
  },
  {
    img: "/tour/compare.webp",
    alt: "휠체어석 시야 비교 막대. 앞사람이 앉았을 때 100%, 일어섰을 때 72%, 단상 60cm일 때 100%",
    title: "앞사람이 일어서면?",
    body: "휠체어석에서 앞사람이 일어서거나 펜스가 높을 때 무대가 얼마나 가려지는지, 단상을 두면 얼마나 나아지는지 숫자로 비교해요.",
    href: "/seats",
    cta: "비교해 보기",
  },
  {
    img: "/tour/check.webp",
    alt: "공연장을 위에서 본 좌석 지도. 좌석마다 시야가 색으로 칠해져 있고 휠체어석은 동그라미로 표시",
    title: "공연을 준비하는 분께",
    body: "기획사·공연장은 무대 배치를 넣어 시야제한석과 휠체어석 시야를 미리 점검하고, 리포트로 내려받을 수 있어요.",
    href: "/check",
    cta: "무대 점검 열기",
  },
  {
    img: "/tour/open.webp",
    alt: "가공 데이터 공개 화면. 좌석별 시야 CSV, 무장애 보행망, 혼잡 예측 내려받기 목록",
    title: "데이터는 모두에게",
    body: "한국체육산업개발 공공데이터로 계산한 좌석 시야, 계단 없는 길, 붐비는 시간 예측을 누구나 내려받아 쓸 수 있어요.",
    href: "/open-data",
    cta: "데이터 보기",
  },
];

export default function QuickTour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);
  const start = useRef<number | null>(null);
  const s = STEPS[i];
  const last = i === STEPS.length - 1;
  const done = () => {
    try {
      localStorage.setItem("together-tour", "done");
    } catch {
      /* 저장 불가 */
    }
    onClose();
  };
  useEffect(() => {
    title.current?.focus();
  }, [i]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") done();
      if (e.key === "ArrowRight") setI((v) => Math.min(STEPS.length - 1, v + 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      className="fixed inset-0 z-[60] mx-auto flex max-w-[480px] flex-col bg-bg"
      onPointerDown={(e) => (start.current = e.clientX)}
      onPointerUp={(e) => {
        if (start.current == null) return;
        const dx = e.clientX - start.current;
        start.current = null;
        if (dx < -50) setI((v) => Math.min(STEPS.length - 1, v + 1));
        if (dx > 50) setI((v) => Math.max(0, v - 1));
      }}
    >
      <div className="flex h-14 items-center justify-between px-3">
        <button
          onClick={() => setI((v) => Math.max(0, v - 1))}
          disabled={i === 0}
          aria-label="이전"
          className="press grid h-11 w-11 place-items-center rounded-full text-ink-2 disabled:opacity-0"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex gap-1.5" aria-hidden>
          {STEPS.map((_, k) => (
            <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-5 bg-blue" : "w-1.5 bg-grey-200"}`} />
          ))}
        </div>
        <button onClick={done} aria-label="둘러보기 닫기" className="press grid h-11 w-11 place-items-center rounded-full text-ink-2">
          <X size={22} />
        </button>
      </div>

      <div className="flex flex-1 flex-col px-6 pb-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- 정적 미리보기 이미지 */}
        <img key={s.img} src={s.img} alt={s.alt} className="tour-in aspect-[4/3] w-full rounded-3xl bg-grey-100 object-cover shadow-[0_10px_30px_rgba(25,31,40,0.12)]" />
        <p className="mt-7 text-[0.875rem] font-semibold text-blue" aria-live="polite">
          {i + 1} / {STEPS.length}
        </p>
        <h2 id="tour-title" ref={title} tabIndex={-1} className="mt-1 text-[1.625rem] font-bold leading-snug tracking-tight outline-none">
          {s.title}
        </h2>
        <p className="mt-2.5 text-[1.0625rem] leading-relaxed text-ink-2">{s.body}</p>
        <div className="mt-auto flex flex-col gap-2 pt-6">
          <button onClick={() => (last ? done() : setI(i + 1))} className="press h-14 rounded-2xl bg-blue text-[1.0625rem] font-bold text-white">
            {last ? "시작하기" : "다음"}
          </button>
          <Link href={s.href} onClick={done} className="press flex h-12 items-center justify-center rounded-2xl text-[1rem] font-semibold text-ink-2">
            {s.cta}
          </Link>
        </div>
      </div>
    </div>
  );
}
