import { LEVEL_STYLE } from "@/lib/data";
import type { Level } from "@/lib/types";

export function LevelPill({ level, big = false }: { level: Level; big?: boolean }) {
  const s = LEVEL_STYLE[level];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-lg font-semibold ${
        big ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-[0.8125rem]"
      }`}
      style={{ color: s.color, background: `color-mix(in srgb, ${s.color} 11%, white)` }}
    >
      <span aria-hidden className="text-[0.65em]">
        {s.icon}
      </span>
      {level}
    </span>
  );
}

export function IconCircle({ children, tone = "grey" }: { children: React.ReactNode; tone?: "grey" | "blue" }) {
  return (
    <span
      aria-hidden
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl ${
        tone === "blue" ? "bg-blue-soft" : "bg-grey-100"
      }`}
    >
      {children}
    </span>
  );
}

export function SampleNotice() {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl bg-grey-50 p-4 text-[0.8125rem] leading-relaxed text-ink-2">
      <span aria-hidden>ℹ️</span>
      <p>
        공연 목록은 예시예요. 붐비는 시간은 2025년 실제 공연·날씨·주차 기록으로 학습한 모델이 계산해요.{" "}
        <a href="/data" className="font-semibold text-blue underline">
          예측 방법 보기
        </a>
      </p>
    </div>
  );
}

export function Chevron() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" className="shrink-0 text-grey-300">
      <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
