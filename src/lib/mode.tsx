"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Accessibility, Ear, Eye, Footprints, HeartHandshake, type LucideIcon } from "lucide-react";

/** 사용자가 고른 도움 유형 (복수 선택) */
export type Need = "wheelchair" | "mobility" | "lowvision" | "hearing" | "companion";

const KEY = "together-needs";

interface Ctx {
  needs: Need[] | null; // null = 아직 선택 안 함
  setNeeds: (n: Need[]) => void;
  has: (n: Need) => boolean;
  bigText: boolean;
}

const NeedsCtx = createContext<Ctx>({ needs: null, setNeeds: () => {}, has: () => false, bigText: false });

function readStored(): Need[] | null {
  try {
    const v = localStorage.getItem(KEY);
    return v ? (JSON.parse(v) as Need[]) : null;
  } catch {
    return null;
  }
}

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [needs, setState] = useState<Need[] | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(readStored());
  }, []);
  const bigText = !!needs?.includes("lowvision") || !!needs?.includes("companion");
  useEffect(() => {
    document.documentElement.classList.toggle("senior", bigText);
  }, [bigText]);
  const setNeeds = (n: Need[]) => {
    setState(n);
    try {
      localStorage.setItem(KEY, JSON.stringify(n));
    } catch {
      /* 저장 불가 환경 */
    }
  };
  return (
    <NeedsCtx.Provider value={{ needs, setNeeds, has: (n) => !!needs?.includes(n), bigText }}>{children}</NeedsCtx.Provider>
  );
}

export const useNeeds = () => useContext(NeedsCtx);

export const NEED_META: Record<Need, { label: string; desc: string; icon: LucideIcon; tone: "blue" | "green" | "orange" | "purple" | "red"; short: string }> = {
  wheelchair: { label: "휠체어를 타요", desc: "계단 없는 길, 휠체어석 시야", icon: Accessibility, tone: "blue", short: "휠체어" },
  mobility: { label: "계단이 힘들어요", desc: "다리가 불편하거나 유모차를 끌어요", icon: Footprints, tone: "green", short: "계단 피하기" },
  lowvision: { label: "글씨가 잘 안 보여요", desc: "큰 글씨와 소리 안내", icon: Eye, tone: "orange", short: "큰 글씨" },
  hearing: { label: "소리가 잘 안 들려요", desc: "글로 보는 안내, 자막·수어 공연 정보", icon: Ear, tone: "purple", short: "문자 안내" },
  companion: { label: "어르신과 함께 가요", desc: "쉬어갈 곳, 짧고 편한 길", icon: HeartHandshake, tone: "red", short: "어르신 동반" },
};
