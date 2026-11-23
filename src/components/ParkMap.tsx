"use client";

import { F, graph, toilets, type Place, type Pt } from "@/lib/route";

/** 타일 없이 OSM 데이터로 직접 그리는 올림픽공원 지도 (운영비 0원) */
export function ParkMap({
  route,
  origin,
  dest,
  showToilets = true,
  highlightSteps = true,
  aspect = 4 / 3,
  topInset = 0,
  bottomInset = 0,
  focus,
}: {
  route?: Pt[];
  origin?: Place | null;
  dest?: Place | null;
  showToilets?: boolean;
  highlightSteps?: boolean;
  aspect?: number; // 화면 가로/세로 비율
  topInset?: number; // 위쪽을 덮는 UI 비율(0~1) — 경로가 가려지지 않게
  bottomInset?: number; // 아래쪽을 덮는 UI 비율(0~1)
  focus?: Pt | null; // 강조할 지점 (안내 모드의 현재 단계)
}) {
  // 경로가 있으면 경로 중심으로 확대
  const pts = route && route.length ? route : graph.nodes;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const pad = route ? 110 : 20;
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  if (topInset + bottomInset > 0) {
    const free = 1 - topInset - bottomInset;
    const hh = maxY - minY;
    minY -= (hh * topInset) / free;
    maxY += (hh * bottomInset) / free;
  }
  // 화면 비율에 맞추기
  const w = maxX - minX;
  const h = maxY - minY;
  const target = aspect;
  if (w / h > target) {
    const nh = w / target;
    minY -= (nh - h) / 2;
    maxY += (nh - h) / 2;
  } else {
    const nw = h * target;
    minX -= (nw - w) / 2;
    maxX += (nw - w) / 2;
  }
  const vw = maxX - minX;
  const k = vw / 400 / Math.max(0.8, Math.min(1.6, aspect / (4 / 3))); // 화면 1px 당 m (대략)
  const path = (p: Pt[]) => p.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");

  return (
    <svg
      viewBox={`${minX} ${minY} ${vw} ${maxY - minY}`}
      className="block h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={origin && dest ? `${origin.name}에서 ${dest.name}까지 경로 지도` : "올림픽공원 지도"}
    >
      <rect x={minX} y={minY} width={vw} height={maxY - minY} fill="#eef3ec" />
      {graph.buildings.map((b, i) => (
        <path key={i} d={path(b.p) + "Z"} fill={b.venue ? "#c7dbff" : "#dfe3e8"} stroke={b.venue ? "#3182f6" : "none"} strokeWidth={b.venue ? 1.2 * k : 0} />
      ))}
      {graph.ways.map((w, i) => (
        <path
          key={i}
          d={path(w.p)}
          fill="none"
          stroke={w.f & F.ROAD ? "#ffffff" : "#ffffff"}
          strokeWidth={(w.f & F.ROAD ? 3.2 : 2) * k}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {highlightSteps &&
        graph.ways
          .filter((w) => w.f & (F.STEPS | F.ROUGH))
          .map((w, i) => (
            <path
              key={`s${i}`}
              d={path(w.p)}
              fill="none"
              stroke={w.f & F.STEPS ? "#f04452" : "#e8a10c"}
              strokeWidth={2.4 * k}
              strokeDasharray={`${3 * k} ${2 * k}`}
              strokeLinecap="round"
            />
          ))}
      {route && (
        <>
          <path d={path(route)} fill="none" stroke="#ffffff" strokeWidth={8 * k} strokeLinecap="round" strokeLinejoin="round" />
          <path d={path(route)} fill="none" stroke="#3182f6" strokeWidth={5 * k} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {showToilets &&
        toilets.map((t) => (
          <g key={t.id} transform={`translate(${t.x},${t.y})`}>
            <rect x={-8 * k} y={-6 * k} width={16 * k} height={12 * k} rx={3.5 * k} fill={t.wheelchair === "yes" ? "#0a8550" : "#6b7684"} stroke="#fff" strokeWidth={1.5 * k} />
            <text fontSize={6.5 * k} fill="#fff" fontWeight={800} textAnchor="middle" dominantBaseline="central">
              WC
            </text>
          </g>
        ))}
      {graph.buildings
        .filter((b) => b.venue)
        .map((b, i) => {
          const cx = b.p.reduce((s, q) => s + q[0], 0) / b.p.length;
          const cy = b.p.reduce((s, q) => s + q[1], 0) / b.p.length;
          // 도착지 건물은 핀 위 말풍선이 이름을 대신 보여줌
          if (dest && Math.hypot(dest.x - cx, dest.y - cy) < 60 * k) return null;
          return (
            <text key={i} x={cx} y={cy} fontSize={10 * k} fontWeight={700} textAnchor="middle" fill="#1b64da" stroke="#ffffff" strokeWidth={2.5 * k} paintOrder="stroke">
              {b.name === "올림픽체조경기장" ? "KSPO DOME" : b.name === "SK올림픽핸드볼경기장" ? "핸드볼경기장" : b.name}
            </text>
          );
        })}
      {origin && (
        <g transform={`translate(${origin.x},${origin.y})`}>
          <circle r={9 * k} fill="#191f28" stroke="#fff" strokeWidth={2.5 * k} />
          <text fontSize={9 * k} fill="#fff" textAnchor="middle" dominantBaseline="central" fontWeight={700}>
            {origin.kind === "exit" ? origin.ref : "P"}
          </text>
        </g>
      )}
      {focus && (
        <g transform={`translate(${focus[0]},${focus[1]})`}>
          <circle r={18 * k} fill="#3182f6" opacity={0.18}>
            <animate attributeName="r" values={`${12 * k};${24 * k};${12 * k}`} dur="1.6s" repeatCount="indefinite" />
          </circle>
          <circle r={7 * k} fill="#ffffff" stroke="#3182f6" strokeWidth={3.5 * k} />
        </g>
      )}
      {dest && (
        <g transform={`translate(${dest.x},${dest.y})`}>
          <ellipse cx={0} cy={0} rx={6 * k} ry={2.2 * k} fill="#191f28" opacity={0.18} />
          <path
            d={`M0 0 C ${-3 * k} ${-6 * k} ${-11 * k} ${-11 * k} ${-11 * k} ${-20 * k} A ${11 * k} ${11 * k} 0 1 1 ${11 * k} ${-20 * k} C ${11 * k} ${-11 * k} ${3 * k} ${-6 * k} 0 0 Z`}
            fill="#3182f6"
            stroke="#fff"
            strokeWidth={2.5 * k}
          />
          <circle cy={-20 * k} r={4.2 * k} fill="#fff" />
          {(() => {
            const label = dest.name.replace("올림픽체조경기장", "KSPO DOME").replace("SK올림픽핸드볼경기장", "핸드볼경기장");
            const w = (label.length * 7.6 + 18) * k;
            return (
              <g transform={`translate(0 ${-44 * k})`}>
                <rect x={-w / 2} y={-10 * k} width={w} height={20 * k} rx={10 * k} fill="#191f28" />
                <text fontSize={10.5 * k} fill="#fff" fontWeight={700} textAnchor="middle" dominantBaseline="central">
                  {label}
                </text>
              </g>
            );
          })()}
        </g>
      )}
    </svg>
  );
}
