"use client";

import { useState } from "react";
import type { HourPoint } from "@/lib/types";
import { LEVEL_STYLE } from "@/lib/data";

/** 시간대별 주차장 점유율 막대 — 단일 계열, 블루 순차 램프, 상태는 툴팁 텍스트로 */
export function ForecastChart({ hours, start, end }: { hours: HourPoint[]; start: string; end: string }) {
  const startH = parseInt(start.slice(0, 2), 10);
  const endH = parseInt(end.slice(0, 2), 10);
  const defaultIdx = Math.max(0, hours.findIndex((p) => p.h === startH));
  const [sel, setSel] = useState<number>(defaultIdx);
  const p = hours[sel];

  const W = 340;
  const H = 150;
  const padB = 20;
  const padT = 8;
  const innerH = H - padB - padT;
  const bw = W / hours.length;
  const y = (v: number) => padT + innerH - (v / 100) * innerH;
  const fill = (occ: number) =>
    occ >= 95 ? "var(--seq-4)" : occ >= 75 ? "var(--seq-3)" : occ >= 50 ? "var(--seq-2)" : "var(--seq-1)";

  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <span className="num text-[1.75rem] font-bold leading-none">{p.occ}%</span>
        <span className="text-[0.875rem] text-ink-3">
          {p.h}시, 약 {p.cars.toLocaleString()}대
        </span>
        <span className="ml-auto text-[0.8125rem] font-semibold" style={{ color: LEVEL_STYLE[p.level].color }}>
          {LEVEL_STYLE[p.level].icon} {p.level}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none" role="img" aria-label={`시간대별 주차장 점유율 예측, 선택 ${p.h}시 ${p.occ}%`}>
        <line x1={0} x2={W} y1={y(100)} y2={y(100)} stroke="var(--grey-200)" strokeDasharray="3 4" />
        <text x={W} y={y(100) - 2} textAnchor="end" fontSize={9} fill="var(--ink-3)">
          만차
        </text>
        {hours.map((pt, i) => {
          const x = i * bw + 2;
          const w = bw - 4;
          const top = y(Math.max(pt.occ, 2));
          const h = padT + innerH - top;
          const r = Math.min(4, h / 2, w / 2);
          const inShow = pt.h >= startH && pt.h <= endH;
          return (
            <g key={pt.h}>
              <path
                d={`M${x},${padT + innerH} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${padT + innerH} Z`}
                fill={fill(pt.occ)}
                opacity={sel === i ? 1 : 0.55}
              />
              {inShow && <rect x={x} y={H - padB + 3} width={w} height={2} rx={1} fill="var(--ink-2)" />}
              <rect
                x={i * bw}
                y={0}
                width={bw}
                height={H}
                fill="transparent"
                onMouseEnter={() => setSel(i)}
                onTouchStart={() => setSel(i)}
                onClick={() => setSel(i)}
              />
              {(pt.h % 3 === 0 || pt.h === startH) && (
                <text
                  x={x + w / 2}
                  y={H - 3}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={pt.h === startH ? 700 : 400}
                  fill={pt.h === startH ? "var(--ink)" : "var(--ink-3)"}
                >
                  {pt.h === startH ? "시작" : `${pt.h}시`}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-[0.75rem] text-ink-3">아래 진한 선이 공연 시간이에요. 막대를 누르면 그 시간 값을 볼 수 있어요.</p>
    </div>
  );
}
