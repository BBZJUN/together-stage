"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * iOS 지도 앱 스타일 바텀 시트
 * - 손잡이·머리 영역을 끌어서 위아래로 이동, 손을 떼면 가장 가까운 단계로 붙음 (빠르게 튕기면 그 방향 단계로)
 * - 손잡이 탭/Enter → 다음 단계
 * - 가장 높은 단계에서만 내용 스크롤, 내용이 맨 위일 때 아래로 끌면 시트가 내려감
 */
export function BottomSheet({
  snaps, // 보이는 높이(px) 오름차순
  index,
  onIndexChange,
  header,
  children,
  onHeightChange,
}: {
  snaps: number[];
  index: number;
  onIndexChange: (i: number) => void;
  header: React.ReactNode;
  children: React.ReactNode;
  onHeightChange?: (h: number) => void;
}) {
  const [drag, setDrag] = useState<number | null>(null); // 끄는 중인 높이
  const start = useRef<{ y: number; h: number; t: number; fromContent: boolean; onHandle?: boolean } | null>(null);
  const last = useRef<{ y: number; t: number }>({ y: 0, t: 0 });
  const prev = useRef<{ y: number; t: number }>({ y: 0, t: 0 });
  const content = useRef<HTMLDivElement>(null);
  const max = snaps[snaps.length - 1];
  const height = drag ?? snaps[index];

  useLayoutEffect(() => {
    onHeightChange?.(height);
  }, [height, onHeightChange]);

  const cycle = useCallback(() => onIndexChange(index === snaps.length - 1 ? 0 : index + 1), [index, snaps.length, onIndexChange]);

  const begin = (y: number, fromContent: boolean, onHandle = false) => {
    start.current = { y, h: snaps[index], t: performance.now(), fromContent, onHandle };
    last.current = { y, t: performance.now() };
    prev.current = last.current;
  };

  const move = useCallback(
    (y: number) => {
      const s = start.current;
      if (!s) return false;
      const dy = s.y - y; // 위로 끌면 +
      if (s.fromContent) {
        // 내용 영역에서 시작: 맨 위에서 아래로 끌 때만 시트 이동
        if (dy > 0 || (content.current?.scrollTop ?? 0) > 0) return false;
      }
      let h = s.h + dy;
      // 범위를 넘으면 고무줄처럼 저항
      if (h > max) h = max + (h - max) * 0.25;
      if (h < snaps[0]) h = snaps[0] - (snaps[0] - h) * 0.25;
      setDrag(h);
      prev.current = last.current;
      last.current = { y, t: performance.now() };
      return true;
    },
    [max, snaps],
  );

  const end = useCallback(() => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    if (drag === null || Math.abs(drag - s.h) < 4) {
      // 거의 안 움직였으면 탭: 머리 영역 탭은 다음 단계로
      setDrag(null);
      if (!s.fromContent) cycle();
      return;
    }
    const sinceLast = performance.now() - last.current.t;
    const v = ((prev.current.y - last.current.y) / Math.max(8, last.current.t - prev.current.t)) * 1000; // 직전 속도 px/s (위로 +)
    let target = snaps.reduce((bi, sh, i) => (Math.abs(sh - drag) < Math.abs(snaps[bi] - drag) ? i : bi), 0);
    if (Math.abs(v) > 500 && sinceLast < 100) {
      // 빠르게 튕김 → 진행 방향 다음 단계
      const dir = v > 0 ? 1 : -1;
      const cur = snaps.findIndex((sh) => sh >= drag);
      target = Math.max(0, Math.min(snaps.length - 1, dir > 0 ? (cur === -1 ? snaps.length - 1 : cur) : Math.max(0, (cur === -1 ? snaps.length : cur) - 1)));
    }
    setDrag(null);
    onIndexChange(target);
  }, [drag, snaps, onIndexChange, cycle]);

  useEffect(() => {
    if (index < snaps.length - 1 && content.current) content.current.scrollTop = 0;
  }, [index, snaps.length]);

  const full = index === snaps.length - 1 && drag === null;

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[28px] bg-bg shadow-[0_-6px_24px_rgba(0,0,0,0.10)] ${
        drag === null ? "transition-[height] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none" : ""
      }`}
      style={{ height }}
    >
      <div
        className="shrink-0 touch-none select-none"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          begin(e.clientY, false);
        }}
        onPointerMove={(e) => start.current && move(e.clientY)}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label={`경로 안내 ${index === snaps.length - 1 ? "내리기" : "올리기"}`}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              cycle();
            }
          }}
          className="flex w-full cursor-grab justify-center pb-2 pt-2.5 active:cursor-grabbing"
        >
          <span className="h-1.5 w-10 rounded-full bg-grey-300" />
        </div>
        <div className="px-5">{header}</div>
      </div>
      <div
        ref={content}
        className={`min-h-0 flex-1 px-5 pb-6 ${full ? "overflow-y-auto overscroll-contain" : "overflow-hidden"}`}
        onTouchStart={(e) => full && begin(e.touches[0].clientY, true)}
        onTouchMove={(e) => {
          if (full && start.current) move(e.touches[0].clientY);
        }}
        onTouchEnd={() => full && end()}
      >
        {children}
      </div>
    </div>
  );
}
