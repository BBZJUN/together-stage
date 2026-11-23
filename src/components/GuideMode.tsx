"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUp, Car, ChevronLeft, ChevronRight, CornerUpLeft, CornerUpRight, MapPin, TriangleAlert, Volume2, VolumeX, X } from "lucide-react";
import type { Place, RouteResult } from "@/lib/route";
import { ParkMap } from "./ParkMap";

const ICON: Record<string, typeof ArrowUp> = { "⚠️": TriangleAlert, "🪨": TriangleAlert, "🚗": Car, "↱": CornerUpRight, "↰": CornerUpLeft, "⬆️": ArrowUp, "📍": MapPin };

/** 한 단계씩 크게 보여주고 읽어주는 안내 모드 (저시력·어르신용) */
export function GuideMode({ route, origin, dest, onClose }: { route: RouteResult; origin: Place; dest: Place; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [voice, setVoice] = useState(true);
  const steps = route.steps;
  const s = steps[i];
  const last = i === steps.length - 1;
  const I = ICON[s.icon] ?? ArrowUp;
  const left = steps.slice(i).reduce((a, b) => a + b.meters, 0);

  const speak = useCallback(
    (text: string) => {
      if (!voice || typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/m\b/g, "미터"));
      u.lang = "ko-KR";
      u.rate = 0.92;
      window.speechSynthesis.speak(u);
    },
    [voice],
  );

  useEffect(() => {
    speak(i === 0 ? `${origin.name}에서 출발합니다. ${s.text}` : s.text);
    if ("vibrate" in navigator) navigator.vibrate?.(30);
  }, [i, s.text, origin.name, speak]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setI((v) => Math.min(steps.length - 1, v + 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1));
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length, onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label="길 안내" className="fixed inset-0 z-50 mx-auto flex max-w-[480px] flex-col bg-bg">
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
        <button onClick={onClose} aria-label="안내 끝내기" className="press grid h-11 w-11 place-items-center rounded-full bg-grey-100">
          <X size={20} />
        </button>
        <p className="text-[0.9375rem] font-semibold text-ink-2" aria-live="polite">
          {i + 1} / {steps.length} 단계
        </p>
        <button
          onClick={() => setVoice(!voice)}
          aria-pressed={voice}
          aria-label={voice ? "소리 끄기" : "소리 켜기"}
          className={`press grid h-11 w-11 place-items-center rounded-full ${voice ? "bg-blue-soft text-blue" : "bg-grey-100 text-ink-3"}`}
        >
          {voice ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
      </div>

      {/* 진행 막대 */}
      <div className="mx-4 flex gap-1" aria-hidden>
        {steps.map((_, k) => (
          <span key={k} className={`h-1.5 flex-1 rounded-full ${k <= i ? "bg-blue" : "bg-grey-200"}`} />
        ))}
      </div>

      <div className="relative mx-4 mt-4 flex-1 overflow-hidden rounded-3xl bg-[#eef3ec]">
        <ParkMap route={route.points} origin={origin} dest={dest} focus={s.at} aspect={0.85} />
      </div>

      <div className="px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-5">
        <div className="flex items-start gap-4" aria-live="assertive">
          <span
            aria-hidden
            className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl ${last ? "bg-blue text-white" : s.warn ? "bg-[#fff1e6] text-[#c4500c]" : "bg-grey-100 text-ink"}`}
          >
            <I size={34} strokeWidth={2.4} />
          </span>
          <p className={`text-[1.625rem] font-bold leading-snug tracking-tight ${s.warn ? "text-[#c4500c]" : ""}`}>{s.text}</p>
        </div>
        <p className="mt-3 text-[1rem] text-ink-3">
          {last ? "도착했어요. 입구에서 안내 직원에게 휠체어석 입장 위치를 물어보세요." : `도착까지 약 ${left.toLocaleString()}m 남았어요`}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => setI(Math.max(0, i - 1))}
            disabled={i === 0}
            aria-label="이전 단계"
            className="press grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-grey-100 text-ink-2 disabled:opacity-40"
          >
            <ChevronLeft size={26} />
          </button>
          <button
            onClick={() => (last ? onClose() : setI(i + 1))}
            className="press flex h-16 flex-1 items-center justify-center gap-1 rounded-2xl bg-blue text-[1.25rem] font-bold text-white"
          >
            {last ? "안내 끝내기" : "다음"}
            {!last && <ChevronRight size={24} />}
          </button>
        </div>
        <button onClick={() => speak(s.text)} className="press mt-2 h-12 w-full rounded-2xl text-[0.9375rem] font-semibold text-ink-2">
          다시 듣기
        </button>
      </div>
    </div>
  );
}
