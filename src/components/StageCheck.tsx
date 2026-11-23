"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Accessibility, Download, FileText, Play } from "lucide-react";
import { assess, LIMIT, toCSV, type Assessment } from "@/lib/assess";
import { FLOOR_R, STAND_R1, stageFrontX, type StageConfig } from "@/lib/venue";
import { Segmented } from "./ui";

const SX = stageFrontX();
const TONE = (r: number) => (r >= 0.85 ? "#3182f6" : r >= LIMIT ? "#8fb8f8" : r >= 0.3 ? "#ff9f43" : "#d42c3c");

function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-[0.8125rem] font-semibold text-ink-3">
        {label}
        <b className="num text-[0.9375rem] text-ink">
          {value}
          {unit}
        </b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1.5 w-full accent-[#3182f6]" />
    </label>
  );
}

/** 위에서 내려다본 좌석 지도 (무대가 위) */
function SeatMap({ a }: { a: Assessment }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = c.clientWidth;
    c.width = W * dpr;
    c.height = W * dpr;
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);
    const R = STAND_R1 + 2;
    const k = W / (2 * R);
    // 월드 (x: 무대 -x, z) → 화면 (무대가 위쪽)
    const P = (x: number, z: number): [number, number] => [W / 2 + z * k, W / 2 + x * k];
    g.clearRect(0, 0, W, W);
    g.fillStyle = "#f2f4f6";
    g.beginPath();
    g.arc(W / 2, W / 2, STAND_R1 * k, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#e5e8eb";
    g.beginPath();
    g.arc(W / 2, W / 2, FLOOR_R * k, 0, Math.PI * 2);
    g.fill();
    // 무대
    const s = a.stage;
    g.fillStyle = "#191f28";
    const [x0, y0] = P(SX - s.depth, -s.width / 2);
    g.fillRect(x0, y0, s.width * k, s.depth * k);
    if (s.type === "thrust" && s.thrustLength) {
      const [tx, ty] = P(SX, -2.5);
      g.fillRect(tx, ty, 5 * k, s.thrustLength * k);
    }
    if (s.speakers) {
      g.fillStyle = "#4e5968";
      for (const sd of [-1, 1]) {
        const [px, py] = P(SX - 2, sd * (s.width / 2 + 1.8) - 1.1);
        g.fillRect(px, py, 2.2 * k, 2.4 * k);
      }
    }
    const [fx, fy] = P(6, -3.5);
    g.fillStyle = "#8b95a1";
    g.fillRect(fx, fy, 7 * k, 4.5 * k);
    // 좌석
    const d = Math.max(1.4, 0.5 * k);
    for (const r of a.results) {
      const [px, py] = P(r.seat.pos[0], r.seat.pos[2]);
      g.fillStyle = TONE(r.ratio);
      g.fillRect(px - d / 2, py - d / 2, d, d);
    }
    for (const r of a.results) {
      if (!r.seat.wheelchair) continue;
      const [px, py] = P(r.seat.pos[0], r.seat.pos[2]);
      g.strokeStyle = "#191f28";
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(px, py, 3.2, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = "#ffffff";
    g.font = `600 ${Math.max(10, 11)}px Pretendard, sans-serif`;
    g.textAlign = "center";
    const [lx, ly] = P(SX - s.depth / 2, 0);
    g.fillText("무대", lx, ly + 4);
  }, [a]);
  return <canvas ref={ref} className="aspect-square w-full" aria-label="좌석별 시야 지도. 파랑은 잘 보임, 주황·빨강은 시야제한" role="img" />;
}

export default function StageCheck() {
  const [type, setType] = useState<"end" | "thrust">("end");
  const [width, setWidth] = useState(22);
  const [height, setHeight] = useState(1.8);
  const [thrust, setThrust] = useState(14);
  const [speakers, setSpeakers] = useState(true);
  const [standing, setStanding] = useState(true);
  const [platform, setPlatform] = useState(0);
  const [fence, setFence] = useState(1.0);
  const [progress, setProgress] = useState<number | null>(null);
  const [res, setRes] = useState<Assessment | null>(null);
  const job = useRef(0);

  const stage: StageConfig = useMemo(
    () => ({ type, width, depth: 8, height, thrustLength: type === "thrust" ? thrust : 0, speakers, ledHeight: 9 }),
    [type, width, height, thrust, speakers],
  );

  const run = async () => {
    const id = ++job.current;
    setProgress(0);
    const a = await assess(stage, { standing, platform, fence }, (p) => id === job.current && setProgress(p));
    if (id !== job.current) return;
    setRes(a);
    setProgress(null);
  };

  const download = () => {
    if (!res) return;
    const blob = new Blob([toCSV(res)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = `KSPO_DOME_시야점검_${type === "end" ? "끝무대" : "돌출무대"}_폭${width}m.csv`;
    el.click();
    URL.revokeObjectURL(url);
  };

  const pct = (n: number, d: number) => Math.round((n / Math.max(1, d)) * 1000) / 10;
  const worstSections = res ? [...res.sections].filter((s) => s.limited > 0).sort((a, b) => b.limited - a.limited).slice(0, 4) : [];
  const crowdSections = res ? [...res.sections].filter((s) => s.crowd > 0).sort((a, b) => b.crowd - a.crowd).slice(0, 4) : [];
  const secName = (s: { tier: string; section: string }) => (s.tier === "플로어" ? s.section : `${s.tier} ${s.section}`);

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden pb-10">
      <section className="px-5 pt-6">
        <p className="text-[0.8125rem] font-semibold text-ink-3">기획사·기관용 · KSPO DOME 실감형 콘텐츠 기반</p>
        <h1 className="mt-1 text-[1.625rem] font-bold leading-snug tracking-tight">무대 접근성 사전 점검</h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
          대관 단계에서 무대 배치를 넣으면, 실제 공연장 형상 위에서 약 1만 6천 석의 시야를 모두 계산해 시야제한석과 휠체어석 시야, 단상이 필요한 자리를 알려드려요.
        </p>
      </section>

      <section className="band mt-5 px-5 py-5 print:hidden" aria-label="무대 배치 입력">
        <p className="text-[0.8125rem] font-semibold text-ink-3">무대 형태</p>
        <div className="mt-1.5">
          <Segmented
            label="무대 형태"
            value={type}
            onChange={(v) => setType(v)}
            options={[
              { value: "end", label: "끝무대" },
              { value: "thrust", label: "돌출무대" },
            ]}
          />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Slider label="무대 폭" value={width} min={14} max={32} step={1} unit="m" onChange={setWidth} />
          <Slider label="무대 높이" value={height} min={1.0} max={2.6} step={0.1} unit="m" onChange={(v) => setHeight(Math.round(v * 10) / 10)} />
          {type === "thrust" && <Slider label="돌출 길이" value={thrust} min={6} max={20} step={1} unit="m" onChange={setThrust} />}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[0.8125rem] font-semibold text-ink-3">스피커</p>
            <div className="mt-1.5">
              <Segmented
                label="스피커"
                value={speakers ? "on" : "off"}
                onChange={(v) => setSpeakers(v === "on")}
                options={[
                  { value: "on", label: "양옆 매달기" },
                  { value: "off", label: "없음" },
                ]}
              />
            </div>
          </div>
          <div>
            <p className="text-[0.8125rem] font-semibold text-ink-3">관람 형태</p>
            <div className="mt-1.5">
              <Segmented
                label="관람 형태"
                value={standing ? "stand" : "sit"}
                onChange={(v) => setStanding(v === "stand")}
                options={[
                  { value: "sit", label: "앉아서" },
                  { value: "stand", label: "일어서서" },
                ]}
              />
            </div>
          </div>
          <div>
            <p className="text-[0.8125rem] font-semibold text-ink-3">휠체어석 단상</p>
            <div className="mt-1.5">
              <Segmented
                label="휠체어석 단상"
                value={String(platform)}
                onChange={(v) => setPlatform(Number(v))}
                options={[
                  { value: "0", label: "없음" },
                  { value: "0.3", label: "30cm" },
                  { value: "0.6", label: "60cm" },
                ]}
              />
            </div>
          </div>
        </div>
        <div className="mt-3">
          <p className="text-[0.8125rem] font-semibold text-ink-3">휠체어석 앞 펜스·난간 높이</p>
          <div className="mt-1.5">
            <Segmented
              label="휠체어석 앞 펜스 높이"
              value={String(fence)}
              onChange={(v) => setFence(Number(v))}
              options={[
                { value: "0", label: "없음" },
                { value: "1", label: "1.0m" },
                { value: "1.2", label: "1.2m" },
                { value: "1.5", label: "1.5m" },
              ]}
            />
          </div>
          <p className="mt-1.5 text-[0.75rem] leading-relaxed text-ink-3">객석통로 난간 설계 기준은 0.9~1.0m예요. 앉은 휠체어 이용자 눈높이(약 1.2m)를 넘는 펜스·표지판은 무대를 가려요.</p>
        </div>
        <button
          onClick={run}
          disabled={progress !== null}
          className="press mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue text-[1.0625rem] font-bold text-white disabled:opacity-70"
        >
          <Play size={18} aria-hidden />
          {progress !== null ? `좌석 시야 계산 중 ${Math.round(progress * 100)}%` : res ? "이 배치로 다시 점검" : "점검 시작"}
        </button>
      </section>

      {res && (
        <div aria-live="polite">
          <section className="band mt-3 px-5 py-6">
            <p className="text-[0.8125rem] text-ink-3">
              {res.stage.type === "end" ? "끝무대" : `돌출무대 ${res.stage.thrustLength}m`} · 폭 {res.stage.width}m · 높이 {res.stage.height}m · 스피커 {res.stage.speakers ? "있음" : "없음"} ·{" "}
              {res.opts.standing ? "일어서서 관람" : "앉아서 관람"}
              {res.opts.platform ? ` · 단상 ${Math.round(res.opts.platform * 100)}cm` : ""} · 휠체어석 앞 펜스 {res.opts.fence ? `${res.opts.fence}m` : "없음"}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { k: "점검한 좌석", v: res.total.toLocaleString(), s: res.opts.standing ? `일어서면 가림 ${res.crowd.toLocaleString()}석` : "플로어·2층·3층" },
                { k: "시야제한석(구조물)", v: res.limited.toLocaleString(), s: `전체의 ${pct(res.limited, res.total)}%`, warn: true },
                { k: "휠체어석 평균 시야", v: `${res.wheel.avg}%`, s: `${res.wheel.n}석 중 ${res.wheel.poor}석 제한` },
                { k: "단상 60cm 적용 시", v: `${res.wheel.avgWithPlatform}%`, s: `제한 ${res.wheel.poorWithPlatform}석`, good: true },
              ].map((t) => (
                <div key={t.k} className="rounded-2xl bg-grey-50 px-3.5 py-3">
                  <p className="text-[0.75rem] font-semibold text-ink-3">{t.k}</p>
                  <p className={`num mt-0.5 text-[1.375rem] font-bold tracking-tight ${t.warn ? "text-[#d42c3c]" : t.good ? "text-[#0a8550]" : ""}`}>{t.v}</p>
                  <p className="text-[0.75rem] text-ink-3">{t.s}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="band mt-3 px-5 py-6">
            <h2 className="text-[1.125rem] font-bold">좌석별 시야 지도</h2>
            <div className="mt-3">
              <SeatMap a={res} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                ["#3182f6", "잘 보임 85% 이상"],
                ["#8fb8f8", "조금 가림 60~85%"],
                ["#ff9f43", "많이 가림 30~60%"],
                ["#d42c3c", "거의 안 보임 30% 미만"],
              ].map(([c, t]) => (
                <span key={t} className="flex items-center gap-1 rounded-lg bg-grey-50 px-2 py-1 text-[0.75rem] font-semibold text-ink-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />
                  {t}
                </span>
              ))}
              <span className="flex items-center gap-1 rounded-lg bg-grey-50 px-2 py-1 text-[0.75rem] font-semibold text-ink-2">
                <Accessibility size={12} aria-hidden /> 테두리 = 휠체어석
              </span>
            </div>
          </section>

          <section className="band mt-3 px-5 py-6">
            <h2 className="text-[1.125rem] font-bold">권고 사항</h2>
            <ul className="mt-3 flex flex-col gap-2.5 text-[0.9375rem] leading-relaxed text-ink-2">
              <li className="rounded-2xl bg-grey-50 px-4 py-3">
                <b className="text-ink">예매 페이지 표기:</b> 무대 장치·스피커 때문에 무대가 60% 미만으로 보이는 {res.limited.toLocaleString()}석을 시야제한석으로 안내하세요.
                {worstSections.length > 0 && ` 특히 ${worstSections.map(secName).join(", ")}에 몰려 있어요.`}
              </li>
              {res.opts.standing && res.crowd > 0 && (
                <li className="rounded-2xl bg-grey-50 px-4 py-3">
                  <b className="text-ink">일어서는 공연:</b> 앞사람이 일어서면 {res.crowd.toLocaleString()}석(플로어 제외)에서 무대가 60% 미만으로 보여요
                  {crowdSections.length > 0 && ` (${crowdSections.map(secName).join(", ")} 순)`}.
                </li>
              )}
              {res.causes.펜스 > 0 && (
                <li className="rounded-2xl bg-[#fff4e5] px-4 py-3 text-[#8a4b00]">
                  <b>휠체어석 앞 펜스:</b> {res.causes.펜스}석이 펜스 때문에 무대가 가려요. 펜스·구역 표지판을 앉은 눈높이(약 1.2m)보다 낮추거나 투명 소재로 바꾸고, 표지판은 휠체어석 시선 밖으로 옮기세요.
                </li>
              )}
              {res.causes.스피커 > 0 && (
                <li className="rounded-2xl bg-grey-50 px-4 py-3">
                  <b className="text-ink">스피커:</b> 시야제한석 중 {res.causes.스피커.toLocaleString()}석은 매단 스피커 때문이에요. 스피커를 무대 바깥쪽으로 옮기거나 높이를 올리면 줄어들어요.
                </li>
              )}
              {res.wheel.poor > 0 ? (
                <li className="rounded-2xl bg-[#e6f7ee] px-4 py-3 text-[#075c38]">
                  <b>휠체어석 단상:</b> 휠체어석 {res.wheel.n}석 중 {res.wheel.poor}석은 무대가 60% 미만으로 보여요. 단상 60cm를 두면 평균 {res.wheel.avg}% → {res.wheel.avgWithPlatform}%로 올라가요.
                </li>
              ) : (
                <li className="rounded-2xl bg-[#e6f7ee] px-4 py-3 text-[#075c38]">
                  <b>휠체어석:</b> 이 배치에서는 휠체어석 {res.wheel.n}석 모두 무대가 60% 이상 보여요.
                </li>
              )}
              <li className="rounded-2xl bg-grey-50 px-4 py-3">
                <b className="text-ink">사전 안내:</b> 휠체어석 이용자에게 예매 단계에서 자리별 시야(이 서비스의 1인칭 화면 링크)를 함께 안내하세요. 공연 1~2주 전에야 시야 제한을 알게 되는 일을 막을 수 있어요.
              </li>
            </ul>
          </section>

          <section className="band mt-3 px-5 py-6">
            <h2 className="text-[1.125rem] font-bold">구역별 시야제한석</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[460px] text-left text-[0.875rem]">
                <thead>
                  <tr className="border-b border-grey-200 text-[0.75rem] text-ink-3">
                    <th className="py-2 font-semibold">층·구역</th>
                    <th className="py-2 font-semibold">블록</th>
                    <th className="py-2 text-right font-semibold">좌석</th>
                    <th className="py-2 text-right font-semibold">평균 시야</th>
                    <th className="py-2 text-right font-semibold">시야제한</th>
                    {res.opts.standing && <th className="py-2 text-right font-semibold">일어서면 가림</th>}
                    <th className="py-2 pl-3 font-semibold">주요 원인</th>
                  </tr>
                </thead>
                <tbody>
                  {res.sections.map((s) => (
                    <tr key={s.tier + s.section} className="border-b border-grey-100">
                      <td className="py-1.5">
                        {s.tier} {s.section.replace("플로어 ", "")}
                      </td>
                      <td className="py-1.5 text-ink-3">{s.block}</td>
                      <td className="num py-1.5 text-right">{s.seats}</td>
                      <td className="num py-1.5 text-right">{s.avg}%</td>
                      <td className={`num py-1.5 text-right font-semibold ${s.limited ? "text-[#d42c3c]" : "text-ink-3"}`}>{s.limited}</td>
                      {res.opts.standing && <td className={`num py-1.5 text-right ${s.tier !== "플로어" && s.crowd ? "font-semibold text-[#c4500c]" : "text-ink-3"}`}>{s.tier === "플로어" ? "스탠딩" : s.crowd}</td>}
                      <td className="py-1.5 pl-3 text-ink-3">{s.cause ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-3 flex flex-col gap-2 px-5 py-4 sm:flex-row print:hidden">
            <button onClick={download} className="press flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl bg-grey-100 py-3.5 text-[1rem] font-bold">
              <Download size={18} aria-hidden /> 좌석별 결과 CSV
            </button>
            <button onClick={() => window.print()} className="press flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 text-[1rem] font-bold text-white">
              <FileText size={18} aria-hidden /> 점검 리포트 저장(PDF)
            </button>
          </section>
          <p className="px-5 text-[0.75rem] leading-relaxed text-ink-3">
            공연장 형상: 한국체육산업개발 「올림픽공원 공연장 실감형 콘텐츠(KSPO DOME)」. 좌석 위치·구역 경계·휠체어석 세부 위치는 공식 좌석배치도를 바탕으로 한 추정이며, 무대 장치·펜스·조형물은 입력한 항목만 반영돼요. 관객 키와 점유율(60%)은 모든 좌석에 같은 규칙을 적용했어요.
          </p>
        </div>
      )}
    </div>
  );
}
