import { isOfficial, LEVEL_STYLE } from "@/lib/data";
import type { Level } from "@/lib/types";
import type { LucideIcon } from "lucide-react";
import { ChevronRight, Info } from "lucide-react";

export function LevelPill({ level, big = false }: { level: Level; big?: boolean }) {
  const s = LEVEL_STYLE[level];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-lg font-semibold ${big ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-[0.8125rem]"}`}
      style={{ color: s.color, background: `color-mix(in srgb, ${s.color} 10%, white)` }}
    >
      <span aria-hidden className="text-[0.65em]">
        {s.icon}
      </span>
      {level}
    </span>
  );
}

const TONES = {
  blue: "bg-[#e8f3ff] text-[#1b64da]",
  green: "bg-[#e6f7ee] text-[#077a49]",
  orange: "bg-[#fff1e6] text-[#ad4609]",
  purple: "bg-[#f1ecfd] text-[#6b3fd4]",
  grey: "bg-grey-100 text-ink-2",
  red: "bg-[#ffebee] text-[#c0222f]",
} as const;
export type Tone = keyof typeof TONES;

/** 아이콘 타일 (이모지 대신 일관된 선 아이콘) */
export function IconTile({ icon: Icon, tone = "grey", size = "md" }: { icon: LucideIcon; tone?: Tone; size?: "sm" | "md" | "lg" }) {
  const box = size === "lg" ? "h-12 w-12 rounded-2xl" : size === "sm" ? "h-9 w-9 rounded-xl" : "h-10 w-10 rounded-xl";
  const ic = size === "lg" ? 24 : size === "sm" ? 18 : 20;
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center ${box} ${TONES[tone]}`}>
      <Icon size={ic} strokeWidth={2.2} />
    </span>
  );
}

/** 하위 호환: 이모지 원 */
export function IconCircle({ children, tone = "grey" }: { children: React.ReactNode; tone?: "grey" | "blue" }) {
  return (
    <span aria-hidden className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl ${tone === "blue" ? "bg-blue-soft" : "bg-grey-100"}`}>
      {children}
    </span>
  );
}

export function SampleNotice() {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl bg-grey-50 p-4 text-[0.8125rem] leading-relaxed text-ink-2">
      <Info size={16} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
      <p>
        {isOfficial ? "공연 일정은 올림픽공원 공식 일정안내에서 매일 가져와요." : "공연 목록은 예시예요."} 붐비는 시간은 2025년 실제 공연·날씨·주차 기록으로 학습한 모델이 계산해요.{" "}
        <a href="/data" className="font-semibold text-blue underline underline-offset-2">
          예측 방법 보기
        </a>
      </p>
    </div>
  );
}

export function Chevron() {
  return <ChevronRight size={18} className="shrink-0 text-grey-300" aria-hidden />;
}

/** iOS·토스 스타일 세그먼트 컨트롤 */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: React.ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-grey-100 p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-lg px-3 py-2 text-[0.9375rem] font-semibold transition-all ${on ? "bg-bg text-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-ink-3"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
