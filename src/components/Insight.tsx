"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Accessibility, CarFront, ChartLine, Database, MapPinned, MessageSquareQuote } from "lucide-react";
import ev from "@/data/evidence.json";
import ins from "@/data/insight.json";
import val from "@/data/validation.json";
import { generateSeats, seatVisibility, STAGE_PRESETS, stageObstacles, stageTargets } from "@/lib/venue";
import { Chevron, IconTile, type Tone } from "./ui";

function Card({ n, icon, tone, title, children }: { n: number; icon: typeof Database; tone: Tone; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="band px-5 py-6">
      <div className="flex items-center gap-3">
        <IconTile icon={icon} tone={tone} size="sm" />
        <span className="text-[0.8125rem] font-semibold text-ink-3">발견 {n}</span>
      </div>
      <h2 className="mt-3 text-[1.25rem] font-bold leading-snug tracking-tight">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Proposal({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 rounded-2xl bg-blue-soft px-4 py-3 text-[0.9375rem] leading-relaxed text-ink-2">{children}</p>;
}

function short(name: string) {
  return name.replace(/\s*[〈<［\[(（].*$/, "").replace(/^20\d\d\s*/, "").trim().slice(0, 22);
}

export default function Insight() {
  const wheel = useMemo(() => {
    const st = STAGE_PRESETS.end.stage;
    const T = stageTargets(st);
    const O = stageObstacles(st);
    const seats = generateSeats(st).filter((s) => s.wheelchair);
    const avg = (o: { standing: boolean; platform?: number }) =>
      Math.round((seats.map((s) => seatVisibility(s, st, o, T, O).ratio).reduce((a, b) => a + b, 0) / seats.length) * 100);
    return { n: seats.length, sit: avg({ standing: false }), stand: avg({ standing: true }), raised: avg({ standing: true, platform: 0.6 }) };
  }, []);

  const c = ins.cars_per_1k;
  const rows = [...c.top, ...c.bottom];
  const max = Math.max(...rows.map((r) => r.per1k));
  const m = ins.mobility;
  const r = val.report;

  return (
    <div className="pb-24">
      <section className="band px-5 pb-6 pt-3">
        <p className="text-[0.875rem] font-semibold text-blue">기관 리포트</p>
        <h1 className="mt-1 text-[1.5rem] font-bold leading-[1.4] tracking-tight">
          공공데이터로 찾은
          <br />
          이동약자 관람 개선 포인트
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
          한국체육산업개발이 공개한 실감형 콘텐츠·연계 데이터·공연정보와 OpenStreetMap을 분석했어요. 공연장 운영과 데이터 개방에 바로 쓸 수 있는 내용만 모았어요.
        </p>
        <Link href="/check" className="press mt-4 flex items-center justify-between rounded-2xl bg-ink px-4 py-4 text-white">
          <span>
            <span className="block text-[1rem] font-bold">무대 접근성 사전 점검</span>
            <span className="block text-[0.8125rem] opacity-75">대관 무대 배치 → 시야제한석·휠체어석·단상 권고 리포트</span>
          </span>
          <span aria-hidden className="text-[1.25rem]">›</span>
        </Link>
        <Link href="/open-data" className="press mt-2 flex items-center justify-between rounded-2xl bg-grey-100 px-4 py-4">
          <span>
            <span className="block text-[1rem] font-bold">가공 데이터 공개</span>
            <span className="block text-[0.8125rem] text-ink-3">좌석별 시야·무장애 보행망·회차별 혼잡 예측 내려받기</span>
          </span>
          <span aria-hidden className="text-[1.25rem] text-ink-3">›</span>
        </Link>
      </section>

      <section className="band px-5 py-6" aria-labelledby="voices">
        <div className="flex items-center gap-3">
          <IconTile icon={MessageSquareQuote} tone="purple" size="sm" />
          <span className="text-[0.8125rem] font-semibold text-ink-3">왜 필요한가</span>
        </div>
        <h2 id="voices" className="mt-3 text-[1.25rem] font-bold leading-snug tracking-tight">
          보도와 조사로 확인한
          <br />
          관람 현장의 목소리
        </h2>
        <ul className="mt-4 grid grid-cols-1 gap-2">
          {ev.stats.map((s) => (
            <li key={s.value} className="rounded-2xl bg-grey-50 px-4 py-3">
              <b className="num text-[1.375rem] tracking-tight">{s.value}</b>
              <p className="mt-0.5 text-[0.9375rem] leading-relaxed text-ink-2">{s.label}</p>
              <a href={s.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[0.75rem] text-ink-3 underline underline-offset-2">
                {s.source}
              </a>
            </li>
          ))}
        </ul>
        <ul className="mt-5 flex flex-col gap-4">
          {ev.voices.map((v) => (
            <li key={v.quote}>
              <blockquote className="border-l-[3px] border-blue pl-4">
                <p className="text-[1.0625rem] font-semibold leading-relaxed">&ldquo;{v.quote}&rdquo;</p>
                <footer className="mt-1 text-[0.8125rem] text-ink-3">
                  {v.who} ·{" "}
                  <a href={v.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    {v.source}
                  </a>
                </footer>
              </blockquote>
              <p className="mt-1.5 pl-[19px] text-[0.875rem] leading-relaxed text-ink-2">{v.context}</p>
            </li>
          ))}
        </ul>
        <ul className="mt-5 flex flex-col divide-y divide-grey-100">
          {ev.cases.map((c) => (
            <li key={c.title} className="py-3">
              <p className="text-[0.9375rem] font-semibold">{c.title}</p>
              <p className="mt-0.5 text-[0.875rem] leading-relaxed text-ink-2">{c.body}</p>
              <a href={c.url} target="_blank" rel="noreferrer" className="mt-0.5 inline-block text-[0.75rem] text-ink-3 underline underline-offset-2">
                {c.source}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[0.75rem] text-ink-3">{ev.note}</p>
      </section>

      <Card
        n={1}
        icon={Accessibility}
        tone="blue"
        title={
          <>
            휠체어석 바닥을 60cm 높이면
            <br />
            시야가 {wheel.stand}% → {wheel.raised}%로 돌아와요
          </>
        }
      >
        <ul className="flex flex-col gap-3">
          {[
            { l: "앞사람이 앉았을 때", v: wheel.sit, c: "#3182f6" },
            { l: "앞사람이 일어섰을 때", v: wheel.stand, c: "#c0222f" },
            { l: "일어섬 + 단상 60cm", v: wheel.raised, c: "#077a49" },
          ].map((x) => (
            <li key={x.l}>
              <div className="flex justify-between text-[0.875rem]">
                <span className="text-ink-2">{x.l}</span>
                <b className="num">{x.v}%</b>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-grey-100">
                <div className="h-full rounded-full" style={{ width: `${x.v}%`, background: x.c }} />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[0.75rem] text-ink-3">KSPO DOME 실감형 콘텐츠 기반 시뮬레이션, 끝무대 기준, 공식 배치도의 C블록 뒤편 휠체어석 {wheel.n}석 평균 (앞 난간 1.0m 반영, 1.2m 펜스면 평균 23%까지 떨어짐)</p>
        <Proposal>
          <b>제안</b> 콘서트처럼 관객이 일어서는 공연은 휠체어석 구역에 이동식 단상을 두고, 무대 배치 단계에서 휠체어석 시야를 미리 점검해 주세요.{" "}
          <Link href="/seats" className="font-semibold text-blue underline underline-offset-2">
            무대 배치 점검 해보기
          </Link>
        </Proposal>
      </Card>

      <Card
        n={2}
        icon={CarFront}
        tone="orange"
        title={
          <>
            같은 규모 공연이라도
            <br />
            차로 오는 관객은 수십 배 차이 나요
          </>
        }
      >
        <p className="text-[0.875rem] leading-relaxed text-ink-2">관람객 1,000명당 평소보다 더 들어온 주차대수 (2025년, 관람객 8천 명 이상 공연일 {c.days}일)</p>
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((x, i) => (
            <li key={x.date + i} className="flex items-center gap-2">
              <span className="w-[8.5rem] shrink-0 truncate text-[0.8125rem] text-ink-2" title={x.show}>
                {short(x.show)}
              </span>
              <span className="h-3 flex-1 overflow-hidden rounded-full bg-grey-100">
                <span className="block h-full rounded-full" style={{ width: `${Math.max(2, (x.per1k / max) * 100)}%`, background: i < c.top.length ? "#ad4609" : "#90c2ff" }} />
              </span>
              <span className="num w-12 shrink-0 text-right text-[0.8125rem] font-bold">{Math.round(x.per1k)}대</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[0.75rem] text-ink-3">같은 월·요일유형·시간대의 공연 없는 날 중앙값과 비교. 공연일 수가 적어 경향으로만 해석하세요.</p>
        <Proposal>
          <b>제안</b> 중장년 관객이 많은 공연 날은 장애인 주차구역이 일찍 찰 수 있어요. 공연 규모·관객층별 예측으로 장애인 주차구역 사전 안내와 임시 하차 구역 운영을 검토해 주세요.
        </Proposal>
      </Card>

      <Card
        n={3}
        icon={MapPinned}
        tone="purple"
        title={
          <>
            공원 주변 역 출구 {m.exits_total}곳 중
            <br />
            휠체어 이용 가능이 확인된 곳은 {m.exits_wheel_yes}곳이에요
          </>
        }
      >
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { l: "이용 가능", v: m.exits_wheel_yes, c: "text-[#077a49]" },
            { l: "이용 불가", v: m.exits_wheel_no, c: "text-[#c0222f]" },
            { l: "확인 안 됨", v: m.exits_unknown, c: "text-ink-2" },
          ].map((x) => (
            <div key={x.l} className="rounded-2xl bg-grey-50 py-3">
              <p className={`num text-[1.5rem] font-bold ${x.c}`}>{x.v}</p>
              <p className="text-[0.75rem] text-ink-3">{x.l}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-2">
          공원 안 화장실 {m.toilets}곳 중 장애인 화장실로 표시된 곳은 {m.toilets_wheel}곳이에요. 계단·경사로 정보도 지도에 일부만 있어요.
        </p>
        <Proposal>
          <b>제안</b> 공원 내 엘리베이터·경사로·계단·장애인 화장실 위치를 공공데이터로 개방해 주시면, 길찾기가 민간 지도 공백 없이 정확해져요.
        </Proposal>
      </Card>

      <Card
        n={4}
        icon={Database}
        tone="green"
        title={
          <>
            데이터 품질을 조금만 손보면
            <br />
            활용도가 크게 올라가요
          </>
        }
      >
        <ul className="flex flex-col gap-2">
          {ins.quality.map((q) => (
            <li key={q.issue} className="rounded-2xl bg-grey-50 px-4 py-3">
              <p className="text-[0.75rem] font-semibold text-ink-3">{q.dataset}</p>
              <p className="mt-1 text-[0.9375rem] leading-relaxed">{q.issue}</p>
              <p className="mt-1 text-[0.8125rem] text-[#ad4609]">→ {q.impact}</p>
            </li>
          ))}
        </ul>
      </Card>

      <section className="band px-5 py-6">
        <Link href="/data" className="press flex items-center gap-3">
          <IconTile icon={ChartLine} tone="blue" size="sm" />
          <span className="flex-1">
            <span className="block text-[1rem] font-semibold">붐비는 시간 예측 정확도 R² {r.all.r2_model}</span>
            <span className="block text-[0.8125rem] text-ink-3">2025 연계 데이터 {r.rows_used.toLocaleString()}시간 학습, 주 단위 교차검증</span>
          </span>
          <Chevron />
        </Link>
      </section>
    </div>
  );
}
