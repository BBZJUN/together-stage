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
  const [idx, setIdx] = useState(0);
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
    </div>
  );
}
