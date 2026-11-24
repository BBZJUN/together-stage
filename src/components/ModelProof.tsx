"use client";

import { useState } from "react";
import v from "@/data/validation.json";

type Day = (typeof v.days)[number];

function LineChart({ d }: { d: Day }) {
  const W = 340;
  const H = 170;
  const padL = 34;
  const padB = 20;
  const padT = 10;
  const max = Math.max(...d.actual, ...d.pred) * 1.1;
  const x = (h: number) => padL + (h / 23) * (W - padL - 6);
  const y = (val: number) => padT + (H - padB - padT) * (1 - val / max);
  const line = (vals: number[]) => d.hours.map((h, i) => `${i ? "L" : "M"}${x(h).toFixed(1)},${y(vals[i]).toFixed(1)}`).join("");
  const [hi, setHi] = useState<number | null>(null);
  const ticks = [0, Math.round(max / 2 / 500) * 500, Math.round((max * 0.9) / 1000) * 1000].filter((t, i, a) => a.indexOf(t) === i);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${d.date} 실제 주차대수와 예측 비교`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - 6} y1={y(t)} y2={y(t)} stroke="var(--grey-200)" />
            <text x={padL - 4} y={y(t) + 3} fontSize={9} textAnchor="end" fill="var(--ink-3)">
              {t.toLocaleString()}
            </text>
          </g>
        ))}
        {[0, 6, 12, 18, 23].map((h) => (
          <text key={h} x={x(h)} y={H - 4} fontSize={9} textAnchor="middle" fill="var(--ink-3)">
            {h}시
          </text>
        ))}
        <path d={line(d.actual)} fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" />
        <path d={line(d.pred)} fill="none" stroke="var(--blue)" strokeWidth={2} strokeDasharray="5 3" strokeLinejoin="round" />
        {d.hours.map((h, i) => (
          <rect
            key={h}
            x={x(h) - 6}
            y={0}
            width={12}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHi(i)}
            onMouseLeave={() => setHi(null)}
            onTouchStart={() => setHi(i)}
          />
        ))}
        {hi !== null && (
          <>
            <line x1={x(d.hours[hi])} x2={x(d.hours[hi])} y1={padT} y2={H - padB} stroke="var(--grey-300)" />
            <circle cx={x(d.hours[hi])} cy={y(d.actual[hi])} r={4} fill="var(--ink)" stroke="#fff" strokeWidth={2} />
            <circle cx={x(d.hours[hi])} cy={y(d.pred[hi])} r={4} fill="var(--blue)" stroke="#fff" strokeWidth={2} />
          </>
        )}
      </svg>
      {hi !== null && (
        <div className="pointer-events-none absolute right-0 top-0 rounded-lg bg-bg px-2.5 py-1.5 text-[0.75rem] shadow-md">
          <b>{d.hours[hi]}시</b> 실제 {d.actual[hi].toLocaleString()}대 · 예측 {d.pred[hi].toLocaleString()}대
        </div>
      )}
    </div>
  );
}

export default function ModelProof() {
  const r = v.report;
  // 처음엔 가장 붐볐던 공연 날을 보여줌
  const [idx, setIdx] = useState(() => v.days.reduce((b, d, i, a) => (Math.max(...d.actual) > Math.max(...a[b].actual) ? i : b), 0));
  const d = v.days[idx];
  const cut = Math.round((1 - r.all.mae_model / r.all.mae_baseline) * 100);
  return (
    <div className="pb-24">
      <section className="band px-5 pb-6 pt-4">
        <h1 className="text-[1.5rem] font-bold leading-[1.4] tracking-tight">
          붐비는 시간,
          <br />
          이렇게 예측해요
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
          한국체육산업개발이 공개한 2025년 올림픽공원 공연·날씨·주차 연계 데이터 {r.rows_used.toLocaleString()}시간 분량으로 학습했어요.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-grey-100 p-4">
            <p className="text-[0.8125rem] text-ink-3">예측 정확도 (R²)</p>
            <p className="num mt-1 text-[1.75rem] font-bold leading-none text-blue">{r.all.r2_model}</p>
            <p className="mt-1 text-[0.75rem] text-ink-3">요일·시간 평균만 쓰면 {r.all.r2_baseline}</p>
          </div>
          <div className="rounded-2xl bg-grey-100 p-4">
            <p className="text-[0.8125rem] text-ink-3">평균 오차</p>
            <p className="num mt-1 text-[1.75rem] font-bold leading-none text-blue">{Math.round(r.all.mae_model)}대</p>
            <p className="mt-1 text-[0.75rem] text-ink-3">평균만 쓸 때보다 {cut}% 줄었어요</p>
          </div>
        </div>
        <p className="mt-3 text-[0.75rem] leading-relaxed text-ink-3">{r.cv}. 11~12월은 빈 시간대와 인위적인 값이 섞여 있어 학습에서 뺐어요.</p>
      </section>

      <section className="band px-5 py-6">
        <h2 className="text-[1.25rem] font-bold leading-snug tracking-tight">실제 공연 날, 예측과 실제 비교</h2>
        <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
          {v.days.map((day, i) => (
            <button
              key={day.date}
              onClick={() => setIdx(i)}
              aria-pressed={i === idx}
              className={`press shrink-0 rounded-full px-3.5 py-2 text-[0.8125rem] font-semibold ${i === idx ? "bg-ink text-white" : "bg-grey-100 text-ink-2"}`}
            >
              {day.date.slice(5).replace("-", "/")}
            </button>
          ))}
        </div>
        <p className="mt-4 text-[0.9375rem] font-semibold">{d.show}</p>
        <p className="text-[0.8125rem] text-ink-3">
          관람객 {d.audience.toLocaleString()}명, 이날 평균 오차 {Math.round(d.mae)}대
        </p>
        <div className="mt-3 flex gap-4 text-[0.75rem] text-ink-2">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 bg-ink" /> 실제 주차대수
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-blue" /> 모델 예측
          </span>
        </div>
        <div className="mt-2">
          <LineChart d={d} />
        </div>
        <p className="mt-2 text-[0.75rem] text-ink-3">그래프를 누르면 시간별 값을 볼 수 있어요. 예측은 그 주를 빼고 학습한 모델로 만든 값이에요.</p>
      </section>

      <section className="band px-5 py-6">
        <h2 className="text-[1.125rem] font-bold">예측에 크게 쓰이는 요인</h2>
        <ul className="mt-3 flex flex-col gap-2.5">
          {Object.entries(r.importance)
            .slice(0, 6)
            .map(([k, val], i, arr) => {
              const label: Record<string, string> = {
                temp: "기온",
                hour: "시간대",
                humid: "습도",
                month: "계절(월)",
                day_audience: "그날 공연 규모",
                dow: "요일",
                to_show: "공연 시작까지 남은 시간",
                holiday: "공휴일",
                rain: "비",
                has_show: "공연 중 여부",
                weekend: "주말",
              };
              const max = arr[0][1] as number;
              return (
                <li key={k} className="flex items-center gap-3">
                  <span className="w-[8.5rem] shrink-0 text-[0.875rem] text-ink-2">{label[k] ?? k}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-grey-100">
                    <span className="block h-full rounded-full bg-blue" style={{ width: `${((val as number) / max) * 100}%`, opacity: 1 - i * 0.1 }} />
                  </span>
                </li>
              );
            })}
        </ul>
      </section>

      <section className="band px-5 py-6">
        <h2 className="text-[1.125rem] font-bold">앱이 쓰는 방식 그대로 다시 확인했어요</h2>
        <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-3">그 주를 빼고 학습한 모델로 2025년 {r.show_day_count}개 공연일을 맞혀 본 결과예요.</p>
        <dl className="mt-4 grid grid-cols-2 gap-2">
          {[
            { k: "공연일 혼잡 단계 일치", v: `${Math.round(r.checks.level_match_show_days * 100)}%`, s: "원활·보통·혼잡·만차" },
            { k: "붐빌 수 있는 날 미리 경고", v: `${r.checks.busy_day_upper.caught} / ${r.checks.busy_day_upper.busy_days}일`, s: `평균 예측만 쓰면 ${r.checks.busy_day_mean.caught}일` },
          ].map((x) => (
            <div key={x.k} className="rounded-2xl bg-grey-100 p-4">
              <dt className="text-[0.8125rem] text-ink-3">{x.k}</dt>
              <dd className="num mt-1 text-[1.5rem] font-bold leading-none text-blue">{x.v}</dd>
              <dd className="mt-1 text-[0.75rem] text-ink-3">{x.s}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-2">
          <b>한계도 있어요.</b> 주차장이 75% 넘게 찬 시간은 1년에 {r.checks.congested_hours}시간뿐이라, 시간 단위로 정확히 맞히기는 어려워요. 그래서 붐빌 때 예상치(위쪽 범위)를 함께 계산해, 하루 중 한 번이라도
          크게 붐빌 수 있는 날은 도착 시각을 30분 앞당겨 안내해요. 경고한 날은 {r.checks.busy_day_upper.days}일 중 {r.checks.busy_day_upper.warned_days}일이에요.
        </p>
      </section>

      <section className="band px-5 py-6">
        <h2 className="text-[1.125rem] font-bold">서비스 전체를 자동으로 검증해요</h2>
        <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-3">코드나 데이터가 바뀔 때마다 GitHub Actions가 다시 확인해요.</p>
        <ul className="mt-3 flex flex-col gap-2 text-[0.875rem] leading-relaxed text-ink-2">
          <li>휠체어 경로: 역 출구·주차장 21곳 × 공연장 4곳, 84개 경로 모두 계단 0곳</li>
          <li>좌석 시야: 16,127석 계산 규칙(앞사람이 서면 줄고, 단상을 올리면 늘고) 확인, 기획서 수치 재현</li>
          <li>공연 시간: 공식 일정안내 실제 문장 13건을 사람이 읽은 값과 비교</li>
          <li>AI 안내: 데이터에 없는 시설(엘리베이터·경사로 등)은 단정하지 않는지 확인</li>
          <li>접근성: 주요 화면 WCAG 2.1 AA 자동 점검 위반 0건</li>
          <li>근거: 화면·AI 답변에 나오는 사실·숫자·인용을 공식 자료와 원문 기사에 대조 (사람 치수는 국가 인체치수조사, 걷는 속도는 경찰청 보행 기준)</li>
        </ul>
        <a href="https://github.com/BBZJUN/together-stage/actions" target="_blank" rel="noreferrer" className="press mt-4 inline-flex min-h-11 items-center rounded-xl bg-grey-100 px-4 text-[0.875rem] font-semibold">
          검증 기록 보기 (GitHub)
        </a>
        <a href="https://github.com/BBZJUN/together-stage/blob/main/docs/VERIFICATION.md" target="_blank" rel="noreferrer" className="press ml-2 mt-4 inline-flex min-h-11 items-center rounded-xl bg-grey-100 px-4 text-[0.875rem] font-semibold">
          근거 검증 보고서
        </a>
      </section>
    </div>
  );
}
